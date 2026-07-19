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
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { SettingsFormContext, type SettingsFormApi } from './settingsFormContext'
import {
  Home, CalendarDays, Clock, Bell, Users, LayoutGrid, CreditCard, Download, Sparkles,
  Plus, ScrollText, KeyRound, Building2, Mail, Check, Languages, FileText,
  Trash2, X, Loader2, Pencil, ArrowRight, ChevronDown, SlidersHorizontal, UserRound, type LucideIcon,
} from 'lucide-react'
import { BookingFeatures, type FeatureModules } from '@/components/onboarding/BookingFeatures'
import { PushSubscribeToggle } from '@/components/dashboard/PushSubscribeToggle'
import { BillingPortalButton } from '@/components/dashboard/BillingPortalButton'

/* ── VALÓS beállítás-groupok (payload group-mezők, PATCH-elve a collection-endpointon) ── */
// Értesítések = CSAK tranzakciós email (emlékeztető/visszajelzés a Funkciók gazdája).
export type NotificationPrefs = {
  confirm_email: boolean
  cancel_email: boolean
}
// Foglalási szabályok = CSAK a valós, hatással bíró kapcsoló (auto_confirm). A deposit/no-show
// „Hamarosan", a várólista a Funkciók gazdája — ezért nincsenek itt.
export type BookingRulesToggles = {
  auto_confirm: boolean
}

/* ── davelopment gold-knob kapcsoló (46×27 sín) ─────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-ink-dark' : 'bg-[#DAD5C6]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[21px] w-[21px] rounded-full shadow-sm transition-all ${
          checked ? 'right-[3px] bg-gold' : 'left-[3px] bg-white'
        }`}
      />
    </button>
  )
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
    trialing:  { label: 'Próbaidőszak',   cls: 'bg-[#FDF3CF] text-[#8A6D12]' },
    active:    { label: 'Aktív',          cls: 'bg-[#E3F0D8] text-[#4A7A2A]' },
    past_due:  { label: 'Lejárt fizetés', cls: 'bg-[#FDE2DD] text-[#C0564A]' },
    canceled:  { label: 'Lemondva',       cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' },
    paused:    { label: 'Szüneteltetve',  cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' },
  }
  const { label, cls } = (status && cfg[status]) ?? { label: '—', cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' }
  return <span className={`inline-block rounded-[8px] px-2.5 py-[3px] text-[11px] font-semibold ${cls}`}>{label}</span>
}

/* ── Stat-kártya (FBF9F2, nagy vékony érték + egység) ───────────────────── */
function StatBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-[18px] bg-[#FBF9F2] p-4">
      <div className="text-[12.5px] font-medium text-ink-soft">{label}</div>
      <div className="mt-1 text-[26px] font-light tracking-[-0.02em] text-ink">
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-ink-soft">{unit}</span>}
      </div>
    </div>
  )
}

type RailId =
  | 'profile' | 'booking' | 'features' | 'languages' | 'email'
  | 'rules' | 'notifications' | 'team' | 'audit'
  | 'self' | 'documents' | 'billing' | 'sites'
  | 'integrations' | 'api' | 'danger'

// A bal lista mely elemei a MEGLÉVŐ profil-form egy-egy fülét mutatják (rail vezérli a fület).
const FORM_TABS: Record<string, string> = {
  profile: 'general', booking: 'booking', languages: 'languages',
  email: 'email', documents: 'documents', danger: 'danger',
}

// A kiválasztott szekció neve = a tartalom címe (mivel nincs felső fül-sor, ez jelzi „hol vagy").
const RAIL_LABELS: Record<RailId, string> = {
  profile: 'Üzlet profil', booking: 'Foglalás', features: 'Foglalási funkciók', languages: 'Nyelvek', email: 'Email-sablonok',
  rules: 'Foglalási szabályok', notifications: 'Értesítések', team: 'Csapat & jogok', audit: 'Audit-napló',
  self: 'Saját profil', documents: 'Dokumentumok', billing: 'Számlázás', sites: 'Telephelyek',
  integrations: 'Integrációk', api: 'API & webhookok', danger: 'Fiók törlése',
}

export interface RulesData {
  slotDurationMin: number | null   // idősáv hossza (turn_duration / vendéglátás)
  bufferMin: number | null         // buffer / puffer
  maxParty: number | null          // max létszám / foglalás (— ha nincs mező)
  leadTimeHours: number | null     // legkorábbi (— ha nincs)
  windowDays: number | null        // legkésőbbi (előre foglalható napok)
}

