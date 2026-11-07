'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { loadGuest, saveGuest, forgetGuest } from '@/lib/guestMemory'
import type { GoogleReviewsData } from '@/components/booking/GoogleReviewsBlock'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Users, Gift, HandCoins } from 'lucide-react'
import { Avatar, Button, FIELD, IconButton, IconCircle, Pill } from '@/components/ui-kit'
import { useDayStrip } from './useDayStrip'
import { ACCENT, CardDayPicker, CardPills, CardRow, CardSlotGrid, CardThumb, cardTone, GLASS_FIELD, type LiveCard } from '@/components/blocks/public'
import { PoweredBy } from '@/components/blocks/brand'
import { CookieFooterLink } from '@/components/blocks/consent'
import { openCookieSettings } from '@/components/booking/MarketingTrackingScripts'
import { VoucherCard } from '@/components/blocks/money'
import { salonDepositNotice, type DepositInfo } from '@/lib/depositSummary'
import { depositApplies } from '@/lib/depositCalc'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatPrice, cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_URL } from '@/lib/brand'
import { stepSlide, stepSlideTransition } from '@/lib/motion'
import { trackBookingConversion } from '@/lib/marketingTracking'
import type { Service, StaffMember, ServiceCategory, Media, GiftVoucherType } from '@/payload/payload-types'
import { t as tl, makeT, dfLocale, type Locale } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/toggle-switch'
import { Textarea } from '@/components/ui/textarea'
import { PhoneCountryInput } from '@/components/booking/PhoneInputs'
import { COUNTRIES } from '@/components/booking/phoneCountries'
import { TermsModal, type CompanyInfo } from '@/components/booking/TermsModal'
import type { Section } from '@/components/booking/TermsContent'
import { DepositStep } from '@/components/booking/DepositStep'
import { BookingSuccess } from '@/components/booking/BookingSuccess'
import { GoodToKnowCompact } from '@/components/booking/GoodToKnowSection'

const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map(c => [c.code, c.dial]))

type Slot = { start: string; end: string }
type View = 'services' | 'serviceDetail' | 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' | 'success' | 'voucher' | 'voucherSuccess'
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
  /** szakemberenkénti számlázásnál: akinél van online fizetés (saját Stripe) — „bárki” esetén csak ha mindenkinél van; null: az üzleté */
  depositStaffIds?: string[] | null
  /** előleg-összefoglaló a vendégnek (összeg + díjmentes lemondás) — az Adatok lépés tetején */
  depositInfo?: DepositInfo | null
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
  /** a foglaló kártya stílusa (Beállítások › Foglalóoldal › Arculat) — design 21.2 */
  cardStyle?: LiveCard
  /** a foglalás gomb felirata (saját, vagy az alap) */
  ctaLabel?: string
  /** a szolgáltatások megjelenése (Foglalóoldal › Szolgáltatások): kategória-szűrő, képek, ár · időtartam */
  servicesDisplay?: { filter: boolean; images: boolean; price: boolean }
  /** Szerkesztő-előnézet: automatikus megerősítés (a Visszaigazolás lépés szövegéhez). */
  editorAutoConfirm?: boolean
}

/** Az Adatok lépés átrendezhető mező-blokkjai (alapsorrend). */
// a hírlevél-pipa és (étteremnél) az alkalom-választó is a sorrendezhető elemek közt van (a szerkesztőben húzható)
export const FORM_FIELD_IDS = ['name', 'email', 'phone', 'address', 'questions', 'notes', 'newsletter', 'occasions'] as const
export type FormFieldId = (typeof FORM_FIELD_IDS)[number]

