'use client'

/**
 * ÉTTEREM MUNKATÁRSAK — a csapat-tagok (memberships) kártyás listája a szalon
 * StaffManager stílusában (üveg-kártyák, avatar-monogram, szerep/státusz badge).
 * A tulajdonos mindig az első kártya „Tulajdonos"-ként (az owner mezőből, nem membership).
 * Meghívás a MEGLÉVŐ /api/team/invite flow-n, szerep-váltás/eltávolítás a
 * /api/team/members/[id]-n. SMS sehol; valós adat + CRUD.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, X, Search, Download, ChevronDown, Check } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { HiringOverlay } from '@/components/dashboard/HiringOverlay'
import type { Employee } from '@/components/dashboard/HiringView'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface TeamCard {
  id: string | null // membership id; a tulaj-sornak null (nem kezelhető)
  name: string
  email: string
  avatarUrl?: string | null // valós profilkép (media / Google avatar); null → monogram
  roleTone: 'owner' | 'manager' | 'staff'
  roleName?: string | null // a megadott (egyedi) szerep NEVE; ha nincs, a roleTone címkéje jelenik meg
  pending: boolean
  status: 'active' | 'invited' | 'suspended'
  joinDate: string | null
}

/** A soron megjelenített szerep-címke: az egyedi szerep neve, különben a tone alap-címkéje. */
function roleLabelOf(t: TeamCard): string {
  return t.roleName || ROLE_LABEL[t.roleTone]
}

/** Felfüggesztett sávozott (hatch) minta — a pill ÉS az EGÉSZ SOR is ezt kapja (mint a kijelölés-sárga, csak szaggatva). */
const SUSPEND_HATCH = 'repeating-linear-gradient(115deg, rgba(255,255,255,.6), rgba(255,255,255,.6) 7px, rgba(190,180,140,.16) 7px, rgba(190,180,140,.16) 14px)'

/** Státusz-pill kinézete. A FELFÜGGESZTETT sávozott + halványabb. */
function statusPill(status: TeamCard['status']): { label: string; bg: string; color: string; border?: string; dot: string } {
  if (status === 'suspended')
    return { label: 'Felfüggesztett', bg: SUSPEND_HATCH, color: '#8A8779', border: '1px solid var(--dav-line)', dot: '#B7B2A4' }
  if (status === 'invited') return { label: 'Függő', bg: '#FBEFC4', color: '#9A7B1E', dot: '#C9A227' }
  return { label: 'Aktív', bg: '#E7F1E9', color: '#3B6B4B', dot: '#4F9E6A' }
}

const ROLE_LABEL: Record<'owner' | 'manager' | 'staff', string> = {
  owner: 'Tulajdonos',
  manager: 'Vezető',
  staff: 'Dolgozó',
}

