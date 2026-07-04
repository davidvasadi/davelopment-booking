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
import { Plus, Trash2, Loader2, X, Search, Download, ChevronDown } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { HiringOverlay } from '@/components/dashboard/HiringOverlay'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface TeamCard {
  id: string | null // membership id; a tulaj-sornak null (nem kezelhető)
  name: string
  email: string
  roleTone: 'owner' | 'manager' | 'staff'
  pending: boolean
  joinDate: string | null
}

const ROLE_LABEL: Record<'owner' | 'manager' | 'staff', string> = {
  owner: 'Tulajdonos',
  manager: 'Menedzser',
  staff: 'Munkatárs',
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

export default function RestaurantTeamManager({ initialTeam }: { initialTeam: TeamCard[] }) {
  const [team, setTeam] = useState<TeamCard[]>(initialTeam)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'manager' | 'staff'>('staff')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'manager' | 'staff'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'
  const filtered = team.filter((t) => {
    if (statusFilter === 'active' && t.pending) return false
    if (statusFilter === 'pending' && !t.pending) return false
    if (roleFilter !== 'all' && t.roleTone !== roleFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || ROLE_LABEL[t.roleTone].toLowerCase().includes(q)
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
    setSubmitting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: em, role }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Hiba')
      }
      setTeam((prev) => [...prev, { id: `tmp-${em}`, name: em, email: em, roleTone: role, pending: true, joinDate: null }])
      setOpen(false)
      setEmail('')
      setRole('staff')
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
        <div className="relative z-10 flex h-[48px] w-full max-w-[600px] items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 backdrop-blur-[20px] sm:px-6">
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
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'owner' | 'manager' | 'staff')}
              className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
            >
              <option value="all">Minden szerep</option>
              <option value="owner">Tulajdonos</option>
              <option value="manager">Menedzser</option>
              <option value="staff">Pincér</option>
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
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setOpen(true)}
              title="Munkatárs meghívása"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[13px] bg-white shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper"
            >
              <Plus className="h-[15px] w-[15px] text-ink" strokeWidth={2} />
            </button>
            <button
              onClick={() => window.print()}
              className="flex h-[38px] items-center gap-2 rounded-[18px] bg-white px-4 text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper"
            >
              <Download className="h-[15px] w-[15px]" strokeWidth={1.7} /> Export
            </button>
          </div>

          <div className={`mt-4 hidden ${GRID} items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid`}>
            <div />
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
            const active = !m.pending
            const selKey = m.id ?? 'owner' // a tulaj-sor is kijelölhető (nincs membership id, de kulcsot kap)
            const isSel = selected.has(selKey)
            return (
              <div
                key={selKey}
                onClick={() => setHiringIndex(idx)}
                role="button"
                title="Adatlap megnyitása"
                style={isSel ? { background: 'var(--dav-accent)' } : undefined}
                className={`mt-2 cursor-pointer rounded-[18px] transition-all ${
                  isSel ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : 'hover:bg-gold/10'
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
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: grad.bg, color: grad.fg }}>
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold text-ink">{m.name}</p>
                      {m.email && <p className="truncate text-[12px] font-medium text-ink-soft">{m.email}</p>}
                    </div>
                  </div>
                  <div>
                    {isOwner ? (
                      <span className="inline-flex rounded-[9px] bg-ink-dark px-2.5 py-[5px] text-[12px] font-semibold text-gold">Tulajdonos</span>
                    ) : (
                      <span className="inline-flex rounded-[9px] border border-line-strong px-2.5 py-[5px] text-[12px] font-semibold text-ink-soft">
                        {ROLE_LABEL[m.roleTone]}
                      </span>
                    )}
                  </div>
                  <div className="text-[13.5px] font-medium text-ink-soft">{fmtDate(m.joinDate)}</div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold"
                      style={active ? { background: '#E7F1E9', color: '#3B6B4B' } : { background: '#FBEFC4', color: '#9A7B1E' }}
                    >
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: active ? '#4F9E6A' : '#C9A227' }} />
                      {active ? 'Aktív' : 'Függő'}
                    </span>
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
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold" style={{ background: grad.bg, color: grad.fg }}>
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{m.name}</p>
                    <p className="truncate text-[12.5px] font-medium text-ink-soft">{ROLE_LABEL[m.roleTone]}</p>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[14px] px-2.5 py-[5px] text-[11px] font-semibold"
                    style={active ? { background: '#E7F1E9', color: '#3B6B4B' } : { background: '#FBEFC4', color: '#9A7B1E' }}
                  >
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: active ? '#4F9E6A' : '#C9A227' }} />
                    {active ? 'Aktív' : 'Függő'}
                  </span>
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
            <SheetTitle className="text-xl font-light tracking-[-0.02em] text-ink">Munkatárs meghívása</SheetTitle>
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
              <Label className="text-sm font-medium">Szerep</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['staff', 'manager', 'owner'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors"
                    style={role === r ? { background: '#1D1C19', color: '#fff' } : { background: '#f3f2ef', color: '#5C5848' }}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-soft">
                {role === 'manager'
                  ? 'A menedzser kezelheti a foglalásokat és a csapatot.'
                  : 'A munkatárs a foglalásokat kezelheti.'}
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
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

      {/* Munkavállalók-adatlap overlay — a listasorra kattintva nyílik */}
      <HiringOverlay
        open={hiringIndex !== null}
        onClose={() => setHiringIndex(null)}
        variant="restaurant"
        initialIndex={hiringIndex ?? 0}
      />
    </>
  )
}
