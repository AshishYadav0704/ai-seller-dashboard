import { Dropzone } from '../components/Dropzone'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { Segmented } from '../components/Segmented'
import { checkFile } from '../lib/files'
import { plural } from '../lib/format'
import { bulk, useBulk, type Job } from '../stores/bulk'
import { categoryLabel, useMeta } from '../stores/meta'
import { navigate, productPath } from '../stores/route'
import { toast } from '../stores/toasts'

const STEP_LABEL: Record<Job['step'], string> = {
  waiting: 'Waiting',
  uploading: 'Uploading',
  drafting: 'Drafting',
  saving: 'Saving',
  done: 'Done',
  failed: 'Failed',
}

function Spinner() {
  return <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-fern border-t-transparent" />
}

function JobRow({ job }: { job: Job }) {
  const { meta } = useMeta()
  const active = ['uploading', 'drafting', 'saving'].includes(job.step)
  const productId = job.productId

  return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-5">
      <img src={job.preview} alt="" className="size-12 rounded-lg border border-line object-cover" />
      <div className="min-w-0">
        <p className="truncate font-medium">{job.title ?? job.file.name}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px]">
          {active && <Spinner />}
          {job.step === 'done' ? (
            <span className="truncate text-ink-2">
              {job.savedAs === 'published' ? 'Published' : 'Saved as draft'} in{' '}
              {categoryLabel(job.category ?? 'other', meta?.categories)}
            </span>
          ) : job.step === 'failed' ? (
            <span className="truncate text-danger" title={job.error ?? undefined}>
              {job.error}
            </span>
          ) : (
            <span className="text-ink-3">{STEP_LABEL[job.step]}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {job.step === 'done' && productId != null && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(productPath(productId))}>
            <Icon name="edit" className="size-3.5" />
            Edit
          </button>
        )}
        {job.step === 'failed' && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => bulk.retry(job.id)}>
            <Icon name="refresh" className="size-3.5" />
            Retry
          </button>
        )}
        {(job.step === 'waiting' || job.step === 'failed') && (
          <button
            type="button"
            className="btn btn-ghost btn-sm px-2"
            onClick={() => bulk.remove(job.id)}
            aria-label={`Remove ${job.file.name} from the queue`}
          >
            <Icon name="close" className="size-3.5" />
          </button>
        )}
        {job.step === 'done' && <Icon name="check" className="size-4 text-fern" />}
      </div>
    </li>
  )
}

export function BulkImport() {
  const { jobs, publish } = useBulk()
  const { meta } = useMeta()
  const maxMb = meta?.max_upload_mb ?? 8

  const done = jobs.filter((job) => job.step === 'done').length
  const failed = jobs.filter((job) => job.step === 'failed').length
  const finished = done + failed
  const progress = jobs.length ? Math.round((finished / jobs.length) * 100) : 0

  function addFiles(files: File[]) {
    const accepted: File[] = []
    const rejected: string[] = []
    for (const file of files) {
      const problem = checkFile(file, maxMb)
      if (problem) rejected.push(problem)
      else accepted.push(file)
    }
    if (accepted.length) bulk.add(accepted)
    if (rejected.length === 1) toast.error(rejected[0])
    if (rejected.length > 1) toast.error(`Skipped ${rejected.length} files that aren't images under ${maxMb} MB.`)
  }

  return (
    <>
      <PageHeader
        title="Bulk import"
        description="Add a batch of photos. Each one is uploaded, drafted and saved on its own, two at a time, so one bad photo doesn't hold up the rest."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Dropzone multiple onFiles={addFiles} label="Choose product photos" className="bg-surface">
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="mb-4 grid size-12 place-items-center rounded-full bg-mint text-fern">
              <Icon name="stack" className="size-5" />
            </span>
            <p className="font-serif text-xl font-medium">Drop a batch of photos</p>
            <p className="mt-1 text-sm text-ink-2">or click to pick several at once. One product per photo.</p>
          </div>
        </Dropzone>

        <div className="panel p-5">
          <p className="label">Save each listing as</p>
          <Segmented
            label="Save each listing as"
            value={publish ? 'published' : 'draft'}
            onChange={(value) => bulk.setPublish(value === 'published')}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ]}
          />
          <p className="mt-3 text-[13px] text-ink-2">
            {publish
              ? 'Listings go live as soon as they are drafted. Prices can be added later.'
              : 'Drafts stay hidden until you add prices and publish them from the catalog.'}
          </p>
        </div>
      </div>

      <section className="panel mt-6 overflow-hidden" aria-labelledby="queue-title">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="queue-title" className="font-serif text-xl font-medium">
              Queue
            </h2>
            <p className="tabular text-[13px] text-ink-2" aria-live="polite">
              {jobs.length === 0
                ? 'Nothing queued yet.'
                : `${finished} of ${plural(jobs.length, 'photo')} processed${failed ? `, ${failed} failed` : ''}`}
            </p>
          </div>
          {failed > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={bulk.retryFailed}>
              <Icon name="refresh" className="size-3.5" />
              Retry failed
            </button>
          )}
          {done > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={bulk.clearFinished}>
              Clear finished
            </button>
          )}
          {jobs.length > 0 && (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Import progress"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-fern transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </header>

        {jobs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-3">Photos you add show up here with their progress.</p>
        ) : (
          <ul className="divide-y divide-line">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
