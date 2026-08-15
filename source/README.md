# Universal-Downloader (MultiDownloader) – v1.5

Universal-Downloader is a small Python-based Windows CLI tool that downloads videos/audio via `yt-dlp` and can also download images from a direct image URL.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X8X7MF230)

## Supported sites (via `yt-dlp`)
- YouTube (including Shorts)
- TikTok
- Instagram Reels *(often only reliable with login/cookies)*

Note: Platforms change frequently. If something stops working, update `yt-dlp` first.

## Features
- Batch download: paste multiple URLs (one per line)
- Video → **MP4** (best quality; merges video+audio when FFmpeg is available)
- Audio → **MP3** (requires **FFmpeg**)
- Optional: **FFmpeg installer** (`--install-ffmpeg` or menu `[9]`, works even without `winget`)
- Optional: **cookies.txt** support for login-only/age-gated content
- Image downloader: saves a direct image URL to `output.png`

## Quick start (Windows)
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe converter.py
```

## FFmpeg
FFmpeg is required for:
- MP3 conversion
- Merging best-quality video+audio into a single MP4

Install via:
```powershell
.\.venv\Scripts\python.exe converter.py --install-ffmpeg
```
If `winget` is missing/doesn’t work, a portable FFmpeg build is downloaded to `tools/ffmpeg/bin`.

## Batch mode usage (recommended)
- Pick a menu entry (YouTube/TikTok/Instagram Reels → MP4 or MP3)
- Choose the output folder once (it’s remembered)
- Paste URLs **one per line**
- Empty line starts the batch
- Type `b` to go back to the menu

## cookies.txt (Instagram/TikTok)
Instagram Reels (and sometimes TikTok) often require cookies to work reliably.
Export your browser cookies as **Netscape cookies.txt** and enter the path when the tool asks for it.

### How to use `cookies.txt` (step-by-step)
1. Log in to the website in your browser (Instagram/TikTok) and make sure you can view the content normally.
2. Export cookies to a **Netscape-format** `cookies.txt` file (common browser extension names: “cookies.txt”, “Get cookies.txt”).
3. Save the file somewhere safe, e.g. `C:\Users\<you>\Downloads\cookies.txt`.
4. In this tool, pick an **Instagram Reels** menu entry (MP4 or MP3 batch).
5. When prompted for `cookies.txt`, paste the full path to your file and press Enter.
6. Paste your URLs (one per line) and start the batch.

Notes:
- Keep `cookies.txt` private: it can contain session tokens (treat it like a password).
- Cookies can expire; if downloads start failing again, export a fresh `cookies.txt`.

## Build (Windows EXE)
Use `WindowsAutoCompiler.bat` (PyInstaller) or run:
```powershell
pyinstaller converter.py --onefile --clean
```

## Update 1.5 (Changelog)
- New batch UX (download multiple URLs in a row, remembers output folders)
- Menu split by platform: **YouTube / TikTok / Instagram Reels** (MP4 & MP3)
- FFmpeg installer now works without `winget` (portable install to `tools/ffmpeg/bin`)
- Best-quality MP4 selection (MP4 video + M4A audio, merge to MP4 when FFmpeg is available)
- YouTube Shorts URL normalization
- Optional cookies.txt support (especially for Reels/logins)
- Cleaner UI (fewer popups, more batch summary in console)

## Disclaimer
This tool is for private use only. Don’t use it to violate copyright laws or local regulations.
