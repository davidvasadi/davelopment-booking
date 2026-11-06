'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, minutesToHHMM, ymdLocal } from '@/lib/utils'
import { Check, Users, Clock, FileSignature, Phone, CalendarDays, X } from 'lucide-react'
import type { BookingsRange } from '@/components/shared/BookingsDateNav'
import { OccasionBadge } from '@/components/shared/OccasionBadge'
import { idOf } from '@/components/dashboard/SalonDailyView'
import { BookingsHead, EmptyDayBar, EMPTY_FILTER, type NextBooking, applyBookingFilter, type BookingFilter } from '@/components/shared/BookingsHead'
import { segments } from '@/components/dashboard/OverviewLayout'
import { Button, Card, FieldRow, IconCircle, Kpi, Meta, Note, Pill, StatusPill } from '@/components/ui-kit'
import { BookingDrawer, type DrawerAction } from '@/components/shared/BookingDrawer'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { setBookingStatus } from '@/components/dashboard/ApprovalActions'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { MobileDayTimeline, hourRows } from '@/components/blocks/day-timeline'
import { DayStrip } from '@/components/shared/BookingsDateNav'
import { ResourceGrid, shortAlert, type GridMerged, type GridRow } from '@/components/shared/ResourceGrid'
import { STATUS_LEGEND, statusBlockClass, statusCard } from '@/components/shared/statusColors'
import { BlockLegend, BookingFacts, FloorPlan, TablePanel, tableShape, type FloorTable } from '@/components/blocks/booking'
import { BookingList, statusOf } from '@/components/shared/BookingList'
import { ReservationEditSheet, type EditTarget } from './ReservationEditSheet'
import { OfflineBanner } from './OfflineBanner'
import { useRestaurantUI } from './RestaurantUIContext'
import { getDrafts, subscribeDrafts, type ReservationDraft } from '@/lib/offlineDrafts'
import type { Reservation, Table, Room } from '@/payload/payload-types'

type ViewMode = 'list' | 'timeline' | 'floor'

const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár', confirmed: 'Megerősítve', seated: 'Leültetve',
  completed: 'Befejezett', no_show: 'Nem jött meg', cancelled: 'Lemondva',
}
export const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed', 'cancelled'])

/** Idővonal-csoport: egy terem (vagy „nincs terem") asztalaival. */
type TimelineGroup = { name: string | null; room: Room | null; tables: Table[] }

/** Időérzékeny sürgősség-jelzés egy foglaláshoz a jelenlegi perchez (nowMin) képest.
 *  Csak akkor él, ha a megtekintett nap ma van (nowMin != null). A státusz mellé
 *  ad egy figyelemfelkeltő badge-et a hostnak: késés / asztal mindjárt lejár / túlfutás. */
/** `tone`: bad = késik / túlfut (piros), warn = mindjárt lejár (narancs). */
export type Urgency = { label: string; tone: 'bad' | 'warn' }
export function urgencyOf(r: Reservation, nowMin: number | null): Urgency | null {
  if (nowMin == null) return null
  const start = hhmmToMinutes(r.start_time)
  const end = hhmmToMinutes(r.end_time)
  // Késik: megerősítve, de a kezdés ideje már elmúlt és még nem ültették le
  if (r.status === 'confirmed' && nowMin > start) return { label: `Késik ${nowMin - start} perce`, tone: 'bad' }
  if (r.status === 'seated') {
    // Túllépte: leültetve, de a vége ideje már elmúlt — csúszik a rotáció
    if (nowMin > end) return { label: `Túlfut ${nowMin - end} perce`, tone: 'bad' }
    // Mindjárt lejár: a vége 15 percen belül — jön a következő foglalás
    if (end - nowMin <= 15) return { label: `Lejár ${end - nowMin} perc`, tone: 'warn' }
  }
  return null
}

export interface DailyViewProps {
  /** Üres napon a következő foglalás (design 6.3) és a foglalóoldal címe a megosztáshoz. */
  nextBooking?: NextBooking
  publicUrl?: string | null
  date: string
  /** A jelenlegi időszak-nézet (Nap/Hét/Hónap) — a mobil nézet-választó sheet-be ágyazott
   *  Nap/Hét/Hónap váltóhoz kell (ld. dateFilter komment). Ezen az oldalon mindig 'day'. */
  range: BookingsRange
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
  activeCount: number
  cancelledCount: number
  /** A megjelenített nap zárva van (egyszeri kivétel vagy heti visszatérő zárvatartás) — az üres
   *  sávok ilyenkor a Naptár "Zárva" mintázatát kapják sima kréme hatch helyett. */
  isClosedToday?: boolean
  /** A toolbar-ba ágyazott, csak ezen az oldalon használt vezérlők. */
  dateFilter: React.ReactNode
  printButton: React.ReactNode
  /** Ha false, csak olvasható nézet — az Új foglalás gomb, szerkesztés és drag rejtve. */
  canManage?: boolean
  /** Az étterem beleegyező nyilatkozat funkciója be van-e kapcsolva. */
  consentEnabled?: boolean
}

/** A belső nézetek (Timeline/Floor) propjai — csak az adat/geometria. */
type ViewProps = Pick<
  DailyViewProps,
  'date' | 'reservations' | 'rooms' | 'tables' | 'openMin' | 'closeMin' | 'turnMinutes'
>

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

/** Szintetikus "asztal" a Timeline-rácsban az asztalhoz NEM rendelt foglalásoknak — enélkül
 *  ezek a `TableGrid` asztalonkénti csoportosítása miatt sehol sem jelentek meg (kiestek a
 *  szűrésből). Csak `id`/`name`/`capacity` mezőt olvas rá a rács, a többi Table-mező sosem. */
const NO_TABLE_ID = '__no_table__'