export type EditorView = 'main' | 'start' | 'datetime' | 'details' | 'deposit' | 'consent' | 'summary' | 'success' | 'voucher'

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
  termsSections, company, goodToKnow, depositEnabled: depositOn = false, depositStaffIds = null, depositInfo = null, invoicingEnabled = false, voucherCompanyEnabled = true, google = null,
  addressRequired = false, addressRequiredNote = null, hiddenFields = [], addressDetailLevel = 'full',
  voucherEnabled = false, voucherTypes = [], newsletterEnabled = false, showMarketingConsent = true,
  consentEnabled = false, consentTitle = null, consentText = null,
  customQuestions = null, embed = false, servicesExpandedOnMain = false,
  confirmEmailEnabled = true, reminderHours = [], editorView = null, editorAutoConfirm = true, cardStyle = 'dark', ctaLabel, servicesDisplay = { filter: true, images: true, price: true },
  sectionOrder = null, hiddenSections = null, fieldOrder = null,
}: Props) {
  const formFieldOrder: FormFieldId[] = [
    ...(fieldOrder ?? []).filter((id): id is FormFieldId => (FORM_FIELD_IDS as readonly string[]).includes(id)),
    ...FORM_FIELD_IDS.filter((id) => !(fieldOrder ?? []).includes(id)),
  ]
  const tt = makeT(locale)
  // a kártya stílusa (design 21.2) — sötét üveg / fekete / világos üveg / fehér
  const c = cardTone(cardStyle)
  // a mezők a kártyán: sötét kártyán a design üveg-mezője, fehéren a kit mezője (design 21.7 — CardField)
  const inputCls = c.dark ? `${GLASS_FIELD} placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/20` : `${FIELD} h-11`

  // Browse navigation state
  // design 21.1: a kártya rögtön a foglalás 1. lépésével (szolgáltatások) indul — a régi kezdő nézet tartalma a borítón van
  const [view, setView] = useState<View>('services')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  // Ha a főnézeten előbb egy konkrét munkatársat választ a vendég, ezt tároljuk — a
  // szolgáltatás-listát rá szűrjük, és a serviceDetail nézeten már nem kérdezünk rá újra.
  const [preStaffId, setPreStaffId] = useState<string | null>(null)
  const [dir, setDir] = useState(1)

  // Booking flow state
  const [bookingStaffId, setBookingStaffId] = useState<string | null>(null)
  const [bookingDate, setBookingDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  // a napok sorának első napja (a naptárból választva ide ugrik)
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
  const [voucherResult, setVoucherResult] = useState<{ code: string; amountHuf: number; qrCodeDataUrl: string; expiresAt?: string } | null>(null)

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
  // „Mely foglalásoknál” (16.1): az előleg-lépés csak akkor van, ha a választott szolgáltatás ára és a nap mellett kell
  // előleg — ugyanaz a szabály, mint a szerveren (`depositApplies`). A szerkesztő-előnézetben mindig látszik.
  const depositForStaff = !depositStaffIds || (bookingStaffId ? depositStaffIds.includes(bookingStaffId) : staff.length > 0 && staff.every((m) => depositStaffIds.includes(String(m.id))))
  const depositEnabled = depositOn && (!!editorView || depositForStaff) && (!!editorView || !depositInfo || depositApplies(depositInfo.settings, { date: bookingDate, priceHuf: selectedService && (selectedService.currency ?? 'HUF') === 'HUF' ? selectedService.price : 0 }))

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


  // Szerkesztő-előnézet: a kért lépésre ugrunk, mintaadatokkal (első foglalható szolgáltatás,
  // annak első szakembere, holnap 14:00) — így minden lépés valódi formájában szerkeszthető.
  useEffect(() => {
    if (!editorView) return
    setDir(1)
    if (editorView === 'main') { setView('services'); setSelectedCategoryId(null); setSheetOpen(false); return }
    // a szerkesztő telefon-nézetének második kijelzője: a felcsúszó lap nyitva, az 1. lépéssel (design 16.10)
    if (editorView === 'start') { setView('services'); setSelectedCategoryId(null); setSheetOpen(true); return }
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
    setDir(d ?? 1)
    setSelectedCategoryId(catId)
    setSelectedServiceId(svcId)
    if (newView === 'services' && catId === null && svcId === null && d === -1) setPreStaffId(null)
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
    // az első lépésen: mobilon a lap bezárul (desktopon ott nincs vissza gomb)
    else if (view === 'services') setSheetOpen(false)
    else goTo('services', null, null, -1)
  }

  const handleCloseSuccess = () => {
    setDir(-1)
    setView('services')
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

  // Desktop CTA — BookCtaMorph / nextSlotNode open services view
  useEffect(() => {
    const handler = () => {
      setDir(1)
      setSelectedCategoryId(null)
      setSelectedServiceId(null)
      setView('services')
    }
    window.addEventListener('davelopment:openServices', handler)
    // a borító „Ajándékutalvány” gombja (design 21.1): a kártya az utalvány-vásárlásra vált (mobilon a lap is felnyílik)
    const voucher = () => { setDir(1); setView('voucher'); setSheetOpen(true) }
    window.addEventListener('davelopment:openVoucher', voucher)
    return () => { window.removeEventListener('davelopment:openServices', handler); window.removeEventListener('davelopment:openVoucher', voucher) }
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

  // „Kihez szeretnél menni?”: munkatársanként a legközelebbi szabad időpont (14 napon belül) — a sor jobb oldalán
  const [nextFree, setNextFree] = useState<{ any: { date: string; time: string } | null; staff: Record<string, { date: string; time: string } | null> } | null>(null)
  useEffect(() => {
    if (view !== 'serviceDetail' || !selectedServiceId) return
    setNextFree(null)
    const ids = (selectedService?.staff ?? []).map((m) => String(typeof m === 'object' ? m.id : m)).join(',')
    let off = false
    fetch(`/api/slots/next?${new URLSearchParams({ salonId, serviceId: selectedServiceId, staffIds: ids })}`)
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (!off && j && !j.error) setNextFree(j) }).catch(() => {})
    return () => { off = true }
  }, [view, selectedServiceId]) // eslint-disable-line react-hooks/exhaustive-deps
  const nextLabel = (x: { date: string; time: string } | null | undefined) => {
    if (x === undefined) return null
    if (x === null) return tt('booking.staff.noneSoon')
    const d = new Date(`${x.date}T12:00:00`); const today = format(new Date(), 'yyyy-MM-dd')
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
    return `${x.date === today ? tt('nextSlots.today') : x.date === tomorrow ? tt('nextSlots.tomorrow') : format(d, 'MMM d.', { locale: dfLocale(locale) })} ${x.time}`
  }
  // a választott munkatárs (vagy Bárki) legközelebbi szabad napjára ugrik a napválasztó — ne üres napot lásson a vendég
  const pickStaff = (id: string | null) => {
    const nf = id ? nextFree?.staff[id] : nextFree?.any
    if (nf) setBookingDate(nf.date)
    startBooking(id)
  }

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
      setVoucherResult({ code: json.code, amountHuf: json.amountHuf, qrCodeDataUrl: json.qrCodeDataUrl, expiresAt: json.expiresAt })
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
    setView('services')
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

  // 0 Ft-os szolgáltatásnál nem árat írunk ki, hanem hogy "Ingyenes" — a "0 Ft" hiányzó
  // adatnak/hibának tűnne, holott szándékosan díjmentes szolgáltatásról van szó.
  const priceLabel = (price: number, currency?: string | null) => (price === 0 ? tt('public.free') : formatPrice(price, currency ?? undefined))

  // Egy szolgáltatás-sor közös megjelenítése — a kategória-nélküli szolgáltatások közvetlen
  // listázásánál ÉS a "belül vagyunk egy kategóriában / nincs is kategória" nézetnél is
  // ugyanezt használjuk, hogy a két hely sose csússzon szét.
  // a választott eddig egy sorban, Módosít — a 3. lépéstől (design 21.7)
  const Picked = ({ title, meta, onChange }: { title: string; meta: string; onChange: () => void }) => {
    const av = bookingStaff?.avatar && typeof bookingStaff.avatar === 'object' ? (bookingStaff.avatar as Media).url ?? null : null
    return <CardRow c={c} onClick={onChange} leading={bookingStaff ? <Avatar size="sm" src={av} name={bookingStaff.name} /> : <IconCircle tone={c.dark ? 'onDark' : 'cell'} size="sm" icon={Users} />}
      title={title} meta={meta} trailing={<Pill size="sm" tone={c.dark ? 'white' : 'cell'}>{tt('public.change')}</Pill>} />
  }
  // a napok sora: görgethető, mától a foglalási ablak végéig; ahol a választott szolgáltatásra / munkatársra nincs hely, sötétebb
  const { days: pickDays, stripRef } = useDayStrip({
    daysUrl: view === 'datetime' && selectedServiceId ? `/api/slots/days?${new URLSearchParams({ salonId, serviceId: selectedServiceId, ...(bookingStaffId ? { staffId: bookingStaffId } : {}) })}` : null,
    windowDays: bookingWindowDays, selected: bookingDate, onAutoPick: (d) => { setBookingDate(d); setBookingSlot(null) },
    dfLocale: dfLocale(locale), todayLabel: tt('nextSlots.today'),
  })

  const renderServiceRow = (s: Service, onClick: () => void) => {
    const sImgUrl = servicesDisplay.images && s.image && typeof s.image === 'object' ? (s.image as Media).url ?? null : null
    return (
      <CardRow key={s.id} c={c} onClick={onClick} leading={sImgUrl ? <CardThumb src={sImgUrl} alt={s.name} /> : undefined}
        title={s.name} meta={servicesDisplay.price ? `${s.duration_minutes} ${tt('booking.minutes')}` : undefined}
        trailing={servicesDisplay.price ? <span className="shrink-0 text-ui-body">{priceLabel(s.price, s.currency)}</span> : <ChevronRight className={`h-4 w-4 shrink-0 ${c.meta}`} />} />
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
            {/* design 21.8: a fő gomb a márkaszínben, a saját felirattal — a kit gombja, mint a borítón */}
            <span data-edit-pass className="block">
              <Button onClick={() => setSheetOpen(true)} className={cn('w-full shadow-ui-float', ACCENT)}>
                {ctaLabel ?? tl(locale, 'public.bookCta')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    )}

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
          if (info.offset.y > 120 || info.velocity.y > 500) setSheetOpen(false)
        }}
        // a kártya stílusa (design 21.2): sötét üveg (alap) · fekete · világos üveg · fehér — a `cardTone` adja a felületet
        className={cn('flex flex-col overflow-hidden', c.box, embed ? 'rounded-ui-card' : 'rounded-t-ui-card shadow-ui-popup lg:rounded-ui-card')}
        style={{
          // Embed módban a kártya a TERMÉSZETES tartalom-magasságára nő (nincs korlát) — a ResizeObserver ezt küldi el a
          // beágyazó oldalnak; különben legfeljebb a képernyő magassága, belül görget.
          ...(embed ? { height: 'auto' } : { height: 'min(82dvh, calc(100dvh - 48px))' }),
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
        {view !== 'success' && view !== 'voucher' && view !== 'voucherSuccess' && (() => {
          const stepCount = 4 + (depositEnabled ? 1 : 0) + (consentEnabled ? 1 : 0)
          const stepIndex = view === 'services' || view === 'serviceDetail' ? 0
            : view === 'datetime' ? 1 : view === 'details' ? 2
            : view === 'deposit' ? 3
            : view === 'consent' ? 3 + (depositEnabled ? 1 : 0)
            : stepCount - 1
          return (
            // design 21.7: vissza, pötty-haladás, „2/4” — az első lépésen desktopon nincs hová visszalépni
            <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-5">
              {view === 'services' && !isMobile
                ? <span className="h-9 w-9" />
                : <IconButton icon={ArrowLeft} label={tt('public.back')} size="sm" variant={c.dark ? 'onDark' : 'cell'} onClick={handleBack} />}
              <span className="flex items-center gap-1.5">
                {Array.from({ length: stepCount }).map((_, i) => <span key={i} className={`block h-2 shrink-0 rounded-full transition-all duration-300 ${i === stepIndex ? `w-7 ${c.dark ? 'bg-white' : 'bg-ui-dark'}` : `w-2 ${c.dark ? 'bg-white/30' : 'bg-ui-dark/20'}`}`} />)}
              </span>
              <span className={`text-ui-meta tabular-nums ${c.meta}`}>{stepIndex + 1}/{stepCount}</span>
            </div>
          )
        })()}

        {/* Scrollable content — header + tartalom együtt scrollozik */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6" data-lenis-prevent style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="pb-4 pt-2"><div className="mt-4 h-px bg-white/[0.08]" /></div>
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

              {/* 1. lépés — Mit szeretnél? (design 21.1): kategória-pillek (szűrő, nem lépés) és a szolgáltatások képpel,
                  időtartammal, árral — a megjelenésük a Foglalóoldal › Szolgáltatások beállítása szerint */}
              {view === 'services' && (
                <div data-edit-id="sec:services" className="pb-2">
                  <div className="text-ui-title font-light">{tt('public.whatWouldYouLike')}</div>
                  {preStaff && <div className={`mt-1 text-ui-meta ${c.meta}`}>{tt('public.staffServices', { name: preStaff.name })}</div>}
                  {servicesDisplay.filter && categoryGroups.length > 0 && (
                    <CardPills c={c} className="mt-3" options={[tt('public.all'), ...categoryGroups.map((g) => g.name)]}
                      active={selectedCategoryId === null ? 0 : categoryGroups.findIndex((g) => g.id === selectedCategoryId) + 1}
                      onSelect={(i) => setSelectedCategoryId(i === 0 ? null : categoryGroups[i - 1].id)} />
                  )}
                  <div className="mt-3 space-y-1">
                    {(servicesDisplay.filter ? servicesInView : visibleServices).map((s) => renderServiceRow(s, () => goTo('serviceDetail', selectedCategoryId, String(s.id))))}
                  </div>
                </div>
              )}

              {/* 2. lépés — Kihez szeretnél menni? (design 21.7): „Bárki” (a legkorábbi szabad időponttal) vagy aki ezt végzi —
                  fotóval, szerepkörrel / bemutatkozással és a közösségi linkjeivel. A választás rögtön az időpontra visz. */}
              {view === 'serviceDetail' && selectedService && (
                <div className="pb-2">
                  <div className="text-ui-title font-light">{tt('booking.whoTitle')}</div>
                  <div className={`mt-1 text-ui-meta ${c.meta}`}>{selectedService.name} · {selectedService.duration_minutes} {tt('booking.minutes')} · {priceLabel(selectedService.price, selectedService.currency)}</div>
                  {selectedService.description && <p className={`mt-2 text-ui-meta leading-relaxed ${c.meta}`}>{selectedService.description}</p>}
                  <div className="mt-3 space-y-1">
                    {!preStaff && serviceStaff.length > 1 && (
                      <CardRow c={c} onClick={() => pickStaff(null)} leading={<IconCircle tone={c.dark ? 'onDark' : 'cell'} size="md" icon={Users} />}
                        title={tt('booking.staff.any')} meta={tt('booking.staff.bestSlot')} trailing={nextFree && <span className={`shrink-0 text-ui-meta ${nextFree.any ? '' : c.meta}`}>{nextLabel(nextFree.any)}</span>} />
                    )}
                    {(preStaff ? [preStaff] : serviceStaff).map((m) => {
                      const avatarUrl = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
                      const about = (m as { role_title?: string | null }).role_title?.trim() || m.bio?.trim() || null
                      const nf = nextFree?.staff[String(m.id)]
                      return (
                        <div key={m.id} data-edit-id={`staff:${m.id}`}>
                          <CardRow c={c} onClick={() => pickStaff(String(m.id))} leading={<Avatar size="md" src={avatarUrl} name={m.name} />}
                            title={m.name} meta={about ?? undefined}
                            trailing={nextFree ? <span className={`shrink-0 text-ui-meta ${nf ? '' : c.meta}`}>{nextLabel(nf ?? null)}</span> : <ChevronRight className={`h-4 w-4 shrink-0 ${c.meta}`} />} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 3. lépés — Mikor legyen? (design 21.7): fent a választott (Módosít), a napok (a naptár-gombbal a távolabbiak)
                  és a szabad időpontok — a választott a márkaszínben; választás után rögtön az Adatok jön */}
              {view === 'datetime' && bookingService && (
                <div>
                  <Picked title={`${bookingService.name} · ${bookingStaffId ? bookingStaff?.name ?? '' : tt('booking.staff.any')}`}
                    meta={`${bookingService.duration_minutes} ${tt('booking.minutes')} · ${priceLabel(bookingService.price, bookingService.currency)}`}
                    onChange={() => { setDir(-1); setView('serviceDetail') }} />
                  <div className="mt-5 text-ui-title font-light">{tt('booking.when.title')}</div>
                  {bookingWindowDays <= 0 ? (
                    <p className={`mt-2 text-ui-meta ${c.meta}`}>{tt('dateStrip.closed')}</p>
                  ) : (
                    <>
                      <div data-edit-id="rules" ref={stripRef}>
                        <CardDayPicker c={c} className="mt-2" days={pickDays} onPick={(k) => { setBookingDate(k); setBookingSlot(null) }} />
                      </div>
                      <div className={`mt-3 text-ui-label ${c.meta}`}>{format(bookingDateParsed, 'EEEE, MMMM d.', { locale: dfLocale(locale) })}</div>
                      {loadingSlots ? (
                        <div className={`flex items-center justify-center gap-2 py-6 ${c.meta}`}><Loader2 className="h-4 w-4 animate-spin" /><span className="text-ui-meta">{tt('booking.loading')}</span></div>
                      ) : slotsError ? (
                        <div className="py-6 text-center" role="alert">
                          <p className={`text-ui-meta ${c.meta}`}>{tt('booking.err.slots')}</p>
                          <Button size="sm" variant={c.dark ? 'onDark' : 'cell'} className="mt-3" onClick={loadSlots}>{tt('booking.retry')}</Button>
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className={`text-ui-meta ${c.meta}`}>{tt('booking.noSlots')}</p>
                          <p className={`mt-1 text-ui-label ${c.meta}`}>{tt('booking.noSlotsHint')}</p>
                        </div>
                      ) : (
                        <CardSlotGrid c={c} className="mt-2" slots={slots.map((x) => x.start)} on={bookingSlot?.start}
                          onPick={(t) => { const slot = slots.find((x) => x.start === t); if (!slot) return; setBookingSlot(slot); setTimeout(() => { setDir(1); setView('details') }, 260) }} />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* DETAILS */}
              {view === 'details' && (
                <div>
                  <h2 className="mb-4 text-ui-title font-light">{tt('booking.details.title')}</h2>
                  {/* Előleg-tájékoztató MÁR az adatoknál — a vendég előre tudja, mennyi, mikor és visszajár-e */}
                  {depositEnabled && depositInfo && (
                    <div data-edit-id="deposit" className={`mb-4 flex gap-3 rounded-ui-inner p-4 ${c.row}`}>
                      <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-ui-yellow" strokeWidth={1.7} />
                      <div className="text-ui-meta leading-relaxed opacity-80">
                        <p className="font-semibold">{(() => { const n = salonDepositNotice(depositInfo, selectedService && (selectedService.currency ?? 'HUF') === 'HUF' ? selectedService.price : null); return tt(n.key, n.params) })()}</p>
                        <p>{tt('public.deposit.noticeHow')} {depositInfo.refundHours > 0 ? tt('public.deposit.noticeRefund', { hours: depositInfo.refundHours }) : tt('public.deposit.noticeRefundAny')}</p>
                      </div>
                    </div>
                  )}
                  {rememberedGuest && (
                    <p className={`-mt-2 mb-3 text-ui-label ${c.meta}`}>
                      {tt('booking.details.remembered')}{' '}
                      <button type="button" onClick={forgetRememberedGuest} className="font-semibold opacity-80 underline underline-offset-2">
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
                        <Label htmlFor="bk-name" className={`text-ui-label ${c.meta}`}>{tt('booking.field.name')}</Label>
                        <Input
                          id="bk-name" ref={fieldRefs.name} value={customerName}
                          onChange={e => { setCustomerName(e.target.value); clearError('name') }}
                          onBlur={() => onFieldBlur('name')}
                          autoComplete="name" aria-invalid={!!errors.name}
                          placeholder={tt('booking.field.namePlaceholder')}
                          className={cn(inputCls, errors.name && 'ring-1 ring-red-400')}
                        />
                        {errors.name && <p role="alert" className="text-ui-label text-red-400">{errors.name}</p>}
                      </div>
                        ),
                        email: (
                      <div data-edit-id="field:email" key={`email-${detailsShakeKey}`} className={cn('space-y-1', errors.email && 'animate-shake')}>
                        <Label htmlFor="bk-email" className={`text-ui-label ${c.meta}`}>{tt('booking.field.email')}</Label>
                        <Input
                          id="bk-email" ref={fieldRefs.email} type="email" inputMode="email" autoComplete="email" value={customerEmail}
                          onChange={e => { setCustomerEmail(e.target.value); clearError('email') }}
                          onBlur={() => onFieldBlur('email')}
                          aria-invalid={!!errors.email}
                          placeholder={tt('booking.field.emailPlaceholder')}
                          className={cn(inputCls, errors.email && 'ring-1 ring-red-400')}
                        />
                        {errors.email && <p role="alert" className="text-ui-label text-red-400">{errors.email}</p>}
                      </div>
                        ),
                        phone: (
                      <div data-edit-id="field:phone" key={`phone-${detailsShakeKey}`} className={cn('space-y-1', errors.phone && 'animate-shake')}>
                        <Label className={`text-ui-label ${c.meta}`}>{tt('booking.field.phone')}{requirePhone ? ' *' : ''}</Label>
                        <PhoneCountryInput
                          inputRef={fieldRefs.phone} country={customerCountry} phone={customerPhone}
                          onCountryChange={code => setCustomerCountry(code)}
                          onPhoneChange={p => { setCustomerPhone(p); clearError('phone') }}
                          onBlur={() => onFieldBlur('phone')} required={requirePhone}
                          dark
                          inputClass={cn(inputCls, errors.phone && 'ring-1 ring-red-400')}
                        />
                        {errors.phone && <p role="alert" className="text-ui-label text-red-400">{errors.phone}</p>}
                      </div>
                        ),
                        address: (
                          <>
                      {/* Előlegnél a cím a SZÁMLÁHOZ kell — ezt egyszer, fejlécként mondjuk el (nem mezőnként) */}
                      {depositEnabled && (
                        <div className="pt-2">
                          <p className="text-ui-label font-semibold uppercase tracking-[0.12em] opacity-80">{tt('booking.details.billing')}</p>
                          <p className={`text-ui-label ${c.meta}`}>{tt('booking.details.billingWhy')}</p>
                        </div>
                      )}
                      <div data-edit-id="field:address" key={`city-${detailsShakeKey}`} className={cn('space-y-1', errors.city && 'animate-shake')}>
                        <Label htmlFor="bk-city" className={`text-ui-label ${c.meta}`}>
                          {addressGateOn ? `${tt('booking.field.city').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('booking.field.city')}
                        </Label>
                        <Input
                          id="bk-city" ref={fieldRefs.city} value={customerCity}
                          onChange={e => { setCustomerCity(e.target.value); clearError('city') }}
                          onBlur={() => onFieldBlur('city')}
                          aria-invalid={!!errors.city}
                          autoComplete="address-level2" placeholder={tt('booking.field.cityPlaceholder')}
                          className={cn(inputCls, errors.city && 'ring-1 ring-red-400')}
                        />
                        {errors.city && <p role="alert" className="text-ui-label text-red-400">{errors.city}</p>}
                        {addressGateOn && !depositEnabled && !errors.city && <p className={`text-ui-label ${c.meta}`}>{addressNote}</p>}
                      </div>
                      {!addressCityOnly && (
                      <div data-edit-id="field:address" key={`address-${detailsShakeKey}`} className={cn('space-y-1', errors.address && 'animate-shake')}>
                        <Label htmlFor="bk-address" className={`text-ui-label ${c.meta}`}>
                          {addressGateOn ? `${tt('booking.field.address').replace(/\s*\([^)]*\)\s*$/, '')} *` : tt('booking.field.address')}
                        </Label>
                        <Input
                          id="bk-address" ref={fieldRefs.address} value={customerAddress}
                          onChange={e => { setCustomerAddress(e.target.value); clearError('address') }}
                          onBlur={() => onFieldBlur('address')}
                          aria-invalid={!!errors.address}
                          autoComplete="street-address" placeholder="Pl. Fő utca 12."
                          className={cn(inputCls, errors.address && 'ring-1 ring-red-400')}
                        />
                        {errors.address && <p role="alert" className="text-ui-label text-red-400">{errors.address}</p>}
                        {addressGateOn && !depositEnabled && !errors.address && <p className={`text-ui-label ${c.meta}`}>{addressNote}</p>}
                      </div>
                      )}
                      {depositEnabled && invoicingEnabled && (
                        <>
                          <div className={`flex items-center justify-between gap-3 px-3.5 py-3 ${c.row}`}>
                            <span className="text-ui-meta opacity-80">{tt('public.voucher.companyToggle')}</span>
                            <Switch checked={customerIsCompany} onChange={setCustomerIsCompany} ariaLabel={tt('public.voucher.companyToggle')} />
                          </div>
                          {customerIsCompany && (
                            <div key={`taxNumber-${detailsShakeKey}`} className={cn('space-y-1', errors.taxNumber && 'animate-shake')}>
                              <Label htmlFor="bk-taxnumber" className={`text-ui-label ${c.meta}`}>{tt('public.voucher.taxNumber')} *</Label>
                              <Input
                                id="bk-taxnumber" ref={fieldRefs.taxNumber} value={customerTaxNumber}
                                onChange={e => { setCustomerTaxNumber(e.target.value); clearError('taxNumber') }}
                                onBlur={() => onFieldBlur('taxNumber')}
                                aria-invalid={!!errors.taxNumber}
                                placeholder="12345678-1-42"
                                className={cn(inputCls, errors.taxNumber && 'ring-1 ring-red-400')}
                              />
                              {errors.taxNumber ? <p role="alert" className="text-ui-label text-red-400">{errors.taxNumber}</p> : <p className={`text-ui-label ${c.meta}`}>{tt('public.voucher.taxNumberHint')}</p>}
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
                              <Label className="text-ui-meta font-medium opacity-80">{q.label}</Label>
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
                              <Label className={`text-ui-label ${c.meta}`}>{q.label}{q.required ? ' *' : ''}</Label>
                              <select
                                value={val}
                                onChange={(e) => { setCustomAnswers(a => ({ ...a, [key]: e.target.value })); setCustomErrors(er => ({ ...er, [key]: '' })) }}
                                className={cn(inputCls, 'w-full', err && 'ring-1 ring-red-400')}
                              >
                                <option value="" className="text-ui-text">Válassz…</option>
                                {(q.options ?? []).map((o, oi) => o.value ? (
                                  <option key={oi} value={o.value} className="text-ui-text">{o.value}</option>
                                ) : null)}
                              </select>
                              {err && <p role="alert" className="text-ui-label text-red-400">{err}</p>}
                            </div>
                          )
                        }
                        return (
                          <div key={`${key}-${detailsShakeKey}`} className={cn('space-y-1', err && 'animate-shake')}>
                            <Label className={`text-ui-label ${c.meta}`}>{q.label}{q.required ? ' *' : ''}</Label>
                            <Input
                              value={val}
                              onChange={(e) => { setCustomAnswers(a => ({ ...a, [key]: e.target.value })); setCustomErrors(er => ({ ...er, [key]: '' })) }}
                              aria-invalid={!!err}
                              className={cn(inputCls, err && 'ring-1 ring-red-400')}
                            />
                            {err && <p role="alert" className="text-ui-label text-red-400">{err}</p>}
                          </div>
                        )
                      })}</div>
                        ),
                        notes: (
                      <div data-edit-id="field:notes" className="space-y-1">
                        <Label className={`text-ui-label ${c.meta}`}>{tt('booking.field.note')}</Label>
                        <Textarea
                          value={customerNotes} onChange={e => setCustomerNotes(e.target.value)}
                          placeholder={tt('booking.field.notePlaceholder')} rows={3}
                          className={`${inputCls} h-auto min-h-[88px] resize-none py-3`}
                        />
                      </div>
                        ),
                        newsletter: (marketingVisible || (editorView && newsletterEnabled)) ? (
                      <div data-edit-id="newsletter" className={cn('space-y-1.5', editorView && !marketingVisible && 'opacity-35 pointer-events-none')}>
                        <div className="flex items-center justify-between gap-3 py-1">
                          <span className="text-ui-meta opacity-80">Szeretnék marketing-ajánlatokat, híreket kapni erről az üzletről</span>
                          <Switch checked={marketingConsent} onChange={setMarketingConsent} ariaLabel="Feliratkozás hírlevélre" />
                        </div>
                        <p className={`text-ui-label ${c.meta}`}>
                          Bármikor leiratkozhatok. Részletek: <a href="/privacy#marketing" target="_blank" rel="noreferrer" className="underline underline-offset-2">Adatvédelmi tájékoztató</a>.
                        </p>
                      </div>
                        ) : null,
                        occasions: null,
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
                            className={`inline-flex items-center gap-1.5 text-ui-label font-medium underline underline-offset-2 transition-colors ${c.meta}`}
                          >
                            <Gift className="h-3 w-3" /> Van ajándékutalványod?
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <Label className={`text-ui-label ${c.meta}`}>Utalvány-kód</Label>
                            <Input
                              value={redeemCode}
                              onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemValid(null); setRedeemError(null) }}
                              onBlur={checkRedeemCode}
                              placeholder="XXXX-XXXX"
                              className={inputCls}
                            />
                            {redeemChecking && <p className={`text-ui-label ${c.meta}`}>Ellenőrzés…</p>}
                            {redeemError && <p role="alert" className="text-ui-label text-red-400">{redeemError}</p>}
                            {redeemValid && (
                              <p className="text-ui-label text-emerald-400">Érvényes utalvány — {formatPrice(redeemValid.amount_huf, 'HUF')} jóváírva.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DEPOSIT */}
              {view === 'deposit' && depositEnabled && (
                <div>
                  <h2 className="mb-4 text-ui-title font-light">{tt('public.deposit.title')}</h2>
                  {/* bookingStaffId lehet null ("Bármelyik szakember") — a deposit-intent route
                      old fel egy konkrét, szabad szakembert, ha nincs megadva. */}
                  {editorView ? (
                    <div data-edit-id="deposit" className={`rounded-ui-inner p-4 text-ui-meta leading-relaxed opacity-80 ${c.row}`}>
                      Itt fizeti a vendég kártyával az előleget (Stripe). A szerkesztőben nincs valódi fizetés.
                    </div>
                  ) : selectedServiceId && bookingSlot && (
                    <DepositStep
                      dark
                      locale={locale}
                      requestBody={{ kind: 'salon', salonId, serviceId: selectedServiceId, staffId: bookingStaffId, date: bookingDate, start_time: bookingSlot.start, email: customerEmail || undefined }}
                      onPaid={(pid, amount, sid) => {
                        // „bárki” szakembernél a szerver feloldotta — a foglalás ugyanerre menjen (a pénz az övé lehet)
                        if (!bookingStaffId && sid) setBookingStaffId(sid)
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
                  <h2 className="mb-4 text-ui-title font-light">{consentTitle?.trim() || tt('public.consent.title')}</h2>
                  <div
                    className={`mb-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-ui-inner p-4 text-ui-meta leading-relaxed opacity-80 ${c.row}`}
                    
                  >
                    {consentText || 'A szolgáltató még nem adta meg a nyilatkozat szövegét.'}
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1">
                    <span className="text-ui-meta opacity-80">Elolvastam és elfogadom a fenti nyilatkozatot</span>
                    <Switch checked={consentGiven} onChange={setConsentGiven} ariaLabel="Nyilatkozat elfogadása" />
                  </div>
                </div>
              )}

              {/* SUMMARY */}
              {view === 'summary' && bookingService && bookingSlot && (
                <div>
                  <h2 className="mb-4 text-ui-title font-light">{tt('booking.summary.title')}</h2>
                  <div data-edit-id="summary" className={`mb-4 rounded-ui-inner px-4 py-1 ${c.row}`} >
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
                        <span className={`shrink-0 pt-0.5 text-ui-label ${c.meta}`}>{label.replace(/\s*\*$/, '')}</span>
                        <span className="min-w-0 text-right text-ui-meta font-semibold [overflow-wrap:anywhere]">{value}</span>
                      </div>
                    ))}
                  </div>
                  <GoodToKnowCompact items={goodToKnow} locale={locale} className="mb-3" />
                </div>
              )}

              {/* SUCCESS — közös visszaigazoló képernyő (szalon + étterem). */}
              {view === 'success' && (
                <BookingSuccess card={cardStyle}
                  locale={locale}
                  confirmed={successDetails?.confirmed !== false}
                  hasEmail={!!successDetails?.hasEmail}
                  confirmEmailEnabled={confirmEmailEnabled}
                  reminderHours={reminderHours}
                  summary={successDetails && (<><span className="font-semibold">{successDetails.service}</span> · {successDetails.staff} · {successDetails.date} {successDetails.time}</>)}
                  icsHref={successDetails?.icsToken ? `/api/ics/booking/${encodeURIComponent(successDetails.icsToken)}` : null}
                  onDone={handleCloseSuccess}
                />
              )}

              {/* VOUCHER — vásárlás */}
              {view === 'voucher' && (
                <div data-edit-id="sec:voucher" className="pb-2">
                  <button onClick={() => goTo('services', null, null, -1)} className={`mb-4 inline-flex items-center gap-1.5 text-ui-label font-medium transition-colors ${c.meta}`}>
                    <ArrowLeft className="h-3.5 w-3.5" /> {tt('public.back')}
                  </button>
                  <h2 className="mb-1 text-ui-title font-light">{tt('public.voucher')}</h2>
                  <p className={`mb-5 text-ui-label ${c.meta}`}>{tt('public.voucher.redeemableAt', { salon: salonName })}</p>

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
                        {voucherTypeError && <p role="alert" className="text-ui-label text-red-400">{tt('public.voucher.chooseTypeError')}</p>}
                      </div>

                      <div key={`name-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.name && 'animate-shake')}>
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.yourName')} *</Label>
                        <Input
                          value={voucherPurchaserName} onChange={e => { setVoucherPurchaserName(e.target.value); clearVoucherFieldError('name') }}
                          className={cn(inputCls, voucherFieldErrors.name && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.name && <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.name}</p>}
                      </div>
                      <div key={`email-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.email && 'animate-shake')}>
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.yourEmail')} *</Label>
                        <Input
                          type="email" inputMode="email" value={voucherPurchaserEmail} onChange={e => { setVoucherPurchaserEmail(e.target.value); clearVoucherFieldError('email') }}
                          className={cn(inputCls, voucherFieldErrors.email && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.email && <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.email}</p>}
                      </div>
                      <div key={`city-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.city && 'animate-shake')}>
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.city')} *</Label>
                        <Input
                          value={voucherPurchaserCity} onChange={e => { setVoucherPurchaserCity(e.target.value); clearVoucherFieldError('city') }}
                          autoComplete="address-level2"
                          className={cn(inputCls, voucherFieldErrors.city && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.city ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.city}</p> : <p className={`text-ui-label ${c.meta}`}>{tt('public.voucher.cityHint')}</p>}
                      </div>
                      <div key={`address-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.address && 'animate-shake')}>
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.address')} *</Label>
                        <Input
                          value={voucherPurchaserAddress} onChange={e => { setVoucherPurchaserAddress(e.target.value); clearVoucherFieldError('address') }}
                          autoComplete="street-address"
                          className={cn(inputCls, voucherFieldErrors.address && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.address ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.address}</p> : <p className={`text-ui-label ${c.meta}`}>{tt('public.voucher.addressHint')}</p>}
                      </div>

                      {invoicingEnabled && voucherCompanyEnabled && (
                      <div className={`flex items-center justify-between gap-3 px-3.5 py-3 ${c.row}`}>
                        <span className="text-ui-meta opacity-80">{tt('public.voucher.companyToggle')}</span>
                        <Switch checked={voucherIsCompany} onChange={setVoucherIsCompany} ariaLabel={tt('public.voucher.companyToggle')} />
                      </div>
                      )}
                      {invoicingEnabled && voucherCompanyEnabled && voucherIsCompany && (
                        <div key={`taxNumber-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.taxNumber && 'animate-shake')}>
                          <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.taxNumber')} *</Label>
                          <Input
                            value={voucherPurchaserTaxNumber} onChange={e => { setVoucherPurchaserTaxNumber(e.target.value); clearVoucherFieldError('taxNumber') }}
                            placeholder="12345678-1-42"
                            className={cn(inputCls, voucherFieldErrors.taxNumber && 'ring-1 ring-red-400')}
                          />
                          {voucherFieldErrors.taxNumber ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.taxNumber}</p> : <p className={`text-ui-label ${c.meta}`}>{tt('public.voucher.taxNumberHint')}</p>}
                        </div>
                      )}

                      <div className="!mt-6 h-px bg-white/[0.08]" />

                      <div className="space-y-1">
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.recipientName')}</Label>
                        <Input
                          value={voucherRecipientName} onChange={e => setVoucherRecipientName(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div key={`recipientEmail-${voucherShakeKey}`} className={cn('space-y-1', voucherFieldErrors.recipientEmail && 'animate-shake')}>
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.recipientEmail')}</Label>
                        <Input
                          type="email" inputMode="email" value={voucherRecipientEmail} onChange={e => { setVoucherRecipientEmail(e.target.value); clearVoucherFieldError('recipientEmail') }}
                          className={cn(inputCls, voucherFieldErrors.recipientEmail && 'ring-1 ring-red-400')}
                        />
                        {voucherFieldErrors.recipientEmail ? <p role="alert" className="text-ui-label text-red-400">{voucherFieldErrors.recipientEmail}</p> : <p className={`text-ui-label ${c.meta}`}>{tt('public.voucher.recipientEmailHint')}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className={`text-ui-label ${c.meta}`}>{tt('public.voucher.message')}</Label>
                        <Textarea
                          value={voucherMessage} onChange={e => setVoucherMessage(e.target.value)} rows={3}
                          className={`${inputCls} h-auto min-h-[88px] resize-none py-3`}
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
                    <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
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

              {/* VOUCHER SUCCESS — Kész (design 21.9): pipa a márkaszínben, az utalvány képe (előlap a kóddal, hátlap a QR-ral) */}
              {view === 'voucherSuccess' && voucherResult && (
                <div className="flex flex-col items-center py-4 text-center">
                  <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
                    <IconCircle size="lg" icon={Check} className={ACCENT} />
                  </motion.div>
                  <motion.div className="w-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
                    <div className="mt-4 text-ui-sub font-light">{tt('public.voucher.successTitle')}</div>
                    <p className={`mt-1 text-ui-meta ${c.meta}`}>{tt('public.voucher.successSubtitle')}</p>
                    <div className="mt-5 space-y-2 text-left">
                      <VoucherCard amount={formatPrice(voucherResult.amountHuf, 'HUF')} code={voucherResult.code} bg="yellow" biz={{ name: salonName, logo: null }} expires={voucherResult.expiresAt ? format(new Date(voucherResult.expiresAt), 'PPP', { locale: dfLocale(locale) }) : ''} />
                      <VoucherCard side="back" code={voucherResult.code} qr={voucherResult.qrCodeDataUrl} bg="dark" biz={{ name: salonName, logo: null }} />
                    </div>
                    <Button variant={c.dark ? 'onDark' : 'cell'} className="mt-4 w-full" onClick={handleCloseVoucherSuccess}>{tt('public.success.back')}</Button>
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
            className="shrink-0 space-y-2 px-6 pb-3 pt-2"
          >
            {/* A deposit view-n a DepositStep saját "Fizetés" gombja intézi a tovább-lépést, a közös CTA-t elrejtjük */}
            {view !== 'deposit' && (
              <>
                <Button
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
                  // design: a fő gomb a márkaszínben, a kit méretében (mint a borítón); amíg nem lehet tovább, halvány
                  className={cn('w-full', ACCENT)}
                >
                  {submitting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : view === 'summary' ? tt('booking.confirm') : tt('booking.next')
                  }
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>
                {view === 'summary' && (
                  <div data-edit-id="terms" className={`text-center text-ui-label ${c.meta}`}>
                    {tt('rbooking.termsPrefix')}{' '}
                    <TermsModal sections={termsSections} company={company} locale={locale} />
                    {company?.privacy_url && <>. {tt('rbooking.privacyPrefix')}{' '}<a href={company.privacy_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{tt('rbooking.privacyLink')}</a></>}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
        {/* a kártya alján mindig a rendszer jele (design 21.1) — beágyazva linkként (ingyen marketing a beágyazó oldalról) */}
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1"><PoweredBy dark={c.dark} />{!embed && <CookieFooterLink dark={c.dark} onClick={openCookieSettings} />}{company?.privacy_url && <a href={company.privacy_url} target="_blank" rel="noopener noreferrer" className={`text-ui-label ${c.dark ? 'text-white/55' : 'text-ui-muted'} underline-offset-2 outline-none hover:underline`}>{tt('public.footer.privacy')}</a>}</div>
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
