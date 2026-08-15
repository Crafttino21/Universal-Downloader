import type { Language } from '@shared/types'

/**
 * Every user-visible string lives here — nothing is hardcoded in JSX. Error text
 * coming back from the Python backend is passed through untranslated and shown
 * with a "Backend" label.
 */
const de = {
  appName: 'Universal Downloader',

  // url bar
  urlPlaceholder: 'Link einfügen — YouTube, TikTok, Reddit, X und viele mehr',
  paste: 'Einfügen',
  clear: 'Leeren',
  download: 'Herunterladen',
  downloadCount: (n: number) => (n === 1 ? 'Herunterladen' : `${n} herunterladen`),
  detecting: 'Wird geprüft…',
  multipleLinks: (n: number) => `${n} Links erkannt`,

  // preview card
  playlistDetected: (n: number) => `Playlist mit ${n} Videos — nur dieser Titel wird geladen`,
  previewIdle: 'Keine Vorschau',
  previewSource: 'Quelle',
  previewOvershoot: (h: number) =>
    `Diese Quelle hat nichts unterhalb von ${h}p — du bekommst ${h}p.`,

  // mode & quality
  video: 'Video',
  audio: 'Audio',
  quality: 'Qualität',
  qualityBest: 'Beste',
  bitrate: 'Bitrate',
  target: 'Zielordner',
  changeFolder: 'Ordner wählen',
  openFolder: 'Ordner öffnen',

  // tabs
  queue: 'Warteschlange',
  history: 'Verlauf',

  // job states
  statusQueued: 'In der Warteschlange',
  statusProbing: 'Wird geprüft',
  statusDownloading: 'Lädt',
  statusRetrying: 'Neuer Versuch',
  statusPostprocessing: 'Konvertiert',
  statusMerging: 'Führt zusammen',
  statusDone: 'Fertig',
  statusFailed: 'Fehlgeschlagen',
  statusCancelled: 'Abgebrochen',

  cancel: 'Abbrechen',
  retry: 'Erneut versuchen',
  remove: 'Entfernen',
  showInFolder: 'Im Explorer zeigen',
  openFile: 'Datei öffnen',
  cancelDisabledDuringConvert: 'Konvertierung läuft — Abbruch nicht mehr möglich',

  clearFinished: 'Fertige entfernen',
  clearHistory: 'Verlauf leeren',

  // empty states
  queueEmptyTitle: 'Nichts in der Warteschlange',
  queueEmptyBody: 'Füge oben einen Link ein — YouTube, TikTok, Reddit, X und viele mehr.',
  historyEmptyTitle: 'Noch kein Verlauf',
  historyEmptyBody: 'Abgeschlossene Downloads sammeln sich hier.',

  // ffmpeg
  ffmpegMissingTitle: 'FFmpeg fehlt',
  ffmpegMissingBody: 'MP3-Konvertierung und beste Videoqualität brauchen FFmpeg.',
  ffmpegInstall: 'Installieren',
  ffmpegInstalling: 'Wird installiert…',
  ffmpegInstalled: 'FFmpeg ist installiert.',
  ffmpegFailed: 'FFmpeg-Installation fehlgeschlagen',

  // updates
  updateAvailableTitle: 'Update verfügbar',
  updateDownloading: (v: string) => `Version ${v} wird geladen…`,
  updateReady: (v: string) => `Version ${v} ist bereit`,
  updateReadyBody: 'Die App startet neu und ist danach aktuell.',
  updateLater: 'Später',
  updateRestart: 'Neu starten',
  updateBusy: 'Erst wenn die Warteschlange leer ist',
  updateShowDetails: 'Update anzeigen',
  updateCheck: 'Nach Updates suchen',
  updateChecking: 'Wird gesucht…',
  updateUpToDate: 'Du bist auf dem neuesten Stand.',
  updateFailed: 'Suche nach Updates fehlgeschlagen',
  updatePortableTitle: 'Portable Version',
  updatePortableBody:
    'Die portable .exe kann sich nicht selbst aktualisieren. Lade die neue Version von GitHub.',
  updateOpenReleases: 'Releases öffnen',
  version: 'Version',

  // settings
  settings: 'Einstellungen',
  appearance: 'Darstellung',
  theme: 'Design',
  themeLight: 'Hell',
  themeDark: 'Dunkel',
  themeSystem: 'System',
  language: 'Sprache',
  folders: 'Ordner',
  videoFolder: 'Videos',
  audioFolder: 'Audio',
  imageFolder: 'Bilder',
  downloads: 'Downloads',
  concurrency: 'Gleichzeitige Downloads',
  cookies: 'cookies.txt',
  cookiesHint: 'Nötig für Instagram, X und private Inhalte.',
  cookiesChoose: 'Datei wählen',
  cookiesNone: 'Keine ausgewählt',
  cookiesRemove: 'Entfernen',
  ffmpegSection: 'FFmpeg',
  ffmpegReady: 'Einsatzbereit',
  ffmpegNotFound: 'Nicht gefunden',
  close: 'Schließen',

  // toasts
  toastAdded: (n: number) => (n === 1 ? 'Download hinzugefügt' : `${n} Downloads hinzugefügt`),
  toastDone: 'Heruntergeladen',
  toastFailed: 'Download fehlgeschlagen',
  toastCancelled: 'Download abgebrochen',
  toastImageSaved: 'Bild gespeichert',
  toastNoUrl: 'Kein Link eingegeben',
  toastCookiesRecommended:
    'Instagram und X brauchen meist eine cookies.txt. Du kannst sie in den Einstellungen hinterlegen.',
  toastBackendLost: 'Verbindung zum Backend verloren',
  toastBackendLostBody: 'Laufende Downloads wurden gestoppt. Starte die App neu.',
  backendLabel: 'Backend',

  // window
  minimize: 'Minimieren',
  maximize: 'Maximieren',
  restore: 'Wiederherstellen',
  closeWindow: 'Schließen'
}

