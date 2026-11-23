import { useState } from 'react'
import { strings } from '../lib/i18n'
import { supabase } from '../lib/supabase'

// Email + password. (Supabase's built-in mailer can't carry a 6-digit code without custom SMTP,
// and magic links open in Safari instead of the home-screen app on iPhone.)
export function Login() {
  const t = strings[navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en']
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('pocket:email') ?? '' } catch { return '' } })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit() {
    setBusy(true); setMsg('')
    const creds = { email: email.trim(), password }
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp(creds)
    setBusy(false)
    try { localStorage.setItem('pocket:email', email.trim()) } catch { /* private mode */ }
    if (error) return setMsg(/confirm/i.test(error.message) ? t.confirmFirst : mode === 'in' ? t.wrongPassword : error.message)
    if (mode === 'up' && !data.session) { setMsg(t.confirmFirst); setMode('in') }
  }

  return (
    <main className="login">
      <div className="logo" aria-hidden>👛</div>
      <h1>{t.appName}</h1>
      <section className="card form">
        <div className="seg">
          <button type="button" aria-pressed={mode === 'in'} onClick={() => { setMode('in'); setMsg('') }}>{t.login}</button>
          <button type="button" aria-pressed={mode === 'up'} onClick={() => { setMode('up'); setMsg('') }}>{t.signUp}</button>
        </div>
        <label><span className="lbl">{t.email}</span>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label><span className="lbl">{t.password}</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void submit() }} />
        </label>
        {mode === 'up' && <p className="hint">{t.passwordHint}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}
        <button type="button" className="primary" disabled={busy || !email.includes('@') || password.length < 8} onClick={submit}>
          {mode === 'in' ? t.login : t.signUp}
        </button>
      </section>
      <p className="hint">{t.install}</p>
    </main>
  )
}
