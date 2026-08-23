import type Stripe from 'stripe'

/**
 * Stripe Connect Express helperek — vendég-előleg fizetéshez. Modell: DIRECT CHARGE a
 * csatlakoztatott számlán (`{ stripeAccount: id }` request-option), NEM destination charge —
 * a pénz így szó szerint sosem érinti a platform Stripe-egyenlegét. A csatlakoztatott számla
 * a saját, Stripe-hosztolt (Express) onboardingján megy át (KYC), a platform sosem lát/tárol
 * banki/személyes adatot ehhez — csak a `stripe.accounts.create` hívást indítja.
 *
 * A `src/lib/stripe.ts` singleton-klienst (`getStripe()`) használja, nem hoz létre saját
 * Stripe-példányt.
 */

export async function createConnectAccount(stripe: Stripe, email: string): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'express',
    country: 'HU',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
}

export async function createAccountLink(
  stripe: Stripe,
  accountId: string,
  { returnUrl, refreshUrl }: { returnUrl: string; refreshUrl: string },
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: returnUrl,
    refresh_url: refreshUrl,
  })
}

export function isAccountFullyOnboarded(account: Stripe.Account): boolean {
  return !!account.charges_enabled && !!account.payouts_enabled && !!account.details_submitted
}
