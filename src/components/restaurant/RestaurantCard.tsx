'use client'

import { GoogleReviewsBlock, type GoogleReviewsData } from '@/components/booking/GoogleReviewsBlock'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { ChevronRight, MapPin, Phone, Mail, Globe, CheckCircle, Gift, Camera, X, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice, cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_URL } from '@/lib/brand'
import { t, dfLocale, type Locale } from '@/lib/i18n'
import { format } from 'date-fns'
import { BookingSuccess } from '@/components/booking/BookingSuccess'
import type { EditorView } from '@/components/booking/ProfileCard'
import { RatingStars } from '@/components/booking/RatingStars'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'
import { DepositStep } from '@/components/booking/DepositStep'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/toggle-switch'
import { Textarea } from '@/components/ui/textarea'
import { RestaurantBookingWizard, type EventTypeOption } from './RestaurantBookingWizard'
import type { CompanyInfo } from '@/components/booking/TermsModal'
import OpeningHoursLive from './OpeningHoursLive'
import NextAvailableSlots from './NextAvailableSlots'
import type { GiftVoucherType, Media } from '@/payload/payload-types'

type View = 'main' | 'book' | 'success' | 'voucher'

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
  bookingWindowDays: number
  eventTypes: EventTypeOption[]
  termsSections?: { title?: string | null; body?: string | null }[] | null
  company?: CompanyInfo | null
  depositEnabled?: boolean
  invoicingEnabled?: boolean
  voucherCompanyEnabled?: boolean
  /** Google-értékelések (tárolt, kérésre frissülő másolat) — üres → nem jelenik meg. */
  google?: GoogleReviewsData | null
  addressRequired?: boolean
  addressRequiredNote?: string | null
  hiddenFields?: ('phone' | 'address' | 'notes')[]
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

