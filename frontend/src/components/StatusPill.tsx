import type { Status } from '../lib/types'

const styles: Record<Status, { label: string; className: string; dot: string }> = {
  published: { label: 'Published', className: 'bg-mint text-fern', dot: 'bg-fern' },
  draft: { label: 'Draft', className: 'bg-brass-soft text-brass', dot: 'bg-brass' },
  archived: { label: 'Archived', className: 'bg-surface-2 text-ink-3', dot: 'bg-ink-3' },
}

export function StatusPill({ status }: { status: Status }) {
  const style = styles[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}
