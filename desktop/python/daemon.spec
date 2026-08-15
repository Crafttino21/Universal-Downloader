# -*- mode: python ; coding: utf-8 -*-
# Builds the backend sidecar shipped with the Electron app.
# Run from desktop/:  npm run build:python

# Script paths in a .spec resolve relative to the spec's own directory, so these
# are bare names even though the build is launched from desktop/.
a = Analysis(
    ['daemon.py'],
    pathex=[SPECPATH],
    binaries=[],
    datas=[],
    # yt-dlp resolves its extractors lazily, so PyInstaller's static analysis
    # misses them. Without this the packaged daemon can only handle a fraction
    # of the sites the dev build supports.
    hiddenimports=['yt_dlp.extractor.lazy_extractors'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'PIL'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ud-daemon',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    # Windowed: the daemon is a child process, it must never flash a console.
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
