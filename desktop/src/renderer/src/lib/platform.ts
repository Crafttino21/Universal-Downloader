import type { Platform } from '@shared/types'

/**
 * Host suffixes per platform, checked in order. Matching is done on the parsed
 * hostname rather than with a substring search: `"x.com"` is a substring of
 * `"netflix.com"`, so `includes()` would mislabel unrelated links.
 *
 * Subdomains fall out of the suffix rule for free — `vm.tiktok.com`,
 * `clips.twitch.tv`, `v.redd.it` and `music.youtube.com` all match their parent.
 */
const PLATFORM_HOSTS: ReadonlyArray<readonly [Platform, readonly string[]]> = [
  ['youtube', ['youtube.com', 'youtu.be', 'youtube-nocookie.com']],
  ['tiktok', ['tiktok.com']],
  ['instagram', ['instagram.com', 'instagr.am']],
  ['x', ['x.com', 'twitter.com']],
  ['reddit', ['reddit.com', 'redd.it']],
  ['twitch', ['twitch.tv']],
  ['soundcloud', ['soundcloud.com', 'snd.sc']],
  ['dailymotion', ['dailymotion.com', 'dai.ly']]
]

/** Hostname without `www.`, or `''` if the input isn't URL-shaped. */
function hostOf(url: string): string {
  const lower = url.trim().toLowerCase()
  if (!lower) return ''
  // Users paste `youtube.com/watch?v=…` as often as the full URL.
  const absolute = /^[a-z][a-z0-9+.-]*:\/\//.test(lower) ? lower : `https://${lower}`
  try {
    return new URL(absolute).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Recognises the same URL shapes the Python engine normalises
 * (`engine.normalize_youtube_url`), so the badge never disagrees with what
 * actually gets downloaded.
 */
export function detectPlatform(raw: string): Platform {
  const url = raw.trim()
  if (!url) return 'other'

  const host = hostOf(url)
  if (host) {
    for (const [platform, domains] of PLATFORM_HOSTS) {
      if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return platform
    }
  }

  // A bare 11-character YouTube video ID — the engine expands these too.
  if (!url.includes('://') && !url.includes('/') && /^[\w-]{11}$/.test(url)) {
    return 'youtube'
  }

  return 'other'
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  x: 'X',
  reddit: 'Reddit',
  twitch: 'Twitch',
  soundcloud: 'SoundCloud',
  dailymotion: 'Dailymotion',
  other: 'Link'
}

/** Tailwind colour token per platform — used for the badge and the card rail. */
export const PLATFORM_COLOR: Record<Platform, string> = {
  youtube: 'var(--pf-youtube)',
  tiktok: 'var(--pf-tiktok)',
  instagram: 'var(--pf-instagram)',
  x: 'var(--pf-x)',
  reddit: 'var(--pf-reddit)',
  twitch: 'var(--pf-twitch)',
  soundcloud: 'var(--pf-soundcloud)',
  dailymotion: 'var(--pf-dailymotion)',
  other: 'var(--pf-other)'
}

/** Platforms that usually need a cookies.txt to work reliably. */
export const NEEDS_COOKIES: Platform[] = ['instagram', 'x']

/**
 * Platforms that never carry a video stream. Downloading these in video mode
 * would fall through to the audio-only format and drop a stray .opus into the
 * video folder, so the UI switches mode instead.
 */
export const AUDIO_ONLY: Platform[] = ['soundcloud']

/** Split pasted text into individual URLs — mirrors the CLI's batch input. */
export function splitUrls(text: string): string[] {
  return text
    .split(/[\s\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|avif|svg)(\?|#|$)/i.test(url.trim())
}
