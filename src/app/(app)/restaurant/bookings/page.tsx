import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { ReservationDateFilter } from '@/components/restaurant/ReservationDateFilter'
import { DailyView } from '@/components/restaurant/DailyView'
import { hhmmToMinutes, getDayName } from '@/lib/utils'
import { parseISO } from 'date-fns'
import type { Reservation, Table, Room, OpeningHour } from '@/payload/payload-types'

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function RestaurantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { restaurant } = await getOwnedRestaurant()
  const { date } = await searchParams
  const selectedDate = date ?? ymd(new Date())

  const payload = await getPayloadClient()
  const capacityMode = (restaurant.capacity_mode ?? 'tables') as 'tables' | 'flat'
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

  const totalPax = reservations
    .filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
    .reduce((sum, r) => sum + (r.pax ?? 0), 0)

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">
            {reservations.length} foglalás · {totalPax} fő várható
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Foglalások</h1>
        </div>
        <ReservationDateFilter currentDate={selectedDate} />
      </div>

      <DailyView
        date={selectedDate}
        capacityMode={capacityMode}
        maxPax={restaurant.max_pax ?? 0}
        reservations={reservations}
        rooms={rooms}
        tables={tables}
        openMin={openMin}
        closeMin={closeMin}
        turnMinutes={turnMinutes}
      />
    </div>
  )
}
