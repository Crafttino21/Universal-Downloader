import { useState } from 'react'
import { Check, FolderOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import type { FfmpegStatus, Language, Settings, ThemePreference } from '@shared/types'
import type { useUpdate } from '@/hooks/useUpdate'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useApp } from '@/hooks/useApp'
import { shortPath } from '@/lib/format'
import { cn } from '@/lib/utils'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ffmpeg: FfmpegStatus | null
  update: ReturnType<typeof useUpdate>
}

export function SettingsDialog({
  open,
  onOpenChange,
  ffmpeg,
  update
}: SettingsDialogProps): React.JSX.Element {
  const { t, settings, updateSettings } = useApp()
  const [checking, setChecking] = useState(false)

  const pickFolder = async (key: 'videoDir' | 'audioDir' | 'imageDir'): Promise<void> => {
    const picked = await window.api.pickFolder(settings?.[key])
    if (picked) await updateSettings({ [key]: picked } as Partial<Settings>)
  }

  const pickCookies = async (): Promise<void> => {
    const picked = await window.api.pickCookieFile()
    if (picked) await updateSettings({ cookiefile: picked })
  }

  const checkForUpdate = async (): Promise<void> => {
    setChecking(true)
    try {
      const next = await update.check()
      // Only the dead-end results need a toast — a found update announces itself
      // through the card and the title-bar dot.
      if (next.phase === 'up-to-date' || next.phase === 'idle') toast(t.updateUpToDate)
      else if (next.phase === 'error') toast.error(t.updateFailed, { description: next.message })
      else onOpenChange(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.close}>
        <DialogHeader>
          <DialogTitle>{t.settings}</DialogTitle>
          <DialogDescription className="sr-only">{t.settings}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 pb-5">
          {/* Appearance */}
          <Section title={t.appearance}>
            <Row label={t.theme}>
              <Select
                value={settings?.theme ?? 'system'}
                onValueChange={(v) => void updateSettings({ theme: v as ThemePreference })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t.themeLight}</SelectItem>
                  <SelectItem value="dark">{t.themeDark}</SelectItem>
                  <SelectItem value="system">{t.themeSystem}</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            <Row label={t.language}>
              <Select
                value={settings?.language ?? 'de'}
                onValueChange={(v) => void updateSettings({ language: v as Language })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </Section>

          {/* Folders */}
          <Section title={t.folders}>
            <FolderRow
              label={t.videoFolder}
              path={settings?.videoDir}
              onPick={() => void pickFolder('videoDir')}
            />
            <FolderRow
              label={t.audioFolder}
              path={settings?.audioDir}
              onPick={() => void pickFolder('audioDir')}
            />
            <FolderRow
              label={t.imageFolder}
              path={settings?.imageDir}
              onPick={() => void pickFolder('imageDir')}
            />
          </Section>

          {/* Downloads */}
          <Section title={t.downloads}>
            <Row label={t.concurrency}>
              <Select
                value={String(settings?.concurrency ?? 3)}
                onValueChange={(v) => void updateSettings({ concurrency: Number(v) })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)} className="tnum">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>

            <div className="space-y-1.5">
              <Row label={t.cookies}>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => void pickCookies()}>
                    {t.cookiesChoose}
                  </Button>
                  {settings?.cookiefile && (
                    <Button
                      variant="ghost"
                      size="iconSm"
                      title={t.cookiesRemove}
                      onClick={() => void updateSettings({ cookiefile: null })}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </Row>
              <p className="tnum truncate text-[11px] text-fg-muted" title={settings?.cookiefile ?? ''}>
                {settings?.cookiefile ? shortPath(settings.cookiefile, 2) : t.cookiesNone}
              </p>
              <p className="text-[11px] text-fg-muted/80">{t.cookiesHint}</p>
            </div>
          </Section>

          {/* FFmpeg */}
          <Section title={t.ffmpegSection}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-4 items-center justify-center rounded-full',
                  ffmpeg?.installed ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                )}
              >
                {ffmpeg?.installed ? <Check className="size-2.5" /> : <X className="size-2.5" />}
              </span>
              <span className="text-[13px] text-fg">
                {ffmpeg?.installed ? t.ffmpegReady : t.ffmpegNotFound}
              </span>
            </div>
            {ffmpeg?.path && (
              <p className="tnum mt-1 truncate text-[11px] text-fg-muted" title={ffmpeg.path}>
                {ffmpeg.path}
              </p>
            )}
          </Section>

          {/* Version */}
          <Section title={t.version}>
            <Row label={`${t.appName} ${update.info?.version ?? ''}`.trim()}>
              {update.info?.updatable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void checkForUpdate()}
                  disabled={checking}
                >
                  {checking ? t.updateChecking : t.updateCheck}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void window.api.openExternal(update.info?.releasesUrl ?? '')}
                >
                  {t.updateOpenReleases}
                </Button>
              )}
            </Row>
            {/* Only the portable build gets the explanation. Dev builds are also
                non-updatable, but nobody needs to be told that. */}
            {update.state.phase === 'unsupported' && (
              <p className="text-[11px] text-fg-muted/80">{t.updatePortableBody}</p>
            )}
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h3 className="eyebrow mb-2 border-b border-border pb-1.5">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function FolderRow({
  label,
  path,
  onPick
}: {
  label: string
  path?: string
  onPick: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className="tnum truncate text-[11px] text-fg-muted" title={path}>
          {shortPath(path ?? '', 2)}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onPick} className="shrink-0">
        <FolderOpen />
      </Button>
    </div>
  )
}
