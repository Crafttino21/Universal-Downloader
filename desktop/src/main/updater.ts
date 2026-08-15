/**
 * Auto-update against GitHub Releases.
 *
 * The renderer never sees electron-updater's six separate events — they are
 * folded into one `UpdateState` object here and pushed as a whole, so the UI
 * can render from a single value instead of reconstructing a state machine.
 *
 * Updates arrive only once a release draft is published; drafts are invisible
 * to `/releases/latest`, which is exactly the review gate we want.
 */

import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateState } from '../shared/types'

const { autoUpdater } = electronUpdater

/** Delay before the first check — the first seconds belong to the window and the daemon spawn. */
const FIRST_CHECK_MS = 8_000
const RECHECK_MS = 6 * 60 * 60 * 1000

export const RELEASES_URL = 'https://github.com/Crafttino21/Universal-Downloader/releases'

/**
 * A portable build is a single executable that has no installer to hand over
 * to, so electron-updater cannot replace it. Detected via the variable the
 * portable launcher sets for the app.
 */
function isPortable(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
}

export class Updater {
  private state: UpdateState = { phase: 'idle' }
  private timer: NodeJS.Timeout | null = null
  private readonly enabled: boolean

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    this.enabled = app.isPackaged && !isPortable()

    if (isPortable()) {
      this.state = { phase: 'unsupported', version: null }
    }
    if (!this.enabled) {
      console.log(
        `[updater] disabled (${!app.isPackaged ? 'not packaged' : 'portable build'}) — no network calls`
      )
      return
    }

    autoUpdater.autoDownload = true
    // The user picks the moment to restart; installing behind their back could
    // interrupt a running download.
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () => this.set({ phase: 'checking' }))
    autoUpdater.on('update-not-available', () => this.set({ phase: 'up-to-date' }))

    autoUpdater.on('update-available', (info) =>
      this.set({
        phase: 'downloading',
        version: info.version,
        percent: 0,
        transferred: 0,
        total: null
      })
    )

    autoUpdater.on('download-progress', (p) =>
      this.set({
        phase: 'downloading',
        version: this.currentVersion() ?? '',
        percent: p.percent,
        transferred: p.transferred,
        total: p.total
      })
    )

    autoUpdater.on('update-downloaded', (info) =>
      this.set({
        phase: 'ready',
        version: info.version,
        notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null
      })
    )

    // A failed check is never fatal — no release yet, no network, a proxy in the
    // way. The app stays quiet and tries again on the next interval.
    autoUpdater.on('error', (err) => {
      console.error('[updater]', err)
      this.set({ phase: 'error', message: err?.message ?? String(err) })
    })
  }

  start(): void {
    if (!this.enabled) return
    this.timer = setTimeout(() => {
      void this.check()
      this.timer = setInterval(() => void this.check(), RECHECK_MS)
    }, FIRST_CHECK_MS)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getState(): UpdateState {
    return this.state
  }

  async check(): Promise<UpdateState> {
    if (!this.enabled) return this.state
    // Nothing to gain from re-checking mid-download or once a build is staged.
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') return this.state
    try {
      const result = await autoUpdater.checkForUpdates()
      // With autoDownload on, the check hands back a download promise nobody
      // awaits. If the download fails, that rejection is unhandled — which
      // newer Node builds escalate to a process crash. The 'error' event above
      // is what actually reports the failure, so swallowing it here is safe.
      result?.downloadPromise?.catch(() => {})
    } catch (err) {
      this.set({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
    }
    return this.state
  }

  /** Quits and hands over to the NSIS installer. Only valid in the `ready` phase. */
  install(): boolean {
    if (this.state.phase !== 'ready') return false
    setImmediate(() => autoUpdater.quitAndInstall())
    return true
  }

  private currentVersion(): string | null {
    return this.state.phase === 'downloading' || this.state.phase === 'ready'
      ? this.state.version
      : null
  }

  private set(next: UpdateState): void {
    this.state = next
    this.getWindow()?.webContents.send('update:changed', next)
  }
}
