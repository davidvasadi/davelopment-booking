import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { ReservationDateFilter, type BookingsRange } from '@/components/restaurant/ReservationDateFilter'
import { DailyView } from '@/components/restaurant/DailyView'
import { RestaurantScheduleView } from '@/components/restaurant/RestaurantScheduleView'
import { PrintDayButton } from '@/components/restaurant/PrintDayButton'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import { hhmmToMinutes, getDayName } from '@/lib/utils'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import { parseISO } from 'date-fns'
import type { Reservation, Table, Room, OpeningHour, OpeningHoursException } from '@/payload/payload-types'

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A `dateStr`-t tartalmazó hét hétfője (Date objektumként, hogy tovább számolható legyen). */
function mondayOf(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7 // hétfő = 0
  dt.setDate(dt.getDate() - dow)
  return dt
}

/** A `dateStr`-t tartalmazó hónap összes napja `YYYY-MM-DD` tömbként. */
function daysOfMonth(dateStr: string): string[] {
  const [y, m] = dateStr.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => ymd(new Date(y, m - 1, i + 1)))
}

// Nélküle Next.js gyorsítótárazhatja ezt az oldalt — a "ma" alapértelmezett dátum a
// legutóbbi renderelés napján ragadhat, akkor is ha időközben elmúlt éjfél.
export const dynamic = 'force-dynamic'

