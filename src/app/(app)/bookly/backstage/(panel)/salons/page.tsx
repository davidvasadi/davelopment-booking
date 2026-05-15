import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, User } from '@/payload/payload-types'
import SalonsClient from './SalonsClient'

export default async function BackstageSalonsPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const salonsResult = await payload.find({
    collection: 'salons',
    sort: '-createdAt',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })

  const bookingsBySalon = await Promise.all(
    salonsResult.docs.map(async (salon) => {
      const result = await payload.find({
        collection: 'bookings',
        where: { salon: { equals: salon.id } },
        limit: 0,
        overrideAccess: true,
      })
      return { salonId: salon.id, count: result.totalDocs }
    })
  )
  const bookingCountMap = new Map(bookingsBySalon.map(b => [b.salonId, b.count]))

  const salons = (salonsResult.docs as Salon[]).map(s => {
    const owner = typeof s.owner === 'object' ? (s.owner as User) : null
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      city: s.city,
      is_active: s.is_active,
      createdAt: s.createdAt,
      ownerEmail: owner?.email,
      ownerName: owner?.name,
      bookingCount: bookingCountMap.get(s.id) ?? 0,
    }
  })

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">Szalonok</h1>
        <p className="text-zinc-500 text-sm mt-1">{salonsResult.totalDocs} regisztrált szalon</p>
      </div>
      <SalonsClient salons={salons} />
    </div>
  )
}
