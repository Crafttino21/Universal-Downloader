import { ArrowUpCircle, X } from 'lucide-react'
import type { UpdateState } from '@shared/types'
import { Button } from '@/components/ui/button'
import { TransferMeter } from '@/components/TransferMeter'
import { useApp } from '@/hooks/useApp'
import * as fmt from '@/lib/format'

interface UpdateCardProps {
  state: UpdateState
  dismissed: boolean
  onDismiss: () => void
  /** Restarting kills running downloads, so the queue gates the button. */
  busy: boolean
  onInstall: () => void
  releasesUrl: string
}

/**
 * Sits directly under the title bar, in the same slot and visual language as
 * FfmpegBanner. Only `downloading`, `ready` and the portable `unsupported`
 * case have anything to say — every other phase renders nothing.
 */
export function UpdateCard({
  state,
  dismissed,
  onDismiss,
  busy,
  onInstall,
  releasesUrl
}: UpdateCardProps): React.JSX.Element | null {
  const { t } = useApp()

  if (dismissed) return null
  if (state.phase !== 'downloading' && state.phase !== 'ready' && state.phase !== 'unsupported') {
    return null
  }

  return (
    <div className="border-b border-border bg-accent-soft px-5 py-2.5">
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="size-4 shrink-0 text-accent" />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">
            {state.phase === 'unsupported' ? t.updatePortableTitle : t.updateAvailableTitle}
          </p>
          <p className="truncate text-[12px] text-fg-muted">
            {state.phase === 'downloading' && (
              <>
                {t.updateDownloading(state.version)}{' '}
                <span className="tnum">
                  {fmt.bytes(state.transferred)}
                  {state.total ? ` / ${fmt.bytes(state.total)}` : ''}
                </span>
              </>
            )}
            {state.phase === 'ready' && `${t.updateReady(state.version)} — ${t.updateReadyBody}`}
            {state.phase === 'unsupported' && t.updatePortableBody}
          </p>
        </div>

        {state.phase === 'ready' && (
          <Button
            size="sm"
            onClick={onInstall}
            disabled={busy}
            title={busy ? t.updateBusy : undefined}
          >
            {t.updateRestart}
          </Button>
        )}
        {state.phase === 'unsupported' && (
          <Button size="sm" onClick={() => void window.api.openExternal(releasesUrl)}>
            {t.updateOpenReleases}
          </Button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          title={t.updateLater}
          aria-label={t.updateLater}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {state.phase === 'downloading' && (
        <div className="mt-2">
          <TransferMeter percent={state.percent} active indeterminate={!state.total} />
        </div>
      )}

      {state.phase === 'ready' && busy && (
        <p className="mt-1.5 text-[11px] text-fg-muted">{t.updateBusy}</p>
      )}
    </div>
  )
}
