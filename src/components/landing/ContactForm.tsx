'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { authInputDark, authLabelDark, authErrorTextDark } from '@/components/auth/authStyles'
import { EASE, buttonHover } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PhoneInput } from '@/components/booking/PhoneCountryInput'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [shakeKey, setShakeKey] = useState(0)

  const clearFieldError = (key: string) => {
    setFieldErrors(prev => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next })
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'A neved megadása kötelező.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Érvényes email-cím szükséges.'
    if (!message.trim()) e.message = 'Írj pár szót, miben segíthetünk.'
    return e
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) { setShakeKey(k => k + 1); return }

    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
    } catch {
      setError('Az üzenet küldése nem sikerült — próbáld meg újra, vagy írj emailt közvetlenül.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <CheckCircle2 className="h-8 w-8 text-gold" strokeWidth={1.6} />
        <p className="text-[17px] font-semibold text-white">Köszönjük, megkaptuk az üzeneted!</p>
        <p className="text-[14px] text-white/55 max-w-xs">Munkanapokon, ügyfélszolgálati időben válaszolunk — általában néhány órán belül.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div key={`name-${shakeKey}`} className={cn('space-y-1.5', fieldErrors.name && 'animate-shake')}>
          <Label className={authLabelDark}>Neved</Label>
          <input
            type="text"
            placeholder="Kovács Anna"
            value={name}
            onChange={e => { setName(e.target.value); clearFieldError('name') }}
            className={cn(authInputDark, fieldErrors.name && 'ring-1 ring-red-400 border-red-400')}
          />
          {fieldErrors.name && <p role="alert" className={authErrorTextDark}>{fieldErrors.name}</p>}
        </div>
        <div key={`email-${shakeKey}`} className={cn('space-y-1.5', fieldErrors.email && 'animate-shake')}>
          <Label className={authLabelDark}>Email címed</Label>
          <input
            type="email"
            placeholder="te@pelda.hu"
            value={email}
            onChange={e => { setEmail(e.target.value); clearFieldError('email') }}
            className={cn(authInputDark, fieldErrors.email && 'ring-1 ring-red-400 border-red-400')}
          />
          {fieldErrors.email && <p role="alert" className={authErrorTextDark}>{fieldErrors.email}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className={authLabelDark}>Telefonszám (opcionális)</Label>
        <PhoneInput value={phone} onChange={setPhone} inputClass={authInputDark} dark />
      </div>
      <div key={`message-${shakeKey}`} className={cn('space-y-1.5', fieldErrors.message && 'animate-shake')}>
        <Label className={authLabelDark}>Miben segíthetünk?</Label>
        <textarea
          rows={4}
          placeholder="Írd le röviden, mi a kérdésed..."
          value={message}
          onChange={e => { setMessage(e.target.value); clearFieldError('message') }}
          className={cn(authInputDark, 'h-auto resize-none py-3', fieldErrors.message && 'ring-1 ring-red-400 border-red-400')}
        />
        {fieldErrors.message && <p role="alert" className={authErrorTextDark}>{fieldErrors.message}</p>}
      </div>
      {error && <p className={authErrorTextDark}>{error}</p>}
      <motion.button
        type="submit"
        disabled={sending}
        variants={buttonHover}
        initial="rest"
        whileHover="hover"
        className="flex w-full items-center justify-center gap-5 rounded-full bg-white py-2.5 pl-6 pr-2.5 font-onest font-medium text-base text-ink-dark disabled:opacity-50"
      >
        Üzenet küldése
        <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden bg-gold">
          {sending ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin text-ink-dark" />
          ) : (
            <>
              <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                <Send className="h-[16px] w-[16px] text-ink-dark" />
              </motion.div>
              <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                <Send className="h-[16px] w-[16px] text-ink-dark" />
              </motion.div>
            </>
          )}
        </span>
      </motion.button>
      <p className="text-[11.5px] leading-relaxed text-white/40">
        A küldéssel elfogadod a{' '}
        <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-white/70">Felhasználási feltételeket</Link>
        {' '}és az{' '}
        <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-white/70">Adatkezelési tájékoztatót</Link>.
      </p>
    </form>
  )
}
