import { useEffect, useState } from 'react'
import { Music, Play } from 'lucide-react'
import type { DownloadMode } from '@shared/types'
import { duration } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PosterProps {
  src: string | null
  mode: DownloadMode
  /** Renders a runtime badge on the frame, the way video sites do. */
  seconds?: number | null
  /** Sizing lives with the caller — the queue card and the preview differ. */
  className?: string
}

/**
 * A thumbnail frame that degrades cleanly.
 *
 * Extractors hand out thumbnail URLs that never resolve — archive.org's hang
 * open rather than 404 — so an `onError` fallback alone leaves an empty box that
 * reads as a bug. The placeholder is layered *underneath* instead: a pending or
 * failed image is transparent, so the icon shows through until real pixels
 * arrive and cover it. No timers, and nothing flashes on a fast load.
 */
export function Poster({ src, mode, seconds, className }: PosterProps): React.JSX.Element {
  const [broken, setBroken] = useState(false)

  // A new URL deserves a fresh attempt.
  useEffect(() => setBroken(false), [src])

  const Icon = mode === 'audio' ? Music : Play

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-[6px] border border-border bg-surface-2',
        className
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="size-[18px] text-fg-muted" />
      </div>

      {src && !broken && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="relative size-full object-cover"
        />
      )}

      {seconds != null && (
        <span className="tnum absolute bottom-1 right-1 rounded-[3px] bg-black/75 px-1 text-[10px] leading-[1.5] text-white">
          {duration(seconds)}
        </span>
      )}
    </div>
  )
}
