'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Minus, Plus, Loader2, Trees, ArrowLeft, ChevronRight } from 'lucide-react'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { HoverArrow } from '@/components/ui/HoverArrow'
import { DateStrip } from '@/components/booking/DateStrip'
import { staggerContainer, fadeUp, stepSlide, stepSlideTransition } from '@/lib/motion'
import { makeT, dfLocale, type Locale } from '@/lib/i18n'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

/** Egy választható esemény-típus (alkalom) a foglalóban. */
export type EventTypeOption = { icon: string; label: string }

export function RestaurantBookingWizard({
  restaurantId,
  slug,
  requirePhone,
  maxPax,
  bookingWindowDays = 60,
  eventTypes = [],
  termsSections,
  company,
  locale = 'hu',
  onBack,
  onSuccess,
  variant = 'light',
  initialDateProp,
  initialTimeProp,
  initialPaxProp,
}: {
  restaurantId: string | number
  slug: string
  requirePhone: boolean
  maxPax: number
  bookingWindowDays?: number
  eventTypes?: EventTypeOption[]
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
  locale?: Locale
  onBack?: () => void
  onSuccess?: (date: string, time: string, pax: number) => void
  variant?: 'light' | 'dark'
  initialDateProp?: string
  initialTimeProp?: string
  initialPaxProp?: number
}) {
  const dk = variant === 'dark'
  const router = useRouter()
  const tt = makeT(locale)
  const STEPS = [tt('rbooking.step.datetime'), tt('rbooking.step.details'), tt('rbooking.step.review')]
  const searchParams = useSearchParams()
  const initialDate = initialDateProp ?? searchParams.get('date')
  const initialPax = initialPaxProp ?? Number(searchParams.get('pax'))
  const initialTime = initialTimeProp ?? searchParams.get('time')

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const goStep = (next: number) => {
    setDir(next >= step ? 1 : -1)
    setStep(next)
  }

  const [pax, setPax] = useState(initialPax >= 1 && initialPax <= maxPax ? initialPax : 2)
  const [date, setDate] = useState(() =>
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : format(new Date(), 'yyyy-MM-dd'),
  )
  const [slots, setSlots] = useState<{ start: string; end: string; onlyOutdoor?: boolean }[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [time, setTime] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('HU')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  // Kiválasztott alkalom (occasion) — a kiválasztott esemény-típus indexe, vagy null (nincs külön alkalom).
  const [occasionIdx, setOccasionIdx] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Mező-szintű validáció (a szalon-wizarddal AZONOS minta: error-placement, blur, focus) ──
  type FieldKey = 'name' | 'email' | 'phone'
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
  }
  const validateField = (key: FieldKey): string | null => {
    if (key === 'name') return name.trim().length < 2 ? tt('rbooking.err.name') : null
    if (key === 'email') return !/^\S+@\S+\.\S+$/.test(email) ? tt('rbooking.err.email') : null
    if (key === 'phone') return requirePhone && phone.replace(/\s/g, '').length < 7 ? tt('rbooking.err.phone') : null
    return null
  }
  const onFieldBlur = (key: FieldKey) => setErrors(prev => ({ ...prev, [key]: validateField(key) ?? undefined }))
  const clearError = (key: FieldKey) => { if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined })) }

  // Slot-lekérés ha pax vagy date változik. A retry-gomb ugyanezt hívja újra (checklist §8:
  // error-recovery) — némán ürítés helyett a hibát a nézetben, retry-gombbal kezeljük.
  const [slotsReloadKey, setSlotsReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    setTime(null)
    setSlotsError(false)
    setLoadingSlots(true)
    const q = new URLSearchParams({ restaurantId: String(restaurantId), date, pax: String(pax) })
    fetch(`/api/restaurant/slots?${q}`)
      .then((r) => { if (!r.ok) throw new Error('slots'); return r.json() })
      .then((d) => {
        if (cancelled) return
        const next = d.slots ?? []
        setSlots(next)
        // A landingről érkező kívánt időpont előválasztása (csak ha még szabad)
        if (initialTime && next.some((s: { start: string }) => s.start === initialTime)) {
          setTime(initialTime)
        }
      })
      .catch(() => { if (!cancelled) { setSlots([]); setSlotsError(true) } })
      .finally(() => { if (!cancelled) setLoadingSlots(false) })
    return () => { cancelled = true }
    // initialTime szándékosan kimarad: csak a date/pax váltás (és a retry) triggereli újra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, date, pax, slotsReloadKey])

  const validateDetails = (): boolean => {
    const order: FieldKey[] = ['name', 'email', 'phone']
    const nextErrors: Partial<Record<FieldKey, string>> = {}
    for (const key of order) {
      const msg = validateField(key)
      if (msg) nextErrors[key] = msg
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstBad = order.find(k => nextErrors[k])
      if (firstBad) fieldRefs[firstBad].current?.focus()
      return false
    }
    return true
  }

  const submit = async () => {
    if (!time) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/restaurant/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId, date, start_time: time, pax,
          customer_name: name.trim(),
          customer_email: email.trim(),
          // A teljes nemzetközi szám (előhívó + helyi), és az ország ISO-kódja külön.
          customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : undefined,
          country,
          customer_city: city.trim() || undefined,
          notes: notes.trim() || undefined,
          ...(occasionIdx != null && eventTypes[occasionIdx]
            ? { occasion: eventTypes[occasionIdx].label, occasion_icon: eventTypes[occasionIdx].icon }
            : {}),
          locale,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? tt('rbooking.err.generic'))
      if (onSuccess) onSuccess(date, time!, pax)
      else router.push(`/${slug}/book/success`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt('rbooking.err.generic'))
      setSubmitting(false)
    }
  }

  const cardClass = dk
    ? 'rounded-[20px] border border-white/10 p-5'
    : 'rounded-[20px] bg-white shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_38px_-30px_rgba(80,70,30,0.22)] p-5'
  const cardStyle = dk ? { background: 'rgba(255,255,255,0.07)' } : undefined
  const inputClass = dk
    ? 'w-full h-11 rounded-[12px] border border-white/[0.15] px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold bg-transparent'
    : 'w-full h-11 rounded-[12px] bg-paper/50 border-0 px-4 text-sm text-ink placeholder:text-ink-soft2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold'
  const phoneInputClass = dk
    ? 'h-11 rounded-[12px] border border-white/[0.15] px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold bg-transparent'
    : 'h-11 rounded-[12px] bg-paper/50 border-0 px-4 text-sm text-ink placeholder:text-ink-soft2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold'
  const labelCls = dk ? 'text-white/50' : 'text-ink-soft'
  const textCls = dk ? 'text-white' : 'text-ink'
  const btnBackCls = dk
    ? 'h-10 w-10 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors shrink-0'
    : 'h-10 w-10 rounded-full bg-white shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_38px_-30px_rgba(80,70,30,0.22)] flex items-center justify-center text-ink-soft hover:bg-paper/50 transition-colors shrink-0'

  const selectedDateObj = new Date(date + 'T00:00:00')

  return (
    <div>
      {/* Fejléc: vissza + lépés-cím + lépés-indikátor */}
      <div className="flex items-center gap-3 mb-5">
        {step > 0 ? (
          <button onClick={() => goStep(step - 1)} className={btnBackCls}>
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : onBack ? (
          <button onClick={onBack} className={btnBackCls}>
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-10 w-10 shrink-0" />
        )}
        <div className="flex-1 text-center">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${labelCls}`}>{tt("rbooking.header")}</p>
          <p className={`text-sm font-semibold ${textCls}`}>{STEPS[step]}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 w-10 justify-end">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i < step
                  ? `h-1.5 w-1.5 rounded-full ${dk ? 'bg-white/50' : 'bg-ink-dark'}`
                  : i === step
                    ? `h-1.5 w-5 rounded-full ${dk ? 'bg-white' : 'bg-ink-dark'}`
                    : `h-1.5 w-1.5 rounded-full ${dk ? 'bg-white/15' : 'bg-black/[0.06]'}`
              }
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          variants={stepSlide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepSlideTransition}
          className="space-y-5"
        >
          {/* Step 0: Létszám + dátum + időpont (egy lapon, mint a szalon) */}
          {step === 0 && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0 }}
              >
              <div className={cardClass} style={cardStyle}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] mb-3 ${labelCls}`}>{tt("rbooking.partySize")}</p>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setPax((p) => Math.max(1, p - 1))}
                    className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${dk ? 'border border-white/15 text-white/60 hover:border-gold hover:text-white' : 'border border-line text-ink-soft hover:border-gold'}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className={`text-3xl font-semibold tabular-nums w-16 text-center ${textCls}`}>{pax}</span>
                  <button
                    onClick={() => setPax((p) => Math.min(maxPax, p + 1))}
                    className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${dk ? 'border border-white/15 text-white/60 hover:border-gold hover:text-white' : 'border border-line text-ink-soft hover:border-gold'}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0.07 }}
              >
              <div className={cardClass} style={cardStyle}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] mb-3 ${labelCls}`}>{tt("rbooking.when")}</p>
                <DateStrip selected={date} onChange={setDate} dayCount={bookingWindowDays} locale={locale} dark={dk} />
              </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
              >
              <div className={cardClass} style={cardStyle}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] mb-4 ${labelCls}`}>{tt("rbooking.time")}</p>
                {loadingSlots ? (
                  <div className="flex justify-center py-6"><Loader2 className={`h-5 w-5 animate-spin ${labelCls}`} /></div>
                ) : slotsError ? (
                  <div className="py-6 text-center" role="alert">
                    <p className={`text-sm ${labelCls}`}>{tt('rbooking.err.slots')}</p>
                    <button
                      onClick={() => setSlotsReloadKey((k) => k + 1)}
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90 ${dk ? 'bg-white/15 text-white border border-white/20' : 'bg-ink-dark text-white'}`}
                    >
                      {tt('rbooking.retry')}
                    </button>
                  </div>
                ) : slots.length === 0 ? (
                  <p className={`text-sm text-center py-6 ${labelCls}`}>{tt("rbooking.noSlots")}</p>
                ) : (
                  <motion.div
                    key={`${date}-${slots.length}`}
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-4 sm:grid-cols-5 gap-2"
                  >
                    {slots.map((s) => (
                      <motion.button
                        key={s.start}
                        variants={fadeUp}
                        onClick={() => { setTime(s.start); goStep(1) }}
                        title={s.onlyOutdoor ? 'Erre az időpontra már csak teraszra (kültéri) foglalható' : undefined}
                        className={`relative h-10 rounded-[12px] border text-sm font-medium tabular-nums transition-colors ${
                          time === s.start
                            ? 'bg-gold text-ink-dark border-gold'
                            : dk
                              ? 'border-white/15 text-white/70 hover:border-gold hover:text-white'
                              : 'bg-paper/50 border-line text-ink-soft hover:border-gold'
                        }`}
                        style={dk && time !== s.start ? { background: 'rgba(255,255,255,0.08)' } : undefined}
                      >
                        {s.start}
                        {s.onlyOutdoor && (
                          <Trees className={`absolute right-1 top-1 h-2.5 w-2.5 ${time === s.start ? 'text-ink-dark/70' : 'text-emerald-400'}`} />
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
              </motion.div>
            </>
          )}

          {/* Step 1: Adatok */}
          {step === 1 && (
            <>
              {/* Összegző kártya */}
              <div className="bg-ink-dark rounded-[20px] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-white/60 text-xs font-medium mb-1">{tt("rbooking.summary")}</p>
                  <p className="text-gold font-semibold text-base">{tt('rbooking.guests', { n: pax })}</p>
                  <p className="text-white/60 text-xs mt-1">{format(selectedDateObj, 'MMM d.', { locale: dfLocale(locale) })} · {time}</p>
                </div>
                {time && slots.find((s) => s.start === time)?.onlyOutdoor && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1.5 text-xs font-medium shrink-0">
                    <Trees className="h-3.5 w-3.5" /> Terasz
                  </span>
                )}
              </div>

              <div className={`${cardClass} space-y-3`} style={cardStyle}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${labelCls}`}>{tt("rbooking.details")}</p>
                <div>
                  <input
                    ref={fieldRefs.name}
                    className={cn(inputClass, errors.name && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                    placeholder={tt("rbooking.field.name")}
                    aria-label={tt("rbooking.field.name")}
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearError('name') }}
                    onBlur={() => onFieldBlur('name')}
                    autoComplete="name"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'rbk-name-err' : undefined}
                  />
                  {errors.name && <p id="rbk-name-err" role="alert" className="mt-1 text-[12px] text-red-500">{errors.name}</p>}
                </div>
                <div>
                  <input
                    ref={fieldRefs.email}
                    className={cn(inputClass, errors.email && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={tt("rbooking.field.email")}
                    aria-label={tt("rbooking.field.email")}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                    onBlur={() => onFieldBlur('email')}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'rbk-email-err' : undefined}
                  />
                  {errors.email && <p id="rbk-email-err" role="alert" className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
                </div>
                <div>
                  <PhoneCountryInput
                    inputRef={fieldRefs.phone}
                    country={country}
                    phone={phone}
                    onCountryChange={setCountry}
                    onPhoneChange={(p) => { setPhone(p); clearError('phone') }}
                    onBlur={() => onFieldBlur('phone')}
                    required={requirePhone}
                    inputClass={cn(
                      phoneInputClass,
                      errors.phone && 'ring-2 ring-red-400 focus-visible:ring-red-400'
                    )}
                  />
                  {errors.phone && <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.phone}</p>}
                </div>
                <input className={inputClass} autoComplete="address-level2" placeholder={tt('rbooking.field.city')} aria-label={tt('rbooking.field.city')} value={city} onChange={(e) => setCity(e.target.value)} />
                <textarea className={`${inputClass} h-auto py-2.5 min-h-[72px] resize-none`} placeholder={tt("rbooking.field.note")} aria-label={tt("rbooking.field.note")} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* Alkalom-választó — a tulaj esemény-típusaiból, Lucide-ikonos pillekkel. Opcionális. */}
              {eventTypes.length > 0 && (
                <div className={`${cardClass} space-y-3`} style={cardStyle}>
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${labelCls}`}>{tt('rbooking.occasion')}</p>
                    <p className={`mt-0.5 text-[12px] ${dk ? 'text-white/40' : 'text-ink-soft2'}`}>{tt('rbooking.occasionHint')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOccasionIdx(null)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        occasionIdx === null
                          ? 'bg-gold text-ink-dark border-gold'
                          : dk
                            ? 'border-white/15 text-white/60 hover:border-gold hover:text-white'
                            : 'bg-paper/50 border-line text-ink-soft hover:border-gold'
                      }`}
                      style={dk && occasionIdx !== null ? { background: 'rgba(255,255,255,0.08)' } : undefined}
                    >
                      {tt('rbooking.occasionNone')}
                    </button>
                    {eventTypes.map((et, i) => {
                      const Icon = eventIconByKey(et.icon)
                      const active = occasionIdx === i
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setOccasionIdx(active ? null : i)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                            active
                              ? 'bg-gold text-ink-dark border-gold'
                              : dk
                                ? 'border-white/15 text-white/60 hover:border-gold hover:text-white'
                                : 'bg-paper/50 border-line text-ink-soft hover:border-gold'
                          }`}
                          style={dk && !active ? { background: 'rgba(255,255,255,0.08)' } : undefined}
                        >
                          <Icon className={`h-4 w-4 ${active ? 'text-ink-dark' : dk ? 'text-white/50' : 'text-ink-soft'}`} strokeWidth={1.8} />
                          {et.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => { if (validateDetails()) goStep(2) }}
                className={`group w-full h-14 rounded-[16px] font-semibold text-sm hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 ${
                  dk ? 'bg-gold text-ink-dark' : 'bg-ink-dark text-white'
                }`}
              >
                {tt('booking.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Step 2: Összefoglalás + megerősítés */}
          {step === 2 && (
            <>
              {/* Foglalás összegzése */}
              <div className="bg-ink-dark rounded-[20px] p-5">
                <p className="text-white/60 text-xs font-medium mb-1">{tt('rbooking.summary')}</p>
                <p className="text-gold font-semibold text-lg">{tt('rbooking.guests', { n: pax })}</p>
                <p className="text-white/60 text-sm mt-1">{format(selectedDateObj, 'MMM d.', { locale: dfLocale(locale) })} · {time}</p>
                {occasionIdx !== null && eventTypes[occasionIdx] && (
                  <p className="text-white/50 text-xs mt-2">{eventTypes[occasionIdx].label}</p>
                )}
              </div>

              {/* Személyes adatok áttekintése */}
              <div className={cardClass} style={cardStyle}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] mb-3 ${labelCls}`}>{tt('rbooking.details')}</p>
                <div className="space-y-0">
                  {[
                    { label: tt('rbooking.field.name'), value: name.trim() || null },
                    { label: tt('rbooking.field.email'), value: email.trim() || null },
                    { label: tt('rbooking.field.email').replace('Email', 'Tel'), value: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : null },
                    { label: tt('rbooking.field.city'), value: city.trim() || null },
                    { label: tt('rbooking.field.note'), value: notes.trim() || null },
                  ].filter(({ value }) => value !== null).map(({ label, value }) => (
                    <div key={label} className={`flex justify-between gap-4 py-2.5 border-b ${dk ? 'border-white/[0.07]' : 'border-line/60'} last:border-0`}>
                      <span className={`text-[12px] shrink-0 ${labelCls}`}>{label}</span>
                      <span className={`text-[13px] font-medium text-right ${textCls}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Megerősítés gomb */}
              <button
                onClick={submit}
                disabled={submitting}
                className={`group w-full h-14 rounded-[16px] font-semibold text-sm hover:opacity-90 transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 ${
                  dk ? 'bg-gold text-ink-dark' : 'bg-ink-dark text-white'
                }`}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{tt('rbooking.submitting')}</>
                ) : (
                  <>{tt('rbooking.confirm')}<HoverArrow className="h-4 w-4" /></>
                )}
              </button>
              {((termsSections && termsSections.length > 0) || company) && (
                <div className={`text-center text-xs ${dk ? 'text-white/40' : 'text-ink-soft'}`}>
                  {tt('rbooking.termsPrefix')}{' '}
                  <TermsModal sections={termsSections} company={company} locale={locale} />
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
