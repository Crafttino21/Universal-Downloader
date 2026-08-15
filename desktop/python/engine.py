"""Download engine.

Ported from ``source/converter.py`` (class ``YoutubeBeta`` plus the image
downloader in ``functions.menu``). Everything interactive — ``input()``,
``print()``, the ctypes message boxes — is gone; callers get structured
callbacks instead so the Electron UI can render progress itself.
"""

from __future__ import annotations

import os
import re
import shutil
import time
from typing import Callable, Optional
from urllib.parse import unquote, urlparse

import requests
import yt_dlp

from ffmpeg_setup import FfmpegManager


class DownloadCancelled(Exception):
    """Raised out of a progress hook to unwind yt-dlp's download loop."""


# How often a whole job is re-extracted after a transient failure.
MAX_ATTEMPTS = 3

# Errors worth a fresh extraction: the media URL went stale or we got throttled.
_TRANSIENT = re.compile(
    r"(403|429|forbidden|too many requests|timed out|timeout|connection reset|"
    r"connection aborted|temporarily unavailable|unable to download video data|"
    r"read operation timed out|incomplete|content too short)",
    re.IGNORECASE,
)


def is_transient(exc: Exception) -> bool:
    return bool(_TRANSIENT.search(str(exc)))


def detect_js_runtimes() -> dict:
    """yt-dlp needs a JS runtime for some YouTube formats.

    It defaults to Deno, which almost nobody has. Enable whatever is actually on
    PATH — an empty dict means yt-dlp keeps its own default.
    """
    found = {}
    for name in ("deno", "node", "bun"):
        path = shutil.which(name)
        if path:
            found[name] = {"path": path}
    return found


# --------------------------------------------------------------------------
# URL handling
# --------------------------------------------------------------------------

def normalize_youtube_url(url: str) -> str:
    """converter.py:286-314 — Shorts, youtu.be and bare video IDs to /watch."""
    url = str(url).strip()
    if not url:
        return url

    lower = url.lower()

    # Handle raw IDs
    if "://" not in url and "/" not in url and "?" not in url and len(url) >= 8:
        return "https://www.youtube.com/watch?v=" + url

    # youtube shorts -> watch
    if "youtube.com/shorts/" in lower:
        idx = lower.find("youtube.com/shorts/")
        video_id = url[idx + len("youtube.com/shorts/"):]
        video_id = video_id.split("?", 1)[0].split("&", 1)[0].split("/", 1)[0].strip()
        if video_id:
            return "https://www.youtube.com/watch?v=" + video_id

    # youtu.be/<id> -> watch
    if "youtu.be/" in lower:
        idx = lower.find("youtu.be/")
        video_id = url[idx + len("youtu.be/"):]
        video_id = video_id.split("?", 1)[0].split("&", 1)[0].split("/", 1)[0].strip()
        if video_id:
            return "https://www.youtube.com/watch?v=" + video_id

    return url


# --------------------------------------------------------------------------
# Format selection
# --------------------------------------------------------------------------

def build_video_format(quality: str, has_ffmpeg: bool) -> str:
    """Format selector for MP4 output.

    The ``best`` branch is byte-for-byte the selector the CLI has always used
    (converter.py:342-345); the capped branches add a height ceiling with the
    same fallback ladder.
    """
    if quality == "best":
        if has_ffmpeg:
            return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best"
        return "best[ext=mp4]/best"

    height = int(quality)
    if has_ffmpeg:
        return (
            f"bestvideo[ext=mp4][height<={height}]+bestaudio[ext=m4a]/"
            f"bestvideo[height<={height}]+bestaudio/"
            f"best[ext=mp4][height<={height}]/best[height<={height}]/best"
        )
    return f"best[ext=mp4][height<={height}]/best[height<={height}]/best"


def build_outtmpl(output_path: str) -> str:
    """converter.py:331-335 — let yt-dlp pick the extension."""
    if (
        os.path.isdir(output_path)
        or output_path.endswith(os.path.sep)
        or output_path.endswith("/")
        or output_path.endswith("\\")
    ):
        return os.path.join(output_path, "%(title)s.%(ext)s")
    base, ext = os.path.splitext(output_path)
    return (base if ext else output_path) + ".%(ext)s"


# --------------------------------------------------------------------------
# Engine
# --------------------------------------------------------------------------

