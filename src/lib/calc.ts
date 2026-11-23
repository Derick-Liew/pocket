import { convert } from './fx'
import type { Account, Category, Debt, Entry } from './types'

/** How an entry changes one account's balance, in that account's currency. */
export function effectOn(e: Entry, acc: Account): number {
  if (e.deleted) return 0
  let d = 0
  if (e.account_id === acc.id) {
    const amt = convert(e.amount, e.currency, acc.currency, e.date)
    if (e.kind === 'income' || e.kind === 'borrow') d += amt
    else d -= amt // expense, transfer out, debt repayment
  }
  if (e.kind === 'transfer' && e.to_account_id === acc.id) {
    d += e.to_amount ?? convert(e.amount, e.currency, acc.currency, e.date)
  }
  return d
}

export function balances(accounts: Account[], entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of accounts) {
    let b = a.opening
    for (const e of entries) b += effectOn(e, a)
    m.set(a.id, b)
  }
  return m
}

export function debtBalance(debt: Debt, entries: Entry[]): number {
  let b = debt.start_balance
  for (const e of entries) {
    if (e.deleted || e.debt_id !== debt.id) continue
    const amt = convert(e.amount, e.currency, debt.currency, e.date)
    if (e.kind === 'debt') b -= amt
    if (e.kind === 'borrow') b += amt
  }
  return b
}

export function monthSpend(entries: Entry[], month: string, main: string) {
  const byCat = new Map<string, number>()
  let income = 0, spent = 0
  for (const e of entries) {
    if (e.deleted || !e.date.startsWith(month)) continue
    const v = convert(e.amount, e.currency, main, e.date)
    if (e.kind === 'expense') {
      spent += v
      const k = e.category_id ?? 'other'
      byCat.set(k, (byCat.get(k) ?? 0) + v)
    } else if (e.kind === 'income') income += v
  }
  return { byCat, income, spent }
}

export function budgetState(spent: number, cat: Category): 'ok' | 'warn' | 'bad' | 'none' {
  if (!cat.budget) return 'none'
  const f = spent / cat.budget
  return f > 1 ? 'bad' : f > 0.85 ? 'warn' : 'ok'
}

export const live = <T extends { deleted?: boolean; sort?: number }>(rows: T[] | undefined) =>
  (rows ?? []).filter(r => !r.deleted).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
