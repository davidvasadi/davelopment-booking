import type { Where } from 'payload'
import { getPayloadClient } from './payload'
import { getUserBusinesses, type BusinessType } from './activeBusiness'
import { subAmountHuf } from './backstagePlaces'
import type { Subscription } from '@/payload/payload-types'

/**
 * Fiók-szintű számlázási áttekintés (több-üzlet / multi-tenant): a felhasználó ÖSSZES
 * üzlete + mindegyik előfizetésének státusza/díja, és a fiók összesített havidíja.
 *
 * A havidíjba CSAK a ténylegesen fizető (status=active, nem trial) előfizetés számít —
 * a `subAmountHuf` (backstagePlaces.ts) szerint, az `amount_huf` (befagyott, dinamikus ár)
 * alapján. Üzletenként külön előfizetés = külön havidíj; a végösszeg ezek összege.
 */

export interface AccountBillingItem {
  type: BusinessType
  id: string
  name: string
  slug: string
  status: Subscription['status'] | null
  plan: Subscription['plan'] | null
  /** Havidíj forintban (0, ha trial/inaktív). */
  feeHuf: number
}

export interface AccountBilling {
  items: AccountBillingItem[]
  totalMonthlyHuf: number
  count: number
}

export async function getAccountBilling(userId: string | number): Promise<AccountBilling> {
  const businesses = await getUserBusinesses(userId)
  if (businesses.length === 0) return { items: [], totalMonthlyHuf: 0, count: 0 }

  const payload = await getPayloadClient()
  const salonIds = businesses.filter((b) => b.type === 'salon').map((b) => b.id)
  const restaurantIds = businesses.filter((b) => b.type === 'restaurant').map((b) => b.id)

  const orClauses: Where[] = []
  if (salonIds.length) orClauses.push({ salon: { in: salonIds } })
  if (restaurantIds.length) orClauses.push({ restaurant: { in: restaurantIds } })

  const subs = await payload.find({
    collection: 'subscriptions',
    where: { or: orClauses },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const subForSalon = (id: string) =>
    (subs.docs as Subscription[]).find((s) => String(typeof s.salon === 'object' ? s.salon?.id : s.salon) === id)
  const subForRest = (id: string) =>
    (subs.docs as Subscription[]).find((s) => String(typeof s.restaurant === 'object' ? s.restaurant?.id : s.restaurant) === id)

  let totalMonthlyHuf = 0
  const items: AccountBillingItem[] = businesses.map((b) => {
    const sub = b.type === 'salon' ? subForSalon(b.id) : subForRest(b.id)
    const fee = sub ? subAmountHuf(sub) : 0
    totalMonthlyHuf += fee
    return {
      type: b.type,
      id: b.id,
      name: b.name,
      slug: b.slug,
      status: sub?.status ?? null,
      plan: sub?.plan ?? null,
      feeHuf: fee,
    }
  })

  return { items, totalMonthlyHuf, count: businesses.length }
}