const RESTAURANT_SECTION_IDS = ['reviews', 'slots', 'voucher']

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
  bookingWindowDays,
  eventTypes,
  termsSections,
  company,
  depositEnabled,
  invoicingEnabled,
  voucherCompanyEnabled = true,
  google = null,
  addressRequired,
  addressRequiredNote,
  hiddenFields = [],
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
  sectionOrder = null,
  hiddenSections = null,
  fieldOrder = null,
  editorAutoConfirm = true,
  goodToKnow = null,
}: RestaurantCardProps) {
  // A főnézet szakaszai a beállított sorrendben (CSS `order`) — a szerkesztő-előnézetben a
  // rejtett szakasz halványan látszik, hogy vissza lehessen kapcsolni (ugyanaz, mint a szalonnál).
  const order = [...(sectionOrder ?? []).filter((id) => RESTAURANT_SECTION_IDS.includes(id)), ...RESTAURANT_SECTION_IDS.filter((id) => !(sectionOrder ?? []).includes(id))]
  const sectionShown = (id: string) => !!editorView || !(hiddenSections ?? []).includes(id)
  const sectionProps = (id: string) => ({
    'data-edit-id': `sec:${id}`,
    style: { order: 2 + order.indexOf(id) },
    className: editorView && (hiddenSections ?? []).includes(id) ? 'opacity-35' : undefined,
  })

  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetDragControls = useDragControls()
  const [isMobile, setIsMobile] = useState(true)
  const [view, setView] = useState<View>('main')
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

  const addressLine = [restaurantAddress, restaurantCity].filter(Boolean).join(', ')

  // Szerkesztő-előnézet: a kért lépésre ugrunk (a foglalás lépéseit a varázsló mintaadatokkal
  // mutatja, a visszaigazolást mintafoglalással) — ugyanaz a viselkedés, mint a szalon kártyáján.
  const wizardStep = editorView && ['datetime', 'details', 'deposit', 'consent', 'summary'].includes(editorView)
    ? editorView as 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' : null
  useEffect(() => {
    if (!editorView) return
    if (editorView === 'main') { setView('main'); setSheetOpen(false); return }
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

  const handleSlotClick = (date: string, time: string, pax: number) => {
    setBookInitial(date || time ? { date, time, pax } : null)
    setView('book')
    setSheetOpen(true)
  }

  const handleSuccess = (date: string, time: string, pax: number, extra?: { confirmed: boolean; icsToken: string | null; hasEmail: boolean; occasion: string | null }) => {
    setSuccessDetails({ date, time, pax, confirmed: extra?.confirmed ?? true, icsToken: extra?.icsToken ?? null, hasEmail: extra?.hasEmail ?? true, occasion: extra?.occasion ?? null })
    setView('success')
  }

  const handleCloseSuccess = () => {
    setView('main')
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
  const [voucherResult, setVoucherResult] = useState<{ code: string; amountHuf: number; qrCodeDataUrl: string } | null>(null)

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
      setVoucherResult({ code: json.code, amountHuf: json.amountHuf, qrCodeDataUrl: json.qrCodeDataUrl })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült létrehozni az utalványt.')
    } finally {
      setVoucherCreating(false)
    }
  }

  const handleCloseVoucherSuccess = () => {
    setView('main')
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

  const mainView = (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-6 lg:px-6">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {t(locale, 'public.bookTable')}
        </p>
        <h2 data-edit-id="name" className="text-[28px] font-light leading-tight tracking-[-0.02em] text-white">
          {restaurantName}
        </h2>
        {reviews.count > 0 && (
          <div className="mt-2">
            <RatingStars rating={reviews.average} count={reviews.count} />
          </div>
        )}
      </div>

      {restaurantDescription && (
        <p data-edit-id="desc" className="text-[14px] leading-relaxed text-white/60">
          {restaurantDescription.slice(0, 220)}
          {restaurantDescription.length > 220 ? '…' : ''}
        </p>
      )}

      {sectionShown('reviews') && google && (
        <div {...sectionProps('reviews')}><GoogleReviewsBlock google={google} locale={locale} title={t(locale, 'public.googleReviews')} countLabel={t(locale, 'public.googleReviewsCount')} allLabel={t(locale, 'public.googleReviewsAll')} openLabel={t(locale, 'public.googleReviewOpen')} /></div>
      )}

      <div data-edit-id="contact" className="flex flex-wrap gap-2" style={{ order: 1 }}>
        {addressLine && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <MapPin className="h-3 w-3" />{addressLine}
          </span>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <Phone className="h-3 w-3" />{phone}
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <Mail className="h-3 w-3" />{email}
          </a>
        )}
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white/90"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <Globe className="h-3 w-3" />{t(locale, 'public.website')}
          </a>
        )}
        {(socialLinks ?? []).filter(Boolean).map((url) => {
          const platform = detectPlatform(url)
          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={SOCIAL_LABELS[platform]}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors hover:bg-white/[0.12]"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <img src={socialIconDataUri(platform)} alt="" className="h-5 w-5 rounded-full" />
            </a>
          )
        })}
      </div>

      {sectionShown('slots') && openingHours.length > 0 && (
        <div {...sectionProps('slots')}>
        <div className="space-y-3">
          <NextAvailableSlots
            restaurantId={restaurantId}
            slug={slug}
            locale={locale}
            variant="dark"
            onSlotClick={handleSlotClick}
          />
          <OpeningHoursLive hours={openingHours} locale={locale} variant="dark" />
        </div>
        </div>
      )}

      {sectionShown('voucher') && voucherEnabled && (
        <div {...sectionProps('voucher')}>
        <button
          onClick={() => setView('voucher')}
          className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <div className="flex items-center gap-2.5">
            <Gift className="h-4 w-4 shrink-0 text-white/40" />
            <div>
              <p className="text-[13px] font-semibold text-white">{t(locale, 'public.voucher.buy')}</p>
              <p className="text-[11px] text-white/45">{t(locale, 'public.voucher.buySubtitle')}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
        </button>
        </div>
      )}

    </div>
  )

  const bookView = (
    <div className="px-4 pb-6 pt-6">
      <RestaurantBookingWizard
        key={bookInitial ? `${bookInitial.date}-${bookInitial.time}` : 'default'}
        restaurantId={restaurantId}
        slug={slug}
        requirePhone={requirePhone}
        maxPax={maxPax}
        bookingWindowDays={bookingWindowDays}
        eventTypes={eventTypes}
        termsSections={termsSections}
        company={company}
        locale={locale}
        onBack={() => setView('main')}
        onSuccess={handleSuccess}
        variant="dark"
        initialDateProp={bookInitial?.date}
        initialTimeProp={bookInitial?.time}
        initialPaxProp={bookInitial?.pax}
        depositEnabled={depositEnabled}
        invoicingEnabled={invoicingEnabled}
        addressRequired={addressRequired}
        addressRequiredNote={addressRequiredNote}
        hiddenFields={hiddenFields}
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
        locale={locale}
        confirmed={successDetails?.confirmed !== false}
        hasEmail={!!successDetails?.hasEmail}
        confirmEmailEnabled={confirmEmailEnabled}
        reminderHours={reminderHours}
        summary={successDetails && (
          <>
            <span className="font-semibold text-white">{t(locale, 'rbooking.guests', { n: successDetails.pax })}</span>
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
        <div className="flex min-h-[50vh] flex-col items-center justify-center py-8 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(52,211,153,0.15)' }}
          >
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
            <h2 className="mb-2 text-2xl font-light tracking-[-0.01em] text-white">{t(locale, 'public.voucher.successTitle')}</h2>
            <p className="mb-6 text-sm text-white/55">{t(locale, 'public.voucher.successSubtitle')}</p>
            <div className="mb-6 rounded-[16px] px-5 py-4" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <p className="mb-1 text-xs text-white/45">{t(locale, 'public.voucher.code')}</p>
              <p className="text-xl font-semibold tracking-wide text-gold">{voucherResult.code}</p>
              <p className="mt-2 text-sm text-white/60">{formatPrice(voucherResult.amountHuf, 'HUF')}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={voucherResult.qrCodeDataUrl} alt={t(locale, 'public.voucher.qrAlt')} className="mx-auto mb-6 h-40 w-40 rounded-[12px]" />
            <button
              onClick={handleCloseVoucherSuccess}
              className="flex h-12 w-full items-center justify-center rounded-full text-[14px] font-semibold text-ink-dark"
              style={{ background: '#FFD85F' }}
            >
              {t(locale, 'public.success.back')}
            </button>
          </motion.div>
        </div>
      ) : (
        <>
          <button onClick={() => setView('main')} className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/45 transition-colors hover:text-white/70">
            <ArrowLeft className="h-3.5 w-3.5" /> {t(locale, 'public.back')}
          </button>
          <h2 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{t(locale, 'public.voucher')}</h2>
          <p className="mb-5 text-[12px] text-white/45">{t(locale, 'public.voucher.redeemableAt', { salon: restaurantName })}</p>

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
                          selected ? 'border-gold bg-gold/[0.08]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                        )}
                      >
                        <div className="h-20 w-full bg-white/[0.06]">
                          {url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="truncate text-[12.5px] font-medium text-white">{vt.name}</div>
                          <div className="text-[12px] text-gold">{formatPrice(vt.amount_huf, 'HUF')}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {voucherTypeError && <p role="alert" className="text-[12px] text-red-400">{t(locale, 'public.voucher.chooseTypeError')}</p>}
              </div>

              <div key={`name-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.name && 'animate-shake')}>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.yourName')} *</Label>
                <Input
                  value={voucherPurchaserName} onChange={e => { setVoucherPurchaserName(e.target.value); clearVoucherFieldError('name') }}
                  className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.name && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.name && <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.name}</p>}
              </div>
              <div key={`email-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.email && 'animate-shake')}>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.yourEmail')} *</Label>
                <Input
                  type="email" inputMode="email" value={voucherPurchaserEmail} onChange={e => { setVoucherPurchaserEmail(e.target.value); clearVoucherFieldError('email') }}
                  className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.email && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.email && <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.email}</p>}
              </div>
              <div key={`city-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.city && 'animate-shake')}>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.city')} *</Label>
                <Input
                  value={voucherPurchaserCity} onChange={e => { setVoucherPurchaserCity(e.target.value); clearVoucherFieldError('city') }}
                  autoComplete="address-level2"
                  className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.city && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.city ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.city}</p> : <p className="text-[11px] text-white/40">{t(locale, 'public.voucher.cityHint')}</p>}
              </div>
              <div key={`address-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.address && 'animate-shake')}>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.address')} *</Label>
                <Input
                  value={voucherPurchaserAddress} onChange={e => { setVoucherPurchaserAddress(e.target.value); clearVoucherFieldError('address') }}
                  autoComplete="street-address"
                  className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.address && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.address ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.address}</p> : <p className="text-[11px] text-white/40">{t(locale, 'public.voucher.addressHint')}</p>}
              </div>

              {invoicingEnabled && voucherCompanyEnabled && (
              <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.06] px-3.5 py-3">
                <span className="text-[13px] text-white/80">{t(locale, 'public.voucher.companyToggle')}</span>
                <Switch checked={voucherIsCompany} onChange={setVoucherIsCompany} ariaLabel={t(locale, 'public.voucher.companyToggle')} />
              </div>
              )}
              {invoicingEnabled && voucherCompanyEnabled && voucherIsCompany && (
                <div key={`taxNumber-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.taxNumber && 'animate-shake')}>
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.taxNumber')} *</Label>
                  <Input
                    value={voucherPurchaserTaxNumber} onChange={e => { setVoucherPurchaserTaxNumber(e.target.value); clearVoucherFieldError('taxNumber') }}
                    placeholder="12345678-1-42"
                    className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.taxNumber && 'ring-1 ring-red-400')}
                  />
                  {voucherFieldErrors.taxNumber ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.taxNumber}</p> : <p className="text-[11px] text-white/40">{t(locale, 'public.voucher.taxNumberHint')}</p>}
                </div>
              )}

              <div className="!mt-6 h-px bg-white/[0.08]" />

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.recipientName')}</Label>
                <Input
                  value={voucherRecipientName} onChange={e => setVoucherRecipientName(e.target.value)}
                  className="h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                />
              </div>
              <div key={`recipientEmail-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.recipientEmail && 'animate-shake')}>
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.recipientEmail')}</Label>
                <Input
                  type="email" inputMode="email" value={voucherRecipientEmail} onChange={e => { setVoucherRecipientEmail(e.target.value); clearVoucherFieldError('recipientEmail') }}
                  className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.recipientEmail && 'ring-1 ring-red-400')}
                />
                {voucherFieldErrors.recipientEmail ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.recipientEmail}</p> : <p className="text-[11px] text-white/40">{t(locale, 'public.voucher.recipientEmailHint')}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{t(locale, 'public.voucher.message')}</Label>
                <Textarea
                  value={voucherMessage} onChange={e => setVoucherMessage(e.target.value)} rows={3}
                  className="rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 resize-none focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                />
              </div>

              <button
                onClick={handleVoucherFormNext}
                className="flex h-14 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'white', color: 'var(--ink-dark)' }}
              >
                {t(locale, 'public.voucher.continueToPay')}
              </button>
            </div>
          ) : voucherCreating ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>
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

  const currentView = view === 'main' ? mainView : view === 'book' ? bookView : view === 'voucher' ? voucherView : successView

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
              onClick={() => {
                if (view !== 'success') setSheetOpen(false)
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
              <button
                data-edit-pass
                onClick={() => { setSheetOpen(true) }}
                className="flex w-full h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-dark"
                style={{ background: '#FFD85F', boxShadow: '0 4px 32px rgba(0,0,0,0.45)' }}
              >
                {t(locale, 'public.bookTable')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Kártya */}
      <div
        className={embed
          ? 'relative w-full p-3 sm:p-4'
          : 'fixed bottom-0 left-0 right-0 z-30 lg:absolute lg:bottom-auto lg:left-auto lg:right-8 lg:top-1/2 lg:w-[500px] lg:-translate-y-1/2'}
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
            if (info.offset.y > 120 || info.velocity.y > 500) setSheetOpen(false)
          }}
          className={embed ? 'flex flex-col overflow-hidden rounded-[24px]' : 'flex flex-col overflow-hidden rounded-t-[28px] lg:rounded-[24px]'}
          style={{
            // Embed módban a kártya a természetes tartalom-magasságára nő — a fenti
            // ResizeObserver ezt küldi postMessage-ben a beágyazó oldalnak (`public/embed.js`).
            // Sima, fix-magasságú iframe-snippetnél a böngésző natív iframe-görgetése a
            // tartalék, ha a tartalom nagyobb a megadott magasságnál.
            ...(embed ? { height: 'auto' } : { height: 'min(82dvh, calc(100dvh - 48px))' }),
            background: embed ? '#16161A' : 'rgba(22,22,26,0.52)',
            backdropFilter: embed ? undefined : 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: embed ? undefined : 'blur(24px) saturate(1.4)',
            border: embed ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.08)',
            borderBottom: embed ? undefined : 'none',
            boxShadow: embed ? '0 4px 24px rgba(0,0,0,0.25)' : undefined,
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

          {/* Sticky CTA footer — csak a főnézeten */}
          <AnimatePresence>
            {view === 'main' && (
              <motion.div
                key="main-cta-footer"
                className="shrink-0 px-5 lg:px-6"
                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => { setView('book'); setSheetOpen(true) }}
                  className="flex w-full h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-dark"
                  style={{ background: '#FFD85F' }}
                >
                  {t(locale, 'public.bookTable')}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Beágyazott (iframe) widgeten márkajelzés — ingyen marketing minden beágyazott oldalról. */}
          {embed && (
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 py-3.5 text-[13px] text-white/45 transition-colors hover:text-white/70"
            >
              Powered by <BrandLogo variant="dark" className="h-5" />
            </a>
          )}
        </motion.div>
      </div>
    </>
  )
}
