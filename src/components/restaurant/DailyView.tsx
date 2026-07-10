'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, minutesToHHMM, durationMinutes } from '@/lib/utils'
import { List, LayoutGrid, Map as MapIcon, Plus, Users, Clock, Repeat } from 'lucide-react'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { TableGlyph } from './TableGlyph'
import { ReservationActions } from './ReservationActions'
import { ReservationEditSheet, type EditTarget } from './ReservationEditSheet'
import { OfflineBanner } from './OfflineBanner'
import { useRestaurantUI } from './RestaurantUIContext'
import { getDrafts, subscribeDrafts, type ReservationDraft } from '@/lib/offlineDrafts'
import type { Reservation, Table, Room } from '@/payload/payload-types'

type ViewMode = 'list' | 'timeline' | 'floor'
const STORAGE_KEY = 'restaurant-daily-view'

const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár', confirmed: 'Megerősítve', seated: 'Leültetve',
  completed: 'Befejezett', no_show: 'Nem jött meg', cancelled: 'Lemondva',
}
// Tömör blokk-színek (háttér) a davelopment-design kánon szerint. Kiosztás:
// confirmed=sötét (alap, megerősített — referencia #1D1C19), pending=gold (függő),
// seated=zöld (MOST a teremben ül — #1D9D63), completed=fehér kártya (befejezett vendég),
// no_show=piros (probléma), cancelled=szaggatott áthúzott.
const statusBlock: Record<string, string> = {
  pending: 'bg-[#F1CE45] text-ink-dark border-[#F1CE45]',
  confirmed: 'bg-[#1D1C19] text-white border-[#1D1C19]',
  seated: 'bg-[#1D9D63] text-white border-[#1D9D63]',
  completed: 'bg-white text-ink border-line',
  no_show: 'bg-red-500 text-white border-red-600',
  cancelled:
    'text-ink-soft2 border border-dashed border-[#A0A096]/60 line-through bg-[repeating-linear-gradient(115deg,rgba(200,195,180,.5)_0_6px,rgba(225,220,206,.5)_6px_12px)]',
}
const statusDot: Record<string, string> = {
  pending: 'bg-gold', confirmed: 'bg-ink-dark', seated: 'bg-emerald-600',
  completed: 'bg-[#C9C2AE]', no_show: 'bg-red-500', cancelled: 'bg-[#D8D2C2]',
}
const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed'])

// Forrás-címke a nem-online (személyzet által rögzített) foglalásokhoz
const sourceBadge: Record<string, string> = { walk_in: 'Beeső', phone: 'Telefon' }

/** Idővonal-csoport: egy terem (vagy „nincs terem") asztalaival. */
type TimelineGroup = { name: string | null; room: Room | null; tables: Table[] }

/** Terem-pill felirata a referencia szerint: „kültéri · szezonális" / „egész évben". */
function roomPillLabel(room: Room | null): string {
  if (!room) return 'egész évben'
  const outdoor = room.is_outdoor
  const seasonal = room.seasonal
  if (outdoor && seasonal) return 'kültéri · szezonális'
  if (outdoor) return 'kültéri'
  if (seasonal) return 'szezonális'
  return 'egész évben'
}

/** Időérzékeny sürgősség-jelzés egy foglaláshoz a jelenlegi perchez (nowMin) képest.
 *  Csak akkor él, ha a megtekintett nap ma van (nowMin != null). A státusz mellé
 *  ad egy figyelemfelkeltő badge-et a hostnak: késés / asztal mindjárt lejár / túlfutás. */
export type Urgency = { label: string; cls: string; pulse: boolean }
export function urgencyOf(r: Reservation, nowMin: number | null): Urgency | null {
  if (nowMin == null) return null
  const start = hhmmToMinutes(r.start_time)
  const end = hhmmToMinutes(r.end_time)
  const red = 'bg-red-500 text-white border-red-600'
  const orange = 'bg-orange-500 text-white border-orange-600'

  // Késik: megerősítve, de a kezdés ideje már elmúlt és még nem ültették le
  if (r.status === 'confirmed' && nowMin > start) {
    return { label: `Késik ${nowMin - start} perce`, cls: red, pulse: true }
  }
  if (r.status === 'seated') {
    // Túllépte: leültetve, de a vége ideje már elmúlt — csúszik a rotáció
    if (nowMin > end) return { label: `Túlfut ${nowMin - end} perce`, cls: red, pulse: true }
    // Mindjárt lejár: a vége 15 percen belül — jön a következő foglalás
    if (end - nowMin <= 15) return { label: `Lejár ${end - nowMin} perc`, cls: orange, pulse: false }
  }
  return null
}

export interface DailyViewProps {
  date: string
  restaurantId: string
  /** Választható esemény-típusok (alkalmak) az admin szerkesztő-laphoz. */
  eventTypes?: { icon: string; label: string }[]
  reservations: Reservation[]
  rooms: Room[]
  tables: Table[]
  /** A nap nyitvatartása (perc), a timeline tengelyhez */
  openMin: number
  closeMin: number
  turnMinutes: number
  /** Értesítésből érkezve ezt a foglalást nyitjuk meg automatikusan a sheet-ben. */
  openReservationId?: string
  /** Fejléc-alcím + KPI-csík értékei (a server komponens számolja). */
  roomCount: number
  tableCount: number
  activeCount: number
  completedCount: number
  cancelledCount: number
  walkInCount: number
  /** A toolbar-ba ágyazott, csak ezen az oldalon használt vezérlők. */
  dateFilter: React.ReactNode
  printButton: React.ReactNode
}

/** A belső nézetek (Timeline/Floor) propjai — csak az adat/geometria. */
type ViewProps = Pick<
  DailyViewProps,
  'date' | 'reservations' | 'rooms' | 'tables' | 'openMin' | 'closeMin' | 'turnMinutes'
>

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

function tableIdsOf(r: Reservation): string[] {
  return (r.tables ?? []).map((t) => String(typeof t === 'object' && t ? t.id : t))
}

function tableNamesOf(r: Reservation): string[] {
  return (r.tables ?? [])
    .map((t) => (typeof t === 'object' && t ? t.name : null))
    .filter((n): n is string => !!n)
}

/** Egy lokális vázlatból olyan "ál-foglalás" készül, ami beleilleszkedik a
 *  meglévő nézetekbe (kapacitás/foglaltság), de a __draft jelölővel végig
 *  vázlatként látszik. A draftId a véglegesítéshez/törléshez kell. */
type DraftReservation = Reservation & { __draft: true; draftId: string }
export function isDraft(r: Reservation): r is DraftReservation {
  return (r as DraftReservation).__draft === true
}

function draftToReservation(d: ReservationDraft): DraftReservation {
  return {
    id: d.draftId as unknown as number,
    customer_name: d.customer_name || 'Telefonos foglalás',
    customer_phone: d.customer_phone || '',
    customer_email: d.customer_email || '',
    pax: d.pax,
    date: d.date,
    start_time: d.start_time,
    end_time: d.end_time || d.start_time,
    notes: d.notes || '',
    status: (d.status || 'confirmed') as Reservation['status'],
    occasion: d.occasion ?? null,
    occasion_icon: d.occasion_icon ?? null,
    tables: (d.tableIds ?? []).map((id, i) => ({
      id: id as unknown as number,
      name: d.tableNames?.[i] ?? String(id),
    })) as unknown as Reservation['tables'],
    __draft: true,
    draftId: d.draftId,
  } as unknown as DraftReservation
}

