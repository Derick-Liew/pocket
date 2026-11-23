import { useMemo, useState } from 'react'
import { db, put, uid } from '../lib/db'
import { knownCurrencies } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { currencyList, currencyName } from '../lib/money'
import { useData } from '../lib/store'
import { supabase } from '../lib/supabase'
import { clearLocal } from '../lib/sync'
import { RecurringSettings } from './Recurring'
import type { Account } from '../lib/types'

const KIND_LABEL = { zh: { spend: '可以花', save: '存款', protected: '受保护' }, en: { spend: 'Spendable', save: 'Savings', protected: 'Protected' } }

export function Settings({ onClose }: { onClose: () => void }) {
  const { t, lang, main, accounts, settings, saveSettings } = useData()
  const currencies = useMemo(() => currencyList(knownCurrencies(), settings.recent_currencies ?? []), [settings.recent_currencies])
  const [edit, setEdit] = useState<Account | null>(null)

  async function exportCsv() {
    const [entries, accs, cats, debts] = await Promise.all([db.entries.toArray(), db.accounts.toArray(), db.categories.toArray(), db.debts.toArray()])
    const name = (list: { id: string; name_zh: string; name_en: string }[], id: string | null) => { const x = list.find(r => r.id === id); return x ? nameOf(x, lang) : '' }
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [['date', 'kind', 'amount', 'currency', 'account', 'to_account', 'to_amount', 'category', 'debt', 'note'].join(',')]
    for (const e of entries.filter(x => !x.deleted).sort((a, b) => a.date.localeCompare(b.date))) {
      lines.push([e.date, e.kind, e.amount, e.currency, name(accs, e.account_id), name(accs, e.to_account_id), e.to_amount ?? '', name(cats, e.category_id), name(debts, e.debt_id), e.note].map(q).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pocket-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    await clearLocal()
    location.reload()
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t.settings}>
      <header className="sheet-head">
        <h2>{t.settings}</h2>
        <button type="button" className="ghost" onClick={onClose}>{t.done}</button>
      </header>

      <section className="card form">
        <label><span className="lbl">{t.language}</span>
          <div className="seg">
            <button type="button" aria-pressed={lang === 'zh'} onClick={() => saveSettings({ lang: 'zh' })}>中文</button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => saveSettings({ lang: 'en' })}>English</button>
          </div>
        </label>
        <label><span className="lbl">{t.mainCurrency}</span>
          <select value={main} onChange={e => saveSettings({ main_currency: e.target.value })}>
            {currencies.map(c => <option key={c} value={c}>{c} · {currencyName(c, lang)}</option>)}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>{t.accounts}</h2>
        <ul className="ledger">
          {accounts.map(a => (
            <li key={a.id}>
              {edit?.id === a.id ? (
                <AccountEditor value={edit} onChange={setEdit} currencies={currencies} />
              ) : (
                <button type="button" className="line" onClick={() => setEdit(a)}>
                  <span className="what">{nameOf(a, lang)}</span>
                  <span className="amt muted">{a.currency} · {KIND_LABEL[lang][a.kind]}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="ghost" onClick={() => setEdit({
          id: uid(), name_zh: '新户口', name_en: 'New account', currency: main, kind: 'spend',
          opening: 0, opening_set: false, sort: accounts.length + 1, archived: false,
        })}>+ {t.accounts}</button>
        {edit && !accounts.some(a => a.id === edit.id) && (
          <div style={{ marginTop: 12 }}><AccountEditor value={edit} onChange={setEdit} currencies={currencies} /></div>
        )}
      </section>

      <RecurringSettings />

      <section className="card form">
        <button type="button" className="ghost" onClick={exportCsv}>{t.exportCsv}</button>
        <button type="button" className="ghost danger" onClick={signOut}>{t.signOut}</button>
      </section>
    </div>
  )
}

function AccountEditor({ value, onChange, currencies }: { value: Account; onChange: (a: Account | null) => void; currencies: string[] }) {
  const { t, lang } = useData()
  return (
    <div className="form">
      <div className="row2">
        <input value={value.name_zh} onChange={e => onChange({ ...value, name_zh: e.target.value })} aria-label="中文名" />
        <input value={value.name_en} onChange={e => onChange({ ...value, name_en: e.target.value })} aria-label="English name" />
      </div>
      <div className="row2">
        <select value={value.currency} onChange={e => onChange({ ...value, currency: e.target.value })} aria-label={t.mainCurrency}>
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={value.kind} onChange={e => onChange({ ...value, kind: e.target.value as Account['kind'] })} aria-label={t.account}>
          {(['spend', 'save', 'protected'] as const).map(k => <option key={k} value={k}>{KIND_LABEL[lang][k]}</option>)}
        </select>
      </div>
      <div className="row2">
        <button type="button" className="ghost" onClick={() => onChange(null)}>{t.cancel}</button>
        <button type="button" className="primary" onClick={async () => { await put('accounts', value); onChange(null) }}>{t.save}</button>
      </div>
    </div>
  )
}
