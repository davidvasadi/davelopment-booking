import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { ReservationDateFilter } from '@/components/restaurant/ReservationDateFilter'
import { ReservationActions } from '@/components/restaurant/ReservationActions'
import type { Reservation, Table } from '@/payload/payload-types'

const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár',
  confirmed: 'Megerősítve',
  seated: 'Leültetve',
  completed: 'Befejezett',
  no_show: 'Nem jött meg',
  cancelled: 'Lemondva',
}

const statusDot: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-500',
  seated: 'bg-blue-500',
  completed: 'bg-zinc-400',
  no_show: 'bg-red-400',
  cancelled: 'bg-red-500',
}

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
  const result = await payload.find({
    collection: 'reservations',
    where: {
      and: [{ restaurant: { equals: restaurant.id } }, { date: { equals: selectedDate } }],
    },
    sort: 'start_time',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })
  const reservations = result.docs as Reservation[]

  const totalPax = reservations
    .filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
    .reduce((sum, r) => sum + (r.pax ?? 0), 0)

  const cardClass =
    'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

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

      {reservations.length === 0 ? (
        <div className={`${cardClass} p-12 text-center`}>
          <p className="text-zinc-500 dark:text-zinc-400">Erre a napra nincs foglalás.</p>
        </div>
      ) : (
        <div className={`${cardClass} divide-y divide-zinc-100 dark:divide-white/[0.06]`}>
          {reservations.map((r) => {
            const table = typeof r.table === 'object' ? (r.table as Table | null) : null
            return (
              <div key={r.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-16 shrink-0">
                  <div className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">
                    {r.start_time}
                  </div>
                  <div className="text-xs text-zinc-400">{r.end_time}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white truncate">
                    {r.customer_name}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                    {r.pax} fő
                    {table ? ` · ${table.name} asztal` : ''}
                    {r.customer_phone ? ` · ${r.customer_phone}` : ''}
                  </div>
                  {r.notes && (
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                      „{r.notes}”
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`h-2 w-2 rounded-full ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                  <span className="hidden sm:block text-xs text-zinc-500 dark:text-white/40 w-28">
                    {statusLabel[r.status] ?? r.status}
                  </span>
                  <ReservationActions reservationId={r.id} status={r.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
