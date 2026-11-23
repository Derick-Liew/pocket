import { useState } from 'react'
import { put, softDelete, uid } from '../lib/db'
import { today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { fmt } from '../lib/money'
import { useData } from '../lib/store'
import type { Recurring } from '../lib/types'
import { EntryForm } from './EntryForm'

const thisMonth = () => today().slice(0, 7)

/** Fixed items whose day has come this month and that haven't been logged or skipped yet. */
export function dueItems(items: Recurring[]): Recurring[] {
  const d = new Date()
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return items.filter(r => r.last_done !== thisMonth() && Math.min(r.day, lastDay) <= d.getDate())
}

/** Home-page card: "allowance 到了吗？" — tap to log (amount can be changed) or skip this month. */
export function DueCard({ toast }: { toast: (m: string) => void }) {
  const { t, lang, recurring } = useData()
  const [open, setOpen] = useState<string | null>(null)
  const due = dueItems(recurring)
  if (!due.length) return null

  const done = (r: Recurring) => put('recurring', { ...r, last_done: thisMonth() })

  return (
    <section className="card due">
      <h2>🔔 {t.dueTitle}</h2>
      <ul className="ledger">
        {due.map(r => (
          <li key={r.id}>
            <div className="line static">
              <span className="what">{nameOf(r, lang)}</span>
              <span className={'amt num ' + (r.kind === 'income' ? 'in' : '')}>{fmt(r.amount, r.currency, lang)}</span>
              <span className="meta">{t.dueOn(r.day)}</span>
            </div>
            {open === r.id ? (
              <div className="sub-form">
                <EntryForm lockKind preset={{ kind: r.kind, amount: r.amount, currency: r.currency, account_id: r.account_id, to_account_id: r.to_account_id, category_id: r.category_id, debt_id: r.debt_id, note: nameOf(r, lang) }}
                  onCancel={() => setOpen(null)}
                  onDone={m => { setOpen(null); void done(r); if (m) toast(m) }} />
              </div>
            ) : (
              <div className="line-actions">
                <button type="button" className="ghost" onClick={() => setOpen(r.id)}>{t.logIt}</button>
                <button type="button" className="ghost" onClick={() => void done(r)}>{t.skipMonth}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Settings section: list, add, edit and delete fixed monthly items. */
export function RecurringSettings() {
  const { t, lang, recurring, main, accounts, categories, debts } = useData()
  const [edit, setEdit] = useState<Recurring | null>(null)
  const blank = (): Recurring => ({
    id: uid(), kind: 'expense', name_zh: '', name_en: '', amount: 0, currency: main, day: 1,
    account_id: accounts.find(a => a.kind === 'spend')?.id ?? null, to_account_id: null, category_id: categories.find(c => c.kind === 'expense')?.id ?? null,
    debt_id: null, last_done: thisMonth(), sort: recurring.length + 1,
  })

  function editor(v: Recurring) {
    const set = (p: Partial<Recurring>) => setEdit({ ...v, ...p })
    const cats = categories.filter(c => c.kind === (v.kind === 'income' ? 'income' : 'expense'))
    return (
      <div className="form sub-form">
        <div className="seg">
          {(['expense', 'income', 'transfer', 'debt'] as const).map(k => (
            <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => set({ kind: k })}>{t[k]}</button>
          ))}
        </div>
        <div className="row2">
          <input placeholder={t.nameZh} value={v.name_zh} onChange={e => set({ name_zh: e.target.value })} aria-label={t.nameZh} />
          <input placeholder={t.nameEn} value={v.name_en} onChange={e => set({ name_en: e.target.value })} aria-label={t.nameEn} />
        </div>
        <div className="row2">
          <label><span className="lbl">{t.amount} ({v.currency})</span>
            <input inputMode="decimal" defaultValue={v.amount || ''} onChange={e => set({ amount: Math.max(0, Number(e.target.value) || 0) })} /></label>
          <label><span className="lbl">{t.day}</span>
            <input inputMode="numeric" defaultValue={v.day} onChange={e => set({ day: Math.min(31, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} /></label>
        </div>
        <div className="row2">
          <label><span className="lbl">{v.kind === 'transfer' ? t.from : t.account}</span>
            <select value={v.account_id ?? ''} onChange={e => set({ account_id: e.target.value })}>
              {accounts.map(a => <option key={a.id} value={a.id}>{nameOf(a, lang)}</option>)}
            </select></label>
          {v.kind === 'transfer' ? (
            <label><span className="lbl">{t.to}</span>
              <select value={v.to_account_id ?? ''} onChange={e => set({ to_account_id: e.target.value })}>
                <option value="" disabled>—</option>
                {accounts.filter(a => a.id !== v.account_id).map(a => <option key={a.id} value={a.id}>{nameOf(a, lang)}</option>)}
              </select></label>
          ) : v.kind === 'debt' ? (
            <label><span className="lbl">{t.chooseDebt}</span>
              <select value={v.debt_id ?? ''} onChange={e => set({ debt_id: e.target.value })}>
                <option value="" disabled>—</option>
                {debts.map(d => <option key={d.id} value={d.id}>{nameOf(d, lang)}</option>)}
              </select></label>
          ) : (
            <label><span className="lbl">{t.category}</span>
              <select value={cats.some(c => c.id === v.category_id) ? v.category_id! : ''} onChange={e => set({ category_id: e.target.value })}>
                <option value="" disabled>—</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {nameOf(c, lang)}</option>)}
              </select></label>
          )}
        </div>
        <div className="row2">
          {recurring.some(r => r.id === v.id)
            ? <button type="button" className="ghost danger" onClick={() => { void softDelete('recurring', v.id); setEdit(null) }}>{t.delete}</button>
            : <button type="button" className="ghost" onClick={() => setEdit(null)}>{t.cancel}</button>}
          <button type="button" className="primary" disabled={!(v.amount > 0) || !(v.name_zh.trim() || v.name_en.trim())} onClick={async () => {
            const name_zh = v.name_zh.trim() || v.name_en.trim(), name_en = v.name_en.trim() || name_zh
            await put('recurring', { ...v, name_zh, name_en })
            setEdit(null)
          }}>{t.save}</button>
        </div>
      </div>
    )
  }

  return (
    <section className="card">
      <h2>{t.recurringTitle}</h2>
      <ul className="ledger">
        {recurring.map(r => (
          <li key={r.id}>
            {edit?.id === r.id ? editor(edit) : (
              <button type="button" className="line" onClick={() => setEdit(r)}>
                <span className="what">{nameOf(r, lang)}</span>
                <span className="amt num">{fmt(r.amount, r.currency, lang)}</span>
                <span className="meta">{t.dueOn(r.day)} · {t[r.kind]}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {edit && !recurring.some(r => r.id === edit.id) ? editor(edit)
        : <button type="button" className="ghost" onClick={() => setEdit(blank())}>+ {t.addRecurring}</button>}
    </section>
  )
}
