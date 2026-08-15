import type { LucideIcon } from 'lucide-react'

/** An empty screen is an invitation to act, so it always names the next step. */
export function EmptyState({
  icon: Icon,
  title,
  body
}: {
  icon: LucideIcon
  title: string
  body: string
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-border bg-surface-2">
        <Icon className="size-4 text-fg-muted" />
      </div>
      <p className="font-display text-[14px] font-semibold text-fg">{title}</p>
      <p className="mt-1 max-w-[320px] text-[12px] text-fg-muted">{body}</p>
    </div>
  )
}
