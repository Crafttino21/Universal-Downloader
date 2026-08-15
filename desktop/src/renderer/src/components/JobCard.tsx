import { AlertCircle, Check, FolderSearch, Play, RotateCw, X } from 'lucide-react'
import type { Job, JobStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PlatformBadge } from '@/components/PlatformBadge'
import { TransferMeter } from '@/components/TransferMeter'
import { useApp } from '@/hooks/useApp'
import { PLATFORM_COLOR } from '@/lib/platform'
import { bytes, duration, percent as fmtPercent, shortPath, speed as fmtSpeed } from '@/lib/format'
import type { Dictionary } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ACTIVE: JobStatus[] = ['queued', 'probing', 'downloading', 'retrying', 'postprocessing']

function statusLabel(job: Job, t: Dictionary): string {
  switch (job.status) {
    case 'queued':
      return t.statusQueued
    case 'probing':
      return t.statusProbing
    case 'downloading':
      return t.statusDownloading
    case 'retrying':
      return t.statusRetrying
    case 'postprocessing':
      return job.mode === 'audio' ? t.statusPostprocessing : t.statusMerging
    case 'done':
      return t.statusDone
    case 'failed':
      return t.statusFailed
    case 'cancelled':
      return t.statusCancelled
  }
}

function tone(status: JobStatus): 'accent' | 'success' | 'danger' | 'muted' {
  if (status === 'done') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'cancelled') return 'muted'
  return 'accent'
}

interface JobCardProps {
  job: Job
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}

export function JobCard({ job, onCancel, onRetry, onRemove }: JobCardProps): React.JSX.Element {
  const { t } = useApp()
  const active = ACTIVE.includes(job.status)
  const converting = job.status === 'postprocessing'

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface',
        'pl-4 pr-3 py-3 transition-colors'
      )}
    >
      {/* Platform rail — a 2px identity stripe down the left edge. */}
      <span
        className="absolute inset-y-0 left-0 w-0.5"
        style={{ backgroundColor: PLATFORM_COLOR[job.platform] }}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        {job.thumbnail ? (
          <img
            src={job.thumbnail}
            alt=""
            loading="lazy"
            className="h-11 w-[74px] shrink-0 rounded-[6px] border border-border object-cover"
          />
        ) : (
          <div className="flex h-11 w-[74px] shrink-0 items-center justify-center rounded-[6px] border border-border bg-surface-2">
            <Play className="size-3.5 text-fg-muted/60" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-[13px] font-medium text-fg" title={job.title ?? job.url}>
              {job.title ?? job.url}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <StatusChip job={job} label={statusLabel(job, t)} />
              <PlatformBadge platform={job.platform} />
            </div>
          </div>

          <p className="eyebrow mt-0.5">
            {job.mode === 'audio' ? 'MP3' : 'MP4'} · {job.quality}
            {job.duration != null && ` · ${duration(job.duration)}`}
          </p>
        </div>
      </div>

      {/* Meter + telemetry */}
      <div className="mt-2.5">
        <TransferMeter
          percent={job.status === 'done' ? 100 : job.percent}
          active={job.status === 'downloading'}
          indeterminate={converting || job.status === 'retrying'}
          tone={tone(job.status)}
        />

        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-fg-muted">
          {job.status === 'done' ? (
            <>
              <span className="tnum shrink-0">{bytes(job.filesize)}</span>
              <span className="tnum min-w-0 flex-1 truncate opacity-70" title={job.filepath ?? ''}>
                {shortPath(job.filepath ?? '', 2)}
              </span>
            </>
          ) : job.status === 'failed' ? (
            <span className="min-w-0 flex-1 truncate text-danger" title={job.error ?? ''}>
              <span className="eyebrow mr-1.5 text-danger/70">{t.backendLabel}</span>
              {job.error}
            </span>
          ) : active ? (
            <>
              <span className="tnum w-[76px] shrink-0">{fmtPercent(job.percent)}</span>
              <span className="tnum w-[88px] shrink-0">{fmtSpeed(job.speed)}</span>
              <span className="tnum w-[52px] shrink-0">{duration(job.eta)}</span>
              <span className="tnum truncate opacity-70">
                {bytes(job.downloaded)} / {bytes(job.total)}
              </span>
            </>
          ) : (
            <span className="flex-1" />
          )}

          <JobActions
            job={job}
            active={active}
            converting={converting}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
          />
        </div>
      </div>
    </article>
  )
}

function StatusChip({ job, label }: { job: Job; label: string }): React.JSX.Element {
  const color =
    job.status === 'done'
      ? 'text-success'
      : job.status === 'failed'
        ? 'text-danger'
        : job.status === 'cancelled'
          ? 'text-fg-muted'
          : 'text-accent'

  return (
    <span className={cn('eyebrow flex items-center gap-1', color)}>
      {job.status === 'done' && <Check className="size-3" />}
      {job.status === 'failed' && <AlertCircle className="size-3" />}
      {label}
    </span>
  )
}

function JobActions({
  job,
  active,
  converting,
  onCancel,
  onRetry,
  onRemove
}: {
  job: Job
  active: boolean
  converting: boolean
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  const { t } = useApp()

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      {job.status === 'done' && job.filepath && (
        <Button
          variant="ghost"
          size="iconSm"
          title={t.showInFolder}
          onClick={() => void window.api.revealFile(job.filepath!)}
        >
          <FolderSearch />
        </Button>
      )}

      {(job.status === 'failed' || job.status === 'cancelled') && (
        <Button variant="ghost" size="iconSm" title={t.retry} onClick={() => onRetry(job.id)}>
          <RotateCw />
        </Button>
      )}

      {active ? (
        converting ? (
          // Cancelling mid-conversion isn't possible — say why instead of failing silently.
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="ghost" size="iconSm" disabled>
                  <X />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t.cancelDisabledDuringConvert}</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="danger" size="iconSm" title={t.cancel} onClick={() => onCancel(job.id)}>
            <X />
          </Button>
        )
      ) : (
        <Button variant="ghost" size="iconSm" title={t.remove} onClick={() => onRemove(job.id)}>
          <X />
        </Button>
      )}
    </div>
  )
}
