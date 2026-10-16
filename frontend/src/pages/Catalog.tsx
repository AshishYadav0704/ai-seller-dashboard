import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { OfflineNotice } from '../components/OfflineNotice'
import { PageHeader } from '../components/PageHeader'
import { ProductThumb } from '../components/ProductThumb'
import { Segmented } from '../components/Segmented'
import { StatusPill } from '../components/StatusPill'
import { api, ApiError, exportCsvUrl } from '../lib/api'
import { formatDate, formatPrice, plural } from '../lib/format'
import { LOW_STOCK } from '../lib/listing'
import type { BulkActionName, Product, Status } from '../lib/types'
import { catalog, useCatalog } from '../stores/catalog'
import { categoryLabel, useMeta } from '../stores/meta'
import { navigate, productPath } from '../stores/route'
import { toast } from '../stores/toasts'

type StatusFilter = 'active' | Status
type SortKey = 'newest' | 'oldest' | 'title' | 'price_asc' | 'price_desc' | 'stock_asc'
type View = 'table' | 'grid'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A to Z' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
  { value: 'stock_asc', label: 'Stock, lowest first' },
]

// Nulls (no price, stock not tracked) always sort last.
function compareNullable(a: number | null, b: number | null, direction: 1 | -1) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return (a - b) * direction
}

function sortProducts(products: Product[], sort: SortKey): Product[] {
  const sorted = [...products]
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => a.id - b.id)
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'price_asc':
      return sorted.sort((a, b) => compareNullable(a.price, b.price, 1))
    case 'price_desc':
      return sorted.sort((a, b) => compareNullable(a.price, b.price, -1))
    case 'stock_asc':
      return sorted.sort((a, b) => compareNullable(a.stock, b.stock, 1))
    default:
      return sorted.sort((a, b) => b.id - a.id)
  }
}

function matches(product: Product, query: string) {
  if (!query) return true
  const haystack = [product.title, product.sku ?? '', product.description, ...product.tags].join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

function StockCell({ stock }: { stock: number | null }) {
  if (stock == null) return <span className="text-ink-3">—</span>
  if (stock === 0) return <span className="font-semibold text-danger">Out of stock</span>
  return <span className={stock <= LOW_STOCK ? 'font-semibold text-brass' : ''}>{stock}</span>
}

const selectClass =
  'input h-9 w-auto appearance-none bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat py-0 pr-8 text-sm'
const chevron = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a887f' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
}

