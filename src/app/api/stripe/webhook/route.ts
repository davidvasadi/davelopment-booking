import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { getStripe, mapStripeStatus } from '@/lib/stripe'
import { getPayloadClient } from '@/lib/payload'
import { applyCheckoutCompleted, ensureInvoiceForStripeInvoice, periodEndISO } from '@/lib/stripeCheckoutSync'
import { sendPushToUsers } from '@/lib/webPush'
import { rewardReferralsOnCheckout } from '@/lib/referrals'
import type { Subscription } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/** Böngésző-push az összes adminnak — best-effort, ne bukjon el emiatt a webhook-feldolgozás
 *  (a Stripe különben ismétli a kézbesítést). Dispute/fraud-gyanú időérzékeny, azonnal észre
 *  kell venni akkor is, ha épp nem néz be valaki a Backstage-be. */
async function pushToAdmins(payload: Payload, title: string, body: string) {
  try {
    const admins = await payload.find({
      collection: 'users', where: { role: { equals: 'admin' } }, limit: 200, depth: 0, overrideAccess: true,
    })
    await sendPushToUsers(payload, admins.docs.map((a) => a.id), { title, body, url: '/backstage', tag: 'stripe-alert' })
  } catch (err) {
    payload.logger.error(`stripe webhook admin push hiba: ${String(err)}`)
  }
}

/** A Stripe aláírás-ellenőrzés a NYERS body-t igényli — App Routerben `req.text()` adja. */
async function findSubBy(payload: Payload, field: 'stripe_subscription_id' | 'stripe_customer_id', value: string) {
  const res = await payload.find({
    collection: 'subscriptions',
    where: { [field]: { equals: value } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  return (res.docs[0] as Subscription | undefined) ?? null
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
          await applyCheckoutCompleted(payload, { ourSubId, stripeSub, custId, cycle })
          // ajánló program: a meghívott első előfizetésekor az AJÁNLÓ kap 1 hónapot (és a függő jóváírásai most mennek rá)
          await rewardReferralsOnCheckout(payload, ourSubId)
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

      // Sikeres ismétlődő terhelés (megújulás) → Számlázz.hu számla.
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice
        const custId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
        const our = custId ? await findSubBy(payload, 'stripe_customer_id', custId) : null
        if (our) await ensureInvoiceForStripeInvoice(payload, our, inv)
        break
      }

      // Próbaidő hamarosan lejár (~3 nappal előtte) → a fiók tulajdonosának ÖSSZES üzletébe
      // beírunk egy értesítést, ugyanaz a "helyenkénti" minta, mint a backstage körüzenetnél
      // (a notification-modell salon/restaurant + audience:'owner' szűrésű, nem közvetlen useres).
      case 'customer.subscription.trial_will_end': {
        const s = event.data.object as Stripe.Subscription
        const our = await findSubBy(payload, 'stripe_subscription_id', s.id)
        const ownerId = our?.owner != null ? (typeof our.owner === 'object' ? our.owner.id : our.owner) : null
        if (ownerId) {
          const [salons, restaurants] = await Promise.all([
            payload.find({ collection: 'salons', where: { owner: { equals: ownerId } }, limit: 200, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'restaurants', where: { owner: { equals: ownerId } }, limit: 200, depth: 0, overrideAccess: true }),
          ])
          const title = 'Hamarosan lejár a próbaidőszakod'
          const body = 'Adj meg egy fizetési módot a Beállítások → Előfizetés & számlázás oldalon, hogy zökkenőmentesen folytatódjon az előfizetésed.'
          for (const salon of salons.docs) {
            await payload.create({
              collection: 'notifications', overrideAccess: true,
              data: { audience: 'owner', type: 'trial_ending', title, body, salon: salon.id, read: false },
            }).catch((err) => payload.logger.error(`trial_ending notification create hiba (salon ${salon.id}): ${String(err)}`))
          }
          for (const restaurant of restaurants.docs) {
            await payload.create({
              collection: 'notifications', overrideAccess: true,
              data: { audience: 'owner', type: 'trial_ending', title, body, restaurant: restaurant.id, read: false },
            }).catch((err) => payload.logger.error(`trial_ending notification create hiba (restaurant ${restaurant.id}): ${String(err)}`))
          }
        }
        break
      }

      // Visszaterhelés (chargeback) → admin-értesítés, mert válaszadási határideje van.
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const amount = (dispute.amount / 100).toLocaleString('hu-HU')
        const dueBy = dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString('hu-HU')
          : 'ismeretlen'
        {
          const title = `Visszaterhelés érkezett: ${amount} ${dispute.currency.toUpperCase()}`
          const body = `Ok: ${dispute.reason}. Válaszadási határidő: ${dueBy}.`
          await payload.create({
            collection: 'notifications', overrideAccess: true,
            data: { audience: 'admin', type: 'dispute_created', title, body, read: false },
          }).catch((err) => payload.logger.error(`dispute_created notification create hiba: ${String(err)}`))
          await pushToAdmins(payload, title, body)
        }
        break
      }

      // Korai csalás-gyanú jelzés → admin-értesítés, mielőtt disputebe fordulna.
      case 'radar.early_fraud_warning.created': {
        const warning = event.data.object as Stripe.Radar.EarlyFraudWarning
        const chargeId = typeof warning.charge === 'string' ? warning.charge : warning.charge.id
        {
          const title = 'Korai csalás-gyanú jelzés érkezett'
          const actionable = warning.actionable ? 'Van még mit tenni (visszatéríthető).' : 'Már nincs mit tenni (vita indult vagy már visszatérítve).'
          const body = `Charge: ${chargeId}. Típus: ${warning.fraud_type}. ${actionable}`
          await payload.create({
            collection: 'notifications', overrideAccess: true,
            data: { audience: 'admin', type: 'fraud_warning', title, body, read: false },
          }).catch((err) => payload.logger.error(`fraud_warning notification create hiba: ${String(err)}`))
          await pushToAdmins(payload, title, body)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[Stripe webhook] feldolgozási hiba (${event.type}):`, err)
    return NextResponse.json({ error: 'Feldolgozási hiba' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
