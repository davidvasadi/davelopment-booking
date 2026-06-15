import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Restaurant } from '@/payload/payload-types'

/**
 * A bejelentkezett felhasználó AKTÍV éttermét adja vissza.
 * A /restaurant/* oldalak közös belépőpontja — egységes auth + redirect.
 *
 * Több-üzlet (multi-tenant): nem az "első" éttermet veszi, hanem a store-switcherrel
 * kiválasztott aktívat (cookie → User.last_active_business → első). Ha az aktív üzlet
 * nem étterem (pl. szalonra váltott), átirányít a /dashboard nézetre.
 */
export async function getOwnedRestaurant() {
  const user = await requireAuth()
  if (user.role === 'admin') redirect('/backstage')

  const { active, businesses } = await getActiveBusiness(user)
  if (!active) redirect('/register-restaurant')
  if (active.type !== 'restaurant') redirect('/dashboard')

  const payload = await getPayloadClient()
  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: active.id,
    depth: 1,
    overrideAccess: true,
  })) as Restaurant

  return { userId: user.id, restaurant, businessCount: businesses.length }
}
