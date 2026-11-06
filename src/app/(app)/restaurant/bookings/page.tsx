import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { BookingsDateNav, type BookingsRange } from '@/components/shared/BookingsDateNav'
import { DailyView } from '@/components/restaurant/DailyView'
import { RestaurantScheduleView } from '@/components/restaurant/RestaurantScheduleView'
import { BookingsMoreMenu } from '@/components/shared/BookingsMoreMenu'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import { hhmmToMinutes, getDayName } from '@/lib/utils'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import { parseISO } from 'date-fns'
import { APP_URL } from '@/lib/brand'
import { getClosedDays } from '@/lib/closedDays'
import type { Reservation, Table, Room, OpeningHour } from '@/payload/payload-types'

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
    <BookingsDateNav key="date-filter" base="/restaurant" currentDate={selectedDate} range={range} loadEndpoint="/api/restaurant/day-load" />
  )

  // Zárva-napok — ugyanaz a forrás, mint a Naptár oldalon és a dátumválasztón (lib/closedDays).
  const { closedDates, closedWeekdays } = await getClosedDays(payload, 'restaurant', restaurant.id)

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
        depth: 1, populate: { restaurants: { name: true } }, // sebesség: az étteremből csak a név
        overrideAccess: true,
      }),
      payload.find({
        collection: 'rooms',
        where: { restaurant: { equals: restaurant.id } },
        populate: { restaurants: { name: true } },
        limit: 100,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'tables',
        where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { not_equals: false } }] },
        limit: 500,
        depth: 1, populate: { restaurants: { name: true } },
        overrideAccess: true,
      }),
    ])

    const reservations = resResult.docs as Reservation[]
    // Üres napon (design 6.3) a következő foglalás — egy kattintással odaugrik.
    const nextRaw = reservations.some((r) => r.status !== 'cancelled' && r.status !== 'no_show') ? null : (await payload.find({
      collection: 'reservations',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { date: { greater_than: selectedDate } }, { status: { not_in: ['cancelled', 'no_show'] } }] },
      sort: ['date', 'start_time'], limit: 1, depth: 0, overrideAccess: true,
    })).docs[0] as Reservation | undefined
    const nextBooking = nextRaw ? { date: String(nextRaw.date).slice(0, 10), time: nextRaw.start_time, title: `${nextRaw.customer_name}, ${nextRaw.pax} fő` } : null
    const rooms = roomsResult.docs as Room[]
    const tables = tablesResult.docs as Table[]

    // ── Napi gyorskártyák ──────────────────────────────────────────
    const activeCount = reservations.filter(
      (r) => r.status !== 'cancelled' && r.status !== 'no_show',
    ).length
    const cancelledCount = reservations.filter(
      (r) => r.status === 'cancelled' || r.status === 'no_show',
    ).length


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
          activeCount={activeCount}
          cancelledCount={cancelledCount}
          dateFilter={dateFilterEl}
          printButton={
            <BookingsMoreMenu key="print-btn" days={[selectedDate]} />
          }
          canManage={canManage}
          consentEnabled={!!restaurant.consent_settings?.enabled}
          isClosedToday={isClosedToday}
          nextBooking={nextBooking}
          publicUrl={restaurant.slug ? `${APP_URL}/${restaurant.slug}` : null}
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

  const [resResult, roomsResult, tablesRangeResult] = await Promise.all([
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
      depth: 1, populate: { restaurants: { name: true } }, // sebesség: az étteremből csak a név
      overrideAccess: true,
    }),
    payload.find({
      collection: 'rooms',
      where: { restaurant: { equals: restaurant.id } },
      populate: { restaurants: { name: true } },
      limit: 100,
      overrideAccess: true,
    }),
    // a heti / havi telítettséghez (design 6.16 / 6.17): a termek ülőhelyei
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { not_equals: false } }] },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
  ])
  const reservations = resResult.docs as Reservation[]
  const rooms = roomsResult.docs as Room[]
  const rangeTables = tablesRangeResult.docs as Table[]

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
        restaurantId={String(restaurant.id)}
        reservations={reservations}
        rooms={rooms}
        tables={rangeTables}
        eventTypes={eventTypes}
        openMin={rangeOpenMin}
        closeMin={rangeCloseMin}
        turnMinutes={turnMinutes}
        closedDates={closedDates}
        closedWeekdays={closedWeekdays}
        dateFilter={dateFilterEl}
        printButton={
          <BookingsMoreMenu key="print-btn" days={days} />
        }
        canManage={canManage}
      />
      <WaitlistPanel restaurantId={restaurant.id} />
    </div>
  )
}
