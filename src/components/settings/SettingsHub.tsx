'use client'

/**
 * BEÁLLÍTÁSOK bal-sávos HUB — KÖZÖS komponens a szalon és étterem modulhoz (variant).
 * Referencia: docs/design_handoff_davelopment/Schedulio Csomag.dc.html
 *   – Üzlet profil: 396–438 · Foglalási szabályok: 452–486
 *   – Értesítések: 499–522 · Számlázás: 592–610
 *
 * A rail szekciói: Üzlet profil / Foglalási szabályok / Nyitvatartás / Értesítések /
 * Csapat & jogok / Integrációk / Számlázás. A „Nyitvatartás" a meglévő availability
 * oldalra LINKEL (nem panel). Az „Üzlet profil" a MEGLÉVŐ settings-formot rendeli
 * (minden funkció megőrizve: mentés, ?locale=, feltöltés, veszélyzóna). A többi panel
 * a referencia-tördelést hozza; valós adathoz kötve ahol van mező, különben UI-state
 * (kommentelt TODO backend-bekötésre).
 */

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE, DUR, sheetSpring } from '@/lib/motion'
import { toast } from 'sonner'
import { SettingsFormContext, type SettingsFormApi } from './settingsFormContext'
import {
  Home, CalendarDays, Clock, Bell, Users, LayoutGrid, CreditCard, Download, Sparkles,
  Plus, ScrollText, Building2, Mail, Check, Languages, FileText, Star,
  Trash2, X, Loader2, Pencil, ArrowRight, ChevronDown, SlidersHorizontal, UserRound, Upload, Wallet, Lock, PanelsTopLeft, Send, Gift, Receipt, type LucideIcon,
} from 'lucide-react'
import { BookingFeatures, type FeatureModules } from '@/components/onboarding/BookingFeatures'
import { IntegrationsPanel } from './IntegrationsPanel'
import { GoogleSettingsPanel } from './GoogleSettingsPanel'
import { Toggle } from './SettingsToggle'
import { PaymentsSettingsPanel, type DepositSettingsData, type InvoiceSettingsData, type VoucherSettingsData, type ConsentSettingsData } from './PaymentsSettingsPanel'
import { PushSubscribeToggle } from '@/components/dashboard/PushSubscribeToggle'
import { PwaInstallCard } from '@/components/dashboard/PwaInstallCard'
import { PersonalNotifPrefsCard, useNotifPrefs } from './PersonalNotifPrefsCard'
import { BillingPortalButton } from '@/components/dashboard/BillingPortalButton'
import { PricingCards } from '@/components/dashboard/PricingCards'
import { StripeCheckoutButton } from '@/components/dashboard/StripeCheckoutButton'
import { CancelSubscriptionButton } from '@/components/dashboard/CancelSubscriptionButton'
import type { AccountBilling } from '@/lib/accountBilling'
import type { Pricing } from '@/lib/pricing'
import { can, type Capability } from '@/lib/permissions'
import { BookingPageEditor, type BookingPageEditorInitial } from '@/components/settings/booking-page/BookingPageEditor'

/* ── VALÓS beállítás-groupok (payload group-mezők, PATCH-elve a collection-endpointon) ── */
// Értesítések = tranzakciós emailek. Az emlékeztető/visszajelzés a Funkciók gazdája.
export type NotificationPrefs = {
  confirm_email: boolean
  cancel_email: boolean
  modification_email: boolean
  digest_morning_email: boolean
  digest_evening_email: boolean
}
// Foglalási szabályok = CSAK a valós, hatással bíró kapcsoló (auto_confirm). A deposit/no-show
// „Hamarosan", a várólista a Funkciók gazdája — ezért nincsenek itt.
export type BookingRulesToggles = {
  auto_confirm: boolean
  require_address: boolean
  require_address_note: string
}

/* ── Fehér kártya — a Nyitvatartás/Foglalások kártya-mintája (bordered, dav árnyék) ── */
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[26px] dav-card-glass p-6 ${className}`}>
      {children}
    </div>
  )
}

/* ── Előfizetés-státusz badge ────────────────────────────────────────────── */
function StatusBadge({ status }: { status: BillingData['subscriptionStatus'] }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    trialing:  { label: 'Próbaidőszak',   cls: 'bg-warn-bg text-warn' },
    active:    { label: 'Aktív',          cls: 'bg-ok-bg text-ok' },
    past_due:  { label: 'Lejárt fizetés', cls: 'bg-bad-bg text-bad' },
    canceled:  { label: 'Lemondva',       cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' },
    paused:    { label: 'Szüneteltetve',  cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' },
  }
  const { label, cls } = (status && cfg[status]) ?? { label: '—', cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' }
  return <span className={`inline-block rounded-[8px] px-2.5 py-[3px] text-[11px] font-semibold ${cls}`}>{label}</span>
}


type RailId =
  | 'site' | 'newsletter' | 'vouchers' | 'invoicing' | 'profile' | 'booking' | 'languages' | 'email'
  | 'notifications' | 'team' | 'audit'
  | 'self' | 'documents' | 'billing' | 'sites'
  | 'integrations' | 'danger' | 'payments' | 'google'

// A bal lista mely elemei a MEGLÉVŐ profil-form egy-egy fülét mutatják (rail vezérli a fület).
const FORM_TABS: Record<string, string> = {
  profile: 'general', booking: 'booking', languages: 'languages',
  email: 'email', documents: 'documents', danger: 'danger',
  // 'import' removed — import moved to Integrations panel
}

// A kiválasztott szekció neve = a tartalom címe (mivel nincs felső fül-sor, ez jelzi „hol vagy").
const RAIL_LABELS: Record<RailId, string> = {
  site: 'Foglalóoldal', newsletter: 'Hírlevél', vouchers: 'Ajándékutalvány', invoicing: 'Számlázás',
  profile: 'Üzlet profil', booking: 'Foglalás', languages: 'Nyelvek', email: 'Vendég e-mailek',
  notifications: 'Értesítések', team: 'Csapat & jogok', audit: 'Audit-napló',
  self: 'Saját profil', documents: 'Dokumentumok & jogi', billing: 'Előfizetés & számlázás', sites: 'Telephelyek',
  integrations: 'API & Integrációk', danger: 'Fiók törlése',
  payments: 'Fizetés', google: 'Google',
}

export interface RulesData {
  slotDurationMin: number | null   // idősáv hossza (turn_duration / vendéglátás)
  bufferMin: number | null         // buffer / puffer
  maxParty: number | null          // max létszám / foglalás (— ha nincs mező)
  leadTimeHours: number | null     // legkorábbi (— ha nincs)
  windowDays: number | null        // legkésőbbi (előre foglalható napok)
}

export interface BillingData {
  planLabel: string
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | null
  billingCycle: 'monthly' | 'annual'
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  nextChargeDate: string | null
  nextChargeAmount: string
  hasStripeCustomer: boolean
  /** Számlázási adatok — szerkeszthető a Számlázás panelben */
  legalName: string
  taxNumber: string
  companyRegNumber: string
  billingEmail: string
  billingPostalCode: string
  billingCity: string
  billingStreet: string
  /** Számlázz.hu kiállított számlák (legújabb elől) */
  invoices: Array<{ id: string; invoice_number: string; invoice_url?: string | null; amount_huf?: number | null; issued_at?: string | null; test?: boolean | null }>
  lastInvoiceNumber: string | null
  lastInvoiceUrl: string | null
}

/** Csapat & jogok — egy tag. VALÓS adatból (tulajdonos + membershipök). */
export interface TeamMember {
  id?: string                      // membership id (a tulaj-sornak nincs → nem kezelhető)
  name: string
  email: string
  role: string                     // szerep-felirat (Tulajdonos / Menedzser / egyedi szerep neve)
  roleTone: 'owner' | 'manager' | 'staff'
  customRoleId?: string | null     // ha egyedi szerepe van, annak id-je (a legördülő értékéhez)
  pending?: boolean                // függő meghívó sor
  suspended?: boolean              // felfüggesztett tag (a Munkatársak „Inaktív"-jával egységes)
  avatarUrl?: string | null        // a tag SAJÁT (fiók-szintű) profilképe, ha van
  /** Munkaköri pozíció (pl. "Stylist"). Tagoknál a Membership.position, a tulajnál a linkelt
   *  Staff-rekord role_title-je (ha a tulaj saját magát is felvette szakembernek). */
  position?: string | null
}

/** Telephelyek — VALÓS: a fiók egy üzlete. */
export interface SiteData {
  id: string
  type: 'salon' | 'restaurant'
  initials: string
  name: string
  meta: string                     // „Budapest, V. · Király u. 8. · Étterem Pro"
  role: string                     // szerep (Tulajdonos)
  current?: boolean                // ez az aktuálisan megnyitott üzlet
  gold?: boolean                   // avatar arany háttér (nem-aktuális kiemeléshez)
  logoUrl?: string | null          // az üzlet logója, ha van (a `getActiveBusiness` már betölti)
}

/** Egy mező-változás a naplóban (módosításnál): mi → mire. */
export interface AuditFieldChange {
  field: string
  from: string | number | boolean | null
  to: string | number | boolean | null
}

/** Audit-napló — egy VALÓS bejegyzés (az AuditLog collectionből, üzletre szűrve). */
export interface AuditEntry {
  id: string
  actor: string                    // végrehajtó neve (vagy „Online foglalás" / „Rendszer")
  actorEmail?: string              // végrehajtó email címe (bejelentkezett usernél)
  action: 'create' | 'update' | 'delete'
  summary: string                  // olvasható összegzés, pl. „Foglalás módosítva — Nagy Péter"
  collection: string               // érintett collection-felirat
  changes?: AuditFieldChange[]     // módosításnál a változott mezők (before→after)
  createdAt: string                // ISO időbélyeg
}

export interface SettingsHubProps {
  variant: 'salon' | 'restaurant'
  subtitle: string                 // fejléc alcím, pl. „Belvárosi Bisztró · Étterem Pro"
  availabilityHref: string
  /** VALÓS mentés végpont: `/api/salons/${id}` vagy `/api/restaurants/${id}`. */
  apiBase: string
  /** Értesítési preferenciák kezdőértéke (a betöltött üzlet `notification_prefs`-e). */
  notificationPrefs: NotificationPrefs
  /** Foglalási-szabály kapcsolók kezdőértéke (a betöltött üzlet `booking_rules`-a). */
  bookingRules: BookingRulesToggles
  /** Foglalási funkciók (`feature_modules`) kezdőérték — a beágyazott BookingFeatures panelnek. */
  featureModules: FeatureModules
  profilePanel: ReactNode          // a MEGLÉVŐ settings-form (Üzlet profil)
  /** Beállítások → Foglalóoldal élő szerkesztő kezdőadatai (csak szalonnál). Ha meg van adva,
   *  az ÚJ menüszerkezet él (Üzlet / Vendégek / Pénzügy / Kapcsolatok / Csapat / Fiók). */
  bookingPageEditor?: BookingPageEditorInitial
  /** `notify_new_bookings` — az új menüben az Értesítések fülön állítható. */
  notifyNewBookings?: boolean
  selfProfile?: ReactNode          // „Saját profil" — a bejelentkezett user szerkesztője (ProfileEditor)
  rules: RulesData
  senderLabel: string              // Értesítések: jelenlegi feladó
  billing: BillingData
  /** Csapat & jogok — VALÓS tulajdonos (+ UI-state meghívók). */
  team: TeamMember[]
  /** Telephelyek — VALÓS fiók-üzletek. */
  sites: SiteData[]
  businessCount: number
  planLabel: string                // Telephelyek fejléc / összesített csomag-felirat
  /** Audit-napló — VALÓS legutóbbi bejegyzések (üzletre szűrve, ~30). */
  auditLog: AuditEntry[]
  /** iCal feed URL (előre generált, token-nel). */
  icalUrl: string
  /** Nyilvános foglalási URL. */
  bookingUrl: string
  /** Beágyazható (`?embed=1`) publikus foglaló URL — az iframe-snippethez. */
  embedUrl: string
  /** Kész `<div>` + `<script src=".../embed.js">` snippet — automatikus magasság-igazítással. */
  embedSmartSnippet: string
  /** Zapier/Make webhook URL (tárolt érték). */
  webhookUrl?: string | null
  /** Marketing-követés (GA4/Facebook Pixel) tárolt azonosítói. */
  ga4Id?: string | null
  facebookPixelId?: string | null
  /** Egyedi szerepek panel (2. fázis) — a Csapat tab alján renderelődik. */
  rolesSection?: ReactNode
  /** Egyedi szerepek (id + név) — a meghívó/tag-szerep legördülőhöz. */
  customRoles?: { id: string; name: string }[]
  /** Fiók-szintű számlázás összesítő — üzlet-bontás, ciklus, kedvezmény. */
  billingAccount: AccountBilling
  /** Globális árazási beállítások — a PricingCards-nak. */
  pricing: Pricing
  /** Az aktív üzlet id-je (string) — a PricingCards csomag-választásához. */
  activeBusinessId: string
  /** A fiók indulásának dátuma (ISO) — megjelenítéshez. */
  startedAt?: string | null
  /** Felhasználó effektív képességei — a `billing` + `danger` nav-elem elrejtéséhez. */
  myCapabilities?: Capability[]
  /** Vendég-előleg (Stripe Connect) + számlázási beállítások kezdőértéke — a Fizetések panelnek. */
  depositSettings: DepositSettingsData
  invoiceSettings: InvoiceSettingsData
  voucherSettings: VoucherSettingsData
  consentSettings: ConsentSettingsData
  stripeConnectAccountId: string | null
  stripeConnectOnboarded: boolean
  /** Az üzlet jelenlegi csomagja (starter/pro/egyedi) — a hírlevél beépített email-keretének kijelzéséhez. */
  businessTier: string | null
  /** Az üzlet által támogatott nyelvek — a beleegyező nyilatkozat fordítás-szerkesztőjéhez. */
  supportedLocales?: (string | null | undefined)[] | null
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
}
const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

// Magyar adószám: XXXXXXXX-X-XX (8-1-2 számjegy)
function maskTaxNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 8) return d
  if (d.length <= 9) return `${d.slice(0, 8)}-${d.slice(8)}`
  return `${d.slice(0, 8)}-${d.slice(8, 9)}-${d.slice(9)}`
}
// Magyar cégjegyzékszám: XX-XX-XXXXXX (2-2-6 számjegy)
function maskCompanyReg(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`
}

