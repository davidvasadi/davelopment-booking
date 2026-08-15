import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import type { PricingSetting } from '@/payload/payload-types'

/**
 * A globális árazás kiolvasása a `pricing-settings` Payload globalből. Ez az EGYETLEN ár-forrás —
 * NINCS hardkódolt fallback; az értékek kizárólag abból jönnek, amit a backstage/Payload-ban
 * beállítasz (a global mezői required + defaultValue-sek, tehát mindig van értékük).
 */
export type Pricing = {
  /** Szalon alapdíj (a normál csomag; + per-fő). */
  salon_pro_huf: number
  salon_extra_staff_huf: number
  /** Étterem fix havidíj (a normál csomag). */
  restaurant_pro_huf: number
  /** Hírlevél-kiegészítő csomagok havi felára (üzletenként, `newsletter_settings.package`). */
  newsletter_alap_huf: number
  newsletter_premium_huf: number
  /** Havi kemény email-plafon csomagonként — admin bármikor módosíthatja, nem kódba égetett. */
  newsletter_ingyenes_email_cap: number
  newsletter_alap_email_cap: number
  newsletter_premium_email_cap: number
  annual_discount_pct: number
  trial_days: number
}

export async function getPricing(): Promise<Pricing> {
  const payload = await getPayloadClient()
  const g = (await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true })) as PricingSetting
  return {
    salon_pro_huf: g.salon_pro_huf,
    salon_extra_staff_huf: g.salon_extra_staff_huf,
    restaurant_pro_huf: g.restaurant_pro_huf,
    newsletter_alap_huf: g.newsletter_alap_huf,
    newsletter_premium_huf: g.newsletter_premium_huf,
    newsletter_ingyenes_email_cap: g.newsletter_ingyenes_email_cap,
    newsletter_alap_email_cap: g.newsletter_alap_email_cap,
    newsletter_premium_email_cap: g.newsletter_premium_email_cap,
    annual_discount_pct: g.annual_discount_pct,
    trial_days: g.trial_days,
  }
}

/** Egy plan aktuális globális ára forintban. */
export function planPrice(pricing: Pricing, plan: string | null | undefined): number {
  if (plan === 'pro') return pricing.salon_pro_huf
  if (plan === 'restaurant_pro') return pricing.restaurant_pro_huf
  return 0 // trial / ismeretlen
}
