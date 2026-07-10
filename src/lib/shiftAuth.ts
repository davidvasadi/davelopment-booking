import type { Where } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Restaurant } from '@/payload/payload-types'

/** Relationship-id STRING → SZÁM coerce (Postgres). null/undefined változatlan marad. */
export const numId = (v: unknown) => (v == null ? v : /^\d+$/.test(String(v)) ? Number(v) : v)

/** Van-e a usernek AKTÍV vezető (manager) tagsága ehhez az üzlethez? */
async function isActiveManager(
  scope: 'salon' | 'restaurant',
  bizId: unknown,
  userId: string | number,
): Promise<boolean> {
  const payload = await getPayloadClient()
  const scopeFilter: Where = scope === 'restaurant' ? { restaurant: { equals: numId(bizId) as never } } : { salon: { equals: numId(bizId) as never } }
  const res = await payload.find({
    collection: 'memberships',
    where: { and: [scopeFilter, { user: { equals: userId } }, { role: { equals: 'manager' } }, { status: { equals: 'active' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.length > 0
}

/**
 * Ellenőrzi, hogy a bejelentkezett user KEZELHETI-e a beosztást: a szalon/étterem TULAJA,
 * VAGY egy aktív VEZETŐ (manager) tagja. Visszatérés: null ha OK, különben a hibaüzenet.
 * (A név történeti; a beosztás-route-ok hívják — a vezető is szerkeszthet/​törölhet.)
 */
export async function assertBusinessOwner(
  opts: { salon?: unknown; restaurant?: unknown },
  userId: string | number,
): Promise<string | null> {
  const payload = await getPayloadClient()
  try {
    if (opts.restaurant) {
      const r = (await payload.findByID({ collection: 'restaurants', id: opts.restaurant as string, depth: 0, overrideAccess: true })) as Restaurant
      const ownerId = typeof r.owner === 'object' && r.owner ? r.owner.id : r.owner
      if (String(ownerId) === String(userId)) return null
      if (await isActiveManager('restaurant', opts.restaurant, userId)) return null
      return 'Nincs jogosultság ehhez az étteremhez'
    }
    if (opts.salon) {
      const s = (await payload.findByID({ collection: 'salons', id: opts.salon as string, depth: 0, overrideAccess: true })) as Salon
      const ownerId = typeof s.owner === 'object' && s.owner ? s.owner.id : s.owner
      if (String(ownerId) === String(userId)) return null
      if (await isActiveManager('salon', opts.salon, userId)) return null
      return 'Nincs jogosultság ehhez a szalonhoz'
    }
  } catch {
    return 'Az üzlet nem található'
  }
  return 'Hiányzó üzlet'
}
