'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthMobile, AuthScreen, AuthSplash, LoginCodeForm, LoginEmailForm } from '@/components/blocks/auth'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { AuthVideoBg } from '@/components/auth/AuthVideoBg'

/**
 * Belépés (design 3.1–3.5): e-mail → 6 jegyű kód e-mailben → belépés, 7 napig ezen az eszközön; vagy Google. Jelszó
 * nincs. Desktopon a kétoszlopos képernyő (bal a videó), mobilon teljes képernyős sötét a videón: kezdőképernyő →
 * e-mail → kód. A kód-kérés és -ellenőrzés: /api/auth/code/request, /api/auth/code/verify.
 */
const RESEND_SECONDS = 30
const ERR: Record<string, string> = {
  expired: 'Lejárt a kód — kérj újat.',
  locked: 'Túl sok hibás próbálkozás — kérj új kódot.',
  rate_limited: 'Túl sok kérés — próbáld újra pár perc múlva.',
  send_failed: 'Nem sikerült elküldeni a kódot — próbáld újra.',
  invalid: 'Érvényes e-mail címet adj meg.',
}

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [step, setStep] = useState<'splash' | 'email' | 'code'>('splash')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(params.get('error') ? 'A Google-belépés nem sikerült — próbáld újra, vagy lépj be kóddal.' : null)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 1024px)')
    const up = () => setDesktop(mq.matches)
    up(); mq.addEventListener('change', up)
    return () => mq.removeEventListener('change', up)
  }, [])
  // a kódos levél „Belépés” gombja: /login?email=…&code=… → a kód-lépés kitöltve, egy koppintás a belépés (nem lép be
  // magától — a levelezők linkellenőrzői előre megnyitják a linket). A címsorból azonnal eltűnik a kód.
  useEffect(() => {
    const e = params.get('email'), c = params.get('code')
    if (!e) return
    setEmail(e)
    // csak e-mail (pl. a csapat-meghívóról): az e-mail-lépés kitöltve, a kód-kérés egy koppintás
    if (!c || !/^\d{6}$/.test(c)) { setStep('email'); return }
    setCode(c); setStep('code')
    const from = params.get('from')
    window.history.replaceState(null, '', from ? `/login?from=${encodeURIComponent(from)}` : '/login')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const requestCode = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(ERR.invalid); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/auth/code/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), purpose: 'login' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(ERR[j.error] ?? 'Nem sikerült — próbáld újra.'); return }
      setCode(''); setStep('code'); setResendIn(RESEND_SECONDS)
    } finally { setBusy(false) }
  }

  const verify = async (value = code) => {
    if (value.length < 6 || busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/auth/code/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: email.trim(), code: value }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(j.error === 'wrong' ? `Hibás kód — még ${j.left} próbálkozás.` : ERR[j.error] ?? 'Nem sikerült — próbáld újra.')
        if (j.error !== 'wrong') setResendIn(0)
        setCode('')
        return
      }
      const from = params.get('from')
      router.push(from && from.startsWith('/') && !from.startsWith('//') ? from : j.redirect ?? '/dashboard')
      router.refresh()
    } finally { setBusy(false) }
  }

  if (!mounted) return <div className="min-h-dvh bg-ui-dark" />

  const google = (dark: boolean) => <GoogleSignInButton variant={dark ? 'dark' : 'light'} spread={!dark} callbackUrl="/" label="Folytatás Google-lel" />
  const emailForm = (dark: boolean) => <LoginEmailForm dark={dark} email={email} onEmail={(v) => { setEmail(v); setError(null) }} onSubmit={() => void requestCode()} busy={busy} error={error} google={google(dark)} registerHref="/register" />
  const codeForm = (dark: boolean) => (
    <LoginCodeForm dark={dark} email={email.trim()} code={code} onCode={(v) => { setCode(v); setError(null) }} onSubmit={(v) => void verify(v)} busy={busy} error={error}
      onOtherEmail={() => { setStep('email'); setCode(''); setError(null) }} onResend={() => void requestCode()} resendIn={resendIn} />
  )

  if (desktop) {
    return step === 'code'
      ? <AuthScreen full media={<AuthVideoBg />} logoHref="/" title={<>Egy kód,<br />és bent<br />vagy.</>} sub="Nincs megjegyzendő jelszó — minden belépésnél friss kódot küldünk.">{codeForm(false)}</AuthScreen>
      : <AuthScreen full media={<AuthVideoBg />} logoHref="/">{emailForm(false)}</AuthScreen>
  }
  return (
    <AuthMobile full media={<AuthVideoBg fullScreen />} logoHref="/" onBack={step === 'splash' ? undefined : () => { setStep(step === 'code' ? 'email' : 'splash'); setError(null) }}>
      {step === 'splash' ? <AuthSplash onLogin={() => setStep('email')} registerHref="/register" google={google(true)} termsHref="/terms" />
        : step === 'email' ? emailForm(true) : codeForm(true)}
    </AuthMobile>
  )
}
