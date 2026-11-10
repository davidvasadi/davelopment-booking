'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { EASE, SPRING_SNAPPY, buttonHover } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PhoneInput } from '@/components/booking/PhoneCountryInput'
import { SUPPORT_RESPONSE_TEXT } from '@/lib/brand'

/**
 * Kapcsolatfelvételi űrlap (világos kártyára): téma-választó, név, email, üzlet neve, telefon,
 * üzenet → `/api/contact` (mentés a backstage-be + admin-értesítés + email). A téma és az üzlet
 * neve az üzenet elejére kerül a szerveren.
 */
export const CONTACT_TOPICS = ['Általános kérdés', 'Árak és csomagok', 'Bemutató kérése', 'Egyedi csomag', 'Technikai segítség', 'Számlázás'] as const

const input = 'h-12 w-full rounded-ui-inner border border-transparent bg-ui-cell px-4 text-ui-row text-ui-text outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-ui-muted hover:bg-ui-cell focus:border-ui-dark/70 focus:bg-white focus:shadow-ui-float'
const label = 'mb-1.5 block text-ui-body font-medium text-ui-muted'
const errText = 'mt-1 text-ui-meta text-ui-bad-dot'

export function ContactForm({ defaultTopic = CONTACT_TOPICS[0] }: { defaultTopic?: (typeof CONTACT_TOPICS)[number] }) {
  const [topic, setTopic] = useState<string>(defaultTopic)
  // a kijelölés csak témaváltáskor csússzon (betöltéskor a kártya beúszik — ne kövesse külön)
  const [topicTouched, setTopicTouched] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [business, setBusiness] = useState('')
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
        body: JSON.stringify({ name, email, phone, message, topic, business }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
    } catch {
      setError('Az üzenet küldése nem sikerült — próbáld meg újra, vagy írj emailt közvetlenül.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence mode="wait">
      {sent ? (
        <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="flex flex-col items-start gap-3 py-10" role="status">
          <CheckCircle2 className="h-9 w-9 text-ok-fill" strokeWidth={1.6} />
          <p className="text-ui-title font-medium text-ui-text">Köszönjük, megkaptuk az üzeneted!</p>
          <p className="max-w-sm text-ui-row text-ui-muted">{SUPPORT_RESPONSE_TEXT} A választ a megadott email-címre küldjük.</p>
        </motion.div>
      ) : (
        <motion.form key="form" onSubmit={onSubmit} noValidate exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-4">
          {/* Téma */}
          <fieldset>
            <legend className={label}>Miben segíthetünk?</legend>
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_TOPICS.map((t) => {
                const on = t === topic
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => { setTopicTouched(true); setTopic(t) }} className={cn('relative rounded-full px-3.5 py-2 text-ui-body font-medium transition-colors', !on && 'bg-ui-cell hover:bg-ui-grey/30')}>
                    {on && <motion.span layoutId={topicTouched ? 'contact-topic' : undefined} transition={SPRING_SNAPPY} className="absolute inset-0 rounded-full bg-ui-dark" />}
                    <span className={cn('relative transition-colors', on ? 'text-white' : 'text-ui-muted hover:text-ui-text')}>{t}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div key={`name-${shakeKey}`} className={cn(fieldErrors.name && 'animate-shake')}>
              <label htmlFor="cf-name" className={label}>Neved</label>
              <input id="cf-name" type="text" autoComplete="name" placeholder="Kovács Anna" value={name} onChange={e => { setName(e.target.value); clearFieldError('name') }} aria-invalid={!!fieldErrors.name} className={cn(input, fieldErrors.name && 'border-ui-bad-dot')} />
              {fieldErrors.name && <p role="alert" className={errText}>{fieldErrors.name}</p>}
            </div>
            <div key={`email-${shakeKey}`} className={cn(fieldErrors.email && 'animate-shake')}>
              <label htmlFor="cf-email" className={label}>Email címed</label>
              <input id="cf-email" type="email" autoComplete="email" placeholder="te@pelda.hu" value={email} onChange={e => { setEmail(e.target.value); clearFieldError('email') }} aria-invalid={!!fieldErrors.email} className={cn(input, fieldErrors.email && 'border-ui-bad-dot')} />
              {fieldErrors.email && <p role="alert" className={errText}>{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="cf-business" className={label}>Üzlet neve <span className="text-ui-muted">(opcionális)</span></label>
              <input id="cf-business" type="text" autoComplete="organization" placeholder="pl. Anna Szépségszalon" value={business} onChange={e => setBusiness(e.target.value)} className={input} />
            </div>
            <div>
              <span className={label}>Telefonszám <span className="text-ui-muted">(opcionális)</span></span>
              <PhoneInput value={phone} onChange={setPhone} inputClass={input} />
            </div>
          </div>

          <div key={`message-${shakeKey}`} className={cn(fieldErrors.message && 'animate-shake')}>
            <label htmlFor="cf-message" className={label}>Üzenet</label>
            <textarea id="cf-message" rows={4} placeholder="Írd le röviden, mi a kérdésed…" value={message} onChange={e => { setMessage(e.target.value); clearFieldError('message') }} aria-invalid={!!fieldErrors.message} className={cn(input, 'h-auto resize-none py-3', fieldErrors.message && 'border-ui-bad-dot')} />
            {fieldErrors.message && <p role="alert" className={errText}>{fieldErrors.message}</p>}
          </div>

          {error && <p role="alert" className={errText}>{error}</p>}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <motion.button
              type="submit"
              disabled={sending}
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex items-center gap-2.5 self-start rounded-full bg-ui-dark py-2.5 pl-5 pr-2.5 font-onest text-ui-row font-medium text-white disabled:opacity-60"
            >
              Üzenet küldése
              <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-ui-yellow">
                {sending ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin text-ui-text" />
                ) : (
                  <>
                    <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                      <Send className="h-4 w-4 text-ui-text" />
                    </motion.div>
                    <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                      <Send className="h-4 w-4 text-ui-text" />
                    </motion.div>
                  </>
                )}
              </span>
            </motion.button>
            <p className="max-w-[280px] text-ui-label leading-relaxed text-ui-muted">
              A küldéssel elfogadod a{' '}
              <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ui-muted">Felhasználási feltételeket</Link>
              {' '}és az{' '}
              <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-ui-muted">Adatkezelési tájékoztatót</Link>.
            </p>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  )
}

