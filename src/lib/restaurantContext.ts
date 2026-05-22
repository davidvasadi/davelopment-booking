import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Restaurant } from '@/payload/payload-types'

/**
 * A bejelentkezett étterem-tulajdonos éttermét adja vissza.
 * A /restaurant/* oldalak közös belépőpontja — egységes auth + redirect.
 */
export async function getOwnedRestaurant() {
  const user = await requireAuth('restaurant_owner')
  if (user.role === 'admin') redirect('/backstage')
  if (user.role === 'salon_owner') redirect('/dashboard')

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'restaurants',
    where: { owner: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
  })
  if (!result.docs.length) redirect('/register-restaurant')

  return { userId: user.id, restaurant: result.docs[0] as Restaurant }
}
