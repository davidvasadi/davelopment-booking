'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { loadGuest, saveGuest, forgetGuest } from '@/lib/guestMemory'
import { GoogleReviewsBlock, type GoogleReviewsData } from '@/components/booking/GoogleReviewsBlock'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { ArrowLeft, Check, CheckCircle, Clock, ChevronRight, ChevronDown, Loader2, Tag, Users, User, Phone, Mail, Globe, MapPin, Info, Gift, Camera, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatPrice, cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_URL } from '@/lib/brand'
import { staggerContainer, fadeUp, stepSlide, stepSlideTransition } from '@/lib/motion'
import { trackBookingConversion } from '@/lib/marketingTracking'
import type { Service, StaffMember, ServiceCategory, Media, GiftVoucherType } from '@/payload/payload-types'
import { t as tl, makeT, dfLocale, type Locale } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/toggle-switch'
import { Textarea } from '@/components/ui/textarea'
import { DateStrip } from '@/components/booking/DateStrip'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import type { Section } from '@/components/booking/TermsContent'
import { DepositStep } from '@/components/booking/DepositStep'
import { BookingSuccess } from '@/components/booking/BookingSuccess'
import { GoodToKnowCompact } from '@/components/booking/GoodToKnowSection'
import { iconByKey } from '@/components/settings/goodToKnowIcons'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map(c => [c.code, c.dial]))

type Slot = { start: string; end: string }
type View = 'main' | 'services' | 'serviceDetail' | 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' | 'success' | 'voucher' | 'voucherSuccess'
type FieldKey = 'name' | 'email' | 'phone' | 'city' | 'address' | 'taxNumber'

export type ProfileCardProps = Props

interface Props {
  slug: string
  salonId: string
  locale: Locale
  salonName: string
  salonDescription?: string | null
  salonAddress?: string | null
  salonCity?: string | null
  services: Service[]
  staff: StaffMember[]
  serviceCategories: ServiceCategory[]
  phone?: string | null
  email?: string | null
  website?: string | null
  socialLinks?: string[] | null
  nextSlotNode?: ReactNode
  requirePhone?: boolean
  bookingWindowDays?: number
  termsSections?: Section[] | null
  company?: CompanyInfo | null
  goodToKnow?: { id?: string | null; icon?: string | null; title?: string | null; body?: string | null }[] | null
  depositEnabled?: boolean
  invoicingEnabled?: boolean
  /** Google-értékelések (napi frissítésű tárolt másolat, lib/googleReviews.ts) — üres → nem jelenik meg. */
  google?: GoogleReviewsData | null
  /** `voucher_settings.allow_company` — a „Cégként vásárolok” opció az utalvány-vásárlásnál. */
  voucherCompanyEnabled?: boolean
  addressRequired?: boolean
  addressRequiredNote?: string | null
  /** Teljesen elrejtett foglalási mezők (nem csak opcionális) — `booking_rules.hidden_booking_fields`.
   *  A cím-mezőt a saját, finomabb `addressDetailLevel` vezérli, nem ez a lista. */
  hiddenFields?: ('phone' | 'notes')[]
  /** Cím-mező részletessége — `off` (nem jelenik meg), `city` (csak város), `full` (város +
   *  pontos cím). Előleg aktív esetén ettől függetlenül mindig `full` érvényesül (ld. `addressGateOn`). */
  addressDetailLevel?: 'off' | 'city' | 'full'
  voucherEnabled?: boolean
  voucherTypes?: GiftVoucherType[]
  newsletterEnabled?: boolean
  /** A marketing-elfogadó checkbox megjelenjen-e az Adatok lépésen — `booking_rules.show_marketing_consent_field`. */
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
  /** Beágyazott (iframe) nézet — a widget normál, statikus blokkként jelenik meg a lebegő
   *  hero-kártya pozicionálás helyett (nincs teljes-viewport hero, amihez képest lebeghetne). */
  embed?: boolean
  /** `booking_rules.services_expanded_on_main` — bekapcsolva a szolgáltatás-katalógus rögtön
   *  kibontva jelenik meg a főnézeten, a "Válassz szolgáltatást" gomb helyett. */
  servicesExpandedOnMain?: boolean
  /** `notification_prefs.confirm_email` — megy-e visszaigazoló e-mail a vendégnek. */
  confirmEmailEnabled?: boolean
  /** Az e-mailes emlékeztetők időzítése órában (üres = nincs emlékeztető). */
  reminderHours?: number[]
  /** `booking_rules.public_section_order` / `public_sections_hidden` — a főnézet szakaszai
   *  (services | voucher | staff | reviews). Üres = alapsorrend, minden látható. */
  sectionOrder?: string[] | null
  hiddenSections?: string[] | null
  /** `booking_rules.form_field_order` — az Adatok lépés mezőinek sorrendje. Üres = alapsorrend. */
  fieldOrder?: string[] | null
  /** Szerkesztő-előnézet: ezt a lépést mutassa mintaadatokkal (null = normál működés). */
  editorView?: EditorView | null
  /** Szerkesztő-előnézet: automatikus megerősítés (a Visszaigazolás lépés szövegéhez). */
  editorAutoConfirm?: boolean
}

/** Az Adatok lépés átrendezhető mező-blokkjai (alapsorrend). */
export const FORM_FIELD_IDS = ['name', 'email', 'phone', 'address', 'questions', 'notes'] as const
export type FormFieldId = (typeof FORM_FIELD_IDS)[number]

export type EditorView = 'main' | 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' | 'success' | 'voucher'

function getCategoryId(cat: Service['category']): string | null {
  if (!cat) return null
  if (typeof cat === 'string') return cat
  return (cat as ServiceCategory).id
}

