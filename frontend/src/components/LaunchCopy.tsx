import { useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { MarketingKit, Tone } from '../lib/types'
import { categoryLabel, useMeta } from '../stores/meta'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'
import { Segmented } from './Segmented'

interface Source {
  title: string
  category: string
  description: string
  tags: string[]
}

interface Props {
  source: Source
  kit: MarketingKit | null
  onKit: (kit: MarketingKit) => void | Promise<void>
  compact?: boolean
}

const TONES: { value: Tone; label: string }[] = [
  { value: 'warm', label: 'Warm' },
  { value: 'premium', label: 'Premium' },
  { value: 'playful', label: 'Playful' },
  { value: 'minimal', label: 'Minimal' },
]

/** Renders WhatsApp's *bold* markup the way the app shows it. */
function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/\*([^*\n]+)\*/g)
  return <>{parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}</>
}

function Counter({ label, value, limit }: { label: string; value: string; limit: number }) {
  const near = value.length > limit * 0.92
  return (
    <span className={`tabular ${near ? 'text-brass' : 'text-ink-3'}`}>
      {label} {value.length}/{limit}
    </span>
  )
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function LaunchCopy({ source, kit, onKit, compact = false }: Props) {
  const { meta } = useMeta()
  const [tone, setTone] = useState<Tone>('warm')
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = Boolean(source.title.trim() && source.category)

  async function write() {
    setWriting(true)
    setError(null)
    try {
      const { title, category, description, tags } = source
      const { kit: next } = await api.writeMarketing({ title, category, description, tags, tone })
      await onKit(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not write launch copy.')
    } finally {
      setWriting(false)
    }
  }

  const category = categoryLabel(source.category, meta?.categories)
  const instagram = kit ? `${kit.instagram_caption}\n\n${kit.hashtags.map((tag) => `#${tag}`).join(' ')}` : ''

  return (
    <section className={compact ? '' : 'panel p-5 sm:p-6'} aria-labelledby="launch-copy-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="launch-copy-title" className={`font-serif font-medium ${compact ? 'text-lg' : 'text-[1.375rem]'}`}>
            Launch copy
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {ready
              ? 'A caption, a broadcast message and search text, in the tone you pick.'
              : 'Add a title and category first.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Tone" value={tone} options={TONES} onChange={setTone} size="sm" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={write} disabled={!ready || writing}>
            {writing ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon name={kit ? 'refresh' : 'chat'} className="size-3.5" />
            )}
            {writing ? 'Writing…' : kit ? 'Rewrite' : 'Write launch copy'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {kit && (
        <div className={`mt-5 grid gap-4 ${compact ? '' : 'lg:grid-cols-2'}`}>
          <article className="rounded-xl border border-line bg-surface-2 p-4">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Instagram caption</h3>
              <CopyButton text={instagram} />
            </header>
            <p className="text-sm leading-relaxed whitespace-pre-line">{kit.instagram_caption}</p>
            <p className="mt-3 text-sm leading-relaxed break-words text-fern">
              {kit.hashtags.map((tag) => `#${tag}`).join(' ')}
            </p>
          </article>

          <article className="rounded-xl border border-line bg-surface-2 p-4">
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">WhatsApp broadcast</h3>
              <CopyButton text={kit.whatsapp_message} />
            </header>
            <div className="max-w-[22rem] rounded-xl rounded-tl-sm bg-mint px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-ink">
              <WhatsAppText text={kit.whatsapp_message} />
            </div>
          </article>

          <article className={`rounded-xl border border-line bg-surface-2 p-4 ${compact ? '' : 'lg:col-span-2'}`}>
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Search result preview</h3>
              <CopyButton text={`${kit.seo_title}\n${kit.seo_description}`} />
            </header>
            <div className="rounded-lg bg-surface p-4">
              <p className="truncate text-xs text-ink-3">
                shop › {category.toLowerCase()} › {slugify(source.title)}
              </p>
              <p className="mt-1 font-serif text-lg leading-snug text-fern">{kit.seo_title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{kit.seo_description}</p>
            </div>
            <p className="mt-2 flex gap-4 text-xs">
              <Counter label="Title" value={kit.seo_title} limit={60} />
              <Counter label="Description" value={kit.seo_description} limit={155} />
            </p>
          </article>
        </div>
      )}
    </section>
  )
}
