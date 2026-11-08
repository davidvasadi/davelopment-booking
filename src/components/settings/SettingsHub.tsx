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

import { useRouter, useSearchParams } from 'next/navigation'
import { vatFromTaxNumber } from '@/lib/vatFromTaxNumber'
import { Avatar, Button as KitButton, Card as KitCard, CardTitle, Field, IconButton, Input, Modal, ListRow, Menu, MenuItem, Meta, PageHead, Pagination, Pill, SearchField, Segmented, Select, SheetHandle, SLIDE_SPRING, StatusPill, MarqueeText } from '@/components/ui-kit'
import { AuditTable, NewsletterSettings, NotificationsSettings, type NotifRow, SitesPage, SettingsMobileList, SettingsNav, SettingsPage, SetupProgressCard, SubscriptionPage, TrialChecklist, TeamMembers, type MemberRow, type NewsletterSummary, type SettingsTopic, type SettingsTopicGroup } from '@/components/blocks/settings'
import { auditView } from '@/lib/auditText'
import { hoursRows } from '@/lib/hoursRows'
import { BulkDock, StaffBulkBar } from '@/components/blocks/team'
import { InviteFlow } from '@/components/dashboard/InviteFlow'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PopupModal } from '@/components/ui/popup-modal'
import { ANNUAL_BILLING_UI_ENABLED, applyCycle, businessMonthlyFee, monthlyEmailCapForTier } from '@/lib/tier'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import { SHEET_SPRING } from '@/lib/motion'
import { toast } from 'sonner'
import { SettingsFormContext, type GuestEmailCtl, type SettingsFormApi } from './settingsFormContext'
import { Clock, Bell, Users, CreditCard, MoreHorizontal, ArrowLeft, Search, Settings2, Building2, Mail, Check, FileText, X, Trash2, ShieldCheck, Star, Globe as Globe2, Link2, Landmark, ChevronDown, UserRound, Wallet, PanelsTopLeft, Send, Gift, HandCoins, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import type { FeatureModules } from '@/lib/featureModules'
import type { SelfProfileData } from './SelfProfileView'
import type { CapacityVM } from '@/lib/restaurantCapacity'
import type { DepositSettingsData, InvoiceSettingsData, VoucherSettingsData, ConsentSettingsData } from './PaymentsSettingsPanel'
import { useNotifPrefs, type CategoryKey } from './PersonalNotifPrefsCard'
import { useDevicePush } from './useDevicePush'
import type { AccountBilling } from '@/lib/accountBilling'
import type { Pricing } from '@/lib/pricing'
import { ALL_CAPABILITIES, can, type Capability } from '@/lib/permissions'
import type { RoleRow } from './RolesManager'
import type { OpeningHoursVM } from '@/lib/openingHours'
import type { BookingPageEditorInitial } from '@/components/settings/booking-page/BookingPageEditor'
import type { RoomVM, TableVM } from '@/components/restaurant/TablesView'
import { AddressAutocompleteInput } from '@/components/settings/AddressAutocompleteInput'
import { AttentionSettings } from '@/components/blocks/booking'
import { BusinessQrLauncher } from './BusinessQrLauncher'
import { ReferralPanel } from './ReferralPanel'
import { IntegrationsPanel } from './IntegrationsPanel'
import { GoogleSettingsPanel } from './GoogleSettingsPanel'
import { SelfProfileView } from './SelfProfileView'
import { CapacitySettingsView } from './CapacitySettingsView'
import { IssuedInvoicesTable } from './IssuedInvoicesTable'
import { PaymentsSettingsPanel } from './PaymentsSettingsPanel'
import { RolesManager } from './RolesManager'
import { OpeningHoursView } from './OpeningHoursView'
import { TablesView } from '@/components/restaurant/TablesView'
import { BookingPageEditor } from '@/components/settings/booking-page/BookingPageEditor'
import { useAppendPages } from '@/lib/useAppendPages'
import { LoadMoreSentinel } from '@/components/shared/LoadMoreSentinel'

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
type RailId =
  | 'site' | 'newsletter' | 'vouchers' | 'invoicing' | 'deposit' | 'email'
  | 'notifications' | 'team' | 'audit'
  | 'self' | 'documents' | 'billing' | 'invoices' | 'sites'
  | 'integrations' | 'danger' | 'payments' | 'google' | 'reviews' | 'rules' | 'tables' | 'hours'

// A bal lista mely elemei a MEGLÉVŐ profil-form egy-egy fülét mutatják (rail vezérli a fület).
const FORM_TABS: Record<string, string> = {
  email: 'email', documents: 'documents', danger: 'danger',
  // 'import' removed — import moved to Integrations panel
}

// A kiválasztott szekció neve = a tartalom címe (mivel nincs felső fül-sor, ez jelzi „hol vagy").
const RAIL_LABELS: Record<RailId, string> = {
  site: 'Foglalóoldal', newsletter: 'Hírlevél', vouchers: 'Ajándékutalvány', invoicing: 'Számlázás', deposit: 'Előleg',
  email: 'Vendég e-mailek',
  notifications: 'Értesítések', team: 'Csapat & jogok', audit: 'Audit-napló',
  self: 'Saját profil', documents: 'Dokumentumok & jogi', billing: 'Előfizetés', invoices: 'Számlák', sites: 'Telephelyek',
  integrations: 'API & integrációk', danger: 'Fiók törlése',
  payments: 'Fizetés & számlázás', google: 'Google Cégprofil', reviews: 'Értékelések', rules: 'Foglalási szabályok', tables: 'Asztalok & termek', hours: 'Nyitvatartás',
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
  /** a mentett fizetési mód a Stripe-tól ÉLŐBEN (nálunk nincs tárolva) — márka, utolsó 4, lejárat */
  card?: { brand: string; last4: string; expiry: string } | null
  /** e havi felhasználás (16.5): hírlevél-keret, foglalható munkatársak (étteremnél nincs) */
  usage?: { emailsUsed: number; emailCap: number; staff?: number; staffIncluded?: number; /** az elmúlt hónapok hírlevelei (lib/fastRead) */ emailHistory?: { ym: string; n: number }[] }
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
  /** a legutóbbi belépés (ISO) — design 16.2 „Utolsó belépés” */
  lastLogin?: string | null
  /** a fiókhoz kötött munkatárs-profil neve (szalon: foglalható profil); nincs = nem foglalható */
  staffName?: string | null
  /** függő meghívónál: mikor küldték (ISO) */
  invitedAt?: string | null
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
  team?: number                    // csapat létszáma (szalon: aktív munkatárs, étterem: aktív tag)
  monthBookings?: number           // e havi foglalások
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
  actorImg?: string | null         // a végrehajtó profilképe (Users.avatar_url)
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
  /** Az üzlet neve + városa — a Google-keresés előre-kitöltéséhez (GooglePlacePicker), hogy a
   *  tulajnak ne kelljen begépelnie azt, amit a rendszer már amúgy is tud róla. */
  businessName: string
  businessCity?: string | null
  /** VALÓS mentés végpont: `/api/salons/${id}` vagy `/api/restaurants/${id}`. */
  apiBase: string
  /** Értesítési preferenciák kezdőértéke (a betöltött üzlet `notification_prefs`-e). */
  notificationPrefs: NotificationPrefs
  /** Foglalási-szabály kapcsolók kezdőértéke (a betöltött üzlet `booking_rules`-a). */
  /** Foglalási funkciók (`feature_modules`) kezdőérték — a Google panelnek. */
  featureModules: FeatureModules
  profilePanel: ReactNode          // a MEGLÉVŐ settings-form (Üzlet profil)
  /** Beállítások → Foglalóoldal élő szerkesztő kezdőadatai (csak szalonnál). Ha meg van adva,
   *  az ÚJ menüszerkezet él (Üzlet / Vendégek / Pénzügy / Kapcsolatok / Csapat / Fiók). */
  bookingPageEditor?: BookingPageEditorInitial
  /** `notify_new_bookings` — az új menüben az Értesítések fülön állítható. */
  notifyNewBookings?: boolean
  selfProfile?: SelfProfileData    // „Saját profil" (16.17) — a bejelentkezett user adatai
  /** étterem: Asztalok & termek / Foglalási szabályok (design 16.22, 16.21) */
  capacity?: CapacityVM
  /** Asztalok & termek (étterem, design 16.22): a termek, asztalok, sablonok a szerkesztőhöz (a külön Asztalok oldal helyett) */
  tablesData?: { rooms: RoomVM[]; tables: TableVM[]; templates: { id: string; label: string; rooms: number; turn: number }[]; canManage: boolean }
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
  /** Csapat & jogok › Szerepek (16.3): az üzlet szerepei és hogy a néző szerkesztheti-e (owner-only) */
  rolesData?: { initial: RoleRow[]; isOwner: boolean }
  /** Nyitvatartás (16.8): a heti rend, a kivételek és a foglaltság — és hogy szerkesztheti-e */
  hoursVM?: OpeningHoursVM
  /** Dokumentumok (16.12): hány foglalásnál fogadták el a nyilatkozatot, ebből helyszínen */
  consentStats?: { total: number; onsite: number }
  hoursCanManage?: boolean
  /** Egyedi szerepek (id + név) — a meghívó/tag-szerep legördülőhöz. */
  customRoles?: { id: string; name: string; desc?: string }[]
  /** a meghíváshoz (közös InviteFlow): fiókhoz még nem kötött munkatárs-profilok, foglalható létszám, extra díj */
  inviteSetup?: { freeStaff: { id: string; name: string }[]; bookable: number; extraFee?: { fee: number; included: number } }
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

/** relatív idő a tag-listához: „most”, „ma 09:12”, „tegnap”, „3 napja”, „2 hete”, „2 hónapja” */
function relWhen(iso: string): string {
  const d = new Date(iso); const now = new Date()
  const min = (now.getTime() - d.getTime()) / 60_000
  if (min < 5) return 'most'
  const day0 = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day0(now) - day0(d)) / 86_400_000)
  if (days === 0) return `ma ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (days === 1) return 'tegnap'
  if (days < 14) return `${days} napja`
  if (days < 60) return `${Math.round(days / 7)} hete`
  return `${Math.round(days / 30)} hónapja`
}

export function SettingsHub({
  variant, subtitle, availabilityHref, businessName, businessCity, profilePanel, selfProfile, capacity, tablesData, senderLabel, billing,
  team, sites, businessCount, planLabel, apiBase, notificationPrefs,
  featureModules, auditLog, rolesData, customRoles = [], inviteSetup, hoursVM, hoursCanManage = false, consentStats,
  billingAccount, pricing, activeBusinessId, startedAt,
  icalUrl, bookingUrl, embedUrl, embedSmartSnippet, webhookUrl, ga4Id, facebookPixelId, myCapabilities,
  depositSettings, invoiceSettings, voucherSettings, consentSettings, stripeConnectAccountId, stripeConnectOnboarded,
  businessTier,
  supportedLocales,
  bookingPageEditor,
  notifyNewBookings = true,
}: SettingsHubProps) {
  // A régi Üzlet profil / Foglalás / Nyelvek fülek tartalma a Foglalóoldal-szerkesztőbe
  // költözött — a régi mély-linkjeik (onboarding, súgó, SetupNudge) a Foglalóoldalt nyitják.
  const MOVED_TO_SITE = new Set(['profile', 'booking', 'languages'])
  const router = useRouter()
  // Mély-link: a ?tab=… query kezdő-fület állít (pl. az avatar-popover / áttekintés a „self"-re nyit).
  // Jogosulatlan tab (pl. ?tab=billing manager-nek) → visszaesik profile-ra.
  const searchParams = useSearchParams()
  const initialTab = ((): RailId => {
    // régi fülek → összevont helyük (mély-linkek, pl. az utalvány-ablak „Számlázó beállítása” linkje)
    const rawT = searchParams.get('tab')
    const t = rawT === 'invoicing' ? 'payments' : rawT
    const limitedOnly = !!myCapabilities && !can(myCapabilities, 'settings.profile')
    // a Beállítások kezdő témája: a Nyitvatartás (a Foglalóoldal-szerkesztő teljes képernyős, oda csak kattintásra / linkkel megyünk)
    const home: RailId = limitedOnly ? 'self' : hoursVM ? 'hours' : 'site'
    // `settings.own_profile` jogú tagnak a Saját profil; régi (a Foglalóoldalba költözött) fülek linkje a szerkesztőbe visz.
    if (!t || !(t in RAIL_LABELS) && !MOVED_TO_SITE.has(t)) return home
    if (MOVED_TO_SITE.has(t)) return 'site'
    if (t === 'billing' && myCapabilities && !can(myCapabilities, 'billing.manage')) return home
    if ((t === 'invoices' || t === 'payments' || t === 'deposit' || t === 'vouchers' || t === 'newsletter') && myCapabilities && !can(myCapabilities, 'payments.manage')) return home
    if ((t === 'rules' || t === 'tables') && (variant !== 'restaurant' || !capacity)) return home
    if (t === 'hours' && !hoursVM) return home
    if (t === 'danger' && myCapabilities && !can(myCapabilities, 'danger')) return home
    // Jogosulatlan tab URL-ből → visszaesik self-re.
    if (limitedOnly && t !== 'self') return 'self'
    // Lejárt/megszűnt/szüneteltetett előfizetésnél egy mély-linkelt (?tab=...) tiltott fül is
    // a billingre esik vissza — a nav-lakatok csak a KATTINTÁST védik, ez a közvetlen URL-t.
    // A Számlák kivétel (a billinghez hasonlóan) — a korábbi számlák lezárt/lejárt előfizetés
    // mellett is elérhetők kell maradjanak (könyvelési igény, nem a fizetés rendezése).
    const lockedNow = billing.subscriptionStatus === 'past_due' || billing.subscriptionStatus === 'canceled' || billing.subscriptionStatus === 'paused'
    if (lockedNow && t !== 'billing' && t !== 'invoices' && t !== 'danger') return 'billing'
    return t as RailId
  })()
  const [active, setActive] = useState<RailId>(initialTab)
  // a Foglalóoldal-szerkesztő teljes képernyőn nyílik — kilépéskor az előző témára térünk vissza
  const lastTopic = useRef<RailId>(initialTab === 'site' ? 'hours' : initialTab)
  useEffect(() => { if (active !== 'site') lastTopic.current = active }, [active])
  // teljes szélességű témák (design 16.6: a Vendég e-mailek a kampány-szerkesztő felépítésével) — a bal lista helyett felül
  // visszalépés az előző témára
  const fullWidth = active === 'email'
  const lastTab = useRef<RailId>(initialTab === 'email' ? 'site' : initialTab)
  useEffect(() => { if (active !== 'email') lastTab.current = active }, [active])
  // Fülváltás (desktop): a panel oldalra csúszik, mint a jóváhagyó popup lapozása (SlideSwap) — lefelé lépve jobbról,
  // felfelé balról érkezik. Nem mountol újra (a profil-form mentetlen mezői megmaradnak), csak a burkoló mozog.
  const panelRef = useRef<HTMLDivElement>(null)
  const navOrderRef = useRef<string[]>([])
  const prevActive = useRef(active)
  useEffect(() => {
    const prev = prevActive.current
    prevActive.current = active
    const el = panelRef.current
    if (prev === active || !el || !window.matchMedia('(min-width: 1024px)').matches) return
    const order = navOrderRef.current
    const dir = order.indexOf(active) < order.indexOf(prev) ? -1 : 1
    animate(el, { x: [dir * 56, 0] }, SLIDE_SPRING)
    animate(el, { opacity: [0, 1] }, { duration: 0.2, ease: 'easeOut' })
  }, [active])
  // Az Értesítések fül alján a tulajnak szóló „Értesítő” e-mail sablonja (profil-form).
  // A bal-sáv alapból NYITVA van a Foglalóoldal fülön is — csak akkor csukódik ikon-csíkra
  // (nagyobb szerkesztő-ablak), ha a user kézzel rákattint az össze-csukó gombra; a kézi
  // csukás csak addig tart, amíg el nem hagyja a fület (akkor újra nyitva kezd).
  const [railManuallyCollapsed, setRailManuallyCollapsed] = useState(false)
  useEffect(() => { if (active !== 'site') setRailManuallyCollapsed(false) }, [active])
  const railCollapsed = active === 'site' && railManuallyCollapsed
  // A "link"-típusú rail-elemek (pl. Nyitvatartás) saját, RailBtn-en kívüli címke-animációja —
  // ugyanaz a zsugorodó max-width+opacity minta, mint a RailBtn-ben.
  const [saving, setSaving] = useState(false)
  // mobil (design 16.20): az első képernyő a téma-lista; egy témára koppintva a lapja alulról felcsúszik (`mobileSheet`).
  // Mély-linkkel (?tab=…) érkezve rögtön a téma lapja nyílik.
  const [mobileSheet, setMobileSheet] = useState(() => !!searchParams.get('tab'))
  // mobil: a téma lapja ugyanazzal a rugós (bounce) nyitással jön fel, mint minden más mobil lap (SHEET_MOBILE / SHEET_SPRING)
  useEffect(() => {
    const el = panelRef.current
    if (!mobileSheet || !el || window.matchMedia('(min-width: 1024px)').matches) return
    animate(el, { opacity: [0, 1], y: [70, 0], scale: [0.86, 1] }, SHEET_SPRING)
  }, [mobileSheet])
  // ugyanazon az oldalon maradó navigáció (pl. a menü Nyitvatartás → Beállítások linkje): a komponens nem töltődik újra,
  // ezért a ?tab változását követjük — tab nélkül a téma-lista jön (mobilon), tabbal az adott téma
  const tabParam = searchParams.get('tab')
  const firstTab = useRef(true)
  useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return }
    if (tabParam) { setActive(initialTab); setMobileSheet(true) } else setMobileSheet(false)
  }, [tabParam]) // eslint-disable-line react-hooks/exhaustive-deps
  const [navQuery, setNavQuery] = useState('')
  // mobil: a téma-lista keresője a fejléc kereső-ikonjáról nyílik (DashboardNav › davelopment:open-settings-search)
  const [mobileSearch, setMobileSearch] = useState(false)
  // mobil Audit-napló (teljes oldal, mint a Számlák): a fejléc ikonjai nyitják / csukják a keresőt és a szűrőket
  const [auditMSearch, setAuditMSearch] = useState(false)
  const [auditMFilters, setAuditMFilters] = useState(false)
  useEffect(() => {
    const on = () => { setMobileSheet(false); setMobileSearch((v) => { if (v) setNavQuery(''); return !v }) }
    window.addEventListener('davelopment:open-settings-search', on)
    return () => window.removeEventListener('davelopment:open-settings-search', on)
  }, [])
  useEffect(() => {
    const a = () => setAuditMSearch((v) => { if (v) setAuditQuery(''); return !v }), b = () => setAuditMFilters((v) => !v)
    window.addEventListener('davelopment:audit-search', a); window.addEventListener('davelopment:audit-filter', b)
    return () => { window.removeEventListener('davelopment:audit-search', a); window.removeEventListener('davelopment:audit-filter', b) }
  }, [])
  // a mobil fejléc szűrő-ikonja (DashboardNav): a téma-listán a csoport-szűrő lapot nyitja (melyik csoport látszódjon);
  // ha egy téma lapja van nyitva, előbb arról visz vissza a listára
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [groupSheet, setGroupSheet] = useState(false)
  const mobileSheetRef = useRef(mobileSheet)
  mobileSheetRef.current = mobileSheet
  useEffect(() => {
    const handler = () => { if (mobileSheetRef.current) setMobileSheet(false); else setGroupSheet(true) }
    window.addEventListener('davelopment:open-settings-nav', handler)
    return () => window.removeEventListener('davelopment:open-settings-nav', handler)
  }, [])

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
  // Előfizetés (16.5): a műveletek (csomagváltás, fizetés indítása, ügyfélportál, lemondás) és az ablakok
  const [subBusy, setSubBusy] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [billOpen, setBillOpen] = useState(false)
  // Hírlevél (16.13): az összesítő csak a fül megnyitásakor
  const [newsSummary, setNewsSummary] = useState<NewsletterSummary | null>(null)
  useEffect(() => {
    if (active !== 'newsletter' || newsSummary || !activeBusinessId) return
    fetch(`/api/marketing/summary?kind=${variant}&businessId=${activeBusinessId}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && !j.error) setNewsSummary(j) }).catch(() => {})
  }, [active, newsSummary, activeBusinessId, variant])
  // a mentett kártya a Stripe-tól élőben — csak az Előfizetés fül megnyitásakor (külső hívás)
  const [stripeCard, setStripeCard] = useState<BillingData['card'] | undefined>(undefined)
  useEffect(() => {
    if (active !== 'billing' || stripeCard !== undefined || !billing.hasStripeCustomer) return
    fetch('/api/billing/card', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j) => setStripeCard(j?.card ?? null)).catch(() => setStripeCard(null))
  }, [active, stripeCard, billing.hasStripeCustomer])

  const [billDetails, setBillDetails] = useState({
    legalName: billing.legalName,
    taxNumber: billing.taxNumber,
    companyRegNumber: billing.companyRegNumber,
    billingEmail: billing.billingEmail,
    billingPostalCode: billing.billingPostalCode,
    billingCity: billing.billingCity,
    billingStreet: billing.billingStreet,
  })
  // ki fizet — a mentett adatokból: cégjegyzékszám → cég, adószám → egyéni vállalkozó, különben magánszemély
  const [payerKind, setPayerKind] = useState<'person' | 'sole' | 'company'>(billing.companyRegNumber ? 'company' : billing.taxNumber ? 'sole' : 'person')
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
  const paymentsTabPanel = usePanelRegistration()
  const documentsPanel = usePanelRegistration()
  const integPanel = usePanelRegistration()
  const googlePanel = usePanelRegistration()
  const sitePanel = usePanelRegistration()
  const vouchersPanel = usePanelRegistration()
  const invoicingPanel = usePanelRegistration()
  const depositPanel = usePanelRegistration()
  const capacityPanel = usePanelRegistration()
  const selfPanel = usePanelRegistration()

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

  // ── Belső (nem-vendég) email-preferenciák — a bejelentkezett user SAJÁT
  //    `personal_notif_prefs.bookings_email`/`schedule_email`-je (owner VAGY staff nézetben is).
  //    Külön a lenti `notif`-tól, ami az ÜZLET vendég-emailjeit (notification_prefs) kezeli.
  const internalEmailPrefs = useNotifPrefs()
  const devicePush = useDevicePush()
  const [testBusy, setTestBusy] = useState(false)

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

  // Sorok a vendég-emailekhez (mind a kettő modulban ugyanaz).

  // ── Audit-napló szűrő — kliens-oldali szűrés a VALÓS bejegyzéseken (akció-típus + dátum-ablak).
  // A szerver a visszatekintési ablakon (90 nap) belüli sorokat adja; itt tovább szűkíthető.
  const [auditFilter, setAuditFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all')
  const [auditDays, setAuditDays] = useState<7 | 30 | 90>(90)
  const [auditQuery, setAuditQuery] = useState('')
  const filteredAudit = useMemo(() => {
    const cutoff = Date.now() - auditDays * 86_400_000
    const q = auditQuery.trim().toLowerCase()
    return auditLog.filter(
      (e) =>
        (auditFilter === 'all' || e.action === auditFilter) &&
        new Date(e.createdAt).getTime() >= cutoff &&
        (!q || `${e.summary ?? ''} ${e.actor} ${e.actorEmail ?? ''}`.toLowerCase().includes(q)),
    )
  }, [auditFilter, auditDays, auditLog, auditQuery])
  // Audit-napló: lapozás + görgetésre hozzáfűzés (szűrő / keresés / időszak váltásakor az elejéről)
  const auditPaging = useAppendPages(filteredAudit.length, AUDIT_PAGE, `${auditFilter}|${auditDays}|${auditQuery}`)

  // ── Csapat & jogok — VALÓS bekötés a /api/team végpontokra.
  // RolesManager custom event-tel jelzi ha változott a lista → azonnal frissül a meghívó dropdown.
  const [liveRoles, setLiveRoles] = useState<{ id: string; name: string; desc?: string }[]>(customRoles)
  useEffect(() => {
    const handler = (e: Event) => {
      const roles = (e as CustomEvent<{ id: string; name: string }[]>).detail
      setLiveRoles((cur) => roles.map((r) => ({ ...r, desc: cur.find((x) => x.id === r.id)?.desc })))
    }
    window.addEventListener('davelopment:roles-changed', handler)
    return () => window.removeEventListener('davelopment:roles-changed', handler)
  }, [])

  const [inviteOpen, setInviteOpen] = useState(false)
  // Csapat & jogok (design 16.2 / 16.3): Tagok / Szerepek váltó
  const [teamSubTab, setTeamSubTab] = useState<'members' | 'roles'>('members')
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  // a sorok szerep- és ⋯ menüje, a kijelölés (tömeges sáv), a törlés / visszavonás megerősítése
  const [teamMenu, setTeamMenu] = useState<{ id: string; kind: 'role' | 'more' } | null>(null)
  const [teamSel, setTeamSel] = useState<string[]>([])
  const [teamConfirm, setTeamConfirm] = useState<{ ids: string[]; title: string; label: string } | null>(null)
  const resendInvite = async (id: string) => {
    const r = await fetch(`/api/team/members/${id}/resend`, { method: 'POST', credentials: 'include' }).catch(() => null)
    if (r?.ok) toast.success('Meghívó újraküldve'); else toast.error('Az újraküldés nem sikerült')
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

  const removeMembers = async (ids: string[]) => {
    const results = await Promise.allSettled(ids.map((id) => fetch(`/api/team/members/${id}`, { method: 'DELETE', credentials: 'include' }).then((r) => { if (!r.ok) throw new Error() })))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast.error(`${failed} tag eltávolítása nem sikerült`)
    else toast.success(ids.length > 1 ? `${ids.length} tag eltávolítva` : 'Eltávolítva')
    setTeamSel([]); setTeamConfirm(null); router.refresh()
  }

  // Státusz-váltás a lenyíló menüből — a Munkatárs-adatlap (HiringView) státusz-menüjével AZONOS.
  // A route a membership.status-t állítja ÉS a párosított staff.is_active-ot is szinkronizálja.
  const setMemberStatus = async (id: string, status: 'active' | 'suspended') => {
    setTeamMenu(null)
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
  // A sáv csak akkor rejti el a "Mentve"-t, ha a `dirty` ténylegesen hamisra váltott — a
  // `router.refresh()` aszinkron, enélkül a sáv visszavillanna "Mentetlen változások"-ra, amíg a
  // frissített szerver-props meg nem érkeznek (ez okozta a jelentett hibát).
  useEffect(() => {
    if (formSaved && !formDirty) {
      const t = setTimeout(() => setFormSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [formSaved, formDirty])

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
      const ok = await integPanel.apiRef.current?.save()
      if (ok !== false) { router.refresh(); setIntegSaved(true) }
    } finally {
      setSaving(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (integSaved && !integPanel.dirty) {
      const t = setTimeout(() => setIntegSaved(false), 1200)
      return () => clearTimeout(t)
    }
  }, [integSaved, integPanel.dirty])

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

  // A „Foglalóoldal" szerkesztő — saját vázlat és saját Közzététel-sáv (teljes képernyőn), a hub sávja nem kell.

  // Az új menü önálló Pénzügy/Vendégek panelei — mindegyik a saját API-jával ment.
  const [splitSaved, setSplitSaved] = useState(false)
  const splitPanel = active === 'vouchers' ? vouchersPanel : active === 'invoicing' ? invoicingPanel : active === 'deposit' ? depositPanel : active === 'self' ? selfPanel : active === 'rules' ? capacityPanel : null
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
  // Ugyanígy az Értesítések: a kapcsolók + a tulajnak szóló Értesítő sablon.
  // a Vendég e-mailek (16.6) emlékeztető- és visszajelzés-beállításai (a `feature_modules`-ban) — a TELJES csoportot
  // küldjük vissza, különben a nem szerkesztett mezők (várólista, Google stb.) lenullázódnának
  const fmBase = useMemo(() => ({ reminders_on: !!featureModules.reminders_on, reviews_on: !!featureModules.reviews_on, reminder_t_48h: !!featureModules.reminder_t_48h, reminder_t_24h: !!featureModules.reminder_t_24h, reminder_t_3h: !!featureModules.reminder_t_3h, reminder_t_1h: !!featureModules.reminder_t_1h, reminder_ch_email: !!featureModules.reminder_ch_email, reminder_ch_push: !!featureModules.reminder_ch_push }), [featureModules])
  const [emailFm, setEmailFm] = useState(fmBase)
  const emailFmDirty = JSON.stringify(emailFm) !== JSON.stringify(fmBase)
  const saveGuestEmailTab = async () => {
    if (notifDirty) await saveNotif()
    if (emailFmDirty && await patchGroup({ feature_modules: { ...featureModules, ...emailFm } })) router.refresh()
    if (formDirty) await saveForm()
  }
  const guestEmail: GuestEmailCtl = {
    on: { confirm: notif.confirm.email, cancel: notif.cancel.email, modification: notif.modification.email, reminder: emailFm.reminders_on, feedback: emailFm.reviews_on },
    setOn: (k, on) => {
      if (k === 'reminder') setEmailFm((f) => ({ ...f, reminders_on: on }))
      else if (k === 'feedback') setEmailFm((f) => ({ ...f, reviews_on: on }))
      else setNotif((n) => ({ ...n, [k]: { email: on } }))
    },
    reminder: { t48: emailFm.reminder_t_48h, t24: emailFm.reminder_t_24h, t3: emailFm.reminder_t_3h, t1: emailFm.reminder_t_1h, email: emailFm.reminder_ch_email, push: emailFm.reminder_ch_push },
    setReminder: (p) => setEmailFm((f) => ({
      ...f,
      ...(p.t48 !== undefined ? { reminder_t_48h: p.t48 } : {}), ...(p.t24 !== undefined ? { reminder_t_24h: p.t24 } : {}),
      ...(p.t3 !== undefined ? { reminder_t_3h: p.t3 } : {}), ...(p.t1 !== undefined ? { reminder_t_1h: p.t1 } : {}),
      ...(p.email !== undefined ? { reminder_ch_email: p.email } : {}), ...(p.push !== undefined ? { reminder_ch_push: p.push } : {}),
    })),
    feedbackDelayHours: featureModules.review_delay_hours ?? null,
    save: () => void saveGuestEmailTab(), saving, dirty: formDirty || notifDirty || emailFmDirty,
  }

  const activeBar =
    splitPanel
      ? { dirty: splitPanel.dirty, saved: splitSaved, onSave: saveSplitTab, onCancel: () => splitPanel.apiRef.current?.discard() }
      : active === 'email' || active === 'notifications'
      ? { dirty: formDirty || notifDirty || emailFmDirty, saved: formSaved || notifSaved, onSave: saveGuestEmailTab, onCancel: () => { formApiRef.current?.discard(); resetNotif(); setEmailFm(fmBase) } }
      // a Foglalóoldal-szerkesztőnek saját Közzététel-sávja van (teljes képernyőn)
      : active === 'site'
      ? null
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
          dirty: integPanel.dirty,
          saved: integSaved,
          onSave: saveIntegrationsTab,
          onCancel: () => integPanel.apiRef.current?.discard(),
        }
      : active === 'google' || active === 'reviews'
      ? { dirty: googlePanel.dirty, saved: googleSaved, onSave: saveGoogleTab, onCancel: () => googlePanel.apiRef.current?.discard() }
      : active in FORM_TABS
      ? { dirty: formDirty, saved: formSaved, onSave: saveForm, onCancel: () => formApiRef.current?.discard() }
      : null

  // ── Navigáció adatvezérelten (a desktop rail ÉS a mobil legördülő EGY forrásból) ──
  type NavEntry =
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
  const selectTier = async (tier: 'starter' | 'pro') => {
    if (!activeBizForPricing || subBusy) return
    setSubBusy(tier)
    try {
      const res = await fetch('/api/subscription/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: activeBizForPricing.type, id: activeBizForPricing.id, tier, cycle: selectedCycle }) })
      const data = (await res.json().catch(() => ({}))) as { error?: string; cancelReversed?: boolean }
      if (!res.ok) throw new Error(data.error || 'Nem sikerült menteni.')
      toast.success(data.cancelReversed ? 'Az előfizetés visszaállt — a lemondás törölve' : `${tier === 'starter' ? 'Starter' : 'Pro'} csomag kiválasztva`)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült menteni.') } finally { setSubBusy(null) }
  }
  // fizetés indítása a Stripe oldalán — előtte a számlázási adatok kötelezők (hiányosnál megnyílik az ablak)
  const startCheckout = async () => {
    if (!billFieldsComplete) { markAllBillTouched(); setBillOpen(true); toast.error('Töltsd ki a számlázási adatokat a fizetés előtt.'); return }
    setSubBusy('checkout')
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ cycle: selectedCycle, returnPath: `${window.location.pathname}?tab=billing` }) })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Nem sikerült elindítani a fizetést.')
      window.location.href = data.url
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hiba történt a fizetés indításakor.'); setSubBusy(null) }
  }
  // a Stripe ügyfélportálja: kártya csere, számlák, fizetési adatok — a kártya a Stripe-nál marad
  const openPortal = async () => {
    setSubBusy('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ returnPath: `${window.location.pathname}?tab=billing` }) })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Nem sikerült megnyitni.')
      window.location.href = data.url
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült megnyitni.'); setSubBusy(null) }
  }
  const cancelSub = async (undo: boolean) => {
    setSubBusy('cancel')
    const res = await fetch('/api/subscription/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ undo }) }).catch(() => null)
    setSubBusy(null)
    if (!res?.ok) { toast.error((await res?.json().catch(() => null))?.error ?? 'A művelet nem sikerült. Próbáld újra.'); return }
    setCancelOpen(false)
    toast.success(undo ? 'A lemondás visszavonva' : 'Lemondva — a fizetett időszak végéig minden elérhető')
    router.refresh()
  }

  // a téma-lista a design 16.1 szerint (csoportok, sorrend, ikonok); étteremnél az Üzletben az Asztalok & termek és a
  // Foglalási szabályok is
  const navGroups: { group: string; items: NavEntry[] }[] = canFullSettings
    ? [
        { group: 'Üzlet', items: [
          { kind: 'btn', id: 'site', icon: PanelsTopLeft, label: 'Foglalóoldal' },
          ...(hoursVM ? [{ kind: 'btn' as const, id: 'hours' as RailId, icon: Clock, label: 'Nyitvatartás' }] : [{ kind: 'link' as const, href: availabilityHref, icon: Clock, label: 'Nyitvatartás' }]),
          ...(variant === 'restaurant' ? [
            { kind: 'btn' as const, id: 'tables' as RailId, icon: Building2, label: 'Asztalok & termek' },
            { kind: 'btn' as const, id: 'rules' as RailId, icon: ShieldCheck, label: 'Foglalási szabályok' },
          ] : []),
          { kind: 'btn', id: 'documents', icon: FileText, label: 'Dokumentumok & jogi' },
        ] },
        { group: 'Vendégek', items: [
          { kind: 'btn', id: 'email', icon: Mail, label: 'Vendég e-mailek' },
          ...(canPayments ? [{ kind: 'btn' as const, id: 'newsletter' as RailId, icon: Send, label: 'Hírlevél' }] : []),
        ] },
        ...(canPayments
          ? [{ group: 'Pénzügy', items: [
              { kind: 'btn' as const, id: 'payments' as RailId, icon: Wallet, label: 'Fizetés & számlázás' },
              { kind: 'btn' as const, id: 'invoices' as RailId, icon: FileText, label: 'Számlák' },
              { kind: 'btn' as const, id: 'deposit' as RailId, icon: HandCoins, label: 'Előleg' },
              { kind: 'btn' as const, id: 'vouchers' as RailId, icon: Gift, label: 'Ajándékutalvány' },
            ] }]
          : []),
        { group: 'Kapcsolatok', items: [
          { kind: 'btn', id: 'reviews', icon: Star, label: 'Értékelések' },
          { kind: 'btn', id: 'google', icon: Globe2, label: 'Google Cégprofil' },
          { kind: 'btn', id: 'integrations', icon: Link2, label: 'API & integrációk' },
        ] },
        { group: 'Csapat', items: [
          { kind: 'btn', id: 'team', icon: Users, label: 'Csapat & jogok' },
          { kind: 'btn', id: 'sites', icon: Landmark, label: 'Telephelyek' },
        ] },
        { group: 'Fiók', items: [
          { kind: 'btn', id: 'self', icon: UserRound, label: 'Saját profil' },
          { kind: 'btn', id: 'notifications', icon: Bell, label: 'Értesítések' },
          ...(canBilling ? [{ kind: 'btn' as const, id: 'billing' as RailId, icon: CreditCard, label: 'Előfizetés', badge: trialBadge }] : []),
          { kind: 'btn', id: 'audit', icon: FileText, label: 'Audit-napló' },
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
  navOrderRef.current = [...navGroups.flatMap((g) => g.items.flatMap((it) => (it.kind === 'btn' ? [it.id as string] : []))), 'danger']

  // „Beállítás kész” (design 16.1): a valós állapotból számolt lépések — a hiányzók a kártyán, és sárga pötty a témájuk
  // mellett a listában
  const setupSteps: { label: string; tab: RailId; done: boolean }[] = canFullSettings ? [
    { label: 'Foglalóoldal: logó, borító, bemutatkozás', tab: 'site', done: !bookingPageEditor || (!!bookingPageEditor.logoUrl && !!bookingPageEditor.coverUrl && !!bookingPageEditor.description?.trim()) },
    ...(canPayments ? [
      { label: 'Stripe összekötése', tab: 'payments' as RailId, done: !!stripeConnectOnboarded },
      { label: 'Számlázó bekötése', tab: 'payments' as RailId, done: invoiceSettings.provider !== 'none' && (invoiceSettings.hasSzamlazzKey || invoiceSettings.hasBillingoKey) },
    ] : []),
    { label: 'Google értékelés-link', tab: 'reviews', done: !!featureModules?.google_review_url?.trim() },
    { label: 'Csapat meghívása', tab: 'team', done: team.length > 1 },
  ] : []
  const setupMissing = setupSteps.filter((x) => !x.done)
  const setupPct = setupSteps.length ? Math.round(((setupSteps.length - setupMissing.length) / setupSteps.length) * 100) : 100
  const todoTabs = new Set(setupMissing.map((x) => x.tab))

  // a téma-lista (desktop kártya és mobil lap ugyanaz): csoportonként, a keresés szűri, zárolt előfizetésnél lakat
  const navNorm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  // mobilon teljes oldalként nyíló témák (a sok soros listák — kereső és szűrők a fejlécben)
  const pageTopic = active === 'invoices' || active === 'audit'
  const openTopic = (id: RailId) => { setActive(id); setMobileSheet(true) }
  // a téma-lista adatai (desktop SettingsNav és mobil SettingsMobileList ugyanebből): a keresés szűri, teendőnél pötty,
  // lejárt előfizetésnél lakat (az Előfizetés kivétel)
  const topicGroups: SettingsTopicGroup[] = (() => {
    const q = navNorm(navQuery.trim())
    return navGroups.map((g) => ({
      group: g.group,
      items: g.items.filter((it) => !q || navNorm(it.label).includes(q) || navNorm(g.group).includes(q)).map((it): SettingsTopic => it.kind === 'btn'
        ? { key: it.id, label: it.label, icon: it.icon, active: active === it.id, todo: todoTabs.has(it.id), badge: it.badge, locked: subscriptionLocked && it.id !== 'billing', onClick: () => openTopic(it.id) }
        : { key: it.href, label: it.label, icon: it.icon, href: it.href, locked: subscriptionLocked }),
    })).filter((g) => g.items.length)
  })()
  const dangerTopic: SettingsTopicGroup[] = canDanger && !navQuery.trim() ? [{ group: '', items: [{ key: 'danger', label: 'Fiók törlése', icon: Trash2, active: active === 'danger', danger: true, onClick: () => openTopic('danger') }] }] : []
  const mobileGroups: SettingsTopicGroup[] = [...topicGroups, ...dangerTopic.map((g) => ({ ...g, group: 'Veszélyzóna' }))]

  return (
    // font-onest ITT, egyszer — minden alá ágyazott panel (BookingFeatures, GoogleSettingsPanel,
    // RolesManager, stb.) örökli, nem kell mindegyiknek külön emlékeznie rá.
    <div
      className="space-y-5 font-onest"
    >
      {/* fejléc (design 16.1): cím, jobbra a kereső — a téma-listát szűri */}
      <div className="max-lg:hidden"><PageHead title="Beállítások" className="mb-[5px]" actions={<SearchField className="w-[240px]" value={navQuery} onChange={setNavQuery}>Beállítás keresése</SearchField>} /></div>
      {/* mobil (16.20): a téma-lista az első képernyő */}
      <SettingsMobileList className="lg:hidden" groups={mobileGroups.filter((g) => !groupFilter || g.group === groupFilter)} query={navQuery} onQuery={setNavQuery} onCloseSearch={() => { setNavQuery(''); setMobileSearch(false) }} searchOpen={mobileSearch || !!navQuery} />
      {/* mobil csoport-szűrő (a fejléc szűrő-ikonjáról): melyik csoport látszódjon a téma-listán */}
      <PopupModal open={groupSheet} onClose={() => setGroupSheet(false)} title="Csoportok" maxWidth="sm:max-w-[440px]">
        <div className="flex flex-wrap gap-1.5">
          {[null, ...mobileGroups.map((g) => g.group)].map((g) => (
            <button key={g ?? 'all'} type="button" onClick={() => { setGroupFilter(g); setGroupSheet(false) }} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={groupFilter === g ? 'dark' : 'cell'}>{g ?? 'Mind'}</Pill></button>
          ))}
        </div>
      </PopupModal>

      {/* Bal-sáv + panel */}
      <div className={`lg:grid lg:items-start lg:gap-[5px] lg:overflow-x-clip ${fullWidth ? 'lg:grid-cols-1' : railCollapsed ? 'lg:grid-cols-[64px_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'}`}>
        {/* desktop: a téma-lista csoportonként (aktív sötét), sticky — a Foglalóoldalon ikon-csíkra csukható */}
        <KitCard pad="sm" className={`hidden lg:sticky lg:top-6 lg:self-start ${fullWidth ? '' : 'lg:block'}`}>
          {active === 'site' && <IconButton icon={railCollapsed ? PanelLeftOpen : PanelLeftClose} label={railCollapsed ? 'Menü megnyitása' : 'Menü összecsukása'} size="sm" variant="ghost" className="mb-1" onClick={() => setRailManuallyCollapsed((v) => !v)} />}
          <SettingsNav groups={topicGroups} collapsed={railCollapsed}
            footer={dangerTopic.length > 0 && <div className="mt-2 border-t border-dashed border-ui-divider pt-2"><SettingsNav groups={dangerTopic} collapsed={railCollapsed} /></div>} />
          {!topicGroups.length && <Meta className="px-3 py-4 text-ui-label">Nincs ilyen beállítás.</Meta>}
        </KitCard>

        {/* mobil: a téma lapja alulról (16.20) — a háttér sötétít, fent fogantyú, cím, bezárás */}
        {/* a közös felugró ablak (PopupModal) mobil-lapja: ugyanaz a sötétítés, fehér lap alulról, 85%-ig, fent fogantyú (koppintásra
            bezár, X nincs). A tartalom mountolva marad (a mentetlen mezők ne vesszenek el), ezért nem maga a PopupModal. */}
        {/* a Foglalóoldal-szerkesztő maga teljes képernyős (portál) — ott nincs lap és nincs elmosott háttér, különben a lap
            üresen a szerkesztő fölé kerülne, és el kellene koppintani */}
        {mobileSheet && active !== 'site' && <span className="fixed inset-0 z-[94] bg-ui-dark/25 backdrop-blur-sm lg:hidden" onClick={() => setMobileSheet(false)} aria-hidden />}

        {/* PANEL — az Értesítéseknél a profil-form (Értesítő sablon) a kapcsolók ALÁ kerül (order-last). */}
        {/* a Számlák mobilon teljes oldal (jobbról becsúszva), nem felcsúszó lap — fent a kereső és a szűrők ikonja */}
        <div ref={panelRef} className={`min-w-0 ${mobileSheet && active === 'site' ? '' : mobileSheet ? (pageTopic ? 'max-lg:[animation:ui-slide-in_.45s_cubic-bezier(.34,1.2,.64,1)_both] max-lg:fixed max-lg:inset-0 max-lg:z-[95] max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:bg-white max-lg:px-4 max-lg:pb-28' : 'max-lg:origin-bottom max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[95] max-lg:max-h-[85dvh] max-lg:overflow-y-auto max-lg:overflow-x-hidden max-lg:rounded-t-ui-card max-lg:bg-white max-lg:px-3 max-lg:pb-28 max-lg:shadow-ui-popup') : 'max-lg:hidden'}`} style={mobileSheet && pageTopic ? { ['--dx' as string]: '100%' } : undefined} data-lenis-prevent>
          {mobileSheet && pageTopic && (
            <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-2 bg-white px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
              <IconButton icon={ArrowLeft} label="Vissza a Beállításokhoz" variant="cell" onClick={() => setMobileSheet(false)} />
              <MarqueeText className="flex-1 text-ui-title text-ui-text">{RAIL_LABELS[active]}</MarqueeText>
              <IconButton icon={Search} label="Keresés" variant="cell" onClick={() => window.dispatchEvent(new Event(`davelopment:${active}-search`))} />
              <IconButton icon={Settings2} label="Szűrők" variant="cell" onClick={() => window.dispatchEvent(new Event(`davelopment:${active}-filter`))} />
            </div>
          )}
          <div className={`sticky top-0 z-10 -mx-3 mb-1 bg-white px-6 pb-3 lg:hidden ${pageTopic || active === 'site' ? 'hidden' : ''}`}>
            <button type="button" aria-label="Vissza a témákhoz" onClick={() => setMobileSheet(false)} className="w-full pt-2.5"><SheetHandle /></button>
            <MarqueeText className="pt-4 text-ui-sub font-light text-ui-text">{RAIL_LABELS[active]}</MarqueeText>
          </div>
          {/* teljes szélességű téma (pl. Vendég e-mailek): vissza a Beállításokhoz — mint a Foglalóoldal szerkesztőjében */}
          {fullWidth && (
            <div className="mb-[5px] flex items-center gap-2 px-1 py-1 max-lg:hidden">
              <IconButton icon={ArrowLeft} label="Vissza a Beállításokhoz" variant="cell" size="sm" onClick={() => setActive(lastTab.current)} />
              <span className="text-ui-title font-normal text-ui-text">{RAIL_LABELS[active]}</span>
            </div>
          )}
          {setupSteps.length > 0 && active !== 'site' && !fullWidth && <SetupProgressCard className={`mb-[5px] ${mobileSheet && pageTopic ? 'max-lg:hidden' : ''}`} pct={setupPct} done={setupSteps.length - setupMissing.length} missing={setupMissing.map((x) => ({ label: x.label, onClick: () => openTopic(x.tab) }))} />}
          {/* a téma címe (desktop) — mobilon a lap fejlécében */}
          <div className={`mb-[5px] items-center justify-between gap-2 px-1 pt-1 ${PAGE_TABS.has(active) ? 'hidden' : 'hidden lg:flex'}`}>
            <span className="text-ui-sub font-light text-ui-text">{RAIL_LABELS[active]}</span>
            {active === 'billing' && trialBadge && <Pill tone="yellow" size="sm">{trialBadge}</Pill>}
          </div>

          {/* Profil-form (Üzlet profil / Foglalás / Nyelvek / Email / Dokumentumok / Fiók törlése):
              MINDIG mountolva marad (a mentetlen mezők ne vesszenek el lista-váltáskor), csak a
              láthatóságot váltjuk. A fület a bal lista vezérli — a formhoz CONTEXTen át jut le
              (RSC-határon a cloneElement-prop nem megbízható), így a form a saját fül-sorát is elrejti. */}
          {/* Dokumentumok & jogi (16.12): egy lap-kártya a két csoporttal (feltételek a formból, nyilatkozat alatta), jobbra az
              elfogadások — a burkolók mindig ott vannak (a profil-form nem mountolódik újra), csak a kinézetük vált */}
          <div className={active === 'documents' ? 'grid grid-cols-1 items-start gap-[5px] lg:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0' : 'contents'}>
          <div className={active === 'documents' ? 'min-w-0 rounded-ui-card bg-white pb-6' : 'contents'}>
          {active === 'documents' && <div className="px-6 pb-1 pt-6 max-lg:hidden"><div className="text-ui-label text-ui-muted">Üzlet</div><div className="mt-0.5 text-ui-sub font-light text-ui-text">Dokumentumok & jogi</div></div>}
          <SettingsFormContext.Provider value={{ controlledTab: FORM_TABS[active] ?? 'general', reportDirty, registerApi, guestEmail }}>
            <div className={active in FORM_TABS ? '' : 'hidden'}>{profilePanel}</div>
          </SettingsFormContext.Provider>

          {/* ── „Dokumentumok & jogi" fül folytatása — a profil-form saját dokumentumok-fülje
              (ÁSZF-szakaszok) UTÁN a beleegyező nyilatkozat sablon-szerkesztője, ami régen a
              Fizetéseknél volt, pedig jogi dokumentum, nem fizetési beállítás. ── */}
          {active === 'documents' && (
            <div>
              <PaymentsSettingsPanel
                variant={variant}
                apiBase={apiBase}
                deposit={depositSettings}
              manualApproval={bookingPageEditor ? !bookingPageEditor.autoConfirm : false}
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
          </div>
          {active === 'documents' && consentStats && (
            <KitCard tone="dark"><Meta dark>Elfogadta</Meta><div className="mt-1 text-ui-num font-light leading-none">{consentStats.total.toLocaleString('hu-HU')}</div><Meta dark className="mt-2">{variant === 'salon' ? 'foglalás' : 'asztalfoglalás'} · ebből {consentStats.onsite.toLocaleString('hu-HU')} helyben, tableten</Meta></KitCard>
          )}
          </div>

          {/* ── Nem-form panelek — key változásakor fade-in animáció (a profilePanel mindig mountolva marad). ── */}
          {!(active in FORM_TABS) && (
          <motion.div key={active}>

          {active === 'site' && bookingPageEditor && (
            <BookingPageEditor
              initial={bookingPageEditor}
              onDirtyChange={sitePanel.onDirtyChange}
              registerApi={sitePanel.registerApi}
              onNavigate={(tab) => { if (tab in RAIL_LABELS) setActive(tab as RailId) }}
              onExit={() => { setActive(lastTopic.current); setMobileSheet(false) }}
            />
          )}

          {/* Hírlevél (16.13): az összesítő a fül megnyitásakor töltődik */}
          {active === 'newsletter' && <NewsletterSettings data={newsSummary} marketingHref={variant === 'salon' ? '/dashboard/marketing' : '/restaurant/marketing'} subscribersHref={`${variant === 'salon' ? '/dashboard/marketing' : '/restaurant/marketing'}?tab=subscribers`} />}

          {(['vouchers', 'invoicing', 'deposit'] as const).map((tab) => active === tab && (
            <PaymentsSettingsPanel
              key={tab}
              variant={variant}
              apiBase={apiBase}
              deposit={depositSettings}
              manualApproval={bookingPageEditor ? !bookingPageEditor.autoConfirm : false}
              invoice={invoiceSettings}
              voucher={voucherSettings}
              consent={consentSettings}
              stripeConnectAccountId={stripeConnectAccountId}
              stripeConnectOnboarded={stripeConnectOnboarded}
              pricing={pricing}
              businessId={activeBusinessId}
              tier={businessTier}
              sections={[tab === 'vouchers' ? 'voucher' : tab]}
              onDirtyChange={(tab === 'vouchers' ? vouchersPanel : tab === 'deposit' ? depositPanel : invoicingPanel).onDirtyChange}
              registerApi={(tab === 'vouchers' ? vouchersPanel : tab === 'deposit' ? depositPanel : invoicingPanel).registerApi}
            />
          ))}

          {active === 'payments' && (
            <PaymentsSettingsPanel
              variant={variant}
              apiBase={apiBase}
              deposit={depositSettings}
              manualApproval={bookingPageEditor ? !bookingPageEditor.autoConfirm : false}
              invoice={invoiceSettings}
              voucher={voucherSettings}
              consent={consentSettings}
              stripeConnectAccountId={stripeConnectAccountId}
              stripeConnectOnboarded={stripeConnectOnboarded}
              pricing={pricing}
              businessId={activeBusinessId}
              tier={businessTier}
              sections={['stripe', 'invoicing']}
              onDirtyChange={paymentsTabPanel.onDirtyChange}
              registerApi={paymentsTabPanel.registerApi}
            />
          )}
          {active === 'hours' && hoursVM && <OpeningHoursView vm={hoursVM} canManage={hoursCanManage} />}

          {/* Foglalási szabályok (étterem, 16.21) — az értékek; a szerkesztésük ma a Foglalóoldal szerkesztőjében van */}
          {/* Asztalok & termek (16.22) és Foglalási szabályok (16.21) — étterem: a vendég online foglalásának korlátai */}
          {active === 'rules' && capacity && (
            <CapacitySettingsView key={active} part={active} vm={capacity} apiBase={apiBase} onDirtyChange={capacityPanel.onDirtyChange} registerApi={capacityPanel.registerApi} />
          )}
          {/* Asztalok & termek (16.22): a szerkesztő és az online kapacitás egy helyen — azonnal ment (nincs mentés-sáv) */}
          {active === 'tables' && tablesData && (
            <TablesView restaurantId={activeBusinessId} rooms={tablesData.rooms} tables={tablesData.tables} templates={tablesData.templates} canManage={tablesData.canManage}
              capacity={{ pct: capacity?.pct ?? 100, apiBase }} />
          )}

          {/* Számlák (16.7.1): a vendégeknek kiállított számlák — külön téma, a Fizetés & számlázás aljáról ide került */}
          {active === 'invoices' && activeBusinessId && <IssuedInvoicesTable variant={variant} businessId={activeBusinessId} />}

          {/* Értesítések (design 16.18) — a SAJÁT értesítéseid: az App / E-mail kapcsolók a személyes beállításból azonnal
              mentődnek; a csapat foglalás-értesítése és a napi összefoglaló e-mailje üzleti beállítás (a közös sávon). */}
          {/* „Ami figyelmet kér” (design 6.8.1) — a saját beállításod: új függő foglalásnál sáv vagy popup, és a fizetés-sáv */}
          {active === 'notifications' && internalEmailPrefs.loaded && (
            <AttentionSettings className="mb-4" payment={variant === 'salon'}
              value={{ pending: internalEmailPrefs.prefs.pending_popup ? 'popup' : 'bar', payment: internalEmailPrefs.prefs.payment_bar }}
              onChange={(v) => {
                if ((v.pending === 'popup') !== internalEmailPrefs.prefs.pending_popup) void internalEmailPrefs.toggle('pending_popup')
                if (v.payment !== internalEmailPrefs.prefs.payment_bar) void internalEmailPrefs.toggle('payment_bar')
              }} />
          )}
          {active === 'notifications' && (() => {
            const p = internalEmailPrefs
            const own = (k: CategoryKey) => (p.loaded && p.allowed[k] ? { on: p.prefs[k], onChange: () => void p.toggle(k) } : null)
            const rows: NotifRow[] = [
              { key: 'bookings', title: 'Új foglalás és lemondás', desc: 'neked — az appban (és ha kéred, e-mailben is)', app: own('bookings'), mail: own('bookings_email') },
              ...(canFullSettings ? [{ key: 'team', title: 'Foglalás-értesítés a csapatnak', desc: 'az üzletben — az appban minden csapattagnak', app: { on: newBookingsNotif, onChange: setNewBookingsNotif }, mail: null }] : []),
              { key: 'digest', title: 'Napi összefoglaló', desc: variant === 'salon' ? 'reggel mi vár ma, este hogy ment — az appban' : 'a napi forgalom összefoglalója zárás után — az appban', pro: true, app: own('digest'), mail: null },
              { key: 'schedule', title: 'Beosztás változás', desc: 'ha a műszakod létrejön, módosul vagy törlődik', app: own('schedule'), mail: own('schedule_email') },
              { key: 'not_opened', title: 'Meg nem nyitott visszaigazolás', desc: 'ha a vendég 24, majd 12 órával előtte sem nyitotta meg', app: own('email_not_opened'), mail: null },
            ].filter((r) => r.app || r.mail)
            const d = devicePush
            const push = d.env === 'loading' ? { status: <StatusPill status="neutral">Ellenőrzés…</StatusPill>, text: '' }
              : d.env === 'ios-browser' ? { status: <StatusPill status="pending">Előbb tedd a főképernyőre</StatusPill>, text: 'iPhone-on: Safari › Megosztás › Főképernyőhöz adás, majd nyisd meg onnan — utána itt bekapcsolhatod.' }
              : d.env === 'unsupported' ? { status: <StatusPill status="warn">Nem támogatott</StatusPill>, text: 'Ez a böngésző nem tud push-értesítést fogadni.' }
              : d.env === 'denied' ? { status: <StatusPill status="bad">Letiltva</StatusPill>, text: 'A böngésző beállításaiban engedélyezd az oldal értesítéseit, és frissítsd az oldalt.' }
              : d.enabled ? { status: <StatusPill status="ok">Bekapcsolva ezen az eszközön</StatusPill>, text: 'Minden foglalásról push-értesítést kapsz, akkor is, ha az app be van zárva.' }
              : { status: <StatusPill status="bad">Kikapcsolva ezen az eszközön</StatusPill>, text: d.installed ? 'Kapcsold be, és minden foglalásról push-értesítést kapsz.' : 'Kapcsold be, vagy telepítsd az appot — utána minden foglalásról push-értesítést kapsz.' }
            const action = (d.env === 'ready' || d.canInstall) ? (
              <span className="flex flex-wrap gap-1.5">
                {d.env === 'ready' && <KitButton variant={d.enabled ? 'ghostDark' : 'yellow'} size="sm" loading={d.busy} onClick={() => void (d.enabled ? d.disable() : d.enable())}>{d.enabled ? 'Kikapcsolás' : 'Bekapcsolás'}</KitButton>}
                {d.canInstall && <KitButton variant="ghostDark" size="sm" onClick={() => void d.install()}>App telepítése</KitButton>}
              </span>
            ) : undefined
            return (
              <NotificationsSettings save={false} rows={rows} push={{ ...push, action }} testBusy={testBusy}
                onTest={async () => {
                  setTestBusy(true)
                  try {
                    const r = await fetch('/api/push/test', { method: 'POST', credentials: 'include' })
                    const j = await r.json().catch(() => ({}))
                    if (!r.ok) throw new Error(j.error || 'A küldés nem sikerült')
                    toast.success(`Próba-értesítés elküldve (${j.devices} eszköz)`)
                  } catch (e) { toast.error(e instanceof Error ? e.message : 'A küldés nem sikerült') } finally { setTestBusy(false) }
                }}
                guestLink={<>A vendégeknek menő levelek a <button type="button" onClick={() => setActive('email')} className="text-ui-text underline underline-offset-2">Vendég e-mailek</button> alatt állíthatók.</>} />
            )
          })()}

          {/* ── Csapat & jogok (design 16.2 Tagok / 16.3 Szerepek) — a tagok ugyanaz az adat, mint a Munkatársaknál; a
              meghívás a közös InviteFlow ── */}
          {active === 'team' && (() => {
            const members = team.filter((m) => !m.pending)
            const rows: MemberRow[] = members.map((m) => ({
              id: m.id ?? 'owner', name: m.name, email: m.email, img: m.avatarUrl ?? null, role: m.role, owner: m.roleTone === 'owner' || !m.id,
              staff: m.staffName ?? null, last: m.lastLogin ? relWhen(m.lastLogin) : 'még nem lépett be', status: m.suspended ? 'suspended' : 'active',
            }))
            const pending = team.filter((m) => m.pending && m.id).map((m) => ({ id: m.id!, email: m.email, meta: `${m.role} · ${m.invitedAt ? `${relWhen(m.invitedAt)} küldve` : 'meghívó elküldve'}` }))
            const menuWrap = (open: boolean, close: () => void, trigger: React.ReactNode, menu: React.ReactNode) => (
              <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
                {trigger}
                {open && <><span className="fixed inset-0 z-40" onClick={close} aria-hidden /><Menu className="absolute right-0 top-full z-50 mt-1">{menu}</Menu></>}
              </span>
            )
            const header = (tab: number) => (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="text-ui-label text-ui-muted">Csapat</div><div className="text-ui-sub font-light text-ui-text">Csapat & jogok</div></div>
                <Segmented options={['Tagok', 'Szerepek']} active={tab} onSelect={(i) => setTeamSubTab(i ? 'roles' : 'members')} tone="cell" />
              </div>
            )
            if (teamSubTab === 'roles') return rolesData && activeBusinessId
              ? <RolesManager variant={variant} businessId={activeBusinessId} initialRoles={rolesData.initial} myCapabilities={myCapabilities ?? ALL_CAPABILITIES} isOwner={rolesData.isOwner} header={header(1)}
                  members={team.filter((m) => !m.pending).map((m) => ({ roleId: m.customRoleId ?? null, owner: m.roleTone === 'owner', name: m.name, img: m.avatarUrl ?? null }))} />
              : <div className="rounded-ui-card bg-white p-6">{header(1)}<Meta className="mt-5">A szerepek megtekintéséhez nincs jogosultságod.</Meta></div>
            return (
              <>
                <TeamMembers rows={rows} pending={pending} tab={0} onTab={(i) => setTeamSubTab(i ? 'roles' : 'members')} onInvite={canTeamManage ? () => setInviteOpen(true) : undefined}
                  selected={teamSel} onToggle={canTeamManage ? (id) => setTeamSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])) : undefined}
                  onToggleAll={canTeamManage ? () => { const ids = rows.filter((r) => !r.owner).map((r) => r.id); setTeamSel((s) => (ids.every((i) => s.includes(i)) ? [] : ids)) } : undefined}
                  renderRole={(r) => r.owner ? <Pill tone="dark" size="sm">Tulajdonos</Pill> : !canTeamManage ? <Pill tone="white" size="sm">{r.role}</Pill> : menuWrap(teamMenu?.id === r.id && teamMenu.kind === 'role', () => setTeamMenu(null),
                    <button type="button" disabled={rowBusy === r.id} onClick={() => setTeamMenu({ id: r.id, kind: 'role' })} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone="white" size="sm">{r.role}<ChevronDown className="h-3.5 w-3.5 text-ui-muted" /></Pill></button>,
                    <>{liveRoles.map((x) => <MenuItem key={x.id} active={members.find((m) => m.id === r.id)?.customRoleId === x.id} onClick={() => { setTeamMenu(null); void changeRole(r.id, `c:${x.id}`) }}>{x.name}</MenuItem>)}{!liveRoles.length && <Meta className="px-3 py-2">Még nincs szerep — a Szerepek fülön hozod létre.</Meta>}</>)}
                  renderActions={(r) => r.owner || !canTeamManage ? null : menuWrap(teamMenu?.id === r.id && teamMenu.kind === 'more', () => setTeamMenu(null),
                    <IconButton icon={MoreHorizontal} size="sm" variant="ghost" label="Műveletek" onClick={() => setTeamMenu({ id: r.id, kind: 'more' })} />,
                    <>
                      <MenuItem onClick={() => void setMemberStatus(r.id, r.status === 'suspended' ? 'active' : 'suspended')}>{r.status === 'suspended' ? 'Aktiválás' : 'Felfüggesztés'}</MenuItem>
                      <MenuItem icon={Trash2} danger onClick={() => { setTeamMenu(null); setTeamConfirm({ ids: [r.id], title: `${r.name} eltávolítása`, label: 'Eltávolítás' }) }}>Eltávolítás</MenuItem>
                    </>)}
                  onResend={canTeamManage ? (id) => void resendInvite(id) : undefined}
                  onRevoke={canTeamManage ? (id) => setTeamConfirm({ ids: [id], title: 'Meghívó visszavonása', label: 'Visszavonás' }) : undefined}
                  bulk={canTeamManage && teamSel.length > 0 ? (
                    <BulkDock><StaffBulkBar count={teamSel.length} onClear={() => setTeamSel([])} actions={[
                      { label: 'Felfüggesztés', onClick: () => { void Promise.all(teamSel.map((id) => setMemberStatus(id, 'suspended'))).then(() => setTeamSel([])) } },
                      { label: 'Eltávolítás', danger: true, onClick: () => setTeamConfirm({ ids: teamSel, title: `${teamSel.length} tag eltávolítása`, label: 'Eltávolítás' }) },
                    ]} /></BulkDock>
                  ) : undefined} />
                <InviteFlow open={inviteOpen} onClose={() => setInviteOpen(false)} restaurant={variant === 'restaurant'} businessId={activeBusinessId ?? ''}
                  roles={liveRoles.map((x) => ({ id: x.id, label: x.name, desc: x.desc ?? '' }))} freeStaff={inviteSetup?.freeStaff} bookable={inviteSetup?.bookable} extraFee={inviteSetup?.extraFee} />
                <ConfirmDialog open={!!teamConfirm} title={teamConfirm?.title ?? ''} description="A tag elveszíti a hozzáférését; a munkatárs-profilja és a foglalásai megmaradnak." confirmLabel={teamConfirm?.label ?? 'Eltávolítás'}
                  onConfirm={() => teamConfirm && void removeMembers(teamConfirm.ids)} onCancel={() => setTeamConfirm(null)} zIndexClass="z-[100]" />
              </>
            )
          })()}

          {/* ── Saját profil ── a bejelentkezett user (bárki: tulaj/vezető/alkalmazott) szerkeszti
              a saját nevét/avatarját/jelszavát. A panel-tartalom a settings page-ről jön (SelfProfileView, a hub rendereli),
              hogy a user-adat ott, szerver-oldalon oldódjon fel. */}
          {active === 'self' && (selfProfile
            ? <SelfProfileView data={selfProfile} onDirtyChange={selfPanel.onDirtyChange} registerApi={selfPanel.registerApi} />
            : <Meta>A profil szerkesztő nem érhető el.</Meta>)}

          {/* ── API & Integrációk — MINDEN kulcs/API/webhook-jellegű beállítás egy helyen
              (user-döntés: ne szedjük szét irány szerint, ez egyszerűbb, mint a szolgáltatás-
              specifikus szétbontás). A Számlázás + Hírlevél a Fizetésekből költözött ide. ── */}
          {active === 'integrations' && (
            <div className="space-y-4">
              <IntegrationsPanel
                variant={variant}
                businessId={activeBusinessId}
                bookingUrl={bookingUrl}
                icalUrl={icalUrl}
                embedUrl={embedUrl}
                embedSmartSnippet={embedSmartSnippet}
                apiBase={apiBase}
                webhookUrl={webhookUrl}
                ga4Id={ga4Id}
                facebookPixelId={facebookPixelId}
                initialFeatureModules={featureModules}
                onDirtyChange={integPanel.onDirtyChange}
                registerApi={integPanel.registerApi}
                qr={<BusinessQrLauncher variant="card" url={bookingUrl} businessName={bookingPageEditor?.name ?? businessName} restaurant={variant === 'restaurant'} logoUrl={bookingPageEditor?.logoUrl ?? null} hours={bookingPageEditor?.hours ?? (hoursVM ? hoursRows(hoursVM.days) : [])} socialLinks={bookingPageEditor?.socialLinks ?? []} />}
              />
            </div>
          )}

          {(active === 'google' || active === 'reviews') && (
            <GoogleSettingsPanel
              key={active}
              part={active === 'reviews' ? 'reviews' : 'profile'}
              variant={variant}
              businessId={activeBusinessId}
              apiBase={apiBase}
              bookingUrl={bookingUrl}
              businessName={businessName}
              businessCity={businessCity}
              initialFeatureModules={featureModules}
              onDirtyChange={googlePanel.onDirtyChange}
              registerApi={googlePanel.registerApi}
            />
          )}

          {/* ── Előfizetés (design 16.5) — a fizetési mód a Stripe-tól élőben (nálunk nincs kártya-adat), a csomagváltás,
              a fizetés indítása, az ügyfélportál és a lemondás a meglévő végpontokon ── */}
          {active === 'billing' && (() => {
            const st = billing.subscriptionStatus
            const biz = activeBizForPricing
            const kindB = variant
            const staffN = biz?.staffCount ?? 0
            const curTier = biz?.tier ?? 'pro'
            const price = (t: 'starter' | 'pro') => applyCycle(businessMonthlyFee(pricing, kindB, staffN, t), selectedCycle, billingAccount.annualDiscountPct)
            const cap = (t: 'starter' | 'pro') => `${monthlyEmailCapForTier(pricing, t).toLocaleString('hu-HU')} hírlevél / hó`
            const trialLeft = st === 'trialing' && billing.trialEndsAt ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86_400_000)) : null
            const needsCheckout = st !== 'trialing' && st !== 'active'
            const planBtn = (t: 'starter' | 'pro') => (curTier === t ? (st === 'trialing' ? 'Jelenlegi (próba)' : 'Jelenlegi') : needsCheckout ? 'Kiválasztom' : 'Váltás')
            const pill = st === 'trialing' ? `Próbaidő · ${trialLeft === 0 ? 'ma jár le' : `még ${trialLeft} nap`}` : st === 'past_due' ? 'Sikertelen fizetés' : st === 'canceled' ? 'Lemondva' : billing.cancelAtPeriodEnd ? 'Lemondás folyamatban' : st === 'paused' ? 'Szünetel' : null
            const line = st === 'trialing' ? `Próbaidő vége: ${billing.nextChargeDate ?? '—'} — utána ${billing.nextChargeAmount} / hó, bármikor lemondható.`
              : st === 'active' ? (billing.cancelAtPeriodEnd ? `Lemondva — ${billing.nextChargeDate ?? '—'}-ig minden funkció elérhető.` : `Következő terhelés: ${billing.nextChargeDate ?? '—'} · ${billing.nextChargeAmount}${billingAccount.count > 1 ? ` · ${billingAccount.count} üzlet a fiókban` : ''}`)
              : st === 'past_due' ? 'A legutóbbi fizetés nem sikerült — frissítsd a kártyád, hogy az előfizetés aktív maradjon.'
              : 'Az előfizetés nem aktív — indítsd újra, és minden funkció ismét elérhető.'
            const card = billing.hasStripeCustomer ? stripeCard ?? null : null
            const u = billing.usage
            const month = new Date().toLocaleDateString('hu-HU', { month: 'long' })
            return (
              <>
                <SubscriptionPage showPause={false}
                  notice={st === 'trialing' && (!billFieldsComplete || !card) ? (
                    <TrialChecklist daysLeft={trialLeft ?? 0} endLabel={billing.nextChargeDate ?? 'a próbaidő vége'} steps={[
                      { key: 'plan', label: 'Csomag', hint: `${curTier === 'starter' ? 'Starter' : curTier === 'egyedi' ? 'Egyedi' : 'Pro'} · ${billing.nextChargeAmount} / hó`, done: true },
                      { key: 'billing', label: 'Számlázási adatok', hint: 'név, adószám, cím — ez kerül a számlára', done: billFieldsComplete, action: { label: 'Megadom', onClick: () => setBillOpen(true) } },
                      { key: 'card', label: 'Fizetési mód', hint: 'kártya a Stripe-nál — csak a próbaidő után terhelünk', done: !!card, action: { label: 'Kártya', onClick: () => void startCheckout() } },
                    ]} />
                  ) : undefined}
                  plan={curTier === 'starter' ? 'Starter' : curTier === 'egyedi' ? 'Egyedi' : 'Pro'} statusPill={pill} statusLine={line}
                  primary={card && !needsCheckout ? { label: 'Fizetés kezelése', onClick: () => void openPortal(), busy: subBusy === 'portal' } : { label: st === 'trialing' ? 'Fizetési mód megadása' : 'Előfizetés indítása', onClick: () => void startCheckout(), busy: subBusy === 'checkout' }}
                  cardLine={card ? `${card.brand} •••• ${card.last4}` : 'Nincs mentett kártya'}
                  usageTitle={`Felhasználás · ${month.charAt(0).toUpperCase()}${month.slice(1)}`}
                  usage={[
                    ...(u ? [{ label: 'Hírlevél-keret', value: u.emailsUsed, max: Math.max(1, u.emailCap), unit: ' e-mail' }] : []),
                    ...(u?.staff != null ? [{ label: 'Munkatársak', value: u.staff, max: Math.max(u.staff, u.staffIncluded ?? 1), unit: ' fő', yellow: true }] : []),
                  ]}
                  usageHistory={u?.emailHistory?.length ? { months: u.emailHistory.map((m, i, a) => ({ d: new Date(`${m.ym}-01T12:00:00`).toLocaleDateString('hu-HU', { month: 'short' }).replace('.', ''), v: m.n, peak: i === a.length - 1 })), cap: curTier === 'egyedi' ? 0 : u.emailCap } : undefined}
                  usageNote={u?.staff != null && u.staffIncluded != null && u.staff > u.staffIncluded ? `${u.staffIncluded} foglalható munkatárs az árban, a többi +${pricing.salon_extra_staff_huf.toLocaleString('hu-HU')} Ft / fő / hó.` : 'Keret felett nem megy ki hírlevél — ilyenkor jelzünk, és a következő hónapban újraindul.'}
                  card={card} cardHint={st === 'trialing' ? 'A próbaidő végéig ráérsz megadni.' : 'A kártyát a Stripe biztonságos oldalán adod meg.'}
                  onCard={() => void (billing.hasStripeCustomer ? openPortal() : startCheckout())}
                  billingRows={[['Számlázási név', billDetails.legalName], ['Adószám', billDetails.taxNumber], ['Számlázási e-mail', billDetails.billingEmail]]}
                  onEditBilling={() => setBillOpen(true)}
                  showCycle={ANNUAL_BILLING_UI_ENABLED} cycle={selectedCycle === 'annual' ? 1 : 0} onCycle={(i) => setSelectedCycle(i ? 'annual' : 'monthly')} annualPct={billingAccount.annualDiscountPct}
                  plans={[
                    { key: 'starter', name: 'Starter', badge: 'Belépő', price: price('starter').toLocaleString('hu-HU'), perMonth: true, cap: cap('starter'), extra: kindB === 'salon' ? 'Minden funkció' : 'Minden funkció, fix havidíj', current: curTier === 'starter', btn: planBtn('starter'), onClick: curTier === 'starter' ? undefined : () => void selectTier('starter'), busy: subBusy === 'starter' },
                    { key: 'pro', name: 'Pro', badge: 'Népszerű', price: price('pro').toLocaleString('hu-HU'), perMonth: true, cap: cap('pro'), extra: kindB === 'salon' ? `+ ${applyCycle(pricing.salon_extra_staff_huf, selectedCycle, billingAccount.annualDiscountPct).toLocaleString('hu-HU')} Ft / további munkatárs` : 'Minden funkció, fix havidíj', current: curTier !== 'starter' && curTier !== 'egyedi', btn: planBtn('pro'), onClick: curTier === 'pro' ? undefined : () => void selectTier('pro'), busy: subBusy === 'pro' },
                    { key: 'egyedi', name: 'Egyedi', badge: 'Vállalati', price: 'Ajánlatra', cap: 'Korlátlan hírlevél', extra: 'Több telephely, veled egyeztetve', current: curTier === 'egyedi', btn: curTier === 'egyedi' ? 'Jelenlegi' : 'Kapcsolat', onClick: curTier === 'egyedi' ? undefined : () => { window.location.href = `mailto:hello@davelopment.hu?subject=${encodeURIComponent(`Egyedi ${kindB === 'salon' ? 'szalon' : 'étterem'} csomag`)}` } },
                  ]}
                  invoices={billing.invoices.map((inv) => ({ key: inv.id, period: inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }) : '—', plan: `${inv.invoice_number}${inv.test ? ' · teszt' : ''}`, amount: inv.amount_huf ? `${inv.amount_huf.toLocaleString('hu-HU')} Ft` : '—', status: 'Fizetve', url: `/api/billing/invoice-pdf?id=${inv.id}` }))}
                  cancel={st === 'active' ? (billing.cancelAtPeriodEnd
                    ? { label: 'Lemondás visszavonása', onClick: () => void cancelSub(true), busy: subBusy === 'cancel', note: `Lemondva — ${billing.nextChargeDate ?? '—'}-ig minden funkció elérhető, utána nem terhelünk.` }
                    : { label: 'Lemondás', onClick: () => setCancelOpen(true), note: 'Az adataid megmaradnak; a lemondás a fizetett időszak végén lép életbe.' }) : null}
                />
                <ConfirmDialog open={cancelOpen} title="Előfizetés lemondása" description={`A fizetett időszak végéig (${billing.nextChargeDate ?? '—'}) minden funkció elérhető marad, utána nem terhelünk. Bármikor visszavonhatod.`} confirmLabel="Lemondás" busy={subBusy === 'cancel'}
                  onConfirm={() => void cancelSub(false)} onCancel={() => setCancelOpen(false)} zIndexClass="z-[100]" />
                {/* számlázási adatok (a számlán ez szerepel; a fizetés előtt kötelező) */}
                <PopupModal open={billOpen} onClose={() => setBillOpen(false)} panel={
                  <Modal title="Számlázási adatok" subtitle="Ezek kerülnek a davelopment számláira." onClose={() => setBillOpen(false)}
                    footer={<><KitButton variant="cell" onClick={() => setBillOpen(false)}>Mégse</KitButton><KitButton loading={billSaving} disabled={!billDirty} onClick={async () => { await saveBillDetails(); setBillOpen(false) }}>Mentés</KitButton></>}>
                    <div id="bill-details-form" className="space-y-3">
                      {/* ki fizet (design 16.5.1) — ettől függ, mi kell: magánszemélynél nincs adószám, cégjegyzékszám csak cégnél */}
                      <Segmented full size="sm" tone="cell" options={['Magánszemély', 'Egyéni vállalkozó', 'Cég']} active={payerKind === 'person' ? 0 : payerKind === 'sole' ? 1 : 2}
                        onSelect={(i) => { const k = (['person', 'sole', 'company'] as const)[i]; setPayerKind(k); if (k === 'person') { setBillField('taxNumber', ''); setBillField('companyRegNumber', '') } else if (k === 'sole') setBillField('companyRegNumber', '') }} />
                      <Field label="Cégnév / teljes név" hint={billError('legalName') ?? 'Ez a név szerepel a számlán.'}><Input value={billDetails.legalName} onChange={(e) => setBillField('legalName', e.target.value)} onBlur={() => touchBillField('legalName')} placeholder="Pl. Minta Bt." aria-invalid={!!billError('legalName')} /></Field>
                      {payerKind !== 'person' && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Adószám" hint={vatFromTaxNumber(billDetails.taxNumber)?.label ?? 'a 9. jegye mutatja az adózást'}><Input inputMode="numeric" value={billDetails.taxNumber} onChange={(e) => setBillField('taxNumber', maskTaxNumber(e.target.value))} placeholder="12345678-1-23" maxLength={13} /></Field>
                          {payerKind === 'company' && <Field label="Cégjegyzékszám"><Input inputMode="numeric" value={billDetails.companyRegNumber} onChange={(e) => setBillField('companyRegNumber', maskCompanyReg(e.target.value))} placeholder="01-09-123456" maxLength={12} /></Field>}
                        </div>
                      )}
                      <Field label="Számlázási e-mail" hint={billError('billingEmail') ?? 'Ide érkeznek a számlák.'}><Input type="email" value={billDetails.billingEmail} onChange={(e) => setBillField('billingEmail', e.target.value)} onBlur={() => touchBillField('billingEmail')} placeholder="szamlazas@ceg.hu" aria-invalid={!!billError('billingEmail')} /></Field>
                      <Field label="Számlázási cím" hint={billError('billingPostalCode') || billError('billingCity') || billError('billingStreet') ? 'A teljes cím kötelező (irányítószám, település, utca).' : 'Keress rá, vagy írd be kézzel.'}>
                        <AddressAutocompleteInput onSelect={(ad) => {
                          if (ad.postalCode) { setBillField('billingPostalCode', ad.postalCode); touchBillField('billingPostalCode') }
                          if (ad.city) { setBillField('billingCity', ad.city); touchBillField('billingCity') }
                          if (ad.street) { setBillField('billingStreet', ad.street); touchBillField('billingStreet') }
                        }} />
                        <div className="mt-2 grid grid-cols-[88px_1fr] gap-2 sm:grid-cols-[88px_1fr_1.6fr]">
                          <Input inputMode="numeric" value={billDetails.billingPostalCode} onChange={(e) => setBillField('billingPostalCode', e.target.value.replace(/\D/g, '').slice(0, 4))} onBlur={() => touchBillField('billingPostalCode')} placeholder="Irsz." maxLength={4} aria-label="Irányítószám" />
                          <Input value={billDetails.billingCity} onChange={(e) => setBillField('billingCity', e.target.value)} onBlur={() => touchBillField('billingCity')} placeholder="Település" aria-label="Település" />
                          <Input value={billDetails.billingStreet} onChange={(e) => setBillField('billingStreet', e.target.value)} onBlur={() => touchBillField('billingStreet')} placeholder="Utca, házszám" aria-label="Utca, házszám" className="col-span-2 sm:col-span-1" />
                        </div>
                      </Field>
                    </div>
                  </Modal>
                } />
              </>
            )
          })()}

          {/* ── Audit-napló ── VALÓS bejegyzések az AuditLog collectionből (üzletre szűrve). */}
          {active === 'audit' && (() => {
            const rows = filteredAudit.slice(auditPaging.from, auditPaging.to)
            const actorImgs = new Map(auditLog.filter((e) => e.actorImg).map((e) => [e.actor, e.actorImg]))
            const byActor = [...filteredAudit.reduce((m, e) => m.set(e.actor, (m.get(e.actor) ?? 0) + 1), new Map<string, number>())].sort((x, y) => y[1] - x[1]).slice(0, 6)
            return (
              <SettingsPage group="Fiók" title="Audit-napló" save={false} aside={<>
                <KitCard tone="dark"><Meta dark>Az elmúlt {auditDays} napban</Meta><div className="mt-1 text-ui-num font-light leading-none">{filteredAudit.length.toLocaleString('hu-HU')}</div><Meta dark className="mt-2">esemény · {filteredAudit.filter((e) => e.action === 'delete').length} törlés</Meta></KitCard>
                {byActor.length > 0 && (
                  <KitCard pad="sm">
                    <div className="px-2 pb-1 pt-1"><CardTitle>Csapattag szerint</CardTitle></div>
                    {byActor.map(([n, c]) => (
                      <button key={n} type="button" onClick={() => { setAuditQuery(auditQuery === n ? '' : n) }} className="ui-press mb-1 block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                        <ListRow filled open={auditQuery === n} leading={<Avatar size="sm" src={actorImgs.get(n)} name={n} />} title={n} trailing={<Pill size="sm" tone={auditQuery === n ? 'white' : 'cell'}>{c}</Pill>} />
                      </button>
                    ))}
                  </KitCard>
                )}
              </>}>
                <div className="px-6 pt-4 max-lg:px-0 max-lg:pt-0">
                  {/* mobil: a fejléc nagyítója / szűrője nyitja (mint a Számláknál); desktopon az eszköztár */}
                  {auditMSearch && (
                    <div className="ui-pop-in mb-3 flex items-center gap-1.5 lg:hidden">
                      <SearchField autoFocus className="min-w-0 flex-1" value={auditQuery} onChange={(v) => { setAuditQuery(v) }}>Esemény vagy név</SearchField>
                      <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={() => { setAuditQuery(''); setAuditMSearch(false) }} />
                    </div>
                  )}
                  {auditMFilters && (
                    <div className="ui-pop-in mb-3 flex flex-wrap gap-1.5 lg:hidden">
                      <Select toolbar value={auditFilter} onChange={(e) => { setAuditFilter(e.target.value as typeof auditFilter) }} className="w-[170px]">{AUDIT_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.id === 'all' ? 'Minden esemény' : f.label}</option>)}</Select>
                      <Select toolbar value={String(auditDays)} onChange={(e) => { setAuditDays(Number(e.target.value) as typeof auditDays) }} className="w-[150px]">{AUDIT_DAY_WINDOWS.map((d) => <option key={d} value={d}>Utolsó {d} nap</option>)}</Select>
                    </div>
                  )}
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 max-lg:hidden">
                    <SearchField className="w-[220px] max-sm:w-full" value={auditQuery} onChange={(v) => { setAuditQuery(v) }}>Esemény vagy név</SearchField>
                    <Select toolbar value={auditFilter} onChange={(e) => { setAuditFilter(e.target.value as typeof auditFilter) }} className="w-[170px]">{AUDIT_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.id === 'all' ? 'Minden esemény' : f.label}</option>)}</Select>
                    <Select toolbar value={String(auditDays)} onChange={(e) => { setAuditDays(Number(e.target.value) as typeof auditDays) }} className="w-[150px]">{AUDIT_DAY_WINDOWS.map((d) => <option key={d} value={d}>Utolsó {d} nap</option>)}</Select>
                  </div>
                  {rows.length === 0 ? <Meta className="py-10 text-center">Nincs naplózott esemény ebben az időszakban.</Meta> : (
                    <AuditTable rows={rows.map((e) => ({ key: e.id, time: relativeTime(e.createdAt), actor: { name: e.actor, email: e.actorEmail, img: e.actorImg }, ...auditView(e) }))} />
                  )}
                  <LoadMoreSentinel hasMore={auditPaging.hasMore} loading={false} onMore={auditPaging.more} />
                  <Pagination page={auditPaging.page} pages={auditPaging.pages} label={auditPaging.label} onPage={auditPaging.goTo} className="mt-2" />
                </div>
              </SettingsPage>
            )
          })()}

          {/* ── Telephelyek (design 16.16) — a fiókhoz tartozó valós üzletek ── */}
          {/* Telephelyek (16.16) — az ajánló (a design alján) élőben még nincs */}
          {active === 'sites' && (
            <SitesPage count={String(businessCount)} countLabel="Telephely a fiókban" plan={planLabel} contactHref="/kapcsolat" referral={<ReferralPanel className="mt-4" partnerHref={variant === 'restaurant' ? '/restaurant/partnerprogram' : '/dashboard/partnerprogram'} />}
              newHref={{ salon: '/register', restaurant: '/register-restaurant' }}
              rows={sites.map((x) => ({ key: `${x.type}:${x.id}`, name: x.name, meta: x.meta, logo: x.logoUrl, initials: x.initials, type: x.type, role: x.role, team: x.team, monthBookings: x.monthBookings, current: x.current, action: <SiteManageButton id={x.id} type={x.type} /> }))} />
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
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ui-dark p-1.5 pl-4 text-ui-body text-white shadow-ui-float"
          >
            {saved ? (
              <span className="flex items-center gap-1.5 py-1.5 pr-3 text-ui-yellow"><Check className="h-4 w-4" strokeWidth={2.2} />Mentve</span>
            ) : (
              <>
                <span className="mr-2 text-white/60">Mentetlen változások</span>
                <KitButton variant="ghostDark" size="sm" onClick={onCancel} disabled={!dirty || saving}>Elvetés</KitButton>
                <KitButton variant="yellow" size="sm" onClick={onSave} disabled={!dirty} loading={saving}>Mentés</KitButton>
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
/** Visszatekintési dátum-ablakok (nap). A 90 a szerver által adott maximum. */
const AUDIT_PAGE = 20
/** a fülek, amelyek már a design SettingsPage lapját használják (saját csoport + cím) — fölöttük nincs külön cím */
const PAGE_TABS = new Set<string>(['audit', 'sites', 'team', 'rules', 'email', 'payments', 'invoices', 'hours', 'documents', 'newsletter', 'deposit', 'vouchers', 'reviews', 'google', 'self', 'sites', 'notifications', 'integrations', 'tables', 'danger'])
const AUDIT_DAY_WINDOWS: (7 | 30 | 90)[] = [7, 30, 90]

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
/** `collapsed`-nél magasság+opacity szerint tűnik el (nem instant unmount) — így a rail
 *  összecsukása a csoport-címkék mentén is folyamatos animáció. */
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

  return <KitButton variant="cell" size="sm" onClick={handle} loading={loading}>Váltás</KitButton>
}
