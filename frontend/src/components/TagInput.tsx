import { useId, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  max?: number
}

function normalise(raw: string) {
  return raw.replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 32)
}

export function TagInput({ tags, onChange, disabled = false, max = 15 }: Props) {
  const id = useId()
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const additions = raw.split(',').map(normalise).filter(Boolean)
    const next = [...tags]
    for (const tag of additions) if (!next.includes(tag)) next.push(tag)
    onChange(next.slice(0, max))
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label">
        Search tags{' '}
        <span className="font-normal text-ink-3">
          ({tags.length}/{max})
        </span>
      </label>
      <div className="input flex min-h-[42px] flex-wrap items-center gap-1.5 py-1.5 focus-within:border-fern">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-mint py-0.5 pr-1 pl-2 text-[13px] text-ink"
          >
            {tag}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="rounded p-0.5 text-ink-2 hover:bg-surface hover:text-ink"
              aria-label={`Remove ${tag}`}
            >
              <Icon name="close" className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || tags.length >= max}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={tags.length ? '' : 'Type a tag and press Enter'}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-[15px] outline-none placeholder:text-ink-3"
        />
      </div>
    </div>
  )
}
