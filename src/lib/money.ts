import type { Lang } from './types'

const FAVOURITES = ['MYR', 'SGD', 'USD', 'THB', 'JPY', 'CNY', 'TWD', 'HKD', 'KRW', 'IDR', 'EUR', 'GBP', 'AUD']

export function currencyList(known: string[], recent: string[]): string[] {
  let all: string[] = []
  try { all = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('currency') } catch { /* old browser */ }
  const pool = new Set([...known, ...all])
  const head = [...new Set([...recent, ...FAVOURITES])].filter(c => pool.has(c) || FAVOURITES.includes(c))
  const rest = [...pool].filter(c => !head.includes(c) && (!known.length || known.includes(c))).sort()
  return [...head, ...rest]
}

export function currencyName(code: string, lang: Lang) {
  try { return new Intl.DisplayNames([lang === 'zh' ? 'zh-Hans' : 'en'], { type: 'currency' }).of(code) ?? code } catch { return code }
}

export function fmt(amount: number, currency: string, lang: Lang, opts: { sign?: boolean } = {}) {
  if (!Number.isFinite(amount)) return '—'
  try {
    return new Intl.NumberFormat(lang === 'zh' ? 'zh-MY' : 'en-MY', {
      style: 'currency', currency, currencyDisplay: 'narrowSymbol',
      signDisplay: opts.sign ? 'exceptZero' : 'auto',
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export const round2 = (n: number) => Math.round(n * 100) / 100