export function Catalog() {
  const { status, products, error } = useCatalog()
  const { meta, status: apiStatus } = useMeta()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<SortKey>('newest')
  const [view, setView] = useState<View>('table')
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [working, setWorking] = useState(false)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const counts = {
    active: products.filter((p) => p.status !== 'archived').length,
    published: products.filter((p) => p.status === 'published').length,
    draft: products.filter((p) => p.status === 'draft').length,
    archived: products.filter((p) => p.status === 'archived').length,
  }

  const visible = sortProducts(
    products.filter(
      (p) =>
        (statusFilter === 'active' ? p.status !== 'archived' : p.status === statusFilter) &&
        (!category || p.category === category) &&
        matches(p, query.trim()),
    ),
    sort,
  )

  const selectedVisible = visible.filter((p) => selected.has(p.id))
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length
  const filtered = Boolean(query.trim() || category || statusFilter !== 'active')
  const usedCategories = (meta?.categories ?? []).filter((c) => products.some((p) => p.category === c.slug))

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.id)))
  }

  function clearFilters() {
    setQuery('')
    setCategory('')
    setStatusFilter('active')
  }

  async function runBulk(action: BulkActionName) {
    const ids = selectedVisible.map((p) => p.id)
    if (!ids.length) return
    setWorking(true)
    try {
      const result = await api.bulk(ids, action)
      if (action === 'delete') {
        catalog.remove(ids)
        toast.success(`Deleted ${plural(result.affected, 'listing')}.`)
      } else {
        const status: Status = action === 'publish' ? 'published' : action === 'draft' ? 'draft' : 'archived'
        catalog.setStatus(ids, status)
        const count = plural(ids.length, 'listing')
        const message = {
          publish: `Published ${count}.`,
          draft: `Moved ${count} to drafts.`,
          archive: `Archived ${count}.`,
        }
        toast.success(message[action])
      }
      setSelected(new Set())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'That bulk action failed.')
    } finally {
      setWorking(false)
      setConfirmDelete(false)
    }
  }

  if (apiStatus === 'offline') return <OfflineNotice />

  const exportHref = exportCsvUrl({
    q: query.trim() || undefined,
    category: category || undefined,
    status: statusFilter === 'active' ? undefined : statusFilter,
  })

  return (
    <>
      <PageHeader
        title="Catalog"
        description={
          status === 'ready' && products.length
            ? `${plural(counts.active, 'listing')} on your shelf, ${counts.published} of them published.`
            : 'Every listing you have saved, in one place.'
        }
        actions={
          <>
            <a href={exportHref} download className="btn btn-secondary">
              <Icon name="download" />
              Export CSV
            </a>
            <a href="#/new" className="btn btn-primary">
              <Icon name="plus" />
              New listing
            </a>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
          />
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, SKU or tag"
            aria-label="Search the catalog"
            className="input h-9 py-0 pr-9 pl-9 text-sm"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-ink-3 sm:block">
            /
          </kbd>
        </div>
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={selectClass}
          style={chevron}
        >
          <option value="">All categories</option>
          {usedCategories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          className={selectClass}
          style={chevron}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Segmented<View>
            label="View"
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'table', label: 'Table' },
              { value: 'grid', label: 'Grid' },
            ]}
          />
        </div>
      </div>

      <div className="mb-5 overflow-x-auto">
        <Segmented<StatusFilter>
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'active', label: 'All', count: counts.active },
            { value: 'published', label: 'Published', count: counts.published },
            { value: 'draft', label: 'Drafts', count: counts.draft },
            { value: 'archived', label: 'Archived', count: counts.archived },
          ]}
        />
      </div>

      {status === 'error' ? (
        <div className="panel px-6 py-14 text-center">
          <p className="font-serif text-xl">The catalog didn't load.</p>
          <p className="mt-1 text-sm text-ink-2">{error}</p>
          <button type="button" className="btn btn-secondary mt-5" onClick={() => void catalog.load()}>
            Try again
          </button>
        </div>
      ) : status !== 'ready' ? (
        <div className="panel divide-y divide-line" aria-busy="true" aria-label="Loading catalog">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-4 px-5 py-4">
              <div className="skeleton size-10 rounded-md" />
              <div className="skeleton h-4 flex-1 rounded" />
              <div className="skeleton h-4 w-20 rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="panel px-6 py-16 text-center">
          <p className="font-serif text-2xl font-medium">Nothing on the shelf yet.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-2">
            Start with one photo to see how drafting works, or import a whole batch at once.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <a href="#/new" className="btn btn-primary">
              Create a listing
            </a>
            <a href="#/bulk" className="btn btn-secondary">
              Import photos
            </a>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="panel px-6 py-14 text-center">
          <p className="font-serif text-xl">
            No listings match {query.trim() ? `"${query.trim()}"` : 'these filters'}.
          </p>
          {filtered && (
            <button type="button" className="btn btn-secondary mt-5" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : view === 'table' ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm sm:min-w-[40rem]">
            <thead className="border-b border-line text-[13px] text-ink-3">
              <tr>
                <th scope="col" className="w-12 py-3 pl-5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all listings shown"
                    className="size-4 accent-[var(--fern)]"
                  />
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Product
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-semibold md:table-cell">
                  Category
                </th>
                <th scope="col" className="hidden py-3 pr-4 text-right font-semibold sm:table-cell">
                  Price
                </th>
                <th scope="col" className="hidden py-3 pr-4 text-right font-semibold sm:table-cell">
                  Stock
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-semibold sm:table-cell">
                  Status
                </th>
                <th scope="col" className="hidden py-3 pr-5 text-right font-semibold lg:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => navigate(productPath(product.id))}
                  className={`cursor-pointer transition-colors hover:bg-surface-2 ${
                    selected.has(product.id) ? 'bg-mint/40' : ''
                  }`}
                >
                  <td className="py-3 pl-5" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggle(product.id)}
                      aria-label={`Select ${product.title}`}
                      className="size-4 accent-[var(--fern)]"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumb image={product.image} alt="" />
                      <div className="min-w-0">
                        <a
                          href={`#/${productPath(product.id)}`}
                          onClick={(event) => event.stopPropagation()}
                          className="block max-w-[14rem] truncate font-medium text-ink hover:underline sm:max-w-[22rem]"
                        >
                          {product.title}
                        </a>
                        <p className="tabular text-[13px] text-ink-3">{product.sku}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[13px] sm:hidden">
                          <StatusPill status={product.status} />
                          <span className="text-ink-2">{formatPrice(product.price)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden py-3 pr-4 text-ink-2 md:table-cell">
                    {categoryLabel(product.category, meta?.categories)}
                  </td>
                  <td className="hidden py-3 pr-4 text-right sm:table-cell">
                    {product.price == null ? <span className="text-ink-3">—</span> : formatPrice(product.price)}
                  </td>
                  <td className="tabular hidden py-3 pr-4 text-right sm:table-cell">
                    <StockCell stock={product.stock} />
                  </td>
                  <td className="hidden py-3 pr-4 sm:table-cell">
                    <StatusPill status={product.status} />
                  </td>
                  <td className="tabular hidden py-3 pr-5 text-right text-ink-3 lg:table-cell">
                    {formatDate(product.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <li key={product.id}>
              <a href={`#/${productPath(product.id)}`} className="group block rounded-xl">
                <ProductThumb image={product.image} alt="" size="fill" />
                <div className="mt-2.5 px-0.5">
                  <p className="truncate font-medium group-hover:underline">{product.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-2">{formatPrice(product.price)}</span>
                    <StatusPill status={product.status} />
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {selectedVisible.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 lg:pl-60">
          <div
            role="toolbar"
            aria-label="Bulk actions"
            className="flex flex-wrap items-center gap-1 rounded-xl bg-pine p-1.5 pl-4 text-on-pine shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)] dark:border dark:border-line"
          >
            <span className="tabular mr-2 text-sm font-semibold">{selectedVisible.length} selected</span>
            {[
              { action: 'publish' as const, label: 'Publish' },
              { action: 'draft' as const, label: 'Move to drafts' },
              { action: 'archive' as const, label: 'Archive' },
            ].map(({ action, label }) => (
              <button
                key={action}
                type="button"
                disabled={working}
                onClick={() => void runBulk(action)}
                className="btn btn-sm text-on-pine hover:bg-white/10"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={working}
              onClick={() => setConfirmDelete(true)}
              className="btn btn-sm text-[#f1a08c] hover:bg-white/10"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="btn btn-sm px-2 text-on-pine/70 hover:bg-white/10"
              aria-label="Clear selection"
            >
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${plural(selectedVisible.length, 'listing')}?`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={working}
        onConfirm={() => void runBulk('delete')}
        onCancel={() => setConfirmDelete(false)}
      >
        Their photos are removed too. This can't be undone.
      </ConfirmDialog>
    </>
  )
}