/** A `PaymentsSettingsPanel`/`IntegrationsPanel`/`BookingFeatures` közös felfelé-jelentő
 *  szerződéséhez (`onDirtyChange`/`registerApi`) egy kis wrapper — minden Beállítások-panel
 *  ugyanígy jelenti a mentetlen-állapotát és regisztrálja a mentés/elvetés műveletét a hub
 *  közös lebegő sávjának, mint ahogy a beágyazott profil-form is teszi (`SettingsFormApi`). */
function usePanelRegistration() {
  const [dirty, setDirty] = useState(false)
  const apiRef = useRef<{ save: () => Promise<boolean>; discard: () => void } | null>(null)
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), [])
  const registerApi = useCallback((api: { save: () => Promise<boolean>; discard: () => void }) => { apiRef.current = api }, [])
  return { dirty, apiRef, onDirtyChange, registerApi }
}

export function SettingsHub({
  variant, subtitle, availabilityHref, profilePanel, selfProfile, rules, senderLabel, billing,
  team, sites, businessCount, planLabel, apiBase, notificationPrefs, bookingRules,
  featureModules, auditLog, rolesSection, customRoles = [],
  billingAccount, pricing, activeBusinessId, startedAt,
  icalUrl, bookingUrl, embedUrl, embedSmartSnippet, webhookUrl, ga4Id, facebookPixelId, myCapabilities,
  depositSettings, invoiceSettings, voucherSettings, consentSettings, stripeConnectAccountId, stripeConnectOnboarded,
  businessTier,
  supportedLocales,
  bookingPageEditor,
  notifyNewBookings = true,
}: SettingsHubProps) {
  // Új menüszerkezet (szalon): a régi Üzlet profil / Foglalás / Nyelvek fülek tartalma a
  // Foglalóoldal-szerkesztőbe költözött, a vendég-e-mailek és a pénzügy saját menüpontokat kaptak.
  const newLayout = !!bookingPageEditor
  const MOVED_TO_SITE = new Set(['profile', 'booking', 'languages'])
  const router = useRouter()
  // Mély-link: a ?tab=… query kezdő-fület állít (pl. az avatar-popover / áttekintés a „self"-re nyit).
  // Jogosulatlan tab (pl. ?tab=billing manager-nek) → visszaesik profile-ra.
  const searchParams = useSearchParams()
  const initialTab = ((): RailId => {
    const t = searchParams.get('tab')
    const limitedOnly = !!myCapabilities && !can(myCapabilities, 'settings.profile')
    // `settings.own_profile` users alapértelmezett tabja 'self', nem 'profile'.
    if (!t || !(t in RAIL_LABELS)) return limitedOnly ? 'self' : newLayout ? 'site' : 'profile'
    // Régi mély-linkek (onboarding, súgó, SetupNudge) → a tartalmuk most a Foglalóoldalon van.
    if (newLayout && MOVED_TO_SITE.has(t) && !limitedOnly) return 'site'
    if (t === 'billing' && myCapabilities && !can(myCapabilities, 'billing.manage')) return limitedOnly ? 'self' : 'profile'
    if (t === 'danger' && myCapabilities && !can(myCapabilities, 'danger')) return limitedOnly ? 'self' : 'profile'
    // Jogosulatlan tab URL-ből → visszaesik self-re.
    if (limitedOnly && t !== 'self') return 'self'
    // Lejárt/megszűnt/szüneteltetett előfizetésnél egy mély-linkelt (?tab=...) tiltott fül is
    // a billingre esik vissza — a nav-lakatok csak a KATTINTÁST védik, ez a közvetlen URL-t.
    const lockedNow = billing.subscriptionStatus === 'past_due' || billing.subscriptionStatus === 'canceled' || billing.subscriptionStatus === 'paused'
    if (lockedNow && t !== 'billing' && t !== 'danger') return 'billing'
    return t as RailId
  })()
  const [active, setActive] = useState<RailId>(initialTab)
  const [saving, setSaving] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])
  // A top nav SlidersHorizontal ikonja ezt az eventet dispatch-eli.
  useEffect(() => {
    const handler = () => setMobileNavOpen(true)
    window.addEventListener('davelopment:open-settings-nav', handler)
    return () => window.removeEventListener('davelopment:open-settings-nav', handler)
  }, [])
  // Bottom sheet megnyílásakor az aktív elem látható legyen (az animáció után görgeti oda).
  useEffect(() => {
    if (!mobileNavOpen) return
    const t = setTimeout(() => {
      document.getElementById('settings-nav-active-item')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 180)
    return () => clearTimeout(t)
  }, [mobileNavOpen])

  useEffect(() => {
    if (searchParams.get('checkout') !== 'success') return
    setActive('billing')
    // A DB-frissítés rendesen a Stripe-webhookon menne — ez a fallback azonnal (a redirect
    // pillanatában) is szinkronizál, hogy a webhook lokális hiánya/késése esetén se maradjon
    // "Próbaidőszak" kiírva egy ténylegesen sikeres fizetés után.
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      toast.success('Fizetés sikeres — előfizetés aktiválva!')
      return
    }
    fetch('/api/stripe/checkout/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data: { paid?: boolean }) => {
        if (data.paid) {
          toast.success('Fizetés sikeres — előfizetés aktiválva!')
          router.refresh()
        } else {
          toast.error('A fizetés nem sikerült — próbáld újra, vagy válassz másik kártyát.')
        }
      })
      .catch(() => toast.success('Fizetés sikeres — előfizetés aktiválva!'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mobil szekció-választó legördülő

  // ── Számlázási adatok helyi form (Számlázás panel) — PATCH az apiBase-re.
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>(billing.billingCycle)

  const [billDetails, setBillDetails] = useState({
    legalName: billing.legalName,
    taxNumber: billing.taxNumber,
    companyRegNumber: billing.companyRegNumber,
    billingEmail: billing.billingEmail,
    billingPostalCode: billing.billingPostalCode,
    billingCity: billing.billingCity,
    billingStreet: billing.billingStreet,
  })
  const [billDirty, setBillDirty] = useState(false)
  const [billSaving, setBillSaving] = useState(false)
  type BillKey = keyof typeof billDetails
  const BILL_REQUIRED: BillKey[] = ['legalName', 'billingEmail', 'billingPostalCode', 'billingCity', 'billingStreet']
  const [billTouched, setBillTouched] = useState<Partial<Record<BillKey, boolean>>>({})
  const touchBillField = (k: BillKey) => setBillTouched((p) => ({ ...p, [k]: true }))
  const markAllBillTouched = () =>
    setBillTouched(Object.fromEntries(BILL_REQUIRED.map((k) => [k, true])) as Record<BillKey, boolean>)
  const billError = (k: BillKey): string | null =>
    billTouched[k] && !billDetails[k]?.trim() ? 'Kötelező mező' : null
  const billFieldsComplete = BILL_REQUIRED.every((k) => !!billDetails[k]?.trim())
  const activeBizForPricing = useMemo(() => {
    const item = billingAccount.items.find((i) => i.id === activeBusinessId)
    if (!item) return null
    return { type: item.type as 'salon' | 'restaurant', id: item.id, tier: item.tier, staffCount: item.staffCount }
  }, [billingAccount.items, activeBusinessId])

  const setBillField = (k: keyof typeof billDetails, v: string) => {
    setBillDetails((prev) => ({ ...prev, [k]: v }))
    setBillDirty(true)
  }
  const saveBillDetails = async () => {
    setBillSaving(true)
    try {
      const res = await fetch('/api/billing/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: variant,
          id: activeBusinessId,
          legal_name: billDetails.legalName,
          tax_number: billDetails.taxNumber,
          company_reg_number: billDetails.companyRegNumber,
          billing_email: billDetails.billingEmail,
          billing_postal_code: billDetails.billingPostalCode,
          billing_city: billDetails.billingCity,
          billing_street: billDetails.billingStreet,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      toast.success('Számlázási adatok mentve')
      setBillDirty(false)
    } catch {
      toast.error('Mentés sikertelen — próbáld újra')
    } finally {
      setBillSaving(false)
    }
  }

  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const t = setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 80)
      return () => clearTimeout(t)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [active])

  // ── A beágyazott profil-form FELFELÉ jelzi az aktív fül mentetlen-állapotát + regisztrálja
  //    a mentés/elvetés műveletét → a hub egyetlen KÖZÖS lebegő sávból menti (nincs form-alji SaveBar).
  const [formDirty, setFormDirty] = useState(false)
  const [formSaved, setFormSaved] = useState(false)
  const formApiRef = useRef<SettingsFormApi | null>(null)
  const reportDirty = useCallback((d: boolean) => setFormDirty(d), [])
  const registerApi = useCallback((api: SettingsFormApi) => { formApiRef.current = api }, [])

  // ── Ugyanez a felfelé-jelentő minta a Foglalás fülbe ágyazott Foglalási funkciók, a
  //    Fizetés fülön/Dokumentumok & jogin belüli PaymentsSettingsPanel-példányok, és az API &
  //    Integrációk fülön lévő két panel (IntegrationsPanel + PaymentsSettingsPanel) számára —
  //    minden mentés a közös lebegő sávból történik, nincs többé kártyánkénti saját gomb.
  const featuresPanel = usePanelRegistration()
  const paymentsTabPanel = usePanelRegistration()
  const documentsPanel = usePanelRegistration()
  const integPanel = usePanelRegistration()
  const integPaymentsPanel = usePanelRegistration()
  const googlePanel = usePanelRegistration()
  const sitePanel = usePanelRegistration()
  const newsletterPanel = usePanelRegistration()
  const vouchersPanel = usePanelRegistration()
  const invoicingPanel = usePanelRegistration()

  /** Egy group PATCH-elése a valós collection-endpointra (credentials:'include'). */
  const patchGroup = async (body: Record<string, unknown>): Promise<boolean> => {
    setSaving(true)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      return true
    } catch {
      toast.error('Hiba történt')
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Foglalási szabályok — CSAK a valós, hatással bíró szabály: `auto_confirm`. A `deposit`/
  //    `cancellation_protection` fizetési integrációt igényel (őszinte „Hamarosan"), a `waitlist`
  //    gazdája a Funkciók oldal (`feature_modules.waitlist_on`) — ezért itt nem duplázzuk.
  const [ruleToggles, setRuleToggles] = useState({
    autoConfirm: bookingRules.auto_confirm,
    requireAddress: bookingRules.require_address,
    requireAddressNote: bookingRules.require_address_note,
  })
  const rulesBaseline = useMemo(() => ({
    autoConfirm: bookingRules.auto_confirm,
    requireAddress: bookingRules.require_address,
    requireAddressNote: bookingRules.require_address_note,
  }), [bookingRules])
  const rulesDirty = JSON.stringify(ruleToggles) !== JSON.stringify(rulesBaseline)
  const [rulesSaved, setRulesSaved] = useState(false)
  const saveRules = async () => {
    const ok = await patchGroup({
      booking_rules: {
        auto_confirm: ruleToggles.autoConfirm,
        require_address: ruleToggles.requireAddress,
        require_address_note: ruleToggles.requireAddressNote.trim() || null,
      },
    })
    if (ok) setRulesSaved(true)
  }
  // Lásd a Google fülnél lentebb lévő megjegyzést — ugyanaz a "ne villanjon vissza
  // Mentetlenre" minta: a "Mentve" jelzést csak azután rejtjük el, hogy a `router.refresh()`
  // tényleg landolt és a `dirty` valóban hamisra váltott.
  useEffect(() => {
    if (rulesSaved && !rulesDirty) {
      const t = setTimeout(() => setRulesSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [rulesSaved, rulesDirty])
  const resetRules = () => setRuleToggles(rulesBaseline)

  // ── Belső (nem-vendég) email-preferenciák — a bejelentkezett user SAJÁT
  //    `personal_notif_prefs.bookings_email`/`schedule_email`-je (owner VAGY staff nézetben is).
  //    Külön a lenti `notif`-tól, ami az ÜZLET vendég-emailjeit (notification_prefs) kezeli.
  const internalEmailPrefs = useNotifPrefs()

  // ── Értesítések — tranzakciós emailek + digest. Az emlékeztető és a visszajelzés-kérés
  //    a Funkciók oldal gazdája (`feature_modules`). VALÓS `notification_prefs` group.
  const [notif, setNotif] = useState({
    confirm: { email: notificationPrefs.confirm_email },
    cancel: { email: notificationPrefs.cancel_email },
    modification: { email: notificationPrefs.modification_email },
    digest_morning: { email: notificationPrefs.digest_morning_email },
    digest_evening: { email: notificationPrefs.digest_evening_email },
  })
  const notifBaseline = useMemo(() => ({
    confirm: { email: notificationPrefs.confirm_email },
    cancel: { email: notificationPrefs.cancel_email },
    modification: { email: notificationPrefs.modification_email },
    digest_morning: { email: notificationPrefs.digest_morning_email },
    digest_evening: { email: notificationPrefs.digest_evening_email },
  }), [notificationPrefs])
  // `notify_new_bookings` — az új menüben az Értesítések fül gazdája (a régi Foglalás fülről jött).
  const [newBookingsNotif, setNewBookingsNotif] = useState(notifyNewBookings)
  const notifDirty = JSON.stringify(notif) !== JSON.stringify(notifBaseline) || newBookingsNotif !== notifyNewBookings
  const [notifSaved, setNotifSaved] = useState(false)
  const saveNotif = async () => {
    const ok = await patchGroup({
      ...(newBookingsNotif !== notifyNewBookings ? { notify_new_bookings: newBookingsNotif } : {}),
      notification_prefs: {
        confirm_email: notif.confirm.email,
        cancel_email: notif.cancel.email,
        modification_email: notif.modification.email,
        digest_morning_email: notif.digest_morning.email,
        digest_evening_email: notif.digest_evening.email,
      },
    })
    if (ok) setNotifSaved(true)
  }
  useEffect(() => {
    if (notifSaved && !notifDirty) {
      const t = setTimeout(() => setNotifSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [notifSaved, notifDirty])
  const resetNotif = () => { setNotif(notifBaseline); setNewBookingsNotif(notifyNewBookings) }

  // A reggeli + esti digest email egyszerre kapcsolódik (1 toggle vezérli mindkettőt).
  const digestEmailOn = notif.digest_morning.email && notif.digest_evening.email
  function toggleDigestEmail() {
    const v = !digestEmailOn
    setNotif((s) => ({ ...s, digest_morning: { email: v }, digest_evening: { email: v } }))
  }

  type NotifKey = keyof typeof notif
  // Sorok a vendég-emailekhez (mind a kettő modulban ugyanaz).
  const notifRows: { key: NotifKey; title: string; sub: string }[] = [
    { key: 'confirm', title: 'Foglalás visszaigazolás', sub: 'A vendégnek · foglaláskor azonnal, .ics naptárfájllal' },
    { key: 'cancel', title: 'Lemondás visszaigazolás', sub: 'A vendégnek · foglalás törlése után' },
    { key: 'modification', title: 'Módosítás értesítő', sub: 'A vendégnek · ha dátum, idő vagy szakember változik' },
  ]

  // ── Audit-napló szűrő — kliens-oldali szűrés a VALÓS bejegyzéseken (akció-típus + dátum-ablak).
  // A szerver a visszatekintési ablakon (90 nap) belüli sorokat adja; itt tovább szűkíthető.
  const [auditFilter, setAuditFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all')
  const [auditDays, setAuditDays] = useState<7 | 30 | 90>(90)
  const [auditShown, setAuditShown] = useState(25)
  const filteredAudit = useMemo(() => {
    const cutoff = Date.now() - auditDays * 86_400_000
    return auditLog.filter(
      (e) =>
        (auditFilter === 'all' || e.action === auditFilter) &&
        new Date(e.createdAt).getTime() >= cutoff,
    )
  }, [auditFilter, auditDays, auditLog])
  const visibleAudit = filteredAudit.slice(0, auditShown)

  // ── Csapat & jogok — VALÓS bekötés a /api/team végpontokra.
  // RolesManager custom event-tel jelzi ha változott a lista → azonnal frissül a meghívó dropdown.
  const [liveRoles, setLiveRoles] = useState<{ id: string; name: string }[]>(customRoles)
  useEffect(() => {
    const handler = (e: Event) => {
      const roles = (e as CustomEvent<{ id: string; name: string }[]>).detail
      setLiveRoles(roles)
      setInviteRole((prev) => (roles.length && !prev ? `c:${roles[0].id}` : prev))
    }
    window.addEventListener('davelopment:roles-changed', handler)
    return () => window.removeEventListener('davelopment:roles-changed', handler)
  }, [])

  const [inviteOpen, setInviteOpen] = useState(false)
  // Csapat fül al-navigáció — tag-kezelés és szerepkör-szerkesztés két külön koncepció,
  // eddig sub-navigáció nélkül egymás alatt zsúfolva egy fülön.
  const [teamSubTab, setTeamSubTab] = useState<'members' | 'roles'>('members')
  const [inviteEmail, setInviteEmail] = useState('')
  // Érték: `c:<roleId>` (a megadott egyedi szerepek közül). Nincs hardcoded szerep.
  const [inviteRole, setInviteRole] = useState<string>(customRoles[0] ? `c:${customRoles[0].id}` : '')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  const sendInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    // Szerep NÉLKÜL is elküldhető — a tag ilyenkor csak az alap `overview.view`-t kapja,
    // utólag bármikor adható neki szerep. Korábban ez a gomb véglegesen le volt tiltva, ha az
    // üzletnek még egyetlen egyedi szerepe sem volt (nem volt visszaesés beépített szerepre).
    setInviteBusy(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, ...(inviteRole.startsWith('c:') ? { custom_role: inviteRole.slice(2) } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Hiba')
      toast.success('Meghívó elküldve')
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole(liveRoles[0] ? `c:${liveRoles[0].id}` : '')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setInviteBusy(false)
    }
  }

  const changeRole = async (id: string, value: string) => {
    setRowBusy(id)
    try {
      const res = await fetch(`/api/team/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(value.startsWith('c:') ? { custom_role: value.slice(2) } : { role: value }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setRowBusy(null)
    }
  }

  const removeMember = async (id: string) => {
    setRowBusy(id)
    try {
      const res = await fetch(`/api/team/members/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      toast.success('Tag eltávolítva')
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setRowBusy(null)
    }
  }

  // Státusz-váltás a lenyíló menüből — a Munkatárs-adatlap (HiringView) státusz-menüjével AZONOS.
  // A route a membership.status-t állítja ÉS a párosított staff.is_active-ot is szinkronizálja.
  const setMemberStatus = async (id: string, status: 'active' | 'suspended') => {
    setStatusMenuId(null)
    setRowBusy(id)
    try {
      const res = await fetch(`/api/team/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      toast.error('A státusz módosítása sikertelen')
    } finally {
      setRowBusy(null)
    }
  }

  // A KÖZÖS lebegő mentés-sáv az AKTÍV panelhez kötődik: beágyazott profil-form fül (felfelé
  // jelentett állapot) / Értesítések / a Foglalás fülbe összevont auto-megerősítés szabály.
  // Egyetlen mentés-hely az egész oldalra.
  const saveForm = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await formApiRef.current?.save()
      if (ok) { router.refresh(); setFormSaved(true) }
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // A „Foglalás" fül a profil-form saját booking-fülét, az auto-megerősítés szabályt ÉS a
  // Foglalási funkciókat (BookingFeatures) is mutatja — a mentés-sáv mindhármat lefedi.
  const saveBookingTab = useCallback(async () => {
    setSaving(true)
    try {
      if (rulesDirty) await saveRules()
      if (featuresPanel.dirty) await featuresPanel.apiRef.current?.save()
      const ok = await formApiRef.current?.save()
      if (ok) { router.refresh(); setFormSaved(true) }
    } finally {
      setSaving(false)
    }
    // FONTOS: a `saveRules` NEM ref-en keresztül olvassa a `ruleToggles`-t (a többi mentés-
    // függvénnyel ellentétben, amik csak `.current`-et hívnak) — ha `saveRules` hiányzik a
    // dependency-ből, ez a callback csak akkor frissül újra, amikor `rulesDirty` ténylegesen
    // vált (jellemzően az ELSŐ karakternél/kapcsoló-váltásnál), utána viszont befagy: a Mentés
    // gomb egy RÉGI `ruleToggles`-pillanatképet küld el, hiába gépelt tovább a user — pontosan
    // ez okozta, hogy a beírt szöveg helyett csak az első pár karakter mentődött el.
  }, [rulesDirty, featuresPanel.dirty, saveRules]) // eslint-disable-line react-hooks/exhaustive-deps
  // Az összevont sáv (mindhárom lehetséges forrásból: profil-form/szabály/funkciók) csak akkor
  // rejti el a "Mentve"-t, ha VALAMENNYI érintett `dirty` ténylegesen hamisra váltott — a
  // `router.refresh()` aszinkron, enélkül a sáv visszavillanna "Mentetlen változások"-ra, amíg a
  // frissített szerver-props meg nem érkeznek (ez okozta a jelentett hibát).
  useEffect(() => {
    if (formSaved && !formDirty && !rulesDirty && !featuresPanel.dirty) {
      const t = setTimeout(() => setFormSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [formSaved, formDirty, rulesDirty, featuresPanel.dirty])

  // A „Dokumentumok & jogi" fül a profil-form saját dokumentumok-fülét (ÁSZF-szakaszok) ÉS a
  // beleegyező nyilatkozat kártyát (PaymentsSettingsPanel `sections={['consent']}`) mutatja.
  const [documentsSaved, setDocumentsSaved] = useState(false)
  const saveDocumentsTab = useCallback(async () => {
    setSaving(true)
    try {
      await documentsPanel.apiRef.current?.save()
      const ok = await formApiRef.current?.save()
      if (ok) { router.refresh(); setDocumentsSaved(true) }
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (documentsSaved && !documentsPanel.dirty && !formDirty) {
      const t = setTimeout(() => setDocumentsSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [documentsSaved, documentsPanel.dirty, formDirty])

  // A „Fizetés" fül egyetlen forrásból menti (Stripe/Előleg/Ajándékutalvány kártyák).
  const [paymentsTabSaved, setPaymentsTabSaved] = useState(false)
  const savePaymentsTab = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await paymentsTabPanel.apiRef.current?.save()
      if (ok) { router.refresh(); setPaymentsTabSaved(true) }
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Ez a `router.refresh()` hiánya okozta konkrétan azt is, hogy egy funkció (pl. utalvány)
  // bekapcsolása után a nav-elem (AppShell `hiddenHrefs`) csak kézi újratöltésre jelent meg —
  // a szerver-props (amikből a nav láthatósága számol) csak most, mentés után frissül automatikusan.
  useEffect(() => {
    if (paymentsTabSaved && !paymentsTabPanel.dirty) {
      const t = setTimeout(() => setPaymentsTabSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [paymentsTabSaved, paymentsTabPanel.dirty])

  // Az „API & Integrációk" fül két panelt mutat egyszerre (Webhook/Marketing-követés +
  // Hírlevél/Számlázás) — mindkettő mentése egyetlen sávból.
  const [integSaved, setIntegSaved] = useState(false)
  const saveIntegrationsTab = useCallback(async () => {
    setSaving(true)
    try {
      const okA = await integPanel.apiRef.current?.save()
      const okB = await integPaymentsPanel.apiRef.current?.save()
      if (okA !== false && okB !== false) { router.refresh(); setIntegSaved(true) }
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (integSaved && !integPanel.dirty && !integPaymentsPanel.dirty) {
      const t = setTimeout(() => setIntegSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [integSaved, integPanel.dirty, integPaymentsPanel.dirty])

  // A „Google" fül (értékelés-kérés + Google Cégem/Calendar kártyák) egyetlen panelből ment.
  // A `router.refresh()` KELL a sikeres mentés után — a panel `baseline`-ja a szerverről kapott
  // `featureModules` propból számol, ami enélkül a mentés UTÁN is a RÉGI értéket mutatná, tehát a
  // sáv „mentetlen"-nek látszana maradni/visszaugrani, még ha a DB-írás sikeres is volt.
  const [googleSaved, setGoogleSaved] = useState(false)
  const saveGoogleTab = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await googlePanel.apiRef.current?.save()
      if (ok) {
        router.refresh()
        setGoogleSaved(true)
      }
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // A `router.refresh()` aszinkron — ha a „Mentve" jelzést egy sima setTimeout tüntetné el, az
  // gyakran HAMARABB lefutna, mint hogy a frissített props megérkezzen: abban a pillanatban a
  // panel `dirty`-je még mindig `true` (a baseline még a régi), a sáv tehát visszavillanna
  // „Mentetlen változások"-ra, majd újra eltűnne, amint a refresh landolt — ez okozta a
  // villogást. Ehelyett a „Mentve" jelzést csak azután kezdjük el elrejteni, hogy a `dirty`
  // TÉNYLEG hamisra vált (a friss props megérkeztek és egyeznek a helyi állapottal); eddig
  // bármeddig eltarthat, addig folyamatosan „Mentve"-t mutatunk, nem villan vissza.
  useEffect(() => {
    if (googleSaved && !googlePanel.dirty) {
      const t = setTimeout(() => setGoogleSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [googleSaved, googlePanel.dirty])

  // A „Foglalóoldal" szerkesztő — saját draft, a közös sávból ment.
  const [siteSaved, setSiteSaved] = useState(false)
  const saveSiteTab = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await sitePanel.apiRef.current?.save()
      if (ok) setSiteSaved(true)
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (siteSaved && !sitePanel.dirty) {
      const t = setTimeout(() => setSiteSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [siteSaved, sitePanel.dirty])

  // Az új menü önálló Pénzügy/Vendégek panelei — mindegyik a saját API-jával ment.
  const [splitSaved, setSplitSaved] = useState(false)
  const splitPanel = active === 'newsletter' ? newsletterPanel : active === 'vouchers' ? vouchersPanel : active === 'invoicing' ? invoicingPanel : null
  const saveSplitTab = async () => {
    if (!splitPanel) return
    setSaving(true)
    try {
      const ok = await splitPanel.apiRef.current?.save()
      if (ok) { router.refresh(); setSplitSaved(true) }
    } finally {
      setSaving(false)
    }
  }
  useEffect(() => {
    if (splitSaved && !splitPanel?.dirty) {
      const t = setTimeout(() => setSplitSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [splitSaved, splitPanel?.dirty])
  // „Vendég e-mailek" (új menü): a sablonok (profil-form) ÉS a küldési kapcsolók együtt mentődnek.
  const saveGuestEmailTab = async () => {
    if (notifDirty) await saveNotif()
    if (formDirty) await saveForm()
  }

  const activeBar =
    splitPanel
      ? { dirty: splitPanel.dirty, saved: splitSaved, onSave: saveSplitTab, onCancel: () => splitPanel.apiRef.current?.discard() }
      : active === 'email' && newLayout
      ? { dirty: formDirty || notifDirty, saved: formSaved || notifSaved, onSave: saveGuestEmailTab, onCancel: () => { formApiRef.current?.discard(); resetNotif() } }
      : active === 'site'
      ? { dirty: sitePanel.dirty, saved: siteSaved, onSave: saveSiteTab, onCancel: () => sitePanel.apiRef.current?.discard() }
      : active === 'booking'
      ? {
          dirty: formDirty || rulesDirty || featuresPanel.dirty,
          saved: formSaved || rulesSaved,
          onSave: saveBookingTab,
          onCancel: () => { formApiRef.current?.discard(); resetRules(); featuresPanel.apiRef.current?.discard() },
        }
      : active === 'documents'
      ? {
          dirty: formDirty || documentsPanel.dirty,
          saved: formSaved || documentsSaved,
          onSave: saveDocumentsTab,
          onCancel: () => { formApiRef.current?.discard(); documentsPanel.apiRef.current?.discard() },
        }
      : active === 'payments'
      ? { dirty: paymentsTabPanel.dirty, saved: paymentsTabSaved, onSave: savePaymentsTab, onCancel: () => paymentsTabPanel.apiRef.current?.discard() }
      : active === 'integrations'
      ? {
          dirty: integPanel.dirty || integPaymentsPanel.dirty,
          saved: integSaved,
          onSave: saveIntegrationsTab,
          onCancel: () => { integPanel.apiRef.current?.discard(); integPaymentsPanel.apiRef.current?.discard() },
        }
      : active === 'google'
      ? { dirty: googlePanel.dirty, saved: googleSaved, onSave: saveGoogleTab, onCancel: () => googlePanel.apiRef.current?.discard() }
      : active in FORM_TABS
      ? { dirty: formDirty, saved: formSaved, onSave: saveForm, onCancel: () => formApiRef.current?.discard() }
      : active === 'notifications'
      ? { dirty: notifDirty, saved: notifSaved, onSave: saveNotif, onCancel: resetNotif }
      : null

  // ── Navigáció adatvezérelten (a desktop rail ÉS a mobil legördülő EGY forrásból) ──
  type NavItem =
    | { kind: 'btn'; id: RailId; icon: LucideIcon; label: string; soon?: boolean; badge?: string }
    | { kind: 'link'; href: string; icon: LucideIcon; label: string }
  const canBilling = !myCapabilities || can(myCapabilities, 'billing.manage')
  const trialDaysLeft = billing.subscriptionStatus === 'trialing' && billing.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null
  const trialBadge = trialDaysLeft !== null ? (trialDaysLeft === 0 ? 'Ma jár le' : `${trialDaysLeft} nap`) : undefined
  // Lejárt/megszűnt/szüneteltetett előfizetésnél a Beállítások MINDEN füle lakat mögé kerül,
  // KIVÉVE az Előfizetés & számlázást (itt lehet újraaktiválni) és a Fiók törlését (mindig
  // elérhető, hogy valaki akkor is le tudja zárni a fiókját, ha épp nem tud/akar fizetni).
  const subscriptionLocked = billing.subscriptionStatus === 'past_due' || billing.subscriptionStatus === 'canceled' || billing.subscriptionStatus === 'paused'
  const canDanger = !myCapabilities || can(myCapabilities, 'danger')
  // `settings.own_profile` jogú tag: csak a Saját profil + Dokumentumok tab látszik.
  const canFullSettings = !myCapabilities || can(myCapabilities, 'settings.profile')
  // Csapat-KEZELÉS (meghívás, szerep-váltás, eltávolítás) — a `team.view`-jogú (vagy csak
  // `settings.profile`-os) tag CSAK OLVASSA a listát, nem szerkesztheti. Korábban ez a kliensen
  // egyáltalán nem volt leellenőrizve — bárki, aki a Csapat fület elérte, meghívhatott/
  // eltávolíthatott/szerepet válthatott (a szerver 403-at adott volna, de a UI ezt nem jelezte).
  const canTeamManage = !myCapabilities || can(myCapabilities, 'team.manage')
  // A "Csapat & jogok" fület `settings.profile` NÉLKÜL is elérje, akinek van team.view/
  // team.manage/roles.view joga — különben pl. egy csak `roles.view`-t kapott tag sosem
  // jutna el a fülhöz, hiába lenne jogosult a szerep-lista megtekintésére.
  const canSeeTeamTab = canFullSettings
    || !!myCapabilities && (can(myCapabilities, 'team.view') || can(myCapabilities, 'team.manage') || can(myCapabilities, 'roles.view'))
  const canPayments = !myCapabilities || can(myCapabilities, 'payments.manage')
  const navGroups: { group: string; items: NavItem[] }[] = canFullSettings && newLayout
    ? [
        { group: 'Üzlet', items: [
          { kind: 'btn', id: 'site', icon: PanelsTopLeft, label: 'Foglalóoldal', badge: 'ÚJ' },
          { kind: 'link', href: availabilityHref, icon: Clock, label: 'Nyitvatartás' },
          { kind: 'btn', id: 'documents', icon: FileText, label: 'Dokumentumok & jogi' },
        ] },
        { group: 'Vendégek', items: [
          { kind: 'btn', id: 'email', icon: Mail, label: 'Vendég e-mailek' },
          ...(canPayments ? [{ kind: 'btn' as const, id: 'newsletter' as RailId, icon: Send, label: 'Hírlevél' }] : []),
        ] },
        ...(canPayments
          ? [{ group: 'Pénzügy', items: [
              { kind: 'btn' as const, id: 'payments' as RailId, icon: Wallet, label: 'Fizetés & előleg' },
              { kind: 'btn' as const, id: 'vouchers' as RailId, icon: Gift, label: 'Ajándékutalvány' },
              { kind: 'btn' as const, id: 'invoicing' as RailId, icon: Receipt, label: 'Számlázás' },
            ] }]
          : []),
        { group: 'Kapcsolatok', items: [
          { kind: 'btn', id: 'google', icon: Star, label: 'Google' },
          { kind: 'btn', id: 'integrations', icon: LayoutGrid, label: 'API & integrációk' },
        ] },
        { group: 'Csapat', items: [
          { kind: 'btn', id: 'team', icon: Users, label: 'Csapat & jogok' },
          { kind: 'btn', id: 'sites', icon: Building2, label: 'Telephelyek' },
        ] },
        { group: 'Fiók', items: [
          { kind: 'btn', id: 'self', icon: UserRound, label: 'Saját profil' },
          { kind: 'btn', id: 'notifications', icon: Bell, label: 'Értesítések' },
          ...(canBilling ? [{ kind: 'btn' as const, id: 'billing' as RailId, icon: CreditCard, label: 'Előfizetés & számlázás', badge: trialBadge }] : []),
          { kind: 'btn', id: 'audit', icon: ScrollText, label: 'Audit-napló' },
        ] },
      ]
    : canFullSettings
    ? [
        { group: 'Üzlet', items: [
          { kind: 'btn', id: 'profile', icon: Home, label: 'Üzlet profil' },
          { kind: 'link', href: availabilityHref, icon: Clock, label: 'Nyitvatartás' },
          { kind: 'btn', id: 'languages', icon: Languages, label: 'Nyelvek' },
          { kind: 'btn', id: 'email', icon: Mail, label: 'Email-sablonok' },
        ] },
        { group: 'Foglalás', items: [
          { kind: 'btn', id: 'booking', icon: CalendarDays, label: 'Foglalás' },
        ] },
        ...(!myCapabilities || can(myCapabilities, 'payments.manage')
          ? [{ group: 'Fizetés', items: [{ kind: 'btn' as const, id: 'payments' as RailId, icon: Wallet, label: 'Fizetés' }] }]
          : []),
        { group: 'API & Integrációk', items: [
          { kind: 'btn', id: 'integrations', icon: LayoutGrid, label: 'API & Integrációk' },
        ] },
        { group: 'Google', items: [
          { kind: 'btn', id: 'google', icon: Star, label: 'Google' },
        ] },
        { group: 'Dokumentumok & jogi', items: [
          { kind: 'btn', id: 'documents', icon: FileText, label: 'Dokumentumok & jogi' },
        ] },
        { group: 'Csapat', items: [
          { kind: 'btn', id: 'team', icon: Users, label: 'Csapat & jogok' },
        ] },
        { group: 'Fiók', items: [
          { kind: 'btn', id: 'self', icon: UserRound, label: 'Saját profil' },
          ...(canBilling ? [{ kind: 'btn' as const, id: 'billing' as RailId, icon: CreditCard, label: 'Előfizetés & számlázás', badge: trialBadge }] : []),
          { kind: 'btn', id: 'sites', icon: Building2, label: 'Telephelyek' },
          { kind: 'btn', id: 'notifications', icon: Bell, label: 'Értesítések' },
          { kind: 'btn', id: 'audit', icon: ScrollText, label: 'Audit-napló' },
        ] },
      ]
    : [
        { group: 'Fiók', items: [
          { kind: 'btn', id: 'self', icon: UserRound, label: 'Saját profil' },
        ] },
        ...(canSeeTeamTab
          ? [{ group: 'Csapat', items: [{ kind: 'btn' as const, id: 'team' as RailId, icon: Users, label: 'Csapat & jogok' }] }]
          : []),
      ]
  const activeBtn = navGroups.flatMap((g) => g.items).find((it) => it.kind === 'btn' && it.id === active) as
    | Extract<NavItem, { kind: 'btn' }> | undefined
  const ActiveIcon = activeBtn?.icon ?? (active === 'danger' ? Trash2 : Home)

  return (
    // font-onest ITT, egyszer — minden alá ágyazott panel (BookingFeatures, GoogleSettingsPanel,
    // RolesManager, stb.) örökli, nem kell mindegyiknek külön emlékeznie rá.
    <div className="space-y-5 font-onest">
      {/* Fejléc — a mentés innen kikerült a KÖZÖS lebegő sávba (lásd lentebb). */}
      <div>
        <h1 className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[42px]">
          Beállítások
        </h1>
        <p className="mt-1.5 text-sm font-medium text-ink-soft">
          {subtitle}
          <span className="lg:hidden"> · {RAIL_LABELS[active]}</span>
        </p>
      </div>

      {/* Bal-sáv + panel */}
      <div className="lg:grid lg:grid-cols-[262px_1fr] lg:items-start lg:gap-[18px]">
        {/* RAIL — MOBIL: bottom sheet (portálon keresztül, a top nav SlidersHorizontal ikonja nyitja). */}
        {isMounted && createPortal(
          <AnimatePresence>
            {mobileNavOpen && (
              <div className="fixed inset-0 z-[160] font-onest lg:hidden">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 bg-ink-dark/40 backdrop-blur-sm"
                  onClick={() => setMobileNavOpen(false)}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={sheetSpring.transition}
                  data-lenis-prevent
                  className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom,16px)]"
                >
                  {/* Handle + fejléc */}
                  <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">Beállítások</span>
                      <button
                        type="button"
                        onClick={() => setMobileNavOpen(false)}
                        aria-label="Bezárás"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F2EC] text-ink-soft transition-opacity hover:opacity-70"
                      >
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  <div className="px-2 pb-4">
                    {navGroups.map((grp) => (
                      <div key={grp.group}>
                        <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">{grp.group}</div>
                        {grp.items.map((it) => {
                          const Icon = it.icon
                          const itemLocked = subscriptionLocked && (it.kind !== 'btn' || it.id !== 'billing')
                          if (itemLocked) {
                            return (
                              <span
                                key={it.kind === 'btn' ? it.id : it.href}
                                aria-disabled
                                className="flex cursor-not-allowed items-center gap-3 rounded-dav-chip px-3 py-3 text-[14.5px] font-medium text-ink/35"
                              >
                                <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                                {it.label}
                                <Lock className="ml-auto h-4 w-4 shrink-0" strokeWidth={1.6} />
                              </span>
                            )
                          }
                          return it.kind === 'btn' ? (
                            <button
                              key={it.id}
                              id={active === it.id ? 'settings-nav-active-item' : undefined}
                              type="button"
                              onClick={() => { setActive(it.id); setMobileNavOpen(false) }}
                              className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[14.5px] ${active === it.id ? 'bg-ink-dark font-semibold text-white' : 'font-medium text-ink-soft'}`}
                            >
                              <Icon className={`h-[18px] w-[18px] ${active === it.id ? 'text-gold' : 'text-ink-soft2'}`} strokeWidth={1.5} />
                              {it.label}
                              {it.badge && !it.soon && (
                                <span className="ml-auto rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold leading-none text-ink-dark">{it.badge}</span>
                              )}
                              {it.soon && (
                                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${active === it.id ? 'bg-white/15 text-white/80' : 'bg-[#F2ECDA] text-ink-soft'}`}>Hamarosan</span>
                              )}
                              {active === it.id && !it.soon && !it.badge && (
                                <Check className="ml-auto h-4 w-4 text-gold" strokeWidth={2.5} />
                              )}
                            </button>
                          ) : (
                            <Link
                              key={it.href}
                              href={it.href}
                              onClick={() => setMobileNavOpen(false)}
                              className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-[14.5px] font-medium text-ink-soft"
                            >
                              <Icon className="h-[18px] w-[18px] text-ink-soft2" strokeWidth={1.5} />
                              {it.label}
                            </Link>
                          )
                        })}
                      </div>
                    ))}
                    {canDanger && <>
                      <div className="my-2 h-px bg-line" />
                      <button
                        id={active === 'danger' ? 'settings-nav-active-item' : undefined}
                        type="button"
                        onClick={() => { setActive('danger'); setMobileNavOpen(false) }}
                        className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[14.5px] font-medium ${active === 'danger' ? 'bg-ink-dark text-white' : 'text-bad'}`}
                      >
                        <Trash2 className={`h-[18px] w-[18px] ${active === 'danger' ? 'text-gold' : 'text-bad'}`} strokeWidth={1.5} />
                        Fiók törlése
                        {active === 'danger' && <Check className="ml-auto h-4 w-4 text-gold" strokeWidth={2.5} />}
                      </button>
                    </>}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* RAIL — DESKTOP: függőleges üveges sáv — sticky, követi a scroll-t */}
        <nav
          data-lenis-prevent
          className="hidden lg:sticky lg:top-6 lg:self-start lg:flex lg:flex-col lg:gap-[3px] lg:rounded-[24px] lg:bg-[var(--dav-glass)] lg:p-[11px] lg:shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_36px_-30px_rgba(80,70,30,0.18)]"
        >
          {navGroups.map((grp) => (
            <div key={grp.group} className="contents">
              <GroupLabel>{grp.group}</GroupLabel>
              {grp.items.map((it) => {
                const Icon = it.icon
                if (it.kind === 'btn') {
                  const itemLocked = subscriptionLocked && it.id !== 'billing'
                  return <RailBtn key={it.id} id={it.id} active={active} onClick={setActive} icon={it.icon} label={it.label} soon={it.soon} badge={it.badge} locked={itemLocked} />
                }
                if (subscriptionLocked) {
                  return (
                    <span
                      key={it.href}
                      aria-disabled
                      title="Az előfizetésed lejárt — aktiváld a folytatáshoz"
                      className="flex cursor-not-allowed items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] font-medium text-ink/35"
                    >
                      <Icon className="h-[17px] w-[17px]" strokeWidth={1.5} />
                      {it.label}
                      <Lock className="ml-auto h-[15px] w-[15px] shrink-0" strokeWidth={1.6} />
                    </span>
                  )
                }
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="flex items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink"
                  >
                    <Icon className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.5} />
                    {it.label}
                  </Link>
                )
              })}
            </div>
          ))}
          {canDanger && <>
            <div className="my-1.5 h-px bg-line" />
            <RailBtn id="danger" active={active} onClick={setActive} icon={Trash2} label="Fiók törlése" danger />
          </>}
        </nav>

        {/* PANEL */}
        <div className="min-w-0">
          {/* Szekció-cím (desktop) — mobilon a legördülő gomb jelzi az aktív szekciót. */}
          <div className="hidden lg:mb-5 lg:flex lg:items-center lg:justify-between">
            <h2 className="text-[22px] font-medium tracking-[-0.01em] text-ink">{RAIL_LABELS[active]}</h2>
            {active === 'billing' && trialBadge && (
              <span className="rounded-full bg-gold px-3 py-1 text-[13px] font-semibold leading-none text-ink-dark">
                {trialBadge}
              </span>
            )}
          </div>

          {/* Profil-form (Üzlet profil / Foglalás / Nyelvek / Email / Dokumentumok / Fiók törlése):
              MINDIG mountolva marad (a mentetlen mezők ne vesszenek el lista-váltáskor), csak a
              láthatóságot váltjuk. A fület a bal lista vezérli — a formhoz CONTEXTen át jut le
              (RSC-határon a cloneElement-prop nem megbízható), így a form a saját fül-sorát is elrejti. */}
          <SettingsFormContext.Provider value={{ controlledTab: FORM_TABS[active] ?? 'general', reportDirty, registerApi }}>
            <div className={active in FORM_TABS ? '' : 'hidden'}>{profilePanel}</div>
          </SettingsFormContext.Provider>

          {/* ── „Foglalás" fül folytatása — a profil-form saját booking-fülje UTÁN, ugyanazon
              a fülön: az egyetlen valódi „szabály" (auto-megerősítés) + a Foglalási funkciók
              (emlékeztetők, értékelés-kérés). Régen 3 külön hely volt, most egy. ── */}
          {active === 'booking' && (
            <div className="mt-5 space-y-4">
              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                <RuleRow
                  title="Automatikus megerősítés"
                  desc="A foglalások emberi jóváhagyás nélkül visszaigazolódnak"
                  checked={ruleToggles.autoConfirm}
                  onChange={() => setRuleToggles((s) => ({ ...s, autoConfirm: !s.autoConfirm }))}
                />
                <RuleRow
                  title="Cím megadása mindig kötelező"
                  desc="A vendégnek akkor is meg kell adnia a pontos címét, ha nincs bekapcsolva az előleg"
                  checked={ruleToggles.requireAddress}
                  onChange={() => setRuleToggles((s) => ({ ...s, requireAddress: !s.requireAddress }))}
                  last={!ruleToggles.requireAddress}
                />
                {ruleToggles.requireAddress && (
                  <div className="pb-4">
                    <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">Cím-kérés indoklása a vendégnek</label>
                    <input
                      type="text"
                      value={ruleToggles.requireAddressNote}
                      onChange={(e) => setRuleToggles((s) => ({ ...s, requireAddressNote: e.target.value }))}
                      placeholder="Pl. A pontos cím megadására a foglalásod rögzítéséhez van szükségünk."
                      className="w-full rounded-[12px] border border-line-strong bg-white px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                    <p className="mt-1.5 text-[11.5px] text-ink-soft2">Üresen hagyva egy általános szöveg jelenik meg a vendégnek a cím-mező alatt.</p>
                  </div>
                )}
              </div>

              <BookingFeatures
                variant={variant}
                apiBase={apiBase}
                initial={featureModules}
                embedded
                onDirtyChange={featuresPanel.onDirtyChange}
                registerApi={featuresPanel.registerApi}
              />

              {/* Depozit / no-show — a Fizetés szekció a gazdája (Stripe Connect bekötve). */}
              <button
                type="button"
                onClick={() => setActive('payments')}
                className="flex w-full items-center justify-between gap-3 rounded-[26px] dav-card-glass px-6 py-4 text-left transition-colors hover:border-ink/20"
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink">Depozit & no-show védelem</div>
                  <div className="mt-0.5 text-[13px] text-ink-soft">
                    Vendég-előleg Stripe-on keresztül — a <b className="font-semibold text-ink-soft">Fizetés</b> szekcióban kapcsolható.
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
                  Megnyitás <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </button>
            </div>
          )}

          {/* ── „Dokumentumok & jogi" fül folytatása — a profil-form saját dokumentumok-fülje
              (ÁSZF-szakaszok) UTÁN a beleegyező nyilatkozat sablon-szerkesztője, ami régen a
              Fizetéseknél volt, pedig jogi dokumentum, nem fizetési beállítás. ── */}
          {/* ── „Vendég e-mailek" (új menü): a sablonok (profil-form email-füle) MELLÉ ide kerültek a
              vendégnek menő levelek be/ki kapcsolói is — korábban az Értesítéseknél voltak. ── */}
          {active === 'email' && newLayout && (
            <div className="mt-5 rounded-[26px] dav-card-glass px-6 py-2">
              <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-soft2">Levelek a vendégnek</span>
                <span className="text-center text-[12px] font-semibold uppercase text-ink-soft2">Küldés</span>
              </div>
              {notifRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4 last:border-0">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink">{row.title}</div>
                    <div className="mt-0.5 text-[12px] text-ink-soft">{row.sub}</div>
                  </div>
                  <div className="flex justify-center">
                    <Toggle
                      checked={notif[row.key].email}
                      onChange={() => setNotif((s) => ({ ...s, [row.key]: { ...s[row.key], email: !s[row.key].email } }))}
                    />
                  </div>
                </div>
              ))}
              <div className="py-4 text-[12.5px] leading-relaxed text-ink-soft">
                Az emlékeztető időzítését és a visszajelzés-kérést a <button type="button" onClick={() => setActive('site')} className="font-semibold text-ink underline underline-offset-2">Foglalóoldal → Visszaigazolás</button> lépésnél állítod; a neked szóló értesítéseket az <button type="button" onClick={() => setActive('notifications')} className="font-semibold text-ink underline underline-offset-2">Értesítések</button> között.
              </div>
            </div>
          )}

          {active === 'documents' && (
            <div className="mt-5">
              <PaymentsSettingsPanel
                variant={variant}
                apiBase={apiBase}
                deposit={depositSettings}
                invoice={invoiceSettings}
                voucher={voucherSettings}
                consent={consentSettings}
                stripeConnectAccountId={stripeConnectAccountId}
                stripeConnectOnboarded={stripeConnectOnboarded}
                pricing={pricing}
                businessId={activeBusinessId}
                tier={businessTier}
                supportedLocales={supportedLocales}
                sections={['consent']}
                onDirtyChange={documentsPanel.onDirtyChange}
                registerApi={documentsPanel.registerApi}
              />
            </div>
          )}

          {/* ── Nem-form panelek — key változásakor fade-in animáció (a profilePanel mindig mountolva marad). ── */}
          {!(active in FORM_TABS) && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: EASE }}
          >

          {active === 'site' && bookingPageEditor && (
            <BookingPageEditor
              initial={bookingPageEditor}
              onDirtyChange={sitePanel.onDirtyChange}
              registerApi={sitePanel.registerApi}
              onNavigate={(tab) => { if (tab in RAIL_LABELS) setActive(tab as RailId) }}
            />
          )}

          {(['newsletter', 'vouchers', 'invoicing'] as const).map((tab) => active === tab && (
            <PaymentsSettingsPanel
              key={tab}
              variant={variant}
              apiBase={apiBase}
              deposit={depositSettings}
              invoice={invoiceSettings}
              voucher={voucherSettings}
              consent={consentSettings}
              stripeConnectAccountId={stripeConnectAccountId}
              stripeConnectOnboarded={stripeConnectOnboarded}
              pricing={pricing}
              businessId={activeBusinessId}
              tier={businessTier}
              sections={[tab === 'vouchers' ? 'voucher' : tab]}
              onDirtyChange={(tab === 'newsletter' ? newsletterPanel : tab === 'vouchers' ? vouchersPanel : invoicingPanel).onDirtyChange}
              registerApi={(tab === 'newsletter' ? newsletterPanel : tab === 'vouchers' ? vouchersPanel : invoicingPanel).registerApi}
            />
          ))}

          {active === 'payments' && (
            <PaymentsSettingsPanel
              variant={variant}
              apiBase={apiBase}
              deposit={depositSettings}
              invoice={invoiceSettings}
              voucher={voucherSettings}
              consent={consentSettings}
              stripeConnectAccountId={stripeConnectAccountId}
              stripeConnectOnboarded={stripeConnectOnboarded}
              pricing={pricing}
              businessId={activeBusinessId}
              tier={businessTier}
              sections={newLayout ? ['stripe', 'deposit'] : ['stripe', 'deposit', 'voucher', 'newsletter']}
              onDirtyChange={paymentsTabPanel.onDirtyChange}
              registerApi={paymentsTabPanel.registerApi}
            />
          )}

          {active === 'notifications' && (
            <div className="space-y-4">
              {/* PWA telepítés — előfeltétele az iOS push-nak, ezért legfelül. */}
              <PwaInstallCard />
              {/* Eszköz-szintű PUSH (böngésző/OS) — az e-mail-mátrix fölött, mert ez a leggyorsabb csatorna. */}
              <PushSubscribeToggle />

              {/* Egységes értesítési kártya — Push/App + Email szekciók */}
              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                {/* Push/App szekció fejléc */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-soft2">Értesítési preferenciák</span>
                  <span className="text-center text-[12px] font-semibold uppercase text-ink-soft2">App</span>
                </div>
                <PersonalNotifPrefsCard compact />
                {newLayout && (
                  <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink">Új foglalás és lemondás az üzletben</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">Az alkalmazáson belül, minden csapattagnak · korábban a Foglalás fülön</div>
                    </div>
                    <div className="flex justify-center">
                      <Toggle checked={newBookingsNotif} onChange={() => setNewBookingsNotif((v) => !v)} />
                    </div>
                  </div>
                )}

                {/* Email szekció fejléc */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-soft2">Esemény</span>
                  <span className="text-center text-[12px] font-semibold uppercase text-ink-soft2">E-mail</span>
                </div>
                {(newLayout ? [] : notifRows).map((row) => (
                  <div key={row.key} className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink">{row.title}</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">{row.sub}</div>
                    </div>
                    <div className="flex justify-center">
                      <Toggle
                        checked={notif[row.key].email}
                        onChange={() => setNotif((s) => ({ ...s, [row.key]: { ...s[row.key], email: !s[row.key].email } }))}
                      />
                    </div>
                  </div>
                ))}
                {/* Napi digest email */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink">Napi digest email</div>
                    <div className="mt-0.5 text-[12px] text-ink-soft">
                      {variant === 'salon'
                        ? 'Neked · reggeli + esti összefoglaló egyszerre'
                        : 'Neked · napi forgalom összefoglalója zárás után'}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Toggle checked={digestEmailOn} onChange={toggleDigestEmail} />
                  </div>
                </div>

                {/* Belső emailek — SAJÁT (owner VAGY staff) email-opt-in, alapból kikapcsolva,
                    mert az app/push a fő csatorna. A guest-emailektől eltérően EZEK azonnal
                    mentődnek kattintásra (nincs Mentés-gomb, ugyanaz a minta, mint az App oszlop). */}
                {internalEmailPrefs.loaded && internalEmailPrefs.allowed.bookings_email && (
                  <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4 last:border-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink">Új foglalás</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">Neked · amikor új foglalás érkezik (a push/app mellett)</div>
                    </div>
                    <div className="flex justify-center">
                      <Toggle checked={internalEmailPrefs.prefs.bookings_email} onChange={() => internalEmailPrefs.toggle('bookings_email')} />
                    </div>
                  </div>
                )}
                {internalEmailPrefs.loaded && internalEmailPrefs.allowed.schedule_email && (
                  <div className="grid grid-cols-[1fr_84px] items-center gap-2 py-4 last:border-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink">Beosztás változás</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">Neked · ha a műszakod létrejön, módosul vagy törlődik (a push/app mellett)</div>
                    </div>
                    <div className="flex justify-center">
                      <Toggle checked={internalEmailPrefs.prefs.schedule_email} onChange={() => internalEmailPrefs.toggle('schedule_email')} />
                    </div>
                  </div>
                )}
              </div>

              {/* Sötét PRO kártya */}
              <div className="rounded-[26px] bg-ink-dark p-6 shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[15px] font-medium text-white">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Feladó & sablon márkázás
                  </div>
                  <span className="rounded-full bg-gold px-3 py-[5px] text-[10px] font-bold tracking-[0.04em] text-ink-dark">PRO</span>
                </div>
                <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-white/60">
                  Egyedi feladónév, logó és színek az e-mailekben. Jelenlegi feladó:{' '}
                  <span className="text-gold">{senderLabel}</span>
                </p>
              </div>
              {newLayout ? (
                <p className="px-1 text-xs text-ink-soft2">
                  Itt a <b className="font-semibold text-ink-soft">neked</b> szóló értesítéseket állítod. A vendégnek menő leveleket a{' '}
                  <button type="button" onClick={() => setActive('email')} className="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">Vendég e-mailek</button>{' '}
                  alatt kapcsolod és szerkeszted.
                </p>
              ) : (
              <p className="px-1 text-xs text-ink-soft2">
                A vendégnek küldött emailek (visszaigazolás, lemondás, módosítás) itt kapcsolhatók. A napi összefoglalók a tulajdonosnak mennek. Az{' '}
                <b className="font-semibold text-ink-soft">emlékeztető</b> és a{' '}
                <b className="font-semibold text-ink-soft">visszajelzés-kérés</b> a{' '}
                <button
                  type="button"
                  onClick={() => setActive('booking')}
                  className="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                >
                  Foglalás
                </button>{' '}
                fülön állítható (be/ki + időzítés). A sablonokat az „Üzlet profil → Email" fülön szerkeszted.
              </p>
              )}
            </div>
          )}

          {/* ── Csapat & jogok ── ref 536–556. VALÓS tulajdonos + membershipök. */}
          {active === 'team' && (
            <div className="space-y-4">
              {/* Al-navigáció — Tagok (meghívás/kezelés) vs. Szerepek (jogosultság-szerkesztés). */}
              <div className="inline-flex rounded-[14px] bg-[#FBF9F2] p-1">
                <button
                  type="button"
                  onClick={() => setTeamSubTab('members')}
                  className={`rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${teamSubTab === 'members' ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'}`}
                >
                  Tagok
                </button>
                <button
                  type="button"
                  onClick={() => setTeamSubTab('roles')}
                  className={`rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${teamSubTab === 'roles' ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'}`}
                >
                  Szerepek & jogosultságok
                </button>
              </div>

              {teamSubTab === 'roles' ? rolesSection : (
              <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">
                  {team.filter((m) => !m.pending).length} tag
                  {team.some((m) => m.pending) && ` · ${team.filter((m) => m.pending).length} függő meghívó`}
                </p>
                {canTeamManage && (
                  <button
                    type="button"
                    onClick={() => setInviteOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-[18px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white"
                  >
                    {inviteOpen ? <X className="h-[15px] w-[15px] text-gold" strokeWidth={2} /> : <Plus className="h-[15px] w-[15px] text-gold" strokeWidth={1.8} />}
                    {inviteOpen ? 'Mégse' : 'Tag meghívása'}
                  </button>
                )}
              </div>

              {canTeamManage && inviteOpen && (
                <Card>
                  <div className="text-[15px] font-medium text-ink">Új tag meghívása</div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="email@pelda.hu"
                      className="min-w-0 flex-1 rounded-[14px] border border-line-strong bg-white px-4 py-3 text-[14px] text-ink outline-none transition-colors focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="rounded-[14px] border border-line-strong bg-white px-4 py-3 text-[14px] font-medium text-ink outline-none transition-colors focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
                    >
                      <option value="">Szerep nélkül (utólag beállítható)</option>
                      {liveRoles.map((r) => (
                        <option key={r.id} value={`c:${r.id}`}>{r.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={sendInvite}
                      disabled={inviteBusy || !inviteEmail.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
                    >
                      {inviteBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Meghívó küldése
                    </button>
                  </div>
                  {!inviteRole.startsWith('c:') && (
                    <p className="mt-2 text-[12px] text-ink-soft2">
                      Szerep nélkül a tag csak alap hozzáférést kap (belép, de üres a felülete) — ezt utólag is beállíthatod.
                    </p>
                  )}
                </Card>
              )}

              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                {team.map((m, i) => (
                  <div
                    key={(m.id ?? m.email) + i}
                    className={`flex flex-wrap items-center gap-3.5 py-[18px] ${i < team.length - 1 ? 'border-b border-line' : ''}`}
                  >
                    <Avatar name={m.name} email={m.email} pending={m.pending} gold={m.roleTone === 'manager'} avatarUrl={m.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold text-ink">
                        {m.pending ? m.email : m.name}
                      </div>
                      <div className={`truncate text-[12.5px] ${m.pending ? 'text-[#C99A3A]' : 'text-ink-soft'}`}>
                        {m.pending ? 'Meghívó elküldve · függőben' : m.email}
                      </div>
                      {m.position && <div className="truncate text-[12px] font-medium text-ink-soft2">{m.position}</div>}
                    </div>
                    {/* Státusz-LENYÍLÓ — a Munkatárs-adatlap (HiringView) státusz-menüjével AZONOS:
                        pill + ChevronDown, kattintásra „Aktív / Felfüggesztett" opciók (pipa a jelenlegin).
                        A route a staff.is_active-ot is szinkronizálja. Csak valódi tagnál (nem tulaj/meghívó). */}
                    {!m.pending && m.id && m.roleTone !== 'owner' && !canTeamManage && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
                        style={m.suspended ? { background: '#F1EEE6', color: '#86826F', border: '1px solid var(--dav-line)' } : { background: '#E7F1E9', color: '#3B6B4B' }}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: m.suspended ? '#B7B2A4' : '#4F9E6A' }} />
                        {m.suspended ? 'Felfüggesztett' : 'Aktív'}
                      </span>
                    )}
                    {!m.pending && m.id && m.roleTone !== 'owner' && canTeamManage && (
                      <div className="relative">
                        <button
                          type="button"
                          disabled={rowBusy === m.id}
                          onClick={() => setStatusMenuId((o) => (o === m.id ? null : m.id!))}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold disabled:opacity-60"
                          style={m.suspended ? { background: '#F1EEE6', color: '#86826F', border: '1px solid var(--dav-line)' } : { background: '#E7F1E9', color: '#3B6B4B' }}
                        >
                          {rowBusy === m.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="h-2 w-2 rounded-full" style={{ background: m.suspended ? '#B7B2A4' : '#4F9E6A' }} />
                          )}
                          {m.suspended ? 'Felfüggesztett' : 'Aktív'}
                          <ChevronDown className="h-3 w-3 opacity-60" />
                        </button>
                        {statusMenuId === m.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} />
                            <div className="absolute right-0 top-[34px] z-20 w-48 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                              {(['active', 'suspended'] as const).map((s) => {
                                const isCur = (s === 'suspended') === !!m.suspended
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setMemberStatus(m.id!, s)}
                                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                                  >
                                    <span className="h-2 w-2 rounded-full" style={{ background: s === 'suspended' ? '#B7B2A4' : '#4F9E6A' }} />
                                    {s === 'suspended' ? 'Felfüggesztett' : 'Aktív'}
                                    {isCur && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {/* A tulajdonos-sor (nincs id) csak badge; team.manage NÉLKÜL a többi tag is
                        csak olvasható badge (nem szerkeszthet mást) — team.manage-dzsel a
                        tagoknál szerep-váltó + eltávolítás. */}
                    {m.roleTone === 'owner' || !m.id || !canTeamManage ? (
                      <RoleBadge role={m.role} tone={m.roleTone} pending={m.pending} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.customRoleId ? `c:${m.customRoleId}` : ''}
                          disabled={rowBusy === m.id || liveRoles.length === 0}
                          onChange={(e) => changeRole(m.id!, e.target.value)}
                          className="rounded-full border border-line-strong bg-white px-3 py-1 text-[12px] font-semibold text-ink outline-none transition-colors focus:border-gold/60 disabled:opacity-40"
                        >
                          {!m.customRoleId && <option value="" disabled>{m.role} (beépített)</option>}
                          {liveRoles.map((r) => (
                            <option key={r.id} value={`c:${r.id}`}>{r.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(m.id!)}
                          disabled={rowBusy === m.id}
                          title="Eltávolítás"
                          className="rounded-[12px] border border-bad/30 p-2 text-bad transition-opacity disabled:opacity-40"
                        >
                          {rowBusy === m.id ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.7} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="px-1 text-xs text-ink-soft2">
                A tulajdonos hozzáférése mindig megmarad. A meghívott tagok az email-linkkel csatlakoznak.
              </p>
              </>
              )}
            </div>
          )}

          {/* ── Saját profil ── a bejelentkezett user (bárki: tulaj/vezető/alkalmazott) szerkeszti
              a saját nevét/avatarját/jelszavát. A panel-tartalom a settings page-ről jön (ProfileEditor),
              hogy a user-adat ott, szerver-oldalon oldódjon fel. */}
          {active === 'self' && (
            <div className="w-full">
              {selfProfile ?? <p className="text-sm text-ink-soft">A profil szerkesztő nem érhető el.</p>}
            </div>
          )}

          {/* ── API & Integrációk — MINDEN kulcs/API/webhook-jellegű beállítás egy helyen
              (user-döntés: ne szedjük szét irány szerint, ez egyszerűbb, mint a szolgáltatás-
              specifikus szétbontás). A Számlázás + Hírlevél a Fizetésekből költözött ide. ── */}
          {active === 'integrations' && (
            <div className="space-y-4">
              <IntegrationsPanel
                variant={variant}
                bookingUrl={bookingUrl}
                icalUrl={icalUrl}
                embedUrl={embedUrl}
                embedSmartSnippet={embedSmartSnippet}
                apiBase={apiBase}
                webhookUrl={webhookUrl}
                ga4Id={ga4Id}
                facebookPixelId={facebookPixelId}
                onDirtyChange={integPanel.onDirtyChange}
                registerApi={integPanel.registerApi}
              />
              {!newLayout && (
              <PaymentsSettingsPanel
                variant={variant}
                apiBase={apiBase}
                deposit={depositSettings}
                invoice={invoiceSettings}
                voucher={voucherSettings}
                consent={consentSettings}
                stripeConnectAccountId={stripeConnectAccountId}
                stripeConnectOnboarded={stripeConnectOnboarded}
                pricing={pricing}
                businessId={activeBusinessId}
                tier={businessTier}
                sections={['invoicing']}
                onDirtyChange={integPaymentsPanel.onDirtyChange}
                registerApi={integPaymentsPanel.registerApi}
              />
              )}
            </div>
          )}

          {active === 'google' && (
            <GoogleSettingsPanel
              variant={variant}
              apiBase={apiBase}
              bookingUrl={bookingUrl}
              initialFeatureModules={featureModules}
              onDirtyChange={googlePanel.onDirtyChange}
              registerApi={googlePanel.registerApi}
            />
          )}

          {active === 'billing' && (
            <div className="space-y-5">

              {/* 1. ── Csomag-kártyák */}
              <PricingCards
                kind={variant}
                pricing={pricing}
                annualDiscountPct={billingAccount.annualDiscountPct}
                currentCycle={billing.billingCycle}
                activeBusiness={activeBizForPricing}
                isTrial={billing.subscriptionStatus === 'trialing'}
                needsCheckout={billing.subscriptionStatus !== 'trialing' && billing.subscriptionStatus !== 'active'}
                onCycleChange={setSelectedCycle}
              />

              {/* 2. ── Számlázási adatok (szerkeszthető) */}
              <Card>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[17px] font-medium text-ink">Számlázási adatok</div>
                    <p className="mt-0.5 text-[12.5px] text-ink-soft2">
                      Ezek az adatok kerülnek a Számlázz.hu által kiállított számlákon.
                    </p>
                  </div>
                  {billDirty && (
                    <button
                      type="button"
                      disabled={billSaving}
                      onClick={saveBillDetails}
                      className="inline-flex shrink-0 items-center gap-2 rounded-dav-pill bg-ink-dark px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-60"
                    >
                      {billSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Mentés
                    </button>
                  )}
                </div>
                <div id="bill-details-form" className="mt-5 space-y-4">
                  {/* Sor 1: Cégnév + Adószám */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                        Cégnév / Teljes név <span className="text-bad" aria-hidden>*</span>
                      </label>
                      <input
                        type="text"
                        value={billDetails.legalName}
                        onChange={(e) => setBillField('legalName', e.target.value)}
                        onBlur={() => touchBillField('legalName')}
                        placeholder="Pl. Minta Bt."
                        aria-required
                        aria-invalid={!!billError('legalName')}
                        className={`h-[44px] w-full rounded-[14px] border bg-white px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-soft2/50 focus:ring-2 focus:ring-gold/20 ${billError('legalName') ? 'border-bad/60 focus:border-bad/60' : 'border-line-strong focus:border-gold/60'}`}
                      />
                      {billError('legalName') && (
                        <p className="mt-1 text-[11.5px] font-medium text-bad">{billError('legalName')}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">Adószám</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={billDetails.taxNumber}
                        onChange={(e) => setBillField('taxNumber', maskTaxNumber(e.target.value))}
                        placeholder="12345678-1-23"
                        maxLength={13}
                        className="h-[44px] w-full rounded-[14px] border border-line-strong bg-white px-4 font-mono text-[14px] text-ink outline-none transition-colors placeholder:font-sans placeholder:text-ink-soft2/50 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
                      />
                    </div>
                  </div>
                  {/* Sor 2: Cégjegyzékszám + Számlázási email */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">Cégjegyzékszám</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={billDetails.companyRegNumber}
                        onChange={(e) => setBillField('companyRegNumber', maskCompanyReg(e.target.value))}
                        placeholder="01-09-123456"
                        maxLength={12}
                        className="h-[44px] w-full rounded-[14px] border border-line-strong bg-white px-4 font-mono text-[14px] text-ink outline-none transition-colors placeholder:font-sans placeholder:text-ink-soft2/50 focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                        Számlázási email <span className="text-bad" aria-hidden>*</span>
                      </label>
                      <input
                        type="email"
                        value={billDetails.billingEmail}
                        onChange={(e) => setBillField('billingEmail', e.target.value)}
                        onBlur={() => touchBillField('billingEmail')}
                        placeholder="szamlazas@ceg.hu"
                        aria-required
                        aria-invalid={!!billError('billingEmail')}
                        className={`h-[44px] w-full rounded-[14px] border bg-white px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-soft2/50 focus:ring-2 focus:ring-gold/20 ${billError('billingEmail') ? 'border-bad/60 focus:border-bad/60' : 'border-line-strong focus:border-gold/60'}`}
                      />
                      {billError('billingEmail') && (
                        <p className="mt-1 text-[11.5px] font-medium text-bad">{billError('billingEmail')}</p>
                      )}
                    </div>
                  </div>
                  {/* Sor 3: Számlázási cím */}
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
                      Számlázási cím <span className="text-bad" aria-hidden>*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_2fr]">
                      <div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={billDetails.billingPostalCode}
                          onChange={(e) => setBillField('billingPostalCode', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          onBlur={() => touchBillField('billingPostalCode')}
                          placeholder="1234"
                          maxLength={4}
                          aria-label="Irányítószám"
                          aria-required
                          aria-invalid={!!billError('billingPostalCode')}
                          className={`h-[44px] w-full rounded-[14px] border bg-white px-4 font-mono text-[14px] text-ink outline-none transition-colors placeholder:font-sans placeholder:text-ink-soft2/50 focus:ring-2 focus:ring-gold/20 ${billError('billingPostalCode') ? 'border-bad/60 focus:border-bad/60' : 'border-line-strong focus:border-gold/60'}`}
                        />
                        {billError('billingPostalCode') && (
                          <p className="mt-1 text-[11.5px] font-medium text-bad">{billError('billingPostalCode')}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={billDetails.billingCity}
                          onChange={(e) => setBillField('billingCity', e.target.value)}
                          onBlur={() => touchBillField('billingCity')}
                          placeholder="Budapest"
                          aria-label="Város"
                          aria-required
                          aria-invalid={!!billError('billingCity')}
                          className={`h-[44px] w-full rounded-[14px] border bg-white px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-soft2/50 focus:ring-2 focus:ring-gold/20 ${billError('billingCity') ? 'border-bad/60 focus:border-bad/60' : 'border-line-strong focus:border-gold/60'}`}
                        />
                        {billError('billingCity') && (
                          <p className="mt-1 text-[11.5px] font-medium text-bad">{billError('billingCity')}</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={billDetails.billingStreet}
                          onChange={(e) => setBillField('billingStreet', e.target.value)}
                          onBlur={() => touchBillField('billingStreet')}
                          placeholder="Példa u. 1."
                          aria-label="Utca, házszám"
                          aria-required
                          aria-invalid={!!billError('billingStreet')}
                          className={`h-[44px] w-full rounded-[14px] border bg-white px-4 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-soft2/50 focus:ring-2 focus:ring-gold/20 ${billError('billingStreet') ? 'border-bad/60 focus:border-bad/60' : 'border-line-strong focus:border-gold/60'}`}
                        />
                        {billError('billingStreet') && (
                          <p className="mt-1 text-[11.5px] font-medium text-bad">{billError('billingStreet')}</p>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-soft2">Irányítószám · Város · Utca, házszám</p>
                  </div>
                  <p className="text-[11px] text-ink-soft2">
                    <span className="text-bad">*</span> Kötelező mezők — a számla kiállításához szükségesek
                  </p>
                </div>
              </Card>

              {/* 3. ── Fizetés & előfizetés */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[17px] font-medium text-ink">Fizetés & előfizetés</div>
                  <StatusBadge status={billing.subscriptionStatus} />
                </div>

                {billing.subscriptionStatus === 'past_due' && (
                  <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-bad/30 bg-bad-bg px-4 py-3.5">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-bad" strokeWidth={1.8} />
                    <p className="text-[13px] text-bad">
                      A fizetés nem sikerült. Kérjük frissítsd a bankkártyád, hogy az előfizetés aktív maradjon.
                    </p>
                  </div>
                )}
                {billing.subscriptionStatus === 'canceled' && (
                  <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-bad/30 bg-bad-bg px-4 py-3.5">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-bad" strokeWidth={1.8} />
                    <p className="text-[13px] text-bad">
                      Az előfizetés le van mondva. Új előfizetés indításával az összes Pro funkció ismét elérhető.
                    </p>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between rounded-[16px] bg-paper px-4 py-3.5">
                  <div>
                    <div className="text-[12px] text-ink-soft">
                      {billing.subscriptionStatus === 'trialing' ? 'Próbaidőszak vége' : 'Következő terhelés'}
                    </div>
                    <div className="mt-0.5 text-[14px] font-semibold text-ink">{billing.nextChargeDate ?? '—'}</div>
                  </div>
                  {billing.subscriptionStatus === 'active' && (
                    <div className="text-right">
                      <div className="text-[11.5px] text-ink-soft">
                        {billing.billingCycle === 'annual' ? 'Éves számlázás' : 'Havi számlázás'}
                      </div>
                      <div className="text-[24px] font-light tracking-[-0.02em] text-ink">
                        {billing.nextChargeAmount}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {(billing.subscriptionStatus === 'trialing' ||
                    billing.subscriptionStatus === 'past_due' ||
                    billing.subscriptionStatus === 'canceled') && (
                    <StripeCheckoutButton
                      cycle={selectedCycle}
                      billFieldsComplete={billFieldsComplete}
                      billDirty={billDirty}
                      onMarkBillTouched={markAllBillTouched}
                    />
                  )}
                  {billing.subscriptionStatus === 'active' && billing.hasStripeCustomer && (
                    <BillingPortalButton variant="button" label="Fizetési mód kezelése" />
                  )}
                  {billing.subscriptionStatus === 'active' && (
                    <CancelSubscriptionButton
                      cancelScheduled={billing.cancelAtPeriodEnd}
                      periodEndLabel={billing.nextChargeDate ?? '—'}
                    />
                  )}
                </div>

                {billing.cancelAtPeriodEnd && billing.nextChargeDate && (
                  <p className="mt-3 text-[12px] text-ink-soft2">
                    Lemondva — {billing.nextChargeDate}-ig minden Pro funkció elérhető.
                  </p>
                )}
              </Card>

              {/* 4. ── Üzletek & díjak */}
              <Card>
                <div className="text-[17px] font-medium text-ink">Üzletek & díjak</div>
                <div className="mt-4 space-y-2">
                  {billingAccount.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-[16px] bg-paper px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-white shadow-dav-card">
                          <Building2 className="h-4 w-4 text-ink-soft" strokeWidth={1.6} />
                        </div>
                        <div>
                          <div className="text-[13.5px] font-semibold text-ink">{item.name}</div>
                          <div className="text-[11.5px] text-ink-soft">
                            {item.type === 'salon' ? 'Szalon' : 'Étterem'}
                            {item.type === 'salon' && item.staffCount > 0 && ` · ${item.staffCount} naptár`}
                            {' · '}{item.tier === 'starter' ? 'Starter' : item.tier === 'egyedi' ? 'Egyedi' : 'Pro'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-semibold text-ink">{ft(item.feeHuf)}</div>
                        <div className="text-[11px] text-ink-soft">lista/hó</div>
                      </div>
                    </div>
                  ))}
                  {billingAccount.items.length === 0 && (
                    <p className="text-sm text-ink-soft">Nincs aktív üzlet a fiókban.</p>
                  )}
                </div>
                {billingAccount.items.length > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                    <div>
                      <div className="text-[13px] font-medium text-ink-soft">
                        {billingAccount.cycle === 'annual'
                          ? `Éves ciklus · ${billingAccount.annualDiscountPct}% kedvezménnyel`
                          : 'Havi ciklus'}
                      </div>
                      {billingAccount.cycle === 'annual' && (
                        <div className="mt-0.5 text-[12px] text-ink-soft2">
                          Lista összeg: {ft(billingAccount.listMonthlyHuf)}/hó
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-light tracking-[-0.02em] text-ink">
                        {ft(billingAccount.totalMonthlyHuf)}
                      </div>
                      <div className="text-[11.5px] text-ink-soft">Ft/hó</div>
                    </div>
                  </div>
                )}
                {startedAt && (
                  <p className="mt-3 text-[12px] text-ink-soft2">
                    Fiók indulása: {fmtDate(startedAt)} · {billingAccount.count} üzlet a fiókban
                  </p>
                )}
              </Card>

              {/* 5. ── Számlák (Számlázz.hu) */}
              <Card>
                <div className="text-[17px] font-medium text-ink">Számlák</div>
                {billing.invoices.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-2">
                    {billing.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-paper px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-white shadow-dav-card">
                            <FileText className="h-4 w-4 text-ink-soft" strokeWidth={1.6} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-semibold text-ink">{inv.invoice_number}</span>
                              {inv.test && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Teszt</span>}
                            </div>
                            <div className="text-[11.5px] text-ink-soft">
                              {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                              {inv.amount_huf ? ` · ${inv.amount_huf.toLocaleString('hu-HU')} Ft` : ''}
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/api/billing/invoice-pdf?id=${inv.id}`}
                          download={`${inv.invoice_number}.pdf`}
                          className="inline-flex items-center gap-1.5 rounded-[12px] border border-line-strong bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-paper"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Letöltés
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[16px] bg-paper px-4 py-8 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] bg-white shadow-dav-card">
                      <FileText className="h-5 w-5 text-ink-soft2" strokeWidth={1.5} />
                    </div>
                    <p className="text-[13px] font-medium text-ink-soft">
                      {billing.subscriptionStatus === 'trialing'
                        ? 'Próbaidőszak alatt nincs kiállított számla.'
                        : 'Még nincs kiállított számla.'}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft2">
                      Az első Pro-számla az előfizetés indítása után érkezik.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Audit-napló ── VALÓS bejegyzések az AuditLog collectionből (üzletre szűrve). */}
          {active === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">Ki mit módosított — visszakövethetően</p>
                <span className="text-[12.5px] font-medium text-ink-soft2">
                  {filteredAudit.length} bejegyzés · utolsó {auditDays} nap
                </span>
              </div>
              <div className="rounded-[26px] dav-card-glass p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {AUDIT_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAuditFilter(f.id)}
                        className={`rounded-[12px] px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                          auditFilter === f.id
                            ? 'bg-ink-dark text-white'
                            : 'border border-line bg-[#FBF9F2] text-ink-soft hover:text-ink'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {/* Dátum-ablak (visszatekintés). A szerver 90 napig ad adatot; itt szűkíthető. */}
                  <div className="flex items-center gap-1 rounded-[13px] border border-line bg-[#FBF9F2] p-1">
                    {AUDIT_DAY_WINDOWS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setAuditDays(d)}
                        className={`rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          auditDays === d ? 'bg-white text-ink shadow-dav-card' : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        {d} nap
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {filteredAudit.length === 0 ? (
                <div className="rounded-[26px] dav-card-glass px-6 py-12 text-center">
                  <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#FBF9F2]">
                    <ScrollText className="h-5 w-5 text-ink-soft2" strokeWidth={1.6} />
                  </span>
                  <p className="text-sm font-medium text-ink-soft">Nincs naplózott esemény ebben az időszakban</p>
                </div>
              ) : (
                <>
                  <div className="rounded-[26px] dav-card-glass px-6 py-2">
                    {visibleAudit.map((e, i) => {
                      const color = AUDIT_ACTION_COLOR[e.action]
                      const Icon = AUDIT_ACTION_ICON[e.action]
                      // Csak az érdemi változások (az üres → üres, pl. null → '' zaj kiesik).
                      const changes = (e.changes ?? []).filter(
                        (c) => auditFormatVal(c.from) !== auditFormatVal(c.to),
                      )
                      return (
                        <div
                          key={e.id}
                          className={`flex gap-3.5 py-4 ${i < visibleAudit.length - 1 ? 'border-b border-line' : ''}`}
                        >
                          <span
                            className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                            style={{ background: `${color}1f` }}
                          >
                            <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} style={{ color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Fő cím: a módosított tevékenység (mi történt) */}
                            <div className="text-[13.5px] font-semibold leading-snug text-ink">
                              {e.summary || AUDIT_ACTION_LABEL[e.action]}
                            </div>
                            {/* Alatta: KI csinálta — félkövér név + email mellette */}
                            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 leading-snug">
                              <b className="text-[12.5px] font-semibold text-ink">{e.actor}</b>
                              {e.actorEmail && e.actorEmail !== e.actor && (
                                <span className="text-[11.5px] font-normal text-ink-soft2">{e.actorEmail}</span>
                              )}
                            </div>
                            {changes.length > 0 && (
                              <div className="mt-1.5 flex flex-col gap-1">
                                {changes.map((c, ci) => (
                                  <div key={ci} className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                                    <span className="font-medium text-ink-soft">{auditFieldLabel(c.field)}:</span>
                                    <span className="rounded-[6px] bg-[#FBF9F2] px-1.5 py-0.5 text-ink-soft2 line-through decoration-ink-soft2/40">
                                      {auditFormatVal(c.from)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 shrink-0 text-ink-soft2" strokeWidth={2} />
                                    <span className="rounded-[6px] bg-[#F0EAD8] px-1.5 py-0.5 font-medium text-ink">
                                      {auditFormatVal(c.to)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="mt-1 text-[11.5px] text-ink-soft2">{relativeTime(e.createdAt)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {filteredAudit.length > auditShown && (
                    <button
                      type="button"
                      onClick={() => setAuditShown((n) => n + 25)}
                      className="mx-auto flex items-center gap-2 rounded-[14px] border border-line bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-soft shadow-dav-card transition-colors hover:text-ink"
                    >
                      További {Math.min(25, filteredAudit.length - auditShown)} megjelenítése
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Telephelyek ── ref 652–667. VALÓS fiók-üzletek + Üzleti-csomag CTA. */}
          {active === 'sites' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">
                  {businessCount} aktív üzlet · {planLabel}
                </p>
                <Link
                  href={variant === 'restaurant' ? '/register-restaurant' : '/register'}
                  className="inline-flex items-center gap-2 rounded-[18px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white"
                >
                  <Plus className="h-[15px] w-[15px] text-gold" strokeWidth={1.8} />
                  Új telephely
                </Link>
              </div>

              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                <div className="py-3 text-[17px] font-medium text-ink">Üzleteid</div>
                {sites.map((s, i) => (
                  <div
                    key={s.name + i}
                    className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 py-[18px] ${
                      i < sites.length - 1 ? 'border-b border-line' : ''
                    }`}
                  >
                    {s.logoUrl ? (
                      // `object-contain` + belső padding, mint az üzletváltó gombnál (StoreSwitcher) —
                      // a logó (gyakran nem négyzetes) így mindig teljesen kifér, nem vágódik le.
                      <img src={s.logoUrl} alt="" className="h-[46px] w-[46px] shrink-0 rounded-[13px] bg-[#f5f5f4] object-contain p-1.5" />
                    ) : (
                      <span
                        className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] text-[15px] font-semibold ${
                          s.gold ? 'bg-[#C9A24B] text-ink-dark' : 'bg-ink-dark text-gold'
                        }`}
                      >
                        {s.initials}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                        {s.current && (
                          <span className="rounded-[7px] bg-[rgba(255,216,95,.22)] px-2 py-0.5 text-[10px] font-semibold text-[#9A7B12]">
                            Jelenlegi
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">{s.meta}</div>
                    </div>
                    <span className="text-[12.5px] font-medium text-ink-soft">{s.role}</span>
                    {s.current ? (
                      <span className="rounded-[13px] border-[1.5px] border-line-strong px-4 py-2 text-[12px] font-semibold text-ink opacity-40 cursor-default">
                        Jelenlegi
                      </span>
                    ) : (
                      <SiteManageButton id={s.id} type={s.type} />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[26px] bg-ink-dark p-6 shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-[15px] font-medium text-white">3+ telephely?</div>
                    <span className="rounded-full bg-gold px-3 py-[5px] text-[10px] font-bold tracking-[0.04em] text-ink-dark">
                      ÜZLETI
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-white/60">
                    Központi irányítópult, telephelyek közti riportok és dedikált account manager.
                  </p>
                </div>
                <Link
                  href={variant === 'restaurant' ? '/restaurant/subscription' : '/dashboard/subscription'}
                  className="whitespace-nowrap rounded-[14px] bg-gold px-5 py-2.5 text-[13px] font-semibold text-ink-dark"
                >
                  Üzleti csomag
                </Link>
              </div>
            </div>
          )}

          </motion.div>
          )}

          {/* ── KÖZÖS lebegő „Mentetlen változások" sáv (Linear/Vercel-minta) ──
              Bárhol van mentetlen módosítás (form-fül / Értesítések / Foglalási szabályok),
              EGYETLEN sticky sáv jelenik meg alul — nincs többé fent/lent szétszórt mentés. */}
          {activeBar && (
            <UnsavedBar
              dirty={activeBar.dirty}
              saved={activeBar.saved}
              saving={saving}
              onSave={activeBar.onSave}
              onCancel={activeBar.onCancel}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── KÖZÖS lebegő mentés-sáv — sticky a panel alján, rugós belépő ─────────── */
function UnsavedBar({
  dirty, saved, saving, onSave, onCancel,
}: {
  dirty: boolean
  saved: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const shown = dirty || saved
  return (
    // Mobilon a lebegő MobileBottomNav (bottom-5 pill) FÖLÉ emeljük; desktopon nincs alsó nav.
    <div className="pointer-events-none sticky bottom-[92px] z-30 mt-6 flex justify-center lg:bottom-6">
      <AnimatePresence>
        {shown && (
          <motion.div
            initial={{ y: 22, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 22, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="pointer-events-auto flex items-center gap-3 rounded-[18px] border border-line bg-white/85 py-2.5 pl-4 pr-2.5 shadow-[0_18px_40px_-20px_rgba(40,35,15,.45)] backdrop-blur-xl"
          >
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2E9E63]">
                <Check className="h-4 w-4" strokeWidth={2.2} /> Mentve
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  Mentetlen változások
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={!dirty || saving}
                    className="rounded-[13px] border-[1.5px] border-line-strong px-4 py-2 text-[13px] font-semibold text-ink transition-opacity disabled:opacity-40"
                  >
                    Mégse
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="flex items-center gap-1.5 rounded-[13px] bg-ink-dark px-5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-70"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />}
                    {saving ? 'Mentés…' : 'Mentés'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Audit-napló — akció-típus szűrő-chipek (a VALÓS adatra szűrnek kliens-oldalon) ── */
const AUDIT_FILTERS: { id: 'all' | 'create' | 'update' | 'delete'; label: string }[] = [
  { id: 'all', label: 'Minden esemény' },
  { id: 'create', label: 'Létrehozás' },
  { id: 'update', label: 'Módosítás' },
  { id: 'delete', label: 'Törlés' },
]
const AUDIT_ACTION_COLOR: Record<'create' | 'update' | 'delete', string> = {
  create: 'var(--dav-ok)',
  update: 'var(--dav-warn)',
  delete: 'var(--dav-bad)',
}
const AUDIT_ACTION_LABEL: Record<'create' | 'update' | 'delete', string> = {
  create: 'létrehozott egy elemet',
  update: 'módosított egy elemet',
  delete: 'törölt egy elemet',
}
const AUDIT_ACTION_ICON: Record<'create' | 'update' | 'delete', typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
}
/** Visszatekintési dátum-ablakok (nap). A 90 a szerver által adott maximum. */
const AUDIT_DAY_WINDOWS: (7 | 30 | 90)[] = [7, 30, 90]

/** Gyakori mezőnevek emberi felirata a diffhez (ismeretlen → maga a mezőnév). */
const AUDIT_FIELD_LABELS: Record<string, string> = {
  status: 'Státusz', date: 'Dátum', start_time: 'Kezdés', end_time: 'Vége', time: 'Időpont',
  pax: 'Létszám', party_size: 'Létszám', customer_name: 'Vendég neve', customer_phone: 'Telefon',
  customer_email: 'Email', notes: 'Megjegyzés', internal_notes: 'Belső jegyzet', role: 'Szerep',
  position: 'Pozíció', pay_rate: 'Bér', pay_type: 'Bér típusa', name: 'Név', email: 'Email',
  phone: 'Telefon', is_birthday: 'Születésnap', tip_eligible: 'Borravaló', weekly_hours: 'Heti óraszám',
  title: 'Megnevezés', price: 'Ár', duration_minutes: 'Ülésidő', source: 'Forrás', address: 'Cím',
  occasion: 'Alkalom', join_date: 'Belépés', birthday: 'Születésnap', bio: 'Megjegyzés', note: 'Jegyzet',
}
function auditFieldLabel(field: string): string {
  return AUDIT_FIELD_LABELS[field] || field
}

/** Diff-érték formázása: bool → Igen/Nem, üres → „—", egyébként szöveg. */
function auditFormatVal(v: string | number | boolean | null): string {
  if (v === true) return 'Igen'
  if (v === false) return 'Nem'
  if (v == null || v === '') return '—'
  return String(v)
}


/** Relatív idő magyarul (pl. „2 órája", „Tegnap", teljes dátum régebbieknél). */
function relativeTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Az imént'
  if (min < 60) return `${min} perce`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} órája`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Tegnap'
  if (days < 7) return `${days} napja`
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}


/* ── Rail gomb ──────────────────────────────────────────────────────────── */
/** Csoport-címke a bal listában (desktopon; mobil chip-soron elrejtve). */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="hidden px-3.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft2 first:pt-1 lg:block">
      {children}
    </div>
  )
}

function RailBtn({
  id, active, onClick, icon: Icon, label, soon, danger, badge, locked,
}: {
  id: RailId
  active: RailId
  onClick: (id: RailId) => void
  icon: typeof Home
  label: string
  soon?: boolean
  danger?: boolean
  badge?: string
  /** Lejárt/megszűnt/szüneteltetett előfizetésnél true minden fülre, KIVÉVE az Előfizetés &
   *  számlázást és a Fiók törlését — lakat-ikonnal jelzett, nem kattintható. */
  locked?: boolean
}) {
  const isActive = active === id
  if (locked) {
    return (
      <span
        aria-disabled
        title="Az előfizetésed lejárt — aktiváld a folytatáshoz"
        className="flex shrink-0 cursor-not-allowed items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] font-medium text-ink/35"
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.5} />
        {label}
        <Lock className="ml-auto h-[15px] w-[15px] shrink-0" strokeWidth={1.6} />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex shrink-0 items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] transition-colors ${
        isActive
          ? 'bg-ink-dark font-semibold text-white'
          : danger
            ? 'font-medium text-bad hover:bg-bad-bg hover:text-bad'
            : 'font-medium text-ink-soft hover:bg-[#F0EDE6] hover:text-ink'
      }`}
    >
      <Icon className={`h-[17px] w-[17px] ${isActive ? 'text-gold' : danger ? 'text-bad' : 'text-ink-soft2'}`} strokeWidth={1.5} />
      {label}
      {badge && !soon && (
        <span className="ml-auto shrink-0 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold leading-none text-ink-dark">
          {badge}
        </span>
      )}
      {soon && (
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-white/15 text-white/80' : 'bg-[#F2ECDA] text-ink-soft'}`}>
          Hamarosan
        </span>
      )}
    </button>
  )
}

function RuleRow({
  title, desc, checked, onChange, last,
}: {
  title: string
  desc: string
  checked: boolean
  onChange: () => void
  last?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-[18px] ${last ? '' : 'border-b border-line'}`}>
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[12.5px] text-ink-soft">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

/* ── Csapat: avatar (monogram vagy meghívó-ikon) ────────────────────────── */
function Avatar({ name, email, pending, gold, avatarUrl }: { name: string; email: string; pending?: boolean; gold?: boolean; avatarUrl?: string | null }) {
  if (pending) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDE7D6]">
        <Mail className="h-[18px] w-[18px] text-ink-soft2" strokeWidth={1.6} />
      </span>
    )
  }
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover object-top" />
  }
  const initials = (name || email).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
        gold ? 'bg-[#C9A24B] text-ink-dark' : 'bg-ink-dark text-gold'
      }`}
    >
      {initials}
    </span>
  )
}

/* ── Csapat: szerep-badge ───────────────────────────────────────────────── */
function RoleBadge({ role, tone, pending }: { role: string; tone: 'owner' | 'manager' | 'staff'; pending?: boolean }) {
  if (pending) {
    return (
      <span className="shrink-0 rounded-[13px] border-[1.5px] border-line-strong px-3.5 py-1.5 text-[12px] font-semibold text-ink-soft">
        {role}
      </span>
    )
  }
  const cls =
    tone === 'owner'
      ? 'bg-ink-dark text-white'
      : 'bg-[#F2ECDA] text-ink-soft'
  return <span className={`shrink-0 rounded-[13px] px-3.5 py-1.5 text-[12px] font-semibold ${cls}`}>{role}</span>
}

/* ── Telephelyek: üzlet-kezelés gomb ────────────────────────────────────── */
function SiteManageButton({ id, type }: { id: string; type: 'salon' | 'restaurant' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/business/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, type }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Váltás sikertelen')
      const dest = (data?.redirectTo ?? (type === 'restaurant' ? '/restaurant' : '/dashboard')) + '/settings'
      router.push(dest)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Váltás sikertelen')
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className="rounded-[13px] border-[1.5px] border-line-strong px-4 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-ink-soft2 hover:bg-paper disabled:opacity-40"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Kezelés'}
    </button>
  )
}
