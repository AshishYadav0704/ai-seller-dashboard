interface Option<T extends string> {
  value: T
  label: string
  count?: number
}

interface Props<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}

export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-1.5 rounded-md font-medium transition-colors ${
              size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3 text-sm'
            } ${active ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]' : 'text-ink-2 hover:text-ink'}`}
          >
            {option.label}
            {option.count != null && (
              <span className={`tabular text-xs ${active ? 'text-ink-2' : 'text-ink-3'}`}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
