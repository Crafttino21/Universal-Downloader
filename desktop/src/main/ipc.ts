import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { existsSync } from 'fs'
import type { PythonBridge } from './python-bridge'
import { RELEASES_URL, type Updater } from './updater'
import {
  addHistory,
  clearHistory,
  getHistory,
  getSettings,
  removeHistory,
  setSettings
} from './store'
import type { AppVersionInfo, HistoryEntry, JobSpec, Settings } from '../shared/types'

export function registerIpc(
  bridge: PythonBridge,
  updater: Updater,
  getWindow: () => BrowserWindow | null
): void {
  /* ---------------- backend ---------------- */

  ipcMain.handle('job:start', (_e, job: JobSpec) => bridge.request('start', { job }))
  ipcMain.handle('job:cancel', (_e, jobId: string) => bridge.request('cancel', { jobId }))

  ipcMain.handle('probe', (_e, url: string) => {
    const { cookiefile } = getSettings()
    return bridge.request('probe', { url, cookiefile })
  })

  ipcMain.handle('image:download', (_e, url: string, outputDir: string) =>
    bridge.request('download_image', { url, outputDir })
  )

  ipcMain.handle('ffmpeg:status', () => bridge.request('ffmpeg_status'))
  ipcMain.handle('ffmpeg:install', () => bridge.request('install_ffmpeg'))

  /* ---------------- updates ---------------- */

  ipcMain.handle('update:state', () => updater.getState())
  ipcMain.handle('update:check', () => updater.check())
  ipcMain.handle('update:install', () => updater.install())

  ipcMain.handle(
    'app:version',
    (): AppVersionInfo => ({
      version: app.getVersion(),
      updatable: updater.getState().phase !== 'unsupported' && app.isPackaged,
      releasesUrl: RELEASES_URL
    })
  )

  /* ---------------- settings & history ---------------- */

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const next = setSettings(patch)
    if (patch.theme) nativeTheme.themeSource = patch.theme
    if (patch.concurrency) {
      void bridge.request('set_concurrency', { value: patch.concurrency }).catch(() => {})
    }
    return next
  })

  ipcMain.handle('history:list', () => getHistory())
  ipcMain.handle('history:add', (_e, entry: HistoryEntry) => addHistory(entry))
  ipcMain.handle('history:remove', (_e, id: string) => removeHistory(id))
  ipcMain.handle('history:clear', () => clearHistory())

  /* ---------------- dialogs & shell ---------------- */

  ipcMain.handle('dialog:pickFolder', async (_e, defaultPath?: string) => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      ...(defaultPath && existsSync(defaultPath) ? { defaultPath } : {})
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pickCookieFile', async () => {
    const win = getWindow()
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [
        { name: 'Cookies', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('shell:revealFile', (_e, filepath: string) => {
    if (!existsSync(filepath)) return false
    shell.showItemInFolder(filepath)
    return true
  })

  ipcMain.handle('shell:openFile', async (_e, filepath: string) => {
    if (!existsSync(filepath)) return false
    const err = await shell.openPath(filepath)
    return err === ''
  })

  ipcMain.handle('shell:openFolder', async (_e, dir: string) => {
    if (!existsSync(dir)) return false
    const err = await shell.openPath(dir)
    return err === ''
  })

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (!/^https?:\/\//i.test(url)) return false
    void shell.openExternal(url)
    return true
  })

  ipcMain.handle('file:exists', (_e, filepath: string) => existsSync(filepath))

  /* ---------------- window controls ---------------- */

  ipcMain.handle('window:minimize', () => getWindow()?.minimize())
  ipcMain.handle('window:toggleMaximize', () => {
    const win = getWindow()
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  ipcMain.handle('window:close', () => getWindow()?.close())
  ipcMain.handle('window:isMaximized', () => getWindow()?.isMaximized() ?? false)
}
