import { db, put } from './db'
import type { FxDay } from './types'

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let days: FxDay[] = [] // sorted by id (date) ascending

export async function loadFx() {
  days = (await db.fx_rates.toArray()).filter(d => !d.deleted).sort((a, b) => a.id.localeCompare(b.id))
}

/** Fetch today's rates once a day (when online) and keep them as that day's row. */
export async function refreshFx() {
  const day = today()
  if (days.some(d => d.id === day) || !navigator.onLine) return
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const json = await res.json()
    if (json.result !== 'success') return
    await put('fx_rates', { id: day, rates: json.rates as Record<string, number> })
    await loadFx()
    window.dispatchEvent(new Event('pocket:fx'))
  } catch { /* offline or blocked: keep using the last saved day */ }
}

/** The rates in force on `date`: that day's row, else the nearest earlier one, else the earliest we have. */
function ratesOn(date: string): Record<string, number> | null {
  if (!days.length) return null
  let pick = days[0]
  for (const d of days) { if (d.id <= date) pick = d; else break }
  return pick.rates
}

export function convert(amount: number, from: string, to: string, date: string): number {
  if (from === to || !amount) return amount
  const r = ratesOn(date)
  if (!r || !r[from] || !r[to]) return NaN
  return (amount / r[from]) * r[to]
}

export const hasRates = () => days.length > 0
export const knownCurrencies = () => Object.keys(days[days.length - 1]?.rates ?? {})
