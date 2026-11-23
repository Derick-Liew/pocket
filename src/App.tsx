import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { db, put } from './lib/db'
import seed from './lib/seed.json'
import { refreshFx } from './lib/fx'
import { DataProvider, useData } from './lib/store'
import { configured, supabase } from './lib/supabase'
import { onSyncState, startAutoSync, sync, type SyncState } from './lib/sync'
import type { Account, Category } from './lib/types'
import { FirstRun } from './screens/FirstRun'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Settings } from './screens/Settings'
import { Usage } from './screens/Usage'

type Tab = 'home' | 'usage' | 'debts' | 'want' | 'jobs'
const TABS: { id: Tab; icon: string; key: 'tabHome' | 'tabUsage' | 'tabDebts' | 'tabWant' | 'tabJobs' }[] = [
  { id: 'home', icon: '👛', key: 'tabHome' },
  { id: 'usage', icon: '📊', key: 'tabUsage' },
  { id: 'debts', icon: '🧾', key: 'tabDebts' },
  { id: 'want', icon: '🛍️', key: 'tabWant' },
  { id: 'jobs', icon: '📷', key: 'tabJobs' },
]

/** Default accounts and categories for a brand-new user (same ids the migration uses). Debts are personal, so none by default. */
async function seedIfEmpty() {
  if (await db.accounts.count()) return
  for (const a of seed.accounts) await put('accounts', { ...a, opening: 0, opening_set: false, archived: false } as Account)
  for (const c of seed.categories) await put('categories', c as Category)
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    startAutoSync()
    // First sync decides whether this is a brand-new account that needs the defaults.
    void sync().then(async () => {
      if (navigator.onLine && !(await db.meta.get('seeded'))) {
        await seedIfEmpty()
        await db.meta.put({ key: 'seeded', value: true })
      }
      void refreshFx()
    })
  }, [session])

  if (!configured) return <main className="login"><p>Supabase is not set up yet — see README.md.</p></main>
  if (session === undefined) return null
  if (!session) return <Login />
  return <DataProvider><Shell /></DataProvider>
}

function Shell() {
  const { t, lang, ready, accounts } = useData()
  const [tab, setTab] = useState<Tab>(() => (TABS.some(x => x.id === location.hash.slice(1)) ? location.hash.slice(1) as Tab : 'home'))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => onSyncState(setSyncState), [])
  useEffect(() => { history.replaceState(null, '', '#' + tab); window.scrollTo(0, 0) }, [tab])
  useEffect(() => { document.title = t.appName; document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en' }, [t, lang])
  const toast = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2400) }, [])

  const needsBalances = accounts.some(a => !a.opening_set)
  const status = syncState === 'syncing' ? t.syncing : syncState === 'offline' ? t.offline : syncState === 'error' ? t.syncError : ''

  return (
    <>
      <header className="top">
        <h1>{t.appName}</h1>
        <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label={t.settings}>⚙︎</button>
      </header>
      {status && <p className="status" role="status">{status}</p>}

      <main className="wrap">
        {!ready ? null : needsBalances && tab === 'home' ? <FirstRun /> : (
          tab === 'home' ? <Home toast={toast} /> :
          tab === 'usage' ? <Usage toast={toast} /> :
          <section className="card"><p className="empty">{t.comingPhase2}</p></section>
        )}
      </main>

      <nav className="tabs" aria-label="tabs">
        {TABS.map(x => (
          <button key={x.id} type="button" aria-current={tab === x.id ? 'page' : undefined} onClick={() => setTab(x.id)}>
            <span aria-hidden className="tab-icon">{x.icon}</span>{t[x.key]}
          </button>
        ))}
      </nav>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  )
}
