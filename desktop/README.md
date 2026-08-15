# Universal Downloader — Desktop

An Electron port of the `source/converter.py` CLI, with the same download engine
and a proper UI: a live queue, quality selection, automatic platform detection,
persistent history, and a light/dark theme.

The Python engine still does the downloading. Electron is the front end.

## Architecture

```
┌────────────────────┐   NDJSON over stdio    ┌──────────────────────┐
│  Electron (React)  │ ◄────────────────────► │  Python daemon       │
│  renderer + main   │   requests / events    │  yt-dlp + FFmpeg     │
└────────────────────┘                        └──────────────────────┘
```

- `python/` — the backend. `engine.py` is ported from `source/converter.py`
  (URL normalisation, format selectors, FFmpeg installer, image downloader);
  `daemon.py` wraps it in a line-delimited JSON protocol over stdin/stdout.
- `src/main/` — window, IPC, settings/history store, and `python-bridge.ts`,
  which owns the daemon child process and correlates requests to responses.
- `src/renderer/` — the UI.
- `src/shared/types.ts` — the contract all three sides agree on.

## Requirements

- Node.js 20+
- Python 3.10+ (development only — a packaged build ships its own backend)
- FFmpeg — the app installs it for you from the banner if it's missing

## Development

```powershell
npm install

# one-time backend setup
python -m venv python\.venv
.\python\.venv\Scripts\python.exe -m pip install -r python\requirements.txt

npm run dev
```

## Build a Windows release

```powershell
npm run dist
```

That runs, in order:

1. `build:python` — PyInstaller bundles the daemon into
   `resources/python/ud-daemon.exe`, so end users need no Python.
2. `build` — typecheck + `electron-vite build`.
3. `build:win` — `electron-builder` emits both artifacts into `dist/`:

| File | What it is |
|---|---|
| `universal-downloader-desktop-<version>-setup.exe` | NSIS installer — installs to a folder of the user's choice, creates a desktop shortcut, registers an uninstaller. |
| `universal-downloader-desktop-<version>-portable.exe` | Single self-contained executable. No installation, runs straight from a USB stick. |

Each is ~126 MB because it carries Electron, the app, and the Python backend.
Neither needs Python or FFmpeg on the target machine — FFmpeg is fetched on
first use from the in-app banner.

`build-windows.bat` does the same from a double-click.

### If `electron-builder` fails to extract `winCodeSign`

On a fresh Windows machine the build can stop with:

```
ERROR: Cannot create symbolic link : ... winCodeSign\...\darwin\10.12\lib\libcrypto.dylib
```

electron-builder's signing bundle contains macOS symlinks, and creating symlinks
on Windows needs a privilege normal accounts don't have. Pick one:

- Turn on **Settings → System → For developers → Developer Mode**, or
- run the build from an **elevated** PowerShell, or
- pre-extract the bundle yourself, skipping the macOS part:

  ```powershell
  $cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
  .\node_modules\7zip-bin\win\x64\7za.exe x "$cache\<downloaded>.7z" `
    -o"$cache\winCodeSign-2.6.0" -xr!darwin -y
  ```

The app is not code-signed, so Windows SmartScreen will warn on first run —
that's expected for an unsigned build.

## Auto-update

The installed app updates itself from GitHub Releases. `src/main/updater.ts`
owns the whole state machine and pushes a single `UpdateState` object to the
renderer, so the UI never reassembles electron-updater's separate events.

- **When it checks.** 8 seconds after the window appears, then every 6 hours.
  The first seconds belong to the window and the daemon spawn.
- **What the user sees.** A dot in the title bar — pulsing while the build
  downloads, solid once it is staged. Clicking it opens a card under the title
  bar with the version and a **Restart** button.
- **Restarting is gated.** `quitAndInstall()` exits immediately, which would
  abandon a running download. The button stays disabled while anything is in the
  queue.
- **A failed check is silent.** No release yet, no network, a proxy in the way —
  all of it leaves the app quiet and retries on the next interval.
- **The portable build cannot update itself.** A single executable has no
  installer to hand over to, so the updater is switched off entirely and the UI
  offers the releases page instead. Detected via `PORTABLE_EXECUTABLE_DIR`.
- **In development it never runs.** `app.isPackaged` is false, so no network
  call is made at all.

Unsigned builds update fine: integrity comes from the SHA512 in `latest.yml`,
not from a signature.

Releasing is documented in [RELEASING.md](../RELEASING.md). The short version:
push a `desktop-v*` tag, review the draft, publish it.

## Protocol

One JSON object per line. `stdout` carries only protocol; `stderr` is logging.

| Request | Purpose |
|---|---|
| `ping` | liveness |
| `ffmpeg_status` | is FFmpeg available, and where |
| `install_ffmpeg` | winget, falling back to a portable download |
| `probe` | title, thumbnail, duration, available heights |
| `start` | begin a download job |
| `cancel` | stop a job and delete its partial files |
| `download_image` | save a direct image URL |
| `set_concurrency` | resize the worker pool |
| `shutdown` | exit cleanly |

Events pushed to the UI: `progress`, `status`, `done`, `failed`,
`ffmpeg_install`.

## Notes

- **Cancelling during conversion.** Once FFmpeg has started converting, the job
  runs to completion and the result is discarded. The UI disables the cancel
  button in that window and says why.
- **Progress across two streams.** A best-quality MP4 downloads video and audio
  separately. Progress is summed over bytes and clamped so the bar never moves
  backwards when the second stream starts.
- **Transient YouTube errors.** A job re-extracts and retries up to three times
  on 403/429/timeout, which is the most common failure against YouTube.
- **cookies.txt.** Instagram (and sometimes TikTok) needs one. Set it in
  Settings; it applies to probes and downloads alike.
