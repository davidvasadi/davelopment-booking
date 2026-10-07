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
import { DepositStep } from '@/components/booking/DepositStep'
import { Switch } from '@/components/ui/toggle-switch'
import { trackBookingConversion } from '@/lib/marketingTracking'
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
  depositEnabled = false,
  invoicingEnabled = false,
  addressRequired = false,
  addressRequiredNote = null,
  voucherEnabled = false,
  newsletterEnabled = false,
  consentEnabled = false,
  consentTitle = null,
  consentText = null,
  customQuestions = null,
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
  /** `extra`: a visszaigazoló képernyőhöz — megerősített-e, .ics-token, adott-e meg e-mailt, alkalom. */
  onSuccess?: (date: string, time: string, pax: number, extra?: { confirmed: boolean; icsToken: string | null; hasEmail: boolean; occasion: string | null }) => void
  variant?: 'light' | 'dark'
  initialDateProp?: string
  initialTimeProp?: string
  initialPaxProp?: number
  /** Vendég-előleg — ha KI van kapcsolva, a wizard a mai viselkedést mutatja bit-pontosan. */
  depositEnabled?: boolean
  invoicingEnabled?: boolean
  addressRequired?: boolean
  addressRequiredNote?: string | null
  voucherEnabled?: boolean
  newsletterEnabled?: boolean
  consentEnabled?: boolean
  consentTitle?: string | null
  consentText?: string | null
  customQuestions?: {
    id?: string | null
    label: string
    type?: string | null
    options?: { id?: string | null; value?: string | null }[] | null
    required?: boolean | null
  }[] | null
}) {
  const dk = variant === 'dark'
  const router = useRouter()
  const tt = makeT(locale)
  // A review-lépés indexe: nincs előleg/nyilatkozat → MARAD 2 (mai viselkedés, változatlan).
  // Van előleg és/vagy nyilatkozat → 1-2 új lépés ékelődik a details ÉS a review közé.
  const DEPOSIT_STEP = depositEnabled ? 2 : null
  const CONSENT_STEP = consentEnabled ? 2 + (depositEnabled ? 1 : 0) : null
  const REVIEW_STEP = 2 + (depositEnabled ? 1 : 0) + (consentEnabled ? 1 : 0)
  const STEPS = [
    tt('rbooking.step.datetime'), tt('rbooking.step.details'),
    ...(depositEnabled ? [tt('public.deposit.title')] : []),
    ...(consentEnabled ? [consentTitle?.trim() || tt('public.consent.title')] : []),
    tt('rbooking.step.review'),
  ]
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
  const [address, setAddress] = useState('')
  const [isCompany, setIsCompany] = useState(false)
  const [taxNumber, setTaxNumber] = useState('')
  const [notes, setNotes] = useState('')
  // GDPR opt-in — SOSE előre kipipált, a foglaláskor mentődik tartósan a Customers táblába.
  const [marketingConsent, setMarketingConsent] = useState(false)
  // Beleegyező nyilatkozat elfogadása — SOSE előre bekapcsolva, per-foglalás mentődik.
  const [consentGiven, setConsentGiven] = useState(false)
  // Egyedi kérdések válaszai — kérdés-id kulccsal, a details lépésben töltve ki.
  const customQuestionsList = customQuestions ?? []
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  // Kiválasztott alkalom (occasion) — a kiválasztott esemény-típus indexe, vagy null (nincs külön alkalom).
  const [occasionIdx, setOccasionIdx] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [depositAmountHuf, setDepositAmountHuf] = useState<number | null>(null)

  // Ajándékutalvány-beváltás — opcionális mező a details lépésen.
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemChecking, setRedeemChecking] = useState(false)
  const [redeemValid, setRedeemValid] = useState<{ amount_huf: number } | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const checkRedeemCode = async () => {
    const code = redeemCode.trim()
    if (!code) { setRedeemValid(null); setRedeemError(null); return }
    setRedeemChecking(true)
    setRedeemError(null)
    try {
      const params = new URLSearchParams({ code, restaurantId: String(restaurantId) })
      const res = await fetch(`/api/vouchers/validate?${params}`)
      const json = await res.json()
      if (json.valid) setRedeemValid({ amount_huf: json.amount_huf })
      else { setRedeemValid(null); setRedeemError(json.reason ?? 'Érvénytelen kód.') }
    } catch {
      setRedeemValid(null)
      setRedeemError('Nem sikerült ellenőrizni a kódot.')
    } finally {
      setRedeemChecking(false)
    }
  }

  // ── Mező-szintű validáció (a szalon-wizarddal AZONOS minta: error-placement, blur, focus) ──
  type FieldKey = 'name' | 'email' | 'phone' | 'city' | 'address' | 'taxNumber'
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [detailsShakeKey, setDetailsShakeKey] = useState(0)
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    address: useRef<HTMLInputElement>(null),
    taxNumber: useRef<HTMLInputElement>(null),
  }
  // Cím/város kötelezővé válik előlegnél VAGY ha a cég külön bekapcsolta (deposit nélkül is).
  const addressGateOn = depositEnabled || addressRequired
  const addressNote = addressRequiredNote?.trim()
    || (depositEnabled ? 'Az előleg-számlázáshoz kötelező.' : 'A pontos cím megadására a foglalásod rögzítéséhez van szükségünk.')

  const validateField = (key: FieldKey): string | null => {
    if (key === 'name') return name.trim().length < 2 ? tt('rbooking.err.name') : null
    if (key === 'email') return !/^\S+@\S+\.\S+$/.test(email) ? tt('rbooking.err.email') : null
    if (key === 'phone') return requirePhone && phone.replace(/\s/g, '').length < 7 ? tt('rbooking.err.phone') : null
    if (key === 'city') return addressGateOn && !city.trim() ? 'A város megadása kötelező' : null
    if (key === 'address') return addressGateOn && !address.trim() ? 'A cím (utca, házszám) megadása kötelező' : null
    if (key === 'taxNumber') return isCompany && !taxNumber.trim() ? 'Céges vásárlásnál az adószám megadása kötelező.' : null
    return null
  }
  const onFieldBlur = (key: FieldKey) => setErrors(prev => ({ ...prev, [key]: validateField(key) ?? undefined }))
  const clearError = (key: FieldKey) => { if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined })) }

  const validateCustomQuestion = (q: NonNullable<typeof customQuestions>[number]): string | null => {
    if (!q.required || q.type === 'yesno') return null
    const val = customAnswers[q.id ?? ''] ?? ''
    return val.trim() ? null : 'Kötelező mező'
  }

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
    const order: FieldKey[] = ['name', 'email', 'phone', 'city', 'address', ...(depositEnabled && isCompany ? (['taxNumber'] as FieldKey[]) : [])]
    const nextErrors: Partial<Record<FieldKey, string>> = {}
    for (const key of order) {
      const msg = validateField(key)
      if (msg) nextErrors[key] = msg
    }
    const nextCustomErrors: Record<string, string> = {}
    for (const q of customQuestionsList) {
      const msg = validateCustomQuestion(q)
      if (msg && q.id) nextCustomErrors[q.id] = msg
    }
    if (Object.keys(nextErrors).length > 0 || Object.keys(nextCustomErrors).length > 0) {
      setErrors(nextErrors)
      setCustomErrors(nextCustomErrors)
      setDetailsShakeKey(k => k + 1)
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
          customer_address: address.trim() || undefined,
          ...(depositEnabled && isCompany && taxNumber.trim() ? { customer_tax_number: taxNumber.trim() } : {}),
          notes: notes.trim() || undefined,
          ...(occasionIdx != null && eventTypes[occasionIdx]
            ? { occasion: eventTypes[occasionIdx].label, occasion_icon: eventTypes[occasionIdx].icon }
            : {}),
          locale,
          ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
          ...(redeemValid && redeemCode.trim() ? { voucher_code: redeemCode.trim().toUpperCase() } : {}),
          ...(newsletterEnabled && marketingConsent ? { marketing_consent: true } : {}),
          ...(consentEnabled ? { consent_accepted: consentGiven } : {}),
          ...(customQuestionsList.length > 0
            ? { custom_answers: customQuestionsList.filter(q => q.id).map(q => ({ id: q.id as string, answer: customAnswers[q.id as string] ?? '' })) }
            : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? tt('rbooking.err.generic'))
      trackBookingConversion()
      if (onSuccess) onSuccess(date, time!, pax, {
        confirmed: data.status !== 'pending',
        icsToken: typeof data.cancel_token === 'string' ? data.cancel_token : null,
        hasEmail: !!email.trim(),
        occasion: occasionIdx != null ? eventTypes[occasionIdx]?.label ?? null : null,
      })
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
                <div key={`name-${detailsShakeKey}`} className={cn(errors.name && 'animate-shake')}>
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
                <div key={`email-${detailsShakeKey}`} className={cn(errors.email && 'animate-shake')}>
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
                <div key={`phone-${detailsShakeKey}`} className={cn(errors.phone && 'animate-shake')}>
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
                <div key={`city-${detailsShakeKey}`} className={cn(errors.city && 'animate-shake')}>
                  <input
                    ref={fieldRefs.city}
                    className={cn(inputClass, errors.city && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                    autoComplete="address-level2"
                    placeholder={addressGateOn ? `${tt('rbooking.field.city').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('rbooking.field.city')}
                    aria-label={addressGateOn ? tt('rbooking.field.city').replace(/\s*\([^)]*\)\s*$/, '') : tt('rbooking.field.city')}
                    aria-invalid={!!errors.city}
                    value={city}
                    onChange={(e) => { setCity(e.target.value); clearError('city') }}
                    onBlur={() => onFieldBlur('city')}
                  />
                  {errors.city && <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.city}</p>}
                  {addressGateOn && !errors.city && <p className={`mt-1 text-[11px] ${labelCls}`}>{addressNote}</p>}
                </div>
                <div key={`address-${detailsShakeKey}`} className={cn(errors.address && 'animate-shake')}>
                  <input
                    ref={fieldRefs.address}
                    className={cn(inputClass, errors.address && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                    autoComplete="street-address"
                    placeholder={addressGateOn ? `${tt('booking.field.address').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('booking.field.address')}
                    aria-label={addressGateOn ? tt('booking.field.address').replace(/\s*\([^)]*\)\s*$/, '') : tt('booking.field.address')}
                    aria-invalid={!!errors.address}
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); clearError('address') }}
                    onBlur={() => onFieldBlur('address')}
                  />
                  {errors.address && <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.address}</p>}
                  {addressGateOn && !errors.address && <p className={`mt-1 text-[11px] ${labelCls}`}>{addressNote}</p>}
                </div>
                {depositEnabled && invoicingEnabled && (
                  <>
                    <div className={cn('flex items-center justify-between gap-3 rounded-[12px] px-3.5 py-3', dk ? 'bg-white/[0.06]' : 'bg-paper')}>
                      <span className={`text-[13px] ${textCls}`}>{tt('public.voucher.companyToggle')}</span>
                      <Switch checked={isCompany} onChange={setIsCompany} ariaLabel={tt('public.voucher.companyToggle')} />
                    </div>
                    {isCompany && (
                      <div key={`taxNumber-${detailsShakeKey}`} className={cn(errors.taxNumber && 'animate-shake')}>
                        <input
                          ref={fieldRefs.taxNumber}
                          className={cn(inputClass, errors.taxNumber && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                          placeholder="12345678-1-42"
                          aria-label={tt('public.voucher.taxNumber')}
                          aria-invalid={!!errors.taxNumber}
                          value={taxNumber}
                          onChange={(e) => { setTaxNumber(e.target.value); clearError('taxNumber') }}
                          onBlur={() => onFieldBlur('taxNumber')}
                        />
                        {errors.taxNumber ? <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.taxNumber}</p> : <p className={`mt-1 text-[11px] ${labelCls}`}>{tt('public.voucher.taxNumberHint')}</p>}
                      </div>
                    )}
                  </>
                )}
                {customQuestionsList.map((q) => {
                  const key = q.id ?? ''
                  const val = customAnswers[key] ?? ''
                  const err = customErrors[key]
                  if (q.type === 'yesno') {
                    return (
                      <div key={key} className="flex items-center justify-between gap-4 py-1">
                        <span className={`text-[13px] font-medium ${textCls}`}>{q.label}</span>
                        <Switch
                          checked={val === 'Igen'}
                          onChange={(v) => setCustomAnswers(a => ({ ...a, [key]: v ? 'Igen' : 'Nem' }))}
                          ariaLabel={q.label}
                        />
                      </div>
                    )
                  }
                  if (q.type === 'select') {
                    return (
                      <div key={`${key}-${detailsShakeKey}`} className={cn(err && 'animate-shake')}>
                        <select
                          value={val}
                          onChange={(e) => { setCustomAnswers(a => ({ ...a, [key]: e.target.value })); setCustomErrors(er => ({ ...er, [key]: '' })) }}
                          aria-label={q.label}
                          className={cn(inputClass, err && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                        >
                          <option value="">{q.label}{q.required ? ' *' : ''}</option>
                          {(q.options ?? []).map((o, oi) => o.value ? (
                            <option key={oi} value={o.value}>{o.value}</option>
                          ) : null)}
                        </select>
                        {err && <p role="alert" className="mt-1 text-[12px] text-red-500">{err}</p>}
                      </div>
                    )
                  }
                  return (
                    <div key={`${key}-${detailsShakeKey}`} className={cn(err && 'animate-shake')}>
                      <input
                        className={cn(inputClass, err && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                        placeholder={`${q.label}${q.required ? ' *' : ''}`}
                        aria-label={q.label}
                        aria-invalid={!!err}
                        value={val}
                        onChange={(e) => { setCustomAnswers(a => ({ ...a, [key]: e.target.value })); setCustomErrors(er => ({ ...er, [key]: '' })) }}
                      />
                      {err && <p role="alert" className="mt-1 text-[12px] text-red-500">{err}</p>}
                    </div>
                  )
                })}
                <textarea className={`${inputClass} h-auto py-2.5 min-h-[72px] resize-none`} placeholder={tt("rbooking.field.note")} aria-label={tt("rbooking.field.note")} value={notes} onChange={(e) => setNotes(e.target.value)} />
                {voucherEnabled && (
                  <div className="space-y-2">
                    {!redeemOpen ? (
                      <button
                        type="button"
                        onClick={() => setRedeemOpen(true)}
                        className={`text-[12px] font-medium underline underline-offset-2 transition-colors ${dk ? 'text-white/45 hover:text-white/70' : 'text-ink-soft hover:text-ink'}`}
                      >
                        Van ajándékutalványod?
                      </button>
                    ) : (
                      <div>
                        <input
                          value={redeemCode}
                          onChange={(e) => { setRedeemCode(e.target.value.toUpperCase()); setRedeemValid(null); setRedeemError(null) }}
                          onBlur={checkRedeemCode}
                          placeholder="XXXX-XXXX"
                          className={inputClass}
                        />
                        {redeemChecking && <p className={`mt-1 text-[11px] ${labelCls}`}>Ellenőrzés…</p>}
                        {redeemError && <p role="alert" className="mt-1 text-[12px] text-red-500">{redeemError}</p>}
                        {redeemValid && <p className="mt-1 text-[12px] text-emerald-500">Érvényes utalvány — jóváírva a foglaláskor.</p>}
                      </div>
                    )}
                  </div>
                )}
                {newsletterEnabled && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 py-1">
                      <span className={`text-[13px] ${dk ? 'text-white/70' : 'text-ink'}`}>Szeretnék marketing-ajánlatokat, híreket kapni erről az üzletről</span>
                      <Switch checked={marketingConsent} onChange={setMarketingConsent} ariaLabel="Feliratkozás hírlevélre" />
                    </div>
                    <p className={`text-[11px] ${dk ? 'text-white/40' : 'text-ink-soft2'}`}>
                      Bármikor leiratkozhatok. Részletek: <a href="/privacy#marketing" target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${dk ? 'hover:text-white/70' : 'hover:text-ink'}`}>Adatvédelmi tájékoztató</a>.
                    </p>
                  </div>
                )}
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
                onClick={() => { if (validateDetails()) goStep(DEPOSIT_STEP ?? CONSENT_STEP ?? REVIEW_STEP) }}
                className={`group w-full h-14 rounded-[16px] font-semibold text-sm hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 ${
                  dk ? 'bg-gold text-ink-dark' : 'bg-ink-dark text-white'
                }`}
              >
                {tt('booking.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Step 2 (ha van előleg): Előleg-fizetés */}
          {step === DEPOSIT_STEP && depositEnabled && (
            <div className={cardClass} style={cardStyle}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] mb-3 ${labelCls}`}>{tt('public.deposit.title')}</p>
              {time && (
                <DepositStep
                  dark={dk}
                  requestBody={{ kind: 'restaurant', restaurantId, date, start_time: time, pax, email: email || undefined }}
                  onPaid={(pid, amt) => {
                    setPaymentIntentId(pid)
                    setDepositAmountHuf(amt)
                    goStep(CONSENT_STEP ?? REVIEW_STEP)
                  }}
                />
              )}
            </div>
          )}

          {/* Beleegyező nyilatkozat */}
          {step === CONSENT_STEP && consentEnabled && (
            <div className={cardClass} style={cardStyle}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] mb-3 ${labelCls}`}>{consentTitle?.trim() || tt('public.consent.title')}</p>
              <div
                className={`mb-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-2xl p-4 text-[13.5px] leading-relaxed ${dk ? 'text-white/75' : 'text-ink-soft'}`}
                style={{ background: dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: dk ? '1.5px solid rgba(255,255,255,0.10)' : '1.5px solid rgba(0,0,0,0.06)' }}
              >
                {consentText || 'A szolgáltató még nem adta meg a nyilatkozat szövegét.'}
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <span className={`text-[13px] ${textCls}`}>Elolvastam és elfogadom a fenti nyilatkozatot</span>
                <Switch checked={consentGiven} onChange={setConsentGiven} ariaLabel="Nyilatkozat elfogadása" />
              </div>
              <button
                onClick={() => { if (consentGiven) goStep(REVIEW_STEP) }}
                disabled={!consentGiven}
                className={`group mt-4 w-full h-14 rounded-[16px] font-semibold text-sm hover:opacity-90 transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2 ${
                  dk ? 'bg-gold text-ink-dark' : 'bg-ink-dark text-white'
                }`}
              >
                {tt('booking.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Összefoglalás + megerősítés */}
          {step === REVIEW_STEP && (
            <>
              {/* Összegzés — egy kártyában, ugyanabban a sorrendben, mint a szalon foglalóján
                  (foglalás → vendég adatai → előleg / utalvány). A hosszú értékek törnek. */}
              <h2 className={`text-[22px] font-light tracking-[-0.02em] ${textCls}`}>{tt('booking.summary.title')}</h2>
              <div data-edit-id="summary" className={cn(cardClass, 'py-1')} style={cardStyle}>
                {[
                  { label: tt('rbooking.label.guests'), value: tt('rbooking.guests', { n: pax }) },
                  { label: tt('booking.step.datetime'), value: `${format(selectedDateObj, 'MMM d., EEEE', { locale: dfLocale(locale) })} · ${time}` },
                  { label: tt('rbooking.label.occasion'), value: occasionIdx !== null ? eventTypes[occasionIdx]?.label ?? null : null },
                  { label: tt('booking.field.name'), value: name.trim() || null },
                  { label: tt('booking.field.email'), value: email.trim() || null },
                  { label: tt('booking.field.phone'), value: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : null },
                  { label: tt('booking.field.city'), value: city.trim() || null },
                  { label: tt('booking.field.note'), value: notes.trim() || null },
                  ...(paymentIntentId && depositAmountHuf ? [{ label: 'Előleg (fizetve)', value: `${depositAmountHuf.toLocaleString('hu-HU')} Ft` }] : []),
                  ...(redeemValid && redeemCode.trim() ? [{ label: 'Utalvánnyal fedezve', value: `${redeemValid.amount_huf.toLocaleString('hu-HU')} Ft` }] : []),
                ].filter((r): r is { label: string; value: string } => !!r.value).map(({ label, value }, i, arr) => (
                  <div key={label} className={cn('flex items-start justify-between gap-3 py-2.5', i < arr.length - 1 && (dk ? 'border-b border-white/[0.08]' : 'border-b border-line/60'))}>
                    <span className={`shrink-0 pt-0.5 text-xs ${labelCls}`}>{label.replace(/\s*\*$/, '')}</span>
                    <span className={`min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere] ${textCls}`}>{value}</span>
                  </div>
                ))}
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
                <div data-edit-id="terms" className={`text-center text-xs ${dk ? 'text-white/40' : 'text-ink-soft'}`}>
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
