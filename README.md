# Universal-Downloader (MultiDownloader)

Universal-Downloader downloads videos, audio and images from YouTube, TikTok,
Instagram, X, Reddit, Twitch, SoundCloud, Dailymotion — and the ~1800 other
sites `yt-dlp` supports. It comes in two flavours:

| | | |
|---|---|---|
| **[Desktop app](desktop/)** | v2.0 | Electron UI with a live download queue, quality selection, history and a light/dark theme. Same Python engine underneath. |
| **[CLI](source/)** | v1.5 | The original Python console tool. Still fully supported. |

Both share the same downloader logic — the desktop app runs it as a background
daemon instead of a menu loop.

**[→ Download the latest release](https://github.com/Crafttino21/Universal-Downloader/releases)**
— a setup and a portable exe for the desktop app, a single exe for the CLI.
Nothing else to install; the desktop app fetches FFmpeg itself on first use and
keeps itself up to date from there.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X8X7MF230)

---

## Desktop app (v2.0)

```powershell
cd desktop
npm install
python -m venv python\.venv
.\python\.venv\Scripts\python.exe -m pip install -r python\requirements.txt
npm run dev
```

Build a release with `npm run dist` (or double-click
`desktop\build-windows.bat`). It produces two self-contained files in
`desktop\dist\` — a **setup.exe** installer and a **portable.exe** that runs
without installing. Both bundle the Python backend, so end users need neither
Python nor a manual FFmpeg install. See [desktop/README.md](desktop/README.md).

Extras over the CLI: parallel downloads with live speed/ETA, cancel, automatic
platform detection with a title/thumbnail preview, per-type output folders,
download history, silent auto-update, and DE/EN + light/dark switching — all
persisted.

---

## Supported sites (via `yt-dlp`)

Recognised by name — the desktop app shows a coloured badge for each:

| Platform | Notes |
|---|---|
| YouTube | Including Shorts, `youtu.be` and bare video IDs |
| TikTok | |
| Instagram | Reels and posts — *usually needs a cookies.txt* |
| X (Twitter) | *Usually needs a cookies.txt; X gates most video behind login* |
| Reddit | `v.redd.it` ships video and audio separately — FFmpeg merges them |
| Twitch | Clips and VODs (a full VOD can be several GB) |
| SoundCloud | Audio only — the app switches to MP3 mode by itself |
| Dailymotion | Including `dai.ly` short links |

**Anything else `yt-dlp` supports also works** — Vimeo, Facebook, Bluesky,
Twitter Spaces and roughly 1800 more. Those just show a neutral "Link" badge
instead of a branded one. In the CLI, use menu entry `[8]`.

Note: Platforms change frequently. If something stops working, update `yt-dlp` first.

---

## CLI (v1.5)

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
- Pick a menu entry (YouTube/TikTok/Instagram Reels → MP4 or MP3, or `[8]` for
  any other supported site)
- Choose the output folder once (it’s remembered)
- Paste URLs **one per line**
- Empty line starts the batch
- Type `b` to go back to the menu

## cookies.txt (Instagram/X/TikTok)
Instagram Reels and X (and sometimes TikTok) often require cookies to work reliably.
Export your browser cookies as **Netscape cookies.txt** and enter the path when the tool asks for it.

### How to use `cookies.txt` (step-by-step)
1. Log in to the website in your browser (Instagram/X/TikTok) and make sure you can view the content normally.
2. Export cookies to a **Netscape-format** `cookies.txt` file (common browser extension names: “cookies.txt”, “Get cookies.txt”).
3. Save the file somewhere safe, e.g. `C:\Users\<you>\Downloads\cookies.txt`.
4. In this tool, pick an **Instagram Reels** menu entry (MP4 or MP3 batch), or `[8]` for X and other sites.
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
