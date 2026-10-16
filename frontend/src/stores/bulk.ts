import { api, ApiError } from '../lib/api'
import type { Status } from '../lib/types'
import { catalog } from './catalog'
import { createStore, useStore } from './store'

/**
 * Bulk import runs in the browser as a small queue: each photo is uploaded,
 * drafted and saved as its own set of requests. Compared with one big
 * multipart request this gives per-photo progress, lets a single failure be
 * retried, and never hits the hosting platform's request timeout.
 */

export type JobStep = 'waiting' | 'uploading' | 'drafting' | 'saving' | 'done' | 'failed'

export interface Job {
  id: string
  file: File
  preview: string
  step: JobStep
  error: string | null
  imageId: string | null
  productId: number | null
  title: string | null
  category: string | null
  savedAs: Status | null
}

interface BulkState {
  jobs: Job[]
  publish: boolean
}

// Two at a time keeps things moving without tripping the free Gemini tier's per-minute limit.
const CONCURRENCY = 2

const store = createStore<BulkState>({ jobs: [], publish: false })
let running = 0

function update(id: string, patch: Partial<Job>) {
  store.set((s) => ({ ...s, jobs: s.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)) }))
}

async function run(job: Job) {
  try {
    let imageId = job.imageId
    if (!imageId) {
      update(job.id, { step: 'uploading', error: null })
      imageId = (await api.uploadPhoto(job.file)).id
      update(job.id, { imageId })
    }

    update(job.id, { step: 'drafting', error: null })
    const { draft } = await api.draftListing(imageId, job.file.name)

    update(job.id, { step: 'saving' })
    const status: Status = store.get().publish ? 'published' : 'draft'
    const product = await api.createProduct({
      ...draft,
      price: null,
      stock: null,
      sku: null,
      status,
      image_id: imageId,
    })
    catalog.upsert(product)
    update(job.id, {
      step: 'done',
      productId: product.id,
      title: product.title,
      category: product.category,
      savedAs: status,
    })
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Something went wrong with this photo.'
    update(job.id, { step: 'failed', error: message })
  }
}

function pump() {
  while (running < CONCURRENCY) {
    const next = store.get().jobs.find((job) => job.step === 'waiting')
    if (!next) return
    running += 1
    // Mark it as started right away so the next loop iteration skips it.
    update(next.id, { step: next.imageId ? 'drafting' : 'uploading' })
    void run(next).finally(() => {
      running -= 1
      pump()
    })
  }
}

export const bulk = {
  add(files: File[]) {
    const jobs: Job[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      step: 'waiting',
      error: null,
      imageId: null,
      productId: null,
      title: null,
      category: null,
      savedAs: null,
    }))
    store.set((s) => ({ ...s, jobs: [...s.jobs, ...jobs] }))
    pump()
  },

  setPublish(publish: boolean) {
    store.set((s) => ({ ...s, publish }))
  },

  retry(id: string) {
    update(id, { step: 'waiting', error: null })
    pump()
  },

  retryFailed() {
    store.set((s) => ({
      ...s,
      jobs: s.jobs.map((job) => (job.step === 'failed' ? { ...job, step: 'waiting', error: null } : job)),
    }))
    pump()
  },

  remove(id: string) {
    const job = store.get().jobs.find((j) => j.id === id)
    if (!job || !['waiting', 'failed', 'done'].includes(job.step)) return
    URL.revokeObjectURL(job.preview)
    store.set((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== id) }))
  },

  clearFinished() {
    const finished = store.get().jobs.filter((job) => job.step === 'done')
    finished.forEach((job) => URL.revokeObjectURL(job.preview))
    store.set((s) => ({ ...s, jobs: s.jobs.filter((job) => job.step !== 'done') }))
  },
}

export function useBulk() {
  return useStore(store)
}
