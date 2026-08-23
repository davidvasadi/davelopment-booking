/** A landing dinamikus árazás-propja (backstage-ben szerkeszthető globális árazásból). */
export type LandingPricing = {
  salon_starter_huf: number
  salon_pro_huf: number
  salon_extra_staff_huf: number
  restaurant_starter_huf: number
  restaurant_pro_huf: number
  starter_email_cap: number
  pro_email_cap: number
  egyedi_email_cap: number
  annual_discount_pct: number
  trial_days: number
}

/** Forint-formázás magyar ezres-tagolással. */
export const ftFmt = (n: number) => `${n.toLocaleString('hu-HU')} Ft`
