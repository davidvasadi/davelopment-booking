'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, minutesToHHMM, minutesToHHMMWrapped, ymdLocal } from '@/lib/utils'
import { List, LayoutGrid, Plus, Clock, Repeat, CalendarDays, UserRound } from 'lucide-react'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import BookingActions from '@/components/dashboard/BookingActions'
import { SalonOfflineBanner } from '@/components/dashboard/SalonOfflineBanner'
import { BookingEditSheet, type EditTarget } from '@/components/dashboard/BookingEditSheet'
import { getDrafts, subscribeDrafts, type SalonBookingDraft } from '@/lib/salonBookingDrafts'
import { MobileOptionSheet } from '@/components/ui/MobileOptionSheet'
import { HoverButton } from '@/components/shared/HoverButton'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'

type ViewMode = 'list' | 'timeline'
const STORAGE_KEY = 'salon-daily-view'

const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár', confirmed: 'Megerősítve',
  completed: 'Befejezett', cancelled: 'Lemondva',
}
// A hatch-mintás (szaggatott "börtön") hátterek NEM Tailwind bg-[...] arbitrary osztályként
// mennek — Safariban (és mobil WebKiten) a bonyolult repeating-linear-gradient bracket-szintaxis
// nem mindig alkalmazódott (üresen/fehéren maradt a kártya), csak Chrome-on volt jó. Sima
// `style`-lal adjuk, mint az üres-sáv placeholdereknél — az garantáltan minden böngészőben fut.
// Fedő (nem áttetsző) színek — korábban rgba(...) volt, ami a krém oldal-háttéren szépen
// nézett ki, DE egy kártya-verem elé kerülve átütött rajta a mögötte lévő elem színe.
const HATCH_COMPLETED = 'repeating-linear-gradient(115deg,#FAF8F3 0 7px,#E5E0CD 7px 14px)'
function statusBg(status: string): { background: string } | undefined {
  if (status === 'completed') return { background: HATCH_COMPLETED }
  return undefined
}
// Tömör blokk-színek a davelopment-kánon szerint (a szalon 4 státusza):
// confirmed=sötét (alap), pending=gold (függő), completed=szaggatott hatch (kész, mint az
// étteremnél és az Áttekintés-oldalon) — a háttér a statusBg()-ből jön (style), cancelled=
// szaggatott áthúzott.
const statusBlock: Record<string, string> = {
  pending: 'bg-[#F1CE45] text-ink-dark border-[#F1CE45]',
  confirmed: 'bg-[#1D1C19] text-white border-[#1D1C19]',
  completed: 'text-ink-soft2 border border-[#c9c2ae]',
  cancelled: 'bg-[#C0564A] text-white border-[#C0564A]',
}
const statusDot: Record<string, string> = {
  pending: 'bg-gold', confirmed: 'bg-ink-dark', completed: 'bg-[#C9C2AE]', cancelled: 'bg-[#C0564A]',
}
const CANCEL_RED = '#C0564A'
const ACTIVE = new Set(['pending', 'confirmed', 'completed', 'cancelled'])
const STATUS_DARK_BG = new Set(['confirmed', 'cancelled'])

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

/** Kis avatar-kör (profilkép vagy UserRound fallback) — a szakember-sáv címkéjéhez. */
function Ava({ url, className }: { url?: string | null; ini?: string; className: string }) {
  if (url) return <img src={url} alt="" className={`${className} object-cover object-top`} />
  return (
    <span className={`${className} flex items-center justify-center`} style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
      <UserRound className="h-[55%] w-[55%] text-white/30" strokeWidth={1.2} />
    </span>
  )
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
  /** A toolbar-ba ágyazott nap-nyomtatás gomb (server komponensből). */
  printButton?: React.ReactNode
  /** Ha false, csak olvasható nézet — az Új foglalás gomb, szerkesztés és drag rejtve. */
  canManage?: boolean
}

