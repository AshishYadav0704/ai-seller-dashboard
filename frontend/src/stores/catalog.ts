import { api, ApiError } from '../lib/api'
import type { Product, Status } from '../lib/types'
import { createStore, useStore } from './store'

interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  products: Product[]
  error: string | null
}

const store = createStore<CatalogState>({ status: 'idle', products: [], error: null })

export const catalog = {
  async load() {
    store.set((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading', error: null }))
    try {
      const { items } = await api.listProducts()
      store.set({ status: 'ready', products: items, error: null })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not load the catalog.'
      store.set((s) => ({ ...s, status: 'error', error: message }))
    }
  },

  upsert(product: Product) {
    store.set((s) => {
      const exists = s.products.some((p) => p.id === product.id)
      const products = exists ? s.products.map((p) => (p.id === product.id ? product : p)) : [product, ...s.products]
      return { ...s, products }
    })
  },

  remove(ids: number[]) {
    const gone = new Set(ids)
    store.set((s) => ({ ...s, products: s.products.filter((p) => !gone.has(p.id)) }))
  },

  setStatus(ids: number[], status: Status) {
    const targets = new Set(ids)
    const now = new Date().toISOString()
    store.set((s) => ({
      ...s,
      products: s.products.map((p) =>
        targets.has(p.id) && p.status !== status ? { ...p, status, updated_at: now } : p,
      ),
    }))
  },

  find(id: number): Product | undefined {
    return store.get().products.find((p) => p.id === id)
  },
}

export function useCatalog() {
  return useStore(store)
}
