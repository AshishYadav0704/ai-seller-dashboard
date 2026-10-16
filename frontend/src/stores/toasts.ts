import { createStore, useStore } from './store'

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

const store = createStore<Toast[]>([])
let nextId = 1

function push(kind: Toast['kind'], message: string) {
  const id = nextId++
  store.set((toasts) => [...toasts.slice(-3), { id, kind, message }])
  window.setTimeout(() => dismissToast(id), kind === 'error' ? 7000 : 4000)
}

export function dismissToast(id: number) {
  store.set((toasts) => toasts.filter((t) => t.id !== id))
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
}

export function useToasts() {
  return useStore(store)
}
