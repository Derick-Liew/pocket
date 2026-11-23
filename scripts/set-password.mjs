// Set (or reset) the app login password for POCKET_EMAIL, using the service key in ../finance/.env.
// Run it yourself in a terminal so the password never leaves this computer:  node scripts/set-password.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const FIN = process.env.FINANCE_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../finance')
const E = Object.fromEntries(fs.readFileSync(path.join(FIN, '.env'), 'utf8').split(/\r?\n/)
  .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]))

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY })
let prompt = ''
// Show * instead of the typed characters (the prompt itself is printed as is).
let masking = false
rl._writeToOutput = s => { rl.output.write(masking && !s.includes(prompt) ? s.replace(/[^\r\n]/g, '*') : s) }
const lines = [], waiting = []
rl.on('line', l => { masking = false; const w = waiting.shift(); if (w) w(l); else lines.push(l) })
const ask = q => {
  prompt = q
  masking = false
  rl.output.write(q)
  masking = true
  return lines.length ? Promise.resolve(lines.shift()) : new Promise(res => waiting.push(res))
}

const email = E.POCKET_EMAIL.toLowerCase()
console.log('Account: ' + email)
const p1 = await ask('New password (at least 8 characters): ')
const p2 = await ask('Type it again: ')
rl.close()
if (p1 !== p2) { console.error('The two passwords are different. Nothing changed.'); process.exit(1) }
if (p1.length < 8) { console.error('Too short. Nothing changed.'); process.exit(1) }
const sb = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const { data, error } = await sb.auth.admin.listUsers({ perPage: 200 })
if (error) throw error
const user = data.users.find(u => u.email?.toLowerCase() === email)
if (!user) { console.error('No account for ' + email); process.exit(1) }

const r = await sb.auth.admin.updateUserById(user.id, { password: p1, email_confirm: true })
if (r.error) { console.error(r.error.message); process.exit(1) }
console.log('✓ Password set. Sign in to the app with ' + email)
