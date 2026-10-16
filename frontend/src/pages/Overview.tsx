import { Icon } from '../components/Icon'
import { OfflineNotice } from '../components/OfflineNotice'
import { ProductThumb } from '../components/ProductThumb'
import { formatCount, formatMoneyCompact, formatPrice, plural } from '../lib/format'
import { attentionReasons, type AttentionReason } from '../lib/listing'
import type { Product } from '../lib/types'
import { catalog, useCatalog } from '../stores/catalog'
import { categoryLabel, useMeta } from '../stores/meta'
import { productPath } from '../stores/route'

const REASON_LABEL: Record<AttentionReason, string> = {
  'out-of-stock': 'Out of stock',
  'low-stock': 'Low stock',
  'no-price': 'No price',
  'no-photo': 'No photo',
  draft: 'Draft',
}

const URGENCY: AttentionReason[] = ['out-of-stock', 'low-stock', 'no-price', 'no-photo', 'draft']

function headline(published: number, drafts: number) {
  if (published && drafts) {
    return `${plural(published, 'listing is', 'listings are')} live and ${formatCount(drafts)} ${drafts === 1 ? 'is' : 'are'} waiting in drafts.`
  }
  if (published)
    return published === 1 ? 'Your one listing is live.' : `All ${formatCount(published)} listings are live.`
  return `${plural(drafts, 'listing is', 'listings are')} waiting in drafts.`
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface px-5 py-5 sm:px-6">
      <dt className="text-[13px] font-semibold text-ink-2">{label}</dt>
      <dd className="mt-1 font-serif text-[2rem] leading-none font-medium tracking-[-0.01em]">{value}</dd>
      {note && <dd className="mt-2 text-[13px] text-ink-3">{note}</dd>}
    </div>
  )
}

function AttentionList({ products }: { products: Product[] }) {
  const items = products
    .map((product) => ({ product, reasons: attentionReasons(product) }))
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => URGENCY.indexOf(a.reasons[0]) - URGENCY.indexOf(b.reasons[0]))

  return (
    <section className="panel overflow-hidden" aria-labelledby="attention-title">
      <header className="flex items-baseline justify-between border-b border-line px-5 py-4 sm:px-6">
        <h2 id="attention-title" className="font-serif text-xl font-medium">
          Needs attention
        </h2>
        {items.length > 0 && <span className="tabular text-[13px] text-ink-3">{plural(items.length, 'listing')}</span>}
      </header>
      {items.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-ink-2">
          Nothing to fix. Every live listing has a photo, a price and stock.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.slice(0, 6).map(({ product, reasons }) => (
            <li key={product.id}>
              <a
                href={`#/${productPath(product.id)}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2 sm:px-6"
              >
                <ProductThumb image={product.image} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{product.title}</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {reasons.map((reason) => (
                      <span
                        key={reason}
                        className={`rounded px-1.5 py-px text-xs font-semibold ${
                          reason === 'out-of-stock' ? 'bg-danger-soft text-danger' : 'bg-brass-soft text-brass'
                        }`}
                      >
                        {reason === 'low-stock' ? `${REASON_LABEL[reason]}: ${product.stock}` : REASON_LABEL[reason]}
                      </span>
                    ))}
                  </p>
                </div>
                <Icon name="edit" className="size-4 shrink-0 text-ink-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {items.length > 6 && (
        <a
          href="#/catalog"
          className="block border-t border-line px-6 py-3 text-sm font-semibold text-fern hover:bg-surface-2"
        >
          See all {items.length} in the catalog
        </a>
      )}
    </section>
  )
}

function CategoryBreakdown({ products }: { products: Product[] }) {
  const { meta } = useMeta()
  const counts = new Map<string, number>()
  for (const product of products) counts.set(product.category, (counts.get(product.category) ?? 0) + 1)
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = rows[0]?.[1] ?? 1

  return (
    <section className="panel px-5 py-4 sm:px-6" aria-labelledby="categories-title">
      <h2 id="categories-title" className="font-serif text-xl font-medium">
        By category
      </h2>
      <ul className="mt-4 space-y-3">
        {rows.map(([slug, count]) => (
          <li key={slug}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{categoryLabel(slug, meta?.categories)}</span>
              <span className="tabular text-ink-2">{count}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-fern" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Overview() {
  const { status, products, error } = useCatalog()
  const { status: apiStatus } = useMeta()

  if (apiStatus === 'offline') return <OfflineNotice />

  if (status === 'error') {
    return (
      <div className="max-w-xl py-10">
        <h1 className="font-serif text-4xl font-medium">The catalog didn't load.</h1>
        <p className="mt-3 text-ink-2">{error}</p>
        <button type="button" className="btn btn-secondary mt-6" onClick={() => void catalog.load()}>
          Try again
        </button>
      </div>
    )
  }

  if (status !== 'ready') {
    return (
      <div aria-busy="true" aria-label="Loading overview" className="space-y-6">
        <div className="skeleton h-12 max-w-2xl rounded-lg" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="max-w-2xl py-6 lg:py-14">
        <h1 className="font-serif text-[2.75rem] leading-[1.1] font-medium tracking-[-0.015em]">
          Your shelf is empty.
        </h1>
        <p className="mt-4 max-w-lg text-lg text-ink-2">
          Add a product photo and Shelfwise writes the first draft of the listing: title, category, description and
          search tags. You check it, price it and publish.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <a href="#/new" className="btn btn-primary">
            <Icon name="tag" />
            Create your first listing
          </a>
          <a href="#/bulk" className="btn btn-secondary">
            <Icon name="stack" />
            Import a batch of photos
          </a>
        </div>
      </div>
    )
  }

  const active = products.filter((p) => p.status !== 'archived')
  const published = active.filter((p) => p.status === 'published').length
  const drafts = active.length - published
  const units = active.reduce((sum, p) => sum + (p.stock ?? 0), 0)
  const value = active.reduce((sum, p) => sum + (p.price ?? 0) * (p.stock ?? 0), 0)
  const unpriced = active.filter((p) => p.price == null).length
  const recent = [...active].sort((a, b) => b.id - a.id).slice(0, 6)

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="max-w-3xl font-serif text-balance text-[2.25rem] leading-[1.15] font-medium tracking-[-0.015em] sm:text-[2.75rem]">
          {headline(published, drafts)}
        </h1>
        <a href="#/new" className="btn btn-primary">
          <Icon name="plus" />
          New listing
        </a>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Stat label="Live" value={formatCount(published)} note={plural(active.length, 'active listing')} />
        <Stat
          label="Drafts"
          value={formatCount(drafts)}
          note={drafts ? 'Not visible to buyers yet' : 'All caught up'}
        />
        <Stat label="Units in stock" value={formatCount(units)} note="Across active listings" />
        <Stat
          label="Stock value"
          value={formatMoneyCompact(value)}
          note={unpriced ? `${plural(unpriced, 'listing')} without a price` : 'At list price'}
        />
      </dl>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <AttentionList products={products} />
        <CategoryBreakdown products={active} />
      </div>

      <section className="mt-10" aria-labelledby="recent-title">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="recent-title" className="font-serif text-xl font-medium">
            Recently added
          </h2>
          <a href="#/catalog" className="text-sm font-semibold text-fern hover:underline">
            Open catalog
          </a>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {recent.map((product) => (
            <li key={product.id}>
              <a href={`#/${productPath(product.id)}`} className="group block">
                <ProductThumb image={product.image} alt="" size="fill" />
                <p className="mt-2 truncate text-sm font-medium group-hover:underline">{product.title}</p>
                <p className="text-[13px] text-ink-2">{formatPrice(product.price)}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
