'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'
import { List, LayoutGrid, Map as MapIcon, Plus, Users, Clock, Cake } from 'lucide-react'
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
// Tömör blokk-színek (háttér). Kiosztás: confirmed=sárga (alap, leggyakoribb — "várjuk"),
// seated=indigó/lila (MOST a teremben ül), completed=zöld (sikeresen befejezett),
// no_show=piros (probléma), pending (ritka)=ugyanaz mint confirmed, cancelled=fakó áthúzott.
const statusBlock: Record<string, string> = {
  pending: 'bg-amber-400/90 text-amber-950 border-amber-500',
  confirmed: 'bg-amber-400/90 text-amber-950 border-amber-500',
  seated: 'bg-indigo-500/90 text-white border-indigo-600',
  completed: 'bg-emerald-500/90 text-white border-emerald-600',
  no_show: 'bg-red-500/90 text-white border-red-600',
  cancelled: 'bg-zinc-200 text-zinc-400 border-zinc-300 line-through',
}
const statusDot: Record<string, string> = {
  pending: 'bg-amber-400', confirmed: 'bg-amber-400', seated: 'bg-indigo-500',
  completed: 'bg-emerald-500', no_show: 'bg-red-500', cancelled: 'bg-zinc-300',
}
const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed'])

// Forrás-címke a nem-online (személyzet által rögzített) foglalásokhoz
const sourceBadge: Record<string, string> = { walk_in: 'Beeső', phone: 'Telefon' }

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
  reservations: Reservation[]
  rooms: Room[]
  tables: Table[]
  /** A nap nyitvatartása (perc), a timeline tengelyhez */
  openMin: number
  closeMin: number
  turnMinutes: number
  /** Értesítésből érkezve ezt a foglalást nyitjuk meg automatikusan a sheet-ben. */
  openReservationId?: string
}

/** A belső nézetek (Timeline/Floor) propjai — restaurantId nélkül. */
type ViewProps = Omit<DailyViewProps, 'restaurantId' | 'openReservationId'>

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
    is_birthday: d.is_birthday ?? false,
    tables: (d.tableIds ?? []).map((id, i) => ({
      id: id as unknown as number,
      name: d.tableNames?.[i] ?? String(id),
    })) as unknown as Reservation['tables'],
    __draft: true,
    draftId: d.draftId,
  } as unknown as DraftReservation
}

export function DailyView(props: DailyViewProps) {
  const { date, restaurantId, rooms, tables, openMin, closeMin, turnMinutes, openReservationId } = props
  const [view, setView] = useState<ViewMode>('list')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<ReservationDraft[]>([])
  const { enterFocus, exitFocus } = useRestaurantUI()

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
          customer_name: r.customer_name,
          customer_phone: r.customer_phone ?? '',
          customer_email: r.customer_email ?? '',
          notes: r.notes ?? '',
          status: r.status,
          source: r.source,
          is_birthday: r.is_birthday ?? false,
          duration_minutes: hhmmToMinutes(r.end_time) - hhmmToMinutes(r.start_time),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Az áthelyezés nem sikerült')
      toast.success('Foglalás áthelyezve')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Az áthelyezés nem sikerült')
      router.refresh() // visszaállítja az eredeti pozíciót
    }
  }

  const viewButtons: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'list', icon: List, label: 'Lista' },
    { mode: 'timeline', icon: LayoutGrid, label: 'Idővonal' },
    { mode: 'floor', icon: MapIcon, label: 'Terem' },
  ]

  const dayDrafts = useMemo(
    () => drafts.filter((d) => d.date === date).sort((a, b) => a.createdAt - b.createdAt),
    [drafts, date],
  )

  return (
    <div className="space-y-4">
      <OfflineBanner
        restaurantId={restaurantId}
        drafts={dayDrafts}
        onReview={(d) => setTarget({ reservation: draftToReservation(d) })}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-zinc-100 dark:bg-white/[0.06] p-1">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => pick(mode)}
              title={label}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                view === mode
                  ? 'bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-white/40 hover:text-zinc-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-sm font-bold hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Új foglalás</span>
        </button>
      </div>

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
        target={target}
        openMin={openMin}
        closeMin={closeMin}
      />
    </div>
  )
}

