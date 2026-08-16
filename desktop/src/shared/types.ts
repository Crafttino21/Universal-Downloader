/**
 * Shared contract between the Electron main process, the preload bridge and the
 * renderer. The Python daemon speaks the same shapes over NDJSON, so keep this
 * file in sync with `python/daemon.py`.
 */

export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'reddit'
  | 'twitch'
  | 'soundcloud'
  | 'dailymotion'
  | 'other'

export type DownloadMode = 'video' | 'audio'

export type VideoQuality = 'best' | '2160' | '1440' | '1080' | '720' | '480' | '360'

/**
 * `auto` takes the source's best stream; a number is a *ceiling on the source
 * stream* in kbps, the audio counterpart of `VideoQuality`'s height cap. The
 * values come from what the source actually offers, so they aren't a fixed set.
 */
export type AudioBitrate = 'auto' | `${number}`

/** One entry of the bitrate menu, already resolved by `engine.audio_options`. */
export interface AudioOption {
  /** The ceiling to store in settings — always a rate the source carries. */
  cap: number
  /** What this choice puts on disk, kbps. */
  kbps: number
  container: 'mp3' | 'm4a'
  /** True when the stream is copied rather than re-encoded. */
  copied: boolean
  /** Raw source values, forwarded into the job so the engine can skip a probe. */
  abr: number
  acodec: string
}

export type JobStatus =
  | 'queued'
  | 'probing'
  | 'downloading'
  | 'retrying'
  | 'postprocessing'
  | 'done'
  | 'failed'
  | 'cancelled'

/** Sent to the daemon to start a download. */
export interface JobSpec {
  jobId: string
  url: string
  mode: DownloadMode
  outputDir: string
  videoQuality: VideoQuality
  audioBitrate: AudioBitrate
  cookiefile: string | null
  playlist: boolean
  /**
   * The source's real audio rate/codec, when the URL bar already probed it.
   * Lets the engine clamp without re-extracting; it fetches them itself when
   * they're missing (batch pastes, retries).
   */
  sourceAbr: number | null
  sourceAcodec: string | null
}

/** Metadata returned by the daemon's `probe` command. */
export interface ProbeResult {
  title: string
  thumbnail: string | null
  duration: number | null
  uploader: string | null
  extractor: string | null
  /** Distinct video heights actually available, descending. */
  heights: number[]
  /** The selectable audio streams, best first. Empty when the source says nothing. */
  audioOptions: AudioOption[]
  isPlaylist: boolean
  playlistCount: number | null
}

export interface ProgressEvent {
  jobId: string
  percent: number
  speed: number | null
  eta: number | null
  downloaded: number
  total: number | null
}

export interface StatusEvent {
  jobId: string
  status: JobStatus
  /** Present on `postprocessing` — e.g. "ExtractAudio". */
  detail?: string | null
}

export interface DoneEvent {
  jobId: string
  filepath: string
  filesize: number | null
  title: string | null
  /** What the audio job really produced, e.g. "MP3 · 128 kbps (Original)". */
  audioSummary?: string | null
}

export interface FailedEvent {
  jobId: string
  error: string
}

export type FfmpegInstallStage =
  | 'checking'
  | 'winget'
  | 'download'
  | 'extract'
  | 'done'
  | 'failed'

export interface FfmpegInstallEvent {
  stage: FfmpegInstallStage
  message: string
  /** 0..100 during `download`, otherwise null. */
  percent: number | null
}

export interface FfmpegStatus {
  installed: boolean
  path: string | null
  /** Where it was found: the system PATH or the app's managed tools folder. */
  source: 'path' | 'managed' | null
}

export interface ImageDownloadResult {
  filepath: string
  filesize: number
}

/* ------------------------------------------------------------------ */
/* Auto-update                                                         */
/* ------------------------------------------------------------------ */

/**
 * The whole updater condensed into one value. The main process folds
 * electron-updater's separate events into this so the renderer renders from a
 * single object rather than tracking the state machine a second time.
 *
 * `unsupported` is the portable build: a single .exe has no installer to hand
 * over to, so the UI offers the release page instead.
 */
export type UpdateState =
  | { phase: 'idle' | 'checking' | 'up-to-date' }
  | {
      phase: 'downloading'
      version: string
      percent: number
      transferred: number
      total: number | null
    }
  | { phase: 'ready'; version: string; notes: string | null }
  | { phase: 'error'; message: string }
  | { phase: 'unsupported'; version: string | null }

export interface AppVersionInfo {
  version: string
  /** False in dev and in the portable build — the UI hides the update controls then. */
  updatable: boolean
  releasesUrl: string
}

/* ------------------------------------------------------------------ */
/* Renderer-side state                                                 */
/* ------------------------------------------------------------------ */

/** A queue entry as the renderer knows it. */
export interface Job {
  id: string
  url: string
  mode: DownloadMode
  platform: Platform
  status: JobStatus
  title: string | null
  thumbnail: string | null
  duration: number | null
  quality: string
  percent: number
  speed: number | null
  eta: number | null
  downloaded: number
  total: number | null
  filepath: string | null
  filesize: number | null
  error: string | null
  createdAt: number
}

export interface HistoryEntry {
  id: string
  title: string
  url: string
  platform: Platform
  mode: DownloadMode
  quality: string
  filepath: string
  filesize: number | null
  completedAt: number
}

export type ThemePreference = 'light' | 'dark' | 'system'
export type Language = 'de' | 'en'

export interface Settings {
  theme: ThemePreference
  language: Language
  videoDir: string
  audioDir: string
  imageDir: string
  videoQuality: VideoQuality
  audioBitrate: AudioBitrate
  cookiefile: string | null
  concurrency: number
}
