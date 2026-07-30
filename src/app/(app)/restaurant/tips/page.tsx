import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { getPayloadClient } from '@/lib/payload'
import { buildRestaurantAdvisor, type SetupFlags } from '@/lib/tipsAdvisor'
import { TipsAdvisorView } from '@/components/dashboard/TipsAdvisorView'
import type { Restaurant } from '@/payload/payload-types'

export const metadata = { title: 'Tippek' }

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function RestaurantTipsPage() {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireCapability(capabilities, 'tips.view', '/restaurant')
  const r = restaurant as Restaurant
  const payload = await getPayloadClient()

  const todayStr = ymd(new Date())
  const in14 = new Date()
  in14.setDate(in14.getDate() + 14)
  const in14Str = ymd(in14)

  const [stats, hoursRes, tablesRes, shiftsAheadRes, pendingReservRes] = await Promise.all([
    getRestaurantStats(r.id, 30),
    payload.find({
      collection: 'opening-hours',
      where: { and: [{ restaurant: { equals: r.id } }, { is_open: { equals: true } }] },
      limit: 1, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: r.id } }, { is_active: { equals: true } }] },
      limit: 1, depth: 0, overrideAccess: true,
    }),
    // Csak schedule.manage joggal rendelkezőknek
    can(capabilities, 'schedule.manage')
      ? payload.find({
          collection: 'shifts',
          where: { and: [{ restaurant: { equals: r.id } }, { date: { greater_than_equal: todayStr } }, { date: { less_than_equal: in14Str } }] },
          limit: 1, depth: 0, overrideAccess: true,
        })
      : null,
    // Csak bookings.manage joggal rendelkezőknek
    can(capabilities, 'bookings.manage')
      ? payload.find({
          collection: 'reservations',
          where: { and: [{ restaurant: { equals: r.id } }, { status: { equals: 'pending' } }] },
          limit: 1, depth: 0, overrideAccess: true,
        })
      : null,
  ])

  const setup: SetupFlags = {
    openingHours: hoursRes.totalDocs > 0,
    catalog: tablesRes.totalDocs > 0,
    scheduleFilledAhead: shiftsAheadRes ? shiftsAheadRes.totalDocs > 0 : undefined,
    hasPendingBookings: pendingReservRes ? pendingReservRes.totalDocs > 0 : undefined,
  }

  const data = buildRestaurantAdvisor(r, setup, stats, capabilities)

  return <TipsAdvisorView variant="restaurant" data={data} apiBase={`/api/restaurants/${r.id}`} />
}