/* ---------- Lista nézet ---------- */
function ListView({ date, reservations, onEdit }: { date: string; reservations: Reservation[]; onEdit: (r: Reservation) => void }) {
  const card = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'
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
    return <div className={`${card} p-12 text-center text-zinc-500 dark:text-zinc-400`}>Erre a napra nincs foglalás.</div>
  }
  return (
    <div className={`${card} divide-y divide-zinc-100 dark:divide-white/[0.06]`}>
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
            className={`relative flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 ${draft ? 'border-l-2 border-dashed border-amber-400 bg-amber-50/40 dark:bg-amber-500/[0.06]' : ''}`}
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
                <div className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white tabular-nums leading-tight">{r.start_time}</div>
                <div className="text-[11px] text-zinc-400 tabular-nums">{r.end_time}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                  <span className="font-medium text-zinc-900 dark:text-white truncate">{r.customer_name}</span>
                  {draft && (
                    <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                      Vázlat
                    </span>
                  )}
                  {!draft && sourceBadge[r.source] && (
                    <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-white/[0.1] dark:text-white/60">
                      {sourceBadge[r.source]}
                    </span>
                  )}
                  {r.is_birthday && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-700 dark:bg-pink-500/20 dark:text-pink-300">
                      <Cake className="h-3 w-3" /> Szülinap
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  {r.pax} fő{tableNames.length > 0 ? ` · ${tableNames.join(' + ')} asztal${tableNames.length > 1 ? ' (összevont)' : ''}` : ''}{r.customer_phone ? ` · ${r.customer_phone}` : ''}
                </div>
                {r.notes && <div className="text-xs text-zinc-400 mt-0.5 truncate">„{r.notes}”</div>}
              </div>
            </button>
            <div className="flex items-center shrink-0">
              <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                <span className="text-xs text-zinc-500 dark:text-white/40 truncate">
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
  const card = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

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
  const groups: { name: string | null; tables: Table[] }[] = [
    ...roomOrder.map((r) => ({ name: r.name, tables: tablesByRoom.get(String(r.id)) ?? [] })),
    ...(noRoom.length ? [{ name: roomOrder.length ? 'Egyéb' : null, tables: noRoom }] : []),
  ].filter((g) => g.tables.length > 0)

  return (
    <>
      {/* Mobil: az eredeti, vízszintesen görgethető fix-px idővonal */}
      <div className="lg:hidden">
        <TableGrid
          {...{ groups, active, hourMarks, openMin, closeMin, totalMin, turnMinutes, nowMin, nowVisible, card, onEdit, onCreate, onMove }}
          mode="scroll"
        />
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

/** Asztal × idő rács. `mode='scroll'`: fix px/perc, vízszintesen görgethető
 *  (mobil). `mode='fit'`: a teljes nap egy nézetbe fér százalékos pozícióval
 *  (desktop). A foglalás-blokkok tartalma közös. */
const PX_PER_MIN = 2.4 // scroll módban 1 perc = 2.4px → 30 perc = 72px
function TableGrid({
  groups, active, hourMarks, openMin, closeMin, totalMin, turnMinutes, nowMin, nowVisible, card, mode, onEdit, onCreate, onMove,
}: {
  groups: { name: string | null; tables: Table[] }[]
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
  const labelW = 'w-24 sm:w-32'
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
    <div ref={gridRef} className={`${card} ${fit ? 'overflow-hidden' : 'overflow-x-auto'}`}>
      <div style={fit ? undefined : { minWidth: (axisWidth ?? 0) + 128 }}>
        {/* idő-tengely fejléc */}
        <div className="flex z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-white/[0.06]">
          <div className={`${labelW} shrink-0 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400`}>
            Asztal
          </div>
          <div className="relative flex-1 min-w-0 py-2.5" style={fit ? undefined : { width: axisWidth }}>
            {hourMarks.map((m) => (
              <span
                key={m}
                className="absolute top-2.5 -translate-x-1/2 text-[11px] font-medium tabular-nums text-zinc-400 dark:text-white/40"
                style={{ left: left(m) }}
              >
                {minutesToHHMM(m)}
              </span>
            ))}
            {nowVisible && (
              <span
                className="absolute top-1 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm"
                style={{ left: left(nowMin!) }}
              >
                {minutesToHHMM(nowMin!)}
              </span>
            )}
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.name ?? 'none'}>
            {g.name && (
              <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-white/[0.04] border-b border-zinc-100 dark:border-white/[0.06]">
                {g.name}
              </div>
            )}
            {g.tables.map((t) => {
              const rows = active.filter((r) => tableIdsOf(r).includes(String(t.id)))
              const isDropTarget = drag && String(drag.tableId) === String(t.id)
              return (
                <div
                  key={t.id}
                  className={`flex min-h-[3.25rem] border-b border-zinc-50 dark:border-white/[0.04] transition-colors ${
                    isDropTarget ? 'bg-amber-100/60 dark:bg-amber-500/[0.12]' : 'hover:bg-zinc-50/50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <div className={`${labelW} shrink-0 px-4 flex items-center justify-between gap-1 border-r border-zinc-50 dark:border-white/[0.04]`}>
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{t.name}</span>
                    <span className="flex items-center gap-0.5 text-[11px] text-zinc-400 shrink-0 tabular-nums">
                      <Users className="h-3 w-3 shrink-0" />{t.capacity}
                    </span>
                  </div>
                  <div
                    data-axis-table={t.id}
                    className="relative flex-1 min-w-0 cursor-pointer"
                    style={fit ? undefined : { width: axisWidth }}
                    onClick={(e) => {
                      if (drag) return // húzás közben ne hozzon létre újat
                      // Ha épp egy foglalás-blokkra kattintottunk (szerkesztés), a buborékoló
                      // click-et itt elnyeljük — különben új foglalást hozna létre a sávon.
                      if (blockNextRowClickRef.current) { blockNextRowClickRef.current = false; return }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const min = openMin + Math.round((e.clientX - rect.left) / rect.width * totalMin / 15) * 15
                      onCreate(minutesToHHMM(Math.max(openMin, Math.min(min, closeMin - turnMinutes))), t.id)
                    }}
                  >
                    {hourMarks.map((m) => (
                      <span
                        key={m}
                        className="absolute inset-y-0 w-px bg-zinc-100/70 dark:bg-white/[0.04]"
                        style={{ left: left(m) }}
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
                      // < 2 óra: keskeny blokk → minden egymás alatt (semmi nem csonkul a min-h miatt).
                      const wide = dur >= 120

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
                      const birthday = !!r.is_birthday
                      const cakeChip = birthday ? (
                        <span className="flex shrink-0 items-center gap-1 rounded bg-pink-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          <Cake className="h-2.5 w-2.5 shrink-0" />Szülinap
                        </span>
                      ) : null
                      const time = (
                        <span className="flex min-w-0 items-center gap-1.5 text-[10px] leading-tight">
                          {cakeChip}
                          <span className="truncate tabular-nums opacity-75">{r.start_time}–{r.end_time}</span>
                        </span>
                      )
                      // Keskeny blokkon a pontos időpont helyett kompakt időtartam (🕐 1,5ó),
                      // így a létszám mellé fér egy sorba.
                      const durLabel = `${(dur / 60).toFixed(dur % 60 === 0 ? 0 : 1).replace('.', ',')}ó`
                      const durChip = cakeChip ?? (
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
                          className={`absolute top-1/2 -translate-y-1/2 max-h-[calc(100%-0.5rem)] rounded-md border px-2 py-1.5 text-xs font-medium overflow-hidden text-left flex flex-col justify-center gap-0.5 shadow-sm transition-all ${draft ? 'border-2 border-dashed border-amber-500 bg-amber-100/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100 cursor-default' : `${statusBlock[r.status]} cursor-grab active:cursor-grabbing hover:brightness-105`} ${isDragging ? 'opacity-30 pointer-events-none' : ''}`}
                          style={{ left: `calc(${left(s)} + 2px)`, width: `calc(${span(dur)} - 4px)`, touchAction: 'none' }}
                        >
                          {wide ? (
                            <>
                              {/* széles blokk: név | badge, alatta létszám | idő (vízszintes párok) */}
                              <span className="flex min-w-0 items-center gap-1.5">
                                {name}
                                {badge}
                              </span>
                              <span className="flex min-w-0 items-center gap-2">
                                {pax}
                                {time}
                              </span>
                            </>
                          ) : (
                            <>
                              {/* keskeny blokk: badge, név, majd létszám + időtartam egy sorban */}
                              {badge}
                              <span className="block w-full min-w-0 shrink-0 truncate font-semibold leading-tight">
                                {draft ? '✎ ' : ''}{r.customer_name}
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
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>

    {/* Húzott blokk — fixed overlay, követi a kurzort (pointer-events:none, hogy az
        elementFromPoint az alatta lévő sort lássa). A cél időpont + asztal a fejlécben. */}
    {drag && typeof document !== 'undefined' && createPortal(
      <div
        className="pointer-events-none fixed z-[200] rounded-md border border-black/10 bg-amber-400 px-2 py-1.5 text-xs font-bold text-amber-950 shadow-2xl ring-2 ring-amber-500"
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

/* ---------- Floor plan (auto-grid + idő-csúszka) ---------- */
function FloorView({
  date, reservations, rooms, tables, openMin, closeMin, onEdit,
}: ViewProps & { onEdit: (r: Reservation) => void }) {
  // Kezdőpillanat: ha a megtekintett nap ma van, az aktuális idő (a nyitvatartásra
  // szorítva); egyébként a nyitvatartás közepe.
  const initialMin = () => {
    const now = new Date()
    const isToday = ymdLocal(now) === date
    const cur = now.getHours() * 60 + now.getMinutes()
    const base = isToday ? cur : (openMin + closeMin) / 2
    return Math.round(Math.max(openMin, Math.min(base, closeMin)) / 15) * 15
  }
  const [atMin, setAtMin] = useState(initialMin)
  const card = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

  const active = reservations.filter((r) => ACTIVE.has(r.status))
  // melyik asztal foglalt az adott pillanatban + ki ül ott
  const occupantOf = (tableId: string) =>
    active.find(
      (r) => tableIdsOf(r).includes(tableId) && atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time),
    ) ?? null

  const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const tablesByRoom = (roomId: string | null) =>
    [...tables]
      .filter((t) => {
        const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
        return roomId == null ? rid == null : String(rid) === roomId
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const groups: { name: string | null; tables: Table[] }[] = [
    ...roomOrder.map((r) => ({ name: r.name, tables: tablesByRoom(String(r.id)) })),
    ...(tablesByRoom(null).length ? [{ name: roomOrder.length ? 'Egyéb' : null, tables: tablesByRoom(null) }] : []),
  ].filter((g) => g.tables.length > 0)

  const occupiedTableIds = new Set(
    active
      .filter((r) => atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time))
      .flatMap((r) => tableIdsOf(r)),
  )
  const free = tables.length - occupiedTableIds.size

  return (
    <div className={`${card} p-5 space-y-5`}>
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <span className="text-2xl font-black tabular-nums text-zinc-900 dark:text-white w-20 shrink-0">{minutesToHHMM(atMin)}</span>
        <span className="text-xs text-zinc-400 ml-auto sm:hidden">{free} szabad</span>
        <input
          type="range"
          min={openMin}
          max={closeMin}
          step={15}
          value={atMin}
          onChange={(e) => setAtMin(Number(e.target.value))}
          className="flex-1 min-w-full sm:min-w-0 accent-zinc-900 dark:accent-white"
        />
        <span className="hidden sm:block text-xs text-zinc-400 w-24 text-right shrink-0">{free} szabad asztal</span>
      </div>

      {groups.map((g) => (
        <div key={g.name ?? 'none'}>
          {g.name && <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">{g.name}</p>}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {g.tables.map((t) => {
              const occ = occupantOf(String(t.id))
              const cls = `relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-1 overflow-hidden ${
                occ
                  ? `${statusBlock[occ.status]} cursor-pointer hover:opacity-90 transition-opacity`
                  : 'border-dashed border-zinc-200 dark:border-white/[0.1] text-zinc-400'
              }`
              if (!occ) {
                return (
                  <div key={t.id} title={`${t.name} · szabad`} className={cls}>
                    <span className="text-sm font-bold leading-tight">{t.name}</span>
                    <span className="text-[11px] leading-tight">{t.capacity} fő</span>
                  </div>
                )
              }
              const startM = hhmmToMinutes(occ.start_time)
              const endM = hhmmToMinutes(occ.end_time)
              const elapsedPct = Math.max(0, Math.min(100, ((atMin - startM) / Math.max(1, endM - startM)) * 100))
              const remaining = Math.max(0, endM - atMin)
              const urgency = urgencyOf(occ, atMin)
              return (
                <button
                  key={t.id}
                  onClick={() => onEdit(occ)}
                  title={`${occ.customer_name} · ${occ.pax} fő · ${occ.start_time}–${occ.end_time}`}
                  className={cls}
                >
                  {urgency && (
                    <span
                      className={`absolute right-1 top-1 z-10 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none shadow-sm ${urgency.cls} ${urgency.pulse ? 'animate-soft-pulse' : ''}`}
                    >
                      {urgency.label}
                    </span>
                  )}
                  <span className="text-sm font-bold leading-tight">{t.name}</span>
                  <span className="text-[11px] leading-tight">{occ.pax}/{t.capacity} fő</span>
                  <span className="text-[10px] font-medium tabular-nums leading-tight opacity-90">
                    {occ.start_time}–{occ.end_time}
                  </span>
                  <span className="text-[10px] tabular-nums leading-tight opacity-75">
                    még {remaining} perc
                  </span>
                  {/* eltelt idő sáv a cella alján */}
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-black/15">
                    <span className="block h-full bg-white/70" style={{ width: `${elapsedPct}%` }} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