export function SalonDailyView(props: SalonDailyViewProps) {
  const { date, salonId, staff, services, openMin, closeMin, openBookingId, dateFilter, printButton, canManage = false } = props
  const [view, setView] = useState<ViewMode>('timeline')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<SalonBookingDraft[]>([])
  const [mobileViewOpen, setMobileViewOpen] = useState(false)
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

  // Mobilon a nézet-váltó a fejléc csengő melletti ikonjából nyílik (DashboardNav dispatch-eli).
  useEffect(() => {
    const handler = () => setMobileViewOpen(true)
    window.addEventListener('davelopment:open-bookings-view', handler)
    return () => window.removeEventListener('davelopment:open-bookings-view', handler)
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

  const openEdit = (b: Booking) => { if (canManage) setTarget({ booking: b }) }
  const openCreate = (presetStart?: string, presetStaffId?: string | number | null) => {
    if (canManage) setTarget({ booking: null, presetStart, presetStaffId })
  }

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
  const nowMin = useNowMinutes(date)
  const totalB = bookings.length || 1
  // A csík első (sötét) sávja a MÁR LEZÁRULT (Befejezett) foglalásokat méri, a második (arany)
  // a MÉG AKTÍV, megerősített (nem befejezett, nem lemondott) foglalásokat — így a három sáv
  // ténylegesen a nap valós lefolyását tükrözi, nem csak egy statikus "megerősítve" halmazt.
  const activeConfirmedCount = bookings.filter((b) => b.status === 'confirmed').length
  // A Kezelendő KPI-szám (lejárt idősávú, még nem lezárt foglalás) külön, a pilltől függetlenül.
  const pendingCount = bookings.filter((b) => needsHandling(b, nowMin)).length
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
            Napi idősáv · {minutesToHHMM(openMin)}–{minutesToHHMM(closeMin)} · {activeStaff.length} szakember
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dateFilter}
          {/* Nézet-váltó — desktopon inline pill; mobilon a fejléc-ikon (csengő mellett)
              nyitja alulról felcsúszó választóként (ld. MobileOptionSheet lent). */}
          <div className="hidden h-[42px] items-center gap-0.5 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1 lg:inline-flex">
            {viewButtons.map(({ mode, icon: Icon, label }) => (
              <HoverButton
                key={mode}
                onClick={() => pick(mode)}
                title={label}
                className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-[15px] text-[13px] font-semibold transition-colors ${
                  view === mode ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{label}</span>
              </HoverButton>
            ))}
          </div>
          {printButton}
          {canManage && (
            <HoverButton
              onClick={() => openCreate()}
              className="inline-flex items-center justify-center gap-2 h-[42px] w-[42px] sm:w-auto sm:px-[18px] rounded-dav-pill bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="h-[15px] w-[15px] shrink-0 text-gold" strokeWidth={2.2} />
              <span className="hidden sm:inline">Új foglalás</span>
            </HoverButton>
          )}
        </div>
      </div>

      {/* ── Státusz-csík (bal) + nagy KPI-számok (jobb) — csak a Lista nézetben (az Idősáv teljes szélességű). ── */}
      {view !== 'timeline' && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={[
              { label: 'Befejezett', pct: Math.round((completedCount / totalB) * 100), background: '#1D1C19', color: '#fff' },
              { label: 'Megerősített', pct: Math.round((activeConfirmedCount / totalB) * 100), background: '#F1CE45', color: '#1D1C19' },
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
          canManage={canManage}
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

      <MobileOptionSheet
        open={mobileViewOpen}
        onClose={() => setMobileViewOpen(false)}
        title="Nézet"
        options={viewButtons}
        value={view}
        onChange={pick}
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
        const overdue = !draft && needsHandling(b, nowMin)
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
            <div
              className={`relative flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 transition-colors hover:bg-[var(--dav-glass)] ${draft ? 'bg-gold/[0.08]' : overdue ? 'bg-[#F1CE45]/[0.12]' : ''}`}
              style={
                draft || overdue
                  ? undefined
                  // Safari-bug: a bg-[#hex]/[opacity] Tailwind arbitrary-szintaxis a lemondott
                  // piros háttérnél nem alkalmazódott (ugyanaz a hiba-osztály, mint a hatch-
                  // mintáknál) — sima style-lal garantáltan minden böngészőben fut.
                  : b.status === 'cancelled'
                    ? { background: 'rgba(192,86,74,0.10)' }
                    : statusBg(b.status)
              }
            >
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
                <div className="hidden shrink-0 sm:block">
                  <Ava url={avatarUrlOf(st)} className="h-8 w-8 rounded-full overflow-hidden" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${overdue ? 'bg-gold' : (statusDot[b.status] ?? 'bg-line-strong')}`} />
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
                  <span className={`h-2 w-2 shrink-0 rounded-full ${overdue ? 'bg-gold' : (statusDot[b.status] ?? 'bg-line-strong')}`} />
                  <span className="text-xs text-ink-soft truncate">{overdue ? 'Kezelendő' : (statusLabel[b.status] ?? b.status)}</span>
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
  canManage?: boolean
}

function TimelineView({ date, bookings, staff, openMin, closeMin, onEdit, onCreate, onMove, canManage = false }: TLProps) {
  const totalMin = Math.max(closeMin - openMin, 60)
  const nowMin = useNowMinutes(date)
  const nowVisible = nowMin != null && nowMin >= openMin && nowMin <= closeMin
  const card = 'rounded-[26px] dav-card-glass'

  // Ha a nyitás nem kerek órakor van, a nyitás saját időpontja is kap jelölést — különben a
  // tengely csak a következő kerek órától indult, és a nyitás utáni első szakasz jelöletlen/
  // "levágottnak" tűnt.
  const hourMarks: number[] = []
  if (openMin % 60 !== 0) hourMarks.push(openMin)
  for (let m = Math.ceil(openMin / 60) * 60; m < closeMin; m += 60) hourMarks.push(m)

  const active = bookings.filter((b) => ACTIVE.has(b.status))
  // 6+ szakembernél a szakember-oszlopos rács már szűk képernyőn sem fér el kényelmesen (a
  // reszponzív oszlop-keskenyítés is elfogy) — ilyenkor desktopon is a mobil (egy közös,
  // óránkénti) elrendezést kapja, ne csak a kis képernyőnél váltson.
  const forceMobile = staff.length >= 6

  return (
    <>
      <div className={forceMobile ? '' : 'lg:hidden'}>
        <MobileTimeline {...{ hourMarks, active, openMin, closeMin, nowMin, onEdit }} />
      </div>
      {!forceMobile && (
        <div className="hidden lg:block">
          <StaffColumnsTimeline {...{ staff, active, hourMarks, openMin, closeMin, nowMin, card, onEdit }} />
        </div>
      )}
    </>
  )
}

// A kinyíló extra foglalás-kártyák „staggered spring" belépője (etalon: a UserMenu popover).
const TL_EXTRA_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

/** Megerősítve maradt, de a kezdés ideje már elmúlt, senki nem vezette át (befejezve/lemondva)
 *  — ez utólagos KEZELÉST igényel, ezért a "Függő" (arany) színt kapja a kártyán, nem a rendes
 *  sötét "megerősítve" színt (a piros "Késik" jelvény önmagában kevés volt). */
function needsHandling(b: Booking, nowMin: number | null): boolean {
  return nowMin != null && b.status === 'confirmed' && nowMin > hhmmToMinutes(b.start_time)
}

/** Egy idősáv-cella tartalma: vagy egyetlen foglalás, vagy egy [aktív, lemondott] pár, amikor
 *  ugyanarra az időre lemondtak egy foglalást, majd újra lefoglalták — ekkor a kettő egy
 *  kártya-veremben jelenik meg (a lemondott pirosan kandikál ki mögüle, kattintásra cserélnek). */
type CellItem = Booking | [Booking, Booking]

function cellKey(item: CellItem): string {
  return Array.isArray(item) ? `${item[0].id}-${item[1].id}` : String(item.id)
}

/** Az órás sávon belüli foglalásokat csoportosítja: az időben átfedő lemondott+aktív párok egy
 *  verembe kerülnek, a többi (magában álló, akár lemondott is) sima elem marad — időrendben. */
function groupOverlaps(rows: Booking[]): CellItem[] {
  const cancelled = rows.filter((b) => b.status === 'cancelled')
  const activeOnes = rows.filter((b) => b.status !== 'cancelled')
  const usedIds = new Set<string>()
  const pairs: [Booking, Booking][] = []
  for (const c of cancelled) {
    const cs = hhmmToMinutes(c.start_time)
    const ce = hhmmToMinutes(c.end_time)
    const partner = activeOnes.find((o) => {
      if (usedIds.has(String(o.id)) || idOf(o.staff) !== idOf(c.staff)) return false
      const os = hhmmToMinutes(o.start_time)
      const oe = hhmmToMinutes(o.end_time)
      return cs < oe && ce > os
    })
    if (partner) {
      usedIds.add(String(partner.id))
      usedIds.add(String(c.id))
      pairs.push([partner, c])
    }
  }
  // Ami emellett is átfedésben marad (pl. két lemondás ugyanarra a szakemberre/időre, aktív pár
  // nélkül) — ezeket ÁLTALÁNOSAN, egymás közt is összepárosítjuk, nehogy külön-külön, összevissza
  // jelenjenek meg.
  const leftover = rows
    .filter((b) => !usedIds.has(String(b.id)))
    .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
  for (let i = 0; i < leftover.length; i++) {
    const a = leftover[i]
    if (usedIds.has(String(a.id))) continue
    const as = hhmmToMinutes(a.start_time)
    const ae = hhmmToMinutes(a.end_time)
    for (let j = i + 1; j < leftover.length; j++) {
      const b = leftover[j]
      if (usedIds.has(String(b.id)) || idOf(a.staff) !== idOf(b.staff)) continue
      const bs = hhmmToMinutes(b.start_time)
      const be = hhmmToMinutes(b.end_time)
      if (as < be && ae > bs) {
        usedIds.add(String(a.id))
        usedIds.add(String(b.id))
        pairs.push([a, b])
        break
      }
    }
  }
  const singles = rows.filter((b) => !usedIds.has(String(b.id)))
  const items: { sortKey: number; node: CellItem }[] = [
    ...singles.map((b) => ({ sortKey: hhmmToMinutes(b.start_time), node: b as CellItem })),
    ...pairs.map((p) => ({
      sortKey: Math.min(hhmmToMinutes(p[0].start_time), hhmmToMinutes(p[1].start_time)),
      node: p as CellItem,
    })),
  ]
  items.sort((a, b) => a.sortKey - b.sortKey)
  return items.map((x) => x.node)
}

const STACK_PEEK_BG: Record<string, string> = {
  pending: '#F1CE45', confirmed: '#1D1C19', completed: '#c9c2ae', cancelled: CANCEL_RED,
}

/** Kártya-pár: ugyanarra az időre esik egy aktív ÉS egy lemondott foglalás (pl. lemondás után
 *  újra lefoglalták). EGYMÁS MELLETT állnak (nem egymáson — nincs átfedés/réteg, így semmi nem
 *  takarhat ki semmit), az aktuálisan "elöl" lévő a teljes kártyát kapja, a másik egy kis
 *  csíkra tolódik — kattintásra a szélességük FLIP-anmiálva cserél (mint a StatusPills sávjai). */
function BookingCardStack({
  items, onEdit, showAvatar, nowMin,
}: { items: [Booking, Booking]; onEdit: (b: Booking) => void; showAvatar: boolean; nowMin: number | null }) {
  // Két FÜGGETLEN szabály: a POZÍCIÓ (bal/jobb) mindig a lemondotté balra — ez fix, nem változik
  // kattintásra, hogy sose legyen megtévesztő, melyik időponthoz tartozik. Az ÁLLAPOT (melyik van
  // nyitva/nagyban) viszont a frissebb (később létrehozott, jellemzően az aktív) legyen alapból.
  const ordered = [...items].sort((a, b) => (a.status === 'cancelled' ? -1 : b.status === 'cancelled' ? 1 : 0))
  const freshestId = String([...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].id)
  const [frontId, setFrontId] = useState<string>(freshestId)
  return (
    <div className="flex h-[62px] items-stretch gap-1.5">
      {ordered.map((b) => {
        const id = String(b.id)
        const isFront = id === frontId
        return (
          <div
            key={id}
            onClick={isFront ? undefined : (e) => { e.stopPropagation(); setFrontId(id) }}
            role={isFront ? undefined : 'button'}
            tabIndex={isFront ? undefined : 0}
            aria-label={isFront ? undefined : `Előzmény megtekintése: ${b.customer_name} (${statusLabel[b.status] ?? b.status})`}
            className={`h-full overflow-hidden ${isFront ? 'min-w-0' : 'shrink-0 cursor-pointer rounded-[16px] shadow-dav-card'}`}
            style={{
              // Valódi flex-bázis átmenet (nem transform-alapú FLIP) — így a két testvér
              // MINDEN köztes képkockán is valódi, nem-átfedő flexbox-elrendezésben marad,
              // nem lóg bele egyik a másikba animáció közben.
              flexGrow: isFront ? 1 : 0,
              flexShrink: isFront ? 1 : 0,
              flexBasis: isFront ? '100%' : 24,
              transition: 'flex-grow 320ms cubic-bezier(0.22,1,0.36,1), flex-basis 320ms cubic-bezier(0.22,1,0.36,1)',
              background: !isFront ? (STACK_PEEK_BG[b.status] ?? '#c9c2ae') : undefined,
            }}
          >
            <AnimatePresence initial={false}>
              {isFront && (
                <motion.div
                  key="content"
                  className="h-full"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {renderBookingCard(b, onEdit, showAvatar, nowMin)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/** Egy cella-elem (sima foglalás, magában álló lemondott, vagy kártya-verem) kirajzolása. */
function renderCellItem(item: CellItem, onEdit: (b: Booking) => void, showAvatar: boolean, nowMin: number | null) {
  if (Array.isArray(item)) return <BookingCardStack items={item} onEdit={onEdit} showAvatar={showAvatar} nowMin={nowMin} />
  return renderBookingCard(item, onEdit, showAvatar, nowMin)
}

function renderBookingCard(b: Booking, onEdit: (b: Booking) => void, showAvatar = true, nowMin: number | null = null) {
  const svc = serviceOf(b)
  const st = staffOf(b)
  const overdue = needsHandling(b, nowMin)
  const block = overdue ? statusBlock.pending : (statusBlock[b.status] ?? 'bg-white border border-line text-ink')
  const dark = !overdue && STATUS_DARK_BG.has(b.status)
  return (
    <HoverButton
      onClick={() => onEdit(b)}
      className={`flex h-[62px] w-full items-center gap-2.5 rounded-[18px] border px-4 text-left shadow-dav-card ${block}`}
      style={overdue ? undefined : statusBg(b.status)}
    >
      {/* Szakember avatarja — gyors azonosítás, kihez van a foglalás. Csak mobilon/vegyes
          nézetben kell, ahol nincs külön szakember-oszlop — desktopon (szakember-oszlopok)
          felesleges, azt showAvatar=false-szal kapcsoljuk le. */}
      {showAvatar && (
        <Ava url={avatarUrlOf(st)} className={`h-8 w-8 shrink-0 rounded-full overflow-hidden ring-1 ${dark ? 'ring-white/20' : 'ring-black/5'}`} />
      )}
      <div className="min-w-0 flex-1">
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
            <span className={`h-2 w-2 rounded-full ${overdue ? 'bg-gold' : (statusDot[b.status] ?? 'bg-line-strong')}`} />
          </span>
        </div>
        <div className={`mt-0.5 truncate text-xs ${dark ? 'text-white/70' : 'text-ink-soft'}`}>
          {b.start_time}–{b.end_time}{st?.name ? ` · ${st.name}` : ''}
        </div>
      </div>
    </HoverButton>
  )
}

/** Óránkénti lista — a mobil idővonal "törzse" (idő-pill + foglalás-kártya/üres rés),
 *  a kártya-wrapper NÉLKÜL, hogy desktopon szakemberenként egymás mellé lehessen tenni
 *  (ld. StaffColumnsTimeline) — ÍGY garantáltan ugyanúgy néz ki, mint mobilon. */
function HourList({
  hourMarks, active, openMin, closeMin, nowMin, onEdit,
}: {
  hourMarks: number[]; active: Booking[]; openMin: number; closeMin: number; nowMin: number | null; onEdit: (b: Booking) => void
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const toggle = (m: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  return (
    <div>
        {hourMarks.map((m, i) => {
          const lo = i === 0 ? openMin : m
          const hi = i < hourMarks.length - 1 ? hourMarks[i + 1] : closeMin + 1
          const inHourRaw = active
            .filter((b) => { const s = hhmmToMinutes(b.start_time); return s >= lo && s < hi })
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          const inHour = groupOverlaps(inHourRaw)
          const isNow = nowMin != null && nowMin >= m && nowMin < (hourMarks[i + 1] ?? closeMin + 1)
          const isOpen = expanded.has(m)
          const pillCls = isNow ? 'bg-ink-dark text-white' : inHour.length > 0 ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
          const last = i === hourMarks.length - 1
          return (
            <div key={m} className="flex gap-3">
              <div className="flex w-[62px] shrink-0 flex-col items-center">
                <span className={`flex h-9 w-full items-center justify-center rounded-full px-3 text-[13px] font-semibold tabular-nums ${pillCls}`}>
                  {minutesToHHMMWrapped(m)}
                </span>
                {!last && (
                  <div className="relative flex min-h-[30px] flex-1 items-center justify-center py-1.5">
                    <span className="absolute inset-y-0 border-l-2 border-dotted border-line-strong" />
                    {inHour.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggle(m)}
                        aria-label={`még ${inHour.length - 1} foglalás ${minutesToHHMMWrapped(m)}-kor`}
                        className={`relative z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                      >
                        +{inHour.length - 1}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                {inHour.length > 0 ? (
                  <div>
                    {renderCellItem(inHour[0], onEdit, true, nowMin)}
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
                            {inHour.slice(1).map((item) => (
                              <motion.div key={cellKey(item)} variants={TL_EXTRA_ITEM}>
                                {renderCellItem(item, onEdit, true, nowMin)}
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
                    className="h-[62px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                    style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                  />
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}

/** Mobil idővonal — kártya-keret + cím + a közös HourList (minden szakember foglalása vegyítve). */
function MobileTimeline({
  hourMarks, active, openMin, closeMin, nowMin, onEdit,
}: {
  hourMarks: number[]; active: Booking[]; openMin: number; closeMin: number; nowMin: number | null; onEdit: (b: Booking) => void
}) {
  return (
    <div className="rounded-[26px] p-4 dav-card-glass">
      <div className="mb-3 text-[17px] font-medium text-ink">Napi időbeosztás</div>
      <HourList {...{ hourMarks, active, openMin, closeMin, nowMin, onEdit }} />
    </div>
  )
}

/** Idő × szakember (desktop) — pontosan a mobil idővonal kártya-stílusa, csak az idő-tengely
 *  EGYETLEN KÖZÖS oszlop balra (nem duplikálva szakemberenként), a szakemberek pedig a saját
 *  oszlopukban kapják a kártyáikat, ugyanahhoz a közös óra-sorhoz igazítva (CSS grid — minden
 *  sor automatikusan a legmagasabb cellájához igazodik, így a tengely és az oszlopok mindig
 *  egy vonalban maradnak, még ha az egyik oszlopban ki is nyílik egy "+N" extra foglalás). */
function StaffColumnsTimeline({
  staff, active, hourMarks, openMin, closeMin, nowMin, card, onEdit,
}: {
  staff: StaffMember[]; active: Booking[]; hourMarks: number[]; openMin: number; closeMin: number
  nowMin: number | null; card: string
  onEdit: (b: Booking) => void
}) {
  // Óránként EGY közös nyitó-gomb (a bal tengelyen, az idő alatt — mint mobilon), nem
  // szakemberenként külön — kattintásra az adott óra MINDEN oszlopában megjelennek az extrák.
  const [expandedHours, setExpandedHours] = useState<Set<number>>(() => new Set())
  const toggleHour = (m: number) =>
    setExpandedHours((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })

  // Szakemberenként/óránként előre kiszámolt foglalás-lista — ez adja a tartalom-cellákat ÉS
  // az összevont üres szakaszok határait is.
  const perStaffHourBookings = useMemo(
    () =>
      staff.map((t) =>
        hourMarks.map((m, i) => {
          const lo = i === 0 ? openMin : m
          const hi = i < hourMarks.length - 1 ? hourMarks[i + 1] : closeMin + 1
          const rows = active
            .filter((b) => {
              if (idOf(b.staff) !== String(t.id)) return false
              const s = hhmmToMinutes(b.start_time)
              return s >= lo && s < hi
            })
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          return groupOverlaps(rows)
        }),
      ),
    [staff, active, hourMarks, openMin, closeMin],
  )

  return (
    <div className={`${card} p-[18px] sm:p-[20px_22px_22px]`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[17px] font-medium text-ink">Napi időbeosztás</div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {[
            { c: '#1D1C19', l: 'Megerősített' },
            { c: '#F1CE45', l: 'Függő' },
            { c: 'repeating-linear-gradient(115deg,#f3efe4 0 3px,#e8e4d8 3px 5px)', l: 'Befejezett' },
            { c: CANCEL_RED, l: 'Lemondva' },
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
        <div className="overflow-x-auto">
          {(() => {
            // 4 szakemberig kényelmes 220px oszlop; afölött fokozatosan keskenyedik (de 160px
            // alá sosem megy, hogy az avatar+név+idő tartalom még olvasható maradjon) — így a
            // rács nem nő korlátlanul szélesre, amikor sok szakember dolgozik egyszerre.
            const colMin = staff.length <= 4 ? 220 : Math.max(160, Math.round(880 / staff.length))
            return (
              <div
                className="grid gap-x-3"
                style={{
                  gridTemplateColumns: `62px repeat(${staff.length}, minmax(${colMin}px, 1fr))`,
                  minWidth: 62 + staff.length * colMin,
                }}
              >
            {/* Fejléc-sor: üres bal sarok (a tengely fölött) + szakember-fejlécek. */}
            <div style={{ gridColumn: 1, gridRow: 1 }} />
            {staff.map((t, ci) => {
              const url = avatarUrlOf(t)
              return (
                <div key={String(t.id)} style={{ gridColumn: ci + 2, gridRow: 1 }} className="flex items-center gap-2.5 border-b border-line pb-3">
                  <Ava url={url} className="h-9 w-9 shrink-0 rounded-full overflow-hidden" />
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate leading-tight">{t.name}</span>
                    {t.role_title && <span className="block text-[11px] text-[#A8A496] truncate leading-tight">{t.role_title}</span>}
                  </div>
                </div>
              )
            })}

            {/* Bal tengely — EGY időpont-pill óránként, alatta (mint mobilon) a nyitó "+" gomb,
                ha ANY szakembernél van extra foglalás abban az órában; kattintásra minden
                érintett oszlopban egyszerre nyílnak ki az extrák. */}
            {hourMarks.map((m, i) => {
              const isNow = nowMin != null && nowMin >= m && nowMin < (hourMarks[i + 1] ?? closeMin + 1)
              const last = i === hourMarks.length - 1
              const anyInHour = perStaffHourBookings.some((rows) => rows[i].length > 0)
              const extraTotal = perStaffHourBookings.reduce((sum, rows) => sum + Math.max(0, rows[i].length - 1), 0)
              const isOpen = expandedHours.has(m)
              const pillCls = isNow ? 'bg-ink-dark text-white' : anyInHour ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
              return (
                <div
                  key={m}
                  style={{ gridColumn: 1, gridRow: i + 2 }}
                  className="flex flex-col items-center"
                >
                  <span className={`flex h-9 w-full items-center justify-center rounded-full px-2 text-[13px] font-semibold tabular-nums ${pillCls}`}>
                    {minutesToHHMMWrapped(m)}
                  </span>
                  {!last ? (
                    <div className="relative min-h-[16px] flex-1 py-1">
                      {/* A szaggatott vonal folytonosan fut a konténer teljes magasságában — a +
                          gomb ráülő "gyöngyként" fedi, nem szakítja meg. */}
                      <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dotted border-line-strong" />
                      {extraTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleHour(m)}
                          aria-label={`még ${extraTotal} foglalás ${minutesToHHMMWrapped(m)}-kor`}
                          className={`absolute left-1/2 top-1 z-10 flex h-5 w-5 -translate-x-1/2 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                        >
                          +{extraTotal}
                        </button>
                      )}
                    </div>
                  ) : (
                    extraTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleHour(m)}
                        aria-label={`még ${extraTotal} foglalás ${minutesToHHMMWrapped(m)}-kor`}
                        className={`relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                      >
                        +{extraTotal}
                      </button>
                    )
                  )}
                </div>
              )
            })}

            {/* Tartalom-cellák óránként — minden órának KÜLÖN sávja van (nincs függőleges
                összevonás a szomszédos órák közt). Amelyik órában több EGYMÁS MELLETTI
                szakember-oszlop is üres, azok VÍZSZINTESEN olvadnak egy folytonos,
                szegély/rés nélküli sraffozott sávvá. A grid `items-start`-tal fut (ld. fent) —
                így ha egy oszlop kinyílva magasabb lesz, a SZOMSZÉD (üres/foglalt) cellák NEM
                nyúlnak meg vele, a saját természetes magasságukban maradnak a sor tetején. */}
            {hourMarks.flatMap((m, i) => {
              const cells: React.ReactNode[] = []
              const isOpen = expandedHours.has(m)
              // A legtöbb extra (2., 3., ... foglalás) sorszáma, ami BÁRMELYIK szakembernél
              // előfordul ebben az órában — ennyi üres/foglalt extra sávnak kell megjelennie
              // MINDEN oszlopban kinyitáskor, hogy a sorok egy vonalban maradjanak.
              const maxExtra = Math.max(0, ...staff.map((_, ci) => perStaffHourBookings[ci][i].length - 1))
              const HatchBand = () => (
                <div
                  aria-hidden
                  className="h-[62px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                  style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                />
              )
              let ci = 0
              while (ci < staff.length) {
                const rows = perStaffHourBookings[ci][i]
                if (rows.length > 0) {
                  const t = staff[ci]
                  const hatchNeeded = maxExtra - (rows.length - 1)
                  cells.push(
                    <div key={`${t.id}-${m}`} style={{ gridColumn: ci + 2, gridRow: i + 2 }} className="pb-3">
                      {renderCellItem(rows[0], onEdit, false, nowMin)}
                      <AnimatePresence initial={false}>
                        {isOpen && maxExtra > 0 && (
                          <motion.div
                            key="extra"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                          >
                            <div className="space-y-2 pt-2">
                              {rows.slice(1).map((item) => (
                                <div key={cellKey(item)}>{renderCellItem(item, onEdit, false, nowMin)}</div>
                              ))}
                              {Array.from({ length: hatchNeeded }).map((_, hi) => (
                                <HatchBand key={`hatch-${hi}`} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>,
                  )
                  ci += 1
                } else {
                  const start = ci
                  while (ci < staff.length && perStaffHourBookings[ci][i].length === 0) ci += 1
                  const span = ci - start
                  cells.push(
                    <div
                      key={`gap-${m}-${start}`}
                      style={{ gridColumn: `${start + 2} / span ${span}`, gridRow: i + 2 }}
                      className="pb-3"
                    >
                      <HatchBand />
                      <AnimatePresence initial={false}>
                        {isOpen && maxExtra > 0 && (
                          <motion.div
                            key="extra"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                          >
                            <div className="space-y-2 pt-2">
                              {Array.from({ length: maxExtra }).map((_, hi) => (
                                <HatchBand key={`hatch-${hi}`} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>,
                  )
                }
              }
              return cells
            })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

