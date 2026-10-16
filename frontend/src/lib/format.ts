const locale = import.meta.env.VITE_LOCALE || 'en-IN'
const currency = import.meta.env.VITE_CURRENCY || 'INR'

const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 })
const wholeMoney = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 })
const number = new Intl.NumberFormat(locale)
const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
const dayWithYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })

export const currencySymbol = money.formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '—'
  return Number.isInteger(value) ? wholeMoney.format(value) : money.format(value)
}

export function formatMoneyCompact(value: number): string {
  return wholeMoney.format(Math.round(value))
}

export function formatCount(value: number): string {
  return number.format(value)
}

const thisYear = new Date().getFullYear()

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.getFullYear() === thisYear ? day.format(date) : dayWithYear.format(date)
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`
}
