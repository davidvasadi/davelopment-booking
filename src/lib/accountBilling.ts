import { getPayloadClient } from './payload'
import { getUserBusinesses, type BusinessType } from './activeBusiness'
import { findAccountSubscription, countActiveStaffBySalon } from './accountSubscription'
import { getPricing } from './pricing'
import { businessMonthlyFee, applyCycle, resolveCycle, type Tier, type BillingCycle } from './tier'

/**
 * Fiók-szintű számlázási áttekintés. Egy fiók = egy előfizetés; a fiók havidíja az üzletek
 * összetételéből áll. Ez a helper az üzlet-bontást adja a /subscription oldal listájához:
 * minden üzlet a saját TIERje (Start/Pro) szerinti egységárral (a globális `pricing-settings`-ből).
 *
 * - `feeHuf` (per üzlet) = LISTA havi ár (kedvezmény nélkül) — a bontás tételei.
 * - `listMonthlyHuf` = a lista-tételek összege.
 * - `totalMonthlyHuf` = EFFEKTÍV havidíj: a fiók-előfizetés `amount_huf`-ja (a ciklus-kedvezménnyel
 *   szinkronizált érték), fallback a ciklusra alkalmazott lista-összeg.
 */

export interface AccountBillingItem {
  type: BusinessType
  id: string
  name: string
  slug: string
  /** Az üzlet csomagja (Start/Pro). */
  tier: Tier
  /** Aktív munkatársak/naptárak száma (csak szalonnál releváns; a per-fő díjhoz). */
  staffCount: number
  /** Az üzlet havi LISTA-díja (étterem = fix; szalon = alap + per-fő), kedvezmény nélkül. */
  feeHuf: number
}

export interface AccountBilling {
  items: AccountBillingItem[]
  /** Effektív havidíj (a számlázási ciklus kedvezményével) — ez jelenik meg „Ft/hó"-ként. */
  totalMonthlyHuf: number
  /** Lista havidíj (ciklus-kedvezmény nélkül) — a bontás tételeinek összege. */
  listMonthlyHuf: number
  /** A fiók számlázási ciklusa (havi/éves). */
  cycle: BillingCycle
  /** Éves kedvezmény %-a (a globális beállításból). */
  annualDiscountPct: number
  count: number
  /** A fiók előfizetés státusza (közös), pl. trial alatt nincs tényleges díj. */
  accountStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | null
}

export async function getAccountBilling(userId: string | number): Promise<AccountBilling> {
  const businesses = await getUserBusinesses(userId)
  if (businesses.length === 0) {
    return { items: [], totalMonthlyHuf: 0, listMonthlyHuf: 0, cycle: 'monthly', annualDiscountPct: 0, count: 0, accountStatus: null }
  }

  const payload = await getPayloadClient()
  const [sub, pricing] = await Promise.all([
    findAccountSubscription({ payload }, userId),
    getPricing(),
  ])

  // Szalon per-fő díjhoz: aktív munkatársak szalononként.
  const salonIds = businesses.filter((b) => b.type === 'salon').map((b) => b.id)
  const staffBySalon = await countActiveStaffBySalon(payload, salonIds)

  const items: AccountBillingItem[] = businesses.map((b) => {
    const staffCount = b.type === 'salon' ? (staffBySalon.get(String(b.id)) ?? 0) : 0
    return {
      type: b.type,
      id: b.id,
      name: b.name,
      slug: b.slug,
      tier: b.tier,
      staffCount,
      feeHuf: businessMonthlyFee(pricing, b.type, staffCount),
    }
  })

  const listMonthlyHuf = items.reduce((s, it) => s + it.feeHuf, 0)
  const cycle = resolveCycle(sub?.billing_cycle)
  // Effektív díj: a sync-elt amount_huf (elsődleges), fallback a ciklusra alkalmazott lista-összeg.
  const totalMonthlyHuf = sub?.amount_huf ?? applyCycle(listMonthlyHuf, cycle, pricing.annual_discount_pct)

  return {
    items,
    totalMonthlyHuf,
    listMonthlyHuf,
    cycle,
    annualDiscountPct: pricing.annual_discount_pct,
    count: businesses.length,
    accountStatus: sub?.status ?? null,
  }
}
