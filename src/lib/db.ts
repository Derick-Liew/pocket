import Dexie, { type Table } from 'dexie'
import type { Account, Category, Debt, Entry, FxDay, Gig, Recurring, Settings, TableName, Wish } from './types'

export interface OutboxItem {
  seq?: number
  table: TableName
  row: Record<string, unknown>
}

class PocketDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  debts!: Table<Debt, string>
  entries!: Table<Entry, string>
  gigs!: Table<Gig, string>
  wishes!: Table<Wish, string>
  recurring!: Table<Recurring, string>
  fx_rates!: Table<FxDay, string>
  settings!: Table<Settings, string>
  outbox!: Table<OutboxItem, number>
  meta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('pocket')
    this.version(1).stores({
      accounts: 'id',
      categories: 'id',
      debts: 'id',
      entries: 'id, date',
      gigs: 'id',
      wishes: 'id',
      fx_rates: 'id',
      settings: 'id',
      outbox: '++seq',
      meta: 'key',
    })
    this.version(2).stores({ recurring: 'id' })
  }
}

export const db = new PocketDB()

/** Save a row locally and queue it for upload. Every write in the app goes through here. */
export async function put<T extends { id: string }>(table: TableName, row: T): Promise<void> {
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(row)
    await db.outbox.add({ table, row: { ...row } })
  })
  window.dispatchEvent(new Event('pocket:dirty'))
}

export async function softDelete(table: TableName, id: string): Promise<void> {
  const row = await db.table(table).get(id)
  if (row) await put(table, { ...row, deleted: true })
}

export const uid = () => crypto.randomUUID()
