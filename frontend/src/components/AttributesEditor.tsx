import type { Attribute } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  attributes: Attribute[]
  onChange: (attributes: Attribute[]) => void
  disabled?: boolean
}

const MAX = 10

export function AttributesEditor({ attributes, onChange, disabled = false }: Props) {
  function update(index: number, patch: Partial<Attribute>) {
    onChange(attributes.map((attribute, i) => (i === index ? { ...attribute, ...patch } : attribute)))
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="label">Details</legend>
      {attributes.length > 0 && (
        <ul className="mb-2 space-y-2">
          {attributes.map((attribute, index) => (
            <li key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
              <input
                aria-label="Detail name"
                value={attribute.name}
                maxLength={30}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Material"
                className="input"
              />
              <input
                aria-label="Detail value"
                value={attribute.value}
                maxLength={80}
                onChange={(event) => update(index, { value: event.target.value })}
                placeholder="Cotton canvas"
                className="input"
              />
              <button
                type="button"
                onClick={() => onChange(attributes.filter((_, i) => i !== index))}
                className="btn btn-ghost px-2.5"
                aria-label={`Remove ${attribute.name || 'detail'}`}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {attributes.length < MAX && (
        <button
          type="button"
          onClick={() => onChange([...attributes, { name: '', value: '' }])}
          className="btn btn-ghost btn-sm -ml-2 text-fern"
        >
          <Icon name="plus" className="size-3.5" />
          Add a detail
        </button>
      )}
    </fieldset>
  )
}
