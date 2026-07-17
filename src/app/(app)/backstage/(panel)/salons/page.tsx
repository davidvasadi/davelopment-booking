import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, Restaurant, User } from '@/payload/payload-types'
import { BackstageHeader } from '@/components/backstage/BackstageUi'
import PlacesClient, { type PlaceRow } from './PlacesClient'

export const dynamic = 'force-dynamic'

export default async function BackstagePlacesPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  // Mindkét üzlet-típus: szalon (bookings) ÉS étterem (reservations).
  const [salonsResult, restaurantsResult] = await Promise.all([
    payload.find({ collection: 'salons', sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true }),
  ])

  const salonDocs = salonsResult.docs as Salon[]
  const restaurantDocs = restaurantsResult.docs as Restaurant[]

  // Foglalás-számok a megfelelő collectionből (szalon → bookings, étterem → reservations).
  const [salonCounts, restaurantCounts] = await Promise.all([
    Promise.all(salonDocs.map(async (s) => {
      const r = await payload.find({ collection: 'bookings', where: { salon: { equals: s.id } }, limit: 0, overrideAccess: true })
      return [s.id, r.totalDocs] as const
    })),
    Promise.all(restaurantDocs.map(async (r) => {
      const res = await payload.find({ collection: 'reservations', where: { restaurant: { equals: r.id } }, limit: 0, overrideAccess: true })
      return [r.id, res.totalDocs] as const
    })),
  ])
  const salonCountMap = new Map(salonCounts)
  const restaurantCountMap = new Map(restaurantCounts)

  // Több-üzlet: ownerId → üzletszám (szalon + étterem owner-éből), hogy a sornál jelezhessük,
  // ha egy fiókhoz több üzlet tartozik.
  const ownerBizCount = new Map<string, number>()
  for (const doc of [...salonDocs, ...restaurantDocs]) {
    const oid = typeof doc.owner === 'object' && doc.owner ? String((doc.owner as User).id) : null
    if (oid) ownerBizCount.set(oid, (ownerBizCount.get(oid) ?? 0) + 1)
  }

  const toRow = (kind: 'salon' | 'restaurant', doc: Salon | Restaurant, count: number): PlaceRow => {
    const owner = typeof doc.owner === 'object' ? (doc.owner as User) : null
    const oid = owner?.id != null ? String(owner.id) : null
    return {
      kind,
      id: String(doc.id),
      name: doc.name,
      slug: doc.slug,
      city: doc.city ?? null,
      is_active: doc.is_active ?? null,
      createdAt: doc.createdAt,
      ownerEmail: owner?.email,
      ownerName: owner?.name,
      ownerBusinessCount: oid ? (ownerBizCount.get(oid) ?? 1) : 1,
      bookingCount: count,
    }
  }

  const places: PlaceRow[] = [
    ...salonDocs.map((s) => toRow('salon', s, salonCountMap.get(s.id) ?? 0)),
    ...restaurantDocs.map((r) => toRow('restaurant', r, restaurantCountMap.get(r.id) ?? 0)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHeader
        title="Helyek"
        subtitle={`${salonDocs.length} szalon · ${restaurantDocs.length} étterem`}
      />
      <PlacesClient places={places} />
    </div>
  )
}
