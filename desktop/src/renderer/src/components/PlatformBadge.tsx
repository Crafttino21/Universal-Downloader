import type { Platform } from '@shared/types'
import { PLATFORM_COLOR, PLATFORM_LABEL } from '@/lib/platform'
import { cn } from '@/lib/utils'

/**
 * The only place platform colour appears. Kept small and paired with the name so
 * the hue is a cue, never the sole carrier of meaning.
 */
export function PlatformBadge({
  platform,
  className
}: {
  platform: Platform
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-1.5 pr-2',
        'text-[10px] font-medium tracking-wide text-fg-muted',
        className
      )}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: PLATFORM_COLOR[platform] }}
        aria-hidden="true"
      />
      {PLATFORM_LABEL[platform]}
    </span>
  )
}
