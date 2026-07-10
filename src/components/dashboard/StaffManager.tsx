'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { StaffMember, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Pencil, CalendarDays, Camera, Loader2, X, Trash2, Search, Download, ChevronDown } from 'lucide-react'
import StaffCalendarSheet from './StaffCalendarSheet'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { PageHeader } from '@/components/ui/page-header'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { HiringOverlay } from '@/components/dashboard/HiringOverlay'
import type { Employee } from '@/components/dashboard/HiringView'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/** Avatar-monogram háttér-gradiensek — determinisztikusan a névből (referencia hangulata). */
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

const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  bio: z.string().optional(),
  is_active: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface Props {
  salonId: string
  initialStaff: StaffMember[]
  supportedLocales?: (Locale | string)[] | null
  /** staffId → idei, nem-lemondott foglalások száma (VALÓS) */
  bookingsById?: Record<string, number>
  /** staffId → szolgáltatás-nevek (tag-ek, VALÓS) */
  servicesById?: Record<string, string[]>
  /** staffId → átlagértékelés (VALÓS, ha van staffhoz köthető review) */
  ratingById?: Record<string, number>
  /** összes idei, nem-lemondott foglalás */
  totalBookings?: number
  /** teljes szalon átlagértékelés vagy null */
  avgRating?: number | null
  /** staffId → közelgő műszak címkéje (VALÓS, Shifts-ből) vagy hiányzik → „—" */
  upcomingShiftById?: Record<string, string>
  /** VALÓS munkatárs-adatlap adat (HiringView overlay); ha nincs, a HiringView mock-ot mutat */
  employees?: Employee[]
}

/** davelopment stat-csík pill (label felül, érték-pill alul). */
function avatarUrl(m: StaffMember): string | null {
  if (!m.avatar) return null
  if (typeof m.avatar === 'object') return (m.avatar as Media).url ?? null
  return null
}

/** Első sor a bio-ból → „szerep” alcím a kártyán (a Crextio-referencia mintájára). */
function roleLine(bio?: string | null): string | null {
  if (!bio) return null
  const first = bio.split('\n')[0].trim()
  if (!first) return null
  return first.length > 60 ? `${first.slice(0, 57)}…` : first
}