const en: typeof de = {
  appName: 'Universal Downloader',

  urlPlaceholder: 'Paste a link — YouTube, TikTok, Reddit, X and many more',
  paste: 'Paste',
  clear: 'Clear',
  download: 'Download',
  downloadCount: (n: number) => (n === 1 ? 'Download' : `Download ${n}`),
  detecting: 'Checking…',
  multipleLinks: (n: number) => `${n} links detected`,

  // preview card
  playlistDetected: (n: number) => `Playlist with ${n} videos — only this one is downloaded`,
  previewIdle: 'No preview',
  previewSource: 'Source',
  previewOvershoot: (h: number) => `This source has nothing below ${h}p — you'll get ${h}p.`,

  video: 'Video',
  audio: 'Audio',
  quality: 'Quality',
  qualityBest: 'Best',
  bitrate: 'Bitrate',
  target: 'Destination',
  changeFolder: 'Choose folder',
  openFolder: 'Open folder',

  queue: 'Queue',
  history: 'History',

  statusQueued: 'Queued',
  statusProbing: 'Checking',
  statusDownloading: 'Downloading',
  statusRetrying: 'Retrying',
  statusPostprocessing: 'Converting',
  statusMerging: 'Merging',
  statusDone: 'Done',
  statusFailed: 'Failed',
  statusCancelled: 'Cancelled',

  cancel: 'Cancel',
  retry: 'Try again',
  remove: 'Remove',
  showInFolder: 'Show in Explorer',
  openFile: 'Open file',
  cancelDisabledDuringConvert: 'Converting — too late to cancel',

  clearFinished: 'Clear finished',
  clearHistory: 'Clear history',

  queueEmptyTitle: 'Nothing queued',
  queueEmptyBody: 'Paste a link above — YouTube, TikTok, Reddit, X and many more.',
  historyEmptyTitle: 'No history yet',
  historyEmptyBody: 'Finished downloads collect here.',

  ffmpegMissingTitle: 'FFmpeg is missing',
  ffmpegMissingBody: 'MP3 conversion and best video quality need FFmpeg.',
  ffmpegInstall: 'Install',
  ffmpegInstalling: 'Installing…',
  ffmpegInstalled: 'FFmpeg is installed.',
  ffmpegFailed: 'FFmpeg install failed',

  updateAvailableTitle: 'Update available',
  updateDownloading: (v: string) => `Downloading version ${v}…`,
  updateReady: (v: string) => `Version ${v} is ready`,
  updateReadyBody: 'The app restarts and comes back up to date.',
  updateLater: 'Later',
  updateRestart: 'Restart',
  updateBusy: 'Only once the queue is empty',
  updateShowDetails: 'Show update',
  updateCheck: 'Check for updates',
  updateChecking: 'Checking…',
  updateUpToDate: "You're on the latest version.",
  updateFailed: 'Could not check for updates',
  updatePortableTitle: 'Portable build',
  updatePortableBody:
    'The portable .exe cannot update itself. Download the new version from GitHub.',
  updateOpenReleases: 'Open releases',
  version: 'Version',

  settings: 'Settings',
  appearance: 'Appearance',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  language: 'Language',
  folders: 'Folders',
  videoFolder: 'Video',
  audioFolder: 'Audio',
  imageFolder: 'Images',
  downloads: 'Downloads',
  concurrency: 'Parallel downloads',
  cookies: 'cookies.txt',
  cookiesHint: 'Needed for Instagram, X and private content.',
  cookiesChoose: 'Choose file',
  cookiesNone: 'None selected',
  cookiesRemove: 'Remove',
  ffmpegSection: 'FFmpeg',
  ffmpegReady: 'Ready',
  ffmpegNotFound: 'Not found',
  close: 'Close',

  toastAdded: (n: number) => (n === 1 ? 'Download added' : `${n} downloads added`),
  toastDone: 'Downloaded',
  toastFailed: 'Download failed',
  toastCancelled: 'Download cancelled',
  toastImageSaved: 'Image saved',
  toastNoUrl: 'No link entered',
  toastCookiesRecommended:
    'Instagram and X usually need a cookies.txt. You can set one in Settings.',
  toastBackendLost: 'Lost the backend connection',
  toastBackendLostBody: 'Running downloads were stopped. Restart the app.',
  backendLabel: 'Backend',

  minimize: 'Minimize',
  maximize: 'Maximize',
  restore: 'Restore',
  closeWindow: 'Close'
}

export const dictionaries = { de, en }
export type Dictionary = typeof de

export function dictionaryFor(language: Language): Dictionary {
  return dictionaries[language] ?? dictionaries.de
}

export const LOCALE: Record<Language, string> = { de: 'de-DE', en: 'en-US' }
