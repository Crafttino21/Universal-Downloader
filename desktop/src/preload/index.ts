import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AppVersionInfo,
  DoneEvent,
  FailedEvent,
  FfmpegInstallEvent,
  FfmpegStatus,
  HistoryEntry,
  ImageDownloadResult,
  JobSpec,
  ProbeResult,
  ProgressEvent,
  Settings,
  StatusEvent,
  UpdateState
} from '../shared/types'

/** Subscribe helper that hands back an unsubscribe function for React effects. */
function on<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_e: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api = {
  // jobs
  startJob: (job: JobSpec): Promise<{ jobId: string; accepted: boolean }> =>
    ipcRenderer.invoke('job:start', job),
  cancelJob: (jobId: string): Promise<unknown> => ipcRenderer.invoke('job:cancel', jobId),
  probe: (url: string): Promise<ProbeResult> => ipcRenderer.invoke('probe', url),
  downloadImage: (url: string, outputDir: string): Promise<ImageDownloadResult> =>
    ipcRenderer.invoke('image:download', url, outputDir),

  // ffmpeg
  ffmpegStatus: (): Promise<FfmpegStatus> => ipcRenderer.invoke('ffmpeg:status'),
  installFfmpeg: (): Promise<FfmpegStatus> => ipcRenderer.invoke('ffmpeg:install'),

  // updates
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('update:state'),
  checkForUpdate: (): Promise<UpdateState> => ipcRenderer.invoke('update:check'),
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke('update:install'),
  getAppVersion: (): Promise<AppVersionInfo> => ipcRenderer.invoke('app:version'),

  // settings & history
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),
  listHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:list'),
  addHistory: (entry: HistoryEntry): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:add', entry),
  removeHistory: (id: string): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:remove', id),
  clearHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:clear'),

  // dialogs & shell
  pickFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickFolder', defaultPath),
  pickCookieFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickCookieFile'),
  revealFile: (filepath: string): Promise<boolean> => ipcRenderer.invoke('shell:revealFile', filepath),
  openFile: (filepath: string): Promise<boolean> => ipcRenderer.invoke('shell:openFile', filepath),
  openFolder: (dir: string): Promise<boolean> => ipcRenderer.invoke('shell:openFolder', dir),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:openExternal', url),
  fileExists: (filepath: string): Promise<boolean> => ipcRenderer.invoke('file:exists', filepath),

  // window controls
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggleMaximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),

  // events
  onProgress: (cb: (p: ProgressEvent) => void) => on('daemon:progress', cb),
  onStatus: (cb: (p: StatusEvent) => void) => on('daemon:status', cb),
  onDone: (cb: (p: DoneEvent) => void) => on('daemon:done', cb),
  onFailed: (cb: (p: FailedEvent) => void) => on('daemon:failed', cb),
  onFfmpegInstall: (cb: (p: FfmpegInstallEvent) => void) => on('daemon:ffmpeg_install', cb),
  onCrash: (cb: () => void) => on('daemon:crash', cb),
  onUpdateChanged: (cb: (s: UpdateState) => void) => on('update:changed', cb),
  onMaximized: (cb: (value: boolean) => void) => on('window:maximized', cb)
}

export type Api = typeof api

// The window is always created with contextIsolation: true (see main/index.ts),
// so the bridge is the only path into the renderer.
contextBridge.exposeInMainWorld('api', api)
