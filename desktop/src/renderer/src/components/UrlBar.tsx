import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, Film, FolderOpen, Music, X } from 'lucide-react'
import type { AudioBitrate, DownloadMode, ProbeResult, VideoQuality } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlatformBadge } from '@/components/PlatformBadge'
import { UrlPreview } from '@/components/UrlPreview'
import { useApp } from '@/hooks/useApp'
import { AUDIO_ONLY, detectPlatform, splitUrls } from '@/lib/platform'
import { audioChoices, effectiveAudio } from '@/lib/quality'
import { shortPath } from '@/lib/format'
import { cn } from '@/lib/utils'

const VIDEO_QUALITIES: VideoQuality[] = ['best', '2160', '1440', '1080', '720', '480', '360']

interface UrlBarProps {
  mode: DownloadMode
  onModeChange: (mode: DownloadMode) => void
  /** `preview` is the already-fetched metadata for a single URL, if we have it. */
  onSubmit: (urls: string[], preview: ProbeResult | null) => void
  busy: boolean
}

export function UrlBar({ mode, onModeChange, onSubmit, busy }: UrlBarProps): React.JSX.Element {
  const { t, settings, updateSettings } = useApp()
  const [value, setValue] = useState('')
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [probing, setProbing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const urls = splitUrls(value)
  const platform = detectPlatform(urls[0] ?? '')
  const outputDir = mode === 'audio' ? settings?.audioDir : settings?.videoDir

  // Worth a preview: a single entry that looks like a link rather than stray
  // text. A recognised platform covers scheme-less pastes and bare video IDs.
  const single = urls.length === 1 ? urls[0] : null
  const previewable =
    single != null && (/^https?:\/\//i.test(single) || detectPlatform(single) !== 'other')

  // Without a probe these are the fallback rungs, so a batch paste still works.
  const bitrate = settings?.audioBitrate ?? 'auto'
  const bitrates = audioChoices(probe)
  const outcome = effectiveAudio(probe, bitrate)

  // SoundCloud and friends have no video stream at all. Left in video mode the
  // download would fall through to the audio-only format and land an .opus in
  // the video folder, so follow the link instead of the toggle.
  useEffect(() => {
    if (mode === 'video' && AUDIO_ONLY.includes(platform)) onModeChange('audio')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  // Debounced preview. A single URL is worth previewing; a batch is not.
  useEffect(() => {
    setProbe(null)
    if (!previewable || !single) return

    const url = single
    let cancelled = false
    setProbing(true)
    const timer = setTimeout(() => {
      window.api
        .probe(url)
        .then((result) => {
          if (!cancelled) setProbe(result)
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setProbing(false)
        })
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
      setProbing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const submit = (): void => {
    if (!urls.length) return
    // Hand the preview metadata over so the queue doesn't re-extract the same
    // URL a second time.
    onSubmit(urls, urls.length === 1 ? probe : null)
    setValue('')
    setProbe(null)
    inputRef.current?.focus()
  }

  const pasteFromClipboard = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) setValue(text.trim().split(/\s+/).join(' '))
      inputRef.current?.focus()
    } catch {
      inputRef.current?.focus()
    }
  }

  const chooseFolder = async (): Promise<void> => {
    const picked = await window.api.pickFolder(outputDir)
    if (!picked) return
    await updateSettings(mode === 'audio' ? { audioDir: picked } : { videoDir: picked })
  }

  return (
    <section className="space-y-3 border-b border-border bg-surface px-5 pb-4 pt-5">
      {/* URL field */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          {mode === 'audio' ? (
            <Music className="size-4 text-fg-muted" />
          ) : (
            <Film className="size-4 text-fg-muted" />
          )}
        </span>

        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            // A single-line input drops newlines, which would silently merge a
            // pasted list of URLs into one broken string. Flatten to spaces so
            // multi-line pastes keep the CLI's batch behaviour.
            const text = e.clipboardData.getData('text')
            if (!/\s/.test(text.trim())) return
            e.preventDefault()
            const flattened = text.trim().split(/\s+/).join(' ')
            setValue((prev) => (prev.trim() ? `${prev.trim()} ${flattened}` : flattened))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setValue('')
          }}
          placeholder={t.urlPlaceholder}
          spellCheck={false}
          autoFocus
          className="h-11 pl-9 pr-24 text-[13px]"
        />

        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && (
            <Button variant="ghost" size="iconSm" onClick={() => setValue('')} title={t.clear}>
              <X />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void pasteFromClipboard()}>
            <ClipboardPaste />
            {t.paste}
          </Button>
        </div>
      </div>

      {/* What was recognised: a full card for one link, a count for a batch. */}
      {urls.length > 1 ? (
        <div className="flex min-h-5 items-center gap-2 text-[12px] text-fg-muted">
          <PlatformBadge platform={platform} />
          <span>{t.multipleLinks(urls.length)}</span>
        </div>
      ) : previewable ? (
        <UrlPreview
          platform={platform}
          probe={probe}
          probing={probing}
          mode={mode}
          videoQuality={settings?.videoQuality ?? 'best'}
          audioBitrate={bitrate}
        />
      ) : urls.length === 1 ? (
        <div className="flex min-h-5 items-center gap-2 text-[12px] text-fg-muted">
          <PlatformBadge platform={platform} />
        </div>
      ) : null}

      {/* Controls: mode, quality, destination, action */}
      <div className="flex flex-wrap items-center gap-2">
        <ModeToggle mode={mode} onChange={onModeChange} videoLabel={t.video} audioLabel={t.audio} />

        {mode === 'video' ? (
          <Select
            value={settings?.videoQuality ?? 'best'}
            onValueChange={(v) => void updateSettings({ videoQuality: v as VideoQuality })}
          >
            <SelectTrigger className="w-[104px]" aria-label={t.quality}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_QUALITIES.map((q) => (
                <SelectItem key={q} value={q} className="tnum">
                  {q === 'best' ? t.qualityBest : `${q}p`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={bitrate}
            onValueChange={(v) => void updateSettings({ audioBitrate: v as AudioBitrate })}
          >
            <SelectTrigger className="w-[104px]" aria-label={t.bitrate}>
              {/* The stored ceiling survives a source that can't meet it, so no
                  item matches and Radix would render an empty trigger. Show what
                  this link will really produce instead. */}
              <SelectValue>
                {bitrate === 'auto'
                  ? t.bitrateAuto
                  : `${bitrates.find((c) => c.value === bitrate)?.kbps ?? outcome?.kbps ?? bitrate} kbps`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="tnum" title={t.bitrateAutoHint}>
                {t.bitrateAuto}
              </SelectItem>
              {/* One entry per stream the source actually carries. */}
              {bitrates.map((c) => (
                <SelectItem key={c.value} value={c.value} className="tnum">
                  {c.kbps} kbps
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <button
          type="button"
          onClick={() => void chooseFolder()}
          title={outputDir}
          className={cn(
            'flex h-9 min-w-0 max-w-[220px] items-center gap-2 rounded-[var(--radius-control)]',
            'border border-border bg-surface px-3 text-[12px] text-fg-muted transition-colors',
            'hover:bg-surface-2 hover:text-fg'
          )}
        >
          <FolderOpen className="size-3.5 shrink-0" />
          <span className="tnum truncate">{shortPath(outputDir ?? '')}</span>
        </button>

        <div className="ml-auto">
          <Button onClick={submit} disabled={!urls.length || busy}>
            {t.downloadCount(urls.length || 1)}
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Segmented control — one control, two states, no dropdown needed. */
function ModeToggle({
  mode,
  onChange,
  videoLabel,
  audioLabel
}: {
  mode: DownloadMode
  onChange: (mode: DownloadMode) => void
  videoLabel: string
  audioLabel: string
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      className="flex h-9 items-center rounded-[var(--radius-control)] border border-border bg-surface-2 p-0.5"
    >
      {(
        [
          ['video', videoLabel, Film],
          ['audio', audioLabel, Music]
        ] as const
      ).map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={mode === key}
          onClick={() => onChange(key)}
          className={cn(
            'flex h-full items-center gap-1.5 rounded-[6px] px-3 text-[13px] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            mode === key
              ? 'bg-surface text-fg shadow-sm'
              : 'text-fg-muted hover:text-fg'
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}
