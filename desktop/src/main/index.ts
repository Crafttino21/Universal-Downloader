import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { PythonBridge } from './python-bridge'
import { registerIpc } from './ipc'
import { Updater } from './updater'
import { ffmpegBinDir, getSettings } from './store'

let mainWindow: BrowserWindow | null = null
let bridge: PythonBridge | null = null
let updater: Updater | null = null

// Matches --bg in the renderer tokens. Painting the window in the right colour
// up front avoids a white flash before the first frame in dark mode.
const BACKDROP = { light: '#F6F7F9', dark: '#0B0F16' }

function backgroundColor(): string {
  const { theme } = getSettings()
  const dark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors)
  return dark ? BACKDROP.dark : BACKDROP.light
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 760,
    minWidth: 560,
    minHeight: 620,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: backgroundColor(),
    autoHideMenuBar: true,
    webPreferences: {
      // The package is ESM ("type": "module"), so electron-vite emits the
      // preload as .mjs. Electron loads an ESM preload only with sandbox off.
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Keep the custom title bar's maximise glyph in sync with reality.
  const emitMaximized = (value: boolean): void => {
    mainWindow?.webContents.send('window:maximized', value)
  }
  mainWindow.on('maximize', () => emitMaximized(true))
  mainWindow.on('unmaximize', () => emitMaximized(false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.weepingangel.universaldownloader')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  nativeTheme.themeSource = getSettings().theme

  bridge = new PythonBridge(ffmpegBinDir())

  // Forward every daemon event straight to the renderer, which owns queue state.
  bridge.on('event', (event: string, payload: Record<string, unknown>) => {
    mainWindow?.webContents.send(`daemon:${event}`, payload)
  })
  bridge.on('crash', () => {
    mainWindow?.webContents.send('daemon:crash')
  })

  try {
    bridge.start()
  } catch (err) {
    // Surface it in the UI rather than dying silently; the renderer shows a
    // blocking error state when the backend never answers.
    mainWindow?.webContents.send('daemon:crash')
    console.error(err)
  }

  updater = new Updater(() => mainWindow)

  registerIpc(bridge, updater, () => mainWindow)
  createWindow()
  updater.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let stopping = false
app.on('before-quit', (event) => {
  updater?.stop()
  if (stopping || !bridge) return
  // Give the daemon a moment to shut down cleanly before the app exits.
  event.preventDefault()
  stopping = true
  void bridge.stop().finally(() => app.quit())
})