class Engine:
    def __init__(self, ffmpeg: FfmpegManager) -> None:
        self.ffmpeg = ffmpeg

    def _base_opts(self, job: dict) -> dict:
        """Options shared by both modes — same flags the CLI used."""
        output_dir = job["outputDir"] or os.getcwd()
        os.makedirs(output_dir, exist_ok=True)

        opts: dict = {
            "outtmpl": build_outtmpl(output_dir),
            "noplaylist": not job.get("playlist", False),
            "continuedl": True,
            "nocheckcertificate": True,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            # yt-dlp writes to stdout by default; our stdout is the NDJSON
            # protocol channel, so silence it entirely.
            "logger": _NullLogger(),
            # YouTube hands out media URLs that intermittently 403. Retrying
            # inside yt-dlp clears most of them without re-extracting.
            "retries": 10,
            "fragment_retries": 10,
            "extractor_retries": 3,
            "skip_unavailable_fragments": True,
        }

        runtimes = detect_js_runtimes()
        if runtimes:
            opts["js_runtimes"] = runtimes

        cookiefile = job.get("cookiefile")
        if cookiefile:
            opts["cookiefile"] = cookiefile

        location = self.ffmpeg.ffmpeg_location()
        if location:
            opts["ffmpeg_location"] = location

        return opts

    def build_opts(self, job: dict) -> dict:
        """Mode-specific yt-dlp options (converter.py:337-362 and :384-404)."""
        opts = self._base_opts(job)
        has_ffmpeg = self.ffmpeg.is_installed()

        if job["mode"] == "audio":
            if not has_ffmpeg:
                raise RuntimeError(
                    "FFmpeg not found. MP3 conversion requires FFmpeg — install it from the banner."
                )
            opts["format"] = "bestaudio[ext=m4a]/bestaudio/best"
            opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": str(job.get("audioBitrate") or "192"),
                }
            ]
        else:
            opts["format"] = build_video_format(job.get("videoQuality") or "best", has_ffmpeg)
            if has_ffmpeg:
                opts["merge_output_format"] = "mp4"

        return opts

    # -- probe -------------------------------------------------------------

    def probe(self, url: str, cookiefile: Optional[str] = None) -> dict:
        """Fetch metadata without downloading."""
        url = normalize_youtube_url(url)
        opts: dict = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "nocheckcertificate": True,
            "skip_download": True,
            "logger": _NullLogger(),
        }
        if cookiefile:
            opts["cookiefile"] = cookiefile

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)

        is_playlist = info.get("_type") == "playlist"
        if is_playlist:
            entries = [e for e in (info.get("entries") or []) if e]
            first = entries[0] if entries else {}
            return {
                "title": info.get("title") or first.get("title") or url,
                "thumbnail": first.get("thumbnail"),
                "duration": None,
                "uploader": info.get("uploader") or first.get("uploader"),
                "extractor": info.get("extractor_key"),
                "heights": _distinct_heights(first),
                "isPlaylist": True,
                "playlistCount": len(entries),
            }

        return {
            "title": info.get("title") or url,
            "thumbnail": info.get("thumbnail"),
            "duration": info.get("duration"),
            "uploader": info.get("uploader"),
            "extractor": info.get("extractor_key"),
            "heights": _distinct_heights(info),
            "isPlaylist": False,
            "playlistCount": None,
        }

    # -- download ----------------------------------------------------------

    def download(
        self,
        job: dict,
        on_progress: Callable[[dict], None],
        on_status: Callable[[str, Optional[str]], None],
        is_cancelled: Callable[[], bool],
    ) -> dict:
        """Run one download, re-extracting on transient failures.

        A stale or throttled media URL is the single most common failure against
        YouTube, and a fresh extraction almost always fixes it.

        Raises :class:`DownloadCancelled` if ``is_cancelled`` flips to True.
        """
        last: Exception | None = None

        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                return self._download_once(job, on_progress, on_status, is_cancelled)
            except DownloadCancelled:
                raise
            except Exception as exc:
                last = exc
                if attempt >= MAX_ATTEMPTS or not is_transient(exc):
                    raise
                if is_cancelled():
                    raise DownloadCancelled() from exc
                on_status("retrying", f"{attempt}/{MAX_ATTEMPTS}")
                time.sleep(2 * attempt)

        raise last if last else RuntimeError("Download failed for an unknown reason.")

    def _download_once(
        self,
        job: dict,
        on_progress: Callable[[dict], None],
        on_status: Callable[[str, Optional[str]], None],
        is_cancelled: Callable[[], bool],
    ) -> dict:
        url = normalize_youtube_url(job["url"])
        opts = self.build_opts(job)

        last_emit = [0.0]
        # A `bestvideo+bestaudio` selection downloads two separate streams, and
        # yt-dlp reports 0-100% for each of them. Tracking bytes per stream and
        # summing keeps one continuous bar instead of one that restarts midway.
        streams: dict[str, dict] = {}
        peak = [0.0]

        def aggregate() -> tuple[float, int, Optional[int]]:
            downloaded = sum(s["downloaded"] for s in streams.values())
            totals = [s["total"] for s in streams.values()]
            total = sum(t for t in totals if t) if all(totals) else None
            percent = (downloaded * 100.0 / total) if total else peak[0]
            # Adding a second stream grows the denominator, which would other-
            # wise drag the bar backwards. Never let it retreat.
            percent = max(min(percent, 100.0), peak[0])
            peak[0] = percent
            return percent, downloaded, total

        def emit(speed, eta) -> None:
            percent, downloaded, total = aggregate()
            on_progress(
                {
                    "percent": round(percent, 1),
                    "speed": speed,
                    "eta": eta,
                    "downloaded": downloaded,
                    "total": total,
                }
            )

        def progress_hook(d: dict) -> None:
            if is_cancelled():
                raise DownloadCancelled()

            status = d.get("status")
            if status not in ("downloading", "finished"):
                return

            key = d.get("tmpfilename") or d.get("filename") or "stream"
            entry = streams.setdefault(key, {"downloaded": 0, "total": None})
            entry["downloaded"] = d.get("downloaded_bytes") or entry["downloaded"]
            entry["total"] = (
                d.get("total_bytes") or d.get("total_bytes_estimate") or entry["total"]
            )

            if status == "finished":
                if entry["total"]:
                    entry["downloaded"] = entry["total"]
                emit(None, None)
                return

            # Throttle to ~4 events/s; a fast fragmented download otherwise
            # fires hundreds of hooks per second and floods the IPC bridge.
            now = time.monotonic()
            if now - last_emit[0] < 0.25:
                return
            last_emit[0] = now

            emit(d.get("speed"), d.get("eta"))

        def postprocessor_hook(d: dict) -> None:
            if d.get("status") == "started":
                on_status("postprocessing", d.get("postprocessor"))

        opts["progress_hooks"] = [progress_hook]
        opts["postprocessor_hooks"] = [postprocessor_hook]

        on_status("downloading", None)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
        except Exception:
            # `continuedl` keeps .part files around so an interrupted download can
            # resume. A deliberate cancel is not an interruption — bin them.
            if is_cancelled():
                _discard_partials(streams.keys())
                raise DownloadCancelled()
            raise

        if is_cancelled():
            _discard_partials(streams.keys())
            raise DownloadCancelled()

        # Everything (including the merge) is done — close the bar out.
        peak[0] = 100.0
        emit(None, 0)

        filepath = _final_filepath(info)
        filesize = None
        if filepath and os.path.isfile(filepath):
            filesize = os.path.getsize(filepath)

        return {
            "filepath": filepath,
            "filesize": filesize,
            "title": info.get("title"),
        }

    # -- image -------------------------------------------------------------

    def download_image(self, url: str, output_dir: str) -> dict:
        """converter.py:625-632, but without clobbering a fixed ``output.png``."""
        os.makedirs(output_dir, exist_ok=True)

        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            filename = _image_filename(url, r.headers.get("Content-Type"))
            target = _unique_path(os.path.join(output_dir, filename))
            with open(target, "wb") as f:
                for chunk in r.iter_content(chunk_size=256 * 1024):
                    if chunk:
                        f.write(chunk)

        return {"filepath": target, "filesize": os.path.getsize(target)}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

