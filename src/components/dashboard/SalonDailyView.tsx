'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, minutesToHHMM, ymdLocal } from '@/lib/utils'
import { List, LayoutGrid, Plus, Clock, Repeat, CalendarDays } from 'lucide-react'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import BookingActions from '@/components/dashboard/BookingActions'
import { SalonOfflineBanner } from '@/components/dashboard/SalonOfflineBanner'
import { BookingEditSheet, type EditTarget } from '@/components/dashboard/BookingEditSheet'
import { getDrafts, subscribeDrafts, type SalonBookingDraft } from '@/lib/salonBookingDrafts'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'

type ViewMode = 'list' | 'timeline'
const STORAGE_KEY = 'salon-daily-view'

const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár', confirmed: 'Megerősítve',
  completed: 'Befejezett', cancelled: 'Lemondva',
}
// Tömör blokk-színek a davelopment-kánon szerint (a szalon 4 státusza):
// confirmed=sötét (alap), pending=gold (függő), completed=zöld (kész), cancelled=szaggatott áthúzott.
const statusBlock: Record<string, string> = {
  pending: 'bg-[#F1CE45] text-ink-dark border-[#F1CE45]',
  confirmed: 'bg-[#1D1C19] text-white border-[#1D1C19]',
  completed: 'bg-[#1D9D63] text-white border-[#1D9D63]',
  cancelled:
    'text-ink-soft2 border border-dashed border-[#A0A096]/60 line-through bg-[repeating-linear-gradient(115deg,rgba(200,195,180,.5)_0_6px,rgba(225,220,206,.5)_6px_12px)]',
}
const statusDot: Record<string, string> = {
  pending: 'bg-gold', confirmed: 'bg-ink-dark', completed: 'bg-[#1D9D63]', cancelled: 'bg-[#D8D2C2]',
}
const ACTIVE = new Set(['pending', 'confirmed', 'completed'])
const STATUS_DARK_BG = new Set(['confirmed', 'completed'])

