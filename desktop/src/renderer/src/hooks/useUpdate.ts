import { useCallback, useEffect, useState } from 'react'
import type { AppVersionInfo, UpdateState } from '@shared/types'

/**
 * Mirrors the main process's update state. The state machine lives there; this
 * only holds the last value it pushed, plus whether the user has dismissed the
 * card for now.
 */
export function useUpdate(): {
  state: UpdateState
  info: AppVersionInfo | null
  dismissed: boolean
  dismiss: () => void
  reveal: () => void
  check: () => Promise<UpdateState>
  install: () => Promise<boolean>
} {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [info, setInfo] = useState<AppVersionInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    void window.api.getUpdateState().then(setState)
    void window.api.getAppVersion().then(setInfo)
    return window.api.onUpdateChanged((next) => {
      setState(next)
      // A newly staged build is worth showing again even if an earlier phase
      // of the same update was dismissed.
      if (next.phase === 'ready') setDismissed(false)
    })
  }, [])

  const check = useCallback(async (): Promise<UpdateState> => {
    const next = await window.api.checkForUpdate()
    setState(next)
    return next
  }, [])

  return {
    state,
    info,
    dismissed,
    dismiss: useCallback(() => setDismissed(true), []),
    reveal: useCallback(() => setDismissed(false), []),
    check,
    install: useCallback(() => window.api.installUpdate(), [])
  }
}
