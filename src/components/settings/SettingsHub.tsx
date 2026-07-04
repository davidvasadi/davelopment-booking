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
import { useRouter } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { SettingsFormContext } from './settingsFormContext'
import {
  Home, CalendarDays, Clock, Bell, Users, LayoutGrid, CreditCard, Download, Sparkles,
  Plus, ScrollText, KeyRound, Building2, Mail, Check, Languages, FileText,
  Trash2, X, Loader2,
} from 'lucide-react'

/* ── VALÓS beállítás-groupok (payload group-mezők, PATCH-elve a collection-endpointon) ── */
export type NotificationPrefs = {
  confirm_email: boolean
  reminder_email: boolean
  cancel_email: boolean
  feedback_email: boolean
}
export type BookingRulesToggles = {
  auto_confirm: boolean
  deposit_enabled: boolean
  waitlist_enabled: boolean
  cancellation_protection: boolean
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

/* ── Fehér kártya (26px sugár, dav árnyék) ──────────────────────────────── */
function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[26px] border border-line bg-white p-6 shadow-dav-card ${className}`}>
      {children}
    </div>
  )
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
  | 'profile' | 'booking' | 'languages' | 'email'
  | 'rules' | 'notifications' | 'team' | 'audit'
  | 'documents' | 'billing' | 'sites'
  | 'integrations' | 'api' | 'danger'

// A bal lista mely elemei a MEGLÉVŐ profil-form egy-egy fülét mutatják (rail vezérli a fület).
const FORM_TABS: Record<string, string> = {
  profile: 'general', booking: 'booking', languages: 'languages',
  email: 'email', documents: 'documents', danger: 'danger',
}

// A kiválasztott szekció neve = a tartalom címe (mivel nincs felső fül-sor, ez jelzi „hol vagy").
const RAIL_LABELS: Record<RailId, string> = {
  profile: 'Üzlet profil', booking: 'Foglalás', languages: 'Nyelvek', email: 'Email-sablonok',
  rules: 'Foglalási szabályok', notifications: 'Értesítések', team: 'Csapat & jogok', audit: 'Audit-napló',
  documents: 'Dokumentumok', billing: 'Számlázás', sites: 'Telephelyek',
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
}

export interface BillingData {
  planLabel: string                // fizetési mód alatti csomag felirat (subtitle-ből)
  nextChargeDate: string | null
  nextChargeAmount: string         // pl. „12 900 Ft"
  card: { brand: string; last4: string; expiry: string; holder: string } | null
  details: { legalName: string; taxNumber: string; address: string }
  invoices: BillingInvoice[]
}

/** Csapat & jogok — egy tag. VALÓS adatból (tulajdonos + membershipök). */
export interface TeamMember {
  id?: string                      // membership id (a tulaj-sornak nincs → nem kezelhető)
  name: string
  email: string
  role: string                     // szerep-felirat (Tulajdonos / Menedzser / …)
  roleTone: 'owner' | 'manager' | 'staff'
  pending?: boolean                // függő meghívó sor
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

/** Audit-napló — egy VALÓS bejegyzés (az AuditLog collectionből, üzletre szűrve). */
export interface AuditEntry {
  id: string
  actor: string                    // végrehajtó felirat (email/név vagy „Rendszer")
  action: 'create' | 'update' | 'delete'
  summary: string                  // olvasható összegzés, pl. „Foglalás módosítva — Nagy Péter"
  collection: string               // érintett collection-felirat
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
  profilePanel: ReactNode          // a MEGLÉVŐ settings-form (Üzlet profil)
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
}

export function SettingsHub({
  variant, subtitle, availabilityHref, profilePanel, rules, senderLabel, billing,
  team, sites, businessCount, planLabel, apiBase, notificationPrefs, bookingRules,
  auditLog,
}: SettingsHubProps) {
  const router = useRouter()
  const [active, setActive] = useState<RailId>('profile')
  const [saving, setSaving] = useState(false)

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

  // ── Foglalási szabályok toggle-lista — VALÓS `booking_rules` group.
  const [ruleToggles, setRuleToggles] = useState({
    autoConfirm: bookingRules.auto_confirm,
    deposit: bookingRules.deposit_enabled,
    waitlist: bookingRules.waitlist_enabled,
    cancelProtection: bookingRules.cancellation_protection,
  })
  const rulesBaseline = useMemo(() => ({
    autoConfirm: bookingRules.auto_confirm,
    deposit: bookingRules.deposit_enabled,
    waitlist: bookingRules.waitlist_enabled,
    cancelProtection: bookingRules.cancellation_protection,
  }), [bookingRules])
  const rulesDirty = JSON.stringify(ruleToggles) !== JSON.stringify(rulesBaseline)
  const [rulesSaved, setRulesSaved] = useState(false)
  const saveRules = async () => {
    const ok = await patchGroup({
      booking_rules: {
        auto_confirm: ruleToggles.autoConfirm,
        deposit_enabled: ruleToggles.deposit,
        waitlist_enabled: ruleToggles.waitlist,
        cancellation_protection: ruleToggles.cancelProtection,
      },
    })
    if (ok) { setRulesSaved(true); setTimeout(() => setRulesSaved(false), 1800) }
  }
  const resetRules = () => setRuleToggles(rulesBaseline)

  // ── Értesítések ESEMÉNY × E-MAIL mátrix — VALÓS `notification_prefs` group (email-only).
  const [notif, setNotif] = useState({
    confirm: { email: notificationPrefs.confirm_email },
    reminder: { email: notificationPrefs.reminder_email },
    cancel: { email: notificationPrefs.cancel_email },
    feedback: { email: notificationPrefs.feedback_email },
  })
  const notifBaseline = useMemo(() => ({
    confirm: { email: notificationPrefs.confirm_email },
    reminder: { email: notificationPrefs.reminder_email },
    cancel: { email: notificationPrefs.cancel_email },
    feedback: { email: notificationPrefs.feedback_email },
  }), [notificationPrefs])
  const notifDirty = JSON.stringify(notif) !== JSON.stringify(notifBaseline)
  const [notifSaved, setNotifSaved] = useState(false)
  const saveNotif = async () => {
    const ok = await patchGroup({
      notification_prefs: {
        confirm_email: notif.confirm.email,
        reminder_email: notif.reminder.email,
        cancel_email: notif.cancel.email,
        feedback_email: notif.feedback.email,
      },
    })
    if (ok) { setNotifSaved(true); setTimeout(() => setNotifSaved(false), 1800) }
  }
  const resetNotif = () => setNotif(notifBaseline)
  const notifRows: { key: keyof typeof notif; title: string; sub: string }[] = [
    { key: 'confirm', title: 'Foglalás visszaigazolás', sub: 'Azonnal, .ics csatolmánnyal' },
    { key: 'reminder', title: 'Emlékeztető', sub: '3 órával a foglalás előtt' },
    { key: 'cancel', title: 'Lemondás megerősítés', sub: 'Vendég lemondásakor' },
    { key: 'feedback', title: 'Visszajelzés-kérés', sub: 'A látogatás után 1 nappal' },
  ]

  // ── Audit-napló szűrő — kliens-oldali szűrés a VALÓS bejegyzéseken (akció-típus szerint).
  const [auditFilter, setAuditFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all')
  const filteredAudit = useMemo(
    () => (auditFilter === 'all' ? auditLog : auditLog.filter((e) => e.action === auditFilter)),
    [auditFilter, auditLog],
  )

  // ── Csapat & jogok — VALÓS bekötés a /api/team végpontokra.
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const sendInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    setInviteBusy(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Hiba')
      toast.success('Meghívó elküldve')
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('staff')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setInviteBusy(false)
    }
  }

  const changeRole = async (id: string, role: 'manager' | 'staff') => {
    setRowBusy(id)
    try {
      const res = await fetch(`/api/team/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
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

  const num = (n: number | null) => (n === null || n === undefined ? '—' : String(n))

  // A fejléc Mégse/Mentés gombja az AKTÍV panelhez kötődik (Értesítések / Foglalási szabályok).
  const headerSave =
    active === 'notifications'
      ? { dirty: notifDirty, saved: notifSaved, onSave: saveNotif, onCancel: resetNotif }
      : active === 'rules'
      ? { dirty: rulesDirty, saved: rulesSaved, onSave: saveRules, onCancel: resetRules }
      : null

  return (
    <div className="space-y-5">
      {/* Fejléc */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[42px]">
            Beállítások
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-soft">{subtitle}</p>
        </div>
        {headerSave && (
          <div className="flex items-center gap-2.5">
            {headerSave.saved && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2E9E63]">
                <Check className="h-4 w-4" strokeWidth={2.2} /> Mentve
              </span>
            )}
            <button
              type="button"
              onClick={headerSave.onCancel}
              disabled={!headerSave.dirty || saving}
              className="rounded-[14px] border-[1.5px] border-line-strong px-5 py-2.5 text-[13px] font-semibold text-ink transition-opacity disabled:opacity-40"
            >
              Mégse
            </button>
            <button
              type="button"
              onClick={headerSave.onSave}
              disabled={!headerSave.dirty || saving}
              className="rounded-[14px] bg-ink-dark px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {saving ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        )}
      </div>

      {/* Bal-sáv + panel */}
      <div className="lg:grid lg:grid-cols-[262px_1fr] lg:items-start lg:gap-[18px]">
        {/* RAIL — desktop függőleges, mobil vízszintes chip-sor */}
        <nav
          data-lenis-prevent
          className="-mx-5 mb-4 flex gap-1.5 overflow-x-auto px-5 pb-1 no-scrollbar lg:mx-0 lg:mb-0 lg:flex-col lg:gap-[3px] lg:overflow-visible lg:rounded-[24px] lg:border lg:border-line lg:bg-[var(--dav-glass)] lg:p-[11px]"
        >
          {/* ── ÜZLET ── */}
          <GroupLabel>Üzlet</GroupLabel>
          <RailBtn id="profile" active={active} onClick={setActive} icon={Home} label="Üzlet profil" />
          <RailBtn id="booking" active={active} onClick={setActive} icon={CalendarDays} label="Foglalás" />
          <RailBtn id="rules" active={active} onClick={setActive} icon={Check} label="Foglalási szabályok" />
          {/* Nyitvatartás → külső link a meglévő availability oldalra (nem panel) */}
          <Link
            href={availabilityHref}
            className="flex shrink-0 items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink lg:px-3.5"
          >
            <Clock className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.5} />
            Nyitvatartás
          </Link>
          <RailBtn id="languages" active={active} onClick={setActive} icon={Languages} label="Nyelvek" />
          <RailBtn id="email" active={active} onClick={setActive} icon={Mail} label="Email-sablonok" />

          {/* ── MŰKÖDÉS ── */}
          <GroupLabel>Működés</GroupLabel>
          <RailBtn id="notifications" active={active} onClick={setActive} icon={Bell} label="Értesítések" />
          <RailBtn id="team" active={active} onClick={setActive} icon={Users} label="Csapat & jogok" />
          <RailBtn id="audit" active={active} onClick={setActive} icon={ScrollText} label="Audit-napló" />

          {/* ── FIÓK ── */}
          <GroupLabel>Fiók</GroupLabel>
          <RailBtn id="documents" active={active} onClick={setActive} icon={FileText} label="Dokumentumok" />
          <RailBtn id="billing" active={active} onClick={setActive} icon={CreditCard} label="Számlázás" />
          {/* Előfizetés → külső link az Előfizetés oldalra (nem panel) — egységes név az avatar-menüvel */}
          <Link
            href={variant === 'restaurant' ? '/restaurant/subscription' : '/dashboard/subscription'}
            className="flex shrink-0 items-center gap-3 rounded-[16px] px-3.5 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink lg:px-3.5"
          >
            <Sparkles className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.5} />
            Előfizetés
          </Link>
          <RailBtn id="sites" active={active} onClick={setActive} icon={Building2} label="Telephelyek" />

          {/* ── HAMAROSAN (placeholderek) ── */}
          <GroupLabel>Hamarosan</GroupLabel>
          <RailBtn id="integrations" active={active} onClick={setActive} icon={LayoutGrid} label="Integrációk" soon />
          <RailBtn id="api" active={active} onClick={setActive} icon={KeyRound} label="API & webhookok" soon />

          {/* ── Veszélyzóna (legalul, elválasztva) ── */}
          <div className="my-1.5 hidden h-px bg-line lg:block" />
          <RailBtn id="danger" active={active} onClick={setActive} icon={Trash2} label="Fiók törlése" danger />
        </nav>

        {/* PANEL */}
        <div className="min-w-0">
          {/* Szekció-cím = a kiválasztott bal-lista elem neve (a felső fül-sor helyett jelzi, hol vagy). */}
          <h2 className="mb-4 text-[22px] font-medium tracking-[-0.01em] text-ink lg:mb-5">{RAIL_LABELS[active]}</h2>

          {/* Profil-form (Üzlet profil / Foglalás / Nyelvek / Email / Dokumentumok / Fiók törlése):
              MINDIG mountolva marad (a mentetlen mezők ne vesszenek el lista-váltáskor), csak a
              láthatóságot váltjuk. A fület a bal lista vezérli — a formhoz CONTEXTen át jut le
              (RSC-határon a cloneElement-prop nem megbízható), így a form a saját fül-sorát is elrejti. */}
          <SettingsFormContext.Provider value={{ controlledTab: FORM_TABS[active] ?? 'general' }}>
            <div className={active in FORM_TABS ? '' : 'hidden'}>{profilePanel}</div>
          </SettingsFormContext.Provider>

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

              {/* Toggle-lista — VALÓS `booking_rules` group (fejléc Mentés-gomb menti) */}
              <div className="rounded-[26px] border border-line bg-white px-6 py-2 shadow-dav-card">
                <RuleRow
                  title="Automatikus megerősítés"
                  desc="A foglalások emberi jóváhagyás nélkül visszaigazolódnak"
                  checked={ruleToggles.autoConfirm}
                  onChange={() => setRuleToggles((s) => ({ ...s, autoConfirm: !s.autoConfirm }))}
                />
                <RuleRow
                  title="Depozit nagy foglalásokra"
                  desc="Nagy létszám felett előleg a foglaláshoz"
                  checked={ruleToggles.deposit}
                  onChange={() => setRuleToggles((s) => ({ ...s, deposit: !s.deposit }))}
                />
                <RuleRow
                  title="Lemondás & no-show védelem"
                  desc="Ingyenes lemondás megadott időn belül"
                  checked={ruleToggles.cancelProtection}
                  onChange={() => setRuleToggles((s) => ({ ...s, cancelProtection: !s.cancelProtection }))}
                  last
                />
              </div>
              <p className="px-1 text-xs text-ink-soft2">
                A pontos foglalási időzítést az „Üzlet profil → Foglalás" fülön mentheted.
              </p>
            </div>
          )}

          {active === 'notifications' && (
            <div className="space-y-4">
              <div className="rounded-[26px] border border-line bg-white px-6 py-2 shadow-dav-card">
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
                A visszaigazoló email tartalmát és feladóját az „Üzlet profil → Email" fülön szerkesztheted.
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
                      className="min-w-0 flex-1 rounded-[14px] border border-line-strong bg-[#FBF9F2] px-4 py-3 text-[14px] text-ink outline-none focus:border-ink-soft"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'manager' | 'staff')}
                      className="rounded-[14px] border border-line-strong bg-[#FBF9F2] px-4 py-3 text-[14px] font-medium text-ink outline-none"
                    >
                      <option value="staff">Munkatárs</option>
                      <option value="manager">Menedzser</option>
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
                </Card>
              )}

              <div className="rounded-[26px] border border-line bg-white px-6 py-2 shadow-dav-card">
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
                    {/* A tulajdonos-sor (nincs id) csak badge; a tagoknál szerep-váltó + eltávolítás. */}
                    {m.roleTone === 'owner' || !m.id ? (
                      <RoleBadge role={m.role} tone={m.roleTone} pending={m.pending} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.roleTone === 'manager' ? 'manager' : 'staff'}
                          disabled={rowBusy === m.id}
                          onChange={(e) => changeRole(m.id!, e.target.value as 'manager' | 'staff')}
                          className="rounded-[12px] border border-line-strong bg-[#FBF9F2] px-3 py-1.5 text-[12px] font-semibold text-ink outline-none disabled:opacity-40"
                        >
                          <option value="staff">Munkatárs</option>
                          <option value="manager">Menedzser</option>
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
                <Card>
                  <div className="text-[17px] font-medium text-ink">Fizetési mód</div>
                  {billing.card ? (
                    <div className="mt-[18px] flex items-center gap-4">
                      <div className="flex h-[42px] w-[62px] items-center justify-center rounded-[10px] bg-gradient-to-br from-ink-dark to-[#3a3833]">
                        <span className="text-[11px] font-bold tracking-[0.06em] text-gold">{billing.card.brand}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold text-ink">•••• •••• •••• {billing.card.last4}</div>
                        <div className="mt-0.5 text-[12px] text-ink-soft">Lejárat {billing.card.expiry} · {billing.card.holder}</div>
                      </div>
                      <span className="rounded-[13px] border-[1.5px] border-line-strong px-4 py-2 text-[12px] font-semibold text-ink">Csere</span>
                    </div>
                  ) : (
                    <p className="mt-[18px] text-sm text-ink-soft">
                      Nincs rögzített fizetési mód. Az előfizetés kezelése a Számlázás oldalon.
                    </p>
                  )}
                  <div className="mt-[18px] flex items-center justify-between rounded-[16px] bg-[#FBF9F2] px-4 py-3.5">
                    <div>
                      <div className="text-[12px] text-ink-soft">Következő terhelés</div>
                      <div className="mt-0.5 text-[14px] font-semibold text-ink">{billing.nextChargeDate ?? '—'}</div>
                    </div>
                    <div className="text-[26px] font-light tracking-[-0.02em] text-ink">
                      {billing.nextChargeAmount}
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="text-[17px] font-medium text-ink">Számlázási adatok</div>
                  <div className="mt-[18px] flex flex-col gap-3.5">
                    <BillField label="Cégnév" value={billing.details.legalName} />
                    <BillField label="Adószám" value={billing.details.taxNumber} />
                    <BillField label="Cím" value={billing.details.address} />
                  </div>
                </Card>
              </div>

              <Card>
                <div className="flex items-center justify-between">
                  <div className="text-[17px] font-medium text-ink">Számlák</div>
                  {billing.invoices.length > 0 && (
                    <span className="rounded-[12px] border-[1.5px] border-line-strong px-3.5 py-2 text-[12px] font-semibold text-ink">
                      Összes letöltése
                    </span>
                  )}
                </div>
                {billing.invoices.length === 0 ? (
                  <p className="mt-6 rounded-[16px] bg-[#FBF9F2] px-4 py-8 text-center text-sm text-ink-soft">
                    Még nincs kiállított számla.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <div className="min-w-[560px]">
                      <div className="grid grid-cols-[1.1fr_1.2fr_1fr_.9fr_70px] gap-2 border-b border-line py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-soft2">
                        <span>Dátum</span><span>Számlaszám</span><span>Csomag</span><span>Összeg</span>
                        <span className="text-right">Állapot</span>
                      </div>
                      {billing.invoices.map((inv, i) => (
                        <div
                          key={inv.number}
                          className={`grid grid-cols-[1.1fr_1.2fr_1fr_.9fr_70px] items-center gap-2 py-[15px] ${
                            i < billing.invoices.length - 1 ? 'border-b border-line' : ''
                          }`}
                        >
                          <span className="text-[13px] font-medium text-ink">{inv.date}</span>
                          <span className="text-[12.5px] text-ink-soft">{inv.number}</span>
                          <span className="text-[12.5px] font-medium text-ink-soft">{inv.plan}</span>
                          <span className="text-[13px] font-semibold text-ink">{inv.amount}</span>
                          <span className="flex items-center justify-end gap-2.5">
                            <span className="rounded-[7px] bg-[rgba(63,184,113,.14)] px-2.5 py-[3px] text-[10.5px] font-semibold text-[#2E9E63]">
                              {inv.status}
                            </span>
                            <Download className="h-4 w-4 text-ink-soft" strokeWidth={1.7} />
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
                  {auditLog.length} bejegyzés
                </span>
              </div>
              <div className="rounded-[26px] border border-line bg-white p-5 shadow-dav-card">
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
              </div>
              {filteredAudit.length === 0 ? (
                <div className="rounded-[26px] border border-line bg-white px-6 py-12 text-center shadow-dav-card">
                  <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#FBF9F2]">
                    <ScrollText className="h-5 w-5 text-ink-soft2" strokeWidth={1.6} />
                  </span>
                  <p className="text-sm font-medium text-ink-soft">Még nincs naplózott esemény</p>
                </div>
              ) : (
                <div className="rounded-[26px] border border-line bg-white px-6 py-2 shadow-dav-card">
                  {filteredAudit.map((e, i) => {
                    const color = AUDIT_ACTION_COLOR[e.action]
                    return (
                      <div
                        key={e.id}
                        className={`flex gap-3.5 py-4 ${i < filteredAudit.length - 1 ? 'border-b border-line' : ''}`}
                      >
                        <span
                          className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
                          style={{ background: `${color}1f` }}
                        >
                          <span className="h-[9px] w-[9px] rounded-full" style={{ background: color }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] leading-snug text-ink">
                            <b className="font-semibold">{e.actor}</b>{' '}
                            <span className="text-ink-soft">{e.summary || AUDIT_ACTION_LABEL[e.action]}</span>
                          </div>
                          <div className="mt-1 text-[11.5px] text-ink-soft2">{relativeTime(e.createdAt)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
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

              <div className="rounded-[26px] border border-line bg-white px-6 py-2 shadow-dav-card">
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
        </div>
      </div>
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
    <div className="rounded-[26px] border border-line bg-white px-6 py-14 text-center shadow-dav-card">
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
