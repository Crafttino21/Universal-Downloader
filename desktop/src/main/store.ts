import { app } from 'electron'
import { join } from 'path'
import ElectronStore from 'electron-store'
import type { HistoryEntry, Settings } from '../shared/types'

const MAX_HISTORY = 200

interface Schema {
  settings: Settings
  history: HistoryEntry[]
}

function defaultSettings(): Settings {
  const videos = app.getPath('videos')
  const music = app.getPath('music')
  const pictures = app.getPath('pictures')

  return {
    theme: 'system',
    language: 'de',
    videoDir: join(videos, 'Universal Downloader'),
    audioDir: join(music, 'Universal Downloader'),
    imageDir: join(pictures, 'Universal Downloader'),
    videoQuality: 'best',
    // Takes whatever the source really has instead of inventing bits ffmpeg
    // would have to fabricate — see `engine.decide_audio`.
    audioBitrate: 'auto',
    cookiefile: null,
    concurrency: 3
  }
}

const store = new ElectronStore<Schema>({
  name: 'universal-downloader',
  defaults: { settings: defaultSettings(), history: [] }
}) as ElectronStore<Schema> & {
  get<K extends keyof Schema>(key: K): Schema[K]
  set<K extends keyof Schema>(key: K, value: Schema[K]): void
}

export function getSettings(): Settings {
  // Merge over defaults so keys added in a later version are always present.
  return { ...defaultSettings(), ...store.get('settings') }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  store.set('settings', next)
  return next
}

export function getHistory(): HistoryEntry[] {
  return store.get('history') ?? []
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...getHistory()].slice(0, MAX_HISTORY)
  store.set('history', next)
  return next
}

export function removeHistory(id: string): HistoryEntry[] {
  const next = getHistory().filter((e) => e.id !== id)
  store.set('history', next)
  return next
}

export function clearHistory(): HistoryEntry[] {
  store.set('history', [])
  return []
}

/** Where the app installs and looks for its own FFmpeg copy. */
export function ffmpegBinDir(): string {
  return join(app.getPath('userData'), 'tools', 'ffmpeg', 'bin')
}
