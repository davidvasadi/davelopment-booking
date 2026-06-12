import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import type { PricingSetting } from '@/payload/payload-types'

/**
 * A globális árazás kiolvasása a `pricing-settings` Payload globalből. Ez a KÖZPONTI forrás:
 * az új előfizetések ezt fagyasztják be, a publikus árazás és a backstage KPI-k innen olvasnak.
 * A globalnek mindig van értéke (defaultValue-k), de óvatosságból fallbackölünk.
 */
const FALLBACK = { salon_pro_huf: 2900, restaurant_pro_huf: 9900, trial_days: 14 }

export type Pricing = {
  salon_pro_huf: number
  restaurant_pro_huf: number
  trial_days: number
}

export async function getPricing(): Promise<Pricing> {
  try {
    const payload = await getPayloadClient()
    const g = (await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true })) as PricingSetting
    return {
      salon_pro_huf: g?.salon_pro_huf ?? FALLBACK.salon_pro_huf,
      restaurant_pro_huf: g?.restaurant_pro_huf ?? FALLBACK.restaurant_pro_huf,
      trial_days: g?.trial_days ?? FALLBACK.trial_days,
    }
  } catch {
    return { ...FALLBACK }
  }
}

/** Egy plan aktuális globális ára forintban. */
export function planPrice(pricing: Pricing, plan: string | null | undefined): number {
  if (plan === 'pro') return pricing.salon_pro_huf
  if (plan === 'restaurant_pro') return pricing.restaurant_pro_huf
  return 0 // trial / ismeretlen
}
