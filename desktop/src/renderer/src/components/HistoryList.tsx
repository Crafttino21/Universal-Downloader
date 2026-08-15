import { FolderSearch, History, X } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState } from '@/components/EmptyState'
import { PlatformBadge } from '@/components/PlatformBadge'
import { useApp } from '@/hooks/useApp'
import { bytes, relativeTime } from '@/lib/format'

interface HistoryListProps {
  entries: HistoryEntry[]
  onRemove: (id: string) => void
}

export function HistoryList({ entries, onRemove }: HistoryListProps): React.JSX.Element {
  const { t, locale } = useApp()

  if (!entries.length) {
    return <EmptyState icon={History} title={t.historyEmptyTitle} body={t.historyEmptyBody} />
  }

  return (
    <ScrollArea className="h-full">
      <ul className="space-y-1.5 px-5 pb-5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-fg" title={entry.title}>
                {entry.title}
              </p>
              <p className="tnum mt-0.5 flex items-center gap-2 text-[11px] text-fg-muted">
                <span>{entry.mode === 'audio' ? 'MP3' : 'MP4'}</span>
                <span>·</span>
                <span>{entry.quality}</span>
                <span>·</span>
                <span>{bytes(entry.filesize)}</span>
                <span>·</span>
                <span>{relativeTime(entry.completedAt, locale)}</span>
              </p>
            </div>

            <PlatformBadge platform={entry.platform} />

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="iconSm"
                title={t.showInFolder}
                onClick={() => void window.api.revealFile(entry.filepath)}
              >
                <FolderSearch />
              </Button>
              <Button
                variant="ghost"
                size="iconSm"
                title={t.remove}
                onClick={() => onRemove(entry.id)}
              >
                <X />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
