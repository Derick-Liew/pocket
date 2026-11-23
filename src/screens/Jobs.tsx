import { useMemo, useState } from 'react'
import { put, uid } from '../lib/db'
import { convert, knownCurrencies, today } from '../lib/fx'
import { nameOf } from '../lib/i18n'
import { currencyList, fmt, round2 } from '../lib/money'
import { useData } from '../lib/store'
import type { Entry, Gig, GigStatus } from '../lib/types'

const NEXT: Partial<Record<GigStatus, GigStatus>> = { quoted: 'booked', booked: 'done', done: 'paid' }

export function Jobs({ toast }: { toast: (m: string) => void }) {
  const { t, lang, main, gigs, accounts, categories, settings } = useData()
  const [client, setClient] = useState('')
  const [job, setJob] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState(main)
  const [paying, setPaying] = useState<Gig | null>(null)
  const [payInto, setPayInto] = useState(settings.last_account_id ?? accounts.find(a => a.kind === 'spend')?.id ?? '')
  const currencies = useMemo(() => currencyList(knownCurrencies(), settings.recent_currencies ?? []), [settings.recent_currencies])

  const day = today()
  const paid = gigs.filter(g => g.status === 'paid')
  const earned = paid.reduce((s, g) => s + convert(g.price, g.currency, main, g.date), 0)
  const earnedMonth = paid.filter(g => g.date.startsWith(day.slice(0, 7))).reduce((s, g) => s + convert(g.price, g.currency, main, g.date), 0)

  async function add() {
    const p = Number(price) || 0
    if (!client.trim() || !job.trim() || p <= 0) return toast(t.fillJob)
    await put('gigs', { id: uid(), date: day, client: client.trim(), job: job.trim(), price: p, currency, status: 'quoted', note: '' } satisfies Gig)
    setClient(''); setJob(''); setPrice('')
    toast('✓ ' + t.addJob)
  }

  async function markPaid(g: Gig) {
    const freelance = categories.find(c => c.id === 'freelance') ?? categories.find(c => c.kind === 'income')
    const e: Entry = {
      id: uid(), date: day, kind: 'income', amount: g.price, currency: g.currency, account_id: payInto,
      to_account_id: null, to_amount: null, category_id: freelance?.id ?? null, debt_id: null,
      note: `${g.client} · ${g.job}`, src: 'phone', created_at: new Date().toISOString(),
    }
    await put('entries', e)
    // The paid date is when money came in, so "this month" counts it in the right month.
    await put('gigs', { ...g, status: 'paid', date: day })
    setPaying(null)
    toast(t.split(fmt(round2(g.price * 0.5), g.currency, lang), fmt(round2(g.price * 0.3), g.currency, lang), fmt(round2(g.price * 0.2), g.currency, lang)))
  }

  return (
    <>
      <section className="card form">
        <h2>{t.jobsTitle} <small>{t.earned} <b className="num">{fmt(earned, main, lang)}</b> · {t.thisMonthEarned} <b className="num">{fmt(earnedMonth, main, lang)}</b></small></h2>
        <div className="row2">
          <input placeholder={t.client} value={client} onChange={e => setClient(e.target.value)} aria-label={t.client} />
          <div className="amount small">
            <select className="cur" value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t.mainCurrency}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input inputMode="decimal" placeholder={t.price} value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} aria-label={t.price} />
          </div>
        </div>
        <input placeholder={t.job} value={job} onChange={e => setJob(e.target.value)} aria-label={t.job} />
        <button type="button" className="primary" onClick={add}>{t.addJob}</button>
      </section>

      <section className="card">
        {!gigs.length ? <p className="empty">{t.emptyJobs}</p> : (
          <ul className="ledger">
            {gigs.map(g => {
              const next = NEXT[g.status]
              return (
                <li key={g.id}>
                  <div className="line static">
                    <span className="what">{g.client} · {g.job} <span className={'tag ' + (g.status === 'paid' ? 'ok' : 'warn')}>{t[`st_${g.status}`]}</span></span>
                    <span className="amt num">{fmt(g.price, g.currency, lang)}</span>
                    <span className="meta">{g.date}</span>
                  </div>
                  {paying?.id === g.id ? (
                    <div className="form sub-form">
                      <label><span className="lbl">{t.paidInto}</span>
                        <select value={payInto} onChange={e => setPayInto(e.target.value)}>
                          {accounts.map(a => <option key={a.id} value={a.id}>{nameOf(a, lang)}</option>)}
                        </select>
                      </label>
                      <div className="row2">
                        <button type="button" className="ghost" onClick={() => setPaying(null)}>{t.cancel}</button>
                        <button type="button" className="primary" disabled={!payInto} onClick={() => markPaid(g)}>{t.st_paid}</button>
                      </div>
                    </div>
                  ) : next && (
                    <div className="line-actions">
                      <button type="button" className="ghost" onClick={() => (next === 'paid' ? setPaying(g) : void put('gigs', { ...g, status: next }))}>
                        {t[`next_${g.status as 'quoted' | 'booked' | 'done'}`]}
                      </button>
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
