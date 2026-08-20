import type { Pricing } from './pricing'

/**
 * PER-ÜZLET CSOMAG + ÁR-HELPEREK.
 *
 * Három csomag van üzletenként: `starter` (belépő szint, kisebb email-keret), `pro` (a normál,
 * önkiszolgáló — MINDEN funkció elérhető, nincs funkció-zár, nagyobb email-keret) és `egyedi`
 * (testreszabott, kapcsolatfelvétellel — az árat/fejlesztést külön egyeztetjük). A hírlevél-
 * küldés BEÉPÍTVE jár minden csomaghoz (nincs önálló, külön fizetendő hírlevél-csomag) — a
 * havi email-keret a csomag szerint dől el, lásd `monthlyEmailCapForTier`. A fiók havidíja az
 * üzletek díjából áll össze (a számlázási ciklus kedvezményével); a fizetés mindig EGY
 * összevont számla a fiókra.
 *
 * Ár: szalon = alapdíj + (aktív munkatárs − 1) × extra-fő ár; étterem = fix havidíj.
 * Grandfathering: a régi (null) csomag `pro`-ként olvasandó. Tiszta modul (kliens is használhatja).
 */

export type Tier = 'starter' | 'pro' | 'egyedi'
export type BillingCycle = 'monthly' | 'annual'

/** Null / ismeretlen csomag → 'pro' (a normál, önkiszolgáló — a régi, kétcsomagos modellből
 *  örökölt fiókok NEM esnek vissza Starterre). */
export function resolveTier(tier: string | null | undefined): Tier {
  if (tier === 'starter') return 'starter'
  if (tier === 'egyedi') return 'egyedi'
  return 'pro'
}

/** Biztonságos ciklus-olvasás (null / ismeretlen → havi). */
export function resolveCycle(cycle: string | null | undefined): BillingCycle {
  return cycle === 'annual' ? 'annual' : 'monthly'
}

/** A szalon-díjban ingyenes (alapdíjba foglalt) munkatársak/naptárak száma. Az első fő az alapban van. */
export const SALON_INCLUDED_STAFF = 1

/** Egy szalon adott csomaghoz tartozó alapdíja (per-fő felár nélkül). */
function salonBaseFee(pricing: Pricing, tier: Tier): number {
  if (tier === 'starter') return pricing.salon_starter_huf
  // 'egyedi': nincs fix ár (kapcsolatfelvétel), a Pro díj csak becslés-alap, amíg nincs
  // egyedi szerződés — így nem marad díj-nélküli az üzlet, ha valaki mégis erre állítja.
  return pricing.salon_pro_huf
}

/** Egy étterem adott csomaghoz tartozó fix havidíja. */
function restaurantBaseFee(pricing: Pricing, tier: Tier): number {
  if (tier === 'starter') return pricing.restaurant_starter_huf
  return pricing.restaurant_pro_huf
}

/** Egy szalon havi LISTA-díja: csomag-alapdíj + (aktív munkatársak − benne foglalt) × extra-fő ár. */
export function salonMonthlyFee(pricing: Pricing, staffCount: number, tier: Tier = 'pro'): number {
  return salonBaseFee(pricing, tier) + Math.max(0, staffCount - SALON_INCLUDED_STAFF) * pricing.salon_extra_staff_huf
}

/**
 * Egy üzlet havi LISTA-díja a típusa ÉS csomagja szerint: étterem = fix havidíj; szalon =
 * alapdíj + per-fő. A `staffCount` csak szalonnál számít (az étterem figyelmen kívül hagyja).
 * `tier` alapértelmezetten 'pro' — a régi hívási hely (csak type+staffCount) így nem törik el.
 *
 * `customFeeHuf`: 'egyedi' csomagnál, ha admin megadott egy megegyezés szerinti havidíjat
 * (`Salon.custom_monthly_fee_huf`/`Restaurant.custom_monthly_fee_huf`), az ELSŐBBSÉGET ÉLVEZ a
 * teljes számított díj felett (nincs hozzá per-fő felár sem) — amíg nincs megadva, a Pro-ár
 * marad a becslés-alap.
 */
export function businessMonthlyFee(pricing: Pricing, type: 'salon' | 'restaurant', staffCount = 0, tier: Tier = 'pro', customFeeHuf?: number | null): number {
  if (tier === 'egyedi' && typeof customFeeHuf === 'number' && Number.isFinite(customFeeHuf) && customFeeHuf >= 0) {
    return customFeeHuf
  }
  return type === 'restaurant' ? restaurantBaseFee(pricing, tier) : salonMonthlyFee(pricing, staffCount, tier)
}

/** A csomaghoz BEÉPÍTVE járó havi hírlevél-küldési keret (nincs önálló hírlevél-fizetés). */
export function monthlyEmailCapForTier(pricing: Pricing, tier: Tier | string | null | undefined): number {
  const t = resolveTier(typeof tier === 'string' ? tier : undefined)
  if (t === 'starter') return pricing.starter_email_cap
  if (t === 'egyedi') return pricing.egyedi_email_cap
  return pricing.pro_email_cap
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
