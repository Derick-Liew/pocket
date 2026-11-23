import { db } from './db'
import { supabase } from './supabase'
import type { TableName } from './types'

const TABLES: TableName[] = ['settings', 'accounts', 'categories', 'debts', 'fx_rates', 'entries', 'gigs', 'wishes', 'recurring']

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'
let state: SyncState = 'idle'
let running: Promise<void> | null = null
const listeners = new Set<(s: SyncState) => void>()

function setState(s: SyncState) {
  state = s
  listeners.forEach(f => f(s))
}
export const onSyncState = (f: (s: SyncState) => void) => {
  listeners.add(f)
  f(state)
  return () => { listeners.delete(f) }
}

/** Upload queued writes, then download anything changed since the last pull. Safe to call often. */
export function sync(): Promise<void> {
  if (!running) running = run().finally(() => { running = null })
  return running
}

async function run() {
  if (!navigator.onLine) { setState('offline'); return }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const userId = session.user.id
  setState('syncing')
  try {
    await push(userId)
    await pull()
    setState('idle')
    window.dispatchEvent(new Event('pocket:synced'))
  } catch (e) {
    console.warn('sync failed', e)
    setState(navigator.onLine ? 'error' : 'offline')
  }
}

async function push(userId: string) {
  const items = await db.outbox.orderBy('seq').toArray()
  if (!items.length) return
  // Last write per row wins; group by table so each table is one request.
  const byTable = new Map<TableName, Map<string, Record<string, unknown>>>()
  for (const it of items) {
    if (!byTable.has(it.table)) byTable.set(it.table, new Map())
    const { updated_at: _u, ...row } = it.row
    byTable.get(it.table)!.set(String(row.id), { ...row, user_id: userId })
  }
  const sent = new Set<TableName>()
  for (const [table, rows] of byTable) {
    const { error } = await supabase.from(table).upsert([...rows.values()], { onConflict: 'user_id,id' })
    // Table not created on the server yet: keep its rows queued, send the rest.
    if (error?.code === 'PGRST205') continue
    if (error) throw error
    sent.add(table)
  }
  await db.outbox.bulkDelete(items.filter(it => sent.has(it.table)).map(it => it.seq!))
}

async function pull() {
  for (const table of TABLES) {
    const metaKey = 'cursor:' + table
    const cursor = (await db.meta.get(metaKey))?.value as string | undefined
    let from = 0
    let newest = cursor
    for (;;) {
      let q = supabase.from(table).select('*').order('updated_at', { ascending: true }).range(from, from + 999)
      // Re-read a few seconds back so a row committed during the last pull is never skipped.
      if (cursor) q = q.gt('updated_at', new Date(Date.parse(cursor) - 5000).toISOString())
      const { data, error } = await q
      // A table the server doesn't have yet (schema step not run) is skipped, not fatal.
      if (error?.code === 'PGRST205') break
      if (error) throw error
      if (!data?.length) break
      // Never overwrite a row that still has an unsent local edit.
      const pending = new Set((await db.outbox.toArray()).filter(o => o.table === table).map(o => String(o.row.id)))
      const rows = data.filter(r => !pending.has(r.id)).map(r => normalise(r))
      await db.table(table).bulkPut(rows)
      newest = data[data.length - 1].updated_at
      if (data.length < 1000) break
      from += 1000
    }
    if (newest) await db.meta.put({ key: metaKey, value: newest })
  }
}

/** Postgres numerics arrive as strings or numbers depending on size; make them numbers. */
function normalise(r: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...r }
  for (const k of ['amount', 'to_amount', 'opening', 'budget', 'start_balance', 'planned_monthly', 'price', 'day']) {
    if (out[k] != null) out[k] = Number(out[k])
  }
  return out
}

export function startAutoSync() {
  const kick = () => { void sync() }
  window.addEventListener('online', kick)
  window.addEventListener('offline', () => setState('offline'))
  window.addEventListener('pocket:dirty', kick)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick() })
  setInterval(kick, 60_000)
  kick()
}

export async function clearLocal() {
  await Promise.all([...TABLES.map(t => db.table(t).clear()), db.outbox.clear(), db.meta.clear()])
}
