import { useState } from 'react'
import { balances } from '../lib/calc'
import { put } from '../lib/db'
import { nameOf } from '../lib/i18n'
import { round2 } from '../lib/money'
import { useData } from '../lib/store'

/** Ask once for the real balance of each account that has none yet; store the opening so today's balance matches. */
export function FirstRun() {
  const { t, lang, accounts, entries } = useData()
  const todo = accounts.filter(a => !a.opening_set)
  const bal = balances(accounts, entries)
  const [vals, setVals] = useState<Record<string, string>>({})

  async function done() {
    for (const a of todo) {
      const want = vals[a.id] !== undefined ? Number(vals[a.id]) || 0 : bal.get(a.id) ?? 0
      const flow = (bal.get(a.id) ?? 0) - a.opening
      await put('accounts', { ...a, opening: round2(want - flow), opening_set: true })
    }
  }

  return (
    <section className="card form">
      <h2>{t.setBalances}</h2>
      <p className="hint">{t.setBalancesHint}</p>
      <ul className="ledger">
        {todo.map(a => (
          <li key={a.id} className="line static">
            <label className="what" htmlFor={'o-' + a.id}>{nameOf(a, lang)} <span className="muted">{a.currency}</span></label>
            <input id={'o-' + a.id} className="num budget-in" inputMode="decimal" placeholder={String(round2(bal.get(a.id) ?? 0))}
              value={vals[a.id] ?? ''} onChange={e => setVals(v => ({ ...v, [a.id]: e.target.value.replace(/[^\d.-]/g, '') }))} />
          </li>
        ))}
      </ul>
      <button type="button" className="primary" onClick={done}>{t.done}</button>
    </section>
  )
}
