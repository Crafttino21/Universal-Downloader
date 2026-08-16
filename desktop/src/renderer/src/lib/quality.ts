import type { AudioBitrate, AudioOption, ProbeResult, VideoQuality } from '@shared/types'

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

/**
 * The bitrate ladder.
 *
 * Same idea as the heights above, but the rungs aren't ours to invent: a track
 * that carries 160/128/96 kbps has exactly those three choices, and offering a
 * fixed 320/256/192/128 list would promise quality ffmpeg has to fabricate.
 * `engine.audio_options` resolves the whole menu, so there is nothing to mirror
 * here beyond looking the right entry up.
 */

/** Offered only when the source reports no formats at all — see `engine.decide_audio`. */
export const AUDIO_FALLBACK_RUNGS = [320, 256, 192, 128] as const

export interface AudioChoice {
  /** Stored in settings: a ceiling on the source stream. */
  value: AudioBitrate
  /** Shown to the user: the kbps that choice really lands on disk. */
  kbps: number
}

/** The dropdown entries for a source, best first. `auto` is added by the caller. */
export function audioChoices(probe: ProbeResult | null): AudioChoice[] {
  const options = probe?.audioOptions ?? []
  if (!options.length) {
    return AUDIO_FALLBACK_RUNGS.map((r) => ({ value: `${r}` as AudioBitrate, kbps: r }))
  }
  // Value and label differ when a cap resolves to a lower stream — e.g. a 160
  // kbps Opus source whose m4a branch wins at 130.
  return options.map((o) => ({ value: `${o.cap}` as AudioBitrate, kbps: o.kbps }))
}

/**
 * The option a setting resolves to. Mirrors the one fallback in
 * `engine.choose_audio`: a ceiling the source can't meet falls through to its
 * best stream, so an over-tight ceiling yields the *highest* option, not the lowest.
 */
export function effectiveAudio(
  probe: ProbeResult | null,
  requested: AudioBitrate
): AudioOption | null {
  const options = probe?.audioOptions ?? []
  if (!options.length) return null
  if (requested === 'auto') return options[0]

  const cap = Number(requested)
  // Descending, so the first match is the largest one that fits.
  return options.find((o) => o.cap <= cap) ?? options[0]
}
