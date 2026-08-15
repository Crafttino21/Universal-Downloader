import { ListVideo } from 'lucide-react'
import type {
  AudioBitrate,
  DownloadMode,
  Platform,
  ProbeResult,
  VideoQuality
} from '@shared/types'
import { PlatformBadge } from '@/components/PlatformBadge'
import { Poster } from '@/components/Poster'
import { useApp } from '@/hooks/useApp'
import { effectiveHeight, ladderRungs } from '@/lib/quality'
import { cn } from '@/lib/utils'

interface UrlPreviewProps {
  platform: Platform
  probe: ProbeResult | null
  probing: boolean
  mode: DownloadMode
  videoQuality: VideoQuality
  audioBitrate: AudioBitrate
}

export function UrlPreview({
  platform,
  probe,
  probing,
  mode,
  videoQuality,
  audioBitrate
}: UrlPreviewProps): React.JSX.Element {
  const { t } = useApp()

  if (!probe) return <PreviewSkeleton platform={platform} probing={probing} />

  const heights = probe.heights ?? []
  const effective = mode === 'video' ? effectiveHeight(heights, videoQuality) : null
  const rungs = mode === 'video' ? ladderRungs(heights, effective) : []

  // The engine's `best` fallback can overshoot a tight cap — 4K when you asked
  // for 360p is worth saying out loud.
  const overshoot =
    effective != null && videoQuality !== 'best' && effective > Number(videoQuality)

  const result =
    mode === 'audio'
      ? `MP3 · ${audioBitrate} kbps`
      : `MP4 · ${
          effective != null
            ? `${effective}p`
            : videoQuality === 'best'
              ? t.qualityBest
              : `${videoQuality}p`
        }`

  // For an unbranded site the extractor name says more than a generic "Link".
  const sourceName =
    platform === 'other' && probe.extractor && probe.extractor !== 'Generic'
      ? probe.extractor
      : undefined

  return (
    <article className="animate-in fade-in slide-in-from-top-1 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface duration-200">
      <div className="flex items-start gap-3 p-2.5">
        <Poster
          src={probe.thumbnail}
          seconds={probe.duration}
          mode={mode}
          className="h-[63px] w-[112px]"
        />

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className="min-w-0 text-[14px] font-medium leading-snug text-fg line-clamp-2"
              title={probe.title}
            >
              {probe.title}
            </h3>
            <PlatformBadge platform={platform} label={sourceName} className="mt-0.5 shrink-0" />
          </div>

          {probe.uploader && (
            <p className="mt-1 truncate text-[11px] text-fg-muted" title={probe.uploader}>
              {probe.uploader}
            </p>
          )}

          {probe.isPlaylist && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-warn">
              <ListVideo className="size-3 shrink-0" />
              <span className="truncate">{t.playlistDetected(probe.playlistCount ?? 0)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Source → result. Left is what the site has, right is what lands on disk. */}
      <div className="flex items-center gap-2.5 border-t border-border bg-surface-2/40 px-2.5 py-1.5">
        {/* Audio mode and audio-only sources have no ladder — the label is
            dropped with it rather than left dangling over nothing. */}
        {rungs.length > 0 && (
          <>
            <span className="eyebrow shrink-0">{t.previewSource}</span>
            <div className="flex min-w-0 flex-wrap items-center gap-0.5">
              {rungs.map((h) => (
                <span
                  key={h}
                  className={cn(
                    'tnum rounded-[4px] px-1.5 py-px text-[10px] leading-[1.6]',
                    h === effective
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-fg-muted/70'
                  )}
                >
                  {h}
                </span>
              ))}
            </div>
          </>
        )}

        {/* The conclusion of the row, so it carries full contrast. */}
        <span
          className={cn('tnum ml-auto shrink-0 text-[11px]', overshoot ? 'text-warn' : 'text-fg')}
          title={overshoot ? t.previewOvershoot(effective!) : undefined}
        >
          <span className="mr-1.5 text-fg-muted/60">→</span>
          {result}
        </span>
      </div>
    </article>
  )
}

/**
 * Holds the exact height of the loaded card so the queue below never jumps when
 * metadata arrives.
 */
function PreviewSkeleton({
  platform,
  probing
}: {
  platform: Platform
  probing: boolean
}): React.JSX.Element {
  const { t } = useApp()

  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex items-start gap-3 p-2.5">
        <div
          className={cn(
            'h-[63px] w-[112px] shrink-0 rounded-[6px] border border-border bg-surface-2',
            probing && 'animate-pulse'
          )}
        />

        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className={cn('h-3 w-3/5 rounded bg-surface-2', probing && 'animate-pulse')} />
              <div className={cn('h-3 w-2/5 rounded bg-surface-2', probing && 'animate-pulse')} />
            </div>
            <PlatformBadge platform={platform} className="mt-0.5 shrink-0" />
          </div>
        </div>
      </div>

      <div className="flex items-center border-t border-border bg-surface-2/40 px-2.5 py-1.5">
        <span className="eyebrow">{probing ? t.detecting : t.previewIdle}</span>
      </div>
    </article>
  )
}