export function tableNamesOf(r: Reservation): string[] {
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

export function draftToReservation(d: ReservationDraft): DraftReservation {
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
    date, range, restaurantId, eventTypes, rooms, tables, openMin, closeMin, turnMinutes, openReservationId,
    activeCount, cancelledCount, isClosedToday = false,
    dateFilter, printButton, canManage = false, consentEnabled = false,
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

  // Alapból az Idősáv nézettel nyílik — ha ezen az eszközön van mentett nézet („Nézet és szűrők” › Mentés), azzal (BookingsHead).
  const pick = (v: ViewMode) => {
    setView(v)
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
      setOpened(r)
    }
  }, [openReservationId, props.reservations])

  const router = useRouter()
  // Kattintás egy foglalásra: a megnyitott foglalás lapja (design 6.7); a vázlat egyből a szerkesztőben nyílik.
  const [opened, setOpened] = useState<Reservation | null>(null)
  const openEdit = useCallback((reservation: Reservation) => { if (isDraft(reservation)) { if (canManage) setTarget({ reservation }) } else setOpened(reservation) }, [canManage])
  const openCreate = (presetStart?: string, presetTableId?: string | number | null) => {
    if (canManage) setTarget({ reservation: null, presetStart, presetTableId })
  }

  // Mobilon az "Új foglalás" a fejléc csengő melletti ikonjából nyílik (DashboardNav dispatch-eli)
  // — a gomb maga a toolbarból mobilon rejtve, ld. lent (ugyanaz a minta, mint a szalon oldalon).
  useEffect(() => {
    const handler = () => openCreate()
    window.addEventListener('davelopment:open-bookings-create', handler)
    return () => window.removeEventListener('davelopment:open-bookings-create', handler)
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps

  // A főoldal fejléc-ikonja `?new=1`-gyel érkezik ide → rögtön megnyitjuk az új-foglalás panelt,
  // és a paramétert eltávolítjuk az URL-ből (frissítésnél ne nyíljon meg újra).
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('new') !== '1') return
    url.searchParams.delete('new')
    window.history.replaceState(null, '', url.pathname + url.search)
    openCreate()
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps

  // Foglalás áthelyezése drag&drop-ból: új időpont és/vagy asztal. A szerver validál
  // (ütközés, nyitvatartás, kapacitás) — hibánál a router.refresh visszaállítja az
  // eredeti pozíciót, és toast jelzi az okot. Vázlatot (offline draft) nem mozgatunk.
  const moveReservation = async (r: Reservation, newStart: string, newTableId: string | number): Promise<boolean> => {
    if (isDraft(r)) return false
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
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Az áthelyezés nem sikerült')
      router.refresh() // visszaállítja az eredeti pozíciót
      return false
    }
  }


  const pickRange = (v: BookingsRange) => router.push(`/restaurant/bookings?date=${date}&range=${v}`)


  const dayDrafts = useMemo(
    () => drafts.filter((d) => d.date === date).sort((a, b) => a.createdAt - b.createdAt),
    [drafts, date],
  )


  // Szűrés (terem, státusz, forrás, keresés) — az idővonal, a lista és a terem is a szűrt napot mutatja.
  const nowMinHead = useNowMinutes(date)
  const roomOfTable = useMemo(() => new Map(tables.map((t) => [String(t.id), t.room ? idOf(t.room) : ''])), [tables])
  const tableIdsOf = (r: Reservation) => (r.tables ?? []).map((t) => idOf(t))
  const [filter, setFilter] = useState<BookingFilter>(EMPTY_FILTER)
  const shown = useMemo(
    () => applyBookingFilter(reservations, filter, (r) => tableIdsOf(r).map((id) => roomOfTable.get(id) ?? ''), (r) => r.status === 'confirmed' && nowMinHead != null && nowMinHead > hhmmToMinutes(r.start_time)),
    [reservations, filter, nowMinHead, roomOfTable], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // A fejléc csíkja ASZTALOKBAN (design 6.13) és a nagy számok — a nap valós adataiból, szűrés nélkül.
  const usedTables = (f: (r: Reservation) => boolean) => new Set(reservations.filter(f).flatMap(tableIdsOf))
  const bookedT = usedTables((r) => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed')
  const pendingT = [...usedTables((r) => r.status === 'pending')].filter((id) => !bookedT.has(id))
  const paxTotal = reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').reduce((sum, r) => sum + (r.pax ?? 0), 0)
  const seats = tables.reduce((sum, t) => sum + (t.capacity ?? 0), 0)
  const VIEWS: ViewMode[] = ['timeline', 'list', 'floor']

  return (
    <div className="space-y-5">
      <OfflineBanner
        restaurantId={restaurantId}
        drafts={dayDrafts}
        onReview={(d) => setTarget({ reservation: draftToReservation(d) })}
      />

      <BookingsHead
        dateNav={dateFilter}
        range={range}
        onRange={pickRange}
        date={date}
        onDate={(d) => router.push(`/restaurant/bookings?date=${d}&range=day`)}
        loadEndpoint="/api/restaurant/day-load"
        views={['Idővonal', 'Lista', 'Terem']}
        view={VIEWS.indexOf(view)}
        onView={(i) => pick(VIEWS[i])}
        filter={filter}
        onFilter={setFilter}
        who={rooms.length > 1 ? rooms.map((rm) => ({ id: String(rm.id), label: rm.name })) : undefined}
        whoLabel="Terem"
        matchCount={shown.length}
        exportButton={printButton}
        onCreate={canManage ? () => openCreate() : undefined}
        bar={focusMode ? undefined : segments([
          { label: 'Foglalt asztal', value: bookedT.size, tone: 'dark' },
          { label: 'Függő', value: pendingT.length, tone: 'yellow' },
          { label: 'Szabad', value: Math.max(0, tables.length - bookedT.size - pendingT.length), tone: 'hatch' },
          { label: 'Lemondva', value: cancelledCount, tone: 'outline' },
        ])}
        kpis={focusMode ? undefined : <>
          <Kpi icon={CalendarDays} value={String(activeCount)} label="Foglalás" />
          <Kpi icon={Users} value={String(paxTotal)} label="Vendég (fő)" />
          <Kpi icon={Clock} value={`${seats ? Math.min(100, Math.round((paxTotal / seats) * 100)) : 0}%`} label="Telítettség" />
        </>}
      />

      {!props.reservations.some((r) => r.status !== 'cancelled' && r.status !== 'no_show') && <EmptyDayBar next={props.nextBooking ?? null} base="/restaurant" publicUrl={props.publicUrl} />}

      {view === 'list' && <ListTableView date={date} reservations={shown} rooms={rooms} tables={tables} onEdit={openEdit} openId={opened ? String(opened.id) : null} />}
      {view === 'timeline' && (
        <TimelineView
          date={date}
          // terem-szűrésnél csak a kiválasztott termek asztalai maradnak az idővonalon
          {...{ reservations: shown, rooms: filter.who.length ? rooms.filter((rm) => filter.who.includes(String(rm.id))) : rooms, tables: filter.who.length ? tables.filter((t) => filter.who.includes(roomOfTable.get(String(t.id)) ?? '')) : tables, openMin, closeMin, turnMinutes, isClosedToday }}
          onEdit={openEdit}
          onCreate={openCreate}
          onMove={moveReservation}
          canManage={canManage}
        />
      )}
      {view === 'floor' && (
        <FloorView
          date={date}
          {...{ reservations: shown, rooms, tables, openMin, closeMin, turnMinutes }}
          onEdit={openEdit}
          onCreate={openCreate}
          canManage={canManage}
          roomFilter={filter.who}
          onRoomFilter={(ids) => setFilter((f) => ({ ...f, who: ids }))}
        />
      )}

      {opened && (
        <RestaurantBookingDrawer
          key={String(opened.id)}
          r={reservations.find((x) => String(x.id) === String(opened.id)) ?? opened}
          date={date}
          canManage={canManage}
          consentEnabled={consentEnabled}
          onClose={() => setOpened(null)}
          onEdit={() => { const r = opened; setOpened(null); setTarget({ reservation: r }) }}
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
        turnMinutes={turnMinutes}
      />

    </div>
  )
}

/* ---------- Lista nézet (egynapos) — a közös BookingList (design 6.14) ---------- */
function ListTableView({ date, reservations, rooms, tables, onEdit, openId }: { date: string; reservations: Reservation[]; rooms: Room[]; tables: ViewProps['tables']; onEdit: (r: Reservation) => void; openId: string | null }) {
  const nowMin = useNowMinutes(date)
  const byId = new Map(reservations.map((r) => [String(r.id), r]))
  const roomName = new Map(rooms.map((rm) => [String(rm.id), rm.name]))
  const roomOfTable = new Map(tables.map((t) => [String(t.id), t.room ? roomName.get(idOf(t.room)) ?? '' : '']))
  return (
    <BookingList
      openId={openId}
      mobileTop={<DayStrip base="/restaurant" date={date} />}
      onOpen={(id) => { const r = byId.get(id); if (r) onEdit(r) }}
      items={reservations.map((r) => {
        const draft = isDraft(r)
        const late = !draft && needsHandling(r, nowMin) ? nowMin! - hhmmToMinutes(r.start_time) : null
        const tables = tableNamesOf(r)
        const room = tableIdsOf(r).map((id) => roomOfTable.get(id)).find(Boolean)
        return {
          id: String(r.id),
          start: r.start_time,
          title: r.customer_name || 'Vendég',
          meta: `${tables.length ? tables.join(' + ') : 'nincs asztal'} · ${r.pax} fő`,
          pax: r.pax,
          group: rooms.length > 1 ? room ?? 'Asztal nélkül' : undefined,
          source: r.source,
          deposit: r.payment_status === 'paid' ? 'paid' : r.payment_status === 'failed' ? 'failed' : null,
          draft,
          occ: r.occasion ? <OccasionBadge occasion={r.occasion} icon={r.occasion_icon} /> : undefined,
          status: statusOf(r.status, late),
          cancelled: r.status === 'cancelled' || r.status === 'no_show',
        }
      })}
    />
  )
}

/* ---------- Timeline (asztal × idő rács) ---------- */
function TimelineView({
  date, reservations, rooms, tables, openMin, closeMin, turnMinutes, isClosedToday = false, onEdit, onCreate, onMove, canManage = false,
}: ViewProps & {
  isClosedToday?: boolean
  onEdit: (r: Reservation) => void
  onCreate: (start?: string, tableId?: string | number | null) => void
  onMove: (r: Reservation, newStart: string, newTableId: string | number) => Promise<boolean>
  canManage?: boolean
}) {
  const active = reservations.filter((r) => ACTIVE.has(r.status))
  const nowMin = useNowMinutes(date)


  return (
    <>
      {/* Mobil: Crextio Mobile függőleges idővonal (óra-pillek pontozott vonallal + kártyák) */}
      <div className="lg:hidden">
        <MobileTimeline {...{ date, active, openMin, closeMin, nowMin, onEdit, isClosedToday }} />
      </div>
      {/* Desktop: normál nyitvatartásnál a teljes nap egy nézetben (százalékos); ha a nap
          nagyon hosszú (pl. éjfél utánig nyitva — ld. a záróra-normalizálást a page.tsx-ben),
          a "fit" mód %-os skálázása összenyomná/torzítaná a tartalmat — ilyenkor helyette
          fix px/perc alapú, vízszintesen görgethető sávra váltunk, ami automatikusan az
          aktuális időpontra görget nyitáskor. */}
      <div className="hidden lg:block">
        <RestaurantDayGrid {...{ reservations: active, rooms, tables, openMin, closeMin, isClosedToday, nowMin, canManage, onEdit, onMove }} />
      </div>
    </>
  )
}

/** Az étterem napi idővonala desktopon (design 6.13): termenként az asztalok, az összevont asztalok egy keretben — a közös
 *  ResourceGrid. A design oldal is ezt mutatja (mintaadattal, rögzített „most”-tal). */
export function RestaurantDayGrid({ reservations: active, rooms, tables, openMin, closeMin, isClosedToday = false, nowMin, canManage = false, onEdit, onMove }: {
  reservations: Reservation[]
  rooms: Room[]
  tables: Table[]
  openMin: number
  closeMin: number
  isClosedToday?: boolean
  nowMin: number | null
  canManage?: boolean
  onEdit: (r: Reservation) => void
  onMove?: (r: Reservation, newStart: string, newTableId: string | number) => Promise<boolean>
}) {
  const dayEnd = active.reduce((max, r) => Math.max(max, hhmmToMinutes(r.end_time)), closeMin)
  const totalMin = Math.max(dayEnd - openMin, 60)
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
  // Asztalhoz NEM rendelt aktív foglalások — külön, "Nincs asztalhoz rendelve" sávban, mint
  // az Áttekintés idővonala már teszi. Enélkül ezek a foglalások a lenti asztalonkénti
  // szűrésben sehol sem egyeznének, tehát némán eltűnnének a nézetből.
  const unassignedCount = active.filter((r) => tableIdsOf(r).length === 0).length
  const groups: TimelineGroup[] = [
    ...roomOrder.map((r) => ({ name: r.name, room: r, tables: tablesByRoom.get(String(r.id)) ?? [] })),
    ...(noRoom.length ? [{ name: roomOrder.length ? 'Egyéb' : null, room: null, tables: noRoom }] : []),
    ...(unassignedCount > 0
      ? [{
          name: 'Nincs asztalhoz rendelve',
          room: null,
          tables: [{ id: NO_TABLE_ID, name: 'Nincs asztalhoz rendelve', capacity: unassignedCount } as unknown as Table],
        }]
      : []),
  ].filter((g) => g.tables.length > 0)

  return (
    <ResourceGrid<Reservation>
      groups={groups.map((g, gi) => {
        // összevont asztalok (design 6.13): amit egy több asztalos foglalás összeköt, egy keretbe kerül
        const parent = new Map<string, string>()
        const find = (x: string): string => { const p = parent.get(x) ?? x; if (p === x) return x; const r = find(p); parent.set(x, r); return r }
        const multi = active.filter((r) => tableIdsOf(r).length > 1)
        for (const r of multi) { const [h, ...rest] = tableIdsOf(r); for (const t of rest) parent.set(find(t), find(h)) }
        const comp = (id: string) => g.tables.filter((t) => find(String(t.id)) === find(id))
        const rowOf = (t: Table, skip: Reservation[] = []): GridRow<Reservation> => {
          const none = t.id === NO_TABLE_ID
          return {
            id: String(t.id),
            name: t.name,
            label: <span className="flex items-center gap-2"><IconCircle tone="white" size="md">{t.name}</IconCircle>{!none && <span className="text-ui-label text-ui-muted">{t.capacity} fő</span>}</span>,
            items: (none ? active.filter((r) => tableIdsOf(r).length === 0) : active.filter((r) => tableIdsOf(r).includes(String(t.id)))).filter((r) => !skip.includes(r)),
            capacity: none ? undefined : t.capacity,
            noDrop: none,
          }
        }
        const done = new Set<string>()
        const rows = g.tables.flatMap((t): (GridRow<Reservation> | GridMerged<Reservation>)[] => {
          const id = String(t.id)
          if (done.has(id)) return []
          const c = t.id === NO_TABLE_ID ? [t] : comp(id)
          if (c.length < 2) return [rowOf(t)]
          c.forEach((x) => done.add(String(x.id)))
          const ids = new Set(c.map((x) => String(x.id)))
          const spanning = multi.filter((r) => tableIdsOf(r).every((x) => ids.has(x)))
          return [{
            id: `merged-${id}`,
            merged: c.map((x) => rowOf(x, spanning)),
            spanning,
            caption: `${c.map((x) => x.name).join(' + ')} · ${c.reduce((sum, x) => sum + (x.capacity ?? 0), 0)} hely`,
          }]
        })
        return { key: `${gi}-${g.name ?? 'none'}`, title: g.name ? <><span className="text-ui-text">{g.name}</span>· {g.tables.filter((t) => t.id !== NO_TABLE_ID).length} asztal</> : undefined, rows }
      })}
      access={{
        id: (r) => String(r.id),
        start: (r) => hhmmToMinutes(r.start_time),
        end: (r) => hhmmToMinutes(r.end_time),
        status: (r) => r.status,
        draft: isDraft,
        createdAt: (r) => r.createdAt,
        // a 30 percen belül kezdődő megerősített foglalás „hamarosan” (körvonalas) — design 6.13
        // a mobil kártyával egyező színek (shared/statusColors)
        tone: (r) => statusBlockClass(r.status),
        dot: (r) => (r.status === 'cancelled' || r.status === 'no_show' ? undefined : statusCard(r.status).dot),
        dragLabel: (r) => `${r.customer_name} · ${r.pax} fő`,
        block: (r, size) => {
          const u = isDraft(r) ? null : urgencyOf(r, nowMin)
          return {
            title: r.customer_name,
            sub: size === 'tiny' ? undefined : `${r.pax} fő`,
            badge: (u || r.occasion || r.status === 'seated') && (
              <span className="flex shrink-0 items-center gap-1">
                {r.occasion && <OccasionBadge occasion={r.occasion} icon={r.occasion_icon} />}
                {/* keskenyebb blokkban rövidítve („146'”), a legrövidebbben csak pötty — a teljes felirat a tooltipben */}
                {u ? (size === 'tiny' ? <span className={`h-2 w-2 shrink-0 rounded-full ${u.tone === 'warn' ? 'bg-ui-warn-dot' : 'bg-ui-bad-dot'}`} /> : <StatusPill status={u.tone} className="shrink-0">{size === 'wide' ? u.label : shortAlert(u.label)}</StatusPill>) : r.status === 'seated' && size !== 'tiny' && <StatusPill status="ok" className="shrink-0">Bent</StatusPill>}
              </span>
            ),
            tooltip: `${isDraft(r) ? 'VÁZLAT — ' : canManage ? 'Kattints a szerkesztéshez, vagy húzd át másik időpontra/asztalra · ' : ''}${r.customer_name} · ${r.pax} fő · ${r.start_time}–${r.end_time} · ${u ? u.label : statusLabel[r.status]}${r.occasion ? ` · ${r.occasion}` : ''}`,
          }
        },
      }}
      stack={groupOverlaps}
      openMin={openMin}
      closeMin={closeMin}
      endMin={dayEnd}
      nowMin={nowMin}
      mode={totalMin > 13 * 60 ? 'scroll' : 'fit'}
      closed={isClosedToday}
      canManage={canManage}
      onEdit={onEdit}
      onMove={onMove ? (r, start, rowId) => onMove(r, start, rowId) : undefined}
      tooSmall={(row, r) => row.capacity != null && row.capacity < r.pax}
      legend={<BlockLegend alerts={false} items={[...STATUS_LEGEND.filter((x) => x[1] !== 'Szünet'), ['bg-ui-dark', 'Bent', 'bg-ui-ok-dot']]} merged />}
      empty={<Meta className="py-10 text-center">Nincs asztal. Vegyél fel asztalokat a foglalások idővonalához.</Meta>}
    />
  )
}

/** Megerősítve maradt, de a kezdés ideje már elmúlt, senki nem vezette át (leültetve/nem jött
 *  meg) — ez utólagos KEZELÉST igényel, ezért a "Függő" (arany) színt kapja a kártyán, nem a
 *  rendes sötét "megerősítve" színt (a piros "Késik" jelvény önmagában kevés volt). */
export function needsHandling(r: Reservation, nowMin: number | null): boolean {
  return nowMin != null && r.status === 'confirmed' && nowMin > hhmmToMinutes(r.start_time)
}

/** Egy idősáv-cella tartalma: vagy egyetlen foglalás, vagy egy [aktív, lemondott] pár, amikor
 *  ugyanarra az asztalra/időre lemondtak egy foglalást, majd újra lefoglalták — ekkor a kettő
 *  egy kártya-veremben jelenik meg (a lemondott pirosan kandikál ki mögüle, kattintásra cserélnek). */
export type CellItem = Reservation | [Reservation, Reservation]

/** Az időben átfedő ÉS legalább egy közös asztalon lévő lemondott+aktív párokat verembe
 *  csoportosítja, a többi (magában álló, akár lemondott is) elem sima marad — időrendben. */
export function groupOverlaps(rows: Reservation[]): CellItem[] {
  const cancelled = rows.filter((r) => r.status === 'cancelled')
  const activeOnes = rows.filter((r) => r.status !== 'cancelled')
  const usedIds = new Set<string>()
  const pairs: [Reservation, Reservation][] = []
  // 1. fázis: egy lemondás TÖBB asztalt is érinthetett (pl. egy 12 fős foglalás M2+M3+M4-en) —
  // ha ezek közül több asztalra is jött külön új foglalás, a lemondás MINDEGYIKKEL párosodjon
  // (nem csak az elsővel), különben a mobil nézetben csak az egyik új foglalásnál látszana a
  // törlés-jelzés, holott ugyanaz a lemondás mindet érintette.
  for (const c of cancelled) {
    const cs = hhmmToMinutes(c.start_time)
    const ce = hhmmToMinutes(c.end_time)
    const cTables = new Set(tableIdsOf(c))
    const partners = activeOnes.filter((o) => {
      if (usedIds.has(String(o.id))) return false
      if (!tableIdsOf(o).some((id) => cTables.has(id))) return false
      const os = hhmmToMinutes(o.start_time)
      const oe = hhmmToMinutes(o.end_time)
      return cs < oe && ce > os
    })
    for (const partner of partners) {
      usedIds.add(String(partner.id))
      usedIds.add(String(c.id))
      pairs.push([partner, c])
    }
  }
  // 2. fázis: ami az 1. fázis után marad (pl. KÉT egymással átfedő lemondás, aminek nincs aktív
  // párja) — ezeket ÁLTALÁNOSAN, egymás közt is összepárosítjuk. Enélkül a rács-nézetben (abszolút
  // idő-pozíció) egymásra csúsztak volna, összeolvadó/olvashatatlan szöveget eredményezve.
  const leftover = rows
    .filter((r) => !usedIds.has(String(r.id)))
    .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
  for (let i = 0; i < leftover.length; i++) {
    const a = leftover[i]
    if (usedIds.has(String(a.id))) continue
    const as = hhmmToMinutes(a.start_time)
    const ae = hhmmToMinutes(a.end_time)
    const aTables = new Set(tableIdsOf(a))
    for (let j = i + 1; j < leftover.length; j++) {
      const b = leftover[j]
      if (usedIds.has(String(b.id))) continue
      if (!tableIdsOf(b).some((id) => aTables.has(id))) continue
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
  const singles = rows.filter((r) => !usedIds.has(String(r.id)))
  const items: { sortKey: number; node: CellItem }[] = [
    ...singles.map((r) => ({ sortKey: hhmmToMinutes(r.start_time), node: r as CellItem })),
    ...pairs.map((p) => ({
      sortKey: Math.min(hhmmToMinutes(p[0].start_time), hhmmToMinutes(p[1].start_time)),
      node: p as CellItem,
    })),
  ]
  items.sort((a, b) => a.sortKey - b.sortKey)
  return items.map((x) => x.node)
}

/** Mobil nap (a /design 6.19): a napcsík, alatta a közös függőleges idővonal — óránként az első foglalás
 *  (asztal, létszám), a többi a „+N” alatt; a kártyára koppintva megnyílik. A lemondottak itt nem jelennek meg (a Lista
 *  mutatja őket). */
function MobileTimeline({ date, active, openMin, closeMin, nowMin, onEdit, isClosedToday = false }: {
  date: string; active: Reservation[]; openMin: number; closeMin: number; nowMin: number | null; onEdit: (r: Reservation) => void; isClosedToday?: boolean
}) {
  const live = active.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
  const byKey = new Map(live.map((r) => [String(r.id), r]))
  const rows = hourRows(live, {
    openMin, closeMin, nowMin, pastDay: date < ymdLocal(new Date()),
    start: (r) => hhmmToMinutes(r.start_time),
    end: (r) => hhmmToMinutes(r.end_time),
    ev: (r) => ({
      key: String(r.id),
      n: `${isDraft(r) ? '✎ ' : ''}${r.customer_name}${tableNamesOf(r).length ? ` · ${tableNamesOf(r).join(' + ')}` : ''}`,
      s: [`${r.start_time}–${r.end_time}`, `${r.pax} fő`, r.occasion].filter(Boolean).join(' · '),
      ...statusCard(r.status),
    }),
  })
  return (
    <Card>
      <DayStrip base="/restaurant" date={date} />
      {isClosedToday && <Note className="mt-3">Ezen a napon zárva vagytok.</Note>}
      <MobileDayTimeline rows={rows} more={false} onOpen={(k) => { const r = byKey.get(k); if (r) onEdit(r) }} />
    </Card>
  )
}
const SOON = 45
const LATE = 10

function FloorView({
  date, reservations, rooms, tables, openMin, closeMin, onEdit, onCreate, canManage = false, roomFilter, onRoomFilter,
}: ViewProps & {
  onEdit: (r: Reservation) => void
  onCreate: (start?: string, tableId?: string | number | null) => void
  canManage?: boolean
  /** a fejléc szűrőjének „Terem” része — a terem-fülek ugyanezt állítják (nincs két külön terem-választó) */
  roomFilter: string[]
  onRoomFilter: (ids: string[]) => void
}) {
  const router = useRouter()
  const isTodayView = ymdLocal(new Date()) === date
  const initialMin = () => {
    const now = new Date()
    const cur = now.getHours() * 60 + now.getMinutes()
    const base = isTodayView ? cur : (openMin + closeMin) / 2
    return Math.round(Math.max(openMin, Math.min(base, closeMin)) / 5) * 5
  }
  const [atMin, setAtMin] = useState(initialMin)
  const [live, setLive] = useState(isTodayView)
  const [selId, setSelId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // ÉLŐ: ha be van kapcsolva és ma van, ~fél percenként a valós időre ugrik.
  useEffect(() => {
    if (!live || !isTodayView) return
    const tick = () => { const n = new Date(); setAtMin(n.getHours() * 60 + n.getMinutes()) }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [live, isTodayView])

  // A Terem-nézet ÉLŐ asztal-foglaltságot mutat — a lemondás nem foglalja az asztalt.
  const active = reservations.filter((r) => ACTIVE.has(r.status) && r.status !== 'cancelled')
  const occupantOf = (tableId: string) =>
    active.find((r) => tableIdsOf(r).includes(tableId) && atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time)) ?? null
  const upcomingOf = (tableId: string) => active
    .filter((r) => tableIdsOf(r).includes(tableId) && hhmmToMinutes(r.start_time) > atMin)
    .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))

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
    ...(tablesByRoom(null).length ? [{ id: 'no-room', name: roomOrder.length ? 'Egyéb' : 'Asztalok', tables: tablesByRoom(null) }] : []),
  ].filter((e) => e.tables.length > 0)
  // fülek: Mind + a termek; a kiválasztott a szűrőből jön (egy terem = az a fül, különben Mind — több teremnél azok együtt)
  const roomIdx = roomFilter.length === 1 ? roomEntries.findIndex((e) => (e.id === 'no-room' ? '' : e.id) === roomFilter[0]) : -1
  const room = roomIdx >= 0 ? roomEntries[roomIdx] : null
  const inFilter = (e: (typeof roomEntries)[number]) => !roomFilter.length || roomFilter.includes(e.id === 'no-room' ? '' : e.id)
  const roomTables = room ? room.tables : roomEntries.filter(inFilter).flatMap((e) => e.tables)
  const roomNameOf = (t: Table) => roomEntries.find((e) => e.tables.includes(t))?.name ?? 'Terem'
  const busyHere = roomTables.filter((t) => !!occupantOf(String(t.id))).length
  const seats = roomTables.reduce((sum, t) => sum + (t.capacity ?? 0), 0)

  if (roomEntries.length === 0) return <Card><Meta className="py-10 text-center">Nincs asztal ehhez a helyhez.</Meta></Card>

  // az asztal állapota a kiválasztott időpontban (a színe), a sarokban a hátralévő perc / a késés
  type St = 'busy' | 'free' | 'pending' | 'soon' | 'late'
  const stateOf = (t: Table): { st: St; left?: number; sub?: string; occ: Reservation | null; soon: Reservation | null } => {
    const occ = occupantOf(String(t.id))
    if (occ) {
      const lateMin = atMin - hhmmToMinutes(occ.start_time)
      if (occ.status === 'pending') return { st: 'pending', occ, soon: null }
      if (occ.status === 'confirmed' && lateMin >= LATE) return { st: 'late', left: lateMin, occ, soon: null }
      return { st: 'busy', left: Math.max(0, hhmmToMinutes(occ.end_time) - atMin), occ, soon: null }
    }
    const nx = upcomingOf(String(t.id))[0]
    if (nx && hhmmToMinutes(nx.start_time) - atMin <= SOON) return { st: 'soon', sub: nx.start_time, occ: null, soon: nx }
    return { st: 'free', occ: null, soon: null }
  }
  // az asztalok helye: amíg nincs terem-rajz (design 9.6), egyenletes rácsban, létszám szerinti alakkal
  const cols = Math.max(1, Math.ceil(Math.sqrt(roomTables.length * 1.8)))
  const rowsN = Math.max(1, Math.ceil(roomTables.length / cols))
  const sel = roomTables.find((t) => String(t.id) === selId) ?? roomTables.find((t) => !!occupantOf(String(t.id))) ?? roomTables[0]
  const floor: FloorTable[] = roomTables.map((t, i) => {
    const s = stateOf(t)
    return {
      id: String(t.id), n: t.name, ...tableShape(t.capacity ?? 0),
      x: 4 + (i % cols) * (88 / cols), y: 8 + Math.floor(i / cols) * (82 / rowsN),
      st: s.st, left: s.left, sub: s.sub, sel: t === sel,
      title: s.occ ? `${s.occ.customer_name} · ${s.occ.pax} fő · ${s.occ.start_time}–${s.occ.end_time}` : s.soon ? `${s.soon.customer_name} · ${s.soon.start_time}` : `${t.name} · szabad`,
    }
  })

  const ss = sel ? stateOf(sel) : null
  const occ = ss?.occ ?? null
  const STATUS: Record<St, { tone: 'ok' | 'warn' | 'bad' | 'pending' | 'neutral' | 'confirmed'; label: string }> = {
    busy: occ?.status === 'seated' ? { tone: 'ok', label: 'Leültetve' } : { tone: 'confirmed', label: 'Foglalt' },
    pending: { tone: 'pending', label: 'Függő' }, late: { tone: 'bad', label: 'Késik' }, soon: { tone: 'warn', label: 'Hamarosan' }, free: { tone: 'neutral', label: 'Szabad' },
  }
  // összetolható asztalok — egyszer-egyszer, a kijelölt nélkül (az adatban egy asztal többször is szerepelhet)
  const combinIds = sel ? [...new Set((sel.combinable_with ?? []).map((c) => String(typeof c === 'object' && c ? c.id : c)))].filter((id) => id !== String(sel.id)) : []
  const combin = combinIds.map((id) => tables.find((t) => String(t.id) === id)).filter((t): t is Table => !!t)
  const free = async () => {
    if (!occ) return
    setBusy(true)
    try {
      await setBookingStatus({ restaurant: true, id: occ.id, status: 'completed' })
      toast.success(`${sel?.name} felszabadult`)
      markLocalMutation()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-[5px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <FloorPlan
        rooms={['Mind', ...roomEntries.map((e) => e.name)]}
        room={roomIdx + 1}
        onRoom={(i) => { onRoomFilter(i === 0 ? [] : [roomEntries[i - 1].id === 'no-room' ? '' : roomEntries[i - 1].id]); setSelId(null) }}
        meta={<>{roomTables.length} asztal · {seats} hely · <span className="text-ui-text">{roomTables.length ? Math.round((busyHere / roomTables.length) * 100) : 0}% telt</span></>}
        tables={floor}
        bar={false}
        onPick={setSelId}
        time={{ min: openMin, max: closeMin, value: Math.max(openMin, Math.min(atMin, closeMin)) }}
        onTime={(m) => { setLive(false); setAtMin(m) }}
        timeExtra={isTodayView && (
          <Button size="sm" variant={live ? 'dark' : 'cell'} onClick={() => { setLive(true); const n = new Date(); setAtMin(n.getHours() * 60 + n.getMinutes()) }}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-ui-yellow' : 'bg-ui-muted'}`} />Élő
          </Button>
        )}
        legend={<BlockLegend alerts={false} items={[['ui-hatch', 'Szabad'], ['border-[1.5px] border-ui-dark', 'Hamarosan'], ['bg-ui-dark', 'Foglalt'], ['bg-ui-yellow', 'Függő'], ['bg-ui-bad-bg', 'Késik']]} />}
      />
      {sel && ss && (
        <TablePanel
          name={sel.name}
          sub={`${roomNameOf(sel)} · ${sel.capacity} fő`}
          status={STATUS[ss.st]}
          current={occ ? {
            title: `${occ.customer_name} · ${occ.pax} fő`,
            meta: `${occ.start_time}–${occ.end_time}${occ.occasion ? ` · ${occ.occasion}` : ''}`,
            occ: occ.occasion ? <OccasionBadge occasion={occ.occasion} icon={occ.occasion_icon} /> : undefined,
            pct: Math.min(100, Math.max(0, ((atMin - hhmmToMinutes(occ.start_time)) / Math.max(1, hhmmToMinutes(occ.end_time) - hhmmToMinutes(occ.start_time))) * 100)),
            since: occ.status === 'seated' ? `${Math.max(0, atMin - hhmmToMinutes(occ.start_time))} perce ülnek` : occ.status === 'pending' ? 'megerősítésre vár' : `${occ.start_time}-ra vártuk`,
            left: `még ${Math.max(0, hhmmToMinutes(occ.end_time) - atMin)} perc`,
          } : null}
          next={upcomingOf(String(sel.id)).filter((r) => r !== occ).slice(0, 3).map((r) => [r.start_time, `${r.customer_name} · ${r.pax} fő`])}
          note={combin.length ? <><span className="font-medium">Összetolható:</span> {[sel, ...combin].map((t) => t.name).join(' + ')} — {[sel, ...combin].reduce((a, t) => a + (t.capacity ?? 0), 0)} fő.</> : undefined}
          onOpenCurrent={occ ? () => onEdit(occ) : undefined}
          onFree={canManage && occ && (occ.status === 'seated' || occ.status === 'confirmed') ? free : undefined}
          busy={busy}
          onAdd={canManage ? () => onCreate(minutesToHHMM(Math.ceil(atMin / 15) * 15), sel.id) : undefined}
        />
      )}
    </div>
  )
}

const RES_SOURCE_LABEL: Record<string, string> = { online: 'Online · foglalóoldal', phone: 'Telefon', walk_in: 'Beeső' }

/** A megnyitott étterem-foglalás (design 6.7) tartalma és gyors műveletei: függőnél jóváhagyás / elutasítás, késésnél
 *  megérkezett (leültetve) / nem jött el, leültetett vendégnél befejezés, mindig hívás és áthelyezés (a szerkesztő),
 *  megerősítettnél lemondás (6.10 ablakkal). */
function RestaurantBookingDrawer({ r, date, canManage, consentEnabled = false, onClose, onEdit }: { r: Reservation; date: string; canManage: boolean; consentEnabled?: boolean; onClose: () => void; onEdit: () => void }) {
  const router = useRouter()
  const nowMin = useNowMinutes(date)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'cancel' | 'decline'>(null)
  const u = urgencyOf(r, nowMin)
  const late = r.status === 'confirmed' && !!u
  const today = ymdLocal(new Date())
  const when = `${date === today ? 'ma' : date.slice(5).replace('-', '. ') + '.'} ${r.start_time}–${r.end_time}`
  const tables = tableNamesOf(r)

  const set = async (status: Reservation['status'], msg: string, decline = false) => {
    setBusy(true)
    try {
      await setBookingStatus({ restaurant: true, id: r.id, status, decline })
      toast.success(msg)
      markLocalMutation()
      router.refresh()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }
  const call = r.customer_phone ? { label: 'Hívás', icon: Phone, href: `tel:${r.customer_phone.replace(/\s/g, '')}` } : null
  const move = { label: 'Áthelyezés', onClick: onEdit }
  const base: DrawerAction[] = !canManage ? (call ? [call] : []) : r.status === 'pending'
    ? [{ label: 'Jóváhagyom', icon: Check, variant: 'dark', onClick: () => set('confirmed', 'Elfogadva — a vendég megkapta a visszaigazolást'), disabled: busy }, { label: 'Elutasítom', onClick: () => setConfirm('decline'), disabled: busy }, ...(call ? [call] : []), move]
    : late
      ? [{ label: 'Megérkezett', icon: Check, variant: 'dark', onClick: () => set('seated', 'Leültetve'), disabled: busy }, { label: 'Nem jött el', onClick: () => set('no_show', 'Lezárva — nem jött'), disabled: busy }, ...(call ? [call] : []), move]
      : r.status === 'seated'
        ? [{ label: 'Befejezés', icon: Check, variant: 'dark', onClick: () => set('completed', 'Foglalás befejezve'), disabled: busy }, ...(call ? [call] : []), move]
        : r.status === 'confirmed'
          ? [{ label: 'Leültetve', icon: Check, variant: 'dark', onClick: () => set('seated', 'Leültetve'), disabled: busy }, ...(call ? [call] : []), move, { label: 'Lemondás', onClick: () => setConfirm('cancel'), disabled: busy }]
          : (call ? [call] : [])
  const consent = canManage && consentEnabled && !r.consent_accepted && r.status !== 'cancelled'
  const actions: DrawerAction[] = consent ? [...base, { label: 'Nyilatkozat aláíratása', icon: FileSignature, href: `/restaurant/bookings/consent/${r.id}` }] : base
  const OccIcon = r.occasion ? eventIconByKey(r.occasion_icon) : null

  return (
    <>
      <BookingDrawer
        open
        onClose={onClose}
        onEdit={canManage ? onEdit : undefined}
        when={when}
        title={r.customer_name || 'Vendég'}
        guest={{ email: r.customer_email, phone: r.customer_phone, name: r.customer_name }}
        city={r.customer_city}
        pills={r.occasion && OccIcon ? <Pill tone="cell" size="sm" icon={OccIcon}>{r.occasion}</Pill> : undefined}
        alert={r.status === 'pending' ? { tone: 'pending', text: 'Jóváhagyásra vár' } : u ? { tone: u.tone, text: u.label } : null}
        actions={actions}
      >
        <BookingFacts
          service={tables.length ? tables.join(' + ') : 'Nincs asztalhoz rendelve'}
          detail={`${r.pax} fő · ${r.start_time}–${r.end_time}`}
          price={r.deposit_amount_huf ? `${r.deposit_amount_huf.toLocaleString("hu-HU")} Ft előleg` : ""}
          img={null}
          name={tables[0] ?? '?'}
          rows={([
            ['Állapot', r.status === 'confirmed' || r.status === 'pending' ? null : statusOf(r.status).label],
            ['Telefon', r.customer_phone],
            ['E-mail', r.customer_email],
            ['Forrás', RES_SOURCE_LABEL[r.source ?? ''] ?? r.source],
            ['Előleg', r.payment_status === 'paid' ? 'fizetve' : r.payment_status === 'failed' ? 'sikertelen fizetés' : null],
            ['Megjegyzés', r.notes],
          ] as [string, string | null | undefined][]).filter((x): x is [string, string] => !!x[1])}
          ok={r.payment_status === 'paid' ? ['Előleg'] : []}
        />
      </BookingDrawer>
      <ConfirmDialog
        open={confirm === 'cancel'}
        icon={X}
        title="Lemondod a foglalást?"
        description={`${r.customer_name} · ${r.start_time} · ${r.pax} fő`}
        confirmLabel="Lemondás"
        busy={busy}
        onConfirm={() => set('cancelled', 'Foglalás lemondva')}
        onCancel={() => setConfirm(null)}
        zIndexClass="z-[95]"
      >
        {r.customer_email && <FieldRow boxed label="Értesítés" hint={`${r.customer_name} e-mailt kap`}><Check className="h-4 w-4 text-ui-ok" /></FieldRow>}
        <FieldRow boxed label="Az asztal" hint="Felszabadul, újra foglalható"><Check className="h-4 w-4 text-ui-ok" /></FieldRow>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'decline'}
        icon={X}
        title="Elutasítod a foglalást?"
        description={`${r.customer_name} · ${r.start_time} · ${r.pax} fő`}
        confirmLabel="Elutasítom"
        busy={busy}
        onConfirm={() => set('cancelled', 'Elutasítva — a vendég e-mailben értesült', true)}
        onCancel={() => setConfirm(null)}
        zIndexClass="z-[95]"
      >
        {r.customer_email && <FieldRow boxed label="Értesítés" hint={`${r.customer_name} e-mailt kap az elutasításról`}><Check className="h-4 w-4 text-ui-ok" /></FieldRow>}
      </ConfirmDialog>
    </>
  )
}
