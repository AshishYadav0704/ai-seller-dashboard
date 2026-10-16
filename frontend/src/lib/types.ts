export type Status = 'draft' | 'published' | 'archived'
export type Tone = 'warm' | 'premium' | 'playful' | 'minimal'
export type WriterSource = 'gemini' | 'demo'
export type BulkActionName = 'publish' | 'draft' | 'archive' | 'delete'

export interface Attribute {
  name: string
  value: string
}

export interface ImageRef {
  id: string
  url: string
  thumb_url: string
}

export interface MarketingKit {
  instagram_caption: string
  hashtags: string[]
  seo_title: string
  seo_description: string
  whatsapp_message: string
}

export interface Product {
  id: number
  sku: string | null
  title: string
  category: string
  description: string
  tags: string[]
  attributes: Attribute[]
  price: number | null
  stock: number | null
  status: Status
  image: ImageRef | null
  marketing: MarketingKit | null
  created_at: string
  updated_at: string
}

export interface ProductInput {
  title: string
  category: string
  description: string
  tags: string[]
  attributes: Attribute[]
  price: number | null
  stock: number | null
  sku: string | null
  status: Status
  image_id: string | null
  marketing?: MarketingKit | null
}

export interface ListingDraft {
  title: string
  category: string
  description: string
  tags: string[]
  attributes: Attribute[]
}

export interface DraftResponse {
  image: ImageRef
  draft: ListingDraft
  source: WriterSource
}

export interface CategoryOption {
  slug: string
  label: string
}

export interface Meta {
  version: string
  ai_mode: WriterSource
  model: string | null
  max_upload_mb: number
  categories: CategoryOption[]
}
