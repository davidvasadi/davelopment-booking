import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Salon } from '@/payload/payload-types'

/**
 * A bejelentkezett felhasználó AKTÍV szalonját adja vissza.
 * A /dashboard/* oldalak közös belépőpontja — egységes auth + redirect.
 *
 * Több-üzlet (multi-tenant): nem az "első" szalont veszi, hanem a store-switcherrel
 * kiválasztott aktívat (cookie → User.last_active_business → első). Ha az aktív üzlet
 * nem szalon (pl. étteremre váltott), átirányít a /restaurant nézetre.
 *
 * `depth` a kapcsolt mezők kibontásához (settings: 1, lista-oldalak: 0).
 */
export async function getOwnedSalon(depth = 0) {
  const user = await requireAuth()
  if (user.role === 'admin') redirect('/backstage')

  const { active, businesses } = await getActiveBusiness(user)
  if (!active) redirect('/register')
  if (active.type !== 'salon') redirect('/restaurant')

  const payload = await getPayloadClient()
  const salon = (await payload.findByID({
    collection: 'salons',
    id: active.id,
    depth,
    overrideAccess: true,
  })) as Salon

  return { userId: user.id, salon, businessCount: businesses.length, role: active.role, roleName: active.roleName, capabilities: active.capabilities }
}