/** Élő, percenként frissülő aktuális idő (perc éjféltől). null, ha a megtekintett nap nem ma van. */
function useNowMinutes(date: string): number | null {
  const calc = () => {
    const now = new Date()
    if (ymdLocal(now) !== date) return null
    return now.getHours() * 60 + now.getMinutes()
  }
  const [min, setMin] = useState<number | null>(calc)
  useEffect(() => {
    setMin(calc())
    const id = setInterval(() => setMin(calc()), 30_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])
  return min
}

/** Egyszerű sürgősség-jelzés: megerősített foglalás, de a kezdés ideje már elmúlt (ma). */
function urgencyOf(b: Booking, nowMin: number | null): { label: string; cls: string } | null {
  if (nowMin == null) return null
  const start = hhmmToMinutes(b.start_time)
  if (b.status === 'confirmed' && nowMin > start) {
    return { label: `Késik ${nowMin - start}p`, cls: 'bg-red-500 text-white border-red-600' }
  }
  return null
}

// ── segéd-getterek (a reláció lehet id vagy kifejtett objektum) ──
const idOf = (v: unknown): string =>
  v && typeof v === 'object' ? String((v as { id: string | number }).id) : String(v ?? '')
const serviceOf = (b: Booking): Service | null => (typeof b.service === 'object' ? b.service : null)
const staffOf = (b: Booking): StaffMember | null => (typeof b.staff === 'object' ? b.staff : null)
const durationOf = (b: Booking): number => Math.max(0, hhmmToMinutes(b.end_time) - hhmmToMinutes(b.start_time))
const avatarUrlOf = (s: StaffMember | null): string | null => {
  const a = s?.avatar
  return a && typeof a === 'object' ? ((a as Media).url ?? null) : null
}
const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·'

/** Kis avatar-kör (profilkép vagy monogram) — a szakember-sáv címkéjéhez. */
function Ava({ url, ini, className }: { url?: string | null; ini: string; className: string }) {
  if (url) return <img src={url} alt="" className={`${className} object-cover object-top`} />
  return <span className={className}>{ini}</span>
}

/** Lokális vázlatból „ál-foglalás" készül, ami beleilleszkedik a nézetekbe, de __draft-tal jelölt. */
type DraftBooking = Booking & { __draft: true; draftId: string }
export function isDraft(b: Booking): b is DraftBooking {
  return (b as DraftBooking).__draft === true
}
function draftToBooking(d: SalonBookingDraft): DraftBooking {
  const end = d.end_time || d.start_time
  return {
    id: d.draftId as unknown as string,
    customer_name: d.customer_name || 'Foglalás',
    customer_phone: d.customer_phone || '',
    customer_email: d.customer_email || '',
    date: d.date,
    start_time: d.start_time,
    end_time: end,
    notes: d.notes || '',
    status: (d.status || 'confirmed') as Booking['status'],
    service: { id: d.serviceId, name: d.serviceName ?? '—' } as unknown as Booking['service'],
    staff: { id: d.staffId, name: d.staffName ?? '—' } as unknown as Booking['staff'],
    __draft: true,
    draftId: d.draftId,
  } as unknown as DraftBooking
}

export interface SalonDailyViewProps {
  date: string
  salonId: string
  bookings: Booking[]
  staff: StaffMember[]
  services: Service[]
  openMin: number
  closeMin: number
  /** Értesítésből érkezve ezt a foglalást nyitjuk meg automatikusan. */
  openBookingId?: string
  /** A toolbar-ba ágyazott dátum-navigátor (server komponensből). */
  dateFilter: React.ReactNode
}

export function SalonDailyView(props: SalonDailyViewProps) {
  const { date, salonId, staff, services, openMin, closeMin, openBookingId, dateFilter } = props
  const [view, setView] = useState<ViewMode>('timeline')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<SalonBookingDraft[]>([])
  const router = useRouter()

  // Lokális vázlatok betöltése + élő követése.
  useEffect(() => {
    setDrafts(getDrafts(salonId))
    return subscribeDrafts(salonId, setDrafts)
  }, [salonId])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
    if (saved === 'list' || saved === 'timeline') setView(saved)
  }, [])
  const pick = (v: ViewMode) => {
    setView(v)
    localStorage.setItem(STORAGE_KEY, v)
  }

  // A vázlatok beolvadnak a foglalások közé (jelölve maradnak). Csak az adott napiak.
  const bookings = useMemo(() => {
    const dayDrafts = drafts.filter((d) => d.date === date).map(draftToBooking)
    return [...props.bookings, ...dayDrafts]
  }, [props.bookings, drafts, date])

  const dayDrafts = useMemo(
    () => drafts.filter((d) => d.date === date).sort((a, b) => a.createdAt - b.createdAt),
    [drafts, date],
  )

  // Értesítésből érkezve (?booking=) automatikusan megnyitjuk a szerkesztőt.
  const lastOpenedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openBookingId || lastOpenedRef.current === openBookingId) return
    const b = props.bookings.find((x) => String(x.id) === String(openBookingId))
    if (b) { lastOpenedRef.current = openBookingId; setTarget({ booking: b }) }
  }, [openBookingId, props.bookings])

  const openEdit = (b: Booking) => setTarget({ booking: b })
  const openCreate = (presetStart?: string, presetStaffId?: string | number | null) =>
    setTarget({ booking: null, presetStart, presetStaffId })

  // Áthelyezés drag&drop-ból: új időpont és/vagy szakember. A szerver validál (átfedés).
  // Hibánál a router.refresh visszaállítja az eredeti pozíciót, és toast jelzi az okot.
  const moveBooking = async (b: Booking, newStart: string, newStaffId: string | number) => {
    if (isDraft(b)) return
    try {
      const res = await fetch('/api/salon/manage-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId: b.id,
          serviceId: idOf(b.service),
          staffId: newStaffId,
          date,
          start_time: newStart,
          customer_name: b.customer_name,
          customer_phone: b.customer_phone ?? '',
          customer_email: b.customer_email,
          notes: b.notes ?? '',
          status: b.status,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Az áthelyezés nem sikerült')
      toast.success('Foglalás áthelyezve')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Az áthelyezés nem sikerült')
      router.refresh()
    }
  }

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active !== false), [staff])

  const viewButtons: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'timeline', icon: LayoutGrid, label: 'Idősáv' },
    { mode: 'list', icon: List, label: 'Lista' },
  ]

  // KPI-számok a nap valós adataiból (vázlatokkal együtt).
  const totalB = bookings.length || 1
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length
  const pendingCount = bookings.filter((b) => b.status === 'pending').length
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length
  const activeCount = bookings.filter((b) => b.status !== 'cancelled').length
  const completedCount = bookings.filter((b) => b.status === 'completed').length
  const activeDur = bookings.filter((b) => b.status !== 'cancelled')
  const avgDuration = activeDur.length ? Math.round(activeDur.reduce((s, b) => s + durationOf(b), 0) / activeDur.length) : 0
  const HATCH = 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)'

  return (
    <div className="space-y-5">
      <SalonOfflineBanner
        salonId={salonId}
        drafts={dayDrafts}
        onReview={(d) => setTarget({ booking: draftToBooking(d) })}
      />

      {/* ── Fejléc-sor: cím + alcím · toolbar ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] lg:text-[42px] font-light tracking-[-0.02em] text-ink leading-none">
            Foglalások
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-soft2">
            Napi idősáv · {activeStaff.length} szakember
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dateFilter}
          <div className="inline-flex gap-0.5 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1">
            {viewButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => pick(mode)}
                title={label}
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-[15px] text-[13px] font-semibold transition-colors ${
                  view === mode ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => openCreate()}
            className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-dav-pill bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="h-[15px] w-[15px] shrink-0 text-gold" strokeWidth={2.2} />
            <span className="hidden sm:inline">Új foglalás</span>
          </button>
        </div>
      </div>

      {/* ── Státusz-csík (bal) + nagy KPI-számok (jobb) — csak a Lista nézetben (az Idősáv teljes szélességű). ── */}
      {view !== 'timeline' && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={[
              { label: 'Megerősített', pct: Math.round((confirmedCount / totalB) * 100), background: '#1D1C19', color: '#fff' },
              { label: 'Függő', pct: Math.round((pendingCount / totalB) * 100), background: '#F1CE45', color: '#1D1C19' },
              { label: 'Lemondva', pct: Math.round((cancelledCount / totalB) * 100), background: HATCH, color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
            ]}
          />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="calendar" value={activeCount} label="Foglalás" />
            <CountUpKpi icon="done" value={completedCount} label="Befejezett" />
            <CountUpKpi icon="check" value={pendingCount} label="Függő" />
            <CountUpKpi icon="clock" value={avgDuration} label="Átl. idő (perc)" />
          </div>
        </div>
      )}

      {view === 'list' && <ListView date={date} bookings={bookings} onEdit={openEdit} />}
      {view === 'timeline' && (
        <TimelineView
          date={date}
          bookings={bookings}
          staff={activeStaff}
          openMin={openMin}
          closeMin={closeMin}
          onEdit={openEdit}
          onCreate={openCreate}
          onMove={moveBooking}
        />
      )}

      <BookingEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={date}
        salonId={salonId}
        target={target}
        services={services}
        staff={staff}
        openMin={openMin}
        closeMin={closeMin}
      />
    </div>
  )
}

