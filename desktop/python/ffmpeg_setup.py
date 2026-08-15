"""FFmpeg detection and installation.

Ported from ``source/converter.py`` (class ``syscalls``). The only behavioural
change: the install target folder is injected instead of being derived from
``__file__``. In a packaged build the daemon lives under Program Files, which is
not writable without elevation, so Electron points this at its userData folder.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import zipfile
from typing import Callable, Optional

import requests

# Same "essentials" build the CLI has always used (converter.py:191).
FFMPEG_ZIP_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"

# Upper bound on the winget attempt before falling back to the portable build.
WINGET_TIMEOUT_SECONDS = 120

ProgressFn = Callable[[str, str, Optional[float]], None]


def _noop(stage: str, message: str, percent: Optional[float] = None) -> None:
    pass


class FfmpegManager:
    """Owns the managed FFmpeg install directory and the PATH it injects."""

    def __init__(self, bin_dir: str) -> None:
        # bin_dir is e.g. <userData>/tools/ffmpeg/bin
        self.bin_dir = os.path.abspath(bin_dir)
        self.tool_root = os.path.dirname(self.bin_dir)

    # -- detection ---------------------------------------------------------

    def _prepend_to_path(self, dir_path: str) -> None:
        """converter.py:145-149"""
        current = os.environ.get("PATH", "")
        parts = [p.strip() for p in current.split(os.pathsep) if p.strip()]
        if dir_path not in parts:
            os.environ["PATH"] = dir_path + os.pathsep + current

    def status(self) -> dict:
        """converter.py:152-162, but reports *where* ffmpeg was found.

        The app's own copy is checked first. Checking PATH first would report it
        as a system install from the second call onwards, because the first call
        puts the managed directory on PATH itself.
        """
        local_ffmpeg = os.path.join(self.bin_dir, "ffmpeg.exe")
        if os.path.isfile(local_ffmpeg):
            # Make the managed copy visible to yt-dlp for the rest of this process.
            self._prepend_to_path(self.bin_dir)
            return {"installed": True, "path": local_ffmpeg, "source": "managed"}

        on_path = shutil.which("ffmpeg")
        if on_path is not None:
            return {"installed": True, "path": on_path, "source": "path"}

        return {"installed": False, "path": None, "source": None}

    def is_installed(self) -> bool:
        return self.status()["installed"]

    def ffmpeg_location(self) -> Optional[str]:
        """Directory to hand to yt-dlp as ``ffmpeg_location``, if we manage it."""
        if os.path.isfile(os.path.join(self.bin_dir, "ffmpeg.exe")):
            return self.bin_dir
        return None

    # -- installation ------------------------------------------------------

    def _install_via_winget(self, progress: ProgressFn) -> bool:
        """converter.py:166-181"""
        if shutil.which("winget") is None:
            return False

        progress("winget", "Installing FFmpeg via winget…", None)
        subprocess.run(
            [
                "winget",
                "install",
                "ffmpeg",
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--disable-interactivity",
            ],
            check=True,
            # winget can sit for many minutes on a slow source refresh, or block
            # on a prompt this process can never answer. Cap it and fall back to
            # the portable download rather than leaving the UI stuck.
            timeout=WINGET_TIMEOUT_SECONDS,
            # Keep the console window hidden in the packaged (windowed) build.
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return self.is_installed()

    def _install_portable(self, progress: ProgressFn) -> bool:
        """converter.py:184-237, with download progress reporting."""
        os.makedirs(self.tool_root, exist_ok=True)
        os.makedirs(self.bin_dir, exist_ok=True)

        zip_path = os.path.join(self.tool_root, "ffmpeg-release-essentials.zip")
        extract_root = os.path.join(self.tool_root, "_extract")

        if os.path.isdir(extract_root):
            shutil.rmtree(extract_root, ignore_errors=True)
        os.makedirs(extract_root, exist_ok=True)

        progress("download", "Downloading FFmpeg…", 0.0)
        with requests.get(FFMPEG_ZIP_URL, stream=True, timeout=60) as r:
            r.raise_for_status()
            total = int(r.headers.get("Content-Length") or 0)
            written = 0
            with open(zip_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    f.write(chunk)
                    written += len(chunk)
                    if total:
                        progress("download", "Downloading FFmpeg…", written * 100.0 / total)

        progress("extract", "Extracting FFmpeg…", None)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_root)

        ffmpeg_exe = ffprobe_exe = ffplay_exe = None
        for root, _, files in os.walk(extract_root):
            lower = {f.lower(): f for f in files}
            if "ffmpeg.exe" in lower:
                ffmpeg_exe = os.path.join(root, lower["ffmpeg.exe"])
            if "ffprobe.exe" in lower:
                ffprobe_exe = os.path.join(root, lower["ffprobe.exe"])
            if "ffplay.exe" in lower:
                ffplay_exe = os.path.join(root, lower["ffplay.exe"])

        if not ffmpeg_exe:
            raise RuntimeError("Download and extraction succeeded, but ffmpeg.exe was not found.")

        shutil.copy2(ffmpeg_exe, os.path.join(self.bin_dir, "ffmpeg.exe"))
        if ffprobe_exe:
            shutil.copy2(ffprobe_exe, os.path.join(self.bin_dir, "ffprobe.exe"))
        if ffplay_exe:
            shutil.copy2(ffplay_exe, os.path.join(self.bin_dir, "ffplay.exe"))

        try:
            os.remove(zip_path)
        except OSError:
            pass
        shutil.rmtree(extract_root, ignore_errors=True)

        self._prepend_to_path(self.bin_dir)
        return self.is_installed()

    def install(self, progress: ProgressFn = _noop) -> dict:
        """winget first, portable download as fallback — as converter.py:240-263."""
        progress("checking", "Checking for an existing FFmpeg…", None)
        if self.is_installed():
            progress("done", "FFmpeg is already installed.", None)
            return self.status()

        try:
            if self._install_via_winget(progress):
                progress("done", "FFmpeg installed via winget.", None)
                return self.status()
        except subprocess.TimeoutExpired:
            progress("winget", "winget took too long. Falling back to a portable build…", None)
        except Exception as exc:  # winget can exist but be blocked/misconfigured
            progress("winget", f"winget failed ({exc}). Falling back to a portable build…", None)

        if self._install_portable(progress):
            progress("done", f"FFmpeg installed to {self.bin_dir}", None)
            return self.status()

        raise RuntimeError("Installation finished, but FFmpeg still cannot be found.")
