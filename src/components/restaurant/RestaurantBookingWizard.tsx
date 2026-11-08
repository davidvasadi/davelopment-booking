'use client'

import { useState, useEffect, useRef, Fragment, type ReactNode } from 'react'
import { FORM_FIELD_IDS, type FormFieldId } from '@/components/booking/ProfileCard'
import { GoodToKnowCompact } from '@/components/booking/GoodToKnowSection'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button, FIELD, IconButton } from '@/components/ui-kit'
import { ACCENT, CardDayPicker, CardSlotGrid, cardTone, GLASS_INPUT, type LiveCard } from '@/components/blocks/public'
import { EditableText, useFieldPlaceholder, Txt } from '@/components/booking/EditableText'
import { useDayStrip } from '@/components/booking/useDayStrip'
import { Minus, Plus, Loader2, Trees, ArrowLeft, ChevronRight, HandCoins } from 'lucide-react'
import { restaurantDepositLabel, type DepositInfo } from '@/lib/depositSummary'
import { depositApplies } from '@/lib/depositCalc'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import { PhoneCountryInput } from '@/components/booking/PhoneInputs'
import { COUNTRIES } from '@/components/booking/phoneCountries'
import { HoverArrow } from '@/components/ui/HoverArrow'
import { DepositStep } from '@/components/booking/DepositStep'
import { Switch } from '@/components/ui/toggle-switch'
import { trackBookingConversion } from '@/lib/marketingTracking'
import { stepSlide, stepSlideTransition } from '@/lib/motion'
import { makeT, dfLocale, type Locale } from '@/lib/i18n'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { CountryField } from '@/components/booking/CountryField'
import { defaultCountryFor, isForeignCountry } from '@/lib/countries'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

/** Egy választható esemény-típus (alkalom) a foglalóban. */
export type EventTypeOption = { icon: string; label: string }

