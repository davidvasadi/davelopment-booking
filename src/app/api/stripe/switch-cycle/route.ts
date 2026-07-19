import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { computeAccountFee, getOrCreateAccountSubscription } from '@/lib/accountSubscription'
import { applyCycle } from '@/lib/tier'
import { getPricing } from '@/lib/pricing'
import { BRAND_NAME } from '@/lib/brand'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { cycle?: string }
  const newCycle: 'monthly' | 'annual' = body.cycle === 'annual' ? 'annual' : 'monthly'

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  const payload = await getPayloadClient()
  const ctx = { payload }
  const [sub, fee, pricing] = await Promise.all([
    getOrCreateAccountSubscription(ctx, user.id),
    computeAccountFee(ctx, user.id),
    getPricing(),
  ])

  if (sub.status !== 'active') {
    return NextResponse.json({ error: 'Nincs aktív előfizetés.' }, { status: 400 })
  }
  if (sub.billing_cycle === newCycle) {
    return NextResponse.json({ error: 'Már ezen a cikluson vagy.' }, { status: 400 })
  }
  if (!sub.stripe_subscription_id) {
    return NextResponse.json({ error: 'Hiányzó Stripe előfizetés.' }, { status: 400 })
  }

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const item = stripeSub.items.data[0]
  if (!item) return NextResponse.json({ error: 'Nem található előfizetési tétel.' }, { status: 400 })

  const monthlyEffective = applyCycle(fee.amountHuf, newCycle, pricing.annual_discount_pct)
  const unitForint = newCycle === 'annual' ? monthlyEffective * 12 : monthlyEffective
  const interval: 'month' | 'year' = newCycle === 'annual' ? 'year' : 'month'
  const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    proration_behavior: 'always_invoice',
    items: [{
      id: item.id,
      price_data: {
        currency: 'huf',
        unit_amount: hufToStripeMinor(unitForint),
        recurring: { interval },
        product: productId,
      },
    }],
  })

  await payload.update({
    collection: 'subscriptions',
    id: sub.id,
    overrideAccess: true,
    data: { billing_cycle: newCycle, amount_huf: unitForint },
  })

  return NextResponse.json({ ok: true })
}
