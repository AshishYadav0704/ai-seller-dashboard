import { metaStore } from '../stores/meta'

export function OfflineNotice() {
  return (
    <div className="max-w-xl py-10">
      <h1 className="font-serif text-4xl font-medium tracking-[-0.01em]">The API isn't answering.</h1>
      <p className="mt-3 text-ink-2">
        Start the backend with{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">uvicorn main:app --reload</code> from the{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px]">backend</code> folder, then try again.
      </p>
      <button type="button" className="btn btn-secondary mt-6" onClick={() => void metaStore.load()}>
        Try again
      </button>
    </div>
  )
}
