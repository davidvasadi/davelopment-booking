'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, minutesToHHMM, minutesToHHMMWrapped, durationMinutes, ymdLocal } from '@/lib/utils'
import { List, LayoutGrid, Map as MapIcon, Plus, Users, User, Clock, Repeat, Banknote, CalendarDays, CalendarRange, CalendarClock } from 'lucide-react'
import type { BookingsRange } from './ReservationDateFilter'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { TableGlyph } from './TableGlyph'
import { ReservationActions } from './ReservationActions'
import { ReservationEditSheet, type EditTarget } from './ReservationEditSheet'
import { OfflineBanner } from './OfflineBanner'
import { useRestaurantUI } from './RestaurantUIContext'
import { getDrafts, subscribeDrafts, type ReservationDraft } from '@/lib/offlineDrafts'
import { MobileOptionSheet } from '@/components/ui/MobileOptionSheet'
import { HoverButton } from '@/components/shared/HoverButton'
import { CLOSED_BORDER, CLOSED_FG, CLOSED_HATCH } from '@/components/dashboard/SalonDailyView'
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
// A hatch-mintás (szaggatott "börtön") hátterek NEM Tailwind bg-[...] arbitrary osztályként
// mennek — Safariban (és mobil WebKiten) a bonyolult repeating-linear-gradient bracket-szintaxis
// nem mindig alkalmazódott (üresen/fehéren maradt a kártya), csak Chrome-on volt jó. Sima
// `style`-lal adjuk, mint az üres-sáv placeholdereknél — az garantáltan minden böngészőben fut.
// Fedő (nem áttetsző) színek — korábban rgba(...) volt, ami a krém oldal-háttéren szépen
// nézett ki, DE egy kártya-verem elé kerülve átütött rajta a mögötte lévő elem színe.
export const HATCH_COMPLETED = 'repeating-linear-gradient(115deg,#FAF8F3 0 7px,#E5E0CD 7px 14px)'
/** A `statusBlock[status]` mellé társítandó inline háttér-stílus (hatch mintáknál), vagy
 *  undefined, ha az adott státusznak nincs (a többi státusz sima Tailwind bg-* osztállyal megy). */