const AVATAR_GRADIENTS = [
  { bg: 'linear-gradient(140deg,#EEBE8A,#DF9F61)', fg: '#5A3A1A' },
  { bg: 'linear-gradient(140deg,#B4C49A,#9DB07E)', fg: '#33401E' },
  { bg: 'linear-gradient(140deg,#D2A6BE,#BE89A6)', fg: '#5A2A45' },
  { bg: 'linear-gradient(140deg,#9FBAD1,#7E9EBE)', fg: '#1E3140' },
  { bg: 'linear-gradient(140deg,#D1C39F,#BEAD7E)', fg: '#40381E' },
]
function gradientFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function RestaurantTeamManager({ initialTeam, employees, customRoles = [], canManage = false, canEditSalary = false }: { initialTeam: TeamCard[]; employees?: Employee[]; customRoles?: { id: string; name: string }[]; canManage?: boolean; canEditSalary?: boolean }) {
  const [team, setTeam] = useState<TeamCard[]>(initialTeam)
  // A roster (adatlap-adatok) helyi state — profil-szerkesztés után újranyitáskor is friss.
  const [roster, setRoster] = useState<Employee[]>(employees ?? [])
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  // Egységes szerep-modell: a meghívás a Beállításokban megadott (egyedi) szerepek közül választ.
  // A szerep NEVE a pozíció, a JOGAI a jogosultság — nincs külön kategória.
  const [roleId, setRoleId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all')
  // Egységes: a szerep-szűrő a TÉNYLEGES szerep-nevekre szűr (amit a kártya is mutat), nem beépített tone-okra.
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Melyik tag státusz-menüje van nyitva (választás, nem instant-toggle → nem lehet elütni).
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null)
  // Sorra kattintva nyílik a Munkavállalók-adatlap overlay (a kattintott sor indexével előre-kiválasztva).
  const [hiringIndex, setHiringIndex] = useState<number | null>(null)

  const memberCount = team.filter((t) => t.roleTone !== 'owner').length
  const activeCount = team.filter((t) => !t.pending).length
  const pendingCount = team.filter((t) => t.pending).length
  const totalTeam = team.length
  // Szerep-megoszlás a pillekhez: a felirat a DARABSZÁM, a szélesség a total-arányos %.
  const ownerNum = team.filter((t) => t.roleTone === 'owner').length
  const managerNum = team.filter((t) => t.roleTone === 'manager').length
  const staffNum = team.filter((t) => t.roleTone === 'staff').length
  const ownerPct = totalTeam ? Math.round((ownerNum / totalTeam) * 100) : 0
  const managerPct = totalTeam ? Math.round((managerNum / totalTeam) * 100) : 0
  const staffPct = totalTeam ? Math.round((staffNum / totalTeam) * 100) : 0
  // A szerep-szűrő opciói: a csapatban ELŐFORDULÓ tényleges szerep-nevek (Tulajdonos + egyedi szerepek).
  const roleFilterOptions = Array.from(new Set(team.map(roleLabelOf).filter(Boolean)))

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'
  const filtered = team.filter((t) => {
    if (statusFilter === 'active' && t.pending) return false
    if (statusFilter === 'pending' && !t.pending) return false
    if (roleFilter !== 'all' && roleLabelOf(t) !== roleFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || roleLabelOf(t).toLowerCase().includes(q)
  })
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const GRID = 'grid-cols-[34px_1.8fr_1.4fr_1fr_150px]'

  const invite = async () => {
    const em = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      toast.error('Érvényes email cím szükséges')
      return
    }
    if (!roleId) { toast.error('Válassz szerepet (a Beállítások → Csapatban hozol létre)'); return }
    setSubmitting(true)
    try {
      // Egységes modell: a megadott (egyedi) szerep dönt — a NEVE a pozíció, a JOGAI a jogosultság.
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: em, custom_role: roleId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Hiba')
      }
      setTeam((prev) => [...prev, { id: `tmp-${em}`, name: em, email: em, roleTone: 'staff', pending: true, status: 'invited', joinDate: null }])
      setOpen(false)
      setEmail('')
      setRoleId('')
      toast.success('Meghívó elküldve')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A meghívás sikertelen')
    } finally {
      setSubmitting(false)
    }
  }

  // Eltávolítás — SAJÁT megerősítő modal (nem a natív böngésző-confirm).
  const [removeTarget, setRemoveTarget] = useState<TeamCard | null>(null)

  async function confirmRemove() {
    const m = removeTarget
    if (!m?.id || m.id.startsWith('tmp-')) { setRemoveTarget(null); return }
    setBusyId(m.id)
    try {
      const res = await fetch(`/api/team/members/${m.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setTeam((prev) => prev.filter((x) => x.id !== m.id))
      toast.success('Eltávolítva')
      setRemoveTarget(null)
    } catch {
      toast.error('Az eltávolítás sikertelen')
    } finally {
      setBusyId(null)
    }
  }

  // Státusz-váltás (aktív ↔ felfüggesztett) — tulaj/vezető. A felfüggesztett tag kiesik a rendszerből.
  async function changeStatus(m: TeamCard, status: 'active' | 'suspended') {
    if (!m.id || m.id.startsWith('tmp-')) return
    setBusyId(m.id)
    try {
      const res = await fetch(`/api/team/members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      const today = new Date().toISOString().slice(0, 10)
      setTeam((prev) => prev.map((x) => (x.id === m.id ? { ...x, status, pending: false } : x)))
      setRoster((prev) => prev.map((e) => (e.id === m.id ? { ...e, status, hr: { ...e.hr, suspended_at: status === 'suspended' ? today : null } } : e)))
      toast.success(status === 'suspended' ? 'Felfüggesztve' : 'Visszaállítva aktívra')
    } catch {
      toast.error('A státusz módosítása sikertelen')
    } finally {
      setBusyId(null)
    }
  }

  // ── Tömeges eltávolítás: a kijelölt tagok egyben (a tulaj-sor 'owner' + optimista 'tmp-' kihagyva). ──
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const removableSelected = Array.from(selected).filter((id) => id !== 'owner' && !id.startsWith('tmp-'))
  // Kijelölhető (nem-tulaj, valós) tagok kulcsai — a „mind kijelölése" ezekkel dolgozik.
  const selectableKeys = filtered
    .filter((m) => m.roleTone !== 'owner' && m.id && !m.id.startsWith('tmp-'))
    .map((m) => m.id as string)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k))
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (selectableKeys.length > 0 && selectableKeys.every((k) => prev.has(k))) selectableKeys.forEach((k) => next.delete(k))
      else selectableKeys.forEach((k) => next.add(k))
      return next
    })
  async function confirmBulkDelete() {
    const ids = removableSelected
    if (ids.length === 0) { setBulkOpen(false); setSelected(new Set()); return }
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/team/members/${id}`, { method: 'DELETE', credentials: 'include' })),
      )
      const okIds = ids.filter((id, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok)
      setTeam((prev) => prev.filter((x) => !(x.id && okIds.includes(x.id))))
      setSelected(new Set())
      setBulkOpen(false)
      if (okIds.length < ids.length) toast.error(`${ids.length - okIds.length} eltávolítása nem sikerült`)
      else toast.success(`${okIds.length} tag eltávolítva`)
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <>
      {/* ── HEADER: cím felül → alatta a TELJES-SZÉLESSÉGŰ státusz-csík (bal) + 3 nagy szám (jobb) — 1:1 az Áttekintésről ── */}
      <div className="mb-6">
        <PageHeader
          eyebrow="Csapat"
          title="Munkatársak"
          description="Az étterem csapata, szerepek és meghívók"
        />
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={[
              { label: 'Tulajdonos', pct: ownerPct, value: ownerNum, suffix: ' fő', background: '#1D1C19', color: '#fff' },
              { label: 'Manager', pct: managerPct, value: managerNum, suffix: ' fő', background: '#F1CE45', color: '#1D1C19' },
              { label: 'Munkatárs', pct: staffPct, value: staffNum, suffix: ' fő', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
            ]}
          />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="users" value={memberCount} label="Csapattag" />
            <CountUpKpi icon="check" value={activeCount} label="Aktív" />
            <CountUpKpi icon="off" value={pendingCount} label="Függő meghívó" />
          </div>
        </div>
      </div>

      {/* ── MAPPA-FÜL kártya (davelopment App): NORMÁL folyású fül + szűrők + kereső + homorú notch-ív ── */}
      <div className="relative">
        <div className="relative z-10 flex h-[48px] w-full max-w-[600px] items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 backdrop-blur-[20px] sm:px-6 print:hidden">
          {/* Szűrő: állapot */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'pending')}
              className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
            >
              <option value="all">Minden állapot</option>
              <option value="active">Aktív</option>
              <option value="pending">Függő</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          {/* Szűrő: szerep */}
          <div className="relative hidden shrink-0 md:block">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
            >
              <option value="all">Minden szerep</option>
              {roleFilterOptions.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          {/* Kereső */}
          <div className="flex min-w-[110px] flex-1 items-center gap-2.5 rounded-[18px] bg-white px-4 py-2 shadow-[0_1px_4px_rgba(70,60,20,.06)]">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
            />
          </div>
          <span
            className="pointer-events-none absolute -right-[24px] bottom-0 h-[24px] w-[24px]"
            style={{ background: 'radial-gradient(circle at top right, transparent 23px, rgba(255,255,255,.62) 23.5px)' }}
          />
        </div>

        <div className="rounded-b-[28px] rounded-tr-[28px] bg-[rgba(255,255,255,.9)] p-5 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[18px] sm:p-6">
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <button
              onClick={() => setOpen(true)}
              className="flex h-[38px] items-center gap-2 rounded-[18px] bg-ink-dark px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-ink"
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={2} /> Új munkatárs
            </button>
            <button
              onClick={() => window.print()}
              className="flex h-[38px] items-center gap-2 rounded-[18px] bg-white px-4 text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper"
            >
              <Download className="h-[15px] w-[15px]" strokeWidth={1.7} /> Export
            </button>
            {removableSelected.length > 0 && (
              <button
                onClick={() => setBulkOpen(true)}
                className="flex h-[38px] items-center gap-2 rounded-[18px] bg-[#C0392B] px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-[#a93226]"
              >
                <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} /> Kijelöltek törlése ({removableSelected.length})
              </button>
            )}
          </div>

          <div className={`mt-4 hidden ${GRID} items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid`}>
            <div>
              <button
                type="button"
                onClick={toggleSelectAll}
                aria-label="Mind kijelölése"
                title="Mind kijelölése"
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${allSelected ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
              >
                {allSelected && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
              </button>
            </div>
            <div>Név</div>
            <div>Pozíció</div>
            <div>Belépés</div>
            <div>Státusz</div>
          </div>

          {filtered.length === 0 && <p className="py-10 text-center text-sm text-ink-soft">Nincs találat.</p>}
          {filtered.map((m, idx) => {
            const grad = gradientFor(m.name)
            const isOwner = m.roleTone === 'owner'
            const busy = busyId === m.id
            const sp = statusPill(m.status)
            const canToggleStatus = canManage && !isOwner && m.status !== 'invited'
            const suspended = m.status === 'suspended'
            const selKey = m.id ?? 'owner' // a tulaj-sor is kijelölhető (nincs membership id, de kulcsot kap)
            const isSel = selected.has(selKey)
            return (
              <div
                key={selKey}
                onClick={() => setHiringIndex(idx)}
                role="button"
                title="Adatlap megnyitása"
                style={isSel ? { background: 'var(--dav-accent)' } : suspended ? { background: SUSPEND_HATCH } : undefined}
                className={`mt-2 cursor-pointer rounded-[18px] transition-all ${
                  isSel ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : suspended ? 'ring-1 ring-line' : 'hover:bg-gold/10'
                }`}
              >
                {/* DESKTOP */}
                <div className={`hidden ${GRID} items-center gap-3.5 px-3.5 py-2.5 lg:grid`}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(selKey) }}
                    aria-pressed={isSel}
                    aria-label="Kijelölés"
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${
                      isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'
                    }`}
                  >
                    {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                  </button>
                  <div className="flex min-w-0 items-center gap-3">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover object-top" />
                    ) : (
                      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: grad.bg, color: grad.fg }}>
                        {initials(m.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className={`truncate text-[14.5px] font-semibold ${suspended ? 'text-ink-soft line-through' : 'text-ink'}`}>{m.name}</p>
                      {m.email && <p className="truncate text-[12px] font-medium text-ink-soft">{m.email}</p>}
                    </div>
                  </div>
                  <div>
                    {isOwner ? (
                      <span className="inline-flex rounded-[9px] bg-ink-dark px-2.5 py-[5px] text-[12px] font-semibold text-gold">Tulajdonos</span>
                    ) : (
                      <span className="inline-flex rounded-[9px] border border-line-strong px-2.5 py-[5px] text-[12px] font-semibold text-ink-soft">
                        {roleLabelOf(m)}
                      </span>
                    )}
                  </div>
                  <div className="text-[13.5px] font-medium text-ink-soft">{fmtDate(m.joinDate)}</div>
                  <div className="relative flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!canToggleStatus || busy}
                      onClick={(e) => { e.stopPropagation(); if (canToggleStatus) setStatusMenuFor(statusMenuFor === m.id ? null : m.id) }}
                      className={`inline-flex items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold ${canToggleStatus ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{ background: sp.bg, color: sp.color, border: sp.border }}
                    >
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: sp.dot }} />
                      {sp.label}
                      {canToggleStatus && <ChevronDown className="h-3 w-3 opacity-60" />}
                    </button>
                    {canToggleStatus && statusMenuFor === m.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStatusMenuFor(null) }} />
                        <div className="absolute right-0 top-[36px] z-20 w-48 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                          {(['active', 'suspended'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setStatusMenuFor(null); if (s !== m.status) changeStatus(m, s) }}
                              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: s === 'suspended' ? '#B7B2A4' : '#4F9E6A' }} />
                              {s === 'suspended' ? 'Felfüggesztett' : 'Aktív'}
                              {m.status === s && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {!isOwner && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); setRemoveTarget(m) }}
                        title="Eltávolítás"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#C0392B] transition-colors hover:bg-white disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Trash2 className="h-[14px] w-[14px]" strokeWidth={1.7} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* MOBIL */}
                <div className="flex items-center gap-3 px-3.5 py-3 lg:hidden">
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(selKey) }}
                      aria-pressed={isSel}
                      aria-label="Kijelölés"
                      className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}
                    >
                      {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                    </button>
                  )}
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover object-top" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold" style={{ background: grad.bg, color: grad.fg }}>
                      {initials(m.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-semibold ${suspended ? 'text-ink-soft line-through' : 'text-ink'}`}>{m.name}</p>
                    <p className="truncate text-[12.5px] font-medium text-ink-soft">{roleLabelOf(m)}</p>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      disabled={!canToggleStatus || busy}
                      onClick={(e) => { e.stopPropagation(); if (canToggleStatus) setStatusMenuFor(statusMenuFor === m.id ? null : m.id) }}
                      className="inline-flex items-center gap-1.5 rounded-[14px] px-2.5 py-[5px] text-[11px] font-semibold"
                      style={{ background: sp.bg, color: sp.color, border: sp.border }}
                    >
                      <span className="h-[6px] w-[6px] rounded-full" style={{ background: sp.dot }} />
                      {sp.label}
                      {canToggleStatus && <ChevronDown className="h-3 w-3 opacity-60" />}
                    </button>
                    {canToggleStatus && statusMenuFor === m.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setStatusMenuFor(null) }} />
                        <div className="absolute right-0 top-[32px] z-20 w-44 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                          {(['active', 'suspended'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setStatusMenuFor(null); if (s !== m.status) changeStatus(m, s) }}
                              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ background: s === 'suspended' ? '#B7B2A4' : '#4F9E6A' }} />
                              {s === 'suspended' ? 'Felfüggesztett' : 'Aktív'}
                              {m.status === s && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {!isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => { e.stopPropagation(); setRemoveTarget(m) }}
                      title="Eltávolítás"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#C0392B] transition-colors hover:bg-white disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.7} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-xl font-light tracking-[-0.02em] text-ink">Új munkatárs</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              invite()
            }}
            className="mt-6 space-y-5"
          >
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="munkatars@example.com"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Szerep *</Label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={customRoles.length === 0}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-[14px] text-ink focus:outline-none disabled:opacity-60"
              >
                <option value="">{customRoles.length === 0 ? 'Előbb hozz létre szerepet ↓' : '— Válassz szerepet —'}</option>
                {customRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <p className="text-xs text-ink-soft">
                A szerep <b>neve</b> a pozíció (Felszolgáló, Konyhavezető…), a <b>jogai</b> a jogosultság.
                {customRoles.length === 0
                  ? ' Új szerepet a Beállítások → Csapat oldalon adsz meg.'
                  : ' A szerepeket a Beállítások → Csapat oldalon szerkeszted. A Tulajdonos te vagy.'}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting || !roleId}
              className="h-12 w-full rounded-dav-pill bg-ink-dark text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-50"
            >
              {submitting ? 'Küldés...' : 'Meghívó küldése'}
            </button>
          </form>
          <button type="button" onClick={() => setOpen(false)} className="sr-only">
            <X className="h-4 w-4" />
          </button>
        </SheetContent>
      </Sheet>

      {/* Eltávolítás megerősítő modal (natív confirm helyett) */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="Munkatárs eltávolítása"
        description={removeTarget ? `Biztosan eltávolítod: ${removeTarget.name}? A hozzáférése azonnal megszűnik.` : ''}
        confirmLabel="Eltávolítás"
        cancelLabel="Mégse"
        destructive
        busy={busyId !== null && busyId === removeTarget?.id}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        open={bulkOpen}
        title="Kijelöltek eltávolítása"
        description={`Biztosan eltávolítod a kijelölt ${removableSelected.length} tagot? A hozzáférésük azonnal megszűnik.`}
        confirmLabel={`Eltávolítás (${removableSelected.length})`}
        cancelLabel="Mégse"
        destructive
        busy={bulkBusy}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkOpen(false)}
      />

      {/* Munkavállalók-adatlap overlay — a listasorra kattintva nyílik */}
      <HiringOverlay
        open={hiringIndex !== null}
        onClose={() => setHiringIndex(null)}
        variant="restaurant"
        employees={roster}
        positions={customRoles.map((r) => ({ label: r.name, level: 'staff' as const }))}
        canManage={canManage}
        canEditSalary={canEditSalary}
        statusById={Object.fromEntries(
          team.filter((t) => t.id).map((t): [string, 'active' | 'invited' | 'suspended'] => [t.id as string, t.status]),
        )}
        onStatusChange={(memberId, status) => setTeam((prev) => prev.map((x) => (x.id === memberId ? { ...x, status, pending: false } : x)))}
        onProfileChange={(memberId, patch) => {
          setRoster((prev) => prev.map((e) => (e.id === memberId ? { ...e, ...patch, hr: { ...e.hr, ...patch.hr } } : e)))
          setTeam((prev) => prev.map((x) => (x.id === memberId ? { ...x, name: patch.name ?? x.name, joinDate: patch.hr?.join_date ? patch.hr.join_date.slice(0, 10) : x.joinDate } : x)))
        }}
        initialIndex={hiringIndex ?? 0}
      />
    </>
  )
}
