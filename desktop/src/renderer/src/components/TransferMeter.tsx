import { cn } from '@/lib/utils'

const TICKS = 20

interface TransferMeterProps {
  /** 0..100 */
  percent: number
  /** Drives the sheen: only a live transfer animates. */
  active?: boolean
  /** Postprocessing has no measurable progress — show a travelling bar instead. */
  indeterminate?: boolean
  tone?: 'accent' | 'success' | 'danger' | 'muted'
}

const TONE: Record<NonNullable<TransferMeterProps['tone']>, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  muted: 'var(--fg-muted)'
}

/**
 * The signature element: a transfer meter with a tick scale beneath it, so the
 * progress stays readable even without looking at the percentage. Ticks below
 * the fill pick up the accent colour as the bar passes them.
 */
export function TransferMeter({
  percent,
  active = false,
  indeterminate = false,
  tone = 'accent'
}: TransferMeterProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent))
  const color = TONE[tone]

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      className="select-none"
    >
      <div
        className={cn(
          'relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2',
          indeterminate && 'meter-indeterminate'
        )}
      >
        {!indeterminate && (
          <div
            className={cn(
              'relative h-full rounded-full transition-[width] duration-300 ease-out',
              active && 'meter-sheen overflow-hidden'
            )}
            style={{ width: `${clamped}%`, backgroundColor: color }}
          />
        )}
      </div>

      {/* Tick scale — a ruler under the bar, not decoration. */}
      <div className="mt-1 flex h-1.5 items-start justify-between" aria-hidden="true">
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const passed = !indeterminate && (i / TICKS) * 100 <= clamped
          // Every fifth tick is taller, giving the eye 25% anchors.
          const major = i % 5 === 0
          return (
            <span
              key={i}
              className="w-px rounded-full transition-colors duration-300"
              style={{
                height: major ? 6 : 3,
                backgroundColor: passed ? color : 'var(--border-strong)',
                opacity: passed ? (major ? 0.75 : 0.45) : major ? 0.9 : 0.5
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
