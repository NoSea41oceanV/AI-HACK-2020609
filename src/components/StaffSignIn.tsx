import { useState, type FormEvent } from 'react'
import './StaffSignIn.css'

interface StaffSignInProps {
  onSignIn: (email: string, password: string) => Promise<void>
  disabledReason?: string
}

export default function StaffSignIn({ onSignIn, disabledReason }: StaffSignInProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || disabledReason) return
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true)
    setError('')
    try {
      await onSignIn(String(values.get('email') ?? '').trim(), String(values.get('password') ?? ''))
      form.reset()
    } catch {
      setError('ログインできませんでした。入力内容と施設の利用権限を確認してください。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="staff-sign-in">
      <section className="staff-sign-in__card" aria-labelledby="sign-in-title">
        <span className="staff-sign-in__brand">PAWLAND</span>
        <h1 id="sign-in-title">施設ログイン</h1>
        <p>施設のアカウントでログインしてください。</p>
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="staff-email">メールアドレス</label>
          <input id="staff-email" name="email" type="email" autoComplete="username" required disabled={busy || Boolean(disabledReason)} />
          <label htmlFor="staff-password">パスワード</label>
          <input id="staff-password" name="password" type="password" autoComplete="current-password" required disabled={busy || Boolean(disabledReason)} />
          {(error || disabledReason) && <p className="staff-sign-in__error" role="alert">{disabledReason || error}</p>}
          <button type="submit" disabled={busy || Boolean(disabledReason)}>{busy ? '確認しています…' : 'ログイン'}</button>
        </form>
        <p className="staff-sign-in__help">飼い主の方は、施設から届いた登録URLまたはQRコードを開いてください。</p>
      </section>
    </main>
  )
}