/* ---------- Lista nézet (egynapos) ---------- */
function ListView({ date, bookings, onEdit }: { date: string; bookings: Booking[]; onEdit: (b: Booking) => void }) {
  const card = 'rounded-[26px] dav-card-glass'
  const nowMin = useNowMinutes(date)
  const nowRef = useRef<HTMLDivElement>(null)
  const sorted = [...bookings].sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
  const nowIndex = nowMin == null ? -1 : sorted.findIndex((b) => hhmmToMinutes(b.start_time) >= nowMin)

  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [nowIndex, date])

  if (sorted.length === 0) {
    return (
      <div className={`${card} flex flex-col items-center justify-center gap-3 px-6 py-16 text-center`}>
        <CalendarDays className="h-8 w-8 text-ink-soft" strokeWidth={1.6} />
        <p className="text-sm text-ink-soft">Erre a napra nincs foglalás.</p>
      </div>
    )
  }
  return (
    <div className={`${card} divide-y divide-line overflow-hidden`}>
      {sorted.map((b, i) => {
        const svc = serviceOf(b)
        const st = staffOf(b)
        const draft = isDraft(b)
        const urgency = draft ? null : urgencyOf(b, nowMin)
        const showNow = i === nowIndex
        return (
          <div key={String(b.id)}>
            {showNow && (
              <div ref={nowRef} className="relative flex items-center gap-2 px-4 sm:px-5 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-soft-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">Most · {minutesToHHMM(nowMin!)}</span>
                <span className="h-px flex-1 bg-red-500/40" />
              </div>
            )}
            <div className={`relative flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 transition-colors hover:bg-[var(--dav-glass)] ${draft ? 'border-l-2 border-dashed border-gold bg-gold/[0.08]' : ''}`}>
              {urgency && (
                <span className={`absolute right-2 top-2 z-10 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm ${urgency.cls}`}>
                  {urgency.label}
                </span>
              )}
              <button onClick={() => onEdit(b)} className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 text-left">
                <div className="w-11 sm:w-12 shrink-0">
                  <div className="text-sm sm:text-base font-semibold text-ink tabular-nums leading-tight">{b.start_time}</div>
                  <div className="text-[11px] text-ink-soft2 tabular-nums">{b.end_time}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${statusDot[b.status] ?? 'bg-line-strong'}`} />
                    <span className="font-medium text-ink truncate">{b.customer_name}</span>
                    {draft && (
                      <span className="shrink-0 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-dark">Vázlat</span>
                    )}
                    {b.series_id && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#F0E7CF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A7B12]">
                        <Repeat className="h-3 w-3" /> Sorozat
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-soft truncate">
                    {svc?.name ?? '—'}{st?.name ? ` · ${st.name}` : ''}{b.customer_phone ? ` · ${b.customer_phone}` : ''}
                  </div>
                  {b.notes && <div className="text-xs text-ink-soft2 mt-0.5 truncate">„{b.notes}”</div>}
                </div>
              </button>
              <div className="flex items-center shrink-0">
                <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[b.status] ?? 'bg-line-strong'}`} />
                  <span className="text-xs text-ink-soft truncate">{statusLabel[b.status] ?? b.status}</span>
                </span>
                <div className="flex items-center justify-end w-10 shrink-0">
                  {!draft && <BookingActions bookingId={String(b.id)} status={b.status} />}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Idővonal (szakember × idő rács) ---------- */
type TLProps = {
  date: string
  bookings: Booking[]
  staff: StaffMember[]
  openMin: number
  closeMin: number
  onEdit: (b: Booking) => void
  onCreate: (start?: string, staffId?: string | number | null) => void
  onMove: (b: Booking, newStart: string, newStaffId: string | number) => void
}

function TimelineView({ date, bookings, staff, openMin, closeMin, onEdit, onCreate, onMove }: TLProps) {
  const totalMin = Math.max(closeMin - openMin, 60)
  const nowMin = useNowMinutes(date)
  const nowVisible = nowMin != null && nowMin >= openMin && nowMin <= closeMin
  const card = 'rounded-[26px] dav-card-glass'

  const hourMarks: number[] = []
  for (let m = Math.ceil(openMin / 60) * 60; m < closeMin; m += 60) hourMarks.push(m)

  const active = bookings.filter((b) => ACTIVE.has(b.status))

  return (
    <>
      <div className="lg:hidden">
        <MobileTimeline {...{ hourMarks, active, openMin, closeMin, nowMin, onEdit }} />
      </div>
      <div className="hidden lg:block">
        <StaffGrid {...{ staff, active, hourMarks, openMin, closeMin, totalMin, nowMin, nowVisible, card, onEdit, onCreate, onMove }} />
      </div>
    </>
  )
}

// A kinyíló extra foglalás-kártyák „staggered spring" belépője (etalon: a UserMenu popover).
const TL_EXTRA_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

function renderBookingCard(b: Booking, onEdit: (b: Booking) => void) {
  const svc = serviceOf(b)
  const st = staffOf(b)
  const block = statusBlock[b.status] ?? 'bg-white border border-line text-ink'
  const dark = STATUS_DARK_BG.has(b.status)
  return (
    <button
      type="button"
      onClick={() => onEdit(b)}
      className={`flex h-[62px] w-full flex-col justify-center rounded-[18px] border px-4 text-left shadow-dav-card transition-transform active:scale-[0.99] ${block}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold">
          {b.customer_name}{svc?.name ? ` · ${svc.name}` : ''}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {b.series_id && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F0E7CF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A7B12]">
              <Repeat className="h-3 w-3" /> Sorozat
            </span>
          )}
          <span className={`h-2 w-2 rounded-full ${statusDot[b.status] ?? 'bg-line-strong'}`} />
        </span>
      </div>
      <div className={`mt-0.5 truncate text-xs ${dark ? 'text-white/70' : 'text-ink-soft'}`}>
        {b.start_time}–{b.end_time}{st?.name ? ` · ${st.name}` : ''}
      </div>
    </button>
  )
}

function MobileTimeline({
  hourMarks, active, openMin, closeMin, nowMin, onEdit,
}: {
  hourMarks: number[]; active: Booking[]; openMin: number; closeMin: number; nowMin: number | null; onEdit: (b: Booking) => void
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const toggle = (m: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  return (
    <div className="rounded-[26px] p-4 dav-card-glass">
      <div className="mb-3 text-[17px] font-medium text-ink">Napi időbeosztás</div>
      <div>
        {hourMarks.map((m, i) => {
          const lo = i === 0 ? openMin : m
          const hi = i < hourMarks.length - 1 ? hourMarks[i + 1] : closeMin + 1
          const inHour = active
            .filter((b) => { const s = hhmmToMinutes(b.start_time); return s >= lo && s < hi })
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          const isNow = nowMin != null && nowMin >= m && nowMin < (hourMarks[i + 1] ?? closeMin + 1)
          const isOpen = expanded.has(m)
          const pillCls = isNow ? 'bg-ink-dark text-white' : inHour.length > 0 ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
          const last = i === hourMarks.length - 1
          return (
            <div key={m} className="flex gap-3">
              <div className="flex w-[62px] shrink-0 flex-col items-center">
                <span className={`flex h-9 w-full items-center justify-center rounded-full px-3 text-[13px] font-semibold tabular-nums ${pillCls}`}>
                  {minutesToHHMM(m)}
                </span>
                {!last && (
                  <div className="relative flex min-h-[30px] flex-1 items-center justify-center py-1.5">
                    <span className="absolute inset-y-0 border-l-2 border-dotted border-line-strong" />
                    {inHour.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggle(m)}
                        aria-label={`${inHour.length} foglalás ${minutesToHHMM(m)}-kor`}
                        className={`relative z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                      >
                        {inHour.length}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                {inHour.length > 0 ? (
                  <div>
                    {renderBookingCard(inHour[0], onEdit)}
                    <AnimatePresence initial={false}>
                      {isOpen && inHour.length > 1 && (
                        <motion.div
                          key="extra"
                          className="overflow-hidden"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                        >
                          <motion.div
                            className="space-y-2 pt-2"
                            initial="hidden"
                            animate="show"
                            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } } }}
                          >
                            {inHour.slice(1).map((b) => (
                              <motion.div key={String(b.id)} variants={TL_EXTRA_ITEM}>
                                {renderBookingCard(b, onEdit)}
                              </motion.div>
                            ))}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className="h-[40px] rounded-[16px] border border-[rgba(120,110,70,.10)]"
                    style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Szakember × idő rács (desktop, fit mód: a teljes nap egy nézetbe fér százalékos pozícióval). */
function StaffGrid({
  staff, active, hourMarks, openMin, closeMin, totalMin, nowMin, nowVisible, card, onEdit, onCreate, onMove,
}: {
  staff: StaffMember[]; active: Booking[]; hourMarks: number[]; openMin: number; closeMin: number; totalMin: number
  nowMin: number | null; nowVisible: boolean; card: string
  onEdit: (b: Booking) => void
  onCreate: (start?: string, staffId?: string | number | null) => void
  onMove: (b: Booking, newStart: string, newStaffId: string | number) => void
}) {
  const labelW = 'w-[150px] sm:w-[180px]'
  const left = (min: number) => `${((min - openMin) / totalMin) * 100}%`
  const span = (min: number) => `${(min / totalMin) * 100}%`

  // ── Drag & drop: foglalás-blokk áthelyezése (időpont + szakember) ──
  type DragState = {
    b: Booking; dur: number; previewMin: number; staffId: string | number
    cx: number; cy: number; grabDx: number; widthPx: number
  }
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<{ b: Booking; init: DragState; startX: number; startY: number } | null>(null)
  const DRAG_THRESHOLD = 5

  const xToMin = (clientX: number, rowEl: HTMLElement): number => {
    const rect = rowEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round((openMin + ratio * totalMin) / 15) * 15
  }

  useEffect(() => {
    const onPendingMove = (e: PointerEvent) => {
      const p = pendingRef.current
      if (!p || dragRef.current) return
      if (Math.abs(e.clientX - p.startX) >= DRAG_THRESHOLD || Math.abs(e.clientY - p.startY) >= DRAG_THRESHOLD) {
        dragRef.current = p.init
        setDrag(p.init)
        pendingRef.current = null
      }
    }
    const onPendingUp = () => {
      const p = pendingRef.current
      pendingRef.current = null
      if (p && !dragRef.current) onEdit(p.b)
    }
    window.addEventListener('pointermove', onPendingMove)
    window.addEventListener('pointerup', onPendingUp)
    return () => {
      window.removeEventListener('pointermove', onPendingMove)
      window.removeEventListener('pointerup', onPendingUp)
    }
  }, [onEdit])

  useEffect(() => {
    if (!drag) return
    const onMoveEvt = (e: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const axis = el?.closest<HTMLElement>('[data-axis-staff]')
      const staffId = axis?.dataset.axisStaff ?? cur.staffId
      const rowAxis = axis ?? gridRef.current?.querySelector<HTMLElement>(`[data-axis-staff="${cur.staffId}"]`)
      let previewMin = cur.previewMin
      if (rowAxis) {
        previewMin = xToMin(e.clientX - cur.grabDx, rowAxis)
        previewMin = Math.max(openMin, Math.min(previewMin, closeMin - cur.dur))
      }
      const next = { ...cur, previewMin, staffId, cx: e.clientX, cy: e.clientY }
      dragRef.current = next
      setDrag(next)
    }
    const onUp = () => {
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!cur) return
      const newStart = minutesToHHMM(cur.previewMin)
      const changed = newStart !== cur.b.start_time || String(cur.staffId) !== idOf(cur.b.staff)
      if (changed) onMove(cur.b, newStart, cur.staffId)
    }
    window.addEventListener('pointermove', onMoveEvt)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMoveEvt)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, openMin, closeMin, totalMin, onMove])

  const beginPointer = (b: Booking, e: React.PointerEvent) => {
    if (isDraft(b)) return
    const s = hhmmToMinutes(b.start_time)
    const dur = hhmmToMinutes(b.end_time) - s
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pendingRef.current = {
      b, startX: e.clientX, startY: e.clientY,
      init: { b, dur, previewMin: s, staffId: idOf(b.staff), cx: e.clientX, cy: e.clientY, grabDx: e.clientX - rect.left, widthPx: rect.width },
    }
  }

  return (
    <>
      <div className={`${card} p-[18px] sm:p-[20px_22px_22px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="text-[17px] font-medium text-ink">Napi időbeosztás</div>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            {[
              { c: '#1D1C19', l: 'Megerősített' },
              { c: '#F1CE45', l: 'Függő' },
              { c: '#1D9D63', l: 'Befejezett' },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-[7px]">
                <span className="h-[11px] w-[11px] rounded-[3px] border border-line" style={{ background: x.c }} />
                <span className="text-xs font-medium text-ink-soft2">{x.l}</span>
              </div>
            ))}
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-ink-soft">Nincs aktív szakember. Vegyél fel szakembert a foglalások idővonalához.</div>
        ) : (
          <div ref={gridRef}>
            {/* idő-tengely (vonalzó) */}
            <div className="flex">
              <div className={`${labelW} shrink-0`} />
              <div className="relative flex-1 min-w-0 h-5">
                {hourMarks.map((m) => (
                  <span key={m} className="absolute top-0 text-[11px] font-medium tabular-nums text-[#A8A496]" style={{ left: left(m) }}>
                    {minutesToHHMM(m)}
                  </span>
                ))}
                {nowVisible && (
                  <span className="absolute -top-1 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm" style={{ left: left(nowMin!) }}>
                    {minutesToHHMM(nowMin!)}
                  </span>
                )}
              </div>
            </div>

            {staff.map((t) => {
              const rows = active.filter((b) => idOf(b.staff) === String(t.id))
              const sortedRows = [...rows].sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
              // Üres idősávok (szabad rések) — Crextio szaggatott hatch-pillek.
              const freeGaps: Array<[number, number]> = []
              let gapCursor = openMin
              for (const b of sortedRows) {
                const gs = hhmmToMinutes(b.start_time)
                const ge = hhmmToMinutes(b.end_time)
                if (gs - gapCursor >= 15) freeGaps.push([gapCursor, gs])
                gapCursor = Math.max(gapCursor, ge)
              }
              if (closeMin - gapCursor >= 15) freeGaps.push([gapCursor, closeMin])
              const isDropTarget = drag && String(drag.staffId) === String(t.id)
              const dragging = !!drag
              const url = avatarUrlOf(t)
              return (
                <div
                  key={String(t.id)}
                  className={`flex items-stretch border-t border-line transition-colors ${
                    isDropTarget ? 'bg-gold/[0.16]' : 'hover:bg-[var(--dav-glass)]'
                  }`}
                >
                  <div className={`${labelW} shrink-0 flex items-center gap-2.5 py-2 pr-2`}>
                    <Ava url={url} ini={initialsOf(t.name)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[12px] font-bold text-gold" />
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-ink truncate leading-tight">{t.name}</span>
                      {t.role_title && <span className="block text-[11px] text-[#A8A496] truncate leading-tight">{t.role_title}</span>}
                    </div>
                  </div>
                  <div data-axis-staff={t.id} className="relative flex-1 min-w-0 h-[64px]">
                    {hourMarks.map((m) => (
                      <span key={m} className="absolute inset-y-0 w-px bg-[rgba(120,110,70,.09)]" style={{ left: left(m) }} />
                    ))}
                    {!dragging && freeGaps.map(([gs, ge], i) => (
                      <span
                        key={`gap-${i}`}
                        aria-hidden
                        className="pointer-events-none absolute top-[7px] bottom-[7px] rounded-[11px] border border-[rgba(120,110,70,.10)]"
                        style={{
                          left: `calc(${left(gs)} + 2px)`,
                          width: `calc(${span(ge - gs)} - 4px)`,
                          background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)',
                        }}
                      />
                    ))}
                    {nowVisible && (
                      <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-red-500/80" style={{ left: left(nowMin!) }} />
                    )}
                    {rows.map((b) => {
                      const s = hhmmToMinutes(b.start_time)
                      const e = hhmmToMinutes(b.end_time)
                      const dur = e - s
                      const draft = isDraft(b)
                      const urgency = draft ? null : urgencyOf(b, nowMin)
                      const svc = serviceOf(b)
                      const wide = dur >= 90
                      const tiny = dur <= 20
                      const isDragging = drag?.b.id === b.id
                      const durLabel = `${(dur / 60).toFixed(dur % 60 === 0 ? 0 : 1).replace('.', ',')}ó`
                      return (
                        <button
                          key={String(b.id)}
                          onPointerDown={(ev) => { if (!draft) { ev.stopPropagation(); beginPointer(b, ev) } }}
                          title={`${draft ? 'VÁZLAT — ' : 'Kattints a szerkesztéshez, vagy húzd át · '}${b.customer_name} · ${svc?.name ?? ''} · ${b.start_time}–${b.end_time} · ${urgency ? urgency.label : statusLabel[b.status]}`}
                          className={`absolute top-[7px] bottom-[7px] rounded-[11px] border px-[11px] text-xs font-medium overflow-hidden text-left flex flex-col justify-center gap-0.5 transition-all ${draft ? 'border-2 border-dashed border-gold bg-gold/[0.18] text-ink-dark cursor-default' : `${statusBlock[b.status]} cursor-grab active:cursor-grabbing hover:brightness-[1.06]`} ${isDragging ? 'opacity-30 pointer-events-none' : ''}`}
                          style={{ left: `calc(${left(s)} + 2px)`, width: `calc(${span(dur)} - 4px)`, touchAction: 'none' }}
                        >
                          {tiny ? (
                            <span className="w-full min-w-0 truncate text-[11px] font-semibold leading-tight">{draft ? '✎ ' : ''}{b.customer_name}</span>
                          ) : wide ? (
                            <>
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="min-w-0 flex-1 truncate font-semibold leading-tight">{draft ? '✎ ' : ''}{b.customer_name}</span>
                                {urgency && <span className={`shrink-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${urgency.cls}`}>{urgency.label}</span>}
                              </span>
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[10px] opacity-80 leading-tight">{svc?.name ?? ''}</span>
                                <span className="ml-auto shrink-0 tabular-nums text-[10px] opacity-75 leading-tight">{b.start_time}–{b.end_time}</span>
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-full min-w-0 truncate font-semibold leading-tight">{draft ? '✎ ' : ''}{b.customer_name}</span>
                              <span className="flex shrink-0 items-center gap-1 text-[10px] opacity-75 leading-tight">
                                <Clock className="h-2.5 w-2.5 shrink-0" />{durLabel}
                              </span>
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Húzott blokk — fixed overlay, követi a kurzort (pointer-events:none). */}
      {drag && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[200] rounded-[11px] border border-black/10 bg-gold px-2.5 py-1.5 text-xs font-bold text-ink-dark shadow-2xl ring-2 ring-gold"
          style={{ left: drag.cx - drag.grabDx, top: drag.cy - 18, width: drag.widthPx, opacity: 0.95 }}
        >
          <div className="truncate">{drag.b.customer_name}</div>
          <div className="tabular-nums opacity-80">{minutesToHHMM(drag.previewMin)}–{minutesToHHMM(drag.previewMin + drag.dur)}</div>
        </div>,
        document.body,
      )}
    </>
  )
}
