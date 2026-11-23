import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { live } from './calc'
import { db, put } from './db'
import { loadFx } from './fx'
import { strings, type Strings } from './i18n'
import type { Account, Category, Debt, Entry, Lang, Settings } from './types'

export interface Data {
  ready: boolean
  accounts: Account[]
  categories: Category[]
  debts: Debt[]
  entries: Entry[]
  settings: Settings
  lang: Lang
  main: string
  t: Strings
  fxVersion: number
  saveSettings: (patch: Partial<Settings>) => Promise<void>
}

const phoneLang = (): Lang => (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
const defaults = (): Settings => ({ id: 'main', main_currency: 'MYR', lang: phoneLang(), last_account_id: null, recent_currencies: [] })

const Ctx = createContext<Data | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const accounts = useLiveQuery(() => db.accounts.toArray())
  const categories = useLiveQuery(() => db.categories.toArray())
  const debts = useLiveQuery(() => db.debts.toArray())
  const entries = useLiveQuery(() => db.entries.toArray())
  const stored = useLiveQuery(() => db.settings.get('main'), [], null)
  const [fxVersion, setFxVersion] = useState(0)

  useEffect(() => {
    const bump = () => { void loadFx().then(() => setFxVersion(v => v + 1)) }
    bump()
    window.addEventListener('pocket:fx', bump)
    window.addEventListener('pocket:synced', bump)
    return () => { window.removeEventListener('pocket:fx', bump); window.removeEventListener('pocket:synced', bump) }
  }, [])

  const value = useMemo<Data>(() => {
    const settings = { ...defaults(), ...(stored ?? {}) } as Settings
    return {
      ready: accounts !== undefined && entries !== undefined && stored !== null,
      accounts: live(accounts).filter(a => !a.archived),
      categories: live(categories),
      debts: live(debts),
      entries: (entries ?? []).filter(e => !e.deleted),
      settings,
      lang: settings.lang,
      main: settings.main_currency,
      t: strings[settings.lang],
      fxVersion,
      saveSettings: patch => put('settings', { ...settings, ...patch }),
    }
  }, [accounts, categories, debts, entries, stored, fxVersion])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): Data {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}
