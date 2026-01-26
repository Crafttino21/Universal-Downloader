# Universal-Downloader (MultiDownloader)

Ein kleines Windows-Tool zum Downloaden von Videos/Audio über `yt-dlp`.

## Unterstützte Plattformen (über `yt-dlp`)
- YouTube (inkl. Shorts)
- TikTok
- Instagram Reels *(häufig nur mit Login/Cookies zuverlässig)*

Hinweis: Plattformen ändern sich regelmäßig. Wenn etwas nicht mehr geht, zuerst `yt-dlp` updaten.

## Features
- Video → **MP4** (Batch: mehrere Links nacheinander)
- Audio → **MP3** (Batch, benötigt **FFmpeg**)
- Optional: **FFmpeg installieren** über `--install-ffmpeg` oder Menüpunkt `[9]`
- Optional: **cookies.txt** verwenden (für Instagram/TikTok hilfreich)

## Setup (Entwicklung)
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Start
```powershell
.\.venv\Scripts\python.exe converter.py
```

## FFmpeg installieren
```powershell
.\.venv\Scripts\python.exe converter.py --install-ffmpeg
```
Wenn `winget` fehlt/nicht funktioniert, wird eine portable FFmpeg-Version nach `tools/ffmpeg/bin` geladen.

## Batch-Download (empfohlen)
- Menü hat jetzt getrennte Einträge für **YouTube / TikTok / Instagram Reels** (MP4 und MP3 jeweils als Batch).
- Output-Ordner einmal auswählen
- URLs **eine pro Zeile** einfügen
- Leere Zeile startet den Download
- `b` bringt dich zurück ins Menü

## cookies.txt (Instagram/TikTok)
Für private/age-gated Inhalte oder Reels braucht man oft Cookies.
Exportiere Cookies aus deinem Browser als **Netscape cookies.txt** und gib den Pfad im Batch-Dialog an.

## Build (Windows, EXE)
`WindowsAutoCompiler.bat` nutzt `pyinstaller` (`converter.spec` wird erzeugt).
