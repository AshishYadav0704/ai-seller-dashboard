import { createStore, useStore } from './store'

export type Theme = 'light' | 'dark'

const KEY = 'shelfwise:theme'
const store = createStore<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function toggleTheme() {
  const next: Theme = store.get() === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Private mode or storage disabled: the toggle still works for this visit.
  }
  store.set(next)
}

export function useTheme() {
  return useStore(store)
}