export function DailyView(props: DailyViewProps) {
  const {
    date, restaurantId, eventTypes, rooms, tables, openMin, closeMin, turnMinutes, openReservationId,
    roomCount, tableCount, activeCount, completedCount, cancelledCount, walkInCount,
    dateFilter, printButton,
  } = props
  const [view, setView] = useState<ViewMode>('timeline')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<ReservationDraft[]>([])
  const { enterFocus, exitFocus, focusMode } = useRestaurantUI()

  // Lokális vázlatok betöltése + élő követése (saját és más fülek).
  useEffect(() => {
    setDrafts(getDrafts(restaurantId))
    return subscribeDrafts(restaurantId, setDrafts)
  }, [restaurantId])

  // A vázlatok beolvadnak a foglalások közé (kapacitásba számítanak), de
  // jelölve maradnak. Csak az adott napra eső vázlatokat fűzzük hozzá.
  const reservations = useMemo(() => {
    const dayDrafts = drafts.filter((d) => d.date === date).map(draftToReservation)
    return [...props.reservations, ...dayDrafts]
  }, [props.reservations, drafts, date])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
    if (saved === 'list' || saved === 'timeline' || saved === 'floor') {
      setView(saved)
      // Perzisztált timeline nézettel betöltve rögtön fókusz módba lépünk.
      if (saved === 'timeline') enterFocus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pick = (v: ViewMode) => {
    setView(v)
    localStorage.setItem(STORAGE_KEY, v)
    // Timeline-ra váltás → fókusz mód (nav csuk + KPI rejt); egyébként normál.
    if (v === 'timeline') enterFocus()
    else exitFocus()
  }

  // Értesítésből érkezve (?reservation=) automatikusan megnyitjuk a sheet-et az adott
  // foglaláshoz. Az utoljára megnyitott id-t jegyezzük: ha egy MÁSIK értesítésre
  // kattintasz (új id), újra megnyílik — ugyanarra viszont nem nyílik fel feleslegesen.
  const lastOpenedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openReservationId || lastOpenedRef.current === openReservationId) return
    const r = props.reservations.find((x) => String(x.id) === String(openReservationId))
    if (r) {
      lastOpenedRef.current = openReservationId
      setTarget({ reservation: r })
    }
  }, [openReservationId, props.reservations])

  const router = useRouter()
  const openEdit = (reservation: Reservation) => setTarget({ reservation })
  const openCreate = (presetStart?: string, presetTableId?: string | number | null) =>
    setTarget({ reservation: null, presetStart, presetTableId })

  // Foglalás áthelyezése drag&drop-ból: új időpont és/vagy asztal. A szerver validál
  // (ütközés, nyitvatartás, kapacitás) — hibánál a router.refresh visszaállítja az
  // eredeti pozíciót, és toast jelzi az okot. Vázlatot (offline draft) nem mozgatunk.
  const moveReservation = async (r: Reservation, newStart: string, newTableId: string | number) => {
    if (isDraft(r)) return
    try {
      const res = await fetch('/api/restaurant/manage-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reservationId: r.id,
          date,
          start_time: newStart,
          pax: r.pax,
          tableIds: [newTableId],
          // Ha a ledobott asztal önmagában kicsi, a szerver a szabad, összetolható
          // szomszédokkal próbálja kiegészíteni a létszámig (nem néma hiba).
          autoCombine: true,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone ?? '',
          customer_email: r.customer_email ?? '',
          notes: r.notes ?? '',
          status: r.status,
          source: r.source,
          occasion: r.occasion ?? null,
          occasion_icon: r.occasion_icon ?? null,
          duration_minutes: hhmmToMinutes(r.end_time) - hhmmToMinutes(r.start_time),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Az áthelyezés nem sikerült')
      // Ha összevonás történt (több asztal), jelezzük külön.
      const combined = Array.isArray(json.reservation?.tables) && json.reservation.tables.length > 1
      toast.success(combined ? 'Áthelyezve — asztalok összevonva' : 'Foglalás áthelyezve')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Az áthelyezés nem sikerült')
      router.refresh() // visszaállítja az eredeti pozíciót
    }
  }

  const viewButtons: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'timeline', icon: LayoutGrid, label: 'Idősáv' },
    { mode: 'list', icon: List, label: 'Lista' },
    { mode: 'floor', icon: MapIcon, label: 'Terem' },
  ]

  const dayDrafts = useMemo(
    () => drafts.filter((d) => d.date === date).sort((a, b) => a.createdAt - b.createdAt),
    [drafts, date],
  )


  return (
    <div className="space-y-5">
      <OfflineBanner
        restaurantId={restaurantId}
        drafts={dayDrafts}
        onReview={(d) => setTarget({ reservation: draftToReservation(d) })}
      />

      {/* ── Fejléc-sor: cím + alcím · toolbar ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] lg:text-[42px] font-light tracking-[-0.02em] text-ink leading-none">
            Foglalások
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-soft2">
            Napi idősáv · {roomCount} terem · {tableCount} asztal
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
          {printButton}
          <button
            onClick={() => openCreate()}
            className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-dav-pill bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="h-[15px] w-[15px] shrink-0 text-gold" strokeWidth={2.2} />
            <span className="hidden sm:inline">Új foglalás</span>
          </button>
        </div>
      </div>

      {/* ── Fejléc a cím ALATT: státusz-csík (bal) + nagy KPI-számok (jobb) — a nap VALÓS adatai,
          ugyanaz az animáció/viselkedés, mint az Áttekintésen (StatusPills + CountUpKpi). ── */}
      {!focusMode && (() => {
        const totalRes = reservations.length || 1
        const confirmedCount = reservations.filter((r) => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed').length
        const pendingCount = reservations.filter((r) => r.status === 'pending').length
        const paxTotal = reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + (r.pax ?? 0), 0)
        const avgParty = activeCount > 0 ? Math.round((paxTotal / activeCount) * 10) / 10 : 0
        const HATCH = 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)'
        return (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <StatusPills
              eager
              className="flex-1 lg:max-w-[760px]"
              segments={[
                { label: 'Megerősített', pct: Math.round((confirmedCount / totalRes) * 100), background: '#1D1C19', color: '#fff' },
                { label: 'Függő', pct: Math.round((pendingCount / totalRes) * 100), background: '#F1CE45', color: '#1D1C19' },
                { label: 'Lemondva', pct: Math.round((cancelledCount / totalRes) * 100), background: HATCH, color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
              ]}
            />
            <div className="flex flex-wrap items-start gap-8 lg:gap-10">
              <CountUpKpi icon="calendar" value={activeCount} label="Foglalás" />
              <CountUpKpi icon="users" value={paxTotal} label="Vendég" />
              <CountUpKpi icon="walkin" value={walkInCount} label="Beeső (walk-in)" />
              <CountUpKpi icon="gauge" value={avgParty} label="Átl. létszám" decimals={1} />
            </div>
          </div>
        )
      })()}

      {view === 'list' && <ListView date={date} reservations={reservations} onEdit={openEdit} />}
      {view === 'timeline' && (
        <TimelineView
          date={date}
          {...{ reservations, rooms, tables, openMin, closeMin, turnMinutes }}
          onEdit={openEdit}
          onCreate={openCreate}
          onMove={moveReservation}
        />
      )}
      {view === 'floor' && (
        <FloorView
          date={date}
          {...{ reservations, rooms, tables, openMin, closeMin, turnMinutes }}
          onEdit={openEdit}
        />
      )}

      <ReservationEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={date}
        restaurantId={restaurantId}
        eventTypes={eventTypes}
        target={target}
        openMin={openMin}
        closeMin={closeMin}
      />
    </div>
  )
}

