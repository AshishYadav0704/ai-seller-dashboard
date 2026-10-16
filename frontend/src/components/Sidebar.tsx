import { useBulk } from '../stores/bulk'
import { useCatalog } from '../stores/catalog'
import { metaStore, useMeta } from '../stores/meta'
import type { Route } from '../stores/route'
import { toggleTheme, useTheme } from '../stores/theme'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'

const NAV: { page: Route['page']; label: string; icon: IconName }[] = [
  { page: 'overview', label: 'Overview', icon: 'overview' },
  { page: 'new', label: 'New listing', icon: 'tag' },
  { page: 'bulk', label: 'Bulk import', icon: 'stack' },
  { page: 'catalog', label: 'Catalog', icon: 'rows' },
]

function ConnectionStatus() {
  const { status, meta } = useMeta()

  if (status === 'loading') {
    return <p className="text-[13px] text-on-pine/60">Connecting to the API…</p>
  }
  if (status === 'offline' || !meta) {
    return (
      <div className="text-[13px]">
        <p className="flex items-center gap-2 font-semibold text-on-pine">
          <span className="size-2 rounded-full bg-[#e58a74]" />
          API offline
        </p>
        <p className="mt-1 text-on-pine/60">Start the backend on port 8000, then retry.</p>
        <button
          type="button"
          onClick={() => void metaStore.load()}
          className="mt-2 font-semibold text-on-pine underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }
  if (meta.ai_mode === 'demo') {
    return (
      <div className="text-[13px]">
        <p className="flex items-center gap-2 font-semibold text-on-pine">
          <span className="size-2 rounded-full bg-[#c9a35a]" />
          Demo mode
        </p>
        <p className="mt-1 text-on-pine/60">
          Drafts are generated offline. Add a Gemini key to the backend for real ones.
        </p>
      </div>
    )
  }
  return (
    <div className="text-[13px]">
      <p className="flex items-center gap-2 font-semibold text-on-pine">
        <span className="size-2 rounded-full bg-[#7fd1a6]" />
        Gemini connected
      </p>
      <p className="mt-1 truncate text-on-pine/60">{meta.model}</p>
    </div>
  )
}

export function Sidebar({ route }: { route: Route }) {
  const theme = useTheme()
  const { products } = useCatalog()
  const { jobs } = useBulk()
  const activeJobs = jobs.filter((job) => !['done', 'failed'].includes(job.step)).length

  const badge = (page: Route['page']) => {
    const active = products.filter((p) => p.status !== 'archived').length
    if (page === 'catalog' && active) return active
    if (page === 'bulk' && activeJobs) return activeJobs
    return null
  }

  return (
    <aside className="sticky top-0 z-30 bg-pine text-on-pine lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 lg:px-5 lg:pt-6 lg:pb-8">
        <a href="#/overview" className="flex items-center gap-2.5 rounded-md">
          <Logo className="size-8" />
          <span className="font-serif text-[1.375rem] font-medium tracking-[-0.01em]">Shelfwise</span>
        </a>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md p-2 text-on-pine/70 hover:bg-white/5 hover:text-on-pine lg:hidden"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      <nav aria-label="Main" className="overflow-x-auto px-2 pb-2 lg:flex-1 lg:px-3">
        <ul className="flex gap-0.5 sm:gap-1 lg:flex-col">
          {NAV.map((item) => {
            const active = route.page === item.page
            const count = badge(item.page)
            return (
              <li key={item.page}>
                <a
                  href={`#/${item.page}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-3 ${
                    active ? 'bg-white/10 text-white' : 'text-on-pine/70 hover:bg-white/5 hover:text-on-pine'
                  }`}
                >
                  <Icon name={item.icon} className={`size-[18px] max-sm:hidden ${active ? 'text-[#c9a35a]' : ''}`} />
                  {item.label}
                  {count != null && (
                    <span className="tabular ml-auto rounded-full bg-white/10 px-2 text-xs leading-5 text-on-pine/80 max-sm:hidden">
                      {count}
                    </span>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="hidden border-t border-white/10 px-5 py-5 lg:block">
        <ConnectionStatus />
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-5 flex items-center gap-2 text-[13px] font-medium text-on-pine/70 hover:text-on-pine"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>
    </aside>
  )
}
