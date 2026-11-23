// One-time move of the finance CSVs (the `finance` folder next to this repo) into Supabase.
// Needs finance/.env with SUPABASE_URL, SUPABASE_SERVICE_KEY, POCKET_EMAIL.
// Safe to run twice: every row has a fixed id, so a rerun overwrites instead of duplicating.
// Usage: node scripts/migrate.mjs [--dry]
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'
const FIN = process.env.FINANCE_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../finance')
const dry = process.argv.includes('--dry')
const seed = JSON.parse(fs.readFileSync(new URL('../src/lib/seed.json', import.meta.url), 'utf8'))

function env() {
  const out = {}
  const p = path.join(FIN, '.env')
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}`)
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

function csv(name) {
  const p = path.join(FIN, name)
  if (!fs.existsSync(p)) return []
  const text = fs.readFileSync(p, 'utf8').replace(/^\ufeff/, '')
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter(r => r.some(x => x !== ''))
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

const num = v => Number(v) || 0

// --- build rows -------------------------------------------------------------
const budget = Object.fromEntries(csv('budget.csv').map(b => [b.category, num(b.monthly)]))
const debtsCsv = Object.fromEntries(csv('debts.csv').map(d => [d.name, d]))

const opening = {}
for (const s of csv('savings.csv')) {
  if (/starting balance/i.test(s.note)) opening[s.pot] = (opening[s.pot] ?? 0) + num(s.change)
}

const accounts = seed.accounts.map(a => ({
  ...a, opening: opening[a.id] ?? 0, opening_set: a.id in opening, archived: false, deleted: false,
}))
// "吃饭 Food" → zh = up to the first Latin word, en = the rest.
const splitLabel = label => { const m = label.match(/^([^A-Za-z]+?)\s+([A-Za-z].*)$/); return m ? [m[1], m[2]] : [label, label] }
const categories = seed.categories.map(c => ({ ...c, budget: c.kind === 'expense' ? budget[c.id] ?? 0 : 0, deleted: false }))
// Budget lines the defaults lack (other than debt-/save- goals) become their own expense categories.
csv('budget.csv').forEach((b, i) => {
  if (categories.some(c => c.id === b.category) || /^(debt|save)-/.test(b.category)) return
  const [zh, en] = splitLabel(b.label)
  categories.push({ id: b.category, kind: 'expense', name_zh: zh, name_en: en, icon: '•', budget: num(b.monthly), sort: 20 + i, deleted: false })
})
const debts = Object.values(debtsCsv).map((c, i) => {
  const [zh, en] = splitLabel(c.label)
  return { id: c.name, name_zh: zh, name_en: en, currency: 'MYR', start_balance: num(c.start_balance),
    planned_monthly: num(c.planned_monthly), interest: c.interest, note: c.note, sort: i + 1, deleted: false }
})
const allowance = categories.find(c => c.id === 'allowance')
if (allowance) allowance.name_zh = '爸爸 allowance'

const entries = []
const base = { currency: 'MYR', to_account_id: null, to_amount: null, debt_id: null, category_id: null, src: 'pc', deleted: false }
csv('transactions.csv').forEach((t, i) => {
  const kind = t.type === 'income' ? 'income' : 'expense'
  const cat = categories.some(c => c.id === t.category) ? t.category : kind === 'income' ? 'other-in' : 'misc'
  entries.push({ ...base, id: `csv-tx-${i + 1}`, date: t.date, kind, amount: num(t.amount), account_id: 'bank', category_id: cat, note: t.note, created_at: `${t.date}T12:00:${String(i % 60).padStart(2, '0')}Z` })
})
csv('savings.csv').forEach((s, i) => {
  if (/starting balance/i.test(s.note) || !num(s.change)) return
  const amt = num(s.change)
  // A deposit into a pot is a transfer from the bank; a withdrawal is the reverse.
  entries.push({ ...base, id: `csv-sv-${i + 1}`, date: s.date, kind: 'transfer', amount: Math.abs(amt),
    account_id: amt > 0 ? 'bank' : s.pot, to_account_id: amt > 0 ? s.pot : 'bank', to_amount: Math.abs(amt), note: s.note, created_at: `${s.date}T12:00:00Z` })
})
csv('debt_log.csv').forEach((d, i) => {
  entries.push({ ...base, id: `csv-debt-${i + 1}`, date: d.date, kind: 'debt', amount: num(d.amount), account_id: 'bank', debt_id: d.debt, note: d.note, created_at: `${d.date}T12:00:00Z` })
})
csv('ptptn.csv').forEach((p, i) => {
  if (!num(p.to_pot)) return
  entries.push({ ...base, id: `csv-ptptn-${i + 1}`, date: p.date, kind: 'income', amount: num(p.to_pot), account_id: 'ptptn', category_id: 'other-in', note: `PTPTN #${p.disbursement_no} ${p.note}`.trim(), created_at: `${p.date}T12:00:00Z` })
})

const gigs = csv('gigs.csv').map((g, i) => ({ id: g.id || `csv-gig-${i + 1}`, date: g.date, client: g.client, job: g.job, price: num(g.price), currency: 'MYR', status: g.status || 'quoted', note: g.note, deleted: false }))
const wishes = csv('wishlist.csv').map((w, i) => ({ id: `csv-wish-${i + 1}`, date: w.date, item: w.item, price: num(w.price), currency: 'MYR', category_id: w.category || null, recheck: w.recheck_date || null, decision: w.decision || 'waiting', note: w.note, deleted: false }))

const plan = { accounts, categories, debts, entries, gigs, wishes }
console.log(Object.entries(plan).map(([k, v]) => `${k}: ${v.length}`).join(' · '))
console.log('opening balances:', accounts.filter(a => a.opening_set).map(a => `${a.id}=${a.opening}`).join(', '))
if (dry) { for (const [k, v] of Object.entries(plan)) for (const r of v) console.log(k, JSON.stringify(r)); process.exit(0) }

// --- write ------------------------------------------------------------------
const E = env()
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const email = E.POCKET_EMAIL.toLowerCase()
let user = null
for (let page = 1; !user; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  user = data.users.find(u => u.email?.toLowerCase() === email) ?? null
  if (data.users.length < 200) break
}
if (!user) {
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  user = data.user
  console.log('created login for', email)
}

for (const [table, rows] of Object.entries(plan)) {
  if (!rows.length) continue
  const { error } = await sb.from(table).upsert(rows.map(r => ({ ...r, user_id: user.id })), { onConflict: 'user_id,id' })
  if (error) throw new Error(`${table}: ${error.message}`)
  console.log(`✓ ${table} ${rows.length}`)
}
console.log('Done. Open the app and sign in with', email)