export interface BillingInvoice {
  date: string
  number: string
  plan: string
  amount: string
  status: string
  downloadUrl?: string | null
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
  subscriptionHref: string
  card: { brand: string; last4: string; expiry: string; holder: string } | null
  details: { legalName: string; taxNumber: string; address: string }
  invoices: BillingInvoice[]
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
}

/** Telephelyek — VALÓS: a fiók egy üzlete. */
export interface SiteData {
  initials: string
  name: string
  meta: string                     // „Budapest, V. · Király u. 8. · Étterem Pro"
  role: string                     // szerep (Tulajdonos)
  current?: boolean                // ez az aktuálisan megnyitott üzlet
  gold?: boolean                   // avatar arany háttér (nem-aktuális kiemeléshez)
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
  businessName: string
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
  /** Egyedi szerepek panel (2. fázis) — a Csapat tab alján renderelődik. */
  rolesSection?: ReactNode
  /** Egyedi szerepek (id + név) — a meghívó/tag-szerep legördülőhöz. */
  customRoles?: { id: string; name: string }[]
}

export function SettingsHub({
  variant, subtitle, availabilityHref, profilePanel, selfProfile, rules, senderLabel, billing,
  team, sites, businessCount, planLabel, apiBase, notificationPrefs, bookingRules,
  featureModules, auditLog, rolesSection, customRoles = [],
}: SettingsHubProps) {
  const router = useRouter()
  // Mély-link: a ?tab=… query kezdő-fület állít (pl. az avatar-popover / áttekintés a „self"-re nyit).
  const searchParams = useSearchParams()
  const initialTab = ((): RailId => {
    const t = searchParams.get('tab')
    return t && t in RAIL_LABELS ? (t as RailId) : 'profile'
  })()
  const [active, setActive] = useState<RailId>(initialTab)
  const [saving, setSaving] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false) // mobil szekció-választó legördülő

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

  const partyLabel = variant === 'salon' ? 'Max. létszám / foglalás' : 'Max. létszám / foglalás'

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
  const [ruleToggles, setRuleToggles] = useState({ autoConfirm: bookingRules.auto_confirm })
  const rulesBaseline = useMemo(() => ({ autoConfirm: bookingRules.auto_confirm }), [bookingRules])
  const rulesDirty = JSON.stringify(ruleToggles) !== JSON.stringify(rulesBaseline)
  const [rulesSaved, setRulesSaved] = useState(false)
  const saveRules = async () => {
    const ok = await patchGroup({ booking_rules: { auto_confirm: ruleToggles.autoConfirm } })
    if (ok) { setRulesSaved(true); setTimeout(() => setRulesSaved(false), 1800) }
  }
  const resetRules = () => setRuleToggles(rulesBaseline)

  // ── Értesítések — CSAK a tranzakciós emailek (visszaigazolás + lemondás). Az emlékeztető és a
  //    visszajelzés-kérés a Funkciók oldal gazdája (`feature_modules`), ezért ide már NEM kerül
  //    (megszűnt a dupla-gate). VALÓS `notification_prefs` group.
  const [notif, setNotif] = useState({
    confirm: { email: notificationPrefs.confirm_email },
    cancel: { email: notificationPrefs.cancel_email },
  })
  const notifBaseline = useMemo(() => ({
    confirm: { email: notificationPrefs.confirm_email },
    cancel: { email: notificationPrefs.cancel_email },
  }), [notificationPrefs])
  const notifDirty = JSON.stringify(notif) !== JSON.stringify(notifBaseline)
  const [notifSaved, setNotifSaved] = useState(false)
  const saveNotif = async () => {
    const ok = await patchGroup({
      notification_prefs: {
        confirm_email: notif.confirm.email,
        cancel_email: notif.cancel.email,
      },
    })
    if (ok) { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 1800) }
  }
  const resetNotif = () => setNotif(notifBaseline)
  const notifRows: { key: keyof typeof notif; title: string; sub: string }[] = [
    { key: 'confirm', title: 'Foglalás visszaigazolás', sub: 'Azonnal, .ics csatolmánnyal' },
    { key: 'cancel', title: 'Lemondás megerősítés', sub: 'Vendég lemondásakor' },
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
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  // Érték: `c:<roleId>` (a megadott egyedi szerepek közül). Nincs hardcoded szerep.
  const [inviteRole, setInviteRole] = useState<string>(customRoles[0] ? `c:${customRoles[0].id}` : '')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  const sendInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    if (!inviteRole.startsWith('c:')) { toast.error('Válassz szerepet (hozz létre egyet a lenti panelen)'); return }
    setInviteBusy(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, custom_role: inviteRole.slice(2) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Hiba')
      toast.success('Meghívó elküldve')
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole(customRoles[0] ? `c:${customRoles[0].id}` : '')
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

  const num = (n: number | null) => (n === null || n === undefined ? '—' : String(n))

  // A KÖZÖS lebegő mentés-sáv az AKTÍV panelhez kötődik: beágyazott profil-form fül (felfelé
  // jelentett állapot) / Értesítések / Foglalási szabályok. Egyetlen mentés-hely az egész oldalra.
  const saveForm = useCallback(async () => {
    const ok = await formApiRef.current?.save()
    if (ok) { setFormSaved(true); setTimeout(() => setFormSaved(false), 1800) }
  }, [])
  const activeBar =
    active in FORM_TABS
      ? { dirty: formDirty, saved: formSaved, onSave: saveForm, onCancel: () => formApiRef.current?.discard() }
      : active === 'notifications'
      ? { dirty: notifDirty, saved: notifSaved, onSave: saveNotif, onCancel: resetNotif }
      : active === 'rules'
      ? { dirty: rulesDirty, saved: rulesSaved, onSave: saveRules, onCancel: resetRules }
      : null

  // ── Navigáció adatvezérelten (a desktop rail ÉS a mobil legördülő EGY forrásból) ──
  type NavItem =
    | { kind: 'btn'; id: RailId; icon: LucideIcon; label: string; soon?: boolean }
    | { kind: 'link'; href: string; icon: LucideIcon; label: string }
  const navGroups: { group: string; items: NavItem[] }[] = [
    { group: 'Üzlet', items: [
      { kind: 'btn', id: 'profile', icon: Home, label: 'Üzlet profil' },
      { kind: 'btn', id: 'booking', icon: CalendarDays, label: 'Foglalás' },
      { kind: 'btn', id: 'rules', icon: Check, label: 'Foglalási szabályok' },
      { kind: 'btn', id: 'features', icon: SlidersHorizontal, label: 'Foglalási funkciók' },
      { kind: 'link', href: availabilityHref, icon: Clock, label: 'Nyitvatartás' },
      { kind: 'btn', id: 'languages', icon: Languages, label: 'Nyelvek' },
      { kind: 'btn', id: 'email', icon: Mail, label: 'Email-sablonok' },
    ] },
    { group: 'Működés', items: [
      { kind: 'btn', id: 'notifications', icon: Bell, label: 'Értesítések' },
      { kind: 'btn', id: 'team', icon: Users, label: 'Csapat & jogok' },
      { kind: 'btn', id: 'audit', icon: ScrollText, label: 'Audit-napló' },
    ] },
    { group: 'Fiók', items: [
      { kind: 'btn', id: 'self', icon: UserRound, label: 'Saját profil' },
      { kind: 'btn', id: 'documents', icon: FileText, label: 'Dokumentumok' },
      { kind: 'btn', id: 'billing', icon: CreditCard, label: 'Számlázás' },
      { kind: 'link', href: variant === 'restaurant' ? '/restaurant/subscription' : '/dashboard/subscription', icon: Sparkles, label: 'Előfizetés' },
      { kind: 'btn', id: 'sites', icon: Building2, label: 'Telephelyek' },
    ] },
    { group: 'Hamarosan', items: [
      { kind: 'btn', id: 'integrations', icon: LayoutGrid, label: 'Integrációk', soon: true },
      { kind: 'btn', id: 'api', icon: KeyRound, label: 'API & webhookok', soon: true },
    ] },
  ]
  const activeBtn = navGroups.flatMap((g) => g.items).find((it) => it.kind === 'btn' && it.id === active) as
    | Extract<NavItem, { kind: 'btn' }> | undefined
  const ActiveIcon = activeBtn?.icon ?? (active === 'danger' ? Trash2 : Home)

  return (
    <div className="space-y-5">
      {/* Fejléc — a mentés innen kikerült a KÖZÖS lebegő sávba (lásd lentebb). */}
      <div>
        <h1 className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[42px]">
          Beállítások
        </h1>
        <p className="mt-1.5 text-sm font-medium text-ink-soft">{subtitle}</p>
      </div>

      {/* Bal-sáv + panel */}
      <div className="lg:grid lg:grid-cols-[262px_1fr] lg:items-start lg:gap-[18px]">
        {/* RAIL — MOBIL: legördülő szekció-választó (a régi csúsztatható chip-sor helyett) */}
        <div className="relative mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-[18px] border border-line bg-white px-4 py-3.5 shadow-dav-card"
          >
            <span className="flex items-center gap-3 text-[15px] font-semibold text-ink">
              <ActiveIcon className="h-[18px] w-[18px] text-ink-soft2" strokeWidth={1.6} />
              {RAIL_LABELS[active]}
            </span>
            <ChevronDown className={`h-5 w-5 text-ink-soft2 transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} strokeWidth={1.8} />
          </button>
          <AnimatePresence>
            {mobileNavOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMobileNavOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  data-lenis-prevent
                  className="absolute inset-x-0 top-full z-40 mt-2 max-h-[62vh] overflow-y-auto rounded-[20px] border border-line bg-white p-2 shadow-[0_20px_50px_-20px_rgba(40,35,15,.4)]"
                >
                  {navGroups.map((grp) => (
                    <div key={grp.group}>
                      <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">{grp.group}</div>
                      {grp.items.map((it) => {
                        const Icon = it.icon
                        return it.kind === 'btn' ? (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => { setActive(it.id); setMobileNavOpen(false) }}
                            className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] ${active === it.id ? 'bg-ink-dark font-semibold text-white' : 'font-medium text-ink-soft'}`}
                          >
                            <Icon className={`h-[17px] w-[17px] ${active === it.id ? 'text-gold' : 'text-ink-soft2'}`} strokeWidth={1.5} />
                            {it.label}
                            {it.soon && (
                              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${active === it.id ? 'bg-white/15 text-white/80' : 'bg-[#F2ECDA] text-ink-soft'}`}>Hamarosan</span>
                            )}
                          </button>
                        ) : (
                          <Link
                            key={it.href}
                            href={it.href}
                            onClick={() => setMobileNavOpen(false)}
                            className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-medium text-ink-soft"
                          >
                            <Icon className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.5} />
                            {it.label}
                          </Link>
                        )
                      })}
                    </div>
                  ))}
                  <div className="my-1.5 h-px bg-line" />
                  <button
                    type="button"
                    onClick={() => { setActive('danger'); setMobileNavOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[14px] font-medium ${active === 'danger' ? 'bg-ink-dark text-white' : 'text-[#C0453F]'}`}
                  >
                    <Trash2 className={`h-[17px] w-[17px] ${active === 'danger' ? 'text-gold' : 'text-[#C0453F]'}`} strokeWidth={1.5} />
                    Fiók törlése
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* RAIL — DESKTOP: függőleges üveges sáv (a user kedvence) */}
        <nav
          data-lenis-prevent
          className="hidden lg:flex lg:flex-col lg:gap-[3px] lg:rounded-[24px] lg:bg-[var(--dav-glass)] lg:p-[11px] lg:shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_36px_-30px_rgba(80,70,30,0.18)]"
        >
          {navGroups.map((grp) => (
            <div key={grp.group} className="contents">
              <GroupLabel>{grp.group}</GroupLabel>
              {grp.items.map((it) => {
                const Icon = it.icon
                return it.kind === 'btn' ? (
                  <RailBtn key={it.id} id={it.id} active={active} onClick={setActive} icon={it.icon} label={it.label} soon={it.soon} />
                ) : (
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
          <div className="my-1.5 h-px bg-line" />
          <RailBtn id="danger" active={active} onClick={setActive} icon={Trash2} label="Fiók törlése" danger />
        </nav>

        {/* PANEL */}
        <div className="min-w-0">
          {/* Szekció-cím (desktop) — mobilon a legördülő gomb jelzi az aktív szekciót, itt elrejtjük. */}
          <h2 className="hidden text-[22px] font-medium tracking-[-0.01em] text-ink lg:mb-5 lg:block">{RAIL_LABELS[active]}</h2>

          {/* Profil-form (Üzlet profil / Foglalás / Nyelvek / Email / Dokumentumok / Fiók törlése):
              MINDIG mountolva marad (a mentetlen mezők ne vesszenek el lista-váltáskor), csak a
              láthatóságot váltjuk. A fület a bal lista vezérli — a formhoz CONTEXTen át jut le
              (RSC-határon a cloneElement-prop nem megbízható), így a form a saját fül-sorát is elrejti. */}
          <SettingsFormContext.Provider value={{ controlledTab: FORM_TABS[active] ?? 'general', reportDirty, registerApi }}>
            <div className={active in FORM_TABS ? '' : 'hidden'}>{profilePanel}</div>
          </SettingsFormContext.Provider>

          {/* ── Foglalási funkciók — a beágyazott BookingFeatures (önmentő, saját PATCH). ── */}
          {active === 'features' && (
            <BookingFeatures variant={variant} apiBase={apiBase} initial={featureModules} embedded />
          )}

          {active === 'rules' && (
            <div className="space-y-4">
              <Card>
                <div className="text-[17px] font-medium text-ink">Időzítés</div>
                <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <StatBox label="Idősáv hossza" value={num(rules.slotDurationMin)} unit="perc" />
                  <StatBox label="Buffer" value={num(rules.bufferMin)} unit="perc" />
                  <StatBox label={partyLabel} value={num(rules.maxParty)} unit={rules.maxParty === null ? undefined : 'fő'} />
                </div>
                <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StatBox
                    label="Legkorábbi foglalás"
                    value={rules.leadTimeHours === null ? '—' : `${rules.leadTimeHours} órával előtte`}
                  />
                  <StatBox
                    label="Legkésőbbi foglalás"
                    value={rules.windowDays === null ? '—' : `${rules.windowDays} nappal előre`}
                  />
                </div>
              </Card>

              {/* Toggle-lista — CSAK a valós, hatással bíró szabály (`auto_confirm`). Mentés a lebegő sávból. */}
              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                <RuleRow
                  title="Automatikus megerősítés"
                  desc="A foglalások emberi jóváhagyás nélkül visszaigazolódnak"
                  checked={ruleToggles.autoConfirm}
                  onChange={() => setRuleToggles((s) => ({ ...s, autoConfirm: !s.autoConfirm }))}
                  last
                />
              </div>

              {/* Várólista — a „Foglalási funkciók" szekció a gazdája (nincs duplázás), ide csak ugró-gomb. */}
              <button
                type="button"
                onClick={() => setActive('features')}
                className="flex w-full items-center justify-between gap-3 rounded-[26px] dav-card-glass px-6 py-4 text-left transition-colors hover:border-ink/20"
              >
                <div className="min-w-0">
                  <div className="text-[15px] font-medium text-ink">Várólista</div>
                  <div className="mt-0.5 text-[13px] text-ink-soft">
                    Feliratkozás telt háznál + automatikus előléptetés. A <b className="font-semibold text-ink-soft">Foglalási funkciók</b> szekcióban kapcsolható.
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
                  Megnyitás <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </button>

              {/* Depozit / no-show — őszinte „Hamarosan" (fizetési integráció kell, mint Integrációk/API). */}
              <div className="rounded-[26px] dav-card-glass px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium text-ink">Depozit & no-show védelem</span>
                  <span className="rounded-full bg-[#F2ECDA] px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.03em] text-ink-soft">Hamarosan</span>
                </div>
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  Előleg nagy foglalásokhoz és no-show elleni védelem — fizetési integrációval érkezik.
                </p>
              </div>

              <p className="px-1 text-xs text-ink-soft2">
                A pontos foglalási időzítést az „Üzlet profil → Foglalás" fülön mentheted.
              </p>
            </div>
          )}

          {active === 'notifications' && (
            <div className="space-y-4">
              {/* Eszköz-szintű PUSH (böngésző/OS) — az e-mail-mátrix fölött, mert ez a leggyorsabb csatorna. */}
              <PushSubscribeToggle />
              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                {/* fejléc-sor */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-soft2">Esemény</span>
                  <span className="text-center text-[12px] font-semibold uppercase text-ink-soft2">E-mail</span>
                </div>
                {notifRows.map((row, i) => (
                  <div
                    key={row.key}
                    className={`grid grid-cols-[1fr_84px] items-center gap-2 py-4 ${
                      i < notifRows.length - 1 ? 'border-b border-line' : ''
                    }`}
                  >
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
              <p className="px-1 text-xs text-ink-soft2">
                Itt csak a tranzakciós emailek (visszaigazolás, lemondás) kapcsolhatók. Az{' '}
                <b className="font-semibold text-ink-soft">emlékeztető</b> és a{' '}
                <b className="font-semibold text-ink-soft">visszajelzés-kérés</b> a{' '}
                <button
                  type="button"
                  onClick={() => setActive('features')}
                  className="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                >
                  Foglalási funkciók
                </button>{' '}
                szekcióban állítható (be/ki + időzítés). A sablonokat az „Üzlet profil → Email" fülön szerkeszted.
              </p>
            </div>
          )}

          {/* ── Csapat & jogok ── ref 536–556. VALÓS tulajdonos + membershipök. */}
          {active === 'team' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">
                  {team.filter((m) => !m.pending).length} tag
                  {team.some((m) => m.pending) && ` · ${team.filter((m) => m.pending).length} függő meghívó`}
                </p>
                <button
                  type="button"
                  onClick={() => setInviteOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-[18px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white"
                >
                  {inviteOpen ? <X className="h-[15px] w-[15px] text-gold" strokeWidth={2} /> : <Plus className="h-[15px] w-[15px] text-gold" strokeWidth={1.8} />}
                  {inviteOpen ? 'Mégse' : 'Tag meghívása'}
                </button>
              </div>

              {inviteOpen && (
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
                      disabled={customRoles.length === 0}
                      className="rounded-[14px] border border-line-strong bg-white px-4 py-3 text-[14px] font-medium text-ink outline-none transition-colors focus:border-gold/60 focus:ring-2 focus:ring-gold/25 disabled:opacity-50"
                    >
                      {customRoles.length === 0 && <option value="">Előbb hozz létre szerepet ↓</option>}
                      {customRoles.map((r) => (
                        <option key={r.id} value={`c:${r.id}`}>{r.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={sendInvite}
                      disabled={inviteBusy || !inviteEmail.trim() || !inviteRole.startsWith('c:')}
                      className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
                    >
                      {inviteBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Meghívó küldése
                    </button>
                  </div>
                </Card>
              )}

              <div className="rounded-[26px] dav-card-glass px-6 py-2">
                {team.map((m, i) => (
                  <div
                    key={(m.id ?? m.email) + i}
                    className={`flex flex-wrap items-center gap-3.5 py-[18px] ${i < team.length - 1 ? 'border-b border-line' : ''}`}
                  >
                    <Avatar name={m.name} email={m.email} pending={m.pending} gold={m.roleTone === 'manager'} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold text-ink">
                        {m.pending ? m.email : m.name}
                      </div>
                      <div className={`truncate text-[12.5px] ${m.pending ? 'text-[#C99A3A]' : 'text-ink-soft'}`}>
                        {m.pending ? 'Meghívó elküldve · függőben' : m.email}
                      </div>
                    </div>
                    {/* Státusz-LENYÍLÓ — a Munkatárs-adatlap (HiringView) státusz-menüjével AZONOS:
                        pill + ChevronDown, kattintásra „Aktív / Felfüggesztett" opciók (pipa a jelenlegin).
                        A route a staff.is_active-ot is szinkronizálja. Csak valódi tagnál (nem tulaj/meghívó). */}
                    {!m.pending && m.id && m.roleTone !== 'owner' && (
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
                    {/* A tulajdonos-sor (nincs id) csak badge; a tagoknál szerep-váltó + eltávolítás. */}
                    {m.roleTone === 'owner' || !m.id ? (
                      <RoleBadge role={m.role} tone={m.roleTone} pending={m.pending} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.customRoleId ? `c:${m.customRoleId}` : ''}
                          disabled={rowBusy === m.id || customRoles.length === 0}
                          onChange={(e) => changeRole(m.id!, e.target.value)}
                          className="rounded-[12px] border border-line-strong bg-white px-3 py-1.5 text-[12px] font-semibold text-ink outline-none transition-colors focus:border-gold/60 disabled:opacity-40"
                        >
                          {!m.customRoleId && <option value="" disabled>{m.role} (beépített)</option>}
                          {customRoles.map((r) => (
                            <option key={r.id} value={`c:${r.id}`}>{r.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(m.id!)}
                          disabled={rowBusy === m.id}
                          title="Eltávolítás"
                          className="rounded-[12px] border border-[rgba(192,57,43,.3)] p-2 text-[#C0392B] transition-opacity disabled:opacity-40"
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
              {rolesSection}
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

          {/* ── Integrációk ── ŐSZINTE „Hamarosan" üres állapot (nincs hamis connect-sor). */}
          {active === 'integrations' && (
            <ComingSoon
              icon={LayoutGrid}
              title="Integrációk hamarosan"
              body="Naptár-szinkron, marketing- és POS-integrációk fejlesztés alatt. Amint elérhetők, itt köthetők be egyetlen kattintással — addig nem mutatunk hamis csatlakozásokat."
            />
          )}

          {active === 'billing' && (
            <div className="space-y-4">

              {/* ── Csomag + státusz sor ── */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={billing.subscriptionStatus} />
                    <div>
                      <div className="text-[15px] font-semibold text-ink">{billing.planLabel}</div>
                      <div className="mt-0.5 text-[12px] text-ink-soft">
                        {billing.billingCycle === 'annual' ? 'Éves számlázás · 20% kedvezménnyel' : 'Havi számlázás'}
                        {billing.cancelAtPeriodEnd && ' · Lemondva, az időszak végéig aktív'}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={billing.subscriptionHref}
                    className="inline-flex items-center gap-1.5 rounded-dav-pill border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-paper"
                  >
                    Előfizetés kezelése <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>

              {/* ── Fizetési mód | Számlázási adatok ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
                <Card>
                  <div className="text-[17px] font-medium text-ink">Fizetési mód</div>

                  {billing.card ? (
                    <div className="mt-[18px] flex items-center gap-4">
                      <div className="flex h-[42px] w-[62px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-ink-dark to-[#3a3833]">
                        <span className="text-[11px] font-bold tracking-[0.06em] text-gold">{billing.card.brand}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-ink">•••• •••• •••• {billing.card.last4}</div>
                        <div className="mt-0.5 text-[12px] text-ink-soft">
                          Lejárat {billing.card.expiry}{billing.card.holder ? ` · ${billing.card.holder}` : ''}
                        </div>
                      </div>
                    </div>
                  ) : billing.subscriptionStatus === 'trialing' ? (
                    <p className="mt-[18px] text-sm text-ink-soft">
                      Próbaidőszakban vagy — bankkártya az előfizetés indításakor kerül rögzítésre.
                    </p>
                  ) : (
                    <p className="mt-[18px] text-sm text-ink-soft">
                      Nincs rögzített bankkártya.
                    </p>
                  )}

                  <div className="mt-[18px] flex items-center justify-between rounded-[16px] bg-[#FBF9F2] px-4 py-3.5">
                    <div>
                      <div className="text-[12px] text-ink-soft">
                        {billing.subscriptionStatus === 'trialing' ? 'Próbaidőszak vége' : 'Következő terhelés'}
                      </div>
                      <div className="mt-0.5 text-[14px] font-semibold text-ink">{billing.nextChargeDate ?? '—'}</div>
                    </div>
                    {billing.subscriptionStatus !== 'trialing' && (
                      <div className="text-[26px] font-light tracking-[-0.02em] text-ink">
                        {billing.nextChargeAmount}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    {billing.hasStripeCustomer ? (
                      <BillingPortalButton variant="link" label="Bankkártya csere · számlák · lemondás" />
                    ) : (
                      <Link
                        href={billing.subscriptionHref}
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold underline-offset-2 hover:underline"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Előfizetés indítása
                      </Link>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[17px] font-medium text-ink">Számlázási adatok</div>
                    <button
                      type="button"
                      onClick={() => setActive('profile')}
                      className="shrink-0 text-[12px] font-semibold text-ink-soft2 transition-colors hover:text-ink"
                    >
                      Szerkesztés
                    </button>
                  </div>
                  <div className="mt-[18px] flex flex-col gap-3.5">
                    <BillField label="Cégnév" value={billing.details.legalName} />
                    <BillField label="Adószám" value={billing.details.taxNumber} />
                    <BillField label="Cím" value={billing.details.address} />
                  </div>
                  <p className="mt-4 text-[11.5px] leading-relaxed text-ink-soft2">
                    Ezek az adatok kerülnek a kiállított számlákon. Módosításhoz: Üzlet profil → Jogi adatok.
                  </p>
                </Card>
              </div>

              {/* ── Számlák ── */}
              <Card>
                <div className="text-[17px] font-medium text-ink">Számlák</div>
                {billing.invoices.length === 0 ? (
                  <p className="mt-6 rounded-[16px] bg-[#FBF9F2] px-4 py-8 text-center text-sm text-ink-soft">
                    {billing.subscriptionStatus === 'trialing'
                      ? 'Próbaidőszak alatt nincs kiállított számla.'
                      : 'Még nincs kiállított számla.'}
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <div className="min-w-[560px]">
                      <div className="grid grid-cols-[1.1fr_1.2fr_1fr_.9fr_64px] gap-2 border-b border-line py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-soft2">
                        <span>Dátum</span><span>Számlaszám</span><span>Csomag</span><span>Összeg</span>
                        <span className="text-right">Állapot</span>
                      </div>
                      {billing.invoices.map((inv, i) => (
                        <div
                          key={`${inv.number}-${i}`}
                          className={`grid grid-cols-[1.1fr_1.2fr_1fr_.9fr_64px] items-center gap-2 py-[15px] ${
                            i < billing.invoices.length - 1 ? 'border-b border-line' : ''
                          }`}
                        >
                          <span className="text-[13px] font-medium text-ink">{inv.date}</span>
                          <span className="text-[12.5px] text-ink-soft">{inv.number}</span>
                          <span className="text-[12.5px] font-medium text-ink-soft">{inv.plan}</span>
                          <span className="text-[13px] font-semibold text-ink">{inv.amount}</span>
                          <span className="flex items-center justify-end gap-2">
                            <span className={`rounded-[7px] px-2.5 py-[3px] text-[10.5px] font-semibold ${
                              inv.status === 'Kifizetve'
                                ? 'bg-[rgba(63,184,113,.14)] text-[#2E9E63]'
                                : 'bg-[rgba(192,86,74,.12)] text-[#C0564A]'
                            }`}>
                              {inv.status}
                            </span>
                            {inv.downloadUrl ? (
                              <a href={inv.downloadUrl} target="_blank" rel="noopener noreferrer" aria-label="Letöltés">
                                <Download className="h-4 w-4 text-ink-soft transition-colors hover:text-ink" strokeWidth={1.7} />
                              </a>
                            ) : (
                              <Download className="h-4 w-4 text-ink-soft/30" strokeWidth={1.7} />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
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

          {/* ── API & webhookok ── ŐSZINTE „Hamarosan" üres állapot (nincs hamis kulcs/webhook). */}
          {active === 'api' && (
            <ComingSoon
              icon={KeyRound}
              title="API & webhookok hamarosan"
              body="Nyilvános REST API-kulcsok és esemény-webhookok fejlesztés alatt. Amint elérhetők, itt generálhatsz éles és teszt kulcsokat, és köthetsz be végpontokat — addig nem mutatunk hamis kulcsokat."
            />
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
                    <span
                      className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] text-[15px] font-semibold ${
                        s.gold ? 'bg-[#C9A24B] text-ink-dark' : 'bg-ink-dark text-gold'
                      }`}
                    >
                      {s.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-ink">{s.name}</span>
                        {s.current && (
                          <span className="rounded-[7px] bg-[rgba(241,206,69,.22)] px-2 py-0.5 text-[10px] font-semibold text-[#9A7B12]">
                            Jelenlegi
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">{s.meta}</div>
                    </div>
                    <span className="text-[12.5px] font-medium text-ink-soft">{s.role}</span>
                    <span className="rounded-[13px] border-[1.5px] border-line-strong px-4 py-2 text-[12px] font-semibold text-ink">
                      Kezelés
                    </span>
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
            transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.9 }}
            className="pointer-events-auto flex items-center gap-3 rounded-[18px] border border-line bg-white/85 py-2.5 pl-4 pr-2.5 shadow-[0_18px_40px_-20px_rgba(40,35,15,.45)] backdrop-blur-xl"
          >
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2E9E63]">
                <Check className="h-4 w-4" strokeWidth={2.2} /> Mentve
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                Mentetlen változások
              </span>
            )}
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
                className="rounded-[13px] bg-ink-dark px-5 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {saving ? 'Mentés…' : 'Mentés'}
              </button>
            </div>
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
  create: '#3FB871',
  update: '#E0A21B',
  delete: '#C0392B',
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

/* ── Őszinte „Hamarosan" üres-állapot (Integrációk / API & webhookok) ─────── */
function ComingSoon({ icon: Icon, title, body }: { icon: typeof Home; title: string; body: string }) {
  return (
    <div className="rounded-[26px] dav-card-glass px-6 py-14 text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#FBF9F2]">
        <Icon className="h-6 w-6 text-ink-soft2" strokeWidth={1.5} />
      </span>
      <div className="text-[17px] font-medium text-ink">{title}</div>
      <p className="mx-auto mt-2 max-w-[420px] text-[13px] leading-relaxed text-ink-soft">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#F2ECDA] px-3.5 py-1.5 text-[11px] font-semibold text-ink-soft">
        <Sparkles className="h-3.5 w-3.5 text-gold" /> Hamarosan
      </span>
    </div>
  )
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
  id, active, onClick, icon: Icon, label, soon, danger,
}: {
  id: RailId
  active: RailId
  onClick: (id: RailId) => void
  icon: typeof Home
  label: string
  soon?: boolean
  danger?: boolean
}) {
  const isActive = active === id
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex shrink-0 items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] transition-colors ${
        isActive
          ? 'bg-ink-dark font-semibold text-white'
          : danger
            ? 'font-medium text-[#C0453F] hover:bg-[#FBE3E3]'
            : 'font-medium text-ink-soft hover:text-ink'
      }`}
    >
      <Icon className={`h-[17px] w-[17px] ${isActive ? 'text-gold' : danger ? 'text-[#C0453F]' : 'text-ink-soft2'}`} strokeWidth={1.5} />
      {label}
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
function Avatar({ name, email, pending, gold }: { name: string; email: string; pending?: boolean; gold?: boolean }) {
  if (pending) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDE7D6]">
        <Mail className="h-[18px] w-[18px] text-ink-soft2" strokeWidth={1.6} />
      </span>
    )
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

function BillField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[12px] font-medium text-ink-soft">{label}</div>
      <div className="text-[13.5px] font-medium text-ink">{value || '—'}</div>
    </div>
  )
}
