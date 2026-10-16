import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Dropzone } from '../components/Dropzone'
import { Icon } from '../components/Icon'
import { LaunchCopy } from '../components/LaunchCopy'
import { ListingForm } from '../components/ListingForm'
import { PageHeader } from '../components/PageHeader'
import { ProductThumb } from '../components/ProductThumb'
import { api, ApiError } from '../lib/api'
import { checkFile } from '../lib/files'
import { formatPrice } from '../lib/format'
import {
  applyDraft,
  emptyListing,
  toProductInput,
  validateListing,
  type ListingErrors,
  type ListingValues,
} from '../lib/listing'
import type { ImageRef, MarketingKit, Product, Status, WriterSource } from '../lib/types'
import { catalog } from '../stores/catalog'
import { useMeta } from '../stores/meta'
import { navigate, productPath } from '../stores/route'
import { toast } from '../stores/toasts'

type Photo =
  | { step: 'empty' }
  | { step: 'uploading'; preview: string; name: string }
  | { step: 'drafting'; preview: string; name: string; image: ImageRef }
  | { step: 'ready'; preview: string; name: string; image: ImageRef; source: WriterSource | null }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function NewListing() {
  const { meta } = useMeta()
  const maxMb = meta?.max_upload_mb ?? 8

  const [photo, setPhoto] = useState<Photo>({ step: 'empty' })
  const [draftError, setDraftError] = useState<string | null>(null)
  const [values, setValues] = useState<ListingValues>(emptyListing)
  const [errors, setErrors] = useState<ListingErrors>({})
  const [kit, setKit] = useState<MarketingKit | null>(null)
  const [saving, setSaving] = useState<Status | null>(null)
  const [saved, setSaved] = useState<Product | null>(null)
  // Incremented for every new photo so a slow response for an older one is ignored.
  const attempt = useRef(0)

  const preview = photo.step === 'empty' ? null : photo.preview
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function handleFile(file: File) {
    const problem = checkFile(file, maxMb)
    if (problem) {
      toast.error(problem)
      return
    }
    const token = ++attempt.current
    const name = file.name || 'Pasted image'
    const previewUrl = URL.createObjectURL(file)
    setSaved(null)
    setDraftError(null)
    setPhoto({ step: 'uploading', preview: previewUrl, name })

    let image: ImageRef
    try {
      image = await api.uploadPhoto(file)
    } catch (error) {
      if (token !== attempt.current) return
      setPhoto({ step: 'empty' })
      toast.error(errorMessage(error, 'Upload failed.'))
      return
    }
    if (token !== attempt.current) return
    setPhoto({ step: 'drafting', preview: previewUrl, name, image })

    try {
      const response = await api.draftListing(image.id, file.name || undefined)
      if (token !== attempt.current) return
      setValues((current) => applyDraft(current, response.draft))
      setErrors({})
      setPhoto({ step: 'ready', preview: previewUrl, name, image, source: response.source })
    } catch (error) {
      if (token !== attempt.current) return
      setDraftError(errorMessage(error, 'The listing could not be drafted.'))
      setPhoto({ step: 'ready', preview: previewUrl, name, image, source: null })
    }
  }

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
    if (file && !saved) {
      event.preventDefault()
      void handleFile(file)
    }
  })

  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  }, [])

  function change(patch: Partial<ListingValues>) {
    setValues((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch)) delete next[key as keyof ListingErrors]
      return next
    })
  }

  async function save(status: Status) {
    const found = validateListing(values)
    setErrors(found)
    if (Object.keys(found).length) return

    setSaving(status)
    try {
      const image = photo.step === 'drafting' || photo.step === 'ready' ? photo.image : null
      const product = await api.createProduct({
        ...toProductInput(values, image?.id ?? null),
        status,
        marketing: kit,
      })
      catalog.upsert(product)
      setSaved(product)
      toast.success(status === 'published' ? `Published "${product.title}".` : `Saved "${product.title}" as a draft.`)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the listing.'))
    } finally {
      setSaving(null)
    }
  }

  async function handleKit(next: MarketingKit) {
    setKit(next)
    if (saved) {
      const updated = await api.updateProduct(saved.id, { marketing: next })
      catalog.upsert(updated)
      setSaved(updated)
    }
  }

  function startOver() {
    attempt.current += 1
    setPhoto({ step: 'empty' })
    setDraftError(null)
    setValues(emptyListing())
    setErrors({})
    setKit(null)
    setSaved(null)
  }

  const busy = photo.step === 'uploading' || photo.step === 'drafting'
  const hasDraft = values.title.trim() !== '' || photo.step !== 'empty'

  return (
    <>
      <PageHeader
        title="New listing"
        description="Add a product photo and Shelfwise drafts the title, category, description and tags. Check them, add a price, publish."
        actions={
          hasDraft && !saved ? (
            <button type="button" onClick={startOver} className="btn btn-ghost">
              Start over
            </button>
          ) : undefined
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Product photo" className="space-y-3 lg:sticky lg:top-8">
          {photo.step === 'empty' ? (
            <>
              <Dropzone
                onFiles={(files) => void handleFile(files[0])}
                label="Choose a product photo"
                className="bg-surface"
              >
                <div className="flex aspect-square max-h-[34rem] w-full flex-col items-center justify-center px-8 text-center">
                  <span className="mb-5 grid size-14 place-items-center rounded-full bg-mint text-fern">
                    <Icon name="camera" className="size-6" />
                  </span>
                  <p className="font-serif text-xl font-medium">Drop a product photo here</p>
                  <p className="mt-1.5 max-w-xs text-sm text-ink-2">
                    or click to choose one. Pasting from the clipboard works too.
                  </p>
                  <p className="mt-4 text-xs text-ink-3">JPG, PNG or WebP, up to {maxMb} MB</p>
                </div>
              </Dropzone>
              <div className="rounded-xl px-1 text-[13px] text-ink-2">
                <p className="font-semibold text-ink">For a better first draft</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 marker:text-ink-3">
                  <li>One product per photo, filling most of the frame</li>
                  <li>A plain background and daylight, no flash</li>
                  <li>The label or texture visible if it matters</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <figure className="relative aspect-square max-h-[34rem] w-full overflow-hidden rounded-2xl border border-line bg-surface-2">
                <img src={photo.preview} alt="Product being listed" className="size-full object-contain" />
                {busy && (
                  <>
                    <div className="absolute inset-0 bg-pine/10" />
                    <div className="scan-line absolute inset-x-0 top-0 h-[10%] bg-gradient-to-b from-transparent via-white/75 to-transparent" />
                    <figcaption className="absolute bottom-3 left-3 rounded-full bg-pine px-3 py-1 text-xs font-semibold text-on-pine">
                      {photo.step === 'uploading' ? 'Uploading…' : 'Reading the photo…'}
                    </figcaption>
                  </>
                )}
              </figure>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-ink-2" title={photo.name}>
                  {photo.name}
                </p>
                {!saved && (
                  <Dropzone
                    onFiles={(files) => void handleFile(files[0])}
                    label="Replace photo"
                    disabled={busy}
                    className="!rounded-lg !border border-line-strong bg-surface"
                  >
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold">
                      <Icon name="upload" className="size-3.5" />
                      Replace
                    </span>
                  </Dropzone>
                )}
              </div>
              {photo.step === 'ready' && photo.source === 'demo' && (
                <p className="rounded-lg bg-brass-soft px-3 py-2 text-[13px] text-brass">
                  Demo mode: this draft comes from the photo's colours and file name, not a vision model.
                </p>
              )}
            </>
          )}
        </section>

        {saved ? (
          <section key="saved" className="panel p-6 sm:p-8" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-semibold text-fern">
              <Icon name="check" />
              {saved.status === 'published' ? 'Published' : 'Saved as draft'}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <ProductThumb image={saved.image} alt="" size="md" />
              <div className="min-w-0">
                <h2 className="truncate font-serif text-2xl font-medium">{saved.title}</h2>
                <p className="mt-0.5 text-sm text-ink-2">
                  <span className="tabular">{saved.sku}</span>
                  {saved.price != null && <span className="ml-3">{formatPrice(saved.price)}</span>}
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={startOver}>
                <Icon name="plus" />
                Create another listing
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate(productPath(saved.id))}>
                Open in catalog
              </button>
            </div>
          </section>
        ) : (
          <section key="form" className="panel p-5 sm:p-7" aria-label="Listing details">
            {draftError && (
              <div role="alert" className="mb-6 flex gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                <p>{draftError} You can still fill in the listing yourself, or replace the photo.</p>
              </div>
            )}
            <ListingForm
              values={values}
              errors={errors}
              onChange={change}
              categories={meta?.categories ?? []}
              drafting={photo.step === 'drafting'}
              disabled={saving !== null}
            />
            <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || saving !== null}
                onClick={() => void save('draft')}
              >
                {saving === 'draft' ? 'Saving…' : 'Save as draft'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || saving !== null}
                onClick={() => void save('published')}
              >
                {saving === 'published' ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </section>
        )}
      </div>

      {(hasDraft || saved) && (
        <div className="mt-6">
          <LaunchCopy source={saved ?? values} kit={saved?.marketing ?? kit} onKit={handleKit} />
        </div>
      )}
    </>
  )
}
