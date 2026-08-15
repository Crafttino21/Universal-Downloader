import { useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import type { DownloadMode, FfmpegStatus, ProbeResult } from '@shared/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/EmptyState'
import { FfmpegBanner } from '@/components/FfmpegBanner'
import { HistoryList } from '@/components/HistoryList'
import { JobCard } from '@/components/JobCard'
import { SettingsDialog } from '@/components/SettingsDialog'
import { TitleBar } from '@/components/TitleBar'
import { UpdateCard } from '@/components/UpdateCard'
import { UrlBar } from '@/components/UrlBar'
import { useApp } from '@/hooks/useApp'
import { useQueue } from '@/hooks/useQueue'
import { useUpdate } from '@/hooks/useUpdate'
import { isImageUrl, NEEDS_COOKIES, detectPlatform } from '@/lib/platform'

/** Statuses that mean work would be lost if the app restarted right now. */
const ACTIVE_STATUSES = ['queued', 'probing', 'downloading', 'retrying', 'postprocessing', 'merging']

export function App(): React.JSX.Element | null {
  const { t, settings, ready } = useApp()
  const queue = useQueue(t)
  const update = useUpdate()

  const [mode, setMode] = useState<DownloadMode>('video')
  const [tab, setTab] = useState('queue')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ffmpeg, setFfmpeg] = useState<FfmpegStatus | null>(null)
  const [cookieHintShown, setCookieHintShown] = useState(false)

  useEffect(() => {
    void window.api
      .ffmpegStatus()
      .then(setFfmpeg)
      .catch(() => setFfmpeg({ installed: false, path: null, source: null }))
  }, [])

  if (!ready || !settings) return null

  const handleSubmit = async (
    urls: string[],
    preview: ProbeResult | null = null
  ): Promise<void> => {
    if (!urls.length) {
      toast(t.toastNoUrl)
      return
    }

    // A direct image link isn't a yt-dlp job — route it to the image downloader,
    // which is the CLI's menu option [7].
    const images = urls.filter(isImageUrl)
    const media = urls.filter((u) => !isImageUrl(u))

    for (const url of images) {
      try {
        const result = await window.api.downloadImage(url, settings.imageDir)
        toast.success(t.toastImageSaved, { description: result.filepath })
      } catch (err) {
        toast.error(t.toastFailed, { description: (err as Error).message })
      }
    }

    if (!media.length) return

    // Instagram and X are the platforms that most often need a login.
    if (
      !settings.cookiefile &&
      !cookieHintShown &&
      media.some((u) => NEEDS_COOKIES.includes(detectPlatform(u)))
    ) {
      toast(t.toastCookiesRecommended, { duration: 8000 })
      setCookieHintShown(true)
    }

    const outputDir = mode === 'audio' ? settings.audioDir : settings.videoDir
    const count = await queue.enqueue({
      urls: media,
      mode,
      outputDir,
      videoQuality: settings.videoQuality,
      audioBitrate: settings.audioBitrate,
      settings,
      preview
    })

    setTab('queue')
    toast.success(t.toastAdded(count))
  }

  const finishedCount = queue.jobs.filter((j) =>
    ['done', 'failed', 'cancelled'].includes(j.status)
  ).length

  const queueBusy = queue.jobs.some((j) => ACTIVE_STATUSES.includes(j.status))
  const updateDot =
    update.state.phase === 'downloading' || update.state.phase === 'ready'
      ? update.state.phase
      : null

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col bg-bg">
        <TitleBar
          onOpenSettings={() => setSettingsOpen(true)}
          updateDot={updateDot}
          onShowUpdate={update.reveal}
        />

        <UpdateCard
          state={update.state}
          dismissed={update.dismissed}
          onDismiss={update.dismiss}
          busy={queueBusy}
          onInstall={() => void update.install()}
          releasesUrl={update.info?.releasesUrl ?? ''}
        />

        <FfmpegBanner status={ffmpeg} onStatusChange={setFfmpeg} />

        <UrlBar
          mode={mode}
          onModeChange={setMode}
          onSubmit={(urls, preview) => void handleSubmit(urls, preview)}
          busy={false}
        />

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-end justify-between border-b border-border px-5 pt-3">
            <TabsList>
              <TabsTrigger value="queue">
                {t.queue}
                {queue.jobs.length > 0 && (
                  <span className="tnum ml-1.5 opacity-60">{queue.jobs.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">
                {t.history}
                {queue.history.length > 0 && (
                  <span className="tnum ml-1.5 opacity-60">{queue.history.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="pb-1.5">
              {tab === 'queue' && finishedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={queue.clearFinished}>
                  {t.clearFinished}
                </Button>
              )}
              {tab === 'history' && queue.history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => void queue.clearHistory()}>
                  {t.clearHistory}
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="queue" className="min-h-0 pt-3">
            {queue.jobs.length === 0 ? (
              <EmptyState icon={Inbox} title={t.queueEmptyTitle} body={t.queueEmptyBody} />
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2 px-5 pb-5">
                  {queue.jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onCancel={(id) => void queue.cancel(id)}
                      onRetry={(id) => void queue.retry(id)}
                      onRemove={queue.remove}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="history" className="min-h-0 pt-3">
            <HistoryList
              entries={queue.history}
              onRemove={(id) => void queue.removeHistory(id)}
            />
          </TabsContent>
        </Tabs>

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          ffmpeg={ffmpeg}
          update={update}
        />

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--fg)',
              fontSize: '13px'
            }
          }}
        />
      </div>
    </TooltipProvider>
  )
}
