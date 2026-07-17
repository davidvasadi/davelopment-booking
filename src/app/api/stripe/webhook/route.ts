import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { getStripe, mapStripeStatus } from '@/lib/stripe'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

/** A Stripe aláírás-ellenőrzés a NYERS body-t igényli — App Routerben `req.text()` adja. */
async function findSubBy(payload: Payload, field: 'stripe_subscription_id' | 'stripe_customer_id', value: string) {
  const res = await payload.find({
    collection: 'subscriptions',
    where: { [field]: { equals: value } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  return res.docs[0] ?? null
}

// A Stripe API-verziótól függően a periódus-vég a subscriptionön vagy az itemen ül — defenzív olvasás.
function periodEndISO(sub: Stripe.Subscription): string | undefined {
  const raw = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? sub.items?.data?.[0]?.current_period_end
  return typeof raw === 'number' ? new Date(raw * 1000).toISOString() : undefined
}

export async function POST(req: Request) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) return NextResponse.json({ error: 'A fizetés nincs konfigurálva.' }, { status: 503 })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Hiányzó aláírás' }, { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    console.error('[Stripe webhook] aláírás-ellenőrzés hibás:', err)
    return NextResponse.json({ error: 'Érvénytelen aláírás' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  try {
    switch (event.type) {
      // Sikeres fizetés → a fiók fizetővé válik. A Stripe subból olvassuk a valós státuszt/periódust.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        const custId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const ourSubId = session.metadata?.subscriptionId
        const cycle = session.metadata?.cycle === 'annual' ? 'annual' : 'monthly'
        if (ourSubId && subId) {
          const stripeSub = await stripe.subscriptions.retrieve(subId)
          const end = periodEndISO(stripeSub)
          await payload.update({
            collection: 'subscriptions', id: ourSubId, overrideAccess: true,
            data: {
              plan: 'paid',
              status: mapStripeStatus(stripeSub.status),
              billing_cycle: cycle,
              stripe_subscription_id: subId,
              ...(custId ? { stripe_customer_id: custId } : {}),
              ...(end ? { current_period_end: end } : {}),
              cancel_at_period_end: stripeSub.cancel_at_period_end,
            },
          })
        }
        break
      }

      // Előfizetés-frissítés (megújulás, ciklus-vég jelölés, státusz-váltás) → szinkron.
      case 'customer.subscription.updated': {
        const s = event.data.object as Stripe.Subscription
        const our = await findSubBy(payload, 'stripe_subscription_id', s.id)
        if (our) {
          const end = periodEndISO(s)
          await payload.update({
            collection: 'subscriptions', id: our.id, overrideAccess: true,
            data: {
              status: mapStripeStatus(s.status),
              cancel_at_period_end: s.cancel_at_period_end,
              ...(end ? { current_period_end: end } : {}),
            },
          })
        }
        break
      }

      // Végleges lemondás.
      case 'customer.subscription.deleted': {
        const s = event.data.object as Stripe.Subscription
        const our = await findSubBy(payload, 'stripe_subscription_id', s.id)
        if (our) await payload.update({ collection: 'subscriptions', id: our.id, overrideAccess: true, data: { status: 'canceled' } })
        break
      }

      // Sikertelen terhelés → lejárt fizetés (a tulaj a Számlázás oldalon frissíthet).
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
        const our = custId ? await findSubBy(payload, 'stripe_customer_id', custId) : null
        if (our) await payload.update({ collection: 'subscriptions', id: our.id, overrideAccess: true, data: { status: 'past_due' } })
        break
      }

      // invoice.paid → később: automata Számlázz.hu számla.
      default:
        break
    }
  } catch (err) {
    console.error(`[Stripe webhook] feldolgozási hiba (${event.type}):`, err)
    return NextResponse.json({ error: 'Feldolgozási hiba' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
