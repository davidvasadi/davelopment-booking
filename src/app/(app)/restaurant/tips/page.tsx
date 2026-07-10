import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { getPayloadClient } from '@/lib/payload'
import { buildRestaurantAdvisor, type SetupFlags } from '@/lib/tipsAdvisor'
import { TipsAdvisorView } from '@/components/dashboard/TipsAdvisorView'
import type { Restaurant } from '@/payload/payload-types'

export const metadata = { title: 'Tippek' }

export default async function RestaurantTipsPage() {
  const { restaurant } = await getOwnedRestaurant()
  const r = restaurant as Restaurant
  const payload = await getPayloadClient()

  const [stats, hoursRes, tablesRes] = await Promise.all([
    getRestaurantStats(r.id, 30),
    payload.find({
      collection: 'opening-hours',
      where: { and: [{ restaurant: { equals: r.id } }, { is_open: { equals: true } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: r.id } }, { is_active: { equals: true } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const setup: SetupFlags = { openingHours: hoursRes.totalDocs > 0, catalog: tablesRes.totalDocs > 0 }
  const data = buildRestaurantAdvisor(r, setup, stats)

  return <TipsAdvisorView variant="restaurant" data={data} apiBase={`/api/restaurants/${r.id}`} />
}