function statusBg(status: string): { background: string } | undefined {
  if (status === 'completed') return { background: HATCH_COMPLETED }
  return undefined
}
const CANCEL_RED = '#C0564A'
const statusBlock: Record<string, string> = {
  pending: 'bg-[#F1CE45] text-ink-dark border-[#F1CE45]',
  confirmed: 'bg-[#1D1C19] text-white border-[#1D1C19]',
  seated: 'bg-[#1D9D63] text-white border-[#1D9D63]',
  // Befejezett — szaggatott "börtön" hatch (mint az Áttekintés-oldal ReservationBlock-ja és a
  // napi nézet üres-sáv placeholderei), nem szolid szín — a háttér a statusBg()-ből jön (style).
  completed: 'text-ink-soft2 border border-[#c9c2ae]',
  no_show: 'bg-red-500 text-white border-red-600',
  cancelled: 'bg-[#C0564A] text-white border-[#C0564A]',
}
const statusDot: Record<string, string> = {
  pending: 'bg-gold', confirmed: 'bg-ink-dark', seated: 'bg-emerald-600',
  completed: 'bg-[#C9C2AE]', no_show: 'bg-red-500', cancelled: 'bg-[#C0564A]',
}
export const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed', 'cancelled'])

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
  roomCount: number
  tableCount: number
  activeCount: number
  completedCount: number
  cancelledCount: number
  walkInCount: number
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
    roomCount, tableCount, activeCount, completedCount, cancelledCount, walkInCount, isClosedToday = false,
    dateFilter, printButton, canManage = false, consentEnabled = false,
  } = props
  const [view, setView] = useState<ViewMode>('timeline')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<ReservationDraft[]>([])
  const [mobileViewOpen, setMobileViewOpen] = useState(false)
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
  const openEdit = useCallback((reservation: Reservation) => { if (canManage) setTarget({ reservation }) }, [canManage])
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

  // Nap/Hét/Hónap — mobilon a nézet-választó sheet MÁSODIK csoportjaként jelenik meg (a
  // desktop pill ilyenkor rejtve, ld. ReservationDateFilter `hideRangeOnMobile`).
  const rangeButtons: { mode: BookingsRange; icon: typeof List; label: string }[] = [
    { mode: 'day', icon: CalendarDays, label: 'Nap' },
    { mode: 'week', icon: CalendarRange, label: 'Hét' },
    { mode: 'month', icon: CalendarClock, label: 'Hónap' },
  ]
  const pickRange = (v: BookingsRange) => router.push(`/restaurant/bookings?date=${date}&range=${v}`)

  // Mobilon a nézet-váltó a fejléc csengő melletti ikonjából nyílik (DashboardNav dispatch-eli).
  useEffect(() => {
    const handler = () => setMobileViewOpen(true)
    window.addEventListener('davelopment:open-bookings-view', handler)
    return () => window.removeEventListener('davelopment:open-bookings-view', handler)
  }, [])

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
            Napi idősáv · {minutesToHHMM(openMin)}–{minutesToHHMM(closeMin)} · {roomCount} terem · {tableCount} asztal
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
                ariaLabel={label}
                className={`flex h-8 w-9 items-center justify-center rounded-[15px] transition-colors ${
                  view === mode ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {/* csak ikon — a nevét rámutatva (title) írja ki */}
                <Icon className="h-4 w-4 shrink-0" />
              </HoverButton>
            ))}
          </div>
          <div className="hidden lg:block">{printButton}</div>
          {canManage && (
            <HoverButton
              onClick={() => openCreate()}
              className="hidden items-center justify-center gap-2 h-[42px] w-[42px] sm:w-auto sm:px-[18px] rounded-dav-pill bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0 lg:inline-flex"
            >
              <Plus className="h-[15px] w-[15px] shrink-0 text-gold" strokeWidth={2.2} />
              <span className="hidden sm:inline">Új foglalás</span>
            </HoverButton>
          )}
        </div>
      </div>

      {/* ── Fejléc a cím ALATT: státusz-csík (bal) + nagy KPI-számok (jobb) — a nap VALÓS adatai,
          ugyanaz az animáció/viselkedés, mint az Áttekintésen (StatusPills + CountUpKpi). ── */}
      {!focusMode && (() => {
        const totalRes = reservations.length || 1
        // A csík első (sötét) sávja a MÁR LEZÁRULT (Befejezett) foglalásokat méri, a második
        // (arany) a MÉG AKTÍV, megerősített/leültetett (nem befejezett, nem lemondott)
        // foglalásokat — így a három sáv ténylegesen a nap valós lefolyását tükrözi.
        const completedResCount = reservations.filter((r) => r.status === 'completed').length
        const activeConfirmedCount = reservations.filter((r) => r.status === 'confirmed' || r.status === 'seated').length
        const paxTotal = reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + (r.pax ?? 0), 0)
        const HATCH = 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)'
        return (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <StatusPills
              eager
              className="flex-1 lg:max-w-[760px]"
              segments={[
                { label: 'Befejezett', pct: Math.round((completedResCount / totalRes) * 100), background: '#1D1C19', color: '#fff' },
                { label: 'Megerősített', pct: Math.round((activeConfirmedCount / totalRes) * 100), background: '#F1CE45', color: '#1D1C19' },
                { label: 'Lemondva', pct: Math.round((cancelledCount / totalRes) * 100), background: HATCH, color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
              ]}
            />
            <div className="flex flex-wrap items-start gap-8 lg:gap-10">
              <CountUpKpi icon="calendar" value={activeCount} label="Foglalás" />
              <CountUpKpi icon="users" value={paxTotal} label="Vendég" />
              <CountUpKpi icon="walkin" value={walkInCount} label="Beeső (walk-in)" />
            </div>
          </div>
        )
      })()}

      {view === 'list' && <ListTableView date={date} reservations={reservations} onEdit={openEdit} consentEnabled={consentEnabled} />}
      {view === 'timeline' && (
        <TimelineView
          date={date}
          {...{ reservations, rooms, tables, openMin, closeMin, turnMinutes, isClosedToday }}
          onEdit={openEdit}
          onCreate={openCreate}
          onMove={moveReservation}
          canManage={canManage}
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
        turnMinutes={turnMinutes}
      />

      <MobileOptionSheet
        open={mobileViewOpen}
        onClose={() => setMobileViewOpen(false)}
        title="Nézet"
        options={viewButtons}
        value={view}
        onChange={pick}
        secondaryTitle="Időszak"
        secondaryOptions={rangeButtons}
        secondaryValue={range}
        secondaryOnChange={pickRange}
      />
    </div>
  )
}

/* ---------- Lista nézet (egynapos) — táblázatos ---------- */
// Státusz a táblázatban: CSAK pötty + színes felirat (nincs sor-háttér) — ugyanaz, mint a szalonnál.
const TABLE_STATUS: Record<string, { dot: string; text: string }> = {
  confirmed: { dot: 'bg-[#1D9D63]', text: 'text-[#1D7A4C]' },
  seated: { dot: 'bg-[#2F6FD0]', text: 'text-[#2A5DAE]' },
  pending: { dot: 'bg-[#E0B21C]', text: 'text-[#9A7B12]' },
  completed: { dot: 'bg-[#B9B4A6]', text: 'text-ink-soft2' },
  no_show: { dot: 'bg-[#E07B39]', text: 'text-[#C2621F]' },
  cancelled: { dot: 'bg-[#C0564A]', text: 'text-[#C0564A]' },
}
const SOURCE_LABEL: Record<string, string> = { online: 'Online', phone: 'Telefon', walk_in: 'Beeső' }

function ListTableView({ date, reservations, onEdit, consentEnabled }: { date: string; reservations: Reservation[]; onEdit: (r: Reservation) => void; consentEnabled?: boolean }) {
  const nowMin = useNowMinutes(date)
  const nowRef = useRef<HTMLDivElement>(null)
  const sorted = [...reservations].sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
  const nowIndex = nowMin == null ? -1 : sorted.findIndex((r) => hhmmToMinutes(r.start_time) >= nowMin)
  const scrollRef = useRef<HTMLDivElement>(null)
  // A „most” sorra ugrás CSAK a lista saját görgethető dobozán belül történik — korábban a
  // scrollIntoView az egész oldalt rángatta, és percenként vissza kellett görgetni a fejlécre.
  useEffect(() => {
    const box = scrollRef.current
    const row = nowRef.current
    if (!box || !row) return
    box.scrollTo({ top: Math.max(0, row.offsetTop - box.clientHeight / 2), behavior: 'smooth' })
  }, [nowIndex, date])

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[26px] dav-card-glass px-6 py-16 text-center">
        <CalendarDays className="h-8 w-8 text-ink-soft" strokeWidth={1.6} />
        <p className="text-sm text-ink-soft">Erre a napra nincs foglalás.</p>
      </div>
    )
  }

  const GRID = 'grid grid-cols-[64px_1fr_auto] items-center gap-3 sm:grid-cols-[88px_1.4fr_80px_1fr_96px_150px_40px] sm:gap-4'
  return (
    <div className="rounded-[26px] dav-card-glass p-3 sm:p-4">
      {/* Fejléc-sáv */}
      <div className={`${GRID} rounded-[14px] bg-[#F4F4F4] px-3 py-2.5 text-[12px] font-semibold text-ink-soft sm:px-4`}>
        <span>Időpont</span>
        <span>Vendég</span>
        <span className="hidden sm:block">Létszám</span>
        <span className="hidden sm:block">Asztal</span>
        <span className="hidden sm:block">Forrás</span>
        <span className="text-right sm:text-left">Státusz</span>
        <span className="hidden sm:block" />
      </div>

      {/* a sorok saját dobozban görgetnek; a fejléc-sáv fölötte fix marad */}
      <div ref={scrollRef} data-lenis-prevent className="relative mt-1 max-h-[calc(100dvh-220px)] min-h-[320px] overflow-y-auto overscroll-contain">
        {sorted.map((r, i) => {
          const draft = isDraft(r)
          const overdue = !draft && needsHandling(r, nowMin)
          const ts = TABLE_STATUS[r.status] ?? TABLE_STATUS.completed
          const tables = tableNamesOf(r)
          return (
            <div key={String(r.id)}>
              {i === nowIndex && (
                <div ref={nowRef} className="flex items-center gap-2 px-3 py-1.5 sm:px-4">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-soft-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">Most · {minutesToHHMM(nowMin!)}</span>
                  <span className="h-px flex-1 bg-red-500/40" />
                </div>
              )}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onEdit(r)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEdit(r) }}
                className={`${GRID} cursor-pointer rounded-[14px] px-3 py-3 transition-colors hover:bg-black/[0.025] sm:px-4 ${i > 0 && i !== nowIndex ? 'border-t border-line/70' : ''} ${r.status === 'cancelled' ? 'opacity-70' : ''}`}
              >
                <span className="tabular-nums">
                  <span className="block text-[14px] font-semibold text-ink">{r.start_time}</span>
                  <span className="block text-[11.5px] text-ink-soft2">{r.end_time}</span>
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate text-[14px] font-semibold text-ink ${r.status === 'cancelled' ? 'line-through decoration-ink-soft2/60' : ''}`}>{r.customer_name || 'Vendég'}</span>
                    {draft && <span className="shrink-0 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-dark">Vázlat</span>}
                    {r.occasion && (() => { const OccIcon = eventIconByKey(r.occasion_icon); return <span title={r.occasion}><OccIcon className="h-3.5 w-3.5 shrink-0 text-[#9A7B12]" /></span> })()}
                    {r.series_id && <Repeat className="h-3.5 w-3.5 shrink-0 text-[#9A7B12]" aria-label="Sorozat" />}
                    {r.payment_status === 'paid' && <Banknote className="h-3.5 w-3.5 shrink-0 text-[#1D7A3C]" aria-label="Előleg befizetve" />}
                  </span>
                  {/* mobilon a létszám + asztal a név alatt */}
                  <span className="block truncate text-[12.5px] text-ink-soft sm:hidden">{r.pax} fő{tables.length ? ` · ${tables.join(' + ')}` : ''}</span>
                  <span className="hidden truncate text-[12px] text-ink-soft2 sm:block">{r.customer_phone || r.customer_email || ''}</span>
                </span>
                <span className="hidden items-center gap-1.5 text-[13.5px] text-ink sm:flex"><Users className="h-3.5 w-3.5 text-ink-soft2" strokeWidth={1.8} />{r.pax} fő</span>
                <span className="hidden truncate text-[13.5px] text-ink sm:block">{tables.length ? tables.join(' + ') : '—'}</span>
                <span className="hidden text-[13px] text-ink-soft sm:block">{SOURCE_LABEL[r.source] ?? '—'}</span>
                <span className={`flex items-center justify-end gap-1.5 text-[12.5px] font-semibold sm:justify-start ${overdue ? 'text-[#9A7B12]' : ts.text}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${overdue ? 'bg-gold' : ts.dot}`} />
                  <span className="hidden truncate sm:inline">{overdue ? 'Kezelendő' : (statusLabel[r.status] ?? r.status)}</span>
                </span>
                <span className="hidden justify-end sm:flex" onClick={(e) => e.stopPropagation()}>
                  {!draft && (
                    <ReservationActions reservationId={r.id} status={r.status} consentEnabled={consentEnabled} consentAccepted={!!r.consent_accepted} />
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReservationRow({ r, onEdit, nowMin, consentEnabled }: { r: Reservation; onEdit: (r: Reservation) => void; nowMin: number | null; consentEnabled?: boolean }) {
  const tableNames = tableNamesOf(r)
  const draft = isDraft(r)
  const urgency = draft ? null : urgencyOf(r, nowMin)
  const overdue = !draft && needsHandling(r, nowMin)
  return (
    <div
      className={`relative flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 transition-colors hover:bg-[var(--dav-glass)] ${
        draft
          ? 'bg-gold/[0.08]'
          : overdue
            ? 'bg-[#F1CE45]/[0.12]'
            : ''
      }`}
      style={
        draft || overdue
          ? undefined
          // Safari-bug: a bg-[#hex]/[opacity] Tailwind arbitrary-szintaxis a lemondott
          // piros háttérnél nem alkalmazódott — sima style-lal garantáltan minden
          // böngészőben fut.
          : r.status === 'cancelled'
            ? { background: 'rgba(192,86,74,0.10)' }
            : statusBg(r.status)
      }
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
            <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${overdue ? 'bg-gold' : (statusDot[r.status] ?? 'bg-line-strong')}`} />
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
            {r.payment_status === 'paid' && (
              <span title={r.invoice_status === 'issued' ? `Előleg befizetve · Számla: ${r.invoice_number}` : 'Előleg befizetve'} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#DCF3E2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1D7A3C]">
                <Banknote className="h-3 w-3" /> Előleg
              </span>
            )}
            {r.payment_status === 'failed' && (
              <span title="Az előleg-fizetés sikertelen volt" className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#FBE1DE] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B3261E]">
                <Banknote className="h-3 w-3" /> Sikertelen fizetés
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
        {!draft && <PaxAvatarBadges pax={r.pax} />}
        <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
          <span className={`h-2 w-2 shrink-0 rounded-full ${overdue ? 'bg-gold' : (statusDot[r.status] ?? 'bg-line-strong')}`} />
          <span className="text-xs text-ink-soft truncate">
            {overdue ? 'Kezelendő' : (statusLabel[r.status] ?? r.status)}
          </span>
        </span>
        <div className="flex items-center justify-end w-10 shrink-0">
          {!draft && (
            <ReservationActions
              reservationId={r.id}
              status={r.status}
              consentEnabled={consentEnabled}
              consentAccepted={!!r.consent_accepted}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Timeline (asztal × idő rács) ---------- */
function TimelineView({
  date, reservations, rooms, tables, openMin, closeMin, turnMinutes, isClosedToday = false, onEdit, onCreate, onMove, canManage = false,
}: ViewProps & {
  isClosedToday?: boolean
  onEdit: (r: Reservation) => void
  onCreate: (start?: string, tableId?: string | number | null) => void
  onMove: (r: Reservation, newStart: string, newTableId: string | number) => void
  canManage?: boolean
}) {
  const active = reservations.filter((r) => ACTIVE.has(r.status))
  // A rács jobb széle a záróráig ÉS az összes aznapi foglalás legkésőbbi végéig ér, amelyik
  // később van — enélkül egy záróra utánig tartó foglalás kilógna a rács alól, az üres
  // (sraffozott) sávok pedig csak a záróráig érnének, rövidebbnek látszva a foglaltaknál.
  const dayEnd = active.reduce((max, r) => Math.max(max, hhmmToMinutes(r.end_time)), closeMin)
  const totalMin = Math.max(dayEnd - openMin, 60)
  const nowMin = useNowMinutes(date)
  const nowVisible = nowMin != null && nowMin >= openMin && nowMin <= closeMin
  const card = 'rounded-[26px] dav-card-glass'

  // óránkénti rácsvonalak — ha a nyitás nem kerek órakor van (pl. 10:30), a nyitás saját
  // időpontja is kap egy jelölést, különben a tengely csak a KÖVETKEZŐ kerek órától indult
  // volna (11:00), és a nyitás utáni első fél óra jelöletlen/"levágottnak" tűnt volna.
  const hourMarks: number[] = []
  if (openMin % 60 !== 0) hourMarks.push(openMin)
  for (let m = Math.ceil(openMin / 60) * 60; m < closeMin; m += 60) hourMarks.push(m)

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
    <>
      {/* Mobil: Crextio Mobile függőleges idővonal (óra-pillek pontozott vonallal + kártyák) */}
      <div className="lg:hidden">
        <MobileTimeline {...{ hourMarks, active, openMin, closeMin, nowMin, onEdit, isClosedToday }} />
      </div>
      {/* Desktop: normál nyitvatartásnál a teljes nap egy nézetben (százalékos); ha a nap
          nagyon hosszú (pl. éjfél utánig nyitva — ld. a záróra-normalizálást a page.tsx-ben),
          a "fit" mód %-os skálázása összenyomná/torzítaná a tartalmat — ilyenkor helyette
          fix px/perc alapú, vízszintesen görgethető sávra váltunk, ami automatikusan az
          aktuális időpontra görget nyitáskor. */}
      <div className="hidden lg:block">
        <TableGrid
          {...{ groups, active, hourMarks, openMin, closeMin, totalMin, turnMinutes, nowMin, nowVisible, card, onEdit, onCreate, onMove, canManage, isClosedToday }}
          mode={totalMin > 13 * 60 ? 'scroll' : 'fit'}
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
export const TL_EXTRA_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

// A sötét-hátterű (fehér szövegű) státuszok — a másodlagos sor színéhez.
const STATUS_DARK_BG = new Set(['confirmed', 'seated', 'no_show', 'cancelled'])

/** Egyetlen foglalás-kártya a mobil idővonalon (az első és a kinyíló extrák is ezt használják).
 *  A háttér a KÁNONI `statusBlock` palettából jön — ugyanaz, mint a desktopon. */
/** Egymásra csúsztatott vendég-avatar jelvények (max 3, felette +N) — ugyanaz a nyelv, mint
 *  az Áttekintés-oldal `OverviewTimeline` idővonalán a befejezett foglalásoknál. */
function PaxAvatarBadges({ pax }: { pax: number }) {
  const showCount = pax > 3
  const shown = showCount ? 2 : Math.min(pax, 3)
  return (
    <div className="flex shrink-0 items-center pr-0.5">
      {Array.from({ length: shown }).map((_, i) => (
        <span
          key={i}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-dark shadow-[0_1px_3px_rgba(0,0,0,.35)]"
          style={{ marginLeft: i ? -8 : 0, zIndex: i + 1 }}
        >
          <User className="h-3 w-3" strokeWidth={2} />
        </span>
      ))}
      {showCount && (
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-ink-dark shadow-[0_1px_3px_rgba(0,0,0,.35)]"
          style={{ marginLeft: -8, zIndex: 10 }}
        >
          +{pax - shown}
        </span>
      )}
    </div>
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

export function cellKey(item: CellItem): string {
  return Array.isArray(item) ? `${item[0].id}-${item[1].id}` : String(item.id)
}

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

const STACK_PEEK_BG: Record<string, string> = {
  pending: '#F1CE45', confirmed: '#1D1C19', seated: '#1D9D63', completed: '#c9c2ae',
  no_show: '#ef4444', cancelled: CANCEL_RED,
}

/** Kártya-verem: ugyanarra az asztalra/időre esik egy aktív ÉS egy lemondott foglalás (pl.
 *  lemondás után újra lefoglalták). Az elöl lévő teljes kártyát kap, a másik egy kis (a saját
 *  státusz-színű) csík formájában kandikál ki a bal szélén — rákattintva cserélnek. */
function ReservationCardStack({
  items, onEdit, tableNamesOf, nowMin,
}: {
  items: [Reservation, Reservation]
  onEdit: (r: Reservation) => void
  tableNamesOf: (r: Reservation) => string[]
  nowMin: number | null
}) {
  // Két FÜGGETLEN szabály: a POZÍCIÓ (bal/jobb) mindig a lemondotté balra — ez fix, nem változik
  // kattintásra, hogy sose legyen megtévesztő, melyik időponthoz tartozik. Az ÁLLAPOT (melyik van
  // nyitva/nagyban) viszont a frissebb (később létrehozott, jellemzően az aktív) legyen alapból.
  const ordered = [...items].sort((a, b) => (a.status === 'cancelled' ? -1 : b.status === 'cancelled' ? 1 : 0))
  const freshestId = String([...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].id)
  const [frontId, setFrontId] = useState<string>(freshestId)
  return (
    <div className="flex h-[72px] items-stretch gap-1.5">
      {ordered.map((r) => {
        const id = String(r.id)
        const isFront = id === frontId
        return (
          <div
            key={id}
            onClick={isFront ? undefined : (e) => { e.stopPropagation(); setFrontId(id) }}
            role={isFront ? undefined : 'button'}
            tabIndex={isFront ? undefined : 0}
            aria-label={isFront ? undefined : `Előzmény megtekintése: ${r.customer_name} (${statusLabel[r.status] ?? r.status})`}
            className={`h-full overflow-hidden ${isFront ? 'min-w-0' : 'shrink-0 cursor-pointer rounded-[16px] shadow-dav-card'}`}
            style={{
              flexGrow: isFront ? 1 : 0,
              flexShrink: isFront ? 1 : 0,
              flexBasis: isFront ? '100%' : 24,
              transition: 'flex-grow 320ms cubic-bezier(0.22,1,0.36,1), flex-basis 320ms cubic-bezier(0.22,1,0.36,1)',
              background: !isFront ? (STACK_PEEK_BG[r.status] ?? '#c9c2ae') : undefined,
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
                  {renderReservationCard(r, onEdit, tableNamesOf, nowMin)}
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
export function renderCellItem(
  item: CellItem,
  onEdit: (r: Reservation) => void,
  tableNamesOf: (r: Reservation) => string[],
  nowMin: number | null,
) {
  if (Array.isArray(item)) return <ReservationCardStack items={item} onEdit={onEdit} tableNamesOf={tableNamesOf} nowMin={nowMin} />
  return renderReservationCard(item, onEdit, tableNamesOf, nowMin)
}

export function renderReservationCard(
  r: Reservation,
  onEdit: (r: Reservation) => void,
  tableNamesOf: (r: Reservation) => string[],
  nowMin: number | null,
) {
  const tn = tableNamesOf(r)
  const overdue = needsHandling(r, nowMin)
  const block = overdue ? statusBlock.pending : (statusBlock[r.status] ?? 'bg-white border border-line text-ink')
  const dark = !overdue && STATUS_DARK_BG.has(r.status)
  return (
    <HoverButton
      onClick={() => onEdit(r)}
      className={`flex h-[72px] w-full items-center gap-2.5 rounded-[18px] border px-4 text-left shadow-dav-card ${block}`}
      style={overdue ? undefined : statusBg(r.status)}
    >
      <div className="min-w-0 flex-1">
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
            {r.payment_status === 'paid' && (
              <span title="Előleg befizetve" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#DCF3E2] text-[#1D7A3C]">
                <Banknote className="h-2.5 w-2.5" />
              </span>
            )}
            <span className={`h-2 w-2 rounded-full ${overdue ? 'bg-gold' : (statusDot[r.status] ?? 'bg-line-strong')}`} />
          </span>
        </div>
        <div className={`mt-0.5 truncate text-xs ${dark ? 'text-white/70' : 'text-ink-soft'}`}>
          {r.start_time}–{r.end_time}{tn.length ? ` · ${tn.join(' + ')}` : ''}
        </div>
      </div>
      <PaxAvatarBadges pax={r.pax} />
    </HoverButton>
  )
}

/** Óránkénti lista — a mobil idővonal "törzse" (idő-pill + foglalás-kártya/üres rés), a
 *  kártya-wrapper NÉLKÜL — a Heti nézet ezt hívja NAPONKÉNT, saját fejléccel körbevéve. */
export function HourList({
  hourMarks, active, openMin, closeMin, nowMin, onEdit, isClosedToday = false,
}: {
  hourMarks: number[]
  active: Reservation[]
  openMin: number
  closeMin: number
  nowMin: number | null
  onEdit: (r: Reservation) => void
  isClosedToday?: boolean
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const toggle = (m: number) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n })
  const tableNamesOf = (r: Reservation) =>
    (r.tables ?? []).map((t) => (typeof t === 'object' && t ? t.name : null)).filter((n): n is string => !!n)

  return (
      <div>
        {hourMarks.map((m, i) => {
          const lo = i === 0 ? openMin : m
          const hi = i < hourMarks.length - 1 ? hourMarks[i + 1] : closeMin + 1
          const inHourRaw = active
            .filter((r) => { const s = hhmmToMinutes(r.start_time); return s >= lo && s < hi })
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          const inHour = groupOverlaps(inHourRaw)
          // Korábbi órában induló, de a foglalás hossza miatt ide is átnyúló asztalfoglalások —
          // enélkül egy hosszabb vacsora a kezdő-óráján túl üresnek tűnt volna.
          const continuing = active.filter((r) => {
            const s = hhmmToMinutes(r.start_time)
            const e = hhmmToMinutes(r.end_time)
            return s < lo && e > lo
          })
          const isNow = nowMin != null && nowMin >= m && nowMin < (hourMarks[i + 1] ?? closeMin + 1)
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
                  {minutesToHHMMWrapped(m)}
                </span>
                {!last && (
                  <div className="relative flex min-h-[30px] flex-1 items-center justify-center py-1.5">
                    <span className="absolute inset-y-0 border-l-2 border-dotted border-line-strong" />
                    {inHour.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggle(m)}
                        aria-label={`még ${inHour.length - 1} foglalás ${minutesToHHMMWrapped(m)}-kor — ${isOpen ? 'bezárás' : 'megnyitás'}`}
                        className={`relative z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                      >
                        +{inHour.length - 1}
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
                    {renderCellItem(inHour[0], onEdit, tableNamesOf, nowMin)}
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
                                {renderCellItem(item, onEdit, tableNamesOf, nowMin)}
                              </motion.div>
                            ))}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {continuing.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {continuing.map((r) => (
                          <div key={`cont-${r.id}`}>{renderReservationCard(r, onEdit, tableNamesOf, nowMin)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : continuing.length > 0 ? (
                  <div className="space-y-2">
                    {continuing.map((r) => (
                      <div key={`cont-${r.id}`}>{renderReservationCard(r, onEdit, tableNamesOf, nowMin)}</div>
                    ))}
                  </div>
                ) : isClosedToday ? (
                  <div
                    aria-hidden
                    className="flex h-[72px] items-center justify-center rounded-[18px] border"
                    style={{ background: CLOSED_HATCH, borderColor: CLOSED_BORDER }}
                  >
                    <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: CLOSED_FG }}>Zárva</span>
                  </div>
                ) : (
                  // Üres óra — Crextio „prison" szaggatott hatch-placeholder kártya (nincs foglalás)
                  <div
                    aria-hidden
                    className="h-[72px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
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

/** Mobil idővonal — kártya-keret + cím + a közös `HourList` (Crextio „Schedule" panel: üveges,
 *  áttetsző kártya, az oldal-gradient átdereng rajta; üres óráknál szaggatott hatch-placeholder). */
function MobileTimeline({
  hourMarks, active, openMin, closeMin, nowMin, onEdit, isClosedToday = false,
}: {
  hourMarks: number[]
  active: Reservation[]
  openMin: number
  closeMin: number
  nowMin: number | null
  onEdit: (r: Reservation) => void
  isClosedToday?: boolean
}) {
  return (
    <div className="rounded-[26px] p-4 dav-card-glass">
      <div className="mb-3 text-[17px] font-medium text-ink">Mai szervizterv</div>
      <HourList {...{ hourMarks, active, openMin, closeMin, nowMin, onEdit, isClosedToday }} />
    </div>
  )
}

/** A rács (abszolút pozícionált, húzható) blokk-verme: ugyanazon asztalra/időre esik egy aktív
 *  ÉS egy lemondott foglalás. Az elöl lévő a rendes blokkot kapja (a `renderBlock`-ból, kicsit
 *  jobbra tolva), a másik egy kis csík formájában kandikál ki a bal szélén, a saját státusz-
 *  színével — rákattintva cserélnek. Modul-szinten definiálva (nem a TableGrid render-testében),
 *  hogy a frontId állapota ne vesszen el minden újra-renderelésnél.
 *  (ld. [[shell-component-remount-bug]] — inline definiált komponens = state-vesztés). */
/** Rács-verem: a pár EGYMÁS MELLETT áll (flex-sor) egy közös, az idő-tengelyhez abszolút
 *  pozícionált konténerben — nincs átfedés/réteg, így semmi nem takarhat ki semmit. Az elöl
 *  lévő a teljes szélességet kapja, a másik egy kis csíkra tolódik — kattintásra a szélességük
 *  FLIP-anmiálva cserél. */
function TableGridStack({
  pair, left, span, renderContent,
}: {
  pair: [Reservation, Reservation]
  left: (min: number) => string
  span: (min: number) => string
  renderContent: (r: Reservation, standalone?: boolean) => React.ReactNode
}) {
  // Két FÜGGETLEN szabály: a POZÍCIÓ (bal/jobb, és a konténer idő-tengelyen elfoglalt helye is)
  // mindig a lemondotté — ez fix, nem mozdul kattintásra, hogy sose legyen megtévesztő, melyik
  // időponthoz tartozik. Az ÁLLAPOT (melyik van nyitva/nagyban) viszont a frissebb (később
  // létrehozott, jellemzően az aktív) legyen alapból.
  const ordered = [...pair].sort((a, b) => (a.status === 'cancelled' ? -1 : b.status === 'cancelled' ? 1 : 0))
  // A konténer a PÁR idő-UNIÓJÁT fogja át (a korábbi kezdéstől a későbbi végéig) — ha csak a
  // lemondott saját idejét használtuk volna, egy nála hosszabb új foglalás belelógott/levágódott
  // volna, mert nem fért volna el a (rövidebb) lemondott szélességébe.
  const s = Math.min(...pair.map((r) => hhmmToMinutes(r.start_time)))
  const e = Math.max(...pair.map((r) => hhmmToMinutes(r.end_time)))
  const freshestId = String([...pair].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].id)
  const [frontId, setFrontId] = useState<string>(freshestId)
  return (
    <div
      className="absolute top-[7px] bottom-[7px] flex items-stretch gap-1"
      style={{ left: `calc(${left(s)} + 2px)`, width: `calc(${span(e - s)} - 4px)` }}
    >
      {ordered.map((r) => {
        const id = String(r.id)
        const isFront = id === frontId
        return (
          <div
            key={id}
            onClick={isFront ? undefined : (ev) => { ev.stopPropagation(); setFrontId(id) }}
            role={isFront ? undefined : 'button'}
            tabIndex={isFront ? undefined : 0}
            aria-label={isFront ? undefined : `Előzmény megtekintése: ${r.customer_name} (${statusLabel[r.status] ?? r.status})`}
            className={`h-full overflow-hidden ${isFront ? 'min-w-0' : 'shrink-0 cursor-pointer rounded-[11px]'}`}
            style={{
              flexGrow: isFront ? 1 : 0,
              flexShrink: isFront ? 1 : 0,
              flexBasis: isFront ? '100%' : 20,
              transition: 'flex-grow 320ms cubic-bezier(0.22,1,0.36,1), flex-basis 320ms cubic-bezier(0.22,1,0.36,1)',
              background: !isFront ? (STACK_PEEK_BG[r.status] ?? '#c9c2ae') : undefined,
            }}
          >
            <AnimatePresence initial={false}>
              {isFront && (
                <motion.div
                  key="content"
                  className="h-full w-full"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {renderContent(r, false)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/** Asztal × idő rács. `mode='scroll'`: fix px/perc, vízszintesen görgethető
 *  (mobil). `mode='fit'`: a teljes nap egy nézetbe fér százalékos pozícióval
 *  (desktop). A foglalás-blokkok tartalma közös. */
const PX_PER_MIN = 1.5 // scroll módban 1 perc = 1.5px → 30 perc = 45px
function TableGrid({
  groups, active, hourMarks, openMin, closeMin, totalMin, turnMinutes, nowMin, nowVisible, card, mode, onEdit, onCreate, onMove, canManage = false, isClosedToday = false,
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
  canManage?: boolean
  isClosedToday?: boolean
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
  // A fejléc-vonalzó (óra-tengely) KÜLÖN görgő fa, mint a tartalom — függőlegesen sosem
  // görgetjük együtt (lásd lent), vízszintesen viszont scrollLeft-tükrözéssel tartjuk
  // szinkronban a tartalommal, hogy az órák a foglalások fölött maradjanak.
  const axisRef = useRef<HTMLDivElement>(null)
  const syncingScrollRef = useRef(false)
  const onGridScroll = () => {
    if (syncingScrollRef.current || !axisRef.current || !gridRef.current) return
    syncingScrollRef.current = true
    axisRef.current.scrollLeft = gridRef.current.scrollLeft
    syncingScrollRef.current = false
  }
  const onAxisScroll = () => {
    if (syncingScrollRef.current || !axisRef.current || !gridRef.current) return
    syncingScrollRef.current = true
    gridRef.current.scrollLeft = axisRef.current.scrollLeft
    syncingScrollRef.current = false
  }

  // Scroll módban (nagyon hosszú nyitvatartásnál) nyitáskor az aktuális időpontra görgetünk,
  // hogy ne kelljen kézzel odakeresni — csak egyszer, a felhasználó további görgetését nem írja felül.
  useEffect(() => {
    if (fit || nowMin == null || !gridRef.current) return
    const el = gridRef.current
    const target = (nowMin - openMin) * PX_PER_MIN - el.clientWidth / 2
    el.scrollLeft = Math.max(0, target)
    if (axisRef.current) axisRef.current.scrollLeft = el.scrollLeft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Pending: a pointerdown még NEM indít drag-et, csak előkészíti. Valódi húzás csak akkor
  // indul, ha az egér/ujj ≥ DRAG_THRESHOLD px-et mozdul — különben kattintásnak vesszük
  // (szerkesztés megnyitása). Így rá lehet kattintani a foglalásra, nem ugrik egyből mozgatásba.
  const pendingRef = useRef<{ r: Reservation; init: DragState; startX: number; startY: number } | null>(null)
  // A blokk-kattintás utáni buborékoló `click`-et elnyomja a háttér-soron (ne hozzon létre újat).
  const blockNextRowClickRef = useRef(false)
  const DRAG_THRESHOLD = 8

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
      // Race condition: az onPendingMove elindította a dragot (dragRef.current = init, setDrag(init)),
      // de a useEffect([drag]) aszinkron fut — az onUp handler még nem regisztrált a windowra,
      // mire a pointerup megérkezik. Így dragRef bennragad nem-null állapotban, ami minden
      // jövőbeli kattintást blokkol. Megoldjuk: ha itt dragRef be van állítva, mi takarítunk.
      if (dragRef.current) {
        dragRef.current = null
        setDrag(null)
        return
      }
      // Ha volt pending és nem lett drag → kattintás = szerkesztés.
      // A blokkra-kattintás után a böngésző egy `click`-et is kilő, ami a háttér-sor
      // onClick-jére (új foglalás) buborékolna — ezt a flaggel elnyomjuk.
      if (p) {
        blockNextRowClickRef.current = true
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
    // Capture phase: onUp fut le ELSŐ, mielőtt a bubble-phase onPendingUp is tüzelne.
    // Így drag végén onPendingUp már null dragRef-et lát, és nem zavarja a drag-logikát.
    window.addEventListener('pointerup', onUp, { capture: true })
    return () => {
      window.removeEventListener('pointermove', onMoveEvt)
      window.removeEventListener('pointerup', onUp, { capture: true })
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

  /** Egy foglalás-blokk (a rácsban abszolút pozícionálva) — kiemelve, hogy a kártya-verem
   *  (TableGridStack) is meg tudja hívni ugyanazzal a tartalommal, csak egy kis bal-oldali
   *  behúzással (`insetLeft`), hogy a mögötte kandikáló lemondott csík látszódjon. */
  /** `standalone=true`: önmagát pozícionálja abszolút az idő-tengelyhez (a normál eset).
   *  `standalone=false`: egy verem flex-sorának KITÖLTŐ eleme — a szélesség/pozíció a flex
   *  szülőtől jön, itt csak a tartalom/keret számít (ld. TableGridStack — a pár EGYMÁS MELLETT
   *  áll, nem egymáson, így nincs átfedés/réteg, ami kitakarhatna bármit). */
  function renderBlock(r: Reservation, standalone = true): React.ReactNode {
    const s = hhmmToMinutes(r.start_time)
    const e = hhmmToMinutes(r.end_time)
    const dur = e - s
    const draft = isDraft(r)
    const urgency = draft ? null : urgencyOf(r, nowMin)
    const overdue = !draft && needsHandling(r, nowMin)
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
        type="button"
        onPointerDown={(ev) => { if (!draft && canManage) { ev.stopPropagation(); beginPointer(r, ev) } }}
        title={`${draft ? 'VÁZLAT — ' : canManage ? 'Kattints a szerkesztéshez, vagy húzd át másik időpontra/asztalra · ' : ''}${r.customer_name} · ${r.pax} fő · ${r.start_time}–${r.end_time} · ${urgency ? urgency.label : statusLabel[r.status]}`}
        className={`${standalone ? 'absolute top-[7px] bottom-[7px]' : 'h-full w-full min-w-0'} rounded-[11px] border px-[11px] text-xs font-medium overflow-hidden text-left flex flex-col justify-center gap-0.5 transition-all ${draft ? 'border-2 border-dashed border-gold bg-gold/[0.18] text-ink-dark cursor-default' : `${overdue ? statusBlock.pending : statusBlock[r.status]} ${canManage ? 'cursor-grab active:cursor-grabbing hover:brightness-[1.06]' : 'cursor-default'}`} ${isDragging ? 'opacity-30 pointer-events-none' : ''}`}
        style={{
          ...(standalone ? { left: `calc(${left(s)} + 2px)`, width: `calc(${span(dur)} - 4px)` } : {}),
          touchAction: 'none',
          ...(!draft && !overdue ? statusBg(r.status) : undefined),
        }}
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

      <div className="flex flex-col">
        {/* Fejléc: bal sarok (terem-cím) + óra-vonalzó — KÜLÖN, SOSEM függőlegesen görgő fa a
            tartalom fölött (nem sticky — nem függ a böngésző position:sticky viselkedésétől).
            Vízszintesen scrollLeft-tükrözéssel tartjuk szinkronban a tartalommal (lásd
            onGridScroll/onAxisScroll), hogy az órák mindig a foglalások fölött maradjanak. */}
        <div className="flex">
          <div className={`${labelW} shrink-0`}>
            {groups[0]?.name ? (
              <div className="flex h-9 items-end gap-[9px] pb-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">
                  {groups[0].name}
                </span>
                <span className="rounded-[10px] bg-[#EDE7D6] px-[9px] py-[3px] text-[10px] font-semibold text-[#9A8B52]">
                  {roomPillLabel(groups[0].room)}
                </span>
              </div>
            ) : (
              <div className="h-9" />
            )}
          </div>

          <div ref={axisRef} onScroll={onAxisScroll} className={`min-w-0 flex-1 ${fit ? '' : 'overflow-x-auto no-scrollbar'}`}>
          <div style={fit ? undefined : { width: axisWidth }}>
          {/* idő-tengely (vonalzó) — az első terem címével egy magasságban (h-9), lásd a bal oszlopot.
              A sor MAGASABB (h-9), mint pusztán az óra-címkékhez kellene, hogy a piros "most" jelölő
              fölötte kapjon saját helyet — így nem lóg bele/takarja a szomszédos óra-feliratokat. */}
          <div className="relative h-9">
              {hourMarks.map((m, i) => (
                <span
                  key={m}
                  // Az ELSŐ (nyitási) címke NEM középre igazított — a görgethető sáv bal szélén
                  // középre igazítva a szöveg fele balra kilógott volna, ahol nincs hely, és a
                  // konténer levágta. A többi (belső) óracímke marad középre igazítva.
                  className={`absolute bottom-0.5 text-[11px] font-medium tabular-nums text-[#A8A496] ${i === 0 ? '' : '-translate-x-1/2'}`}
                  style={{ left: left(m) }}
                >
                  {minutesToHHMMWrapped(m)}
                </span>
              ))}
              {/* Záróra felirat — a jobb szélen NEM középre igazított (mint az első/nyitási
                  címke a bal szélen sem az) — középre igazítva a szöveg fele jobbra kilógott
                  volna a konténerből, ahol nincs hely. Csak balra nyúlik a pontjától. */}
              <span
                className="absolute bottom-0.5 -translate-x-full whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink-soft2"
                style={{ left: left(closeMin) }}
              >
                Zárás {minutesToHHMMWrapped(closeMin)}
              </span>
              {nowVisible && (
                <span
                  className="absolute top-0 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-md"
                  style={{ left: left(nowMin!) }}
                >
                  {minutesToHHMM(nowMin!)}
                </span>
              )}
          </div>
          </div>
          </div>
        </div>

        {/* Tartalom: KÜLÖN, függőlegesen görgő konténer a fejléc alatt — sok teremnél/asztalnál
            ez görgethető belül, nem az egész oldal nő meg alá. */}
        <div className="max-h-[65vh] overflow-y-auto">
        <div className="flex">
        {/* Bal: rögzített (SOSEM vízszintesen görgetett) asztal-oszlop — külön fa, nem a görgő
            gyereke, így nem függ a position:sticky viselkedésétől semmilyen böngészőben. */}
        <div className={`${labelW} shrink-0`}>
          {groups.map((g, gi) => (
            <div key={`label-${gi}-${g.name ?? 'none'}`}>
              {gi > 0 && g.name && (
                <div className="flex items-center gap-[9px] pt-1.5 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">
                    {g.name}
                  </span>
                  <span className="rounded-[10px] bg-[#EDE7D6] px-[9px] py-[3px] text-[10px] font-semibold text-[#9A8B52]">
                    {roomPillLabel(g.room)}
                  </span>
                </div>
              )}
              {g.tables.map((t) => {
                const isNoTable = t.id === NO_TABLE_ID
                const isDropTarget = !isNoTable && drag && String(drag.tableId) === String(t.id)
                const dragging = !!drag
                const tooSmall = !isNoTable && dragging && t.capacity < (drag?.r.pax ?? 0)
                return (
                  <div
                    key={t.id}
                    className={`h-[64px] flex flex-col justify-center border-t border-line py-2 pr-2 transition-colors ${
                      isDropTarget
                        ? tooSmall
                          ? 'bg-red-500/[0.10]'
                          : 'bg-gold/[0.16]'
                        : dragging && tooSmall
                          ? 'opacity-45'
                          : 'hover:bg-[var(--dav-glass)]'
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink truncate leading-tight">{t.name}</span>
                    {!isNoTable && (
                      <span className={`text-[11px] tabular-nums leading-tight ${tooSmall ? 'font-semibold text-red-500' : 'text-[#A8A496]'}`}>{t.capacity} fő</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Jobb: görgethető idő-tengely + foglalás-blokkok. */}
        <div ref={gridRef} onScroll={onGridScroll} className={`min-w-0 flex-1 ${fit ? '' : 'overflow-x-auto'}`}>
        <div style={fit ? undefined : { width: axisWidth }}>

        {groups.map((g, gi) => (
          <div key={`${gi}-${g.name ?? 'none'}`}>
            {/* Láthatatlan, de a valódi csoport-fejléccel AZONOS felépítésű foglaló — a magasságuknak
                pontosan egyeznie kell a bal (rögzített) oszloppal, különben a sorok szétcsúsznak.
                Az ELSŐ termet kihagyjuk: annak címe már a fejléc-sorban (a vonalzóval egy vonalban) van. */}
            {gi > 0 && g.name && (
              <div className="invisible flex items-center gap-[9px] pt-1.5 pb-1.5" aria-hidden="true">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{g.name}</span>
                <span className="rounded-[10px] px-[9px] py-[3px] text-[10px] font-semibold">{roomPillLabel(g.room)}</span>
              </div>
            )}
            {g.tables.map((t) => {
              const isNoTable = t.id === NO_TABLE_ID
              const rows = isNoTable
                ? active.filter((r) => tableIdsOf(r).length === 0)
                : active.filter((r) => tableIdsOf(r).includes(String(t.id)))
              // Üres idősávok (a foglalások előtti/közti/utáni szabad rések) — Crextio
              // szaggatott hatch-pillekkel jelölve, mint a mobil nézetben. A foglalás-blokkok
              // ezek FÖLÉ rendelődnek; a <15 perces réseket kihagyjuk (nem jelölünk pici sávot).
              // A "Nincs asztalhoz rendelve" sáv is megkapja, hogy a többi sorral vizuálisan
              // egységes maradjon (nem "üres asztal" itt, hanem "nincs itt senki ebben az idősávban").
              const sortedRows = [...rows].sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
              const freeGaps: Array<[number, number]> = []
              {
                let gapCursor = openMin
                for (const r of sortedRows) {
                  const gs = hhmmToMinutes(r.start_time)
                  const ge = hhmmToMinutes(r.end_time)
                  if (gs - gapCursor >= 15) freeGaps.push([gapCursor, gs])
                  gapCursor = Math.max(gapCursor, ge)
                }
                // A rács jobb szélééig (openMin+totalMin) ér, NEM csak a záróráig — így ha egy másik
                // asztalnál van záróra utáni foglalás, ennek az asztalnak az üres sávja is ugyanaddig
                // fut, nem áll meg korábban (ld. dayEnd a TimelineView-ban).
                const rightEdge = openMin + totalMin
                if (rightEdge - gapCursor >= 15) freeGaps.push([gapCursor, rightEdge])
              }
              const isDropTarget = !isNoTable && drag && String(drag.tableId) === String(t.id)
              // Húzás közben: az az asztal, ami önmagában kisebb a húzott foglalás létszámánál,
              // piros/halvány (ejtéskor a szerver a szomszédokkal próbálja összevonni).
              const dragging = !!drag
              const tooSmall = !isNoTable && dragging && t.capacity < (drag?.r.pax ?? 0)
              return (
                <div
                  key={t.id}
                  data-axis-table={t.id}
                  // Az üres sáv NEM kattintható (nem hoz létre foglalást) — csak drop-cél marad,
                  // ide húzható meglévő foglalás. Új foglalás a fejléc „Új foglalás" gombjából.
                  className={`relative h-[64px] border-t border-line transition-colors ${
                    isDropTarget
                      ? tooSmall
                        ? 'bg-red-500/[0.10] ring-1 ring-inset ring-red-400/70'
                        : 'bg-gold/[0.16]'
                      : dragging && tooSmall
                        ? 'opacity-45'
                        : 'hover:bg-[var(--dav-glass)]'
                  }`}
                >
                    {hourMarks.map((m) => (
                      <span
                        key={m}
                        className="absolute inset-y-0 w-px bg-[rgba(120,110,70,.09)]"
                        style={{ left: left(m) }}
                      />
                    ))}
                    {/* Üres rések — szaggatott hatch-pillek (húzáskor elrejtve, hogy ne takarják a drop-highlightot);
                        zárva napon a Naptár "Zárva" piros mintázatát kapják a sima kréme hatch helyett. */}
                    {!dragging && freeGaps.map(([gs, ge], i) => (
                      <span
                        key={`gap-${i}`}
                        aria-hidden
                        className="pointer-events-none absolute top-[7px] bottom-[7px] rounded-[11px] border"
                        style={{
                          left: `calc(${left(gs)} + 2px)`,
                          width: `calc(${span(ge - gs)} - 4px)`,
                          background: isClosedToday ? CLOSED_HATCH : 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)',
                          borderColor: isClosedToday ? CLOSED_BORDER : 'rgba(120,110,70,.10)',
                        }}
                      />
                    ))}
                    {nowVisible && (
                      <span
                        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-red-500/80"
                        style={{ left: left(nowMin!) }}
                      />
                    )}
                    {groupOverlaps(rows).map((item) => {
                      if (Array.isArray(item)) {
                        return <TableGridStack key={cellKey(item)} pair={item} left={left} span={span} renderContent={renderBlock} />
                      }
                      return renderBlock(item)
                    })}
                    {/* Zárás utáni sraffozott (zárva) rész a track végén */}
                    {closeMin < openMin + totalMin && (
                      <span
                        className="pointer-events-none absolute inset-y-0 right-0 border-l-[1.5px] border-dashed border-[rgba(150,140,100,.4)] bg-[repeating-linear-gradient(115deg,rgba(190,180,140,.16)_0_5px,transparent_5px_10px)]"
                        style={{ left: left(closeMin) }}
                      />
                    )}
                </div>
              )
            })}
          </div>
        ))}
        </div>
        </div>
        </div>
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

  // A lemondott foglalás az idősávban (ACTIVE) mostantól látszik, de a Terem-nézet ÉLŐ
  // asztal-foglaltságot mutat — az nem "foglalt" egy törölt lemondás miatt, ezért itt kizárjuk.
  const active = reservations.filter((r) => ACTIVE.has(r.status) && r.status !== 'cancelled')
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
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#E2872E' }} /> Hamarosan</span>
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
      tone = { card: 'border-gold/60 bg-gold/[0.14]', badge: 'bg-gold/25 text-[#8a6d1e]', dot: 'bg-gold', pulse: true, label: 'Függő' }
      sub = late
        ? <span className="font-semibold text-[#C0564A]">késik {lateMin}p · nincs megerősítve</span>
        : <span className="text-ink-soft">megerősítésre vár · {occ.start_time}</span>
    } else if (occ.status === 'confirmed' && lateMin >= LATE) {
      // Megerősítve, de a foglalás ideje óta nem ült le → késik.
      tone = { card: 'border-[#C0564A]/55 bg-[#C0564A]/[0.12]', badge: 'bg-[#C0564A]/15 text-[#C0564A]', dot: 'bg-[#C0564A]', pulse: true, label: 'Késik' }
      sub = <span className="font-semibold text-[#C0564A]">{lateMin} perce késik</span>
      progress = 'seated'
    } else {
      const finishing = remaining <= FINISHING
      tone = finishing
        ? { card: 'border-[#E2872E]/60 bg-[#E2872E]/[0.14]', badge: 'bg-[#E2872E]/25 text-[#8a6d1e]', dot: 'bg-[#E2872E]', pulse: true, label: 'Mindjárt szabadul' }
        : { card: 'border-[#1D9D63]/55 bg-[#1D9D63]/[0.14]', badge: 'bg-[#1D9D63]/18 text-[#177f4f]', dot: 'bg-[#1D9D63]', pulse: false, label: 'Leültetve' }
      sub = (
        <span className={finishing ? 'font-semibold text-[#8a6d1e]' : 'text-ink-soft'}>
          még <span className="tabular-nums">{remaining}p</span> · <span className="tabular-nums">{occ.end_time}</span>-ig
        </span>
      )
      progress = finishing ? 'finishing' : 'seated'
    }
  } else if (soon) {
    tone = { card: 'border-[#E2872E]/60 bg-[#E2872E]/[0.14]', badge: 'bg-[#E2872E]/25 text-[#8a6d1e]', dot: 'bg-[#E2872E]', pulse: true, label: 'Hamarosan' }
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
  // Alkalom (pl. szülinap) + sorozat jelvény — a jelenleg ülő VAGY a hamarosan érkező foglalásé.
  const occasionOf = occ ?? soon?.r ?? null

  const barBg = progress === 'finishing' ? 'bg-[#E2872E]/20' : 'bg-[#1D9D63]/15'
  const barFg = progress === 'finishing' ? 'bg-[#E2872E]' : 'bg-[#1D9D63]'

  const Wrap: React.ElementType = onClick ? 'button' : 'div'
  return (
    <Wrap
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      title={title}
      className={`relative block w-full rounded-[18px] border p-4 text-left transition-all ${tone.card} ${onClick ? 'cursor-pointer hover:shadow-dav-card' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <TableGlyph capacity={t.capacity} />
        <div className="flex shrink-0 items-center gap-1.5">
          {occasionOf?.occasion && (() => {
            const OccIcon = eventIconByKey(occasionOf.occasion_icon)
            return (
              <span title={occasionOf.occasion} className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-gold text-ink-dark ring-1 ring-black/10">
                <OccIcon className="h-2.5 w-2.5" strokeWidth={2.4} />
              </span>
            )
          })()}
          {occasionOf?.series_id && (
            <span title="Ismétlődő sorozat" className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-[#F0E7CF] text-[#9A7B12] ring-1 ring-black/5">
              <Repeat className="h-2.5 w-2.5" strokeWidth={2.4} />
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} ${tone.pulse ? 'animate-soft-pulse' : ''}`} />
            {tone.label}
          </span>
        </div>
      </div>
      <div className="mt-3 truncate text-[20px] font-semibold tracking-[-0.01em] text-ink">{t.name}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
        <Users className="h-3 w-3" /> <span className="tabular-nums">{t.capacity} fő</span>
      </div>
      <div className="mt-1.5 truncate text-[12px]">{primary}</div>
      {occasionOf?.occasion && (
        <div className="mt-0.5 truncate text-[11px] font-medium text-[#9A7B12]">{occasionOf.occasion}</div>
      )}
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