export function ProfileCard({
  slug, salonId, locale, salonName, salonDescription, salonAddress, salonCity,
  services, staff, serviceCategories,
  phone, email, website, socialLinks, nextSlotNode,
  requirePhone = true, bookingWindowDays = 60,
  termsSections, company, goodToKnow, depositEnabled = false, invoicingEnabled = false, voucherCompanyEnabled = true, google = null,
  addressRequired = false, addressRequiredNote = null, hiddenFields = [], addressDetailLevel = 'full',
  voucherEnabled = false, voucherTypes = [], newsletterEnabled = false, showMarketingConsent = true,
  consentEnabled = false, consentTitle = null, consentText = null,
  customQuestions = null, embed = false, servicesExpandedOnMain = false,
  confirmEmailEnabled = true, reminderHours = [], editorView = null, editorAutoConfirm = true,
  sectionOrder = null, hiddenSections = null, fieldOrder = null,
}: Props) {
  const formFieldOrder: FormFieldId[] = [
    ...(fieldOrder ?? []).filter((id): id is FormFieldId => (FORM_FIELD_IDS as readonly string[]).includes(id)),
    ...FORM_FIELD_IDS.filter((id) => !(fieldOrder ?? []).includes(id)),
  ]
  // A főnézet szakaszai a beállított sorrendben (CSS `order`), a rejtettek nélkül — a
  // szerkesztő-előnézetben a rejtett szakasz halványan látszik, hogy vissza lehessen kapcsolni.
  const SECTION_IDS = ['services', 'voucher', 'staff', 'reviews']
  const order = [...(sectionOrder ?? []).filter((id) => SECTION_IDS.includes(id)), ...SECTION_IDS.filter((id) => !(sectionOrder ?? []).includes(id))]
  const sectionShown = (id: string) => !!editorView || !(hiddenSections ?? []).includes(id)
  const sectionProps = (id: string) => ({
    'data-edit-id': `sec:${id}`,
    style: { order: order.indexOf(id) },
    className: editorView && (hiddenSections ?? []).includes(id) ? 'opacity-35' : undefined,
  })
  const tt = makeT(locale)

  // Browse navigation state
  const [view, setView] = useState<View>('main')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  // Ha a főnézeten előbb egy konkrét munkatársat választ a vendég, ezt tároljuk — a
  // szolgáltatás-listát rá szűrjük, és a serviceDetail nézeten már nem kérdezünk rá újra.
  const [preStaffId, setPreStaffId] = useState<string | null>(null)
  const [staffStripOpen, setStaffStripOpen] = useState(false)
  const [dir, setDir] = useState(1)

  // Booking flow state
  const [bookingStaffId, setBookingStaffId] = useState<string | null>(null)
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCountry, setCustomerCountry] = useState('HU')
  const [customerCity, setCustomerCity] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerIsCompany, setCustomerIsCompany] = useState(false)
  const [customerTaxNumber, setCustomerTaxNumber] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  // Visszatérő vendég: az előző foglalás adatai ebben a böngészőben (lásd lib/guestMemory).
  const [rememberedGuest, setRememberedGuest] = useState(false)
  useEffect(() => {
    const g = loadGuest(salonId)
    if (!g) return
    setCustomerName((v) => v || g.name)
    setCustomerEmail((v) => v || g.email)
    setCustomerPhone((v) => v || g.phone)
    setCustomerCountry(g.country || 'HU')
    setCustomerCity((v) => v || g.city)
    setRememberedGuest(true)
  }, [salonId])
  const forgetRememberedGuest = () => {
    forgetGuest(salonId)
    setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); setCustomerCity('')
    setRememberedGuest(false)
  }
  // GDPR opt-in — SOSE előre kipipált, a foglaláskor mentődik tartósan a Customers táblába.
  const [marketingConsent, setMarketingConsent] = useState(false)
  // Beleegyező nyilatkozat elfogadása — SOSE előre bekapcsolva, per-foglalás mentődik.
  const [consentGiven, setConsentGiven] = useState(false)
  // Egyedi kérdések válaszai — kérdés-id kulccsal, a details lépésben töltve ki.
  const customQuestionsList = customQuestions ?? []
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [depositAmountHuf, setDepositAmountHuf] = useState<number | null>(null)
  const [successDetails, setSuccessDetails] = useState<{
    service: string; staff: string; date: string; time: string
    /** `confirmed` = automatikus megerősítés; `pending` = a tulaj még jóváhagyja. */
    confirmed: boolean
    /** A .ics letöltéshez (a lemondó link tokenje); null, ha a szerver nem adta vissza. */
    icsToken: string | null
    hasEmail: boolean
  } | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})

  // Ajándékutalvány-vásárlás állapota — a fő foglalás-flow-tól teljesen független mellékág.
  // A vendég a tulaj által előre létrehozott típusok közül választ (nincs szabad összeg/kép).
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
  const [detailsShakeKey, setDetailsShakeKey] = useState(0)
  const [voucherPaymentStep, setVoucherPaymentStep] = useState(false)
  const [voucherCreating, setVoucherCreating] = useState(false)
  const [voucherResult, setVoucherResult] = useState<{ code: string; amountHuf: number; qrCodeDataUrl: string } | null>(null)

  // Ajándékutalvány-beváltás állapota — a `details` lépés opcionális mezője.
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemChecking, setRedeemChecking] = useState(false)
  const [redeemValid, setRedeemValid] = useState<{ amount_huf: number } | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)

  // Mobile sheet open state
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetDragControls = useDragControls()
  const [isMobile, setIsMobile] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Embed módban: a kártya saját tartalom-magasságát figyeljük, és postMessage-en jelezzük a
  // beágyazó oldal felé (a `public/embed.js` loader ez alapján méretezi élőben az iframe-et —
  // nincs kézzel beírt magasság-szám, nincs felesleges üres hely/görgetés).
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
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    address: useRef<HTMLInputElement>(null),
    taxNumber: useRef<HTMLInputElement>(null),
  }

  const isBookingView = view === 'datetime' || view === 'details' || view === 'deposit' || view === 'consent' || view === 'summary'

  // Egy szolgáltatás csak akkor foglalható a publikus oldalon, ha legalább egy munkatárs hozzá
  // van rendelve — enélkül a foglaló-varázsló zsákutcába futna (nincs kit választani a
  // szakember-lépésen), ezért az ilyen, még be nem állított szolgáltatás egyáltalán nem
  // jelenik meg, amíg a tulaj hozzá nem rendel valakit a Beállításokban.
  const staffIdsOf = (s: Service) =>
    (s.staff ?? []).map(m => String(m && typeof m === 'object' && 'id' in m ? (m as { id: unknown }).id : m))
  const isServiceEligibleForStaff = (s: Service, staffId: string) => staffIdsOf(s).includes(staffId)
  const bookableServices = services.filter(s => staffIdsOf(s).length > 0)
  const visibleServices = preStaffId ? bookableServices.filter(s => isServiceEligibleForStaff(s, preStaffId)) : bookableServices
  // Ha a szalonnak csak EGY szakembere van, nincs értelme külön "bármelyik szabad" vs. "ez a
  // konkrét személy" választásnak — a kettő ugyanoda vezet. Ilyenkor ő automatikusan a
  // megjelenített szakember, függetlenül attól, melyik útvonalon (Szolgáltatások vagy a
  // szakember-csempe) indult a vendég a főnézeten.
  const soleStaff = staff.length === 1 ? staff[0] : null
  const preStaff = soleStaff ?? (preStaffId ? staff.find(m => String(m.id) === preStaffId) ?? null : null)

  // A `category` a Services collectionben opcionális — egy szolgáltatásnak nem kötelező
  // kategóriája legyen. Az ilyen, kategória nélküli szolgáltatásokat NEM egy mesterséges
  // "Egyéb" kategória-csempébe tesszük (az felesleges plusz kattintás lenne), hanem közvetlenül,
  // a saját nevükkel listázzuk a kategória-választó nézeten, a kategória-csempék alatt.
  const hasCategories = serviceCategories.length > 0
  const uncategorizedServices = visibleServices.filter(s => getCategoryId(s.category) === null)
  const categoryGroups = hasCategories
    ? serviceCategories
        .map(cat => ({
          ...cat,
          services: visibleServices.filter(s => getCategoryId(s.category) === cat.id),
        }))
        .filter(g => g.services.length > 0)
    : []

  const selectedCategory = categoryGroups.find(g => g.id === selectedCategoryId)
  const servicesInView = selectedCategory?.services ?? visibleServices
  const selectedService = services.find(s => String(s.id) === selectedServiceId) ?? null
  const serviceImgUrl = selectedService?.image && typeof selectedService.image === 'object'
    ? (selectedService.image as Media).url ?? null : null

  // Always resolve from the full staff array (depth-1, avatar populated)
  const serviceStaff = (selectedService?.staff ?? [])
    .map(m => {
      const id = m && typeof m === 'object' && 'id' in m
        ? String((m as { id: unknown }).id)
        : String(m)
      return staff.find(sm => String(sm.id) === id)
    })
    .filter((m): m is StaffMember => !!m)

  const bookingService = selectedService
  const bookingStaff = bookingStaffId ? (staff.find(m => String(m.id) === String(bookingStaffId)) ?? null) : null
  const bookingDateParsed = new Date(bookingDate + 'T00:00:00')

  // A lépés-fejlécben mindvégig látható "kiválasztott szakember" csík forrása: a főnézeten SOHA
  // nem jelenik meg (ott a Munkatársak-rács mutatja a szakembert/szakembereket, 1 fő esetén is —
  // konzisztens a több szakemberes nézettel), a szolgáltatás-választás lépésein
  // (services/serviceDetail) a preStaff, utána (datetime-tól) a végleges bookingStaff —
  // "Bármelyik szakember" esetén nincs konkrét személy, a csík nem jelenik meg.
  const displayStaff = view === 'main' ? null : (view === 'services' || view === 'serviceDetail') ? preStaff : bookingStaff

  // Szerkesztő-előnézet: a kért lépésre ugrunk, mintaadatokkal (első foglalható szolgáltatás,
  // annak első szakembere, holnap 14:00) — így minden lépés valódi formájában szerkeszthető.
  useEffect(() => {
    if (!editorView) return
    setDir(1)
    if (editorView === 'main') { setView('main'); setSheetOpen(false); return }
    const svc = bookableServices[0] ?? null
    const member = svc ? staff.find((m) => staffIdsOf(svc).includes(String(m.id))) ?? null : null
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
    const end = new Date(0, 0, 1, 14, svc?.duration_minutes ?? 45)
    setSelectedServiceId(svc ? String(svc.id) : null)
    setBookingStaffId(member ? String(member.id) : null)
    setBookingDate(tomorrow)
    setBookingSlot({ start: '14:00', end: format(end, 'HH:mm') })
    setCustomerName('Minta Vendég')
    setCustomerEmail('vendeg@pelda.hu')
    setCustomerPhone('30 123 4567')
    if (editorView === 'success') {
      setSuccessDetails({
        service: svc?.name ?? '', staff: member?.name ?? tt('booking.staff.any'),
        date: format(new Date(tomorrow + 'T00:00:00'), 'MMM d.', { locale: dfLocale(locale) }), time: '14:00',
        confirmed: editorAutoConfirm, icsToken: null, hasEmail: true,
      })
    }
    setView(editorView)
    setSheetOpen(true)
  }, [editorView, editorAutoConfirm]) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (
    newView: View,
    catId: string | null = null,
    svcId: string | null = null,
    d?: number,
  ) => {
    setDir(d ?? (newView !== 'main' ? 1 : -1))
    setSelectedCategoryId(catId)
    setSelectedServiceId(svcId)
    if (newView === 'main') setPreStaffId(null)
    setView(newView)
  }

  const startBooking = (staffId: string | null) => {
    setBookingStaffId(staffId)
    setBookingSlot(null)
    setDir(1)
    setView('datetime')
  }

  const handleBack = () => {
    if (view === 'summary') { setDir(-1); setView(consentEnabled ? 'consent' : 'details') }
    else if (view === 'consent') { setDir(-1); setView(depositEnabled ? 'deposit' : 'details') }
    else if (view === 'details') { setDir(-1); setView('datetime') }
    else if (view === 'datetime') { setDir(-1); setView('serviceDetail') }
    else if (view === 'serviceDetail') goTo('services', selectedCategoryId, null, -1)
    else if (view === 'services' && selectedCategoryId !== null) goTo('services', null, null, -1)
    else if (view === 'services') goTo('main', null, null, -1)
    else goTo('main', null, null, -1)
  }

  const handleCloseSuccess = () => {
    setDir(-1)
    setView('main')
    setSuccessDetails(null)
    setSelectedCategoryId(null)
    setSelectedServiceId(null)
    setPreStaffId(null)
    setBookingStaffId(null)
    setBookingSlot(null)
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerCity('')
    setCustomerAddress('')
    setCustomerNotes('')
    setMarketingConsent(false)
    setPaymentIntentId(null)
    setDepositAmountHuf(null)
    setErrors({})
    setRedeemOpen(false)
    setRedeemCode('')
    setRedeemValid(null)
    setRedeemError(null)
    setSheetOpen(false)
  }

  // A kiválasztott-szakember csík ne maradjon nyitva, ha másik szakemberre váltanak, vagy
  // elhagyják a lépést, ahol egyáltalán megjelenik.
  useEffect(() => { setStaffStripOpen(false) }, [displayStaff?.id])

  // Desktop CTA — BookCtaMorph / nextSlotNode open services view
  useEffect(() => {
    const handler = () => {
      setDir(1)
      setSelectedCategoryId(null)
      setSelectedServiceId(null)
      setView('services')
    }
    window.addEventListener('davelopment:openServices', handler)
    return () => window.removeEventListener('davelopment:openServices', handler)
  }, [])

  // Ajándékutalvány QR-kódjából/linkjéből érkező vendég — a `?voucher=KÓD` paramot előtöltjük
  // a beváltás-mezőbe és nyitva hagyjuk, hogy mire a details lépésig ér, ne kelljen újra beírnia.
  const searchParams = useSearchParams()
  useEffect(() => {
    const code = searchParams.get('voucher')
    if (code) {
      setRedeemCode(code.toUpperCase())
      setRedeemOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSlots = () => {
    if (!selectedServiceId) return
    setLoadingSlots(true)
    setSlotsError(false)
    setSlots([])
    const params = new URLSearchParams({
      salonId, serviceId: selectedServiceId, date: bookingDate,
      ...(bookingStaffId ? { staffId: bookingStaffId } : {}),
    })
    fetch(`/api/slots?${params}`)
      .then(r => { if (!r.ok) throw new Error('slots'); return r.json() })
      .then(d => setSlots(d.slots ?? []))
      .catch(() => setSlotsError(true))
      .finally(() => setLoadingSlots(false))
  }

  useEffect(() => {
    if (view !== 'datetime') return
    loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedServiceId, bookingStaffId, bookingDate, salonId])

  // Cím/város kötelezővé válik előlegnél VAGY ha a cég külön bekapcsolta (deposit nélkül is) —
  // ez a kapcsoló FELÜLÍRJA a tulaj kikapcsolás-szándékát (számlázáshoz kell az előlegnél).
  const addressGateOn = depositEnabled || addressRequired
  // Előleg aktív esetén FÜGGETLENÜL mindig a teljes cím érvényesül (számlázáshoz kell) —
  // ez felülírja a tulaj "csak város"/"kikapcsolva" beállítását.
  const effectiveAddressLevel = addressGateOn ? 'full' : addressDetailLevel
  const addressVisible = effectiveAddressLevel !== 'off'
  const addressCityOnly = effectiveAddressLevel === 'city'
  const phoneVisible = !hiddenFields.includes('phone')
  const notesVisible = !hiddenFields.includes('notes')
  const marketingVisible = newsletterEnabled && showMarketingConsent
  // Az egyedi indoklás mindig elsőbbséget élvez (akkor is, ha az előleg is be van kapcsolva),
  // különben a felülírás észrevétlen maradna a cégnek — ld. user-visszajelzés.
  const addressNote = addressRequiredNote?.trim()
    || (depositEnabled ? 'Az előleg-számlázáshoz kötelező.' : 'A pontos cím megadására a foglalásod rögzítéséhez van szükségünk.')

  const validateField = (key: FieldKey): string | null => {
    if (key === 'name') return !customerName || customerName.trim().length < 2 ? tt('booking.err.name') : null
    if (key === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ? tt('booking.err.email') : null
    if (key === 'phone') return phoneVisible && requirePhone && customerPhone.replace(/\s/g, '').length < 7 ? tt('booking.err.phone') : null
    if (key === 'city') return addressGateOn && !customerCity.trim() ? 'A város megadása kötelező' : null
    if (key === 'address') return addressGateOn && !addressCityOnly && !customerAddress.trim() ? 'A cím (utca, házszám) megadása kötelező' : null
    if (key === 'taxNumber') return customerIsCompany && !customerTaxNumber.trim() ? 'Céges vásárlásnál az adószám megadása kötelező.' : null
    return null
  }

  const onFieldBlur = (key: FieldKey) => {
    const msg = validateField(key)
    setErrors(prev => ({ ...prev, [key]: msg ?? undefined }))
  }

  const clearError = (key: FieldKey) => {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const validateCustomQuestion = (q: NonNullable<Props['customQuestions']>[number]): string | null => {
    if (!q.required || q.type === 'yesno') return null
    const val = customAnswers[q.id ?? ''] ?? ''
    return val.trim() ? null : 'Kötelező mező'
  }

  const submit = async () => {
    if (!selectedServiceId || !bookingSlot) return
    const order: FieldKey[] = ['name', 'email', ...(phoneVisible ? (['phone'] as FieldKey[]) : []), ...(addressGateOn ? (['city', 'address'] as FieldKey[]) : []), ...(depositEnabled && customerIsCompany ? (['taxNumber'] as FieldKey[]) : [])]
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
      const firstBad = order.find(k => nextErrors[k])
      if (firstBad) fieldRefs[firstBad].current?.focus()
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId, serviceId: selectedServiceId, staffId: bookingStaffId,
          date: bookingDate, start_time: bookingSlot.start, end_time: bookingSlot.end,
          customer_name: customerName, customer_email: customerEmail,
          customer_phone: customerPhone.trim()
            ? `${DIAL_BY_CODE[customerCountry] ?? ''} ${customerPhone.trim()}`.trim()
            : '',
          customer_city: customerCity.trim() || undefined,
          customer_address: customerAddress.trim() || undefined,
          ...(depositEnabled && customerIsCompany && customerTaxNumber.trim() ? { customer_tax_number: customerTaxNumber.trim() } : {}),
          notes: customerNotes, locale,
          ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
          ...(redeemValid && redeemCode.trim() ? { voucher_code: redeemCode.trim().toUpperCase() } : {}),
          ...(marketingVisible && marketingConsent ? { marketing_consent: true } : {}),
          ...(consentEnabled ? { consent_accepted: consentGiven } : {}),
          ...(customQuestionsList.length > 0
            ? { custom_answers: customQuestionsList.filter(q => q.id).map(q => ({ id: q.id as string, answer: customAnswers[q.id as string] ?? '' })) }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? tt('booking.err.generic'))
      const created = (data.booking ?? {}) as { status?: string; cancellation_token?: string | null }
      saveGuest(salonId, { name: customerName.trim(), email: customerEmail.trim(), phone: customerPhone.trim(), country: customerCountry, city: customerCity.trim() })
      setRememberedGuest(true)
      setSuccessDetails({
        service: bookingService?.name ?? '',
        staff: bookingStaffId ? (bookingStaff?.name ?? '') : tt('booking.staff.any'),
        date: format(bookingDateParsed, 'MMM d.', { locale: dfLocale(locale) }),
        time: bookingSlot.start,
        confirmed: created.status !== 'pending',
        icsToken: created.cancellation_token ?? null,
        hasEmail: !!customerEmail.trim(),
      })
      trackBookingConversion()
      setDir(1)
      setView('success')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tt('booking.err.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  // Ajándékutalvány-kód élő ellenőrzése a details lépésen — csak UX-visszajelzés, a tényleges
  // beváltást a szerver a `submit()` foglalás-mentésekor ÚJRA leellenőrzi.
  const checkRedeemCode = async () => {
    const code = redeemCode.trim()
    if (!code) { setRedeemValid(null); setRedeemError(null); return }
    setRedeemChecking(true)
    setRedeemError(null)
    try {
      const params = new URLSearchParams({ code, salonId })
      const res = await fetch(`/api/vouchers/validate?${params}`)
      const json = await res.json()
      if (json.valid) {
        setRedeemValid({ amount_huf: json.amount_huf })
      } else {
        setRedeemValid(null)
        setRedeemError(json.reason ?? 'Érvénytelen kód.')
      }
    } catch {
      setRedeemValid(null)
      setRedeemError('Nem sikerült ellenőrizni a kódot.')
    } finally {
      setRedeemChecking(false)
    }
  }

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
          kind: 'salon', salonId, paymentIntentId,
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
      setDir(1)
      setView('voucherSuccess')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült létrehozni az utalványt.')
    } finally {
      setVoucherCreating(false)
    }
  }

  const handleCloseVoucherSuccess = () => {
    setDir(-1)
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

  // 1 szakembernél is 2-oszlopos rács — így a kártya csak félszélességű (nem tölti ki az egész
  // kártyát egy irreálisan nagy csempeként), a szabad oldal egyszerűen üresen marad mellette.
  const staffCols = staff.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'

  // 0 Ft-os szolgáltatásnál nem árat írunk ki, hanem hogy "Ingyenes" — a "0 Ft" hiányzó
  // adatnak/hibának tűnne, holott szándékosan díjmentes szolgáltatásról van szó.
  const priceLabel = (price: number, currency?: string | null) => (price === 0 ? tt('public.free') : formatPrice(price, currency ?? undefined))

  // Egy szolgáltatás-sor közös megjelenítése — a kategória-nélküli szolgáltatások közvetlen
  // listázásánál ÉS a "belül vagyunk egy kategóriában / nincs is kategória" nézetnél is
  // ugyanezt használjuk, hogy a két hely sose csússzon szét.
  const renderServiceRow = (s: Service, onClick: () => void) => {
    const sImgUrl = s.image && typeof s.image === 'object' ? (s.image as Media).url ?? null : null
    return (
      <button
        key={s.id}
        onClick={onClick}
        className="flex w-full items-center justify-between overflow-hidden rounded-xl text-left transition-colors hover:bg-white/[0.08]"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {sImgUrl && (
          <div className="h-[60px] w-[60px] shrink-0 overflow-hidden" style={{ borderRadius: '10px 0 0 10px' }}>
            <img src={sImgUrl} alt={s.name} className="h-full w-full object-cover" />
          </div>
        )}
        <div className={cn('min-w-0 flex-1', sImgUrl ? 'px-3 py-3' : 'py-3 pl-3')}>
          <p className="text-[13px] font-semibold text-white">{s.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/45">
            <Clock className="h-2.5 w-2.5" />{s.duration_minutes} {tt('booking.minutes')}
          </p>
        </div>
        <div className="mr-3 flex shrink-0 items-center gap-2">
          <p className="text-[13px] font-bold text-white">{priceLabel(s.price, s.currency)}</p>
          <ChevronRight className="h-3.5 w-3.5 text-white/35" />
        </div>
      </button>
    )
  }

  return (
    <>
    {/* Backdrop — kártya mögé, kattintásra zár (embed módban nincs mobil-sheet, nem kell) */}
    {!embed && (
      <AnimatePresence>
        {isMobile && sheetOpen && (
          <motion.div
            key="sheet-backdrop"
            data-edit-pass
            className="fixed inset-0 z-[29] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSheetOpen(false)}
          />
        )}
      </AnimatePresence>
    )}

    {/* Lebegő CTA — mobilon, kártya nyitása előtt (embed módban a kártya mindig nyitva van) */}
    {!embed && (
      <AnimatePresence>
        {isMobile && !sheetOpen && (
          <motion.div
            key="mobile-hero-cta"
            className="fixed bottom-0 left-0 right-0 z-20 px-5 lg:hidden"
            style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.3 }}
          >
            <button
              data-edit-pass
              onClick={() => setSheetOpen(true)}
              className="flex w-full h-14 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-dark"
              style={{ background: '#FFD85F', boxShadow: '0 4px 32px rgba(0,0,0,0.45)' }}
            >
              {tl(locale, 'public.bookCta')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    )}

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
          // Embed módban a kártya a TERMÉSZETES tartalom-magasságára nő (nincs korlát) — a
          // fenti ResizeObserver ezt küldi el postMessage-ben a beágyazó oldalnak. Ha valaki a
          // sima, fix-magasságú iframe-snippetet használja (nem az automatikus loadert), a
          // böngésző NATÍV iframe-görgetése lép életbe, ha a tartalom nagyobb a megadott
          // magasságnál — nincs szükség egyedi belső görgetésre.
          ...(embed ? { height: 'auto' } : { height: 'min(82dvh, calc(100dvh - 48px))' }),
          background: embed ? '#16161A' : 'rgba(22,22,26,0.52)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: embed ? '0 4px 24px rgba(0,0,0,0.25)' : '0 -2px 40px rgba(0,0,0,0.35), 0 24px 56px -12px rgba(0,0,0,0.4)',
          backdropFilter: embed ? undefined : 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: embed ? undefined : 'blur(24px) saturate(1.4)',
        }}
      >
        {/* Drag handle — mobilon lehúzható (embed módban nincs húzható sheet) */}
        {!embed && (
          <div
            className="flex shrink-0 touch-none justify-center pb-1 pt-3 lg:hidden"
            onPointerDown={(e) => sheetDragControls.start(e)}
            style={{ touchAction: 'none' }}
          >
            <div className="h-1 w-9 rounded-full bg-white/20" />
          </div>
        )}

        {/* Step indicator row — minden nem-main, nem-success nézeten */}
        {view !== 'main' && view !== 'success' && view !== 'voucher' && view !== 'voucherSuccess' && (() => {
          const stepCount = 4 + (depositEnabled ? 1 : 0) + (consentEnabled ? 1 : 0)
          const stepIndex = view === 'services' || view === 'serviceDetail' ? 0
            : view === 'datetime' ? 1 : view === 'details' ? 2
            : view === 'deposit' ? 3
            : view === 'consent' ? 3 + (depositEnabled ? 1 : 0)
            : stepCount - 1
          return (
            <div className="shrink-0 flex items-center justify-between px-5 pb-2 pt-4 lg:px-6 lg:pt-5">
              <button
                onClick={handleBack}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: stepCount }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === stepIndex ? '20px' : '7px',
                      background: i === stepIndex ? 'rgba(255,255,255,0.9)' : i < stepIndex ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-white/35 tabular-nums">{stepIndex + 1}/{stepCount}</span>
            </div>
          )
        })()}

        {/* Kiválasztott szakember csík — a szolgáltatás-választástól az összegzésig mindvégig
            látható, hogy a bizalmi infó (bemutatkozás + social) ne vesszen el a folyamat közben.
            Kattintásra HELYBEN kinyílik (nem navigál el), hogy egy hosszabb bemutatkozás is
            elférjen — a szakember-váltás külön, explicit gombbal történik a kinyílt panelben,
            nem a kártya egészének (nem egyértelmű) kattintásával. "Bármelyik szakember"
            esetén nincs kit mutatni. A főnézeten SOHA nem jelenik meg (1 szakembernél is a lenti
            Munkatársak-rács mutatja, konzisztensen a több szakemberes esettel). */}
        {view !== 'main' && view !== 'success' && view !== 'voucher' && view !== 'voucherSuccess' && displayStaff && (() => {
          const avatarUrl = displayStaff.avatar && typeof displayStaff.avatar === 'object' ? (displayStaff.avatar as Media).url ?? null : null
          const links = (displayStaff.social_links ?? []).map((s) => s.url).filter(Boolean)
          return (
            <div data-edit-id={`staff:${displayStaff.id}`} className="mx-5 mb-2 shrink-0 overflow-hidden rounded-2xl lg:mx-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setStaffStripOpen(o => !o)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayStaff.name} className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-white/40">{displayStaff.name[0]}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold leading-tight text-white">{displayStaff.name}</p>
                  {displayStaff.bio && <p className="mt-0.5 truncate text-[11px] text-white/45">{displayStaff.bio}</p>}
                </div>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/35 transition-transform ${staffStripOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {staffStripOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t px-3 pb-3 pt-2.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      {displayStaff.bio && <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-white/60">{displayStaff.bio}</p>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {links.map((url) => {
                          const platform = detectPlatform(url)
                          return (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/[0.14]"
                              aria-label={SOCIAL_LABELS[platform]}
                            >
                              <img src={socialIconDataUri(platform)} alt="" className="h-5 w-5 rounded-full" />
                            </a>
                          )
                        })}
                        {staff.length > 1 && (
                          <button
                            type="button"
                            onClick={() => { setStaffStripOpen(false); goTo('main', null, null, -1) }}
                            className="ml-auto text-[12px] font-medium text-white/45 underline-offset-2 transition-colors hover:text-white hover:underline"
                          >
                            Szakember váltása
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })()}

        {/* Scrollable content — header + tartalom együtt scrollozik */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6" data-lenis-prevent style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className={view === 'main' ? 'pb-4 pt-5 lg:pt-6' : 'pb-4 pt-2'}>
            {view === 'main' ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{tl(locale, 'public.eyebrow')}</p>
                <h2 data-edit-id="name" className="mt-0.5 text-[20px] font-light leading-tight tracking-[-0.02em] text-white">{salonName}</h2>
                {(salonDescription || salonAddress || salonCity) && (
                  <div className="mt-4 space-y-2.5">
                    {salonDescription && (
                      <p data-edit-id="desc" className="line-clamp-2 text-[12px] leading-relaxed text-white/50">{salonDescription}</p>
                    )}
                    {(salonAddress || salonCity) && (
                      <p data-edit-id="address" className="flex items-center gap-1.5 text-[12px] text-white/55">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {[salonAddress, salonCity].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                {(phone || email || website || (socialLinks ?? []).some(Boolean)) && (
                  <div data-edit-id="contact" className="mt-3 flex flex-wrap gap-2">
                    {phone && (
                      <a href={`tel:${phone}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Phone className="h-3.5 w-3.5 shrink-0" />{phone}
                      </a>
                    )}
                    {email && (
                      <a href={`mailto:${email}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Mail className="h-3.5 w-3.5 shrink-0" />{email}
                      </a>
                    )}
                    {website && (
                      <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-white/60 transition-colors hover:text-white active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Globe className="h-3.5 w-3.5 shrink-0" />{tl(locale, 'public.website')}
                      </a>
                    )}
                    {(socialLinks ?? []).filter(Boolean).map((url) => {
                      const platform = detectPlatform(url)
                      return (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[platform]} className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/[0.12] active:scale-[0.97]" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                          <img src={socialIconDataUri(platform)} alt="" className="h-6 w-6 rounded-full" />
                        </a>
                      )
                    })}
                  </div>
                )}
              </>
            ) : null}
            <div className="mt-4 h-px bg-white/[0.08]" />
          </div>
          {/* overflow-x-clip: a lépésváltó ±40px-es csúszása és a hibás mezőre fókuszálás ne
              tudja vízszintesen elgörgetni a tartalmat (a hidden ezt programból még engedné). */}
          <div className="overflow-x-clip pt-0">


          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={view + (selectedCategoryId ?? '') + (selectedServiceId ?? '')}
              custom={dir}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepSlideTransition}
            >

              {/* MAIN */}
              {view === 'main' && (
                <div className="flex flex-col gap-5 pb-2">
                  {sectionShown('services') && bookableServices.length > 0 && (
                    <div {...sectionProps('services')}>
                      <div className="mb-3 flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-white/40" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{tl(locale, 'public.services')}</p>
                      </div>
                      {servicesExpandedOnMain ? (
                        // `booking_rules.services_expanded_on_main` — a katalógus rögtön kibontva,
                        // a "Válassz szolgáltatást" gomb nélkül. Kategóriánál a csempe még mindig
                        // a `services` nézetbe navigál (a konkrét szolgáltatás kiválasztásához úgyis
                        // kell egy további lépés), de a kezdő plusz-kattintás megspórolódik.
                        <div className="space-y-1.5">
                          {categoryGroups.length > 0 ? (
                            <>
                              {categoryGroups.map(group => {
                                const catImgUrl = group.image && typeof group.image === 'object'
                                  ? (group.image as Media).url ?? null : null
                                return (
                                  <button
                                    key={group.id}
                                    onClick={() => { setPreStaffId(null); goTo('services', group.id) }}
                                    className="flex w-full items-center justify-between overflow-hidden rounded-xl text-left transition-colors hover:bg-white/[0.08]"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                                  >
                                    {catImgUrl && (
                                      <div className="h-[60px] w-[60px] shrink-0 overflow-hidden" style={{ borderRadius: '10px 0 0 10px' }}>
                                        <img src={catImgUrl} alt={group.name} className="h-full w-full object-cover" />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1 px-3 py-3">
                                      <p className="text-[13px] font-semibold text-white">{group.name}</p>
                                      <p className="mt-0.5 text-[11px] text-white/45">{tt('public.serviceCount', { n: group.services.length })}</p>
                                    </div>
                                    <ChevronRight className="mr-3 h-3.5 w-3.5 shrink-0 text-white/35" />
                                  </button>
                                )
                              })}
                              {uncategorizedServices.map(s => renderServiceRow(s, () => { setPreStaffId(null); goTo('serviceDetail', null, String(s.id)) }))}
                            </>
                          ) : (
                            bookableServices.map(s => renderServiceRow(s, () => { setPreStaffId(null); goTo('serviceDetail', null, String(s.id)) }))
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setPreStaffId(null); goTo('services', null) }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99]"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                          <div>
                            <p className="text-[13px] font-semibold text-white">{tt('public.chooseService')}</p>
                            <p className="text-[11px] text-white/45">{tt('public.serviceCount', { n: bookableServices.length })}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                        </button>
                      )}
                    </div>
                  )}
                  {sectionShown('voucher') && voucherEnabled && (
                    <div {...sectionProps('voucher')}>
                      <div className="mb-3 flex items-center gap-2">
                        <Gift className="h-3.5 w-3.5 text-white/40" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{tt('public.voucher')}</p>
                      </div>
                      <button
                        onClick={() => goTo('voucher', null)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.99]"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-white">{tt('public.voucher.buy')}</p>
                          <p className="text-[11px] text-white/45">{tt('public.voucher.buySubtitle')}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                      </button>
                    </div>
                  )}
                  {/* 1 szakembernél is mutatjuk (egyetlen csempeként) — konzisztens elrendezés
                      a több szakemberes nézettel, nem külön kompakt fejléc-csíkkal. */}
                  {sectionShown('staff') && staff.length > 0 && (
                    <div {...sectionProps('staff')}>
                      <div className="mb-3 flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-white/40" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{tl(locale, 'public.staff')}</p>
                      </div>
                      <div className={`grid ${staffCols} gap-2`}>
                        {staff.map(m => {
                          const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                          const links = (m.social_links ?? []).map((s) => s.url).filter(Boolean)
                          return (
                            <div
                              key={m.id}
                              data-edit-id={`staff:${m.id}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => { setPreStaffId(String(m.id)); goTo('services', null) }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreStaffId(String(m.id)); goTo('services', null) } }}
                              className="relative cursor-pointer transition-opacity hover:opacity-90"
                              style={{ aspectRatio: '3/4', clipPath: 'inset(0 round 12px)' }}
                            >
                              <div className="absolute inset-0 bg-ink/[0.07]">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={m.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[32px] font-semibold text-white/25">{m.name[0]}</span>
                                  </div>
                                )}
                                {links.length > 0 && (
                                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                                    {links.slice(0, 2).map((url) => {
                                      const platform = detectPlatform(url)
                                      return (
                                        <a
                                          key={url}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          aria-label={SOCIAL_LABELS[platform]}
                                          className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
                                        >
                                          <img src={socialIconDataUri(platform)} alt="" className="h-3.5 w-3.5 rounded-full" />
                                        </a>
                                      )
                                    })}
                                  </div>
                                )}
                                <div
                                  className="absolute inset-x-0 bottom-0 flex min-h-[52px] flex-col justify-center px-2.5 py-2.5"
                                  style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                                >
                                  <p className="truncate text-[12px] font-semibold leading-tight text-white">{m.name}</p>
                                  {m.bio && <p className="mt-0.5 truncate text-[10px] text-white/65">{m.bio}</p>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {sectionShown('reviews') && google && (
                    <div {...sectionProps('reviews')}><GoogleReviewsBlock google={google} locale={locale} className="mt-6" title={tt('public.googleReviews')} countLabel={tt('public.googleReviewsCount')} allLabel={tt('public.googleReviewsAll')} openLabel={tt('public.googleReviewOpen')} /></div>
                  )}
                </div>
              )}

              {/* SERVICES — category list */}
              {view === 'services' && categoryGroups.length > 0 && selectedCategoryId === null && (
                <div className="pb-2">
                  <h3 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{tl(locale, 'public.services')}</h3>
                  <div className="space-y-1.5">
                    {categoryGroups.map(group => {
                      const catImgUrl = group.image && typeof group.image === 'object'
                        ? (group.image as Media).url ?? null : null
                      return (
                        <button
                          key={group.id}
                          onClick={() => goTo('services', group.id)}
                          className="flex w-full items-center justify-between overflow-hidden rounded-xl text-left transition-colors hover:bg-white/[0.08]"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                        >
                          {catImgUrl && (
                            <div className="h-[60px] w-[60px] shrink-0 overflow-hidden" style={{ borderRadius: '10px 0 0 10px' }}>
                              <img src={catImgUrl} alt={group.name} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 px-3 py-3">
                            <p className="text-[13px] font-semibold text-white">{group.name}</p>
                            <p className="mt-0.5 text-[11px] text-white/45">{tt('public.serviceCount', { n: group.services.length })}</p>
                          </div>
                          <ChevronRight className="mr-3 h-3.5 w-3.5 shrink-0 text-white/35" />
                        </button>
                      )
                    })}
                  </div>
                  {/* Kategória nélküli szolgáltatások — közvetlenül, a saját nevükkel, a
                      kategória-csempék alatt, mesterséges "Egyéb" csoport nélkül. */}
                  {uncategorizedServices.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      {uncategorizedServices.map(s => renderServiceRow(s, () => goTo('serviceDetail', null, String(s.id))))}
                    </div>
                  )}
                </div>
              )}

              {/* SERVICES — service list */}
              {view === 'services' && (categoryGroups.length === 0 || selectedCategoryId !== null) && (
                <div className="pb-2">
                  <h3 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{selectedCategory?.name ?? tl(locale, 'public.services')}</h3>
                  {preStaff && (
                    <p className="mb-4 text-[12px] text-white/45">{preStaff.name} szolgáltatásai</p>
                  )}
                  <div className={cn('space-y-1.5', !preStaff && 'mt-4')}>
                    {servicesInView.map(s => renderServiceRow(s, () => goTo('serviceDetail', selectedCategoryId, String(s.id))))}
                  </div>
                </div>
              )}

              {/* SERVICE DETAIL */}
              {view === 'serviceDetail' && selectedService && (
                <div className="pb-2">
                  {serviceImgUrl && (
                    <div className="mb-4 h-[160px] w-full overflow-hidden rounded-2xl">
                      <img src={serviceImgUrl} alt={selectedService.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h3 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{selectedService.name}</h3>
                  <p className="flex items-center gap-1 text-[12px] text-white/45">
                    <Clock className="h-3 w-3" />{selectedService.duration_minutes} {tt('booking.minutes')} · {priceLabel(selectedService.price, selectedService.currency)}
                  </p>
                  {selectedService.description && (
                    <p className="mt-3 text-[13px] leading-relaxed text-white/60">{selectedService.description}</p>
                  )}
                  {preStaff ? (
                    <button
                      onClick={() => startBooking(preStaffId)}
                      className="mt-5 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all active:scale-[0.98]"
                      style={{ background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
                        {preStaff.avatar && typeof preStaff.avatar === 'object' && (preStaff.avatar as Media).url ? (
                          <img src={(preStaff.avatar as Media).url ?? undefined} alt={preStaff.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center"><User className="h-6 w-6 text-white/40" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/45">Munkatárs</p>
                        <p className="truncate text-[14px] font-semibold text-white">{preStaff.name}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                    </button>
                  ) : serviceStaff.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startBooking(null)}
                        className="relative transition-all active:scale-[0.97]"
                        style={{
                          aspectRatio: '3/4',
                          background: 'rgba(255,255,255,0.08)',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                          clipPath: 'inset(0 round 16px)',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Users className="h-10 w-10 text-white/25" />
                        </div>
                        <div
                          className="absolute inset-x-0 bottom-0 px-2.5 py-2.5 text-left"
                          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                        >
                          <p className="truncate text-[12px] font-semibold leading-tight text-white">{tt('booking.staff.any')}</p>
                          <p className="mt-0.5 truncate text-[10px] text-white/60">{tt('booking.staff.bestSlot')}</p>
                        </div>
                      </button>
                      {serviceStaff.map(m => {
                        const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                        const links = (m.social_links ?? []).map((s) => s.url).filter(Boolean)
                        return (
                          <div
                            key={m.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => startBooking(String(m.id))}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startBooking(String(m.id)) } }}
                            className="relative cursor-pointer transition-all active:scale-[0.97]"
                            style={{
                              aspectRatio: '3/4',
                              background: 'rgba(255,255,255,0.08)',
                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                              clipPath: 'inset(0 round 16px)',
                            }}
                          >
                            {avatarUrl
                              ? <img src={avatarUrl} alt={m.name} className="absolute inset-0 h-full w-full object-cover object-top" />
                              : <div className="absolute inset-0 flex items-center justify-center"><User className="h-10 w-10 text-white/25" /></div>
                            }
                            {links.length > 0 && (
                              <div className="absolute right-1.5 top-1.5 flex gap-1">
                                {links.slice(0, 2).map((url) => {
                                  const platform = detectPlatform(url)
                                  return (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={SOCIAL_LABELS[platform]}
                                      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
                                    >
                                      <img src={socialIconDataUri(platform)} alt="" className="h-3.5 w-3.5 rounded-full" />
                                    </a>
                                  )
                                })}
                              </div>
                            )}
                            <div
                              className="absolute inset-x-0 bottom-0 flex min-h-[52px] flex-col justify-center px-2.5 py-2.5 text-left"
                              style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                            >
                              <p className="truncate text-[12px] font-semibold leading-tight text-white">{m.name}</p>
                              {m.bio && <p className="mt-0.5 truncate text-[10px] text-white/60">{m.bio}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* DATETIME */}
              {view === 'datetime' && bookingService && (
                <div>
                  <h2 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{tt('booking.when.title')}</h2>
                  <p className="mb-4 text-xs text-white/45">
                    {bookingStaffId ? bookingStaff?.name : tt('booking.staff.any')} · {bookingService.name} · {bookingService.duration_minutes} {tt('booking.minutes')}
                  </p>
                  <div data-edit-id="rules" className="mb-3 overflow-hidden rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <DateStrip
                      selected={bookingDate}
                      onChange={d => { setBookingDate(d); setBookingSlot(null) }}
                      dayCount={bookingWindowDays}
                      locale={locale}
                      dark
                    />
                  </div>
                  <div data-edit-id="rules" className={cn('rounded-2xl p-4 pb-6', bookingWindowDays <= 0 && 'hidden')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {format(bookingDateParsed, 'EEEE, MMMM d.', { locale: dfLocale(locale) })}
                    </p>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-white/45">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{tt('booking.loading')}</span>
                      </div>
                    ) : slotsError ? (
                      <div className="py-6 text-center" role="alert">
                        <p className="text-[13px] text-white/55">{tt('booking.err.slots')}</p>
                        <button onClick={loadSlots} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-dark">
                          {tt('booking.retry')}
                        </button>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] text-white/55">{tt('booking.noSlots')}</p>
                        <p className="mt-1 text-xs text-white/35">{tt('booking.noSlotsHint')}</p>
                      </div>
                    ) : (
                      <div
                        key={`${bookingDate}-${slots.length}`}
                        className="grid grid-cols-3 gap-2"
                      >
                        {slots.map((slot, i) => {
                          const sel = bookingSlot?.start === slot.start
                          return (
                            <motion.button
                              key={slot.start}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut', delay: i * 0.035 }}
                              onClick={() => {
                                setBookingSlot(slot)
                                setTimeout(() => { setDir(1); setView('details') }, 260)
                              }}
                              className="rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.96]"
                              style={{
                                background: sel ? 'white' : 'rgba(255,255,255,0.08)',
                                border: `1.5px solid ${sel ? 'white' : 'rgba(255,255,255,0.12)'}`,
                                color: sel ? 'var(--ink-dark)' : 'white',
                                boxShadow: sel ? '0 0 0 3px rgba(255,255,255,0.12)' : undefined,
                              }}
                            >
                              {slot.start}
                            </motion.button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DETAILS */}
              {view === 'details' && (
                <div>
                  <h2 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{tt('booking.details.title')}</h2>
                  {rememberedGuest && (
                    <p className="-mt-2 mb-3 text-[12px] text-white/50">
                      {tt('booking.details.remembered')}{' '}
                      <button type="button" onClick={forgetRememberedGuest} className="font-semibold text-white/80 underline underline-offset-2 hover:text-white">
                        {tt('booking.details.forget')}
                      </button>
                    </p>
                  )}
                  <div className="space-y-2 pb-4">
                    {/* Az űrlap mezői a beállított sorrendben (`booking_rules.form_field_order`, a
                        Foglalóoldal-szerkesztőben húzással állítható). A cím-blokk a céges adatokat is viszi. */}
                    {(() => {
                      const fieldBlocks: Record<FormFieldId, ReactNode> = {
                        name: (
                      <div data-edit-id="field:name" key={`name-${detailsShakeKey}`} className={cn('space-y-1', errors.name && 'animate-shake')}>
                        <Label htmlFor="bk-name" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.name')}</Label>
                        <Input
                          id="bk-name" ref={fieldRefs.name} value={customerName}
                          onChange={e => { setCustomerName(e.target.value); clearError('name') }}
                          onBlur={() => onFieldBlur('name')}
                          autoComplete="name" aria-invalid={!!errors.name}
                          placeholder={tt('booking.field.namePlaceholder')}
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.name && 'ring-1 ring-red-400')}
                        />
                        {errors.name && <p role="alert" className="text-[12px] text-red-400">{errors.name}</p>}
                      </div>
                        ),
                        email: (
                      <div data-edit-id="field:email" key={`email-${detailsShakeKey}`} className={cn('space-y-1', errors.email && 'animate-shake')}>
                        <Label htmlFor="bk-email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.email')}</Label>
                        <Input
                          id="bk-email" ref={fieldRefs.email} type="email" inputMode="email" autoComplete="email" value={customerEmail}
                          onChange={e => { setCustomerEmail(e.target.value); clearError('email') }}
                          onBlur={() => onFieldBlur('email')}
                          aria-invalid={!!errors.email}
                          placeholder={tt('booking.field.emailPlaceholder')}
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.email && 'ring-1 ring-red-400')}
                        />
                        {errors.email && <p role="alert" className="text-[12px] text-red-400">{errors.email}</p>}
                      </div>
                        ),
                        phone: (
                      <div data-edit-id="field:phone" key={`phone-${detailsShakeKey}`} className={cn('space-y-1', errors.phone && 'animate-shake')}>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.phone')}{requirePhone ? ' *' : ''}</Label>
                        <PhoneCountryInput
                          inputRef={fieldRefs.phone} country={customerCountry} phone={customerPhone}
                          onCountryChange={code => setCustomerCountry(code)}
                          onPhoneChange={p => { setCustomerPhone(p); clearError('phone') }}
                          onBlur={() => onFieldBlur('phone')} required={requirePhone}
                          dark
                          inputClass={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] px-3 text-[14px] font-medium text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/50 backdrop-blur-[10px]', errors.phone && 'ring-1 ring-red-400')}
                        />
                        {errors.phone && <p role="alert" className="text-[12px] text-red-400">{errors.phone}</p>}
                      </div>
                        ),
                        address: (
                          <>
                      <div data-edit-id="field:address" key={`city-${detailsShakeKey}`} className={cn('space-y-1', errors.city && 'animate-shake')}>
                        <Label htmlFor="bk-city" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                          {addressGateOn ? `${tt('booking.field.city').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('booking.field.city')}
                        </Label>
                        <Input
                          id="bk-city" ref={fieldRefs.city} value={customerCity}
                          onChange={e => { setCustomerCity(e.target.value); clearError('city') }}
                          onBlur={() => onFieldBlur('city')}
                          aria-invalid={!!errors.city}
                          autoComplete="address-level2" placeholder={tt('booking.field.cityPlaceholder')}
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.city && 'ring-1 ring-red-400')}
                        />
                        {errors.city && <p role="alert" className="text-[12px] text-red-400">{errors.city}</p>}
                        {addressGateOn && !errors.city && <p className="text-[11px] text-white/40">{addressNote}</p>}
                      </div>
                      {!addressCityOnly && (
                      <div data-edit-id="field:address" key={`address-${detailsShakeKey}`} className={cn('space-y-1', errors.address && 'animate-shake')}>
                        <Label htmlFor="bk-address" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                          {addressGateOn ? `${tt('booking.field.address').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('booking.field.address')}
                        </Label>
                        <Input
                          id="bk-address" ref={fieldRefs.address} value={customerAddress}
                          onChange={e => { setCustomerAddress(e.target.value); clearError('address') }}
                          onBlur={() => onFieldBlur('address')}
                          aria-invalid={!!errors.address}
                          autoComplete="street-address" placeholder="Pl. Fő utca 12."
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.address && 'ring-1 ring-red-400')}
                        />
                        {errors.address && <p role="alert" className="text-[12px] text-red-400">{errors.address}</p>}
                        {addressGateOn && !errors.address && <p className="text-[11px] text-white/40">{addressNote}</p>}
                      </div>
                      )}
                      {depositEnabled && invoicingEnabled && (
                        <>
                          <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.06] px-3.5 py-3">
                            <span className="text-[13px] text-white/80">{tt('public.voucher.companyToggle')}</span>
                            <Switch checked={customerIsCompany} onChange={setCustomerIsCompany} ariaLabel={tt('public.voucher.companyToggle')} />
                          </div>
                          {customerIsCompany && (
                            <div key={`taxNumber-${detailsShakeKey}`} className={cn('space-y-1', errors.taxNumber && 'animate-shake')}>
                              <Label htmlFor="bk-taxnumber" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.taxNumber')} *</Label>
                              <Input
                                id="bk-taxnumber" ref={fieldRefs.taxNumber} value={customerTaxNumber}
                                onChange={e => { setCustomerTaxNumber(e.target.value); clearError('taxNumber') }}
                                onBlur={() => onFieldBlur('taxNumber')}
                                aria-invalid={!!errors.taxNumber}
                                placeholder="12345678-1-42"
                                className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', errors.taxNumber && 'ring-1 ring-red-400')}
                              />
                              {errors.taxNumber ? <p role="alert" className="text-[12px] text-red-400">{errors.taxNumber}</p> : <p className="text-[11px] text-white/40">{tt('public.voucher.taxNumberHint')}</p>}
                            </div>
                          )}
                        </>
                      )}
                          </>
                        ),
                        questions: (
                      customQuestionsList.length > 0 && <div data-edit-id="questions" className="space-y-2">{customQuestionsList.map((q) => {
                        const key = q.id ?? ''
                        const val = customAnswers[key] ?? ''
                        const err = customErrors[key]
                        if (q.type === 'yesno') {
                          return (
                            <div key={key} className="flex items-center justify-between gap-4 py-1">
                              <Label className="text-[13px] font-medium text-white/85">{q.label}</Label>
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
                            <div key={`${key}-${detailsShakeKey}`} className={cn('space-y-1', err && 'animate-shake')}>
                              <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{q.label}{q.required ? ' *' : ''}</Label>
                              <select
                                value={val}
                                onChange={(e) => { setCustomAnswers(a => ({ ...a, [key]: e.target.value })); setCustomErrors(er => ({ ...er, [key]: '' })) }}
                                className={cn('h-11 w-full rounded-[12px] border border-white/10 bg-white/[0.06] px-3 text-[14px] font-medium text-white focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', err && 'ring-1 ring-red-400')}
                              >
                                <option value="" className="text-ink">Válassz…</option>
                                {(q.options ?? []).map((o, oi) => o.value ? (
                                  <option key={oi} value={o.value} className="text-ink">{o.value}</option>
                                ) : null)}
                              </select>
                              {err && <p role="alert" className="text-[12px] text-red-400">{err}</p>}
                            </div>
                          )
                        }
                        return (
                          <div key={`${key}-${detailsShakeKey}`} className={cn('space-y-1', err && 'animate-shake')}>
                            <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{q.label}{q.required ? ' *' : ''}</Label>
                            <Input
                              value={val}
                              onChange={(e) => { setCustomAnswers(a => ({ ...a, [key]: e.target.value })); setCustomErrors(er => ({ ...er, [key]: '' })) }}
                              aria-invalid={!!err}
                              className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', err && 'ring-1 ring-red-400')}
                            />
                            {err && <p role="alert" className="text-[12px] text-red-400">{err}</p>}
                          </div>
                        )
                      })}</div>
                        ),
                        notes: (
                      <div data-edit-id="field:notes" className="space-y-1">
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('booking.field.note')}</Label>
                        <Textarea
                          value={customerNotes} onChange={e => setCustomerNotes(e.target.value)}
                          placeholder={tt('booking.field.notePlaceholder')} rows={3}
                          className="rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 resize-none focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                        />
                      </div>
                        ),
                      }
                      // Teljesen elrejtett mező (phone/address/notes) a valódi foglalón nem
                      // renderelődik; a szerkesztő élő előnézetében (editorView) halványan
                      // mégis látszik, ugyanúgy, mint a rejtett szakaszoknál (sectionProps).
                      const fieldHidden = (k: FormFieldId) => (k === 'phone' && !phoneVisible) || (k === 'notes' && !notesVisible) || (k === 'address' && !addressVisible)
                      return formFieldOrder
                        .filter((k) => !!editorView || !fieldHidden(k))
                        .map((k) => (
                          <Fragment key={k}>
                            {editorView && fieldHidden(k) ? <div className="opacity-35 pointer-events-none">{fieldBlocks[k]}</div> : fieldBlocks[k]}
                          </Fragment>
                        ))
                    })()}
                    {voucherEnabled && (
                      <div data-edit-id="redeem" className="space-y-2">
                        {!redeemOpen ? (
                          <button
                            type="button"
                            onClick={() => setRedeemOpen(true)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/45 underline underline-offset-2 transition-colors hover:text-white/70"
                          >
                            <Gift className="h-3 w-3" /> Van ajándékutalványod?
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Utalvány-kód</Label>
                            <Input
                              value={redeemCode}
                              onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemValid(null); setRedeemError(null) }}
                              onBlur={checkRedeemCode}
                              placeholder="XXXX-XXXX"
                              className="h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                            />
                            {redeemChecking && <p className="text-[11px] text-white/40">Ellenőrzés…</p>}
                            {redeemError && <p role="alert" className="text-[12px] text-red-400">{redeemError}</p>}
                            {redeemValid && (
                              <p className="text-[12px] text-emerald-400">Érvényes utalvány — {formatPrice(redeemValid.amount_huf, 'HUF')} jóváírva.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {(marketingVisible || (editorView && newsletterEnabled)) && (
                      <div data-edit-id="newsletter" className={cn('space-y-1.5', editorView && !marketingVisible && 'opacity-35 pointer-events-none')}>
                        <div className="flex items-center justify-between gap-3 py-1">
                          <span className="text-[13px] text-white/70">Szeretnék marketing-ajánlatokat, híreket kapni erről az üzletről</span>
                          <Switch checked={marketingConsent} onChange={setMarketingConsent} ariaLabel="Feliratkozás hírlevélre" />
                        </div>
                        <p className="text-[11px] text-white/40">
                          Bármikor leiratkozhatok. Részletek: <a href="/privacy#marketing" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white/70">Adatvédelmi tájékoztató</a>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DEPOSIT */}
              {view === 'deposit' && depositEnabled && (
                <div>
                  <h2 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{tt('public.deposit.title')}</h2>
                  {/* bookingStaffId lehet null ("Bármelyik szakember") — a deposit-intent route
                      old fel egy konkrét, szabad szakembert, ha nincs megadva. */}
                  {editorView ? (
                    <div data-edit-id="deposit" className="rounded-2xl p-4 text-[13px] leading-relaxed text-white/70" style={{ background: 'rgba(241,206,69,0.10)', border: '1px solid rgba(241,206,69,0.30)' }}>
                      Itt fizeti a vendég kártyával az előleget (Stripe). A szerkesztőben nincs valódi fizetés.
                    </div>
                  ) : selectedServiceId && bookingSlot && (
                    <DepositStep
                      dark
                      locale={locale}
                      requestBody={{ kind: 'salon', salonId, serviceId: selectedServiceId, staffId: bookingStaffId, date: bookingDate, start_time: bookingSlot.start, email: customerEmail || undefined }}
                      onPaid={(pid, amount) => {
                        setPaymentIntentId(pid)
                        setDepositAmountHuf(amount)
                        setDir(1)
                        setView(consentEnabled ? 'consent' : 'summary')
                      }}
                    />
                  )}
                </div>
              )}

              {/* CONSENT — digitális beleegyező nyilatkozat */}
              {view === 'consent' && consentEnabled && (
                <div data-edit-id="consent">
                  <h2 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{consentTitle?.trim() || tt('public.consent.title')}</h2>
                  <div
                    className="mb-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-2xl p-4 text-[13.5px] leading-relaxed text-white/75"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                  >
                    {consentText || 'A szolgáltató még nem adta meg a nyilatkozat szövegét.'}
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-[13px] text-white/70">Elolvastam és elfogadom a fenti nyilatkozatot</span>
                    <Switch checked={consentGiven} onChange={setConsentGiven} ariaLabel="Nyilatkozat elfogadása" />
                  </div>
                </div>
              )}

              {/* SUMMARY */}
              {view === 'summary' && bookingService && bookingSlot && (
                <div>
                  <h2 className="mb-4 text-[22px] font-light tracking-[-0.02em] text-white">{tt('booking.summary.title')}</h2>
                  <div data-edit-id="summary" className="mb-4 rounded-2xl px-4 py-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}>
                    {[
                      { label: tt('booking.step.service'), value: bookingService.name },
                      { label: tt('booking.step.staff'), value: bookingStaffId ? (bookingStaff?.name ?? '–') : tt('booking.staff.any') },
                      { label: tt('booking.step.datetime'), value: `${format(bookingDateParsed, 'MMM d., EEEE', { locale: dfLocale(locale) })} · ${bookingSlot.start}` },
                      { label: tt('booking.field.name'), value: customerName || null },
                      { label: tt('booking.field.email'), value: customerEmail || null },
                      { label: tt('booking.field.phone'), value: customerPhone ? `${DIAL_BY_CODE[customerCountry] ?? ''} ${customerPhone}`.trim() : null },
                      { label: tt('booking.field.city'), value: customerCity || null },
                      { label: tt('booking.field.note'), value: customerNotes || null },
                      { label: tt('booking.price'), value: priceLabel(bookingService.price, bookingService.currency) },
                      ...(paymentIntentId && depositAmountHuf ? [{ label: 'Előleg (fizetve)', value: formatPrice(depositAmountHuf, 'HUF') }] : []),
                      ...(redeemValid && redeemCode.trim() ? [{ label: 'Utalvánnyal fedezve', value: formatPrice(redeemValid.amount_huf, 'HUF') }] : []),
                    ].filter((r): r is { label: string; value: string } => !!r.value).map(({ label, value }, i, arr) => (
                      <div key={label} className={cn('flex items-start justify-between gap-3 py-2.5', i < arr.length - 1 && 'border-b border-white/[0.08]')}>
                        <span className="shrink-0 pt-0.5 text-xs text-white/45">{label.replace(/\s*\*$/, '')}</span>
                        <span className="min-w-0 text-right text-sm font-semibold text-white [overflow-wrap:anywhere]">{value}</span>
                      </div>
                    ))}
                  </div>
                  <GoodToKnowCompact items={goodToKnow} locale={locale} className="mb-3" />
                </div>
              )}

              {/* SUCCESS — közös visszaigazoló képernyő (szalon + étterem). */}
              {view === 'success' && (
                <BookingSuccess
                  locale={locale}
                  confirmed={successDetails?.confirmed !== false}
                  hasEmail={!!successDetails?.hasEmail}
                  confirmEmailEnabled={confirmEmailEnabled}
                  reminderHours={reminderHours}
                  summary={successDetails && (<><span className="font-semibold text-white">{successDetails.service}</span> · {successDetails.staff} · {successDetails.date} {successDetails.time}</>)}
                  icsHref={successDetails?.icsToken ? `/api/ics/booking/${encodeURIComponent(successDetails.icsToken)}` : null}
                  onDone={handleCloseSuccess}
                />
              )}

              {/* VOUCHER — vásárlás */}
              {view === 'voucher' && (
                <div data-edit-id="sec:voucher" className="pb-2">
                  <button onClick={() => goTo('main', null)} className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/45 transition-colors hover:text-white/70">
                    <ArrowLeft className="h-3.5 w-3.5" /> {tt('public.back')}
                  </button>
                  <h2 className="mb-1 text-[22px] font-light tracking-[-0.02em] text-white">{tt('public.voucher')}</h2>
                  <p className="mb-5 text-[12px] text-white/45">{tt('public.voucher.redeemableAt', { salon: salonName })}</p>

                  {!voucherPaymentStep ? (
                    <div className="space-y-4">
                      <div key={`vtype-${voucherShakeKey}`} className={cn('space-y-2 rounded-[16px]', voucherTypeError && 'animate-shake')}>
                        <Label className={cn('text-[11px] font-semibold uppercase tracking-[0.12em]', voucherTypeError ? 'text-red-400' : 'text-white/55')}>{tt('public.voucher.chooseType')} *</Label>
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
                        {voucherTypeError && <p role="alert" className="text-[12px] text-red-400">{tt('public.voucher.chooseTypeError')}</p>}
                      </div>

                      <div key={`name-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.name && 'animate-shake')}>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.yourName')} *</Label>
                        <Input
                          value={voucherPurchaserName} onChange={e => { setVoucherPurchaserName(e.target.value); clearVoucherFieldError('name') }}
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.name && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.name && <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.name}</p>}
                      </div>
                      <div key={`email-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.email && 'animate-shake')}>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.yourEmail')} *</Label>
                        <Input
                          type="email" inputMode="email" value={voucherPurchaserEmail} onChange={e => { setVoucherPurchaserEmail(e.target.value); clearVoucherFieldError('email') }}
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.email && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.email && <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.email}</p>}
                      </div>
                      <div key={`city-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.city && 'animate-shake')}>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.city')} *</Label>
                        <Input
                          value={voucherPurchaserCity} onChange={e => { setVoucherPurchaserCity(e.target.value); clearVoucherFieldError('city') }}
                          autoComplete="address-level2"
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.city && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.city ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.city}</p> : <p className="text-[11px] text-white/40">{tt('public.voucher.cityHint')}</p>}
                      </div>
                      <div key={`address-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.address && 'animate-shake')}>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.address')} *</Label>
                        <Input
                          value={voucherPurchaserAddress} onChange={e => { setVoucherPurchaserAddress(e.target.value); clearVoucherFieldError('address') }}
                          autoComplete="street-address"
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.address && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.address ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.address}</p> : <p className="text-[11px] text-white/40">{tt('public.voucher.addressHint')}</p>}
                      </div>

                      {invoicingEnabled && voucherCompanyEnabled && (
                      <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.06] px-3.5 py-3">
                        <span className="text-[13px] text-white/80">{tt('public.voucher.companyToggle')}</span>
                        <Switch checked={voucherIsCompany} onChange={setVoucherIsCompany} ariaLabel={tt('public.voucher.companyToggle')} />
                      </div>
                      )}
                      {invoicingEnabled && voucherCompanyEnabled && voucherIsCompany && (
                        <div key={`taxNumber-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.taxNumber && 'animate-shake')}>
                          <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.taxNumber')} *</Label>
                          <Input
                            value={voucherPurchaserTaxNumber} onChange={e => { setVoucherPurchaserTaxNumber(e.target.value); clearVoucherFieldError('taxNumber') }}
                            placeholder="12345678-1-42"
                            className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.taxNumber && 'ring-1 ring-red-400')}
                          />
                          {voucherFieldErrors.taxNumber ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.taxNumber}</p> : <p className="text-[11px] text-white/40">{tt('public.voucher.taxNumberHint')}</p>}
                        </div>
                      )}

                      <div className="!mt-6 h-px bg-white/[0.08]" />

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.recipientName')}</Label>
                        <Input
                          value={voucherRecipientName} onChange={e => setVoucherRecipientName(e.target.value)}
                          className="h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]"
                        />
                      </div>
                      <div key={`recipientEmail-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.recipientEmail && 'animate-shake')}>
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.recipientEmail')}</Label>
                        <Input
                          type="email" inputMode="email" value={voucherRecipientEmail} onChange={e => { setVoucherRecipientEmail(e.target.value); clearVoucherFieldError('recipientEmail') }}
                          className={cn('h-11 rounded-[12px] border border-white/10 bg-white/[0.06] text-[14px] font-medium text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-gold/50 focus-visible:border-gold/50 backdrop-blur-[10px]', voucherFieldErrors.recipientEmail && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.recipientEmail ? <p role="alert" className="text-[12px] text-red-400">{voucherFieldErrors.recipientEmail}</p> : <p className="text-[11px] text-white/40">{tt('public.voucher.recipientEmailHint')}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">{tt('public.voucher.message')}</Label>
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
                        {tt('public.voucher.continueToPay')}
                      </button>
                    </div>
                  ) : voucherCreating ? (
                    <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>
                  ) : (
                    <DepositStep
                      dark
                      locale={locale}
                      endpoint="/api/payments/voucher-intent"
                      payLabel={tt('public.voucher.payLabel')}
                      infoText={tt('public.voucher.payInfo')}
                      requestBody={{ kind: 'salon', salonId, voucherTypeId: selectedVoucherTypeId, email: voucherPurchaserEmail || undefined }}
                      onPaid={(pid) => handleVoucherPaid(pid)}
                    />
                  )}
                </div>
              )}

              {/* VOUCHER SUCCESS */}
              {view === 'voucherSuccess' && voucherResult && (
                <div className="flex min-h-[50vh] flex-col items-center justify-center px-1 py-8 text-center">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                    style={{ background: 'rgba(52,211,153,0.15)' }}
                  >
                    <CheckCircle className="h-10 w-10 text-emerald-400" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                  >
                    <h2 className="mb-2 text-2xl font-light tracking-[-0.01em] text-white">{tt('public.voucher.successTitle')}</h2>
                    <p className="mb-6 text-sm text-white/55">{tt('public.voucher.successSubtitle')}</p>
                    <div className="mb-6 rounded-[16px] px-5 py-4" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                      <p className="mb-1 text-xs text-white/45">{tt('public.voucher.code')}</p>
                      <p className="text-xl font-semibold tracking-wide text-gold">{voucherResult.code}</p>
                      <p className="mt-2 text-sm text-white/60">{formatPrice(voucherResult.amountHuf, 'HUF')}</p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={voucherResult.qrCodeDataUrl} alt={tt('public.voucher.qrAlt')} className="mx-auto mb-6 h-40 w-40 rounded-[12px]" />
                    <button
                      onClick={handleCloseVoucherSuccess}
                      className="flex h-12 w-full items-center justify-center rounded-full text-[14px] font-semibold text-ink-dark"
                      style={{ background: '#FFD85F' }}
                    >
                      {tt('public.success.back')}
                    </button>
                  </motion.div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
          </div>{/* /pt-0 */}
        </div>{/* /scroll */}

        {/* Footer */}
        {view === 'success' || view === 'voucher' || view === 'voucherSuccess' ? null : isBookingView ? (
          <div
            className="shrink-0 px-6 pt-2 space-y-2"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* A deposit view-n a DepositStep saját "Fizetés" gombja intézi a tovább-lépést, a közös CTA-t elrejtjük */}
            {view !== 'deposit' && (
              <>
                <button
                  onClick={() => {
                    if (view === 'summary') {
                      submit()
                    } else if (view === 'details') {
                      const order: FieldKey[] = ['name', 'email', ...(phoneVisible ? (['phone'] as FieldKey[]) : []), ...(addressGateOn ? (['city', 'address'] as FieldKey[]) : []), ...(depositEnabled && customerIsCompany ? (['taxNumber'] as FieldKey[]) : [])]
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
                        return
                      }
                      setDir(1)
                      setView(depositEnabled ? 'deposit' : consentEnabled ? 'consent' : 'summary')
                    } else if (view === 'consent') {
                      if (!consentGiven) return
                      setDir(1)
                      setView('summary')
                    }
                  }}
                  disabled={view === 'datetime' || submitting || (view === 'consent' && !consentGiven)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
                  style={{
                    background: view === 'summary' ? '#FFD85F' : (view === 'details' || (view === 'consent' && consentGiven)) ? 'white' : 'rgba(255,255,255,0.10)',
                    color: view === 'summary' ? 'var(--ink-dark)' : (view === 'details' || (view === 'consent' && consentGiven)) ? 'var(--ink-dark)' : 'rgba(255,255,255,0.30)',
                  }}
                >
                  {submitting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : view === 'summary' ? tt('booking.confirm') : tt('booking.next')
                  }
                  {!submitting && (view === 'details' || (view === 'consent' && consentGiven)) && <Check className="h-4 w-4 opacity-70" />}
                </button>
                {view === 'summary' && (
                  <div data-edit-id="terms" className="text-center text-xs text-white/40">
                    {tt('rbooking.termsPrefix')}{' '}
                    <TermsModal sections={termsSections} company={company} locale={locale} />
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="hidden shrink-0 px-6 pb-6 pt-3 lg:block">
            <button
              onClick={() => goTo('services', null)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold text-ink-dark transition-all active:scale-[0.98] hover:opacity-90"
              style={{ background: '#FFD85F' }}
            >
              {tl(locale, 'public.bookCta')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
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
