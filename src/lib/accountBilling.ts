import { getPayloadClient } from './payload'
import { getUserBusinesses, type BusinessType } from './activeBusiness'
import { findAccountSubscription } from './accountSubscription'
import { getPricing } from './pricing'

/**
 * Fiók-szintű számlázási áttekintés. Egy fiók = egy előfizetés; a fiók havidíja az üzletek
 * összetételéből áll. Ez a helper az üzlet-bontást adja a /subscription oldal listájához:
 * minden üzlet a típusa szerinti EGYSÉGÁRRAL (a globális `pricing-settings`-ből), a fiók
 * összdíja pedig a fiók-előfizetés `amount_huf`-ja (vagy az egységárak összege fallbackként).
 *
 * Az üzletek akkor számítanak fizetősnek, ha a FIÓK előfizetése aktív (közös státusz).
 */

export interface AccountBillingItem {
  type: BusinessType
  id: string
  name: string
  slug: string
  /** Az üzlet típusa szerinti egységár (a fiók-díjhoz adott hozzájárulás). */
  feeHuf: number
}

export interface AccountBilling {
  items: AccountBillingItem[]
  totalMonthlyHuf: number
  count: number
  /** A fiók előfizetés státusza (közös), pl. trial alatt nincs tényleges díj. */
  accountStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | null
}

export async function getAccountBilling(userId: string | number): Promise<AccountBilling> {
  const businesses = await getUserBusinesses(userId)
  if (businesses.length === 0) return { items: [], totalMonthlyHuf: 0, count: 0, accountStatus: null }

  const payload = await getPayloadClient()
  const [sub, pricing] = await Promise.all([
    findAccountSubscription({ payload }, userId),
    getPricing(),
  ])

  const items: AccountBillingItem[] = businesses.map((b) => ({
    type: b.type,
    id: b.id,
    name: b.name,
    slug: b.slug,
    feeHuf: b.type === 'salon' ? pricing.salon_pro_huf : pricing.restaurant_pro_huf,
  }))

  // A fiók összdíja: az előfizetésben tárolt amount_huf (a sync-elt érték), fallback az egységárak összege.
  const computed = items.reduce((s, it) => s + it.feeHuf, 0)
  const totalMonthlyHuf = sub?.amount_huf ?? computed

  return { items, totalMonthlyHuf, count: businesses.length, accountStatus: sub?.status ?? null }
}
