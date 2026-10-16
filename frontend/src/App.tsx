import { useEffect } from 'react'
import { ProductDrawer } from './components/ProductDrawer'
import { Sidebar } from './components/Sidebar'
import { Toaster } from './components/Toaster'
import { BulkImport } from './pages/BulkImport'
import { Catalog } from './pages/Catalog'
import { NewListing } from './pages/NewListing'
import { Overview } from './pages/Overview'
import { catalog } from './stores/catalog'
import { metaStore, useMeta } from './stores/meta'
import { navigate, useRoute } from './stores/route'

export default function App() {
  const route = useRoute()
  const { status } = useMeta()

  useEffect(() => {
    void metaStore.load()
  }, [])

  // (Re)load the catalog whenever the API becomes reachable.
  useEffect(() => {
    if (status === 'ready') void catalog.load()
  }, [status])

  useEffect(() => {
    const titles = { overview: 'Overview', new: 'New listing', bulk: 'Bulk import', catalog: 'Catalog' }
    document.title = `${titles[route.page]} | Shelfwise`
  }, [route.page])

  const drawerId = route.page === 'catalog' ? route.productId : null

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar route={route} />
      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-[76rem] px-4 pt-8 pb-24 sm:px-8 lg:pt-12">
          {route.page === 'overview' && <Overview />}
          {route.page === 'new' && <NewListing />}
          {route.page === 'bulk' && <BulkImport />}
          {route.page === 'catalog' && <Catalog />}
        </div>
      </main>
      {drawerId != null && <ProductDrawer key={drawerId} productId={drawerId} onClose={() => navigate('catalog')} />}
      <Toaster />
    </div>
  )
}
