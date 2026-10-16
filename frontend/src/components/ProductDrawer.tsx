import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { api, ApiError, mediaUrl } from '../lib/api'
import { checkFile } from '../lib/files'
import { formatDate } from '../lib/format'
import {
  applyDraft,
  listingFromProduct,
  toProductInput,
  validateListing,
  type ListingErrors,
  type ListingValues,
} from '../lib/listing'
import type { ImageRef, MarketingKit, Product } from '../lib/types'
import { catalog, useCatalog } from '../stores/catalog'
import { useMeta } from '../stores/meta'
import { toast } from '../stores/toasts'
import { ConfirmDialog } from './ConfirmDialog'
import { Dropzone } from './Dropzone'
import { Icon } from './Icon'
import { LaunchCopy } from './LaunchCopy'
import { ListingForm } from './ListingForm'
import { StatusPill } from './StatusPill'

interface Props {
  productId: number
  onClose: () => void
}

export function ProductDrawer({ productId, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { products, status } = useCatalog()
  const product = products.find((p) => p.id === productId)
  // The editor reports unsaved changes so Esc and the close button can ask first.
  const dirty = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const reportDirty = useCallback((value: boolean) => {
    dirty.current = value
  }, [])

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function requestClose() {
    if (dirty.current) setConfirmDiscard(true)
    else onClose()
  }

  function handleCancel(event: SyntheticEvent) {
    event.preventDefault()
    requestClose()
  }

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      aria-label={product ? `Edit ${product.title}` : 'Product'}
      className="sheet m-0 ml-auto h-dvh max-h-dvh w-full max-w-[36rem] border-l border-line bg-canvas p-0 text-ink"
    >
      {product ? (
        <ProductEditor product={product} onClose={onClose} requestClose={requestClose} reportDirty={reportDirty} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          {status === 'ready' ? (
            <>
              <p className="font-serif text-xl">This product doesn't exist any more.</p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Back to catalog
              </button>
            </>
          ) : (
            <p className="text-ink-2">Loading product…</p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        confirmLabel="Discard changes"
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      >
        You've edited this listing without saving.
      </ConfirmDialog>
    </dialog>
  )
}

interface EditorProps {
  product: Product
  onClose: () => void
  requestClose: () => void
  reportDirty: (dirty: boolean) => void
}

function ProductEditor({ product, onClose, requestClose, reportDirty }: EditorProps) {
  const { meta } = useMeta()
  const [baseline, setBaseline] = useState(() => listingFromProduct(product))
  const [values, setValues] = useState<ListingValues>(baseline)
  const [image, setImage] = useState<ImageRef | null>(product.image)
  const [errors, setErrors] = useState<ListingErrors>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline) || image?.id !== product.image?.id

  useEffect(() => {
    reportDirty(dirty)
  }, [dirty, reportDirty])

  function change(patch: Partial<ListingValues>) {
    setValues((current) => ({ ...current, ...patch }))
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch)) delete next[key as keyof ListingErrors]
      return next
    })
  }

  async function replacePhoto(files: File[]) {
    const file = files[0]
    const problem = checkFile(file, meta?.max_upload_mb ?? 8)
    if (problem) return toast.error(problem)
    setUploading(true)
    try {
      setImage(await api.uploadPhoto(file))
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function redraft() {
    if (!image) return
    setDrafting(true)
    try {
      const { draft } = await api.draftListing(image.id)
      setValues((current) => applyDraft(current, draft))
      toast.info('Listing rewritten from the photo. Review it, then save.')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not draft from this photo.')
    } finally {
      setDrafting(false)
    }
  }

  async function save() {
    const found = validateListing(values)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      const saved = await api.updateProduct(product.id, toProductInput(values, image?.id ?? null))
      catalog.upsert(saved)
      const next = listingFromProduct(saved)
      setBaseline(next)
      setValues(next)
      toast.success('Changes saved.')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function saveKit(kit: MarketingKit) {
    const saved = await api.updateProduct(product.id, { marketing: kit })
    catalog.upsert(saved)
  }

  async function remove() {
    setDeleting(true)
    try {
      await api.deleteProduct(product.id)
      catalog.remove([product.id])
      toast.success(`Deleted "${product.title}".`)
      onClose()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete this product.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-3 border-b border-line bg-surface px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-xl font-medium">{product.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
            <StatusPill status={product.status} />
            <span className="tabular">{product.sku}</span>
            <span>Updated {formatDate(product.updated_at)}</span>
          </p>
        </div>
        <button type="button" onClick={requestClose} className="btn btn-ghost -mr-2 px-2.5" aria-label="Close panel">
          <Icon name="close" />
        </button>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-6">
        <div className="flex gap-4">
          <div className="relative size-32 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2">
            {image ? (
              <img src={mediaUrl(image.url)} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-ink-3">
                <Icon name="image" className="size-7" />
              </div>
            )}
            {(uploading || drafting) && (
              <div className="absolute inset-0 overflow-hidden bg-pine/20">
                <div className="scan-line h-[10%] bg-gradient-to-b from-transparent via-white/70 to-transparent" />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <Dropzone onFiles={replacePhoto} label="Replace photo" disabled={uploading} className="!rounded-lg !border">
              <span className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
                <Icon name="upload" />
                {uploading ? 'Uploading…' : image ? 'Replace photo' : 'Add a photo'}
              </span>
            </Dropzone>
            {image && (
              <button
                type="button"
                onClick={redraft}
                disabled={drafting}
                className="btn btn-ghost btn-sm justify-start"
              >
                <Icon name="refresh" className="size-3.5" />
                {drafting ? 'Reading photo…' : 'Rewrite listing from photo'}
              </button>
            )}
          </div>
        </div>

        <ListingForm
          values={values}
          errors={errors}
          onChange={change}
          categories={meta?.categories ?? []}
          drafting={drafting}
          showStatus
        />

        <div className="border-t border-line pt-6">
          <LaunchCopy source={values} kit={product.marketing} onKit={saveKit} compact />
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-line bg-surface px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="btn btn-ghost text-danger hover:text-danger"
        >
          <Icon name="trash" />
          Delete
        </button>
        <span className="flex-1" />
        {dirty && <span className="hidden text-[13px] text-ink-3 sm:inline">Unsaved changes</span>}
        <button type="button" onClick={requestClose} className="btn btn-secondary">
          Close
        </button>
        <button type="button" onClick={save} disabled={!dirty || saving} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this listing?"
        confirmLabel="Delete listing"
        busyLabel="Deleting…"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        "{product.title}" and its photo will be removed. This can't be undone.
      </ConfirmDialog>
    </div>
  )
}
