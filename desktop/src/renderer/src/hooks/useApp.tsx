import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Settings } from '@shared/types'
import { dictionaryFor, LOCALE, type Dictionary } from '@/lib/i18n'

interface AppContextValue {
  settings: Settings | null
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  t: Dictionary
  locale: string
  /** The theme actually in effect, with "system" already resolved. */
  isDark: boolean
  /** True once settings have loaded — the shell renders nothing before that. */
  ready: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

function resolveDark(theme: Settings['theme']): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
}

export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isDark, setIsDark] = useState(false)

  // Kept in state rather than read off the DOM, so components that show the
  // current theme (the title bar toggle) re-render when the OS flips it.
  const applyTheme = useCallback((theme: Settings['theme']) => {
    const dark = resolveDark(theme)
    document.documentElement.classList.toggle('dark', dark)
    setIsDark(dark)
  }, [])

  useEffect(() => {
    void window.api.getSettings().then((loaded) => {
      setSettings(loaded)
      applyTheme(loaded.theme)
      document.documentElement.lang = loaded.language
    })
  }, [applyTheme])

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (settings?.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => applyTheme('system')
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [settings?.theme, applyTheme])

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = await window.api.setSettings(patch)
      setSettings(next)
      if (patch.theme) applyTheme(next.theme)
      if (patch.language) document.documentElement.lang = next.language
    },
    [applyTheme]
  )

  const value = useMemo<AppContextValue>(() => {
    const language = settings?.language ?? 'de'
    return {
      settings,
      updateSettings,
      t: dictionaryFor(language),
      locale: LOCALE[language],
      isDark,
      ready: settings !== null
    }
  }, [settings, updateSettings, isDark])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
