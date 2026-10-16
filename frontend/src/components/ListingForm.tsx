import { useId } from 'react'
import { currencySymbol } from '../lib/format'
import type { ListingErrors, ListingValues } from '../lib/listing'
import type { CategoryOption, Status } from '../lib/types'
import { AttributesEditor } from './AttributesEditor'
import { Segmented } from './Segmented'
import { TagInput } from './TagInput'

interface Props {
  values: ListingValues
  errors: ListingErrors
  onChange: (patch: Partial<ListingValues>) => void
  categories: CategoryOption[]
  /** The writer is filling in title, category, description, tags and details. */
  drafting?: boolean
  disabled?: boolean
  showStatus?: boolean
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-[13px] text-danger">
      {message}
    </p>
  )
}

function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />
}

export function ListingForm({
  values,
  errors,
  onChange,
  categories,
  drafting = false,
  disabled = false,
  showStatus = false,
}: Props) {
  const id = useId()
  const field = (name: string) => `${id}-${name}`

  return (
    <div className="space-y-5" aria-busy={drafting}>
      <div>
        <label htmlFor={field('title')} className="label">
          Title
        </label>
        {drafting ? (
          <Skeleton className="h-[42px]" />
        ) : (
          <input
            id={field('title')}
            value={values.title}
            onChange={(event) => onChange({ title: event.target.value })}
            maxLength={120}
            disabled={disabled}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? field('title-error') : undefined}
            placeholder="Olive canvas tote bag with inner pocket"
            className="input font-medium"
          />
        )}
        <FieldError id={field('title-error')} message={errors.title} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={field('category')} className="label">
            Category
          </label>
          {drafting ? (
            <Skeleton className="h-[42px]" />
          ) : (
            <select
              id={field('category')}
              value={values.category}
              onChange={(event) => onChange({ category: event.target.value })}
              disabled={disabled}
              aria-invalid={Boolean(errors.category)}
              className="input appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a887f' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              }}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          )}
          <FieldError id={field('category-error')} message={errors.category} />
        </div>

        <div>
          <label htmlFor={field('sku')} className="label">
            SKU <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <input
            id={field('sku')}
            value={values.sku}
            onChange={(event) => onChange({ sku: event.target.value.toUpperCase() })}
            maxLength={32}
            disabled={disabled}
            aria-invalid={Boolean(errors.sku)}
            placeholder="Generated if left blank"
            className="input tabular uppercase placeholder:normal-case"
          />
          <FieldError id={field('sku-error')} message={errors.sku} />
        </div>

        <div>
          <label htmlFor={field('price')} className="label">
            Price
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">
              {currencySymbol}
            </span>
            <input
              id={field('price')}
              value={values.price}
              onChange={(event) => onChange({ price: event.target.value })}
              inputMode="decimal"
              disabled={disabled}
              aria-invalid={Boolean(errors.price)}
              placeholder="0"
              className="input tabular pl-8"
            />
          </div>
          <FieldError id={field('price-error')} message={errors.price} />
        </div>

        <div>
          <label htmlFor={field('stock')} className="label">
            Units in stock
          </label>
          <input
            id={field('stock')}
            value={values.stock}
            onChange={(event) => onChange({ stock: event.target.value })}
            inputMode="numeric"
            disabled={disabled}
            aria-invalid={Boolean(errors.stock)}
            placeholder="Not tracked"
            className="input tabular"
          />
          <FieldError id={field('stock-error')} message={errors.stock} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={field('description')} className="label">
            Description
          </label>
          <span className="tabular text-xs text-ink-3">{values.description.length}/2000</span>
        </div>
        {drafting ? (
          <Skeleton className="h-[118px]" />
        ) : (
          <textarea
            id={field('description')}
            value={values.description}
            onChange={(event) => onChange({ description: event.target.value })}
            maxLength={2000}
            rows={4}
            disabled={disabled}
            placeholder="What it is, who it's for, and one detail that makes it worth buying."
            className="input resize-y leading-relaxed"
          />
        )}
      </div>

      {drafting ? (
        <Skeleton className="h-[42px]" />
      ) : (
        <TagInput tags={values.tags} onChange={(tags) => onChange({ tags })} disabled={disabled} />
      )}

      {!drafting && (
        <AttributesEditor
          attributes={values.attributes}
          onChange={(attributes) => onChange({ attributes })}
          disabled={disabled}
        />
      )}

      {showStatus && (
        <div>
          <span className="label">Status</span>
          <Segmented<Status>
            label="Status"
            value={values.status}
            onChange={(status) => onChange({ status })}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      )}
    </div>
  )
}
