'use client'

import type { DepositInfo } from '@/lib/depositSummary'
import type { GoogleReviewsData } from '@/components/booking/GoogleReviewsBlock'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { Check, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Button, FIELD, IconCircle } from '@/components/ui-kit'
import { VoucherCard } from '@/components/blocks/money'
import { ACCENT, cardTone, GLASS_FIELD, type LiveCard } from '@/components/blocks/public'
import { PoweredBy } from '@/components/blocks/brand'
import { CookieFooterLink } from '@/components/blocks/consent'
import { openCookieSettings } from '@/components/booking/MarketingTrackingScripts'
import { toast } from 'sonner'
import { formatPrice, cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_URL } from '@/lib/brand'
import { t, dfLocale, type Locale } from '@/lib/i18n'
import { format } from 'date-fns'
import { BookingSuccess } from '@/components/booking/BookingSuccess'
import type { EditorView } from '@/components/booking/ProfileCard'
import { DepositStep } from '@/components/booking/DepositStep'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/toggle-switch'
import { Textarea } from '@/components/ui/textarea'
import { RestaurantBookingWizard, type EventTypeOption } from './RestaurantBookingWizard'
import type { CompanyInfo } from '@/components/booking/TermsModal'
import type { GiftVoucherType, Media } from '@/payload/payload-types'

type View = 'book' | 'success' | 'voucher'

type OpeningHour = {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  is_open: boolean
  open_time?: string | null
  close_time?: string | null
}

export type RestaurantCardProps = {
  slug: string
  restaurantId: string | number
  locale: Locale
  restaurantName: string
  restaurantDescription?: string | null
  restaurantAddress?: string | null
  restaurantCity?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  socialLinks?: string[] | null
  openingHours: OpeningHour[]
  reviews: { count: number; average: number }
  requirePhone: boolean
  maxPax: number
  /** a legkisebb online létszám (Beállítások › Foglalási szabályok) */
  minPax?: number
  /** van beállított legnagyobb online létszám → a varázsló a határnál kiírja, hogyan foglalhat nagyobb társaság */
  largePartyNote?: boolean
  bookingWindowDays: number
  eventTypes: EventTypeOption[]
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
  depositEnabled?: boolean
  /** előleg-összefoglaló a vendégnek (összeg + díjmentes lemondás) */
  depositInfo?: DepositInfo | null
  invoicingEnabled?: boolean
  voucherCompanyEnabled?: boolean
  /** Google-értékelések (tárolt, kérésre frissülő másolat) — üres → nem jelenik meg. */
  google?: GoogleReviewsData | null
  addressRequired?: boolean
  addressRequiredNote?: string | null
  hiddenFields?: ('phone' | 'notes')[]
  addressDetailLevel?: 'off' | 'city' | 'full'
  voucherEnabled?: boolean
  voucherTypes?: GiftVoucherType[]
  newsletterEnabled?: boolean
  showMarketingConsent?: boolean
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
  /** Beágyazott (iframe) nézet — normál, statikus blokkként jelenik meg lebegő kártya helyett. */
  embed?: boolean
  /** `notification_prefs.confirm_email` — megy-e visszaigazoló e-mail a vendégnek. */
  confirmEmailEnabled?: boolean
  /** Az e-mailes emlékeztetők időzítése órában (üres = nincs emlékeztető). */
  reminderHours?: number[]
  /** Szerkesztő-előnézet: ezt a lépést mutassa mintaadatokkal (null = normál működés). */
  editorView?: EditorView | null
  /** a foglaló kártya stílusa (Beállítások › Foglalóoldal › Arculat) — design 21.2 */
  cardStyle?: LiveCard
  /** a foglalás gomb felirata (saját, vagy az alap) */
  ctaLabel?: string
  /** `booking_rules.public_section_order` / `public_sections_hidden` — a főnézet szakaszai
   *  (reviews | slots | voucher). Üres = alapsorrend, minden látható. */
  sectionOrder?: string[] | null
  hiddenSections?: string[] | null
  /** `booking_rules.form_field_order` — a varázsló Adatok lépésének mezősorrendje. */
  fieldOrder?: string[] | null
  /** Szerkesztő-előnézet: automatikus megerősítés (a Visszaigazolás lépés szövegéhez). */
  editorAutoConfirm?: boolean
  /** „Jó tudni” pontok — a foglalás Összegzés lépésén. */
  goodToKnow?: { id?: string | null; icon?: string | null; title?: string | null; body?: string | null }[] | null
}


