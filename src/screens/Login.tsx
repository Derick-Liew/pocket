import { useState } from 'react'
import { strings } from '../lib/i18n'
import { supabase } from '../lib/supabase'

export function Login() {
  const t = strings[navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en']
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('pocket:email') ?? '' } catch { return '' } })
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function send() {
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) return setMsg(error.message)
    try { localStorage.setItem('pocket:email', email.trim()) } catch { /* private mode */ }
    setSent(true); setMsg(t.codeSent)
  }
  async function verify() {
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setMsg(t.wrongCode)
  }

  return (
    <main className="login">
      <div className="logo" aria-hidden>👛</div>
      <h1>{t.appName}</h1>
      <section className="card form">
        <label><span className="lbl">{t.email}</span>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={sent} />
        </label>
        {sent && (
          <label><span className="lbl">{t.code}</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
          </label>
        )}
        {msg && <p className="hint" role="status">{msg}</p>}
        {!sent
          ? <button type="button" className="primary" disabled={busy || !email.includes('@')} onClick={send}>{t.sendCode}</button>
          : <button type="button" className="primary" disabled={busy || code.length < 6} onClick={verify}>{t.verify}</button>}
        {sent && <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setMsg('') }}>← {t.email}</button>}
      </section>
      <p className="hint">{t.install}</p>
    </main>
  )
}
