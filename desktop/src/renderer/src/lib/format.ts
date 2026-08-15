/** Formatting helpers for the telemetry row. All output is monospace-friendly. */

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB']

export function bytes(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—'
  let n = value
  let unit = 0
  while (n >= 1024 && unit < UNITS.length - 1) {
    n /= 1024
    unit += 1
  }
  return `${n.toFixed(unit === 0 ? 0 : digits)} ${UNITS[unit]}`
}

export function speed(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond == null || !Number.isFinite(bytesPerSecond)) return '—'
  return `${bytes(bytesPerSecond)}/s`
}

/** Seconds as mm:ss (or h:mm:ss past an hour) — a timecode, not "3 minutes". */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function percent(value: number): string {
  return `${value.toFixed(1)}%`
}

/** Shorten a path for a chip: keeps the last two segments. */
export function shortPath(path: string, segments = 2): string {
  if (!path) return ''
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length <= segments) return path
  return `…\\${parts.slice(-segments).join('\\')}`
}

export function relativeTime(timestamp: number, locale: string): string {
  const diff = Date.now() - timestamp
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(-days, 'day')
  return new Date(timestamp).toLocaleDateString(locale)
}
