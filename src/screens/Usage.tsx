import { useMemo, useState } from 'react'
import { budgetState, monthSpend } from '../lib/calc'
import { put } from '../lib/db'
import { today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { fmt } from '../lib/money'
import { useData } from '../lib/store'
import { EntryList } from './EntryList'

const shift = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)']

export function Usage({ toast }: { toast: (m: string) => void }) {
  const { t, lang, main, entries, categories, fxVersion } = useData()
  const [month, setMonth] = useState(today().slice(0, 7))
  const [editBudget, setEditBudget] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const { byCat, income, spent } = useMemo(() => monthSpend(entries, month, main), [entries, month, main, fxVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const expenseCats = categories.filter(c => c.kind === 'expense')
  const rows = expenseCats
    .map((c, i) => ({ c, v: byCat.get(c.id) ?? 0, color: PALETTE[i % PALETTE.length] }))
    .sort((a, b) => b.v - a.v)
  const totalBudget = expenseCats.reduce((s, c) => s + c.budget, 0)
  const list = useMemo(() => entries.filter(e => e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)), [entries, month])
  const label = new Date(month + '-01T00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', { year: 'numeric', month: 'long' })

  // Donut: one ring, segments by category share of this month's spending.
  let acc = 0
  const R = 52, C = 2 * Math.PI * R
  const segs = rows.filter(r => r.v > 0).map(r => {
    const len = spent ? (r.v / spent) * C : 0
    const s = { ...r, len, off: acc }
    acc += len
    return s
  })

  async function saveBudgets() {
    for (const c of expenseCats) {
      const v = draft[c.id]
      if (v !== undefined && Number(v) !== c.budget) await put('categories', { ...c, budget: Math.max(0, Number(v) || 0) })
    }
    setEditBudget(false); setDraft({}); toast('✓ ' + t.saveBudget)
  }

  return (
    <>
      <section className="card">
        <div className="month-nav">
          <button type="button" className="ghost" onClick={() => setMonth(shift(month, -1))} aria-label="previous month">‹</button>
          <h2>{label}</h2>
          <button type="button" className="ghost" onClick={() => setMonth(shift(month, 1))} aria-label="next month" disabled={month >= today().slice(0, 7)}>›</button>
        </div>
        <div className="split">
          <div><div className="lbl">{t.income}</div><div className="mid-num num in">{fmt(income, main, lang)}</div></div>
          <div><div className="lbl">{t.spent}</div><div className="mid-num num">{fmt(spent, main, lang)}</div></div>
        </div>
        {totalBudget > 0 && <p className="hint">{t.budget} {fmt(totalBudget, main, lang)} · {t.left} <b className="num">{fmt(totalBudget - spent, main, lang)}</b></p>}
      </section>

      <section className="card">
        <h2>{t.byCategory}</h2>
        {spent > 0 ? (
          <div className="donut-wrap">
            <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={t.byCategory}>
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--rule)" strokeWidth="18" />
              {segs.map(s => (
                <circle key={s.c.id} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="18"
                  strokeDasharray={`${Math.max(s.len - 1.5, 0.5)} ${C}`} strokeDashoffset={-s.off} transform="rotate(-90 70 70)" />
              ))}
              <text x="70" y="66" textAnchor="middle" className="donut-lbl">{t.spent}</text>
              <text x="70" y="84" textAnchor="middle" className="donut-num">{fmt(spent, main, lang).replace(/\.\d\d$/, '')}</text>
            </svg>
          </div>
        ) : <p className="empty">{t.noEntries}</p>}

        <ul className="ledger">
          {rows.map(({ c, v, color }) => {
            const st = budgetState(v, c)
            return (
              <li key={c.id} className="line static">
                <span className="what"><i className="dot" style={{ background: color }} /> {c.icon} {nameOf(c, lang)}
                  {st === 'bad' && <span className="tag bad">{t.over}</span>}
                  {st === 'warn' && <span className="tag warn">{t.nearly}</span>}
                </span>
                <span className="amt num">{fmt(v, main, lang)}{c.budget > 0 && <span className="muted"> / {fmt(c.budget, main, lang).replace(/\.00$/, '')}</span>}</span>
                {c.budget > 0 && <span className="bar"><i className={st} style={{ width: `${Math.min(v / c.budget, 1) * 100}%` }} /></span>}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <h2>{t.editBudget} <small className="muted">{main}</small></h2>
        {!editBudget ? (
          <button type="button" className="ghost" onClick={() => setEditBudget(true)}>{t.edit}</button>
        ) : (
          <>
            <ul className="ledger">
              {expenseCats.map(c => (
                <li key={c.id} className="line static">
                  <label className="what" htmlFor={'b-' + c.id}>{c.icon} {nameOf(c, lang)}</label>
                  <input id={'b-' + c.id} className="num budget-in" inputMode="decimal" defaultValue={c.budget}
                    onChange={e => setDraft(d => ({ ...d, [c.id]: e.target.value }))} />
                </li>
              ))}
            </ul>
            <div className="row2">
              <button type="button" className="ghost" onClick={() => { setEditBudget(false); setDraft({}) }}>{t.cancel}</button>
              <button type="button" className="primary" onClick={saveBudgets}>{t.saveBudget}</button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t.allEntries}</h2>
        <EntryList entries={list} />
      </section>
    </>
  )
}
