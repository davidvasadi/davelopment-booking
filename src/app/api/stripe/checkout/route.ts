import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { computeAccountFee, getOrCreateAccountSubscription } from '@/lib/accountSubscription'
import { applyCycle } from '@/lib/tier'
import { getPricing } from '@/lib/pricing'
import { BRAND_NAME } from '@/lib/brand'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Stripe Checkout indítása a FIÓK-előfizetéshez. Az összeg DINAMIKUS (a fiók üzleteiből számolva,
 * a `computeAccountFee` szerint), ezért `price_data`-t használunk (nincs előre létrehozott Price).
 * Havi = lista havidíj; éves = a ciklus-kedvezményes havidíj × 12, egyben terhelve.
 * A tényleges státusz-váltást a webhook végzi (checkout.session.completed).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as { cycle?: string; returnPath?: string }
  const cycle: 'monthly' | 'annual' = body.cycle === 'annual' ? 'annual' : 'monthly'
  const returnPath =
    typeof body.returnPath === 'string' && body.returnPath.startsWith('/') ? body.returnPath : '/dashboard/subscription'

  const payload = await getPayloadClient()
  const ctx = { payload }
  const [sub, fee, pricing] = await Promise.all([
    getOrCreateAccountSubscription(ctx, user.id),
    computeAccountFee(ctx, user.id),
    getPricing(),
  ])

  if (fee.amountHuf <= 0) {
    return NextResponse.json({ error: 'Nincs számlázható üzlet a fiókban.' }, { status: 400 })
  }

  const monthlyEffective = applyCycle(fee.amountHuf, cycle, pricing.annual_discount_pct)
  const unitForint = cycle === 'annual' ? monthlyEffective * 12 : monthlyEffective
  const interval: 'month' | 'year' = cycle === 'annual' ? 'year' : 'month'

  // Stripe customer újrafelhasználása / létrehozása, és visszamentése a subre (idempotens).
  let customerId = sub.stripe_customer_id || null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: String(user.id), subscriptionId: String(sub.id) },
    })
    customerId = customer.id
    await payload.update({
      collection: 'subscriptions', id: sub.id, overrideAccess: true,
      data: { stripe_customer_id: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'huf',
          unit_amount: hufToStripeMinor(unitForint),
          recurring: { interval },
          product_data: { name: `${BRAND_NAME} előfizetés (${cycle === 'annual' ? 'éves' : 'havi'}) — ${fee.breakdown}` },
        },
      },
    ],
    success_url: `${APP_URL}${returnPath}?checkout=success`,
    cancel_url: `${APP_URL}${returnPath}?checkout=cancel`,
    metadata: { userId: String(user.id), subscriptionId: String(sub.id), cycle },
    subscription_data: { metadata: { userId: String(user.id), subscriptionId: String(sub.id), cycle } },
  })

  return NextResponse.json({ url: session.url })
}
