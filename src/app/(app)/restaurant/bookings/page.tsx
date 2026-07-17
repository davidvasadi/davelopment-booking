import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { ReservationDateFilter } from '@/components/restaurant/ReservationDateFilter'
import { DailyView } from '@/components/restaurant/DailyView'
import { PrintDayButton } from '@/components/restaurant/PrintDayButton'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import { hhmmToMinutes, getDayName } from '@/lib/utils'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import { parseISO } from 'date-fns'
import type { Reservation, Table, Room, OpeningHour } from '@/payload/payload-types'

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function RestaurantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; reservation?: string }>
}) {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireCapability(capabilities, 'bookings.view', '/restaurant')
  const { date, reservation: reservationParam } = await searchParams

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

  const [resResult, roomsResult, tablesResult, ohResult] = await Promise.all([
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
    payload.find({
      collection: 'opening-hours',
      where: {
        and: [
          { restaurant: { equals: restaurant.id } },
          { day_of_week: { equals: getDayName(parseISO(selectedDate)) } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    }),
  ])

  const reservations = resResult.docs as Reservation[]
  const rooms = roomsResult.docs as Room[]
  const tables = tablesResult.docs as Table[]
  const oh = ohResult.docs[0] as OpeningHour | undefined

  // Nyitvatartás a timeline tengelyhez; ha zárva/nincs, ésszerű alapérték
  const openMin = oh?.is_open && oh.open_time ? hhmmToMinutes(oh.open_time) : 11 * 60
  const closeMin = oh?.is_open && oh.close_time ? hhmmToMinutes(oh.close_time) : 23 * 60

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

  // Esemény-típusok az admin szerkesztő-laphoz (a tulaj engedélyezettjei, vagy az alapkészlet).
  const enabledEvents = ((restaurant as { event_types?: { icon?: string | null; label?: string | null; enabled?: boolean | null }[] | null }).event_types ?? [])
    .filter((e) => e?.enabled !== false && e?.label)
    .map((e) => ({ icon: e.icon ?? 'party', label: e.label as string }))
  const eventTypes = enabledEvents.length > 0 ? enabledEvents : DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label }))

  return (
    <div className="p-5 lg:p-0 space-y-5">
      <DailyView
        date={selectedDate}
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
        dateFilter={<ReservationDateFilter currentDate={selectedDate} />}
        printButton={
          <PrintDayButton
            date={selectedDate}
            restaurantName={restaurant.name}
            reservations={reservations}
          />
        }
      />
      <WaitlistPanel restaurantId={restaurant.id} />
    </div>
  )
}