class _NullLogger:
    def debug(self, msg): pass
    def info(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass


def _discard_partials(paths) -> None:
    """Remove the temp files a cancelled download left behind."""
    for raw in paths:
        if not raw or raw == "stream":
            continue
        candidates = {raw, raw + ".part"}
        if raw.endswith(".part"):
            candidates.add(raw[: -len(".part")])
        for candidate in candidates:
            try:
                if os.path.isfile(candidate):
                    os.remove(candidate)
            except OSError:
                # Still held by a writer — leaving it is better than crashing.
                pass


def _distinct_heights(info: dict) -> list:
    heights = set()
    for fmt in info.get("formats") or []:
        h = fmt.get("height")
        if isinstance(h, int) and h > 0:
            heights.add(h)
    if not heights and isinstance(info.get("height"), int):
        heights.add(info["height"])
    return sorted(heights, reverse=True)


def _final_filepath(info: dict) -> Optional[str]:
    """The path *after* merging/postprocessing.

    ``prepare_filename`` would give the pre-postprocessing name, which is wrong
    for MP3 extraction and for merged MP4s.
    """
    if not info:
        return None

    requested = info.get("requested_downloads")
    if requested:
        entry = requested[0]
        return entry.get("filepath") or entry.get("_filename")

    # Playlists report per-entry downloads.
    entries = info.get("entries")
    if entries:
        for entry in entries:
            if not entry:
                continue
            path = _final_filepath(entry)
            if path:
                return path

    return info.get("filepath") or info.get("_filename")


_SAFE_NAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

_MIME_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
}


def _image_filename(url: str, content_type: Optional[str]) -> str:
    path = unquote(urlparse(url).path)
    base = os.path.basename(path) or "image"
    base = _SAFE_NAME.sub("_", base).strip() or "image"

    stem, ext = os.path.splitext(base)
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime in _MIME_EXT:
        ext = _MIME_EXT[mime]
    elif not ext:
        ext = ".png"

    return (stem or "image") + ext


def _unique_path(path: str) -> str:
    if not os.path.exists(path):
        return path
    stem, ext = os.path.splitext(path)
    n = 1
    while os.path.exists(f"{stem}-{n}{ext}"):
        n += 1
    return f"{stem}-{n}{ext}"
