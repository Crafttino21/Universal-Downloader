"""Download engine.

Ported from ``source/converter.py`` (class ``YoutubeBeta`` plus the image
downloader in ``functions.menu``). Everything interactive — ``input()``,
``print()``, the ctypes message boxes — is gone; callers get structured
callbacks instead so the Electron UI can render progress itself.
"""

from __future__ import annotations

import math
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


# --------------------------------------------------------------------------
# Audio selection
#
# The bitrate setting is a *ceiling on the source stream*, exactly like
# `videoQuality` is a ceiling on height — not a re-encode target. Picking 128 on
# a track that carries 160/128/96 downloads the real 128 kbps stream instead of
# squeezing the 160 one down, so nothing is ever re-encoded without cause.
#
# `audio_options` precomputes the whole menu for the renderer, so the UI never
# has to re-implement any of this.
# --------------------------------------------------------------------------

def normalize_acodec(acodec: Optional[str]) -> str:
    """Predict what ffprobe will call this codec.

    yt-dlp's ``FFmpegExtractAudioPP`` decides copy-vs-encode by comparing its
    target format against ffprobe's answer, so ``mp4a.40.2`` has to collapse to
    ``aac`` here or we'd mispredict the whole thing.
    """
    a = (acodec or "").lower().strip()
    if not a or a == "none":
        return ""
    if a.startswith("mp4a") or a.startswith("aac"):
        return "aac"
    if a.startswith("mp3"):
        return "mp3"
    if a.startswith("opus"):
        return "opus"
    if a.startswith("vorbis"):
        return "vorbis"
    return a


def _is_audio_only(fmt: dict) -> bool:
    return (fmt.get("vcodec") in (None, "none")) and (fmt.get("acodec") not in (None, "none"))


def _format_abr(fmt: dict, audio_only: bool) -> Optional[float]:
    abr = fmt.get("abr")
    # `tbr` is the whole stream — only equal to the audio rate when there is no
    # video riding along.
    if abr is None and audio_only:
        abr = fmt.get("tbr")
    if abr is None:
        return None
    try:
        value = float(abr)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


# Codecs `FFmpegExtractAudio` can drop into a common container untouched — AAC
# into .m4a, MP3 into .mp3. Anything else has to be re-encoded.
_COPYABLE_ACODECS = ("aac", "mp3")


def choose_audio(formats: list, cap=None) -> Optional[dict]:
    """The one audio stream to download, given a ceiling in kbps.

    Prefers a stream that can be copied losslessly over one that would have to be
    re-encoded, and within that the highest rate the ceiling allows. Like
    `build_video_format`, a ceiling nothing meets falls back to the source's best
    rather than failing.

    This is used *as* yt-dlp's format selector (see `audio_format_selector`), so
    what the preview promises and what gets downloaded cannot drift apart.
    """
    audio_only = [f for f in formats if _is_audio_only(f)]
    limit = float(cap) if cap not in (None, "", "auto") else None

    def best(pool: list, audio: bool = True) -> Optional[dict]:
        rated = [(f, _format_abr(f, audio)) for f in pool]
        rated = [(f, abr) for f, abr in rated if abr is not None]
        if not rated:
            return pool[0] if pool else None
        return max(rated, key=lambda pair: pair[1])[0]

    def fits(fmt: dict) -> bool:
        abr = _format_abr(fmt, True)
        return limit is None or (abr is not None and abr <= limit)

    copyable = [
        f for f in audio_only if normalize_acodec(f.get("acodec")) in _COPYABLE_ACODECS
    ]

    tiers = [[f for f in copyable if fits(f)], [f for f in audio_only if fits(f)]]
    if limit is not None:
        tiers += [copyable, audio_only]

    for pool in tiers:
        chosen = best(pool)
        if chosen is not None:
            return chosen

    # No audio-only stream at all — fall back to whatever carries sound.
    return best(formats, audio=False)


def audio_format_selector(cap):
    """`choose_audio` wrapped as a yt-dlp format selector callable.

    yt-dlp accepts a callable for ``format`` and calls it with a context holding
    the format list (``YoutubeDL._select_formats``).
    """

    def selector(ctx):
        chosen = choose_audio(ctx.get("formats") or [], cap)
        if chosen is not None:
            yield chosen

    return selector


def pick_source_audio(info: dict, cap=None) -> tuple:
    """``(abr, acodec, ext)`` of the stream `choose_audio` settles on."""
    chosen = choose_audio(info.get("formats") or [], cap)
    if chosen is None:
        # Some extractors return a bare single format instead of a list.
        chosen = info
    return (
        _format_abr(chosen, _is_audio_only(chosen)),
        normalize_acodec(chosen.get("acodec")),
        chosen.get("ext"),
    )


