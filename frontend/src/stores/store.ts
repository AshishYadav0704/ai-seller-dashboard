import { useSyncExternalStore } from 'react'

/**
 * A minimal observable value. State that outlives a single page (the catalog,
 * the bulk queue, toasts) lives in these instead of React context, so it
 * survives navigation and can be updated from plain async functions.
 */
export interface Store<T> {
  get: () => T
  set: (next: T | ((previous: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (next) => {
      state = typeof next === 'function' ? (next as (previous: T) => T)(state) : next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
