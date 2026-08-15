@echo off
title Universal Downloader - Windows Build
echo _- Universal Downloader Desktop Build -_
echo Autor: WeepingAngel
echo.
echo This builds the Python backend, the Electron app, and the Windows installer.
pause

echo.
echo [1/4] Node dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo [2/4] Python backend...
if not exist "python\.venv" (
  python -m venv python\.venv
  if errorlevel 1 goto :failed
)
call python\.venv\Scripts\python.exe -m pip install --upgrade pip
call python\.venv\Scripts\python.exe -m pip install -r python\requirements.txt pyinstaller
if errorlevel 1 goto :failed

echo.
echo [3/4] Bundling the daemon (PyInstaller)...
call python\.venv\Scripts\python.exe -m PyInstaller --clean --noconfirm --distpath resources\python --workpath python\build python\daemon.spec
if errorlevel 1 goto :failed
if not exist "resources\python\ud-daemon.exe" (
  echo ERROR: ud-daemon.exe was not produced.
  goto :failed
)

echo.
echo [4/4] Electron app + installer...
call npm run build:win
if errorlevel 1 goto :failed

echo.
echo ***************************
echo Build finished. Output is in dist\
echo ***************************
pause
exit /b 0

:failed
echo.
echo ###########################
echo Build FAILED. Scroll up for the first error.
echo ###########################
pause
exit /b 1
