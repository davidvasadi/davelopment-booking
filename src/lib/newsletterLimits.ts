import type { Pricing } from './pricing'

export type NewsletterPackage = 'none' | 'ingyenes' | 'alap' | 'premium'

/** Havi kemény email-plafon a választott csomag szerint — admin-állítható, `pricing-settings`-ből. */
export function monthlyEmailCap(pricing: Pricing, pkg: string | null | undefined): number {
  if (pkg === 'ingyenes') return pricing.newsletter_ingyenes_email_cap
  if (pkg === 'alap') return pricing.newsletter_alap_email_cap
  if (pkg === 'premium') return pricing.newsletter_premium_email_cap
  return 0
}

/** Van-e egyáltalán aktív hírlevél-csomag (bármelyik fizetős VAGY az ingyenes is számít). */
export function hasActivePackage(pkg: string | null | undefined): boolean {
  return pkg === 'ingyenes' || pkg === 'alap' || pkg === 'premium'
}
