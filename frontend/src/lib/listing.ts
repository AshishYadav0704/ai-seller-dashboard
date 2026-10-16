import type { Attribute, ListingDraft, Product, ProductInput, Status } from './types'

/** What the listing form edits. Numbers stay as strings until save so typing "12." isn't fought. */
export interface ListingValues {
  title: string
  category: string
  description: string
  tags: string[]
  attributes: Attribute[]
  price: string
  stock: string
  sku: string
  status: Status
}

export type ListingErrors = Partial<Record<'title' | 'category' | 'price' | 'stock' | 'sku', string>>

export function emptyListing(): ListingValues {
  return {
    title: '',
    category: '',
    description: '',
    tags: [],
    attributes: [],
    price: '',
    stock: '',
    sku: '',
    status: 'draft',
  }
}

export function listingFromProduct(product: Product): ListingValues {
  return {
    title: product.title,
    category: product.category,
    description: product.description,
    tags: product.tags,
    attributes: product.attributes,
    price: product.price == null ? '' : String(product.price),
    stock: product.stock == null ? '' : String(product.stock),
    sku: product.sku ?? '',
    status: product.status,
  }
}

/** Fill in what the writer produced, but keep anything only the seller knows (price, stock, SKU). */
export function applyDraft(values: ListingValues, draft: ListingDraft): ListingValues {
  return {
    ...values,
    title: draft.title,
    category: draft.category,
    description: draft.description,
    tags: draft.tags,
    attributes: draft.attributes,
  }
}

function parseAmount(raw: string): number | null | 'invalid' {
  const cleaned = raw.replace(/[,\s₹$€£]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) && value >= 0 ? value : 'invalid'
}

export function validateListing(values: ListingValues): ListingErrors {
  const errors: ListingErrors = {}
  if (!values.title.trim()) errors.title = 'Give the product a title.'
  if (!values.category) errors.category = 'Pick a category.'

  const price = parseAmount(values.price)
  if (price === 'invalid') errors.price = 'Enter a price like 1299 or 1299.50.'

  const stock = parseAmount(values.stock)
  if (stock === 'invalid' || (typeof stock === 'number' && !Number.isInteger(stock))) {
    errors.stock = 'Stock is a whole number.'
  }

  if (values.sku && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(values.sku.trim())) {
    errors.sku = "Letters, numbers, '-' and '_' only."
  }
  return errors
}

export function toProductInput(values: ListingValues, imageId: string | null): ProductInput {
  const price = parseAmount(values.price)
  const stock = parseAmount(values.stock)
  return {
    title: values.title.trim(),
    category: values.category,
    description: values.description.trim(),
    tags: values.tags,
    attributes: values.attributes.filter((a) => a.name.trim() && a.value.trim()),
    price: typeof price === 'number' ? Math.round(price * 100) / 100 : null,
    stock: typeof stock === 'number' ? stock : null,
    sku: values.sku.trim() || null,
    status: values.status,
    image_id: imageId,
  }
}

export const LOW_STOCK = 3

export type AttentionReason = 'out-of-stock' | 'low-stock' | 'no-price' | 'no-photo' | 'draft'

/** Why a listing needs a look, most urgent first. Archived listings never need attention. */
export function attentionReasons(product: Product): AttentionReason[] {
  if (product.status === 'archived') return []
  const reasons: AttentionReason[] = []
  if (product.stock === 0) reasons.push('out-of-stock')
  else if (product.stock != null && product.stock <= LOW_STOCK) reasons.push('low-stock')
  if (product.price == null) reasons.push('no-price')
  if (!product.image) reasons.push('no-photo')
  if (product.status === 'draft') reasons.push('draft')
  return reasons
}
