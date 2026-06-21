/** A landing dinamikus árazás-propja (backstage-ben szerkeszthető globális árazásból). */
export type LandingPricing = {
  salon_pro_huf: number
  restaurant_pro_huf: number
  trial_days: number
}

/** Forint-formázás magyar ezres-tagolással. */
export const ftFmt = (n: number) => `${n.toLocaleString('hu-HU')} Ft`
