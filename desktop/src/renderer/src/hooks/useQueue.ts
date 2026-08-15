import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  AudioBitrate,
  DownloadMode,
  HistoryEntry,
  Job,
  ProbeResult,
  Settings,
  VideoQuality
} from '@shared/types'
import { detectPlatform } from '@/lib/platform'
import type { Dictionary } from '@/lib/i18n'

interface EnqueueOptions {
  urls: string[]
  mode: DownloadMode
  outputDir: string
  videoQuality: VideoQuality
  audioBitrate: AudioBitrate
  settings: Settings
  /** Metadata the URL bar already fetched, when there's exactly one URL. */
  preview?: ProbeResult | null
}

let counter = 0
function newId(): string {
  counter += 1
  return `job-${Date.now().toString(36)}-${counter}`
}

export function useQueue(t: Dictionary): {
  jobs: Job[]
  history: HistoryEntry[]
  enqueue: (options: EnqueueOptions) => Promise<number>
  cancel: (id: string) => Promise<void>
  retry: (id: string) => Promise<void>
  remove: (id: string) => void
  clearFinished: () => void
  removeHistory: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
} {
  const [jobs, setJobs] = useState<Job[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Event handlers need the current jobs without re-subscribing on every change.
  const jobsRef = useRef<Job[]>([])
  jobsRef.current = jobs

  useEffect(() => {
    void window.api.listHistory().then(setHistory)
  }, [])

  const patch = useCallback((id: string, changes: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...changes } : j)))
  }, [])

  /* ---------------- daemon events ---------------- */

  useEffect(() => {
    const offProgress = window.api.onProgress((p) => {
      patch(p.jobId, {
        percent: p.percent,
        speed: p.speed,
        eta: p.eta,
        downloaded: p.downloaded,
        total: p.total,
        status: 'downloading'
      })
    })

    const offStatus = window.api.onStatus((s) => {
      // `done` and `failed` arrive as their own events with more detail.
      if (s.status === 'done' || s.status === 'failed') return
      patch(s.jobId, { status: s.status })
      if (s.status === 'cancelled') toast(t.toastCancelled)
    })

    const offDone = window.api.onDone((d) => {
      const job = jobsRef.current.find((j) => j.id === d.jobId)
      patch(d.jobId, {
        status: 'done',
        percent: 100,
        speed: null,
        eta: null,
        filepath: d.filepath,
        filesize: d.filesize,
        title: d.title ?? job?.title ?? null
      })

      if (job && d.filepath) {
        const entry: HistoryEntry = {
          id: d.jobId,
          title: d.title ?? job.title ?? job.url,
          url: job.url,
          platform: job.platform,
          mode: job.mode,
          quality: job.quality,
          filepath: d.filepath,
          filesize: d.filesize,
          completedAt: Date.now()
        }
        void window.api.addHistory(entry).then(setHistory)
      }

      toast.success(t.toastDone, { description: d.title ?? undefined })
    })

    const offFailed = window.api.onFailed((f) => {
      patch(f.jobId, { status: 'failed', error: f.error, speed: null, eta: null })
      toast.error(t.toastFailed, { description: f.error })
    })

    const offCrash = window.api.onCrash(() => {
      setJobs((prev) =>
        prev.map((j) =>
          ['queued', 'probing', 'downloading', 'retrying', 'postprocessing'].includes(j.status)
            ? { ...j, status: 'failed', error: t.toastBackendLost }
            : j
        )
      )
      toast.error(t.toastBackendLost, { description: t.toastBackendLostBody, duration: 10_000 })
    })

    return () => {
      offProgress()
      offStatus()
      offDone()
      offFailed()
      offCrash()
    }
  }, [patch, t])

  /* ---------------- actions ---------------- */

  const startJob = useCallback(
    async (job: Job, settings: Settings, outputDir: string, hasMetadata = false) => {
      try {
        await window.api.startJob({
          jobId: job.id,
          url: job.url,
          mode: job.mode,
          outputDir,
          videoQuality: settings.videoQuality,
          audioBitrate: settings.audioBitrate,
          cookiefile: settings.cookiefile,
          playlist: false
        })
      } catch (err) {
        patch(job.id, { status: 'failed', error: (err as Error).message })
        return
      }

      // Skip the extra extraction when the URL bar already previewed this URL.
      if (hasMetadata) return

      // Metadata is nice-to-have: a failed probe must not block the download.
      void window.api
        .probe(job.url)
        .then((meta) => {
          patch(job.id, {
            title: meta.title,
            thumbnail: meta.thumbnail,
            duration: meta.duration
          })
        })
        .catch(() => undefined)
    },
    [patch]
  )

  const enqueue = useCallback(
    async ({
      urls,
      mode,
      outputDir,
      videoQuality,
      audioBitrate,
      settings,
      preview
    }: EnqueueOptions) => {
      const usePreview = urls.length === 1 && preview != null
      const created: Job[] = urls.map((url) => ({
        id: newId(),
        url,
        mode,
        platform: detectPlatform(url),
        status: 'queued',
        title: usePreview ? preview!.title : null,
        thumbnail: usePreview ? preview!.thumbnail : null,
        duration: usePreview ? preview!.duration : null,
        quality:
          mode === 'audio'
            ? `${audioBitrate} kbps`
            : videoQuality === 'best'
              ? t.qualityBest
              : `${videoQuality}p`,
        percent: 0,
        speed: null,
        eta: null,
        downloaded: 0,
        total: null,
        filepath: null,
        filesize: null,
        error: null,
        createdAt: Date.now()
      }))

      setJobs((prev) => [...created, ...prev])
      await Promise.all(created.map((job) => startJob(job, settings, outputDir, usePreview)))
      return created.length
    },
    [startJob, t]
  )

  const cancel = useCallback(
    async (id: string) => {
      await window.api.cancelJob(id)
      patch(id, { status: 'cancelled', speed: null, eta: null })
    },
    [patch]
  )

  const retry = useCallback(
    async (id: string) => {
      const job = jobsRef.current.find((j) => j.id === id)
      if (!job) return
      const settings = await window.api.getSettings()
      const outputDir = job.mode === 'audio' ? settings.audioDir : settings.videoDir
      patch(id, { status: 'queued', percent: 0, error: null, downloaded: 0, total: null })
      await startJob({ ...job, status: 'queued' }, settings, outputDir)
    },
    [patch, startJob]
  )

  const remove = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const clearFinished = useCallback(() => {
    setJobs((prev) => prev.filter((j) => !['done', 'failed', 'cancelled'].includes(j.status)))
  }, [])

  const removeHistoryEntry = useCallback(async (id: string) => {
    setHistory(await window.api.removeHistory(id))
  }, [])

  const clearHistoryEntries = useCallback(async () => {
    setHistory(await window.api.clearHistory())
  }, [])

  return {
    jobs,
    history,
    enqueue,
    cancel,
    retry,
    remove,
    clearFinished,
    removeHistory: removeHistoryEntry,
    clearHistory: clearHistoryEntries
  }
}
