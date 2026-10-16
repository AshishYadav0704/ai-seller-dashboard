import { api } from '../lib/api'
import type { CategoryOption, Meta } from '../lib/types'
import { createStore, useStore } from './store'

interface MetaState {
  status: 'loading' | 'ready' | 'offline'
  meta: Meta | null
}

const store = createStore<MetaState>({ status: 'loading', meta: null })

export const metaStore = {
  async load() {
    try {
      store.set({ status: 'ready', meta: await api.meta() })
    } catch {
      store.set({ status: 'offline', meta: null })
    }
  },
}

export function useMeta() {
  return useStore(store)
}

export function categoryLabel(slug: string, categories: CategoryOption[] | undefined): string {
  const match = categories?.find((c) => c.slug === slug)
  if (match) return match.label
  const words = slug.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