export default function StaffManager({
  salonId,
  initialStaff,
  supportedLocales,
  upcomingShiftById = {},
  employees,
}: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Sorra kattintva nyílik a Munkavállalók-adatlap overlay (a kattintott sor indexével előre-kiválasztva).
  const [hiringIndex, setHiringIndex] = useState<number | null>(null)
  const [staff, setStaff] = useState(initialStaff)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Nyelvkészlet a szalon supported_locales-éből (HU mindig benne). A bio localizált mező —
  // szerkesztéskor nyelvenként vihető be a `?locale=` paraméterrel.
  const availableLocales = resolveAvailableLocales(supportedLocales)
  const [editLocale, setEditLocale] = useState<Locale>('hu')
  const [localeLoading, setLocaleLoading] = useState(false)

  const [avatarId, setAvatarId] = useState<number | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarModified, setAvatarModified] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [calendarStaff, setCalendarStaff] = useState<StaffMember | null>(null)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true },
  })
  const activeWatch = watch('is_active')

  const openAdd = () => {
    reset({ name: '', bio: '', is_active: true })
    setEditing(null)
    setEditLocale('hu')
    setAvatarId(null)
    setAvatarPreview(null)
    setAvatarModified(false)
    setOpen(true)
  }

  const openEdit = (m: StaffMember) => {
    reset({ name: m.name, bio: m.bio ?? '', is_active: m.is_active ?? true })
    setEditing(m)
    setEditLocale('hu')
    const url = avatarUrl(m)
    setAvatarPreview(url)
    const media = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media) : null
    setAvatarId(media ? Number(media.id) : null)
    setAvatarModified(false)
    setOpen(true)
  }

  // Szerkesztési nyelv váltása. HU-ra váltva az alap (editing) bio tér vissza; más nyelvre
  // lekérdezzük az adott nyelvi tartalmat (üres → a mező üres, HU fallback érvényes a foglalón).
  const selectEditLocale = async (loc: Locale) => {
    if (loc === editLocale) return
    if (loc === 'hu') {
      setEditLocale('hu')
      setValue('bio', editing?.bio ?? '')
      return
    }
    if (!editing) return
    setLocaleLoading(true)
    try {
      const res = await fetch(`/api/staff/${editing.id}?locale=${loc}&fallback-locale=null&depth=0`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      setEditLocale(loc)
      setValue('bio', doc.bio ?? '')
    } catch {
      toast.error('A nyelvi tartalom betöltése sikertelen')
    } finally {
      setLocaleLoading(false)
    }
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarPreview(URL.createObjectURL(file))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.set('_payload', JSON.stringify({ alt: 'Staff avatar' }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setAvatarId(json.doc.id)
      setAvatarPreview(json.doc.url)
      setAvatarModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setAvatarPreview(null)
      setAvatarId(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatar = async () => {
    if (avatarId) {
      await fetch(`/api/media/${avatarId}`, { method: 'DELETE', credentials: 'include' })
    }
    setAvatarPreview(null)
    setAvatarId(null)
    setAvatarModified(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      // Idegen nyelv szerkesztése: csak a localizált bio-t PATCH-eljük az adott nyelvre.
      if (editLocale !== 'hu' && editing) {
        const res = await fetch(`/api/staff/${editing.id}?locale=${editLocale}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ bio: data.bio || null }),
        })
        if (!res.ok) throw new Error()
        setOpen(false)
        toast.success('Fordítás mentve')
        return
      }

      const body: Record<string, unknown> = { ...data, salon: salonId }
      if (avatarModified) body.avatar = avatarId ?? null
      else if (avatarId) body.avatar = avatarId
      const url = editing ? `/api/staff/${editing.id}` : '/api/staff'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: StaffMember = json.doc
      setStaff(prev => editing ? prev.map(m => m.id === saved.id ? saved : m) : [...prev, saved])
      setOpen(false)
      toast.success(editing ? 'Frissítve' : 'Munkatárs hozzáadva')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  // Törlés — SAJÁT megerősítő modal (nem a natív böngésző-confirm).
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toDelete = staff.find((m) => String(m.id) === deleteId) ?? null

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/staff/${deleteId}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setStaff((prev) => prev.filter((m) => String(m.id) !== deleteId))
      toast.success('Törölve')
      setDeleteId(null)
    } catch {
      toast.error('Hiba történt')
    } finally {
      setDeleting(false)
    }
  }

  // ── Tömeges törlés: a kijelölt munkatársak egyben ──
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  async function confirmBulkDelete() {
    const ids = Array.from(selected)
    if (ids.length === 0) { setBulkOpen(false); return }
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(
        ids.map((id) => fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'include' })),
      )
      const okIds = ids.filter((id, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok)
      setStaff((prev) => prev.filter((m) => !okIds.includes(String(m.id))))
      setSelected(new Set())
      setBulkOpen(false)
      if (okIds.length < ids.length) toast.error(`${ids.length - okIds.length} törlése nem sikerült`)
      else toast.success(`${okIds.length} munkatárs törölve`)
    } finally {
      setBulkBusy(false)
    }
  }

  // Foglalható-toggle a kártyán: a MEGLÉVŐ is_active mezőt PATCH-eli (nincs séma-változás).
  const toggleActive = async (m: StaffMember) => {
    const next = m.is_active === false
    setTogglingId(String(m.id))
    setStaff(prev => prev.map(x => x.id === m.id ? { ...x, is_active: next } : x))
    try {
      const res = await fetch(`/api/staff/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setStaff(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !next } : x))
      toast.error('A foglalhatóság módosítása sikertelen')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Stat-csík értékek (VALÓS) ──
  const activeCount = staff.filter((m) => m.is_active !== false).length
  const totalCount = staff.length
  const utilization = totalCount ? Math.round((activeCount / totalCount) * 100) : 0
  const onLeaveCount = totalCount - activeCount
  const now = new Date()
  const newJoiners = staff.filter((m) => {
    if (!m.join_date) return false
    const d = new Date(m.join_date)
    return (now.getTime() - d.getTime()) / 86400000 <= 90
  }).length
  const onLeavePct = totalCount ? Math.round((onLeaveCount / totalCount) * 100) : 0
  const newJoinersPct = totalCount ? Math.round((newJoiners / totalCount) * 100) : 0

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'
  const fmtSalary = (n?: number | null) => (typeof n === 'number' ? `${n.toLocaleString('hu-HU')} Ft` : '—')

  const departments = Array.from(new Set(staff.map((m) => (m.department ?? '').trim()).filter(Boolean)))
  const positions = Array.from(new Set(staff.map((m) => (m.role_title ?? '').trim()).filter(Boolean)))
  const filtered = staff.filter((m) => {
    if (statusFilter === 'active' && m.is_active === false) return false
    if (statusFilter === 'inactive' && m.is_active !== false) return false
    if (deptFilter !== 'all' && (m.department ?? '') !== deptFilter) return false
    if (posFilter !== 'all' && (m.role_title ?? '') !== posFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.role_title ?? '').toLowerCase().includes(q) || (m.department ?? '').toLowerCase().includes(q)
  })

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const GRID = 'grid-cols-[34px_1.7fr_1.2fr_1fr_0.9fr_1.1fr_1fr_140px]'

  return (
    <>
      {/* ── HEADER: cím felül → alatta a TELJES-SZÉLESSÉGŰ státusz-csík (bal) + 3 nagy szám (jobb) — 1:1 az Áttekintésről ── */}
      <div className="mb-6">
        <PageHeader
          eyebrow="Csapat"
          title="Munkatársak"
          description="A csapat tagjai, bemutatkozásuk és foglalhatóságuk"
        />
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={[
              { label: 'Foglalható', pct: utilization, value: activeCount, suffix: ' fő', background: '#1D1C19', color: '#fff' },
              { label: 'Szabadságon', pct: onLeavePct, value: onLeaveCount, suffix: ' fő', background: '#F1CE45', color: '#1D1C19' },
              { label: 'Új belépő', pct: newJoinersPct, value: newJoiners, suffix: ' fő', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
            ]}
          />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="users" value={totalCount} label="Munkatárs" />
            <CountUpKpi icon="clock" value={activeCount} label="Ma dolgozik" />
            <CountUpKpi icon="gauge" value={utilization} label="Kihasználtság" suffix="%" />
          </div>
        </div>
      </div>

      {/* ── MAPPA-FÜL kártya (davelopment App 67–75): NORMÁL folyású fül + homorú notch-ív (nem takarja a stat-csíkot) ── */}
      <div className="relative">
        {/* Fül: szűrők + kereső — a kártya bal-felső sarkára ül, jobbra homorú ív köti a kártyához */}
        <div className="relative z-10 flex h-[48px] w-full max-w-[600px] items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 backdrop-blur-[20px] sm:px-6">
          {/* Szűrő: állapot */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
            >
              <option value="all">Minden állapot</option>
              <option value="active">Aktív</option>
              <option value="inactive">Inaktív</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          {/* Szűrő: pozíció (ha van adat) */}
          {positions.length > 0 && (
            <div className="relative hidden shrink-0 md:block">
              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
              >
                <option value="all">Minden pozíció</option>
                {positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            </div>
          )}
          {/* Szűrő: részleg (ha van adat) */}
          {departments.length > 0 && (
            <div className="relative hidden shrink-0 sm:block">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
              >
                <option value="all">Minden részleg</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            </div>
          )}
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
          {/* homorú csatlakozó ív (notch) a fül jobb szélén → mappa-hatás */}
          <span
            className="pointer-events-none absolute -right-[24px] bottom-0 h-[24px] w-[24px]"
            style={{ background: 'radial-gradient(circle at top right, transparent 23px, rgba(255,255,255,.62) 23.5px)' }}
          />
        </div>

        <div className="rounded-b-[28px] rounded-tr-[28px] bg-[rgba(255,255,255,.9)] p-5 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[18px] sm:p-6">
          {/* Akció-sor */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={openAdd}
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
            {selected.size > 0 && (
              <button
                onClick={() => setBulkOpen(true)}
                className="flex h-[38px] items-center gap-2 rounded-[18px] bg-[#C0392B] px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-[#a93226]"
              >
                <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} /> Kijelöltek törlése ({selected.size})
              </button>
            )}
          </div>

          {/* Fejléc-sor (desktop) */}
          <div className={`mt-4 hidden ${GRID} items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid`}>
            <div />
            <div>Név</div>
            <div>Pozíció</div>
            <div>Részleg</div>
            <div>Bér</div>
            <div>Belépés</div>
            <div>Műszak</div>
            <div>Státusz</div>
          </div>

          {/* Sorok */}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-soft">Nincs találat.</p>
          )}
          {filtered.map((m, idx) => {
            const url = avatarUrl(m)
            const active = m.is_active !== false
            const grad = gradientFor(m.name)
            const isToggling = togglingId === String(m.id)
            const isSel = selected.has(String(m.id))
            const position = m.role_title || roleLine(m.bio) || '—'
            const shift = upcomingShiftById[String(m.id)] ?? '—'
            return (
              <div
                key={m.id}
                onClick={() => setHiringIndex(idx)}
                role="button"
                title="Adatlap megnyitása"
                style={isSel ? { background: 'var(--dav-accent)' } : undefined}
                className={`mt-2 cursor-pointer rounded-[18px] transition-all ${
                  isSel ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : 'hover:bg-gold/10'
                }`}
              >
                {/* DESKTOP grid-sor */}
                <div className={`hidden ${GRID} items-center gap-3.5 px-3.5 py-2.5 lg:grid`}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(String(m.id)) }}
                    aria-pressed={isSel}
                    aria-label="Kijelölés"
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                  >
                    {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                  </button>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold" style={{ background: grad.bg, color: grad.fg }}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={m.name} className="h-full w-full object-cover object-top" />
                      ) : (
                        m.name.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="truncate text-[14.5px] font-semibold text-ink">{m.name}</span>
                  </div>
                  <div className="truncate text-[13.5px] font-medium text-ink">{position}</div>
                  <div className="truncate text-[13.5px] font-medium text-ink">{m.department || '—'}</div>
                  <div className="text-[13.5px] font-semibold text-ink">{fmtSalary(m.salary)}</div>
                  <div className="text-[13.5px] font-medium text-ink-soft">{fmtDate(m.join_date)}</div>
                  <div className="truncate text-[13.5px] font-medium text-ink">{shift}</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (!isToggling) toggleActive(m) }}
                      disabled={isToggling}
                      title="Aktív/foglalható váltás"
                      className="inline-flex items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold disabled:opacity-60"
                      style={active ? { background: '#E7F1E9', color: '#3B6B4B' } : { background: '#F1EEE6', color: '#86826F' }}
                    >
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: active ? '#4F9E6A' : '#B3AE9E' }} />
                      {active ? 'Aktív' : 'Inaktív'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setCalendarStaff(m) }} title="Elérhetőség" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><CalendarDays className="h-[14px] w-[14px]" strokeWidth={1.6} /></button>
                    <button onClick={(e) => { e.stopPropagation(); openEdit(m) }} title="Szerkesztés" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><Pencil className="h-[14px] w-[14px]" strokeWidth={1.6} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(String(m.id)) }} title="Törlés" className="flex h-8 w-8 items-center justify-center rounded-full text-[#C0392B] transition-colors hover:bg-white"><Trash2 className="h-[14px] w-[14px]" strokeWidth={1.6} /></button>
                  </div>
                </div>

                {/* MOBIL kártya-stack */}
                <div className="flex items-center gap-3 px-3.5 py-3 lg:hidden">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(String(m.id)) }}
                    aria-pressed={isSel}
                    aria-label="Kijelölés"
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong'}`}
                  >
                    {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                  </button>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold" style={{ background: grad.bg, color: grad.fg }}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={m.name} className="h-full w-full object-cover object-top" />
                    ) : (
                      m.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{m.name}</p>
                    <p className="truncate text-[12.5px] font-medium text-ink-soft">{position}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(m) }} title="Szerkesztés" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white"><Pencil className="h-[15px] w-[15px]" strokeWidth={1.6} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit / Add sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-xl font-light tracking-[-0.02em] text-ink">
              {editing ? 'Szerkesztés' : 'Új munkatárs'}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-6">

            {editing && availableLocales.length > 1 && (
              <LocaleEditBar
                available={availableLocales}
                active={editLocale}
                onSelect={selectEditLocale}
                loading={localeLoading}
              />
            )}

            {editLocale === 'hu' && (
            /* Avatar upload */
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-24 w-24 rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
                  ) : avatarPreview ? (
                    <>
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover object-top" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera className="h-6 w-6 text-zinc-400" />
                  )}
                </button>
                {avatarPreview && !uploadingAvatar && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500">Kattints a profilkép feltöltéséhez</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>
            )}

            {editLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Név *</Label>
              <Input className="h-11 rounded-xl" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Bemutatkozás</Label>
              <Textarea className="rounded-xl" {...register('bio')} rows={3} placeholder={editLocale !== 'hu' ? (editing?.bio ?? '') : undefined} />
            </div>
            {editLocale === 'hu' && (
            <label htmlFor="staff_active" className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3.5 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-ink">Aktív</span>
                <span className="mt-0.5 block text-xs text-ink-soft">Foglalható a foglaló oldalon</span>
              </span>
              <span className="relative inline-flex">
                <input type="checkbox" id="staff_active" className="peer sr-only" {...register('is_active')} />
                <span className={`h-[26px] w-[46px] rounded-full transition-colors ${activeWatch ? 'bg-ink-dark' : 'bg-line-strong'}`} />
                <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${activeWatch ? 'left-[23px]' : 'left-[3px]'}`} />
              </span>
            </label>
            )}
            <button
              type="submit"
              disabled={submitting || uploadingAvatar}
              className="w-full h-12 rounded-dav-pill bg-ink-dark hover:bg-ink text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Mentés...' : editLocale !== 'hu' ? 'Fordítás mentése' : 'Mentés'}
            </button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Availability calendar sheet */}
      {calendarStaff && (
        <StaffCalendarSheet
          open={!!calendarStaff}
          onClose={() => setCalendarStaff(null)}
          staffId={String(calendarStaff.id)}
          staffName={calendarStaff.name}
          salonId={salonId}
        />
      )}

      {/* Törlés megerősítő modal (natív confirm helyett) */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Munkatárs törlése"
        description={toDelete ? `Biztosan törlöd: ${toDelete.name}? A művelet nem vonható vissza.` : 'Biztosan törlöd ezt a munkatársat?'}
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={bulkOpen}
        title="Kijelöltek törlése"
        description={`Biztosan törlöd a kijelölt ${selected.size} munkatársat? A művelet nem vonható vissza.`}
        confirmLabel={`Törlés (${selected.size})`}
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
        variant="salon"
        employees={employees}
        initialIndex={hiringIndex ?? 0}
      />
    </>
  )
}
