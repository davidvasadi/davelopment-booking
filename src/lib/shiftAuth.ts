import { getPayloadClient } from '@/lib/payload'
import type { Salon, Restaurant } from '@/payload/payload-types'

/** Relationship-id STRING → SZÁM coerce (Postgres). null/undefined változatlan marad. */
export const numId = (v: unknown) => (v == null ? v : /^\d+$/.test(String(v)) ? Number(v) : v)

/**
 * Ellenőrzi, hogy a bejelentkezett user a megadott szalon/étterem TULAJA-e.
 * Visszatérés: null ha OK, különben a hibaüzenet.
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
      return String(ownerId) === String(userId) ? null : 'Nincs jogosultság ehhez az étteremhez'
    }
    if (opts.salon) {
      const s = (await payload.findByID({ collection: 'salons', id: opts.salon as string, depth: 0, overrideAccess: true })) as Salon
      const ownerId = typeof s.owner === 'object' && s.owner ? s.owner.id : s.owner
      return String(ownerId) === String(userId) ? null : 'Nincs jogosultság ehhez a szalonhoz'
    }
  } catch {
    return 'Az üzlet nem található'
  }
  return 'Hiányzó üzlet'
}
