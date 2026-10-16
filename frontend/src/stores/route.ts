import { useSyncExternalStore } from 'react'

export type Route =
  | { page: 'overview' }
  | { page: 'new' }
  | { page: 'bulk' }
  | { page: 'catalog'; productId: number | null }

function parse(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/')
  switch (page) {
    case 'new':
      return { page: 'new' }
    case 'bulk':
      return { page: 'bulk' }
    case 'catalog': {
      const productId = Number(id)
      return { page: 'catalog', productId: Number.isInteger(productId) && productId > 0 ? productId : null }
    }
    default:
      return { page: 'overview' }
  }
}

// Cache by hash so useSyncExternalStore gets a stable object between renders.
let cachedHash: string | null = null
let cachedRoute: Route = { page: 'overview' }

function snapshot(): Route {
  if (window.location.hash !== cachedHash) {
    cachedHash = window.location.hash
    cachedRoute = parse(cachedHash)
  }
  return cachedRoute
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function navigate(path: string) {
  const target = `#/${path.replace(/^\//, '')}`
  if (window.location.hash !== target) window.location.hash = target
}

export function productPath(id: number) {
  return `catalog/${id}`
}
