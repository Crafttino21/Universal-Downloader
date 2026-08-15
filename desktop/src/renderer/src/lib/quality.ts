import type { VideoQuality } from '@shared/types'

/**
 * The resolution ladder.
 *
 * `probe.heights` are the video heights the source actually carries. The quality
 * dropdown offers a fixed 2160→360 list regardless of the source, so asking for
 * 4K on a 480p video used to fail silently. These helpers work out what the
 * engine will really produce so the preview can show it.
 */

/** The lowest quality the app can target; rungs below it aren't actionable. */
const LADDER_FLOOR = 360

/** Keeps the ladder to one tidy row on a narrow window. */
const MAX_RUNGS = 7

/**
 * Which height the download actually produces, mirroring
 * `engine.build_video_format`: the capped branches take the largest format at or
 * below the cap, and when nothing fits, the selector ends at a bare `best` — so
 * an over-tight cap yields the *highest* rung, not the lowest.
 *
 * `heights` must be descending, which is what `engine._distinct_heights` returns.
 */
export function effectiveHeight(heights: number[], quality: VideoQuality): number | null {
  if (!heights.length) return null
  if (quality === 'best') return heights[0]
  const cap = Number(quality)
  // Descending, so the first match is the largest one that fits.
  return heights.find((h) => h <= cap) ?? heights[0]
}

/** The rungs to draw, always including the one the download will land on. */
export function ladderRungs(heights: number[], effective: number | null): number[] {
  const pool = heights.filter((h) => h >= LADDER_FLOOR)
  if (effective != null) pool.push(effective)

  const rungs = [...new Set(pool)].sort((a, b) => b - a)
  if (rungs.length <= MAX_RUNGS) return rungs

  // Truncating must never hide the rung the user is about to get.
  const kept = rungs.slice(0, MAX_RUNGS)
  if (effective != null && !kept.includes(effective)) kept[MAX_RUNGS - 1] = effective
  return kept
}