/* ---------- Lista nézet ---------- */
function ListView({ date, reservations, onEdit }: { date: string; reservations: Reservation[]; onEdit: (r: Reservation) => void }) {
  const card = 'rounded-[26px] dav-card-glass'
  const nowMin = useNowMinutes(date)
  const nowRef = useRef<HTMLDivElement>(null)

  // Az első foglalás indexe, ami a jelenlegi perctől kezdődik (vagy később).
  // Ide kerül a „most” elválasztó; csak ha ma van és belefér a listába.
  const nowIndex = nowMin == null
    ? -1
    : reservations.findIndex((r) => hhmmToMinutes(r.start_time) >= nowMin)

  useEffect(() => {
    const el = nowRef.current
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [nowIndex, date])

  if (reservations.length === 0) {
    return <div className={`${card} p-12 text-center text-ink-soft`}>Erre a napra nincs foglalás.</div>
  }
  return (
    <div className={`${card} divide-y divide-line overflow-hidden`}>
      {reservations.map((r, i) => {
        const tableNames = tableNamesOf(r)
        const draft = isDraft(r)
        const urgency = draft ? null : urgencyOf(r, nowMin)
        const showNow = i === nowIndex
        return (
          <Fragment key={r.id}>
            {showNow && (
              <div ref={nowRef} className="relative flex items-center gap-2 px-4 sm:px-5 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-soft-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">Most · {minutesToHHMM(nowMin!)}</span>
                <span className="h-px flex-1 bg-red-500/40" />
              </div>
            )}
          <div
            className={`relative flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 transition-colors hover:bg-[var(--dav-glass)] ${draft ? 'border-l-2 border-dashed border-gold bg-gold/[0.08]' : ''}`}
          >
            {urgency && (
              <span
                className={`absolute right-2 top-2 z-10 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm ${urgency.cls} ${urgency.pulse ? 'animate-soft-pulse' : ''}`}
              >
                {urgency.label}
              </span>
            )}
            <button onClick={() => onEdit(r)} className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 text-left">
              <div className="w-11 sm:w-12 shrink-0">
                <div className="text-sm sm:text-base font-semibold text-ink tabular-nums leading-tight">{r.start_time}</div>
                <div className="text-[11px] text-ink-soft2 tabular-nums">{r.end_time}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${statusDot[r.status] ?? 'bg-line-strong'}`} />
                  <span className="font-medium text-ink truncate">{r.customer_name}</span>
                  {draft && (
                    <span className="shrink-0 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-dark">
                      Vázlat
                    </span>
                  )}
                  {!draft && sourceBadge[r.source] && (
                    <span className="shrink-0 rounded-md bg-[#EDE7D6] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A8B52]">
                      {sourceBadge[r.source]}
                    </span>
                  )}
                  {r.occasion && (() => {
                    const OccIcon = eventIconByKey(r.occasion_icon)
                    return (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
                        <OccIcon className="h-3 w-3" /> {r.occasion}
                      </span>
                    )
                  })()}
                  {r.series_id && (
                    // Ismétlődő sorozat tagja (közös series_id). Csak jelölés — a viselkedést nem érinti.
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#F0E7CF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A7B12]">
                      <Repeat className="h-3 w-3" /> Sorozat
                    </span>
                  )}
                </div>
                <div className="text-sm text-ink-soft truncate">
                  {r.pax} fő{tableNames.length > 0 ? ` · ${tableNames.join(' + ')} asztal${tableNames.length > 1 ? ' (összevont)' : ''}` : ''}{r.customer_phone ? ` · ${r.customer_phone}` : ''}
                </div>
                {r.notes && <div className="text-xs text-ink-soft2 mt-0.5 truncate">„{r.notes}”</div>}
              </div>
            </button>
            <div className="flex items-center shrink-0">
              <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[r.status] ?? 'bg-line-strong'}`} />
                <span className="text-xs text-ink-soft truncate">
                  {statusLabel[r.status] ?? r.status}
                </span>
              </span>
              <div className="flex items-center justify-end w-10 shrink-0">
                {!draft && <ReservationActions reservationId={r.id} status={r.status} />}
              </div>
            </div>
          </div>
          </Fragment>
        )
      })}
    </div>
  )
}

/* ---------- Timeline (asztal × idő rács) ---------- */
function TimelineView({
  date, reservations, rooms, tables, openMin, closeMin, turnMinutes, onEdit, onCreate, onMove,
}: ViewProps & {
  onEdit: (r: Reservation) => void
  onCreate: (start?: string, tableId?: string | number | null) => void
  onMove: (r: Reservation, newStart: string, newTableId: string | number) => void
}) {
  const totalMin = Math.max(closeMin - openMin, 60)
  const nowMin = useNowMinutes(date)
  const nowVisible = nowMin != null && nowMin >= openMin && nowMin <= closeMin
  const card = 'rounded-[26px] dav-card-glass'

  // óránkénti rácsvonalak
  const hourMarks: number[] = []
  for (let m = Math.ceil(openMin / 60) * 60; m < closeMin; m += 60) hourMarks.push(m)

  const active = reservations.filter((r) => ACTIVE.has(r.status))

  // sorok termenként csoportosítva
  const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const tablesByRoom = new Map<string, Table[]>()
  const noRoom: Table[] = []
  for (const t of [...tables].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
    if (rid == null) noRoom.push(t)
    else {
      const arr = tablesByRoom.get(String(rid)) ?? []
      arr.push(t)
      tablesByRoom.set(String(rid), arr)
    }
  }
  const groups: TimelineGroup[] = [
    ...roomOrder.map((r) => ({ name: r.name, room: r, tables: tablesByRoom.get(String(r.id)) ?? [] })),
    ...(noRoom.length ? [{ name: roomOrder.length ? 'Egyéb' : null, room: null, tables: noRoom }] : []),
  ].filter((g) => g.tables.length > 0)

  return (
    <>
      {/* Mobil: Crextio Mobile függőleges idővonal (óra-pillek pontozott vonallal + kártyák) */}
      <div className="lg:hidden">
        <MobileTimeline {...{ hourMarks, active, openMin, closeMin, nowMin, onEdit }} />
      </div>
      {/* Desktop: a teljes nap egy nézetben (százalékos) */}
      <div className="hidden lg:block">
        <TableGrid
          {...{ groups, active, hourMarks, openMin, closeMin, totalMin, turnMinutes, nowMin, nowVisible, card, onEdit, onCreate, onMove }}
          mode="fit"
        />
      </div>
    </>
  )
}

