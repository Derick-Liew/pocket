import { useMemo, useState } from 'react'
import { balances, debtBalance } from '../lib/calc'
import { put, uid } from '../lib/db'
import { convert, today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { fmt, round2 } from '../lib/money'
import { useData } from '../lib/store'
import type { Debt, Entry } from '../lib/types'
import { EntryForm } from './EntryForm'

/** Months until `left` reaches zero at `monthly`, and the YYYY-MM it lands in. */
function payoff(left: number, monthly: number): { n: number; when: string } | null {
  if (monthly <= 0 || left <= 0) return null
  const n = Math.ceil(left / monthly)
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return { n, when: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
}

export function Debts({ toast }: { toast: (m: string) => void }) {
  const { t, lang, main, debts, entries, accounts, fxVersion } = useData()
  const [repaying, setRepaying] = useState<string | null>(null)
  const [editing, setEditing] = useState<Debt | null>(null)

  const rows = useMemo(() => debts.map(d => ({ d, left: debtBalance(d, entries) })), [debts, entries, fxVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = rows.reduce((s, r) => s + convert(Math.max(r.left, 0), r.d.currency, main, today()), 0)
  const history = useMemo(() => entries.filter(e => e.debt_id && (e.kind === 'debt' || e.kind === 'borrow'))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15), [entries])

  return (
    <>
      <section className="card">
        <h2>{t.debts} <small className="num">{t.debtLeft} {fmt(total, main, lang)}</small></h2>
        <ul className="ledger">
          {rows.map(({ d, left }) => {
            const frac = d.start_balance > 0 ? Math.max(0, Math.min(1 - left / d.start_balance, 1)) : 0
            const p = payoff(left, d.planned_monthly)
            return (
              <li key={d.id}>
                {editing?.id === d.id ? <DebtEditor value={editing} onClose={() => setEditing(null)} /> : (
                  <>
                    <div className="line static">
                      <span className="what">{nameOf(d, lang)} {d.interest && <span className="muted">· {d.interest}</span>}</span>
                      <span className="amt num">{left <= 0 ? <span className="tag ok">{t.cleared}</span> : fmt(left, d.currency, lang)}</span>
                      {d.start_balance > 0 && left > 0 && d.planned_monthly > 0 && <span className="bar"><i style={{ width: `${frac * 100}%` }} /></span>}
                      <span className="meta">
                        {left > 0 && (p ? t.monthsToClear(p.n, p.when) : t.notStarted)}
                        {left > 0 && frac > 0 && ` · ${t.paidPct(Math.round(frac * 100))}`}
                      </span>
                    </div>
                    {repaying === d.id ? (
                      <div className="sub-form">
                        <EntryForm lockKind preset={{ kind: 'debt', debt_id: d.id, amount: d.planned_monthly || undefined, currency: d.currency }}
                          onCancel={() => setRepaying(null)} onDone={m => { setRepaying(null); if (m) toast(m) }} />
                      </div>
                    ) : (
                      <div className="line-actions">
                        {left > 0 && <button type="button" className="ghost" onClick={() => setRepaying(d.id)}>{t.repay}</button>}
                        <button type="button" className="ghost" onClick={() => setEditing(d)}>{t.edit}</button>
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {editing && !debts.some(d => d.id === editing.id)
          ? <DebtEditor value={editing} onClose={() => setEditing(null)} />
          : <button type="button" className="ghost" onClick={() => setEditing({
              id: uid(), name_zh: '', name_en: '', currency: main, start_balance: 0, planned_monthly: 0, interest: '', note: '', sort: debts.length + 1,
            })}>+ {t.addDebt}</button>}
      </section>

      <Ptptn toast={toast} accounts={accounts} />

      {history.length > 0 && (
        <section className="card">
          <h2>{t.recent}</h2>
          <ul className="ledger">
            {history.map(e => {
              const d = debts.find(x => x.id === e.debt_id)
              return (
                <li key={e.id} className="line static">
                  <span className="what">{e.kind === 'debt' ? t.repay : t.borrowMore} · {d ? nameOf(d, lang) : ''}</span>
                  <span className={'amt num ' + (e.kind === 'debt' ? 'in' : '')}>{e.kind === 'debt' ? '−' : '+'}{fmt(e.amount, e.currency, lang)}</span>
                  <span className="meta">{e.date}{e.note && ` · ${e.note}`}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

function DebtEditor({ value, onClose }: { value: Debt; onClose: () => void }) {
  const { t } = useData()
  const [v, setV] = useState(value)
  const num = (s: string) => Math.max(0, Number(s) || 0)
  return (
    <div className="form sub-form">
      <div className="row2">
        <input placeholder={t.nameZh} value={v.name_zh} onChange={e => setV({ ...v, name_zh: e.target.value })} aria-label={t.nameZh} />
        <input placeholder={t.nameEn} value={v.name_en} onChange={e => setV({ ...v, name_en: e.target.value })} aria-label={t.nameEn} />
      </div>
      <div className="row2">
        <label><span className="lbl">{t.startBalance} ({v.currency})</span>
          <input inputMode="decimal" defaultValue={v.start_balance || ''} onChange={e => setV({ ...v, start_balance: num(e.target.value) })} /></label>
        <label><span className="lbl">{t.plannedMonthly}</span>
          <input inputMode="decimal" defaultValue={v.planned_monthly || ''} onChange={e => setV({ ...v, planned_monthly: num(e.target.value) })} /></label>
      </div>
      <label><span className="lbl">{t.interest}</span>
        <input value={v.interest} onChange={e => setV({ ...v, interest: e.target.value })} /></label>
      <div className="row2">
        <button type="button" className="ghost" onClick={onClose}>{t.cancel}</button>
        <button type="button" className="primary" disabled={!v.name_zh.trim() && !v.name_en.trim()} onClick={async () => {
          const name_zh = v.name_zh.trim() || v.name_en.trim(), name_en = v.name_en.trim() || name_zh
          await put('debts', { ...v, name_zh, name_en })
          onClose()
        }}>{t.save}</button>
      </div>
    </div>
  )
}

/** PTPTN arrives: debt goes up by the full amount, fees paid from the PTPTN account, needs moved to the bank, rest stays put. */
function Ptptn({ toast, accounts }: { toast: (m: string) => void; accounts: ReturnType<typeof useData>['accounts'] }) {
  const { t, lang, debts, categories, entries } = useData()
  const pot = accounts.find(a => a.kind === 'protected')
  const bank = accounts.find(a => a.kind === 'spend')
  const debt = debts.find(d => d.id === 'ptptn') ?? debts.find(d => /ptptn/i.test(d.name_en))
  const [amount, setAmount] = useState('7200')
  const [fees, setFees] = useState('')
  const [needs, setNeeds] = useState('')
  const [why, setWhy] = useState('')
  const a = Number(amount) || 0, f = Number(fees) || 0, n = Number(needs) || 0
  const stays = round2(a - f - n)
  const cur = pot?.currency ?? 'MYR'

  async function save() {
    if (!pot || !bank || a <= 0 || stays < 0) return
    const date = today(), now = new Date().toISOString()
    const n0 = entries.filter(e => e.kind === 'borrow' && e.debt_id === debt?.id).length + 2 // #1 is the starting balance
    const base = { date, currency: cur, src: 'phone', created_at: now, to_account_id: null, to_amount: null, category_id: null, debt_id: null } as const
    const rows: Entry[] = [
      { ...base, id: uid(), kind: 'borrow', amount: a, account_id: pot.id, debt_id: debt?.id ?? null, note: `PTPTN #${n0}` },
    ]
    if (f > 0) {
      let fee = categories.find(c => c.id === 'fees')
      if (!fee) {
        fee = { id: 'fees', kind: 'expense', name_zh: '学费', name_en: 'Fees', icon: '🎓', budget: 0, sort: 30 }
        await put('categories', fee)
      }
      rows.push({ ...base, id: uid(), kind: 'expense', amount: f, account_id: pot.id, category_id: fee.id, note: `PTPTN #${n0}` })
    }
    if (n > 0) rows.push({ ...base, id: uid(), kind: 'transfer', amount: n, account_id: pot.id, to_account_id: bank.id, to_amount: n, note: why.trim() || `PTPTN #${n0}` })
    for (const r of rows) await put('entries', r)
    setFees(''); setNeeds(''); setWhy('')
    toast(`✓ PTPTN ${fmt(a, cur, lang)} · ${t.ptptnStays} ${fmt(stays, cur, lang)}`)
  }

  return (
    <section className="card form">
      <h2>{t.ptptnTitle}</h2>
      <p className="hint">{t.ptptnHint}</p>
      {!pot ? <p className="err">{t.ptptnNoAccount}</p> : (
        <>
          <div className="row2">
            <label><span className="lbl">{t.ptptnAmount}</span><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label><span className="lbl">{t.fees}</span><input inputMode="decimal" placeholder="0" value={fees} onChange={e => setFees(e.target.value)} /></label>
          </div>
          <div className="row2">
            <label><span className="lbl">{t.needs}</span><input inputMode="decimal" placeholder="0" value={needs} onChange={e => setNeeds(e.target.value)} /></label>
            <label><span className="lbl">{t.needsWhy}</span><input value={why} onChange={e => setWhy(e.target.value)} /></label>
          </div>
          <p className={stays < 0 ? 'err' : 'hint'}>
            {stays < 0 ? t.ptptnTooMuch : <>→ {t.ptptnStays} <b className="num">{fmt(stays, cur, lang)}</b> · {nameOf(pot, lang)} → {fmt((balances([pot], entries).get(pot.id) ?? 0) + stays, cur, lang)}</>}
          </p>
          <button type="button" className="primary" disabled={a <= 0 || stays < 0} onClick={save}>{t.ptptnSave}</button>
        </>
      )}
    </section>
  )
}