export function RestaurantCard({
  slug,
  restaurantId,
  locale,
  restaurantName,
  restaurantDescription,
  restaurantAddress,
  restaurantCity,
  phone,
  email,
  website,
  socialLinks,
  openingHours,
  reviews,
  requirePhone,
  maxPax,
  minPax = 1,
  largePartyNote = false,
  bookingWindowDays,
  eventTypes,
  termsSections,
  company,
  depositEnabled,
  depositInfo,
  invoicingEnabled,
  voucherCompanyEnabled = true,
  google = null,
  addressRequired,
  addressRequiredNote,
  hiddenFields = [],
  addressDetailLevel = 'full',
  voucherEnabled,
  voucherTypes = [],
  newsletterEnabled,
  showMarketingConsent = true,
  consentEnabled,
  consentTitle,
  consentText,
  customQuestions,
  embed = false,
  confirmEmailEnabled = true,
  reminderHours = [],
  editorView = null,
  cardStyle = 'dark',
  ctaLabel,
  sectionOrder = null,
  hiddenSections = null,
  fieldOrder = null,
  editorAutoConfirm = true,
  goodToKnow = null,
}: RestaurantCardProps) {

  const [sheetOpen, setSheetOpen] = useState(false)
  // a kártya stílusa (design 21.2) és a mezők a kártyán (sötéten a design üveg-mezője, fehéren a kit mezője)
  const c = cardTone(cardStyle)
  const inputCls = c.dark ? `${GLASS_FIELD} placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/20` : `${FIELD} h-11`
  const sheetDragControls = useDragControls()
  const [isMobile, setIsMobile] = useState(true)
  // design 21.10: a kártya rögtön a foglalással (hányan, mikor) indul — a régi kezdő nézet tartalma a borítón van
  const [view, setView] = useState<View>('book')
  const [bookInitial, setBookInitial] = useState<{ date: string; time: string; pax: number } | null>(null)
  const [successDetails, setSuccessDetails] = useState<{
    date: string; time: string; pax: number
    confirmed: boolean; icsToken: string | null; hasEmail: boolean; occasion: string | null
  } | null>(null)
  const searchParams = useSearchParams()
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Embed módban: a kártya saját tartalom-magasságát figyeljük, és postMessage-en jelezzük a
  // beágyazó oldal felé (a `public/embed.js` loader ez alapján méretezi élőben az iframe-et).
  const embedCardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!embed || !embedCardRef.current || typeof ResizeObserver === 'undefined') return
    const el = embedCardRef.current
    const send = () => {
      window.parent.postMessage({ source: 'davelopment-embed', height: el.offsetHeight }, '*')
    }
    const ro = new ResizeObserver(send)
    ro.observe(el)
    send()
    return () => ro.disconnect()
  }, [embed])

  useEffect(() => {
    if (!autoOpenedRef.current && searchParams.get('book') === '1') {
      autoOpenedRef.current = true
      const date = searchParams.get('date')
      const time = searchParams.get('time')
      const pax = searchParams.get('pax')
      if (date || time) {
        setBookInitial({
          date: date ?? '',
          time: time ?? '',
          pax: pax ? Number(pax) : 2,
        })
      }
      setView('book')
      setSheetOpen(true)
    }
  }, [searchParams])

  // a borító „Ajándékutalvány” gombja (design 21.1): a kártya az utalvány-vásárlásra vált (mobilon a lap is felnyílik)
  useEffect(() => {
    const voucher = () => { setView('voucher'); setSheetOpen(true) }
    window.addEventListener('davelopment:openVoucher', voucher)
    return () => window.removeEventListener('davelopment:openVoucher', voucher)
  }, [])

  // Szerkesztő-előnézet: a kért lépésre ugrunk (a foglalás lépéseit a varázsló mintaadatokkal
  // mutatja, a visszaigazolást mintafoglalással) — ugyanaz a viselkedés, mint a szalon kártyáján.
  const wizardStep = editorView && ['datetime', 'details', 'deposit', 'consent', 'summary'].includes(editorView)
    ? editorView as 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' : null
  useEffect(() => {
    if (!editorView) return
    if (editorView === 'main') { setView('book'); setSheetOpen(false); return }
    // a szerkesztő telefon-nézetének második kijelzője: a lap nyitva, a foglalás 1. lépésével
    if (editorView === 'start') { setView('book'); setSheetOpen(true); return }
    if (editorView === 'success') {
      setSuccessDetails({
        date: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'), time: '19:00', pax: 2,
        confirmed: editorAutoConfirm, icsToken: null, hasEmail: true, occasion: eventTypes[0]?.label ?? null,
      })
      setView('success')
    } else if (editorView === 'voucher') setView('voucher')
    else setView('book')
    setSheetOpen(true)
  }, [editorView, editorAutoConfirm]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuccess = (date: string, time: string, pax: number, extra?: { confirmed: boolean; icsToken: string | null; hasEmail: boolean; occasion: string | null }) => {
    setSuccessDetails({ date, time, pax, confirmed: extra?.confirmed ?? true, icsToken: extra?.icsToken ?? null, hasEmail: extra?.hasEmail ?? true, occasion: extra?.occasion ?? null })
    setView('success')
  }

  const handleCloseSuccess = () => {
    setView('book')
    setSuccessDetails(null)
    setBookInitial(null)
    setSheetOpen(false)
  }

  // Ajándékutalvány-vásárlás — a fő foglalás-flow-tól teljesen független mellékág. A vendég
  // a tulaj által előre létrehozott típusok közül választ (nincs szabad összeg/kép).
  const [selectedVoucherTypeId, setSelectedVoucherTypeId] = useState<string | null>(null)
  const [voucherPurchaserName, setVoucherPurchaserName] = useState('')
  const [voucherPurchaserEmail, setVoucherPurchaserEmail] = useState('')
  const [voucherPurchaserCity, setVoucherPurchaserCity] = useState('')
  const [voucherPurchaserAddress, setVoucherPurchaserAddress] = useState('')
  const [voucherIsCompany, setVoucherIsCompany] = useState(false)
  const [voucherPurchaserTaxNumber, setVoucherPurchaserTaxNumber] = useState('')
  const [voucherRecipientName, setVoucherRecipientName] = useState('')
  const [voucherRecipientEmail, setVoucherRecipientEmail] = useState('')
  const [voucherMessage, setVoucherMessage] = useState('')
  const [voucherFieldErrors, setVoucherFieldErrors] = useState<Record<string, string>>({})
  const [voucherTypeError, setVoucherTypeError] = useState(false)
  const [voucherShakeKey, setVoucherShakeKey] = useState(0)
  const [voucherPaymentStep, setVoucherPaymentStep] = useState(false)
  const [voucherCreating, setVoucherCreating] = useState(false)
  const [voucherResult, setVoucherResult] = useState<{ code: string; amountHuf: number; qrCodeDataUrl: string; expiresAt?: string } | null>(null)

  const selectedVoucherType = voucherTypes.find(t => String(t.id) === selectedVoucherTypeId) ?? null

  const voucherFieldErrorMap = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!voucherPurchaserName.trim()) e.name = 'A neved megadása kötelező.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voucherPurchaserEmail)) e.email = 'Érvénytelen email-cím.'
    if (!voucherPurchaserCity.trim()) e.city = 'A település megadása kötelező a számlázáshoz.'
    if (voucherIsCompany && !voucherPurchaserTaxNumber.trim()) e.taxNumber = 'Céges vásárlásnál az adószám megadása kötelező.'
    if (!voucherPurchaserAddress.trim()) e.address = 'A cím megadása kötelező a számla kiküldéséhez.'
    if (voucherRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voucherRecipientEmail)) e.recipientEmail = 'Érvénytelen email-cím a megajándékozottnál.'
    return e
  }

  const clearVoucherFieldError = (key: string) => {
    setVoucherFieldErrors(prev => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next })
  }

  const handleVoucherFormNext = () => {
    const e = voucherFieldErrorMap()
    const typeMissing = !selectedVoucherType
    setVoucherTypeError(typeMissing)
    setVoucherFieldErrors(e)
    if (typeMissing || Object.keys(e).length > 0) {
      setVoucherShakeKey(k => k + 1)
      return
    }
    setVoucherPaymentStep(true)
  }

  const handleVoucherPaid = async (paymentIntentId: string) => {
    setVoucherCreating(true)
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'restaurant', restaurantId, paymentIntentId,
          purchaserName: voucherPurchaserName, purchaserEmail: voucherPurchaserEmail,
          purchaserCity: voucherPurchaserCity.trim() || undefined,
          purchaserAddress: voucherPurchaserAddress.trim() || undefined,
          purchaserTaxNumber: voucherIsCompany ? voucherPurchaserTaxNumber.trim() : undefined,
          recipientName: voucherRecipientName.trim() || undefined,
          recipientEmail: voucherRecipientEmail.trim() || undefined,
          message: voucherMessage.trim() || undefined,
          locale,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült létrehozni az utalványt.')
      setVoucherResult({ code: json.code, amountHuf: json.amountHuf, qrCodeDataUrl: json.qrCodeDataUrl, expiresAt: json.expiresAt })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült létrehozni az utalványt.')
    } finally {
      setVoucherCreating(false)
    }
  }

  const handleCloseVoucherSuccess = () => {
    setView('book')
    setSelectedVoucherTypeId(null)
    setVoucherPurchaserName('')
    setVoucherPurchaserEmail('')
    setVoucherPurchaserCity('')
    setVoucherPurchaserAddress('')
    setVoucherIsCompany(false)
    setVoucherPurchaserTaxNumber('')
    setVoucherRecipientName('')
    setVoucherRecipientEmail('')
    setVoucherMessage('')
    setVoucherPaymentStep(false)
    setVoucherResult(null)
    setVoucherFieldErrors({})
    setVoucherTypeError(false)
    setSheetOpen(false)
  }

  const bookView = (
    <div className="px-4 pb-6 pt-6">
      <RestaurantBookingWizard
        key={bookInitial ? `${bookInitial.date}-${bookInitial.time}` : 'default'}
        restaurantId={restaurantId}
        slug={slug}
        requirePhone={requirePhone}
        maxPax={maxPax}
        minPax={minPax}
        largeParty={largePartyNote ? { phone: phone ?? null, email: email ?? null } : null}
        bookingWindowDays={bookingWindowDays}
        eventTypes={eventTypes}
        termsSections={termsSections}
        company={company}
        locale={locale}
        onBack={() => setSheetOpen(false)}
        onSuccess={handleSuccess}
        variant="dark"
        card={cardStyle}
        initialDateProp={bookInitial?.date}
        initialTimeProp={bookInitial?.time}
        initialPaxProp={bookInitial?.pax}
        depositEnabled={depositEnabled}
        depositInfo={depositInfo}
        invoicingEnabled={invoicingEnabled}
        addressRequired={addressRequired}
        addressRequiredNote={addressRequiredNote}
        hiddenFields={hiddenFields}
        addressDetailLevel={addressDetailLevel}
        voucherEnabled={voucherEnabled}
        newsletterEnabled={newsletterEnabled}
        showMarketingConsent={showMarketingConsent}
        consentEnabled={consentEnabled}
        consentTitle={consentTitle}
        consentText={consentText}
        customQuestions={customQuestions}
        fieldOrder={fieldOrder}
        editorStep={wizardStep}
        goodToKnow={goodToKnow}
      />
    </div>
  )

  // Közös visszaigazoló képernyő (ugyanaz, mint a szalon foglalóján).
  const successView = (
    <div className="px-5 lg:px-6">
      <BookingSuccess
        card={cardStyle}
        locale={locale}
        confirmed={successDetails?.confirmed !== false}
        hasEmail={!!successDetails?.hasEmail}
        confirmEmailEnabled={confirmEmailEnabled}
        reminderHours={reminderHours}
        summary={successDetails && (
          <>
            <span className="font-semibold">{t(locale, 'rbooking.guests', { n: successDetails.pax })}</span>
            {' · '}{format(new Date(successDetails.date + 'T00:00:00'), 'MMM d., EEEE', { locale: dfLocale(locale) })} {successDetails.time}
            {successDetails.occasion ? ` · ${successDetails.occasion}` : ''}
          </>
        )}
        icsHref={successDetails?.icsToken ? `/api/ics/reservation/${encodeURIComponent(successDetails.icsToken)}` : null}
        onDone={handleCloseSuccess}
      />
    </div>
  )

  const voucherView = (
    <div data-edit-id="sec:voucher" className="px-5 pb-6 pt-6 lg:px-6">
      {voucherResult ? (
        // Kész (design 21.9): pipa a márkaszínben, az utalvány képe (előlap a kóddal, hátlap a QR-ral)
        <div className="flex flex-col items-center py-4 text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
            <IconCircle size="lg" icon={Check} className={ACCENT} />
          </motion.div>
          <motion.div className="w-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
            <div className="mt-4 text-ui-sub font-light">{t(locale, 'public.voucher.successTitle')}</div>
            <p className={`mt-1 text-ui-meta ${c.meta}`}>{t(locale, 'public.voucher.successSubtitle')}</p>
            <div className="mt-5 space-y-2 text-left">
              <VoucherCard restaurant amount={formatPrice(voucherResult.amountHuf, 'HUF')} code={voucherResult.code} bg="yellow" biz={{ name: restaurantName, logo: null }} expires={voucherResult.expiresAt ? format(new Date(voucherResult.expiresAt), 'PPP', { locale: dfLocale(locale) }) : ''} />
              <VoucherCard restaurant side="back" code={voucherResult.code} qr={voucherResult.qrCodeDataUrl} bg="dark" biz={{ name: restaurantName, logo: null }} />
            </div>
            <Button variant={c.dark ? 'onDark' : 'cell'} className="mt-4 w-full" onClick={handleCloseVoucherSuccess}>{t(locale, 'public.success.back')}</Button>
          </motion.div>
        </div>
      ) : (
        <>
          <button onClick={() => setView('book')} className={`mb-4 inline-flex items-center gap-1.5 text-ui-label font-medium transition-colors ${c.meta}`}>
            <ArrowLeft className="h-3.5 w-3.5" /> {t(locale, 'public.back')}
          </button>
          <h2 className="mb-1 text-ui-title font-light">{t(locale, 'public.voucher')}</h2>
          <p className={`mb-5 text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.redeemableAt', { salon: restaurantName })}</p>

          {!voucherPaymentStep ? (
            <div className="space-y-4">
              <div key={`vtype-${voucherShakeKey}`} className={cn('space-y-2 rounded-[16px]', voucherTypeError && 'animate-shake')}>
                <Label className={cn('text-[11px] font-semibold uppercase tracking-[0.12em]', voucherTypeError ? 'text-red-400' : 'text-white/55')}>{t(locale, 'public.voucher.chooseType')} *</Label>
                <div className={cn('grid grid-cols-2 gap-2.5 rounded-[16px]', voucherTypeError && 'ring-1 ring-red-400')}>
                  {voucherTypes.map((vt) => {
                    const url = typeof vt.image === 'object' && vt.image ? (vt.image as Media).url ?? null : null
                    const selected = selectedVoucherTypeId === String(vt.id)
                    return (
                      <button
                        key={vt.id}
                        type="button"
                        onClick={() => { setSelectedVoucherTypeId(String(vt.id)); setVoucherTypeError(false) }}
                        className={cn(
                          'flex flex-col items-start overflow-hidden rounded-[14px] border text-left transition-colors',
                          selected ? 'border-ui-yellow bg-ui-yellow/[0.08]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                        )}
                      >
                        <div className="h-20 w-full bg-white/[0.06]">
                          {url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="truncate text-ui-meta font-medium">{vt.name}</div>
                          <div className="text-ui-label text-ui-yellow">{formatPrice(vt.amount_huf, 'HUF')}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {voucherTypeError && <p role="alert" className="text-ui-label text-red-400">{t(locale, 'public.voucher.chooseTypeError')}</p>}
              </div>

              <div key={`name-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.name && 'animate-shake')}>
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.yourName')} *</Label>
                <Input
                  value={voucherPurchaserName} onChange={e => { setVoucherPurchaserName(e.target.value); clearVoucherFieldError('name') }}
                  className={cn(inputCls, voucherFieldErrors.name && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.name && <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.name}</p>}
              </div>
              <div key={`email-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.email && 'animate-shake')}>
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.yourEmail')} *</Label>
                <Input
                  type="email" inputMode="email" value={voucherPurchaserEmail} onChange={e => { setVoucherPurchaserEmail(e.target.value); clearVoucherFieldError('email') }}
                  className={cn(inputCls, voucherFieldErrors.email && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.email && <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.email}</p>}
              </div>
              <div key={`city-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.city && 'animate-shake')}>
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.city')} *</Label>
                <Input
                  value={voucherPurchaserCity} onChange={e => { setVoucherPurchaserCity(e.target.value); clearVoucherFieldError('city') }}
                  autoComplete="address-level2"
                  className={cn(inputCls, voucherFieldErrors.city && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.city ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.city}</p> : <p className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.cityHint')}</p>}
              </div>
              <div key={`address-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.address && 'animate-shake')}>
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.address')} *</Label>
                <Input
                  value={voucherPurchaserAddress} onChange={e => { setVoucherPurchaserAddress(e.target.value); clearVoucherFieldError('address') }}
                  autoComplete="street-address"
                  className={cn(inputCls, voucherFieldErrors.address && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.address ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.address}</p> : <p className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.addressHint')}</p>}
              </div>

              {invoicingEnabled && voucherCompanyEnabled && (
              <div className={`flex items-center justify-between gap-3 px-3.5 py-3 ${c.row}`}>
                <span className="text-ui-meta opacity-80">{t(locale, 'public.voucher.companyToggle')}</span>
                <Switch checked={voucherIsCompany} onChange={setVoucherIsCompany} ariaLabel={t(locale, 'public.voucher.companyToggle')} />
              </div>
              )}
              {invoicingEnabled && voucherCompanyEnabled && voucherIsCompany && (
                <div key={`taxNumber-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.taxNumber && 'animate-shake')}>
                  <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.taxNumber')} *</Label>
                  <Input
                    value={voucherPurchaserTaxNumber} onChange={e => { setVoucherPurchaserTaxNumber(e.target.value); clearVoucherFieldError('taxNumber') }}
                    placeholder="12345678-1-42"
                    className={cn(inputCls, voucherFieldErrors.taxNumber && 'ring-1 ring-red-400')}
                  />
                  {voucherFieldErrors.taxNumber ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.taxNumber}</p> : <p className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.taxNumberHint')}</p>}
                </div>
              )}

              <div className="!mt-6 h-px bg-white/[0.08]" />

              <div className="space-y-1">
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.recipientName')}</Label>
                <Input
                  value={voucherRecipientName} onChange={e => setVoucherRecipientName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div key={`recipientEmail-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.recipientEmail && 'animate-shake')}>
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.recipientEmail')}</Label>
                <Input
                  type="email" inputMode="email" value={voucherRecipientEmail} onChange={e => { setVoucherRecipientEmail(e.target.value); clearVoucherFieldError('recipientEmail') }}
                  className={cn(inputCls, voucherFieldErrors.recipientEmail && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.recipientEmail ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.recipientEmail}</p> : <p className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.recipientEmailHint')}</p>}
              </div>
              <div className="space-y-1">
                <Label className={`text-ui-label ${c.meta}`}>{t(locale, 'public.voucher.message')}</Label>
                <Textarea
                  value={voucherMessage} onChange={e => setVoucherMessage(e.target.value)} rows={3}
                  className={`${inputCls} h-auto min-h-[88px] resize-none py-3`}
                />
              </div>

              <Button onClick={handleVoucherFormNext} className={cn('w-full', ACCENT)}>{t(locale, 'public.voucher.continueToPay')}<ArrowRight className="h-4 w-4" /></Button>
            </div>
          ) : voucherCreating ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <DepositStep
              dark
              locale={locale}
              endpoint="/api/payments/voucher-intent"
              payLabel={t(locale, 'public.voucher.payLabel')}
              infoText={t(locale, 'public.voucher.payInfo')}
              requestBody={{ kind: 'restaurant', restaurantId, voucherTypeId: selectedVoucherTypeId, email: voucherPurchaserEmail || undefined }}
              onPaid={(pid) => handleVoucherPaid(pid)}
            />
          )}
        </>
      )}
    </div>
  )

  const currentView = view === 'book' ? bookView : view === 'voucher' ? voucherView : successView

  return (
    <>
      {/* Backdrop (embed módban nincs mobil-sheet, nem kell) */}
      {!embed && (
        <AnimatePresence>
          {isMobile && sheetOpen && (
            <motion.div
              key="restaurant-sheet-backdrop"
              data-edit-pass
              className="fixed inset-0 z-[29] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              // a szerkesztőben egy foglalási lépés előnézete nyitva marad (a lépést a szerkesztő váltja, nem a háttér)
              onClick={() => {
                if (view !== 'success' && (!editorView || editorView === 'main')) setSheetOpen(false)
              }}
            />
          )}
        </AnimatePresence>
      )}

      {/* Lebegő CTA gomb (mobil, sheet megnyitása előtt) — embed módban a kártya mindig nyitva van */}
      {!embed && (
        <AnimatePresence>
          {isMobile && !sheetOpen && (
            <motion.div
              key="restaurant-mobile-cta"
              className="fixed bottom-0 left-0 right-0 z-20 px-5 lg:hidden"
              style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.3 }}
            >
              {/* design 21.11: a fő gomb a márkaszínben, a saját felirattal — a kit gombja, mint a borítón */}
              <span data-edit-pass className="block">
                <Button onClick={() => setSheetOpen(true)} className={cn('w-full shadow-ui-float', ACCENT)}>
                  {ctaLabel ?? t(locale, 'public.bookTable')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Kártya */}
      <div
        className={embed
          ? 'relative w-full p-3 sm:p-4'
          : 'fixed bottom-0 left-0 right-0 z-30 lg:absolute lg:bottom-auto lg:left-auto lg:right-8 lg:top-1/2 lg:w-[420px] lg:-translate-y-1/2'}
        style={embed ? undefined : { pointerEvents: isMobile && !sheetOpen ? 'none' : undefined }}
      >
        <motion.div
          ref={embed ? embedCardRef : undefined}
          initial={embed ? false : { y: '100%' }}
          animate={embed ? { y: 0 } : { y: isMobile ? (sheetOpen ? 0 : '100%') : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          drag={!embed && isMobile ? 'y' : false}
          dragControls={sheetDragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 1 }}
          onDragEnd={(_e, info) => {
            if ((info.offset.y > 120 || info.velocity.y > 500) && (!editorView || editorView === 'main')) setSheetOpen(false)
          }}
          // a kártya stílusa (design 21.2): sötét üveg (alap) · fekete · világos üveg · fehér
          className={cn('flex flex-col overflow-hidden', c.box, embed ? 'rounded-ui-card' : 'rounded-t-ui-card shadow-ui-popup lg:rounded-ui-card')}
          style={{
            // Embed módban a kártya a természetes tartalom-magasságára nő (a ResizeObserver ezt küldi a beágyazó oldalnak);
            // különben legfeljebb a képernyő magassága, belül görget.
            ...(embed ? { height: 'auto' } : { height: 'min(82dvh, calc(100dvh - 48px))' }),
          }}
        >
          {/* Drag handle (mobil) — lehúzható; embed módban nincs húzható sheet */}
          {!embed && (
            <div
              className="shrink-0 flex touch-none justify-center pt-3 pb-1 lg:hidden"
              onPointerDown={(e) => sheetDragControls.start(e)}
              style={{ touchAction: 'none' }}
            >
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
          )}

          {/* Nézet-tartalom animált csere */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="flex-1 overflow-y-auto overscroll-contain"
              data-lenis-prevent
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {currentView}
            </motion.div>
          </AnimatePresence>

          {/* a kártya alján mindig a rendszer jele (design 21.1) — beágyazva linkként */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1"><PoweredBy dark={c.dark} />{!embed && <CookieFooterLink dark={c.dark} onClick={openCookieSettings} />}{company?.privacy_url && <a href={company.privacy_url} target="_blank" rel="noopener noreferrer" className={`text-ui-label ${c.dark ? 'text-white/55' : 'text-ui-muted'} underline-offset-2 outline-none hover:underline`}>{t(locale, 'public.footer.privacy')}</a>}</div>
          {/* Beágyazott (iframe) widgeten márkajelzés — ingyen marketing minden beágyazott oldalról. */}
          {embed && (
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex shrink-0 items-center justify-center gap-2 border-t border-white/10 py-3.5 text-ui-meta transition-colors ${c.meta}`}
            >
              Powered by <BrandLogo variant="dark" className="h-5" />
            </a>
          )}
        </motion.div>
      </div>
    </>
  )
}
