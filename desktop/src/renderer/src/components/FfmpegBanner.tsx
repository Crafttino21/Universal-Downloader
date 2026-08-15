import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { FfmpegStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { TransferMeter } from '@/components/TransferMeter'

/**
 * Only rendered while FFmpeg is missing. MP3 and best-quality merges depend on
 * it, so this is a blocking-ish warning rather than a passive hint.
 */
export function FfmpegBanner({
  status,
  onStatusChange
}: {
  status: FfmpegStatus | null
  onStatusChange: (status: FfmpegStatus) => void
}): React.JSX.Element | null {
  const { t } = useApp()
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    return window.api.onFfmpegInstall((event) => {
      setMessage(event.message)
      setProgress(event.percent)
      if (event.stage === 'done' || event.stage === 'failed') setProgress(null)
    })
  }, [])

  if (!status || status.installed) return null

  const install = async (): Promise<void> => {
    setInstalling(true)
    try {
      const next = await window.api.installFfmpeg()
      onStatusChange(next)
      toast.success(t.ffmpegInstalled)
    } catch (err) {
      toast.error(t.ffmpegFailed, { description: (err as Error).message })
    } finally {
      setInstalling(false)
      setMessage(null)
      setProgress(null)
    }
  }

  return (
    <div className="border-b border-border bg-accent-soft px-5 py-2.5">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-4 shrink-0 text-warn" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">{t.ffmpegMissingTitle}</p>
          <p className="truncate text-[12px] text-fg-muted">
            {installing && message ? message : t.ffmpegMissingBody}
          </p>
        </div>
        <Button size="sm" onClick={() => void install()} disabled={installing}>
          {installing ? t.ffmpegInstalling : t.ffmpegInstall}
        </Button>
      </div>

      {installing && (
        <div className="mt-2">
          <TransferMeter percent={progress ?? 0} active indeterminate={progress == null} />
        </div>
      )}
    </div>
  )
}