def decide_audio(requested, src_abr: Optional[float], src_acodec: Optional[str]) -> tuple:
    """Container and quality for the stream that was selected.

    Returns ``(preferredcodec, preferredquality, summary)``. ``preferredquality``
    of ``None`` means "no re-encode" — yt-dlp copies the stream as-is.

    ``requested`` only matters when the source told us nothing; otherwise the cap
    already did the choosing in `choose_audio`, and all that's left is to
    keep the bits we downloaded rather than run them through ffmpeg again.
    """
    codec = normalize_acodec(src_acodec)

    # Nothing known about the source (extractor reported no formats). Fall back
    # to the old fixed-bitrate behaviour rather than guessing.
    if not codec or not src_abr:
        quality = "192" if str(requested or "auto") == "auto" else str(requested)
        return "mp3", quality, f"MP3 · {quality} kbps"

    kbps = int(round(src_abr))

    # Same codec in, same codec out: yt-dlp runs `-acodec copy`.
    if codec == "mp3":
        return "mp3", None, f"MP3 · {kbps} kbps (Original)"
    # aac -> m4a is a container swap, not a re-encode.
    if codec == "aac":
        return "m4a", None, f"M4A · {kbps} kbps (Original)"

    # opus, vorbis, … — nothing common copies these, so encode at the source's
    # own rate. Going higher would only inflate the file.
    return "mp3", str(kbps), f"MP3 · {kbps} kbps"


def audio_options(info: dict) -> list:
    """The whole bitrate menu for one source, best first.

    One entry per rate the source actually carries, each already resolved to what
    picking it produces — so the renderer just renders and never re-derives.
    """
    rates = _distinct_audio_bitrates(info)
    options: list = []
    seen = set()

    for rate in rates:
        abr, acodec, _ = pick_source_audio(info, cap=rate)
        if not abr:
            continue
        codec, quality, _summary = decide_audio(rate, abr, acodec)
        container = "m4a" if codec == "m4a" else "mp3"
        kbps = int(quality) if quality else int(round(abr))
        # Two caps that resolve to the same file are one choice, not two.
        key = (kbps, container)
        if key in seen:
            continue
        seen.add(key)
        options.append(
            {
                "cap": rate,
                "kbps": kbps,
                "container": container,
                "copied": quality is None,
                # Forwarded into the job so the engine can skip its own probe.
                "abr": abr,
                "acodec": acodec,
            }
        )

    return options


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
            opts["format"] = audio_format_selector(job.get("audioBitrate"))
            codec, quality, _ = decide_audio(
                job.get("audioBitrate"), job.get("sourceAbr"), job.get("sourceAcodec")
            )
            opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": codec,
                    "preferredquality": quality,
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
                "audioOptions": audio_options(first),
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
            "audioOptions": audio_options(info),
            "isPlaylist": False,
            "playlistCount": None,
        }

    # -- download ----------------------------------------------------------

    def _ensure_source_audio(self, job: dict, url: str) -> None:
        """Fill in the source's audio rate/codec when the caller didn't.

        The URL bar previews single links and hands the values over, so this only
        fires for batch pastes and retries. Without them the clamp has nothing to
        clamp against and we'd be back to blindly upscaling.
        """
        if job.get("mode") != "audio":
            return
        if job.get("sourceAbr") and job.get("sourceAcodec"):
            return

        opts: dict = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": not job.get("playlist", False),
            "nocheckcertificate": True,
            "skip_download": True,
            "logger": _NullLogger(),
        }
        if job.get("cookiefile"):
            opts["cookiefile"] = job["cookiefile"]

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception:
            # Metadata is an optimisation, not a precondition — `decide_audio`
            # falls back to the unclamped behaviour when it learns nothing.
            return

        if info and info.get("_type") == "playlist":
            entries = [e for e in (info.get("entries") or []) if e]
            info = entries[0] if entries else None
        if not info:
            return

        abr, acodec, _ = pick_source_audio(info, cap=job.get("audioBitrate"))
        job["sourceAbr"] = abr
        job["sourceAcodec"] = acodec or None

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
        self._ensure_source_audio(job, url)
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

        # What the user actually got, not what they asked for — the two differ
        # whenever the source couldn't back the requested bitrate.
        audio_summary = None
        if job["mode"] == "audio":
            audio_summary = decide_audio(
                job.get("audioBitrate"), job.get("sourceAbr"), job.get("sourceAcodec")
            )[2]

        return {
            "filepath": filepath,
            "filesize": filesize,
            "title": info.get("title"),
            "audioSummary": audio_summary,
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


def _distinct_audio_bitrates(info: dict) -> list:
    """The rates of the source's audio-only streams, descending.

    Muxed formats are left out on purpose: their rate can't be selected on its
    own, so offering it would promise a choice that doesn't exist.
    """
    rates = set()
    for fmt in info.get("formats") or []:
        if not _is_audio_only(fmt):
            continue
        abr = _format_abr(fmt, True)
        if abr:
            # Round *up*, or a rate of 129.5 would yield a ceiling of 129 that
            # excludes the very stream it came from.
            rates.add(math.ceil(abr))
    return sorted(rates, reverse=True)


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
