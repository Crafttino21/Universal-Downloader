import type { Platform } from '@shared/types'

/**
 * Recognises the same URL shapes the Python engine normalises
 * (`engine.normalize_youtube_url`), so the badge never disagrees with what
 * actually gets downloaded.
 */
export function detectPlatform(raw: string): Platform {
  const url = raw.trim()
  if (!url) return 'other'

  const lower = url.toLowerCase()

  if (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('youtube-nocookie.com')
  ) {
    return 'youtube'
  }
  if (lower.includes('tiktok.com')) return 'tiktok'
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram'

  // A bare 11-character YouTube video ID — the engine expands these too.
  if (!lower.includes('://') && !lower.includes('/') && /^[\w-]{11}$/.test(url)) {
    return 'youtube'
  }

  return 'other'
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  other: 'Link'
}

/** Tailwind colour token per platform — used for the badge and the card rail. */
export const PLATFORM_COLOR: Record<Platform, string> = {
  youtube: 'var(--pf-youtube)',
  tiktok: 'var(--pf-tiktok)',
  instagram: 'var(--pf-instagram)',
  other: 'var(--pf-other)'
}

/** Platforms that usually need a cookies.txt to work reliably. */
export const NEEDS_COOKIES: Platform[] = ['instagram']

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