export function RestaurantBookingWizard({
  restaurantId,
  slug,
  requirePhone,
  maxPax,
  minPax = 1,
  largeParty = null,
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
  depositEnabled: depositOn = false,
  card,
  depositInfo = null,
  invoicingEnabled = false,
  addressRequired = false,
  addressRequiredNote = null,
  hiddenFields = [],
  addressDetailLevel = 'full',
  voucherEnabled = false,
  newsletterEnabled = false,
  showMarketingConsent = true,
  consentEnabled = false,
  consentTitle = null,
  consentText = null,
  customQuestions = null,
  fieldOrder = null,
  editorStep = null,
  goodToKnow = null,
}: {
  restaurantId: string | number
  slug: string
  requirePhone: boolean
  maxPax: number
  /** a legkisebb online létszám */
  minPax?: number
  /** a legnagyobb online létszámnál: hogyan érheti el a nagyobb társaság az éttermet (null = nincs külön határ) */
  largeParty?: { phone: string | null; email: string | null } | null
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
  /** előleg-összefoglaló a vendégnek (összeg + díjmentes lemondás) */
  depositInfo?: DepositInfo | null
  invoicingEnabled?: boolean
  addressRequired?: boolean
  addressRequiredNote?: string | null
  /** Teljesen elrejtett foglalási mezők (nem csak opcionális) — ld. ProfileCard ugyanilyen propja. */
  hiddenFields?: ('phone' | 'notes')[]
  /** Cím-mező részletessége — ld. ProfileCard ugyanilyen propja. */
  addressDetailLevel?: 'off' | 'city' | 'full'
  voucherEnabled?: boolean
  newsletterEnabled?: boolean
  showMarketingConsent?: boolean
  consentEnabled?: boolean
  consentTitle?: string | null
  consentText?: string | null
  /** `booking_rules.form_field_order` — az Adatok lépés mezőinek sorrendje. Üres = alapsorrend. */
  fieldOrder?: string[] | null
  /** „Jó tudni” pontok — az Összegzés lépésen, ugyanúgy, mint a szalon foglalóján. */
  goodToKnow?: { id?: string | null; icon?: string | null; title?: string | null; body?: string | null }[] | null
  /** Szerkesztő-előnézet: erre a lépésre ugrik mintaadatokkal (null = normál működés). */
  /** a foglaló kártya stílusa (design 21.2) — a sötét / világos változat ebből jön */
  card?: LiveCard
  editorStep?: 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' | null
  customQuestions?: {
    id?: string | null
    label: string
    type?: string | null
    options?: { id?: string | null; value?: string | null }[] | null
    required?: boolean | null
  }[] | null
}) {
  // a kártya stílusa (design 21.2): sötét üveg / fekete / világos üveg → sötét változat, fehér → világos
  const c = cardTone(card ?? (variant === 'dark' ? 'dark' : 'white'))
  const dk = c.dark
  const router = useRouter()
  const tt = makeT(locale)
  const formFieldOrder: FormFieldId[] = [
    ...(fieldOrder ?? []).filter((id): id is FormFieldId => (FORM_FIELD_IDS as readonly string[]).includes(id)),
    ...FORM_FIELD_IDS.filter((id) => !(fieldOrder ?? []).includes(id)),
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

  // Szerkesztő-előnézet: a kért lépésre ugrunk mintaadatokkal (holnap 19:00, minta vendég).
  useEffect(() => {
    if (!editorStep) return
    setDate(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'))
    setTime('19:00')
    setName('Minta Vendég')
    setEmail('vendeg@pelda.hu')
    setPhone('30 123 4567')
    const target = editorStep === 'datetime' ? 0 : editorStep === 'details' ? 1
      : editorStep === 'deposit' ? (DEPOSIT_STEP ?? 1) : editorStep === 'consent' ? (CONSENT_STEP ?? 1) : REVIEW_STEP
    setDir(1)
    setStep(target)
  }, [editorStep]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pax, setPax] = useState(initialPax >= minPax && initialPax <= maxPax ? initialPax : Math.min(maxPax, Math.max(minPax, 2)))
  const [date, setDate] = useState(() =>
    initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : format(new Date(), 'yyyy-MM-dd'),
  )
  // „Mely foglalásoknál” (16.1): az előleg-lépés csak akkor van, ha a választott nap és létszám mellett kell előleg —
  // ugyanaz a szabály, mint a szerveren (`depositApplies`). A szerkesztő-előnézetben mindig látszik.
  const depositEnabled = depositOn && (!!editorStep || !depositInfo || depositApplies(depositInfo.settings, { date, pax }))
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
  // számlázási ország (előleg-számla) — a `country` a telefonszám országa; ez a számláé (lib/countries)
  const [billingCountry, setBillingCountry] = useState(() => defaultCountryFor(locale))
  const [billingCountryErr, setBillingCountryErr] = useState<string | null>(null)
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
  // Cím/város kötelezővé válik előlegnél VAGY ha a cég külön bekapcsolta (deposit nélkül is) —
  // ez FELÜLÍRJA a tulaj kikapcsolás-szándékát (számlázáshoz kell az előlegnél).
  const addressGateOn = depositEnabled || addressRequired
  // a mezők helykitöltője: az üzlet saját szövege (a szerkesztőben a kijelölt mezőbe írva ezt írod át)
  const phName = useFieldPlaceholder('name', tt('rbooking.field.name'))
  const phEmail = useFieldPlaceholder('email', tt('rbooking.field.email'))
  const phAddress = useFieldPlaceholder('address', addressGateOn ? `${tt('booking.field.address').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('booking.field.address'))
  const phNotes = useFieldPlaceholder('notes', tt('rbooking.field.note'))
  const phCity = useFieldPlaceholder('city', addressGateOn ? `${tt('rbooking.field.city').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('rbooking.field.city'), 'field:address')
  const effectiveAddressLevel = addressGateOn ? 'full' : addressDetailLevel
  const addressVisible = effectiveAddressLevel !== 'off'
  const addressCityOnly = effectiveAddressLevel === 'city'
  const phoneVisible = !hiddenFields.includes('phone')
  const notesVisible = !hiddenFields.includes('notes')
  const marketingVisible = newsletterEnabled && showMarketingConsent
  const addressNote = addressRequiredNote?.trim()
    || (depositEnabled ? 'A foglaló bizonylatához kötelező.' : 'A pontos cím megadására a foglalásod rögzítéséhez van szükségünk.')

  const validateField = (key: FieldKey): string | null => {
    if (key === 'name') return name.trim().length < 2 ? tt('rbooking.err.name') : null
    if (key === 'email') return !/^\S+@\S+\.\S+$/.test(email) ? tt('rbooking.err.email') : null
    if (key === 'phone') return phoneVisible && requirePhone && phone.replace(/\s/g, '').length < 7 ? tt('rbooking.err.phone') : null
    if (key === 'city') return addressGateOn && !city.trim() ? 'A város megadása kötelező' : null
    if (key === 'address') return addressGateOn && !addressCityOnly && !address.trim() ? 'A cím (utca, házszám) megadása kötelező' : null
    if (key === 'taxNumber') return isCompany && !taxNumber.trim() ? 'Céges vásárlásnál az adószám megadása kötelező.' : null
    return null
  }
  // a szerkesztő előnézetében nincs hibaüzenet (ott nem a vendég tölti ki)
  const onFieldBlur = (key: FieldKey) => { if (!editorStep) setErrors(prev => ({ ...prev, [key]: validateField(key) ?? undefined })) }
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
    const order: FieldKey[] = ['name', 'email', ...(phoneVisible ? (['phone'] as FieldKey[]) : []), 'city', 'address', ...(depositEnabled && isCompany && !isForeignCountry(billingCountry) ? (['taxNumber'] as FieldKey[]) : [])]
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
    // a számlázási ország az előleg-számlához kötelező
    const countryMissing = depositEnabled && invoicingEnabled && !billingCountry
    setBillingCountryErr(countryMissing ? tt('booking.field.countryRequired') : null)
    if (countryMissing || Object.keys(nextErrors).length > 0 || Object.keys(nextCustomErrors).length > 0) {
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
          ...(depositEnabled && isCompany && !isForeignCountry(billingCountry) && taxNumber.trim() ? { customer_tax_number: taxNumber.trim() } : {}),
          ...(depositEnabled && invoicingEnabled && billingCountry ? { customer_country: billingCountry } : {}),
          notes: notes.trim() || undefined,
          ...(occasionIdx != null && eventTypes[occasionIdx]
            ? { occasion: eventTypes[occasionIdx].label, occasion_icon: eventTypes[occasionIdx].icon }
            : {}),
          locale,
          ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
          ...(redeemValid && redeemCode.trim() ? { voucher_code: redeemCode.trim().toUpperCase() } : {}),
          ...(marketingVisible && marketingConsent ? { marketing_consent: true } : {}),
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

  // design 21.10: a lépések laposak (nincs belső doboz), a mezők a design mezői, a címek a kit címei
  const cardClass = ''
  const cardStyle = undefined
  const inputClass = dk ? `${GLASS_INPUT} placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/20` : `${FIELD} h-11`
  const phoneInputClass = inputClass
  const labelCls = c.meta
  const textCls = ''

  const selectedDateObj = new Date(date + 'T00:00:00')
  // a napok sora: görgethető, mától a foglalási ablak végéig; ahol a létszámnak nincs online asztal, sötétebb (mint a szalonnál)
  const { days: pickDays, stripRef } = useDayStrip({
    daysUrl: `/api/restaurant/slots/days?${new URLSearchParams({ restaurantId: String(restaurantId), pax: String(pax) })}`,
    windowDays: bookingWindowDays, selected: date, onAutoPick: setDate,
    dfLocale: dfLocale(locale), todayLabel: tt('nextSlots.today'),
  })

  return (
    <div>
      {/* Fejléc (design 21.10): vissza, pötty-haladás, „1/3” — az első lépésen a vissza mobilon a lapot zárja */}
      <div className="mb-5 flex items-center justify-between">
        {step > 0
          ? <IconButton icon={ArrowLeft} label={tt('public.back')} size="sm" variant={dk ? 'onDark' : 'cell'} onClick={() => goStep(step - 1)} />
          : onBack ? <span className="lg:invisible"><IconButton icon={ArrowLeft} label={tt('public.back')} size="sm" variant={dk ? 'onDark' : 'cell'} onClick={onBack} /></span> : <span className="h-9 w-9" />}
        <span className="flex items-center gap-1.5">
          {STEPS.map((_, i) => <span key={i} className={`block h-2 shrink-0 rounded-full transition-all duration-300 ${i === step ? `w-7 ${dk ? 'bg-white' : 'bg-ui-dark'}` : `w-2 ${dk ? 'bg-white/30' : 'bg-ui-dark/20'}`}`} />)}
        </span>
        <span className={`text-ui-meta tabular-nums ${c.meta}`}>{step + 1}/{STEPS.length}</span>
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
          {/* 1. lépés (design 21.10): Hányan jöttök? · Mikor? — napok (a naptár-gombbal a távolabbiak) és a szabad időpontok;
              a választott a márkaszínben, választás után rögtön az Adatok jön */}
          {step === 0 && (
            <>
              <div data-edit-id="pax">
                <p className="text-ui-title font-light"><Txt k="rbooking.partySize">{tt('rbooking.partySize')}</Txt></p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <IconButton icon={Minus} label="−" size="md" variant={dk ? 'onDark' : 'cell'} disabled={pax <= minPax} onClick={() => setPax((p) => Math.max(minPax, p - 1))} />
                  <span className="text-ui-num font-light tabular-nums">{pax} <span className={`text-ui-body ${c.meta}`}><Txt k="rbooking.paxUnit">{tt('rbooking.paxUnit')}</Txt></span></span>
                  <IconButton icon={Plus} label="+" size="md" variant={dk ? 'onDark' : 'cell'} disabled={pax >= maxPax} onClick={() => setPax((p) => Math.min(maxPax, p + 1))} />
                </div>
                {/* a legnagyobb online létszámnál: nagyobb társaság üzenetet küld / telefonál, nem foglal online */}
                {largeParty && pax >= maxPax && (largeParty.phone || largeParty.email) && (
                  <p className={`mt-2 text-center text-ui-label ${c.meta}`}>
                    {tt('rbooking.largeParty')}{' '}
                    {largeParty.phone && <a href={`tel:${largeParty.phone.replace(/\s+/g, '')}`} className="underline underline-offset-2">{largeParty.phone}</a>}
                    {largeParty.phone && largeParty.email && ' · '}
                    {largeParty.email && <a href={`mailto:${largeParty.email}`} className="underline underline-offset-2">{largeParty.email}</a>}
                  </p>
                )}
              </div>

              <div data-edit-id="rules">
                <p className="text-ui-title font-light"><Txt k="rbooking.when">{tt('rbooking.when')}</Txt></p>
                {bookingWindowDays <= 0 ? (
                  <p className={`mt-2 text-ui-meta ${c.meta}`}><Txt k="dateStrip.closed">{tt('dateStrip.closed')}</Txt></p>
                ) : (
                  <>
                    <div ref={stripRef}><CardDayPicker c={c} className="mt-2" days={pickDays} onPick={setDate} /></div>
                    <div className={`mt-3 text-ui-label ${c.meta}`}>{format(new Date(`${date}T12:00:00`), 'EEEE, MMMM d.', { locale: dfLocale(locale) })}</div>
                    {loadingSlots ? (
                      <div className="flex justify-center py-6"><Loader2 className={`h-5 w-5 animate-spin ${c.meta}`} /></div>
                    ) : slotsError ? (
                      <div className="py-6 text-center" role="alert">
                        <p className={`text-ui-meta ${c.meta}`}>{tt('rbooking.err.slots')}</p>
                        <Button size="sm" variant={dk ? 'onDark' : 'cell'} className="mt-3" onClick={() => setSlotsReloadKey((k) => k + 1)}>{tt('rbooking.retry')}</Button>
                      </div>
                    ) : slots.length === 0 ? (
                      <p className={`py-6 text-center text-ui-meta ${c.meta}`}><Txt k="rbooking.noSlots">{tt('rbooking.noSlots')}</Txt></p>
                    ) : (
                      <>
                        <div data-edit-id="sec:slots"><CardSlotGrid c={c} className="mt-2" slots={slots.map((x) => x.start)} on={time || undefined} onPick={(t) => { setTime(t); goStep(1) }} /></div>
                        {/* ahol a beltér megtelt: csak teraszon (kültéren) foglalható */}
                        {slots.some((x) => x.onlyOutdoor) && (
                          <p className={`mt-2 flex items-center gap-1.5 text-ui-label ${c.meta}`}><Trees className="h-3.5 w-3.5 shrink-0" />{tt('rbooking.onlyOutdoor')}: {slots.filter((x) => x.onlyOutdoor).map((x) => x.start).join(', ')}</p>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Step 1: Adatok */}
          {step === 1 && (
            <>
              {/* Összegző kártya */}
              <div className="bg-ui-dark rounded-[20px] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-white/60 text-xs font-medium mb-1"><Txt k="rbooking.summary">{tt('rbooking.summary')}</Txt></p>
                  <p className="text-ui-yellow font-semibold text-base">{tt('rbooking.guests', { n: pax })}</p>
                  <p className="text-white/60 text-xs mt-1">{format(selectedDateObj, 'MMM d.', { locale: dfLocale(locale) })} · {time}</p>
                </div>
                {time && slots.find((s) => s.start === time)?.onlyOutdoor && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1.5 text-xs font-medium shrink-0">
                    <Trees className="h-3.5 w-3.5" /> Terasz
                  </span>
                )}
              </div>

              {/* Előleg-tájékoztató MÁR az adatoknál — a vendég előre tudja, mennyi, mikor és visszajár-e */}
              {depositEnabled && depositInfo && (
                <div data-edit-id="deposit" className="flex gap-3 rounded-[20px] p-4" style={{ background: 'rgba(241,206,69,0.12)', border: '1px solid rgba(241,206,69,0.35)' }}>
                  <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-ui-yellow" strokeWidth={1.7} />
                  <div className={`text-[13px] leading-relaxed ${dk ? 'text-white/70' : 'text-ui-muted'}`}>
                    <p className={`font-semibold ${textCls}`}>{tt('public.deposit.notice', { amount: restaurantDepositLabel(depositInfo, pax) })}</p>
                    <p>{tt('public.deposit.noticeHow')} {depositInfo.refundHours > 0 ? tt('public.deposit.noticeRefund', { hours: depositInfo.refundHours }) : tt('public.deposit.noticeRefundAny')}</p>
                  </div>
                </div>
              )}
              <div className={`${cardClass} space-y-3`} style={cardStyle}>
                <p className={`text-ui-title font-light`}><Txt k="rbooking.details">{tt('rbooking.details')}</Txt></p>
                {/* Az űrlap mezői a beállított sorrendben (`booking_rules.form_field_order`) — ugyanaz a
                    blokk-felosztás, mint a szalon foglalóján. */}
                {(() => {
                  const fieldBlocks: Record<FormFieldId, ReactNode> = {
                    name: (<div data-edit-id="field:name">
                  <div key={`name-${detailsShakeKey}`} className={cn(errors.name && 'animate-shake')}>
                    <input
                      ref={fieldRefs.name}
                      className={cn(inputClass, errors.name && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                      aria-label={tt("rbooking.field.name")}
                      value={name}
                      onChange={(e) => { setName(e.target.value); clearError('name') }}
                      {...phName}
                      onBlur={() => onFieldBlur('name')}
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? 'rbk-name-err' : undefined}
                    />
                    {errors.name && <p id="rbk-name-err" role="alert" className="mt-1 text-[12px] text-red-500">{errors.name}</p>}
                  </div>
                    </div>),
                    email: (<div data-edit-id="field:email">
                  <div key={`email-${detailsShakeKey}`} className={cn(errors.email && 'animate-shake')}>
                    <input
                      ref={fieldRefs.email}
                      className={cn(inputClass, errors.email && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-label={tt("rbooking.field.email")}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                      {...phEmail}
                      onBlur={() => onFieldBlur('email')}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'rbk-email-err' : undefined}
                    />
                    {errors.email && <p id="rbk-email-err" role="alert" className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
                  </div>
                    </div>),
                    phone: (<div data-edit-id="field:phone">
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
                    </div>),
                    address: (<div data-edit-id="field:address" className="space-y-3">
                  {/* Előlegnél a cím a SZÁMLÁHOZ kell — egyszer, fejlécként mondjuk el (nem mezőnként) */}
                  {depositEnabled && (
                    <div className="pt-1">
                      <p className={`text-ui-title font-light`}><Txt k="booking.details.billing">{tt('booking.details.billing')}</Txt></p>
                      <p className={`text-[12px] ${dk ? 'text-white/45' : 'text-ui-muted'}`}><Txt k="booking.details.billingWhy">{tt('booking.details.billingWhy')}</Txt></p>
                    </div>
                  )}
                  <div key={`city-${detailsShakeKey}`} className={cn(errors.city && 'animate-shake')}>
                    <input
                      ref={fieldRefs.city}
                      className={cn(inputClass, errors.city && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                      autoComplete="address-level2"
                      aria-label={addressGateOn ? tt('rbooking.field.city').replace(/\s*\([^)]*\)\s*$/, '') : tt('rbooking.field.city')}
                      aria-invalid={!!errors.city}
                      value={city}
                      onChange={(e) => { setCity(e.target.value); clearError('city') }}
                      {...phCity}
                      onBlur={() => onFieldBlur('city')}
                    />
                    {errors.city && <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.city}</p>}
                    {addressGateOn && !depositEnabled && !errors.city && <p className={`mt-1 text-[11px] ${labelCls}`}>{addressNote}</p>}
                  </div>
                  {!addressCityOnly && (
                  <div key={`address-${detailsShakeKey}`} className={cn(errors.address && 'animate-shake')}>
                    <input
                      ref={fieldRefs.address}
                      className={cn(inputClass, errors.address && 'ring-2 ring-red-400 focus-visible:ring-red-400')}
                      autoComplete="street-address"
                      aria-label={addressGateOn ? tt('booking.field.address').replace(/\s*\([^)]*\)\s*$/, '') : tt('booking.field.address')}
                      aria-invalid={!!errors.address}
                      value={address}
                      onChange={(e) => { setAddress(e.target.value); clearError('address') }}
                      {...phAddress}
                      onBlur={() => onFieldBlur('address')}
                    />
                    {errors.address && <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.address}</p>}
                    {addressGateOn && !depositEnabled && !errors.address && <p className={`mt-1 text-[11px] ${labelCls}`}>{addressNote}</p>}
                  </div>
                  )}
                  {depositEnabled && invoicingEnabled && (
                    <CountryField value={billingCountry} locale={locale} tt={tt} inputCls={inputClass} metaCls={labelCls} required error={billingCountryErr}
                      onChange={(v) => { setBillingCountry(v); setBillingCountryErr(null); if (isForeignCountry(v)) setIsCompany(false) }} />
                  )}
                  {/* céges vásárlás csak belföldi címmel — külföldi vevő magánszemélyként (lib/countries) */}
                  {depositEnabled && invoicingEnabled && !isForeignCountry(billingCountry) && (
                    <>
                      <div className={cn('flex items-center justify-between gap-3 rounded-[12px] px-3.5 py-3', dk ? 'bg-white/[0.06]' : 'bg-ui-cell')}>
                        <span className={`text-[13px] ${textCls}`}><Txt k="public.voucher.companyToggle">{tt('public.voucher.companyToggle')}</Txt></span>
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
                          {errors.taxNumber ? <p role="alert" className="mt-1 text-[12px] text-red-500">{errors.taxNumber}</p> : <p className={`mt-1 text-[11px] ${labelCls}`}><Txt k="public.voucher.taxNumberHint">{tt('public.voucher.taxNumberHint')}</Txt></p>}
                        </div>
                      )}
                    </>
                  )}
                    </div>),
                    questions: (customQuestionsList.length > 0 && <div data-edit-id="questions" className="space-y-3">{
                  customQuestionsList.map((q) => {
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
                  })
                    }</div>),
                    notes: (
                  <textarea data-edit-id="field:notes" className={`${inputClass} h-auto py-2.5 min-h-[72px] resize-none`} aria-label={tt("rbooking.field.note")} value={notes} onChange={(e) => setNotes(e.target.value)} {...phNotes} />
                    ),
                    newsletter: (marketingVisible || (editorStep && newsletterEnabled)) ? (
                  <div data-edit-id="newsletter" className={cn('space-y-1.5', editorStep && !marketingVisible && 'opacity-35 pointer-events-none')}>
                    <div className="flex items-center justify-between gap-3 py-1">
                      <span className={`text-[13px] ${dk ? 'text-white/70' : 'text-ui-text'}`}><Txt k="custom.marketing">Szeretnék marketing-ajánlatokat, híreket kapni erről az üzletről</Txt></span>
                      <Switch checked={marketingConsent} onChange={setMarketingConsent} ariaLabel="Feliratkozás hírlevélre" />
                    </div>
                    <p className={`text-[11px] ${dk ? 'text-white/40' : 'text-ui-muted'}`}>
                      <Txt k="custom.unsubscribe">Bármikor leiratkozhatok. Részletek:</Txt> <a href="/privacy#marketing" target="_blank" rel="noreferrer" className={`underline underline-offset-2 ${dk ? 'hover:text-white/70' : 'hover:text-ui-text'}`}><Txt k="custom.privacyLink">Adatvédelmi tájékoztató</Txt></a>.
                    </p>
                  </div>
                    ) : null,
                    // az alkalom-választó a mezők közt (húzható sorrend) — saját kártya nélkül, a többi mezővel egy kártyán
                    occasions: eventTypes.length > 0 ? (
              <div data-edit-id="occasions" className="space-y-3 pt-1">
                  <div>
                    <p className={`text-ui-title font-light`}><Txt k="rbooking.occasion">{tt('rbooking.occasion')}</Txt></p>
                    <p className={`mt-0.5 text-[12px] ${dk ? 'text-white/40' : 'text-ui-muted'}`}><Txt k="rbooking.occasionHint">{tt('rbooking.occasionHint')}</Txt></p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOccasionIdx(null)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        occasionIdx === null
                          ? 'bg-ui-yellow text-ui-dark border-ui-yellow'
                          : dk
                            ? 'border-white/15 text-white/60 hover:border-ui-yellow hover:text-white'
                            : ' border-ui-divider text-ui-muted hover:border-ui-yellow'
                      }`}
                      style={dk && occasionIdx !== null ? { background: 'rgba(255,255,255,0.08)' } : undefined}
                    >
                      <Txt k="rbooking.occasionNone">{tt('rbooking.occasionNone')}</Txt>
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
                              ? 'bg-ui-yellow text-ui-dark border-ui-yellow'
                              : dk
                                ? 'border-white/15 text-white/60 hover:border-ui-yellow hover:text-white'
                            : ' border-ui-divider text-ui-muted hover:border-ui-yellow'
                          }`}
                          style={dk && !active ? { background: 'rgba(255,255,255,0.08)' } : undefined}
                        >
                          <Icon className={`h-4 w-4 ${active ? 'text-ui-dark' : dk ? 'text-white/50' : 'text-ui-muted'}`} strokeWidth={1.8} />
                          {et.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                    ) : null,
                  }
                  // Teljesen elrejtett mező (phone/address/notes) a valódi foglalón nem
                  // renderelődik; a szerkesztő élő előnézetében (editorStep) halványan mégis
                  // látszik, ugyanúgy, mint a ProfileCard-nál (salon oldal).
                  const fieldHidden = (k: FormFieldId) => (k === 'phone' && !phoneVisible) || (k === 'notes' && !notesVisible) || (k === 'address' && !addressVisible)
                  return formFieldOrder
                    .filter((k) => !!editorStep || !fieldHidden(k))
                    .map((k) => (
                      <Fragment key={k}>
                        {editorStep && fieldHidden(k) ? <div className="opacity-35 pointer-events-none">{fieldBlocks[k]}</div> : fieldBlocks[k]}
                      </Fragment>
                    ))
                })()}
                {voucherEnabled && (
                  <div data-edit-id="redeem" className="space-y-2">
                    {!redeemOpen ? (
                      <button
                        type="button"
                        onClick={() => setRedeemOpen(true)}
                        className={`text-[12px] font-medium underline underline-offset-2 transition-colors ${dk ? 'text-white/45 hover:text-white/70' : 'text-ui-muted hover:text-ui-text'}`}
                      >
                        <Txt k="custom.voucherLink">Van ajándékutalványod?</Txt>
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
                        {redeemValid && <p className="mt-1 text-[12px] text-emerald-500"><Txt k="custom.voucherValid">Érvényes utalvány — jóváírva a foglaláskor.</Txt></p>}
                      </div>
                    )}
                  </div>
                )}
              </div>


              <Button
                onClick={() => { if (validateDetails()) goStep(DEPOSIT_STEP ?? CONSENT_STEP ?? REVIEW_STEP) }}
                className={cn('w-full', ACCENT)}
              >
                <Txt k="booking.next">{tt('booking.next')}</Txt>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Step 2 (ha van előleg): Előleg-fizetés */}
          {step === DEPOSIT_STEP && depositEnabled && (
            <div data-edit-id="deposit" className={cardClass} style={cardStyle}>
              <p className={`text-ui-title font-light mb-3`}><Txt k="public.deposit.title">{tt('public.deposit.title')}</Txt></p>
              {editorStep ? (
                <p className={`text-[13px] leading-relaxed ${labelCls}`}>Itt fizeti a vendég kártyával a foglalót (Stripe). A szerkesztőben nincs valódi fizetés.</p>
              ) : time && (
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
            <div data-edit-id="consent" className={cardClass} style={cardStyle}>
              <EditableText as="div" id="consentTitle" single value={consentTitle?.trim() || tt('public.consent.title')} className="mb-3 text-ui-title font-light" />
              <div
                className={`mb-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-2xl p-4 text-[13.5px] leading-relaxed ${dk ? 'text-white/75' : 'text-ui-muted'}`}
                style={{ background: dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: dk ? '1.5px solid rgba(255,255,255,0.10)' : '1.5px solid rgba(0,0,0,0.06)' }}
              >
                <EditableText as="div" id="consentText" value={consentText || 'A szolgáltató még nem adta meg a nyilatkozat szövegét.'} />
              </div>
              <div className="flex items-center justify-between gap-3 py-1">
                <span className={`text-[13px] ${textCls}`}><Txt k="custom.consentAccept">Elolvastam és elfogadom a fenti nyilatkozatot</Txt></span>
                <Switch checked={consentGiven} onChange={setConsentGiven} ariaLabel="Nyilatkozat elfogadása" />
              </div>
              <Button
                onClick={() => { if (consentGiven) goStep(REVIEW_STEP) }}
                disabled={!consentGiven}
                className={cn('w-full', ACCENT)}
              >
                <Txt k="booking.next">{tt('booking.next')}</Txt>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Összefoglalás + megerősítés */}
          {step === REVIEW_STEP && (
            <>
              {/* Összegzés — egy kártyában, ugyanabban a sorrendben, mint a szalon foglalóján
                  (foglalás → vendég adatai → előleg / utalvány). A hosszú értékek törnek. */}
              <h2 className="text-ui-title font-light"><Txt k="booking.summary.title">{tt('booking.summary.title')}</Txt></h2>
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
                  ...(paymentIntentId && depositAmountHuf ? [{ label: 'Foglaló (fizetve)', value: `${depositAmountHuf.toLocaleString('hu-HU')} Ft` }] : []),
                  ...(redeemValid && redeemCode.trim() ? [{ label: 'Utalvánnyal fedezve', value: `${redeemValid.amount_huf.toLocaleString('hu-HU')} Ft` }] : []),
                ].filter((r): r is { label: string; value: string } => !!r.value).map(({ label, value }, i, arr) => (
                  <div key={label} className={cn('flex items-start justify-between gap-3 py-2.5', i < arr.length - 1 && (dk ? 'border-b border-white/[0.08]' : 'border-b'))}>
                    <span className={`shrink-0 pt-0.5 text-xs ${labelCls}`}>{label.replace(/\s*\*$/, '')}</span>
                    <span className={`min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere] ${textCls}`}>{value}</span>
                  </div>
                ))}
              </div>

              {dk && <GoodToKnowCompact items={goodToKnow} locale={locale} />}

              {/* Megerősítés gomb */}
              <Button
                onClick={submit}
                disabled={submitting}
                className={cn('w-full', ACCENT)}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{tt('rbooking.submitting')}</>
                ) : (
                  <><Txt k="rbooking.confirm">{tt('rbooking.confirm')}</Txt><HoverArrow className="h-4 w-4" /></>
                )}
              </Button>
              {((termsSections && termsSections.length > 0) || company) && (
                <div data-edit-id="terms" className={`text-center text-xs ${dk ? 'text-white/40' : 'text-ui-muted'}`}>
                  {tt('rbooking.termsPrefix')}{' '}
                  <TermsModal sections={termsSections} company={company} locale={locale} />
                  {company?.privacy_url && <>. {tt('rbooking.privacyPrefix')}{' '}<a href={company.privacy_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2"><Txt k="rbooking.privacyLink">{tt('rbooking.privacyLink')}</Txt></a></>}
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
