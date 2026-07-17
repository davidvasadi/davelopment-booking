import Stripe from 'stripe'

/**
 * Stripe kliens — platform-szintű kulccsal (`STRIPE_SECRET_KEY`). Ha nincs kulcs (dev/staging),
 * `null`-t ad, és EGYSZER figyelmeztet — így a fizetés-flow némán ki van kapcsolva, nem törik el
 * a build vagy a többi funkció. Az éles kulcsot csak indításkor tesszük be.
 */
let _stripe: Stripe | null = null
let _warnedNoKey = false

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    if (!_warnedNoKey) {
      console.warn('[Stripe] STRIPE_SECRET_KEY nincs beállítva — a fizetés ki van kapcsolva.')
      _warnedNoKey = true
    }
    return null
  }
  // apiVersion-t nem pinneljük ide: a fiók alapértelmezett verzióját használjuk (az SDK kezeli).
  if (!_stripe) _stripe = new Stripe(key)
  return _stripe
}

export const isStripeEnabled = (): boolean => !!process.env.STRIPE_SECRET_KEY

/**
 * HUF → Stripe „legkisebb egység". A Stripe a forintot SPECIÁLIS esetként kezeli: 2 tizedesűként
 * várja (×100), de csak egész forint fogadható el (az utolsó két jegy 00). Pl. 12 900 Ft → 1 290 000.
 */
export function hufToStripeMinor(forint: number): number {
  return Math.round(forint) * 100
}

/** Stripe előfizetés-státusz → a mi `subscriptions.status` enumunk. */
export function mapStripeStatus(s: Stripe.Subscription.Status): 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' {
  switch (s) {
    case 'trialing': return 'trialing'
    case 'active': return 'active'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired': return 'past_due'
    case 'paused': return 'paused'
    case 'canceled': return 'canceled'
    default: return 'active'
  }
}