export default async function RestaurantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; reservation?: string; range?: string }>
}) {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['bookings.view', 'bookings.manage'], '/restaurant')
  const { date, reservation: reservationParam, range: rawRange } = await searchParams
  const range: BookingsRange = rawRange === 'week' ? 'week' : rawRange === 'month' ? 'month' : 'day'

  const payload = await getPayloadClient()

  // Értesítésből érkezve (?reservation=) a foglalás napjára ugrunk, hogy a sheet
  // a megfelelő nézetben nyíljon ki — a kliens a query alapján nyitja meg.
  let selectedDate = date ?? ymd(new Date())
  if (!date && reservationParam) {
    const r = await payload
      .findByID({ collection: 'reservations', id: reservationParam, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (r?.date) selectedDate = r.date
  }

  const turnMinutes = restaurant.turn_duration_minutes ?? 120
  const canManage = can(capabilities, 'bookings.manage')
  const dateFilterEl = (
    <ReservationDateFilter key="date-filter" currentDate={selectedDate} range={range} hideRangeOnMobile />
  )

  // Zárva-napok (heti/havi nézethez) — ugyanaz a két lekérdezés, mint a Naptár oldalon
  // (restaurant/schedule/page.tsx): egyszeri kivétel-zárás (dátum-tartomány!) + heti visszatérő
  // zárvatartás.
  const [closedExceptionsRes, closedWeeklyRes] = await Promise.all([
    payload.find({
      collection: 'opening-hours-exceptions',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { is_closed: { equals: true } }] },
      depth: 0, limit: 500, overrideAccess: true,
    }),
    payload.find({
      collection: 'opening-hours',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { is_open: { equals: false } }] },
      depth: 0, limit: 20, overrideAccess: true,
    }),
  ])
  const closedDates: string[] = (closedExceptionsRes.docs as OpeningHoursException[]).flatMap((e) => {
    const dates: string[] = []
    const cur = new Date(e.start_date)
    const end = new Date(e.end_date)
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  })
  const DOW_NUM: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const closedWeekdays = Array.from(new Set((closedWeeklyRes.docs as { day_of_week?: string | null }[]).map((e) => DOW_NUM[e.day_of_week ?? '']).filter((n): n is number => n != null)))

  // Esemény-típusok az admin szerkesztő-laphoz (a tulaj engedélyezettjei, vagy az alapkészlet).
  const enabledEvents = ((restaurant as { event_types?: { icon?: string | null; label?: string | null; enabled?: boolean | null }[] | null }).event_types ?? [])
    .filter((e) => e?.enabled !== false && e?.label)
    .map((e) => ({ icon: e.icon ?? 'party', label: e.label as string }))
  const eventTypes = enabledEvents.length > 0 ? enabledEvents : DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label }))

  if (range === 'day') {
    // ── NAPI nézet (változatlan viselkedés) ──
    const ohResult = await payload.find({
      collection: 'opening-hours',
      where: {
        and: [
          { restaurant: { equals: restaurant.id } },
          { day_of_week: { equals: getDayName(parseISO(selectedDate)) } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const oh = ohResult.docs[0] as OpeningHour | undefined
    const openMin = oh?.is_open && oh.open_time ? hhmmToMinutes(oh.open_time) : 11 * 60
    let closeMin = oh?.is_open && oh.close_time ? hhmmToMinutes(oh.close_time) : 23 * 60
    if (closeMin <= openMin) closeMin += 24 * 60

    const [resResult, roomsResult, tablesResult] = await Promise.all([
      payload.find({
        collection: 'reservations',
        where: { and: [{ restaurant: { equals: restaurant.id } }, { date: { equals: selectedDate } }] },
        sort: 'start_time',
        limit: 300,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'rooms',
        where: { restaurant: { equals: restaurant.id } },
        limit: 100,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'tables',
        where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { not_equals: false } }] },
        limit: 500,
        depth: 1,
        overrideAccess: true,
      }),
    ])

    const reservations = resResult.docs as Reservation[]
    const rooms = roomsResult.docs as Room[]
    const tables = tablesResult.docs as Table[]

    // ── Napi gyorskártyák ──────────────────────────────────────────
    const activeCount = reservations.filter(
      (r) => r.status !== 'cancelled' && r.status !== 'no_show',
    ).length
    const cancelledCount = reservations.filter(
      (r) => r.status === 'cancelled' || r.status === 'no_show',
    ).length
    const completedCount = reservations.filter((r) => r.status === 'completed').length
    const walkInCount = reservations.filter((r) => r.source === 'walk_in').length

    const roomCount = rooms.length
    const tableCount = tables.length

    const isClosedToday = closedDates.includes(selectedDate) || (selectedDate >= ymd(new Date()) && closedWeekdays.includes(parseISO(selectedDate).getDay()))

    return (
      <div className="p-5 lg:p-0 space-y-5">
        <DailyView
          date={selectedDate}
          range={range}
          restaurantId={String(restaurant.id)}
          eventTypes={eventTypes}
          reservations={reservations}
          rooms={rooms}
          tables={tables}
          openMin={openMin}
          closeMin={closeMin}
          turnMinutes={turnMinutes}
          openReservationId={reservationParam}
          roomCount={roomCount}
          tableCount={tableCount}
          activeCount={activeCount}
          completedCount={completedCount}
          cancelledCount={cancelledCount}
          walkInCount={walkInCount}
          dateFilter={dateFilterEl}
          printButton={
            <PrintDayButton
              key="print-btn"
              days={[selectedDate]}
              restaurantName={restaurant.name}
              reservations={reservations}
            />
          }
          canManage={canManage}
          consentEnabled={!!restaurant.consent_settings?.enabled}
          isClosedToday={isClosedToday}
        />
        <WaitlistPanel restaurantId={restaurant.id} />
      </div>
    )
  }

  // ── HETI / HAVI nézet: közös RestaurantScheduleView, csak a `days` tartomány más. ──
  const days = range === 'week' ? Array.from({ length: 7 }, (_, i) => {
    const d = mondayOf(selectedDate)
    d.setDate(d.getDate() + i)
    return ymd(d)
  }) : daysOfMonth(selectedDate)
  const rangeStart = days[0]
  const rangeEnd = days[days.length - 1]

  // Nyitvatartás (a nap neve alapján) — a tartomány első napjának szabálya ésszerű alapérték.
  const ohResult = await payload.find({
    collection: 'opening-hours',
    where: {
      and: [
        { restaurant: { equals: restaurant.id } },
        { day_of_week: { equals: getDayName(parseISO(selectedDate)) } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const oh = ohResult.docs[0] as OpeningHour | undefined
  const baseOpenMin = oh?.is_open && oh.open_time ? hhmmToMinutes(oh.open_time) : 11 * 60
  let baseCloseMin = oh?.is_open && oh.close_time ? hhmmToMinutes(oh.close_time) : 23 * 60
  if (baseCloseMin <= baseOpenMin) baseCloseMin += 24 * 60

  const [resResult, roomsResult] = await Promise.all([
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurant.id } },
          { date: { greater_than_equal: rangeStart } },
          { date: { less_than_equal: rangeEnd } },
        ],
      },
      sort: 'start_time',
      limit: range === 'month' ? 5000 : 2000,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'rooms',
      where: { restaurant: { equals: restaurant.id } },
      limit: 100,
      overrideAccess: true,
    }),
  ])
  const reservations = resResult.docs as Reservation[]
  const rooms = roomsResult.docs as Room[]

  // Idő-tengely: a nyitvatartás-alapérték kiszélesítve a tartomány összes foglalására, hogy
  // egy se essen a tengelyen kívülre (ugyanaz a minta, mint a napi nézetnél).
  let rangeOpenMin = baseOpenMin
  let rangeCloseMin = baseCloseMin
  for (const r of reservations) {
    if (r.status === 'cancelled') continue
    rangeOpenMin = Math.min(rangeOpenMin, hhmmToMinutes(r.start_time))
    rangeCloseMin = Math.max(rangeCloseMin, hhmmToMinutes(r.end_time))
  }
  rangeOpenMin = Math.floor(rangeOpenMin / 60) * 60
  rangeCloseMin = Math.ceil(rangeCloseMin / 60) * 60

  return (
    <div className="p-5 lg:p-0 space-y-5">
      <RestaurantScheduleView
        days={days}
        range={range}
        date={selectedDate}
        title="Asztalfoglalások"
        subtitle={range === 'week' ? 'Heti áttekintés' : 'Havi áttekintés'}
        restaurantId={String(restaurant.id)}
        reservations={reservations}
        rooms={rooms}
        eventTypes={eventTypes}
        openMin={rangeOpenMin}
        closeMin={rangeCloseMin}
        turnMinutes={turnMinutes}
        closedDates={closedDates}
        closedWeekdays={closedWeekdays}
        dateFilter={dateFilterEl}
        printButton={
          <PrintDayButton key="print-btn" days={days} restaurantName={restaurant.name} reservations={reservations} />
        }
        canManage={canManage}
      />
      <WaitlistPanel restaurantId={restaurant.id} />
    </div>
  )
}
