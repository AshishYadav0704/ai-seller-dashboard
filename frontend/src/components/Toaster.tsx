import { dismissToast, useToasts } from '../stores/toasts'
import { Icon } from './Icon'

export function Toaster() {
  const toasts = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)] ${
            t.kind === 'error' ? 'border-danger/30 bg-danger-soft text-danger' : 'border-line bg-surface text-ink'
          }`}
        >
          <Icon
            name={t.kind === 'error' ? 'alert' : 'check'}
            className={`mt-0.5 size-4 shrink-0 ${t.kind === 'success' ? 'text-fern' : ''}`}
          />
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="-m-1 rounded p-1 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <Icon name="close" className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
