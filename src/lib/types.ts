export type Lang = 'zh' | 'en'

interface Row {
  id: string
  user_id?: string
  deleted?: boolean
  updated_at?: string
}

export interface Account extends Row {
  name_zh: string
  name_en: string
  currency: string
  kind: 'spend' | 'save' | 'protected'
  opening: number
  opening_set: boolean
  sort: number
  archived: boolean
}

export interface Category extends Row {
  kind: 'expense' | 'income'
  name_zh: string
  name_en: string
  icon: string
  budget: number
  sort: number
}

export interface Debt extends Row {
  name_zh: string
  name_en: string
  currency: string
  start_balance: number
  planned_monthly: number
  interest: string
  note: string
  sort: number
}

export type EntryKind = 'income' | 'expense' | 'transfer' | 'debt' | 'borrow'

export interface Entry extends Row {
  date: string
  kind: EntryKind
  amount: number
  currency: string
  account_id: string | null
  to_account_id: string | null
  to_amount: number | null
  category_id: string | null
  debt_id: string | null
  note: string
  src: string
  created_at: string
}

export interface FxDay extends Row {
  rates: Record<string, number>
}

export interface Settings extends Row {
  main_currency: string
  lang: Lang
  last_account_id: string | null
  recent_currencies: string[]
}

export type GigStatus = 'quoted' | 'booked' | 'done' | 'paid'
export interface Gig extends Row {
  date: string
  client: string
  job: string
  price: number
  currency: string
  status: GigStatus
  note: string
}

export interface Wish extends Row {
  date: string
  item: string
  price: number
  currency: string
  category_id: string | null
  recheck: string | null
  decision: 'waiting' | 'bought' | 'skipped'
  note: string
}

export interface Recurring extends Row {
  kind: 'income' | 'expense' | 'debt' | 'transfer'
  name_zh: string
  name_en: string
  amount: number
  currency: string
  day: number
  account_id: string | null
  to_account_id: string | null
  category_id: string | null
  debt_id: string | null
  last_done: string | null
  sort: number
}

export type TableName = 'accounts' | 'categories' | 'debts' | 'entries' | 'gigs' | 'wishes' | 'fx_rates' | 'settings' | 'recurring'
