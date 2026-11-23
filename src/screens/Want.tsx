import { useMemo, useState } from 'react'
import { monthSpend } from '../lib/calc'
import { put, uid } from '../lib/db'
import { convert, knownCurrencies, today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { currencyList, fmt } from '../lib/money'
import { useData } from '../lib/store'
import type { Wish } from '../lib/types'

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Want({ toast }: { toast: (m: string) => void }) {
  const { t, lang, main, categories, entries, debts, wishes, settings, fxVersion } = useData()
  const expenseCats = categories.filter(c => c.kind === 'expense')
  const [item, setItem] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState(main)
  const [catId, setCatId] = useState(() => expenseCats.find(c => c.id === 'shopping')?.id ?? expenseCats[0]?.id ?? '')
  const currencies = useMemo(() => currencyList(knownCurrencies(), settings.recent_currencies ?? []), [settings.recent_currencies])

  const p = Number(price) || 0
  const day = today()
  const priceMain = convert(p, currency, main, day)
  const { byCat } = useMemo(() => monthSpend(entries, day.slice(0, 7), main), [entries, day, main, fxVersion]) // eslint-disable-line react-hooks/exhaustive-deps
  const cat = expenseCats.find(c => c.id === catId)
  const left = cat ? cat.budget - (byCat.get(cat.id) ?? 0) : 0
  // The debt this purchase would slow down most: the first one with a monthly plan.
  const target = debts.find(d => d.planned_monthly > 0)
  const delay = target ? convert(priceMain, main, target.currency, day) / target.planned_monthly : 0
  const ready = item.trim() && p > 0

  async function addWish() {
    if (!ready) return
    const w: Wish = { id: uid(), date: day, item: item.trim(), price: p, currency, category_id: catId || null, recheck: addDays(day, 3), decision: 'waiting', note: '' }
    await put('wishes', w)
    setItem(''); setPrice('')
    toast('✓ ' + t.waitUntil(w.recheck!))
  }

  const saved = wishes.filter(w => w.decision === 'skipped').reduce((s, w) => s + convert(w.price, w.currency, main, w.date), 0)

  return (
    <>
      <section className="card form">
        <h2>{t.wantTitle}</h2>
        <input placeholder={t.item} value={item} onChange={e => setItem(e.target.value)} aria-label={t.item} />
        <div className="amount">
          <select className="cur" value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t.mainCurrency}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input inputMode="decimal" placeholder={t.price} value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} aria-label={t.price} />
        </div>
        <div className="chips" role="group" aria-label={t.category}>
          {expenseCats.map(c => (
            <button key={c.id} type="button" aria-pressed={catId === c.id} onClick={() => setCatId(c.id)}><span aria-hidden>{c.icon}</span> {nameOf(c, lang)}</button>
          ))}
        </div>
        {ready && cat && (
          <div className="answer">
            <b>{t.realCost}</b>
            {currency !== main && <div className="num">≈ {fmt(priceMain, main, lang)}</div>}
            {cat.budget > 0 && <div>{t.catLeft(nameOf(cat, lang), fmt(left, main, lang))} {priceMain > left ? t.notEnough : t.enough}</div>}
            {target && <div>{t.delayDebt(nameOf(target, lang), delay.toFixed(1))}</div>}
            <div>{priceMain > left ? t.adviceNo : t.adviceWait}</div>
          </div>
        )}
        <button type="button" className="primary" disabled={!ready} onClick={addWish}>{t.waitThree}</button>
      </section>

      <section className="card">
        <h2>Wishlist {saved > 0 && <small>{t.savedTotal} <b className="num">{fmt(saved, main, lang)}</b> 👍</small>}</h2>
        {!wishes.length ? <p className="empty">{t.emptyWish}</p> : (
          <ul className="ledger">
            {wishes.map(w => {
              const canDecide = w.decision === 'waiting' && (w.recheck ?? '') <= day
              return (
                <li key={w.id}>
                  <div className="line static">
                    <span className="what">{w.item}{' '}
                      {w.decision === 'skipped' ? <span className="tag ok">{t.skippedTag}</span>
                        : w.decision === 'bought' ? <span className="tag warn">{t.boughtTag}</span>
                        : canDecide ? <span className="tag warn">{t.canDecide}</span>
                        : <span className="tag ok">{t.waitUntil(w.recheck ?? '')}</span>}
                    </span>
                    <span className="amt num">{fmt(w.price, w.currency, lang)}</span>
                    <span className="meta">{w.date}</span>
                  </div>
                  {w.decision === 'waiting' && (
                    <div className="line-actions">
                      <button type="button" className="ghost" onClick={() => { void put('wishes', { ...w, decision: 'skipped' }); toast('👍 ' + t.skippedTag) }}>{t.skipped}</button>
                      {canDecide && <button type="button" className="ghost" onClick={() => { void put('wishes', { ...w, decision: 'bought' }); toast(t.boughtLog) }}>{t.bought}</button>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
