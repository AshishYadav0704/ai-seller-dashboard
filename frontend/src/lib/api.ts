import type {
  BulkActionName,
  DraftResponse,
  ImageRef,
  MarketingKit,
  Meta,
  Product,
  ProductInput,
  Status,
  Tone,
  WriterSource,
} from './types'

/** Empty in development (Vite proxies /api), the deployed API's origin in production. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ValidationIssue = { loc?: (string | number)[]; msg?: string }

function messageFrom(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    // FastAPI validation errors: [{loc: ['body', 'price'], msg: '...'}]
    const issue = detail[0] as ValidationIssue
    const field = issue.loc?.filter((part) => part !== 'body').join('.')
    return field ? `${field}: ${issue.msg}` : (issue.msg ?? 'The request was not valid.')
  }
  if (status >= 500) return 'The server ran into a problem. Try again in a moment.'
  return `Request failed (${status}).`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check that the API is running.")
  }

  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, messageFrom(body, response.status))
  return body as T
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export function mediaUrl(path: string): string {
  return `${API_BASE}${path}`
}

export interface ExportFilters {
  q?: string
  category?: string
  status?: Status
}

export function exportCsvUrl(filters: ExportFilters = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  const query = params.toString()
  return `${API_BASE}/api/products/export.csv${query ? `?${query}` : ''}`
}

export const api = {
  meta: () => request<Meta>('/api/meta'),

  listProducts: () => request<{ items: Product[]; total: number }>('/api/products?limit=500'),
  createProduct: (input: ProductInput) => request<Product>('/api/products', json('POST', input)),
  updateProduct: (id: number, changes: Partial<ProductInput>) =>
    request<Product>(`/api/products/${id}`, json('PATCH', changes)),
  deleteProduct: (id: number) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),
  bulk: (ids: number[], action: BulkActionName) =>
    request<{ action: BulkActionName; affected: number }>('/api/products/bulk', json('POST', { ids, action })),

  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<ImageRef>('/api/uploads', { method: 'POST', body: form })
  },
  draftListing: (imageId: string, filename?: string) =>
    request<DraftResponse>('/api/ai/listing', json('POST', { image_id: imageId, filename })),
  writeMarketing: (input: { title: string; category: string; description: string; tags: string[]; tone: Tone }) =>
    request<{ kit: MarketingKit; source: WriterSource }>('/api/ai/marketing', json('POST', input)),
}
