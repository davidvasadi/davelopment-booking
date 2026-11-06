'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Cake, CalendarDays, Users } from 'lucide-react'
import { ymdLocal } from '@/lib/utils'
import { ReservationEditSheet, type EditTarget } from './ReservationEditSheet'
import { ACTIVE, draftToReservation } from './DailyView'
import { BookingsHead, EMPTY_FILTER, applyBookingFilter, type BookingFilter } from '@/components/shared/BookingsHead'
import { segments } from '@/components/dashboard/OverviewLayout'
import { IconCircle, Kpi } from '@/components/ui-kit'
import { MonthGrid, RoomWeekCell, WeekGrid } from '@/components/shared/RangeGrids'
import { idOf } from '@/components/dashboard/SalonDailyView'
import type { BookingsRange } from '@/components/shared/BookingsDateNav'
import { getDrafts, subscribeDrafts, type ReservationDraft } from '@/lib/offlineDrafts'
import type { Reservation, Room, Table } from '@/payload/payload-types'

/** JS natív `getDay()` (0=vasárnap..6=szombat) — ez a `closedWeekdays` kódolása, nem a
 *  hétfő-first `weekdayIndex`. */
function jsDow(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Egy foglalás terem-kulcsa: az első asztalához tartozó terem id-je, vagy `'none'`, ha nincs
 *  terembe sorolt asztala (ugyanaz a "Egyéb" bucket-minta, mint a napi TimelineGroup-nál). */
function roomKeyOf(r: Reservation): string {
  const t = r.tables?.[0]
  if (!t || typeof t !== 'object') return 'none'
  const room = (t as Table).room
  if (!room) return 'none'
  return typeof room === 'object' ? String(room.id) : String(room)
}

export interface RestaurantScheduleViewProps {
  /** A megjelenítendő napok (`YYYY-MM-DD`), tetszőleges hosszban — heti nézetnél 7, havinál a
   *  hónap összes napja. */
  days: string[]
  /** A jelenlegi időszak-nézet (heti/havi) — a mobil fejléc-ikon nézet-választó sheet-jéhez kell. */
  range: BookingsRange
  /** A DateFilter query-paraméterében szereplő aktuális dátum — a Nap/Hét/Hónap váltásnál ez
   *  marad a cél-dátum. */
  date: string
  restaurantId: string
  /** A `days` tartományra eső foglalások (a page.tsx tartomány-lekérdezéséből). */
  reservations: Reservation[]
  rooms: Room[]
  /** az aktív asztalok (a termek ülőhelyei — a telítettséghez) */
  tables?: Table[]
  eventTypes?: { icon: string; label: string }[]
  openMin: number
  closeMin: number
  turnMinutes: number
  /** Egyszeri kivétel-zárás dátumai (`YYYY-MM-DD`) — ugyanaz a forrás, mint a Naptár oldalon. */
  closedDates?: string[]
  /** Heti visszatérő zárvatartás napjai (0=vasárnap..6=szombat) — ugyanaz a forrás, mint a
   *  Naptár oldalon; csak a mai naptól előre érvényes (ld. isClosedDay). */
  closedWeekdays?: number[]
  dateFilter: React.ReactNode
  printButton?: React.ReactNode
  canManage?: boolean
}

/**
 * Megosztott ütemterv-nézet a Heti ÉS Havi áttekintéshez. Desktop: a szalon rácsával azonos
 * szerkezet — bal tengelyen a `days` napjai, fejlécben viszont TEREM-oszlopok (a napi
 * Terem-nézet `TimelineGroup`-jaihoz hasonlóan), óránkénti bontás nélkül, "+N" kinyitható
 * verem naponta. 4-nél több teremnél, és mobilon (ahol nem fér el egy több-oszlopos rács) egy
 * egy-oszlopos, a napi mobil idővonallal (MobileTimeline/HourList) azonos mechanikájú lista fut.
 */
export function RestaurantScheduleView({
  days, range, date, restaurantId, reservations: unfiltered, rooms, tables = [], eventTypes = [], openMin, closeMin, turnMinutes, closedDates = [], closedWeekdays = [], dateFilter, printButton, canManage = false,
}: RestaurantScheduleViewProps) {
  const router = useRouter()
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<ReservationDraft[]>([])

  // Szűrés (a közös fejlécből) — a rács és a lista a szűrt időszakot mutatja; a csík és a számok a teljeset.
  const [filter, setFilter] = useState<BookingFilter>(EMPTY_FILTER)
  const reservations = useMemo(() => {
    const now = new Date()
    const nowKey = `${ymdLocal(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return applyBookingFilter(unfiltered, filter, (r) => (r.tables ?? []).map((t) => (typeof t === 'object' && t?.room ? idOf(t.room) : '')), (b) => b.status === 'confirmed' && `${String(b.date).slice(0, 10)} ${b.start_time}` < nowKey)
  }, [unfiltered, filter])


  const pickRange = (v: BookingsRange) => router.push(`/restaurant/bookings?date=${date}&range=${v}`)

  useEffect(() => {
    setDrafts(getDrafts(restaurantId))
    return subscribeDrafts(restaurantId, setDrafts)
  }, [restaurantId])

  const today = ymdLocal(new Date())
  // Zárva: egyszeri kivétel BÁRMIKOR, vagy heti visszatérő zárvatartás — de utóbbi csak a mai
  // naptól előre (ugyanaz a szabály, mint a Naptár hónap-rácsán).
  const isClosedDay = (day: string) => closedDates.includes(day) || (day >= today && closedWeekdays.includes(jsDow(day)))
  const daySet = useMemo(() => new Set(days), [days])

  const allReservations = useMemo(() => {
    const rangeDrafts = drafts.filter((d) => daySet.has(d.date)).map(draftToReservation)
    return [...reservations, ...rangeDrafts]
  }, [reservations, drafts, daySet])

  const active = useMemo(() => allReservations.filter((r) => ACTIVE.has(r.status)), [allReservations])

  // Terem-oszlopok: a beállított termek (sorrend szerint) + egy "Egyéb" oszlop, HA van
  // terembe nem sorolt asztalú foglalás.
  const columns = useMemo(() => {
    const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const cols = roomOrder.map((r) => ({ key: String(r.id), name: r.name }))
    const hasNoRoom = active.some((r) => roomKeyOf(r) === 'none')
    if (hasNoRoom) cols.push({ key: 'none', name: cols.length ? 'Egyéb' : 'Asztalok' })
    return cols
  }, [rooms, active])
  const tablesIn = (roomKey: string) => tables.filter((t) => (t.room ? idOf(t.room) : 'none') === roomKey)
  const seatsOf = (ts: Table[]) => ts.reduce((sum, t) => sum + (t.capacity ?? 0), 0)
  const totalSeats = seatsOf(tables)
  const stepMonth = (dir: -1 | 1) => { const [y, m] = date.split('-').map(Number); router.push(`/restaurant/bookings?date=${ymdLocal(new Date(y, m - 1 + dir, 1))}&range=month`) }




  const openCreate = () => {
    if (canManage) setTarget({ reservation: null })
  }
  const goToDay = (day: string) => router.push(`/restaurant/bookings?range=day&date=${day}`)

  // Mobilon az "Új foglalás" a fejléc csengő melletti ikonjából nyílik (DashboardNav
  // dispatch-eli) — ugyanaz az esemény, mint a napi nézetben.
  useEffect(() => {
    const handler = () => openCreate()
    window.addEventListener('davelopment:open-bookings-create', handler)
    return () => window.removeEventListener('davelopment:open-bookings-create', handler)
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="space-y-5">
      <BookingsHead
        dateNav={dateFilter}
        range={range}
        onRange={pickRange}
        date={date}
        onDate={(d) => router.push(`/restaurant/bookings?date=${d}&range=day`)}
        loadEndpoint="/api/restaurant/day-load"
        filter={filter}
        onFilter={setFilter}
        who={rooms.length > 1 ? rooms.map((rm) => ({ id: String(rm.id), label: rm.name })) : undefined}
        whoLabel="Terem"
        matchCount={reservations.length}
        exportButton={printButton}
        onCreate={canManage ? openCreate : undefined}
        bar={segments([
          { label: 'Megerősített', value: unfiltered.filter((r) => r.status === 'confirmed' || r.status === 'seated').length, tone: 'dark' },
          { label: 'Függő', value: unfiltered.filter((r) => r.status === 'pending').length, tone: 'yellow' },
          { label: 'Befejezett', value: unfiltered.filter((r) => r.status === 'completed').length, tone: 'white' },
          { label: 'Lemondva', value: unfiltered.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length, tone: 'outline' },
        ])}
        kpis={<>
          <Kpi icon={CalendarDays} value={String(unfiltered.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').length)} label="Foglalás" />
          <Kpi icon={Users} value={String(unfiltered.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').reduce((sum, r) => sum + (r.pax ?? 0), 0))} label="Vendég (fő)" />
        </>}
      />

      {range === 'week' ? (
        // Hét (design 6.16): sor = terem, oszlop = nap; a cellában a foglalások és a vendégek száma, az alkalmak; alul a napi vendégszám
        (() => {
          const live = active.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
          const inCell = (roomKey: string, day: string) => live.filter((r) => r.date === day && roomKeyOf(r) === roomKey)
          const paxOf = (list: Reservation[]) => list.reduce((sum, r) => sum + (r.pax ?? 0), 0)
          const perDay = days.map((d) => paxOf(live.filter((r) => r.date === d)))
          return (
            <WeekGrid
              days={days}
              today={today}
              closed={isClosedDay}
              onDay={goToDay}
              rooms
              rows={columns.map((c) => {
                const ts = tablesIn(c.key)
                return {
                  id: c.key,
                  label: <><span className="block text-ui-body text-ui-text">{c.name}</span>{ts.length > 0 && <span className="block text-ui-label text-ui-muted">{ts.length} asztal · {seatsOf(ts)} hely</span>}</>,
                  total: paxOf(live.filter((r) => roomKeyOf(r) === c.key)),
                }
              })}
              footer={{ label: 'Vendég / nap', values: perDay, total: perDay.reduce((x, y) => x + y, 0) }}
              cell={(roomKey, day) => {
                if (isClosedDay(day)) return null
                const list = inCell(roomKey, day)
                const seats = seatsOf(tablesIn(roomKey))
                return <RoomWeekCell count={list.length} pax={paxOf(list)} pct={seats ? Math.min(100, Math.round((paxOf(list) / seats) * 100)) : null} occasions={list.filter((r) => r.occasion).length} occIcon={<IconCircle tone="white" size="xs" icon={Cake} />} onOpen={() => goToDay(day)} />
              }}
            />
          )
        })()
      ) : (
        // Hónap (design 6.17): a napi vendégszám (fő); a napra kattintva a nap idővonala
        <MonthGrid
          month={date}
          today={today}
          unit="fő"
          closed={isClosedDay}
          onDay={goToDay}
          onStep={stepMonth}
          counts={Object.fromEntries(days.map((d) => [d, active.filter((r) => r.date === d && r.status !== 'cancelled' && r.status !== 'no_show').reduce((sum, r) => sum + (r.pax ?? 0), 0)]))}
          pct={totalSeats ? (d) => {
            const pax = active.filter((r) => r.date === d && r.status !== 'cancelled' && r.status !== 'no_show').reduce((sum, r) => sum + (r.pax ?? 0), 0)
            return Math.min(100, Math.round((pax / totalSeats) * 100))
          } : undefined}
        />
      )}

      <ReservationEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={days[0] ?? today}
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