/** Mobil függőleges idővonal (Crextio Mobile "Schedule"): óránként egy sor —
 *  bal oldalt idő-pill pontozott összekötővel (most = sötét, van foglalás = gold,
 *  egyébként outline), jobbra a foglalás-kártyák (megerősített/leültetve = sötét
 *  kártya, egyéb = fehér). A kártya kattintható → szerkesztő. */
// A kinyíló extra foglalás-kártyák „staggered spring" belépője (etalon: a UserMenu popover)
// — a kártyák egymás után úsznak be, nem ugranak; záráskor a konténer magassága rugósan összecsuk.
const TL_EXTRA_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

// A sötét-hátterű (fehér szövegű) státuszok — a másodlagos sor színéhez.
const STATUS_DARK_BG = new Set(['confirmed', 'seated', 'no_show'])

/** Egyetlen foglalás-kártya a mobil idővonalon (az első és a kinyíló extrák is ezt használják).
 *  A háttér a KÁNONI `statusBlock` palettából jön — ugyanaz, mint a desktopon. */
function renderReservationCard(
  r: Reservation,
  onEdit: (r: Reservation) => void,
  tableNamesOf: (r: Reservation) => string[],
) {
  const tn = tableNamesOf(r)
  const block = statusBlock[r.status] ?? 'bg-white border border-line text-ink'
  const dark = STATUS_DARK_BG.has(r.status)
  return (
    <button
      type="button"
      onClick={() => onEdit(r)}
      className={`flex h-[62px] w-full flex-col justify-center rounded-[18px] border px-4 text-left shadow-dav-card transition-transform active:scale-[0.99] ${block}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold">
          {r.customer_name} · {r.pax} fő
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* Ugyanazok a jelölők, mint a lista-nézetben: alkalom + ismétlődő sorozat. */}
          {r.occasion && (() => {
            const OccIcon = eventIconByKey(r.occasion_icon)
            return (
              <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
                <OccIcon className="h-3 w-3" /> {r.occasion}
              </span>
            )
          })()}
          {r.series_id && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#F0E7CF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A7B12]">
              <Repeat className="h-3 w-3" /> Sorozat
            </span>
          )}
          <span className={`h-2 w-2 rounded-full ${statusDot[r.status] ?? 'bg-line-strong'}`} />
        </span>
      </div>
      <div className={`mt-0.5 truncate text-xs ${dark ? 'text-white/70' : 'text-ink-soft'}`}>
        {r.start_time}–{r.end_time}{tn.length ? ` · ${tn.join(' + ')}` : ''}
      </div>
    </button>
  )
}

function MobileTimeline({
  hourMarks, active, openMin, closeMin, nowMin, onEdit,
}: {
  hourMarks: number[]
  active: Reservation[]
  openMin: number
  closeMin: number
  nowMin: number | null
  onEdit: (r: Reservation) => void
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const toggle = (m: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })
  const tableNamesOf = (r: Reservation) =>
    (r.tables ?? []).map((t) => (typeof t === 'object' && t ? t.name : null)).filter((n): n is string => !!n)

  // Crextio „Schedule" panel: üveges, áttetsző kártya — az oldal-gradient átdereng rajta.
  // Az üres órák helyén szaggatott hatch-placeholder pill jelzi, hogy nincs foglalás.
  return (
    <div className="rounded-[26px] p-4 dav-card-glass">
      <div className="mb-3 text-[17px] font-medium text-ink">Mai szervizterv</div>
      <div>
        {hourMarks.map((m, i) => {
          const lo = i === 0 ? openMin : m
          const hi = i < hourMarks.length - 1 ? hourMarks[i + 1] : closeMin + 1
          const inHour = active
            .filter((r) => { const s = hhmmToMinutes(r.start_time); return s >= lo && s < hi })
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          const isNow = nowMin != null && nowMin >= m && nowMin < (hourMarks[i + 1] ?? closeMin + 1)
          const pax = inHour.reduce((s, r) => s + (r.pax ?? 0), 0)
          const isOpen = expanded.has(m)
          const pillCls = isNow
            ? 'bg-ink-dark text-white'
            : inHour.length > 0
              ? 'bg-gold text-ink-dark'
              : 'border border-line bg-white text-ink-soft'
          const last = i === hourMarks.length - 1
          return (
            <div key={m} className="flex gap-3">
              {/* Bal: idő-pill + szaggatott összekötő a létszám-badge-dzsel */}
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
                        aria-label={`${inHour.length} foglalás ${minutesToHHMM(m)}-kor — ${isOpen ? 'bezárás' : 'megnyitás'}`}
                        className={`relative z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                      >
                        {pax}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Jobb: alapból az első foglalás kártyája, kinyitva az összes.
                  A kinyíló extra kártyák staggered springgel úsznak be (nem ugranak). */}
              <div className="min-w-0 flex-1 pb-3">
                {inHour.length > 0 ? (
                  <div>
                    {renderReservationCard(inHour[0], onEdit, tableNamesOf)}
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
                            {inHour.slice(1).map((r) => (
                              <motion.div key={r.id} variants={TL_EXTRA_ITEM}>
                                {renderReservationCard(r, onEdit, tableNamesOf)}
                              </motion.div>
                            ))}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  // Üres óra — Crextio „prison" szaggatott hatch-placeholder kártya (nincs foglalás)
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

/** Asztal × idő rács. `mode='scroll'`: fix px/perc, vízszintesen görgethető
 *  (mobil). `mode='fit'`: a teljes nap egy nézetbe fér százalékos pozícióval
 *  (desktop). A foglalás-blokkok tartalma közös. */
const PX_PER_MIN = 2.4 // scroll módban 1 perc = 2.4px → 30 perc = 72px
function TableGrid({
  groups, active, hourMarks, openMin, closeMin, totalMin, turnMinutes, nowMin, nowVisible, card, mode, onEdit, onCreate, onMove,
}: {
  groups: TimelineGroup[]
  active: Reservation[]
  hourMarks: number[]
  openMin: number
  closeMin: number
  totalMin: number
  turnMinutes: number
  nowMin: number | null
  nowVisible: boolean
  card: string
  mode: 'scroll' | 'fit'
  onEdit: (r: Reservation) => void
  onCreate: (start?: string, tableId?: string | number | null) => void
  onMove: (r: Reservation, newStart: string, newTableId: string | number) => void
}) {
  const fit = mode === 'fit'
  const labelW = 'w-[110px] sm:w-[150px]'
  // A foglalás-sáv vízszintes geometriája — fit: %, scroll: px.
  const left = (min: number) => (fit ? `${((min - openMin) / totalMin) * 100}%` : `${(min - openMin) * PX_PER_MIN}px`)
  const span = (min: number) => (fit ? `${(min / totalMin) * 100}%` : `${min * PX_PER_MIN}px`)
  const axisWidth = fit ? undefined : totalMin * PX_PER_MIN

  // ── Drag & drop: foglalás-blokk áthelyezése (időpont + asztal) ──
  // Húzás közben egy fixed overlay-blokk követi az egeret (vízszintesen + függőlegesen),
  // és kiemeljük a cél asztal-sort. Elengedéskor onMove → szerver (15 perces rács).
  type DragState = {
    r: Reservation
    dur: number
    previewMin: number // a blokk kezdete (perc, 15-re kerekítve) a cél-soron
    tableId: string | number // cél asztal (amelyik sor fölött az egér van)
    cx: number; cy: number // élő kurzor pozíció (fixed overlay-hez)
    grabDx: number // a fogáspont eltolása a blokk elejétől (px), hogy ne ugorjon
    widthPx: number // a húzott blokk szélessége px-ben
  }
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Pending: a pointerdown még NEM indít drag-et, csak előkészíti. Valódi húzás csak akkor
  // indul, ha az egér/ujj ≥ DRAG_THRESHOLD px-et mozdul — különben kattintásnak vesszük
  // (szerkesztés megnyitása). Így rá lehet kattintani a foglalásra, nem ugrik egyből mozgatásba.
  const pendingRef = useRef<{ r: Reservation; init: DragState; startX: number; startY: number } | null>(null)
  // A blokk-kattintás utáni buborékoló `click`-et elnyomja a háttér-soron (ne hozzon létre újat).
  const blockNextRowClickRef = useRef(false)
  const DRAG_THRESHOLD = 5

  const xToMin = (clientX: number, rowEl: HTMLElement): number => {
    const rect = rowEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round((openMin + ratio * totalMin) / 15) * 15
  }

  // Pending → drag promóció (küszöb) ÉS pending → kattintás (ha nem mozdult eleget).
  useEffect(() => {
    const onPendingMove = (e: PointerEvent) => {
      const p = pendingRef.current
      if (!p || dragRef.current) return // már drag-elünk, vagy nincs pending
      if (Math.abs(e.clientX - p.startX) >= DRAG_THRESHOLD || Math.abs(e.clientY - p.startY) >= DRAG_THRESHOLD) {
        // Átléptük a küszöböt → valódi húzás indul.
        dragRef.current = p.init
        setDrag(p.init)
        pendingRef.current = null
      }
    }
    const onPendingUp = () => {
      const p = pendingRef.current
      pendingRef.current = null
      // Ha volt pending de sosem lett drag (küszöb alatt engedte fel) → kattintás = szerkesztés.
      // A blokkra-kattintás után a böngésző egy `click`-et is kilő, ami a háttér-sor
      // onClick-jére (új foglalás) buborékolna — ezt a flaggel elnyomjuk.
      if (p && !dragRef.current) {
        blockNextRowClickRef.current = true
        // Ha valamiért nem jön buborékoló click, a flag ne ragadjon be.
        setTimeout(() => { blockNextRowClickRef.current = false }, 300)
        onEdit(p.r)
      }
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
      // Melyik asztal-sor fölött vagyunk? Az overlay pointer-events:none, így az
      // elementFromPoint az ALATTA lévő sort találja meg (nem a húzott blokkot).
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const axis = el?.closest<HTMLElement>('[data-axis-table]')
      const tableId = axis?.dataset.axisTable ?? cur.tableId
      const rowAxis = axis ?? gridRef.current?.querySelector<HTMLElement>(`[data-axis-table="${cur.tableId}"]`)
      // Az időpont a blokk ELEJÉHEZ igazodik: a fogáspont (grabDx) korrekciójával.
      let previewMin = cur.previewMin
      if (rowAxis) {
        previewMin = xToMin(e.clientX - cur.grabDx, rowAxis)
        previewMin = Math.max(openMin, Math.min(previewMin, closeMin - cur.dur))
      }
      const next = { ...cur, previewMin, tableId, cx: e.clientX, cy: e.clientY }
      dragRef.current = next
      setDrag(next)
    }
    const onUp = () => {
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!cur) return
      const newStart = minutesToHHMM(cur.previewMin)
      const origTableId = firstTableId(cur.r)
      const changed = newStart !== cur.r.start_time || String(cur.tableId) !== String(origTableId)
      if (changed) onMove(cur.r, newStart, cur.tableId)
    }
    window.addEventListener('pointermove', onMoveEvt)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMoveEvt)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, openMin, closeMin, totalMin, onMove])

  const firstTableId = (r: Reservation): string | number => {
    const t = r.tables?.[0]
    return (t && typeof t === 'object' ? t.id : t) ?? ''
  }
  // Pointerdown a foglalás-blokkon: NEM indít drag-et azonnal, csak előkészíti. A valódi
  // húzás a küszöb-átlépéskor indul (lásd a pending→drag effektet), addig kattintható.
  const beginPointer = (r: Reservation, e: React.PointerEvent) => {
    if (isDraft(r)) return
    const s = hhmmToMinutes(r.start_time)
    const dur = hhmmToMinutes(r.end_time) - s
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const init: DragState = {
      r, dur, previewMin: s, tableId: firstTableId(r),
      cx: e.clientX, cy: e.clientY,
      grabDx: e.clientX - rect.left,
      widthPx: rect.width,
    }
    pendingRef.current = { r, init, startX: e.clientX, startY: e.clientY }
  }

  return (
    <>
    <div className={`${card} p-[18px] sm:p-[20px_22px_22px]`}>
      {/* Fejléc: „Mai szervizterv" + jelmagyarázat */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div className="text-[17px] font-medium text-ink">Mai szervizterv</div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {[
            { c: '#1D1C19', l: 'Megerősített' },
            { c: '#F1CE45', l: 'Függő' },
            { c: '#1D9D63', l: 'Leültetve' },
            { c: '#FFFFFF', l: 'Befejezett' },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-[7px]">
              <span className="h-[11px] w-[11px] rounded-[3px] border border-line" style={{ background: x.c }} />
              <span className="text-xs font-medium text-ink-soft2">{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={gridRef} className={fit ? '' : 'overflow-x-auto'}>
      <div style={fit ? undefined : { minWidth: (axisWidth ?? 0) + 150 }}>
        {/* idő-tengely (vonalzó) */}
        <div className="flex">
          <div className={`${labelW} shrink-0`} />
          <div className="relative flex-1 min-w-0 h-5" style={fit ? undefined : { width: axisWidth }}>
            {hourMarks.map((m) => (
              <span
                key={m}
                className="absolute top-0 text-[11px] font-medium tabular-nums text-[#A8A496]"
                style={{ left: left(m) }}
              >
                {minutesToHHMM(m)}
              </span>
            ))}
            {nowVisible && (
              <span
                className="absolute -top-1 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
                style={{ left: left(nowMin!) }}
              >
                {minutesToHHMM(nowMin!)}
              </span>
            )}
          </div>
        </div>

        {groups.map((g, gi) => (
          <div key={`${gi}-${g.name ?? 'none'}`}>
            {g.name && (
              <div className="flex items-center gap-[9px] pt-3.5 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">
                  {g.name}
                </span>
                <span className="rounded-[10px] bg-[#EDE7D6] px-[9px] py-[3px] text-[10px] font-semibold text-[#9A8B52]">
                  {roomPillLabel(g.room)}
                </span>
              </div>
            )}
            {g.tables.map((t) => {
              const rows = active.filter((r) => tableIdsOf(r).includes(String(t.id)))
              // Üres idősávok (a foglalások előtti/közti/utáni szabad rések) — Crextio
              // szaggatott hatch-pillekkel jelölve, mint a mobil nézetben. A foglalás-blokkok
              // ezek FÖLÉ rendelődnek; a <15 perces réseket kihagyjuk (nem jelölünk pici sávot).
              const sortedRows = [...rows].sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
              const freeGaps: Array<[number, number]> = []
              let gapCursor = openMin
              for (const r of sortedRows) {
                const gs = hhmmToMinutes(r.start_time)
                const ge = hhmmToMinutes(r.end_time)
                if (gs - gapCursor >= 15) freeGaps.push([gapCursor, gs])
                gapCursor = Math.max(gapCursor, ge)
              }
              if (closeMin - gapCursor >= 15) freeGaps.push([gapCursor, closeMin])
              const isDropTarget = drag && String(drag.tableId) === String(t.id)
              // Húzás közben: az az asztal, ami önmagában kisebb a húzott foglalás létszámánál,
              // piros/halvány (ejtéskor a szerver a szomszédokkal próbálja összevonni).
              const dragging = !!drag
              const tooSmall = dragging && t.capacity < (drag?.r.pax ?? 0)
              return (
                <div
                  key={t.id}
                  className={`flex items-stretch border-t border-line transition-colors ${
                    isDropTarget
                      ? tooSmall
                        ? 'bg-red-500/[0.10] ring-1 ring-inset ring-red-400/70'
                        : 'bg-gold/[0.16]'
                      : dragging && tooSmall
                        ? 'opacity-45'
                        : 'hover:bg-[var(--dav-glass)]'
                  }`}
                >
                  <div className={`${labelW} shrink-0 flex flex-col justify-center py-2 pr-2`}>
                    <span className="text-sm font-semibold text-ink truncate leading-tight">{t.name}</span>
                    <span className={`text-[11px] tabular-nums leading-tight ${tooSmall ? 'font-semibold text-red-500' : 'text-[#A8A496]'}`}>{t.capacity} fő</span>
                  </div>
                  <div
                    data-axis-table={t.id}
                    // Az üres sáv NEM kattintható (nem hoz létre foglalást) — csak drop-cél marad,
                    // ide húzható meglévő foglalás. Új foglalás a fejléc „Új foglalás" gombjából.
                    className="relative flex-1 min-w-0 h-[64px]"
                    style={fit ? undefined : { width: axisWidth }}
                  >
                    {hourMarks.map((m) => (
                      <span
                        key={m}
                        className="absolute inset-y-0 w-px bg-[rgba(120,110,70,.09)]"
                        style={{ left: left(m) }}
                      />
                    ))}
                    {/* Üres rések — szaggatott hatch-pillek (húzáskor elrejtve, hogy ne takarják a drop-highlightot) */}
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
                      <span
                        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-red-500/80"
                        style={{ left: left(nowMin!) }}
                      />
                    )}
                    {rows.map((r) => {
                      const s = hhmmToMinutes(r.start_time)
                      const e = hhmmToMinutes(r.end_time)
                      const dur = e - s
                      const draft = isDraft(r)
                      const urgency = draft ? null : urgencyOf(r, nowMin)
                      // ≥ 2 óra: van vízszintes hely → név | badge egy sorban, létszám | idő egy sorban.
                      // 30 perc – 2 óra: keskeny blokk → minden egymás alatt.
                      // ≤ 30 perc: pici blokk → csak a név (minden más a tooltipben/kattintásra).
                      const wide = dur >= 120
                      const tiny = dur <= 30

                      const badge = urgency ? (
                        <span
                          className={`w-fit max-w-full shrink-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${urgency.cls} ${urgency.pulse ? 'animate-soft-pulse' : ''}`}
                        >
                          {urgency.label}
                        </span>
                      ) : null
                      const name = (
                        <span className="min-w-0 flex-1 truncate font-semibold leading-tight">
                          {draft ? '✎ ' : ''}{r.customer_name}
                        </span>
                      )
                      const pax = (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] opacity-75 leading-tight">
                          <Users className="h-2.5 w-2.5 shrink-0" />{r.pax}
                        </span>
                      )
                      const occasion = r.occasion ?? null
                      const OccIcon = occasion ? eventIconByKey(r.occasion_icon) : null
                      // Alkalom-jelvény a pillen: KIS arany ikon-kör (ne takarja a nevet). A teljes
                      // felirat a tooltipben + a megnyitott foglalás fejlécében látszik.
                      const occasionBadge = occasion && OccIcon ? (
                        <span title={occasion} className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-gold text-ink-dark ring-1 ring-black/10">
                          <OccIcon className="h-2.5 w-2.5" strokeWidth={2.4} />
                        </span>
                      ) : null
                      // Keskeny blokkon a pontos időpont helyett kompakt időtartam (🕐 1,5ó).
                      const durLabel = `${(dur / 60).toFixed(dur % 60 === 0 ? 0 : 1).replace('.', ',')}ó`
                      const time = (
                        <span className="truncate text-[10px] tabular-nums opacity-75 leading-tight">{r.start_time}–{r.end_time}</span>
                      )
                      const durChip = (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] opacity-75 leading-tight">
                          <Clock className="h-2.5 w-2.5 shrink-0" />{durLabel}
                        </span>
                      )

                      // Húzás közben az eredeti blokk a helyén marad halványan, és
                      // pointer-events:none, hogy az elementFromPoint az alatta lévő sort lássa.
                      // A kurzort egy külön fixed overlay-blokk követi (lásd lent).
                      const isDragging = drag?.r.id === r.id
                      return (
                        <button
                          key={r.id}
                          onPointerDown={(ev) => { if (!draft) { ev.stopPropagation(); beginPointer(r, ev) } }}
                          title={`${draft ? 'VÁZLAT — ' : 'Kattints a szerkesztéshez, vagy húzd át másik időpontra/asztalra · '}${r.customer_name} · ${r.pax} fő · ${r.start_time}–${r.end_time} · ${urgency ? urgency.label : statusLabel[r.status]}`}
                          className={`absolute top-[7px] bottom-[7px] rounded-[11px] border px-[11px] text-xs font-medium overflow-hidden text-left flex flex-col justify-center gap-0.5 transition-all ${draft ? 'border-2 border-dashed border-gold bg-gold/[0.18] text-ink-dark cursor-default' : `${statusBlock[r.status]} cursor-grab active:cursor-grabbing hover:brightness-[1.06]`} ${isDragging ? 'opacity-30 pointer-events-none' : ''}`}
                          style={{ left: `calc(${left(s)} + 2px)`, width: `calc(${span(dur)} - 4px)`, touchAction: 'none' }}
                        >
                          {tiny ? (
                            <>
                              {/* pici blokk (≤30 perc): csak név (+ alkalom-ikon); a többi a tooltipben. */}
                              <span className="flex w-full min-w-0 items-center gap-1 text-[11px] font-semibold leading-tight">
                                {OccIcon && <OccIcon className="h-2.5 w-2.5 shrink-0 opacity-80" />}
                                <span className="truncate">{draft ? '✎ ' : ''}{r.customer_name}</span>
                              </span>
                            </>
                          ) : wide ? (
                            <>
                              {/* széles blokk: név | alkalom | badge, alatta létszám | idő */}
                              <span className="flex min-w-0 items-center gap-1.5">
                                {name}
                                {occasionBadge}
                                {badge}
                              </span>
                              <span className="flex min-w-0 items-center gap-2">
                                {pax}
                                {time}
                              </span>
                            </>
                          ) : (
                            <>
                              {/* keskeny blokk: badge, név + alkalom, majd létszám + időtartam */}
                              {badge}
                              <span className="flex w-full min-w-0 items-center gap-1.5">
                                <span className="min-w-0 flex-1 truncate font-semibold leading-tight">
                                  {draft ? '✎ ' : ''}{r.customer_name}
                                </span>
                                {occasionBadge}
                              </span>
                              <span className="flex min-w-0 shrink-0 items-center gap-2">
                                {pax}
                                {durChip}
                              </span>
                            </>
                          )}
                        </button>
                      )
                    })}
                    {/* Zárás utáni sraffozott (zárva) rész a track végén */}
                    {closeMin < openMin + totalMin && (
                      <span
                        className="pointer-events-none absolute inset-y-0 right-0 border-l-[1.5px] border-dashed border-[rgba(150,140,100,.4)] bg-[repeating-linear-gradient(115deg,rgba(190,180,140,.16)_0_5px,transparent_5px_10px)]"
                        style={{ left: left(closeMin) }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      </div>
    </div>

    {/* Húzott blokk — fixed overlay, követi a kurzort (pointer-events:none, hogy az
        elementFromPoint az alatta lévő sort lássa). A cél időpont + asztal a fejlécben. */}
    {drag && typeof document !== 'undefined' && createPortal(
      <div
        className="pointer-events-none fixed z-[200] rounded-[11px] border border-black/10 bg-gold px-2.5 py-1.5 text-xs font-bold text-ink-dark shadow-2xl ring-2 ring-gold"
        style={{
          left: drag.cx - drag.grabDx,
          top: drag.cy - 18,
          width: drag.widthPx,
          opacity: 0.95,
        }}
      >
        <div className="truncate">{drag.r.customer_name}</div>
        <div className="tabular-nums opacity-80">
          {minutesToHHMM(drag.previewMin)}–{minutesToHHMM(drag.previewMin + drag.dur)}
        </div>
      </div>,
      document.body,
    )}
    </>
  )
}

/* ---------- Floor plan (TÉRBELI élő nézet: pozíció + élő státusz + idő-csúszka) ---------- */
function FloorView({
  date, reservations, rooms, tables, openMin, closeMin, onEdit,
}: ViewProps & { onEdit: (r: Reservation) => void }) {
  const isTodayView = ymdLocal(new Date()) === date
  const initialMin = () => {
    const now = new Date()
    const cur = now.getHours() * 60 + now.getMinutes()
    const base = isTodayView ? cur : (openMin + closeMin) / 2
    return Math.round(Math.max(openMin, Math.min(base, closeMin)) / 5) * 5
  }
  const [atMin, setAtMin] = useState(initialMin)
  const [live, setLive] = useState(isTodayView)
  const card = 'rounded-[26px] dav-card-glass'

  // ÉLŐ: ha be van kapcsolva és ma van, ~fél percenként a valós időre ugrik.
  useEffect(() => {
    if (!live || !isTodayView) return
    const tick = () => { const n = new Date(); setAtMin(n.getHours() * 60 + n.getMinutes()) }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [live, isTodayView])

  const active = reservations.filter((r) => ACTIVE.has(r.status))
  const occupantOf = (tableId: string) =>
    active.find((r) => tableIdsOf(r).includes(tableId) && atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time)) ?? null
  /** A következő közelgő foglalás az asztalra (bármikor később ma), perc-távolsággal. */
  const nextOf = (tableId: string): NextRes => {
    const up = active
      .filter((r) => tableIdsOf(r).includes(tableId) && hhmmToMinutes(r.start_time) > atMin)
      .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))[0]
    if (!up) return null
    return { r: up, inMin: hhmmToMinutes(up.start_time) - atMin }
  }

  const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const tablesByRoom = (roomId: string | null) =>
    [...tables]
      .filter((t) => {
        const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
        return roomId == null ? rid == null : String(rid) === roomId
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const roomEntries = [
    ...roomOrder.map((r) => ({ id: String(r.id), name: r.name, tables: tablesByRoom(String(r.id)) })),
    ...(tablesByRoom(null).length
      ? [{ id: 'no-room', name: roomOrder.length ? 'Egyéb' : 'Asztalok', tables: tablesByRoom(null) }]
      : []),
  ].filter((e) => e.tables.length > 0)

  const occCountIn = (tbls: Table[]) => tbls.filter((t) => !!occupantOf(String(t.id))).length

  const occupiedTableIds = new Set(
    active.filter((r) => atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time)).flatMap((r) => tableIdsOf(r)),
  )
  const free = tables.length - occupiedTableIds.size
  const occPct = tables.length ? Math.round((occupiedTableIds.size / tables.length) * 100) : 0

  const timeControl = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => { setLive(true); const n = new Date(); if (isTodayView) setAtMin(n.getHours() * 60 + n.getMinutes()) }}
          disabled={!isTodayView}
          title="Vissza a jelenlegi időre"
          className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:opacity-40 ${live && isTodayView ? 'bg-ink-dark text-white' : 'bg-[#f1f0ed] text-ink-soft hover:text-ink'}`}
        >
          <span className={`h-2 w-2 rounded-full ${live && isTodayView ? 'bg-[#F1CE45] animate-soft-pulse' : 'bg-ink-soft2'}`} /> Élő
        </button>
        <span className="w-16 shrink-0 text-2xl font-light tracking-[-0.02em] tabular-nums text-ink">{minutesToHHMM(atMin)}</span>
        <input
          type="range" min={openMin} max={closeMin} step={5} value={atMin}
          onChange={(e) => { setLive(false); setAtMin(Number(e.target.value)) }}
          aria-label="Időpont a napon belül"
          className="order-last h-6 w-full cursor-pointer accent-[var(--dav-accent)] sm:order-none sm:w-auto sm:flex-1"
        />
        <span className="shrink-0 text-xs tabular-nums text-ink-soft2">{free} szabad · {occPct}% telt</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-medium text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: 'var(--dav-line-strong)', background: '#fff' }} /> Szabad</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#E4BE35' }} /> Hamarosan</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#1D9D63' }} /> Leültetve</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F1CE45' }} /> Függő</span>
      </div>
    </div>
  )

  return (
    <div className={`${card} space-y-4 p-4`}>
      {timeControl}

      {roomEntries.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-ink-soft">Nincs asztal ehhez a helyhez.</div>
      ) : (
        <div className="space-y-5">
          {roomEntries.map((e) => (
            <div key={e.id}>
              {roomEntries.length > 1 && (
                <div className="mb-2.5 flex items-center gap-2">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-soft">{e.name}</h3>
                  <span className="text-[12px] tabular-nums text-ink-soft2">{occCountIn(e.tables)}/{e.tables.length} foglalt</span>
                </div>
              )}
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))' }}>
                {e.tables.map((t) => (
                  <LiveTableCard
                    key={String(t.id)}
                    table={t}
                    occ={occupantOf(String(t.id))}
                    next={nextOf(String(t.id))}
                    atMin={atMin}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type NextRes = { r: Reservation; inMin: number } | null

/** Egy asztal-kártya az élő terem-nézetben — az Asztalok menü kinézete (`TableGlyph` + kártya),
 *  élő státusz-jelzésekkel: szabad / hamarosan / leültetve / függő, + „még X perc", „mindjárt
 *  szabadul", „késik X perc", eltelt-idő sáv, és a KÖVETKEZŐ foglalás előnézete. */
function LiveTableCard({
  table: t, occ, next, atMin, onEdit,
}: {
  table: Table
  occ: Reservation | null
  next: NextRes
  atMin: number
  onEdit: (r: Reservation) => void
}) {
  const SOON = 45
  const FINISHING = 15
  const LATE = 10
  const soon = next && next.inMin <= SOON ? next : null

  let tone = { card: 'border-line bg-white', badge: 'bg-[#f1f0ed] text-ink-soft2', dot: 'bg-ink-soft2', pulse: false, label: 'Szabad' }
  let primary: React.ReactNode = <span className="text-ink-soft2">Szabad</span>
  let sub: React.ReactNode = null
  let elapsedPct = 0
  let progress: 'none' | 'seated' | 'finishing' = 'none'
  let onClick: (() => void) | undefined
  let title = `${t.name} · szabad`

  if (occ) {
    const startM = hhmmToMinutes(occ.start_time)
    const endM = hhmmToMinutes(occ.end_time)
    const remaining = Math.max(0, endM - atMin)
    const lateMin = atMin - startM
    elapsedPct = Math.max(0, Math.min(100, ((atMin - startM) / durationMinutes(startM, endM)) * 100))
    onClick = () => onEdit(occ)
    title = `${occ.customer_name ?? ''} · ${occ.pax} fő · ${occ.start_time}–${occ.end_time}`
    primary = <span className="font-medium text-ink">{occ.customer_name ?? '—'} · {occ.pax} fő</span>

    if (occ.status === 'pending') {
      const late = lateMin >= LATE
      tone = { card: 'border-gold/50 bg-gold/[0.06]', badge: 'bg-gold/20 text-[#8a6d1e]', dot: 'bg-gold', pulse: true, label: 'Függő' }
      sub = late
        ? <span className="font-semibold text-[#C0564A]">késik {lateMin}p · nincs megerősítve</span>
        : <span className="text-ink-soft">megerősítésre vár · {occ.start_time}</span>
    } else if (occ.status === 'confirmed' && lateMin >= LATE) {
      // Megerősítve, de a foglalás ideje óta nem ült le → késik.
      tone = { card: 'border-[#C0564A]/45 bg-[#C0564A]/[0.05]', badge: 'bg-[#C0564A]/12 text-[#C0564A]', dot: 'bg-[#C0564A]', pulse: true, label: 'Késik' }
      sub = <span className="font-semibold text-[#C0564A]">{lateMin} perce késik</span>
      progress = 'seated'
    } else {
      const finishing = remaining <= FINISHING
      tone = finishing
        ? { card: 'border-[#E4BE35]/55 bg-[#FFF8E1]', badge: 'bg-[#E4BE35]/25 text-[#8a6d1e]', dot: 'bg-[#E4BE35]', pulse: true, label: 'Mindjárt szabadul' }
        : { card: 'border-[#1D9D63]/45 bg-[#1D9D63]/[0.06]', badge: 'bg-[#1D9D63]/15 text-[#177f4f]', dot: 'bg-[#1D9D63]', pulse: false, label: 'Leültetve' }
      sub = (
        <span className={finishing ? 'font-semibold text-[#8a6d1e]' : 'text-ink-soft'}>
          még <span className="tabular-nums">{remaining}p</span> · <span className="tabular-nums">{occ.end_time}</span>-ig
        </span>
      )
      progress = finishing ? 'finishing' : 'seated'
    }
  } else if (soon) {
    tone = { card: 'border-[#E4BE35]/55 bg-[#FFF8E1]', badge: 'bg-[#E4BE35]/25 text-[#8a6d1e]', dot: 'bg-[#E4BE35]', pulse: true, label: 'Hamarosan' }
    title = `${soon.r.customer_name ?? ''} · ${soon.inMin} perc múlva`
    primary = <span className="font-medium text-ink">{soon.r.customer_name ?? '—'} · {soon.r.pax} fő</span>
    sub = <span className="text-ink-soft"><span className="tabular-nums">{soon.inMin}p</span> múlva · <span className="tabular-nums">{soon.r.start_time}</span></span>
  } else {
    sub = next
      ? <span className="text-ink-soft2">következő <span className="tabular-nums">{next.r.start_time}</span></span>
      : <span className="text-ink-soft2">nincs több mára</span>
  }

  // Foglalt asztalnál a KÖVETKEZŐ foglalás előnézete (ha van), külön mikro-sor.
  const afterPreview = occ && next ? <span className="text-ink-soft2">utána <span className="tabular-nums">{next.r.start_time}</span></span> : null

  const barBg = progress === 'finishing' ? 'bg-[#E4BE35]/20' : 'bg-[#1D9D63]/15'
  const barFg = progress === 'finishing' ? 'bg-[#E4BE35]' : 'bg-[#1D9D63]'

  const Wrap: React.ElementType = onClick ? 'button' : 'div'
  return (
    <Wrap
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      title={title}
      className={`relative block w-full rounded-[18px] border p-4 text-left transition-all ${tone.card} ${onClick ? 'cursor-pointer hover:shadow-dav-card' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <TableGlyph capacity={t.capacity} />
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${tone.pulse ? 'animate-soft-pulse' : ''}`} />
          {tone.label}
        </span>
      </div>
      <div className="mt-3 truncate text-[20px] font-semibold tracking-[-0.01em] text-ink">{t.name}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
        <Users className="h-3 w-3" /> <span className="tabular-nums">{t.capacity} fő</span>
      </div>
      <div className="mt-1.5 truncate text-[12px]">{primary}</div>
      {sub && (
        <div className="mt-0.5 flex items-center gap-1 truncate text-[11.5px]">
          <Clock className="h-3 w-3 shrink-0 text-ink-soft2" /> {sub}
        </div>
      )}
      {progress !== 'none' && (
        <div className={`mt-2.5 h-1 overflow-hidden rounded-full ${barBg}`}>
          <div className={`h-full rounded-full ${barFg}`} style={{ width: `${elapsedPct}%` }} />
        </div>
      )}
      {afterPreview && <div className="mt-1.5 truncate text-[11px]">{afterPreview}</div>}
    </Wrap>
  )
}
