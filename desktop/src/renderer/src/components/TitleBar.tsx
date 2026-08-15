import { useEffect, useState } from 'react'
import { Minus, Moon, Settings2, Square, Sun, X } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { cn } from '@/lib/utils'

interface TitleBarProps {
  onOpenSettings: () => void
  /** 'downloading' pulses, 'ready' sits solid, null hides the dot entirely. */
  updateDot: 'downloading' | 'ready' | null
  onShowUpdate: () => void
}

export function TitleBar({
  onOpenSettings,
  updateDot,
  onShowUpdate
}: TitleBarProps): React.JSX.Element {
  const { t, isDark, updateSettings } = useApp()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.isMaximized().then(setMaximized)
    return window.api.onMaximized(setMaximized)
  }, [])

  // The toggle flips between light and dark; "system" lives in Settings.
  const toggleTheme = (): void => void updateSettings({ theme: isDark ? 'light' : 'dark' })

  return (
    <header className="drag-region flex h-8 shrink-0 items-center justify-between border-b border-border bg-surface pl-3">
      <div className="flex items-center gap-2">
        {/* The wordmark's diamond doubles as the app's only logo. */}
        <span className="size-2 rotate-45 rounded-[1px] bg-accent" aria-hidden="true" />
        <span className="font-display text-[12px] font-semibold tracking-tight text-fg">
          {t.appName}
        </span>
      </div>

      <div className="no-drag flex items-center">
        {updateDot && (
          <button
            type="button"
            onClick={onShowUpdate}
            title={t.updateShowDetails}
            aria-label={t.updateShowDetails}
            className="flex h-8 w-7 items-center justify-center"
          >
            <span
              className={cn(
                'size-1.5 rounded-full bg-accent',
                updateDot === 'downloading' && 'dot-pulse'
              )}
            />
          </button>
        )}
        <TitleBarButton onClick={toggleTheme} label={isDark ? t.themeLight : t.themeDark}>
          {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </TitleBarButton>
        <TitleBarButton onClick={onOpenSettings} label={t.settings}>
          <Settings2 className="size-3.5" />
        </TitleBarButton>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <TitleBarButton onClick={() => void window.api.minimize()} label={t.minimize}>
          <Minus className="size-3.5" />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => void window.api.toggleMaximize()}
          label={maximized ? t.restore : t.maximize}
        >
          <Square className="size-3" />
        </TitleBarButton>
        <TitleBarButton onClick={() => void window.api.closeWindow()} label={t.closeWindow} danger>
          <X className="size-3.5" />
        </TitleBarButton>
      </div>
    </header>
  )
}

function TitleBarButton({
  children,
  onClick,
  label,
  danger = false
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-8 w-11 items-center justify-center text-fg-muted transition-colors',
        danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-surface-2 hover:text-fg'
      )}
    >
      {children}
    </button>
  )
}
