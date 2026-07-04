import type { Pricing } from './pricing'

/**
 * PER-ÜZLET CSOMAG + ÁR-HELPEREK.
 *
 * Két csomag van üzletenként: `pro` (a normál, önkiszolgáló — MINDEN funkció elérhető, nincs
 * funkció-zár) és `egyedi` (testreszabott, kapcsolatfelvétellel — az árat/fejlesztést külön
 * egyeztetjük). A fiók havidíja az üzletek díjából áll össze (a számlázási ciklus kedvezményével);
 * a fizetés mindig EGY összevont számla a fiókra.
 *
 * Ár: szalon = alapdíj + (aktív munkatárs − 1) × extra-fő ár; étterem = fix havidíj.
 * Grandfathering: a régi (null) csomag `pro`-ként olvasandó. Tiszta modul (kliens is használhatja).
 */

export type Tier = 'pro' | 'egyedi'
export type BillingCycle = 'monthly' | 'annual'

/** Null / ismeretlen csomag → 'pro' (a normál, önkiszolgáló). */
export function resolveTier(tier: string | null | undefined): Tier {
  return tier === 'egyedi' ? 'egyedi' : 'pro'
}

/** Biztonságos ciklus-olvasás (null / ismeretlen → havi). */
export function resolveCycle(cycle: string | null | undefined): BillingCycle {
  return cycle === 'annual' ? 'annual' : 'monthly'
}

/** A szalon-díjban ingyenes (alapdíjba foglalt) munkatársak/naptárak száma. Az első fő az alapban van. */
export const SALON_INCLUDED_STAFF = 1

/** Egy szalon havi LISTA-díja: alapdíj + (aktív munkatársak − benne foglalt) × extra-fő ár. */
export function salonMonthlyFee(pricing: Pricing, staffCount: number): number {
  return pricing.salon_pro_huf + Math.max(0, staffCount - SALON_INCLUDED_STAFF) * pricing.salon_extra_staff_huf
}

/**
 * Egy üzlet havi LISTA-díja a típusa szerint: étterem = fix havidíj; szalon = alapdíj + per-fő.
 * A `staffCount` csak szalonnál számít (az étterem figyelmen kívül hagyja).
 */
export function businessMonthlyFee(pricing: Pricing, type: 'salon' | 'restaurant', staffCount = 0): number {
  return type === 'restaurant' ? pricing.restaurant_pro_huf : salonMonthlyFee(pricing, staffCount)
}

/**
 * Éves ciklusnál a lista-havidíjat a kedvezménnyel csökkenti (effektív havi ár), havinál
 * változatlan. Az éves TERHELÉS ennek 12-szerese, évente egyszer.
 */
export function applyCycle(listMonthlyHuf: number, cycle: BillingCycle, discountPct: number): number {
  if (cycle !== 'annual') return listMonthlyHuf
  const pct = Math.min(100, Math.max(0, discountPct))
  return Math.round(listMonthlyHuf * (1 - pct / 100))
}

/** A ciklus időszakának hossza napokban (havi = 30, éves = 365). */
export function cyclePeriodDays(cycle: BillingCycle): number {
  return cycle === 'annual' ? 365 : 30
}
