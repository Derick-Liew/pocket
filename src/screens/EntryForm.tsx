import { useEffect, useMemo, useState } from 'react'
import { put, uid } from '../lib/db'
import { convert, knownCurrencies, today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { currencyList, currencyName, fmt, round2 } from '../lib/money'
import { useData } from '../lib/store'
import type { Entry, EntryKind } from '../lib/types'

const KINDS = ['expense', 'income', 'transfer', 'debt'] as const

interface Props {
  editing?: Entry | null
  /** Starting values for a new entry (e.g. "repay this debt"). Ignored when editing. */
  preset?: Partial<Entry>
  /** Hide the kind switch (when the caller fixed the kind). */
  lockKind?: boolean
  onDone?: (msg?: string) => void
  onCancel?: () => void
}

export function EntryForm({ editing, preset, lockKind, onDone, onCancel }: Props) {
  const { t, lang, accounts, categories, debts, settings, saveSettings, main } = useData()
  const init: Partial<Entry> | undefined = editing ?? preset
  const [kind, setKind] = useState<EntryKind>(init?.kind ?? 'expense')
  const [amount, setAmount] = useState(init?.amount ? String(init.amount) : '')
  const [accountId, setAccountId] = useState(init?.account_id ?? settings.last_account_id ?? accounts[0]?.id ?? '')
  const acc = accounts.find(a => a.id === accountId)
  const [currency, setCurrency] = useState(init?.currency ?? acc?.currency ?? main)
  const [toAccountId, setToAccountId] = useState(init?.to_account_id ?? '')
  const [categoryId, setCategoryId] = useState(init?.category_id ?? '')
  const [debtId, setDebtId] = useState(init?.debt_id ?? '')
  const [note, setNote] = useState(init?.note ?? '')
  const [date, setDate] = useState(init?.date ?? today())
  const [err, setErr] = useState('')

  // Default account once data has loaded.
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(settings.last_account_id && accounts.some(a => a.id === settings.last_account_id) ? settings.last_account_id : accounts[0].id)
  }, [accounts, accountId, settings.last_account_id])

  const cats = categories.filter(c => c.kind === (kind === 'income' ? 'income' : 'expense'))
  useEffect(() => {
    if ((kind === 'expense' || kind === 'income') && !cats.some(c => c.id === categoryId)) setCategoryId(cats[0]?.id ?? '')
    if (kind === 'debt' && !debts.some(d => d.id === debtId)) setDebtId(debts[0]?.id ?? '')
    if (kind === 'transfer' && (!toAccountId || toAccountId === accountId)) setToAccountId(accounts.find(a => a.id !== accountId)?.id ?? '')
  }, [kind, cats, categoryId, debts, debtId, accounts, accountId, toAccountId])

  const currencies = useMemo(() => currencyList(knownCurrencies(), settings.recent_currencies ?? []), [settings.recent_currencies])
  const toAcc = accounts.find(a => a.id === toAccountId)
  const value = parseFloat(amount)
  const transferCur = kind === 'transfer' ? acc?.currency ?? currency : currency
  const landing = kind === 'transfer' && toAcc && value > 0 ? convert(value, transferCur, toAcc.currency, date) : null

  function pickAccount(id: string) {
    setAccountId(id)
    const a = accounts.find(x => x.id === id)
    if (a && !editing) setCurrency(a.currency)
  }

  async function submit() {
    setErr('')
    if (!(value > 0)) return setErr(t.needAmount)
    if (kind === 'transfer' && toAccountId === accountId) return setErr(t.sameAccount)
    if (acc?.kind === 'protected' && kind !== 'income' && !window.confirm(t.protectedWarn)) return
    const cur = kind === 'transfer' ? transferCur : currency
    const row: Entry = {
      id: editing?.id ?? uid(),
      date,
      kind,
      amount: round2(value),
      currency: cur,
      account_id: accountId,
      to_account_id: kind === 'transfer' ? toAccountId : null,
      to_amount: kind === 'transfer' && landing != null && Number.isFinite(landing) ? round2(landing) : null,
      category_id: kind === 'expense' || kind === 'income' ? categoryId : null,
      debt_id: kind === 'debt' ? debtId : null,
      note: note.trim(),
      src: editing?.src ?? 'phone',
      created_at: editing?.created_at ?? new Date().toISOString(),
    }
    await put('entries', row)
    const recent = [cur, ...(settings.recent_currencies ?? []).filter(c => c !== cur)].slice(0, 6)
    if (settings.last_account_id !== accountId || recent.join() !== (settings.recent_currencies ?? []).join()) {
      await saveSettings({ last_account_id: accountId, recent_currencies: recent })
    }
    if (!editing) { setAmount(''); setNote(''); setDate(today()) }
    onDone?.(`✓ ${t.saved} ${fmt(row.amount, cur, lang)}`)
  }

  return (
    <div className="form">
      {!lockKind && (
        <div className="seg" role="group" aria-label={t.addEntry}>
          {KINDS.map(k => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{t[k]}</button>
          ))}
        </div>
      )}

      <div className="amount">
        {kind === 'transfer'
          ? <span className="cur-static">{transferCur}</span>
          : (
            <select className="cur" value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t.mainCurrency}>
              {currencies.map(c => <option key={c} value={c} label={c}>{c} · {currencyName(c, lang)}</option>)}
            </select>
          )}
        <input inputMode="decimal" placeholder="0.00" value={amount} aria-label={t.amount}
          onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
      </div>

      {(kind === 'expense' || kind === 'income') && (
        <div className="chips" role="group" aria-label={t.category}>
          {cats.map(c => (
            <button key={c.id} type="button" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              <span aria-hidden>{c.icon}</span> {nameOf(c, lang)}
            </button>
          ))}
        </div>
      )}

      {kind === 'debt' && (
        <div className="chips" role="group" aria-label={t.chooseDebt}>
          {debts.map(d => (
            <button key={d.id} type="button" aria-pressed={debtId === d.id} onClick={() => setDebtId(d.id)}>{nameOf(d, lang)}</button>
          ))}
        </div>
      )}

      <div className="row2">
        <label>
          <span className="lbl">{kind === 'transfer' ? t.from : t.account}</span>
          <select value={accountId} onChange={e => pickAccount(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{nameOf(a, lang)}{a.currency !== main ? ` (${a.currency})` : ''}</option>)}
          </select>
        </label>
        {kind === 'transfer' ? (
          <label>
            <span className="lbl">{t.to}</span>
            <select value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
              {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{nameOf(a, lang)}{a.currency !== main ? ` (${a.currency})` : ''}</option>)}
            </select>
          </label>
        ) : (
          <label>
            <span className="lbl">{t.date}</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value || today())} />
          </label>
        )}
      </div>

      {landing != null && toAcc && toAcc.currency !== transferCur && (
        <p className="hint">→ {fmt(landing, toAcc.currency, lang)}</p>
      )}

      <div className="row2">
        <input placeholder={t.note} value={note} onChange={e => setNote(e.target.value)} />
        {kind === 'transfer' && <input type="date" value={date} aria-label={t.date} onChange={e => setDate(e.target.value || today())} />}
      </div>

      {err && <p className="err" role="alert">{err}</p>}
      <div className="row2">
        {(editing || onCancel) && <button type="button" className="ghost" onClick={() => (onCancel ? onCancel() : onDone?.())}>{t.cancel}</button>}
        <button type="button" className="primary" onClick={submit} disabled={!(value > 0)}>{editing ? t.update : t.save}</button>
      </div>
    </div>
  )
}
