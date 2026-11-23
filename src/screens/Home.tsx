import { useMemo } from 'react'
import { balances, debtBalance } from '../lib/calc'
import { convert, hasRates, today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { fmt } from '../lib/money'
import { useData } from '../lib/store'
import { EntryForm } from './EntryForm'
import { EntryList } from './EntryList'

export function Home({ toast }: { toast: (m: string) => void }) {
  const { t, lang, main, accounts, entries, debts, fxVersion } = useData()

  const view = useMemo(() => {
    const bal = balances(accounts, entries)
    const day = today()
    const inMain = (id: string) => { const a = accounts.find(x => x.id === id)!; return convert(bal.get(id) ?? 0, a.currency, main, day) }
    const sum = (kinds: string[]) => accounts.filter(a => kinds.includes(a.kind)).reduce((s, a) => s + inMain(a.id), 0)
    const debtRows = debts.map(d => ({ d, left: debtBalance(d, entries) }))
    return {
      bal, inMain,
      total: sum(['spend', 'save', 'protected']),
      spendable: sum(['spend']),
      savings: sum(['save', 'protected']),
      debtRows,
      debtTotal: debtRows.reduce((s, r) => s + convert(Math.max(r.left, 0), r.d.currency, main, day), 0),
    }
    // fxVersion: recompute when new rates arrive
  }, [accounts, entries, debts, main, fxVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const recent = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)).slice(0, 10), [entries])

  return (
    <>
      <section className="card hero">
        <div className="lbl">{t.totalAssets}</div>
        <div className="big num">{fmt(view.total, main, lang)}</div>
        <div className="split">
          <div><div className="lbl">{t.spendable}</div><div className="mid-num num">{fmt(view.spendable, main, lang)}</div></div>
          <div><div className="lbl">{t.savings}</div><div className="mid-num num">{fmt(view.savings, main, lang)}</div></div>
        </div>
        {!hasRates() && accounts.some(a => a.currency !== main) && <p className="hint">{t.noRates}</p>}
      </section>

      <section className="card">
        <h2>{t.addEntry}</h2>
        <EntryForm onDone={m => m && toast(m)} />
      </section>

      <section className="card">
        <h2>{t.accounts}</h2>
        <ul className="ledger">
          {accounts.map(a => (
            <li key={a.id} className="line static">
              <span className="what">{nameOf(a, lang)}{a.kind === 'protected' && ' 🔒'}</span>
              <span className="amt num">{fmt(view.bal.get(a.id) ?? 0, a.currency, lang)}</span>
              {a.currency !== main && <span className="meta">≈ {fmt(view.inMain(a.id), main, lang)}</span>}
            </li>
          ))}
        </ul>
      </section>

      {view.debtRows.length > 0 && (
        <section className="card">
          <h2>{t.debts} <small className="num">{fmt(view.debtTotal, main, lang)}</small></h2>
          <ul className="ledger">
            {view.debtRows.map(({ d, left }) => {
              const frac = d.start_balance > 0 ? 1 - left / d.start_balance : 0
              return (
                <li key={d.id} className="line static">
                  <span className="what">{nameOf(d, lang)}</span>
                  <span className="amt num">{fmt(Math.max(left, 0), d.currency, lang)}</span>
                  {d.id !== 'ptptn' && <span className="bar"><i style={{ width: `${Math.max(0, Math.min(frac, 1)) * 100}%` }} /></span>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>{t.recent}</h2>
        <EntryList entries={recent} />
      </section>
    </>
  )
}
