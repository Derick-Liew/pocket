// Fake data for `npm run demo` only (never bundled into the real build's startup path).
import { db } from './lib/db'
import { today } from './lib/fx'
import seed from './lib/seed.json'

export async function loadDemo() {
  if (await db.accounts.count()) return
  const d = today(), m = d.slice(0, 7)
  const now = new Date().toISOString()
  await db.accounts.bulkPut(seed.accounts.map((a, i) => ({ ...a, kind: a.kind as 'spend', opening: [800, 50, 30, 300, 5000, 0, 1500][i] ?? 0, opening_set: true, archived: false })))
  await db.accounts.put({ id: 'wise', name_zh: 'Wise 新币', name_en: 'Wise SGD', currency: 'SGD', kind: 'spend', opening: 120, opening_set: true, sort: 8, archived: false })
  await db.categories.bulkPut(seed.categories.map(c => ({ ...c, kind: c.kind as 'expense', budget: c.kind === 'expense' ? 150 : 0 })))
  await db.debts.bulkPut([
    { id: 'd1', name_zh: '朋友', name_en: 'Friend', currency: 'MYR', start_balance: 1000, planned_monthly: 100, interest: '0%', note: '', sort: 1 },
    { id: 'ptptn', name_zh: 'PTPTN', name_en: 'PTPTN', currency: 'MYR', start_balance: 7200, planned_monthly: 0, interest: '1%', note: '', sort: 2 },
  ])
  const e = (id: string, kind: string, amount: number, extra: object) => ({
    id, date: d, kind, amount, currency: 'MYR', account_id: 'bank', to_account_id: null, to_amount: null, category_id: null, debt_id: null, note: '', src: 'phone', created_at: now, ...extra,
  })
  await db.entries.bulkPut([
    e('e1', 'income', 2500, { category_id: 'allowance', date: `${m}-01` }),
    e('e2', 'expense', 12.5, { category_id: 'food', note: 'nasi lemak' }),
    e('e3', 'expense', 140, { category_id: 'shopping' }),
    e('e4', 'expense', 200, { category_id: 'transport' }),
    e('e5', 'expense', 45, { category_id: 'food', currency: 'SGD', account_id: 'wise', note: 'Singapore' }),
    e('e6', 'debt', 100, { debt_id: 'd1' }),
  ] as never)
  await db.gigs.bulkPut([
    { id: 'g1', date: d, client: 'Amy', job: '毕业照 1 小时', price: 150, currency: 'MYR', status: 'booked', note: '' },
  ])
  await db.wishes.bulkPut([
    { id: 'w1', date: '2026-01-01', item: '25mm 镜头', price: 450, currency: 'MYR', category_id: 'shopping', recheck: '2026-01-04', decision: 'waiting', note: '' },
  ])
  await db.recurring.bulkPut([
    { id: 'r1', kind: 'income', name_zh: '零用钱', name_en: 'Allowance', amount: 2500, currency: 'MYR', day: 1, account_id: 'bank', to_account_id: null, category_id: 'allowance', debt_id: null, last_done: null, sort: 1 },
    { id: 'r2', kind: 'expense', name_zh: '房租', name_en: 'Rent', amount: 600, currency: 'MYR', day: 1, account_id: 'bank', to_account_id: null, category_id: 'rent', debt_id: null, last_done: null, sort: 2 },
  ])
  await db.meta.put({ key: 'seeded', value: true })
}
