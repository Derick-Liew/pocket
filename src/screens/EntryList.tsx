import { useState } from 'react'
import { softDelete } from '../lib/db'
import { nameOf } from '../lib/i18n'
import { fmt } from '../lib/money'
import { useData } from '../lib/store'
import type { Entry } from '../lib/types'
import { EntryForm } from './EntryForm'

export function EntryList({ entries, empty }: { entries: Entry[]; empty?: string }) {
  const { t, lang, accounts, categories, debts } = useData()
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  if (!entries.length) return <p className="empty">{empty ?? t.noEntries}</p>

  const accName = (id: string | null) => { const a = accounts.find(x => x.id === id); return a ? nameOf(a, lang) : '—' }
  const title = (e: Entry) => {
    if (e.kind === 'transfer') return `${accName(e.account_id)} → ${accName(e.to_account_id)}`
    if (e.kind === 'debt') { const d = debts.find(x => x.id === e.debt_id); return `${t.debt} · ${d ? nameOf(d, lang) : ''}` }
    const c = categories.find(x => x.id === e.category_id)
    return c ? `${c.icon} ${nameOf(c, lang)}` : t[e.kind as 'income' | 'expense'] ?? e.kind
  }

  return (
    <ul className="ledger">
      {entries.map(e => (
        <li key={e.id}>
          {editing?.id === e.id ? (
            <EntryForm editing={editing} onDone={() => { setEditing(null); setOpen(null) }} />
          ) : (
            <>
              <button type="button" className="line" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                <span className="what">{title(e)}{e.note && <span className="muted"> · {e.note}</span>}</span>
                <span className={'amt num ' + (e.kind === 'income' ? 'in' : e.kind === 'transfer' ? 'mid' : '')}>
                  {e.kind === 'income' ? '+' : e.kind === 'transfer' ? '' : '−'}{fmt(e.amount, e.currency, lang)}
                </span>
                <span className="meta">{e.date}{e.kind !== 'transfer' && ` · ${accName(e.account_id)}`}{e.src === 'pc' && ' · PC'}</span>
              </button>
              {open === e.id && (
                <div className="line-actions">
                  <button type="button" className="ghost" onClick={() => setEditing(e)}>{t.edit}</button>
                  <button type="button" className="ghost danger" onClick={() => { if (window.confirm(t.confirmDelete)) void softDelete('entries', e.id) }}>{t.delete}</button>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
