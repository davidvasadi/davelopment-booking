import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { getStripe } from '@/lib/stripe'
import { getPayloadClient } from '@/lib/payload'
import { isAccountFullyOnboarded } from '@/lib/stripeConnect'
import { createGiftVoucher } from '@/lib/createGiftVoucher'
import type { Salon, Restaurant } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * KÜLÖN webhook a platform-előfizetési webhooktól (`src/app/api/stripe/webhook/route.ts`) —
 * ez a Stripe Dashboard "events on connected accounts" regisztrációjához tartozik, saját
 * `STRIPE_CONNECT_WEBHOOK_SECRET`-tel. A Connect-eseményeken (`account.updated`, és a
 * csatlakoztatott számlán keletkező `payment_intent.*`/`charge.refunded`) az `event.account`
 * mező hordozza a csatlakoztatott számla id-ját.
 *
 * Mivel az account id önmagában nem árulja el, hogy szalonhoz vagy étteremhez tartozik,
 * MINDKÉT collectionben keresünk.
 */

async function findBusinessByConnectAccount(payload: Payload, accountId: string) {
  const [salons, restaurants] = await Promise.all([
    payload.find({ collection: 'salons', where: { stripe_connect_account_id: { equals: accountId } }, limit: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { stripe_connect_account_id: { equals: accountId } }, limit: 1, overrideAccess: true }),
  ])
  if (salons.docs[0]) return { collection: 'salons' as const, doc: salons.docs[0] }
  if (restaurants.docs[0]) return { collection: 'restaurants' as const, doc: restaurants.docs[0] }
  return null
}

async function findBookingByPaymentIntent(payload: Payload, paymentIntentId: string) {
  const [bookings, reservations] = await Promise.all([
    payload.find({ collection: 'bookings', where: { payment_intent_id: { equals: paymentIntentId } }, limit: 1, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { payment_intent_id: { equals: paymentIntentId } }, limit: 1, overrideAccess: true }),
  ])
  if (bookings.docs[0]) return { collection: 'bookings' as const, doc: bookings.docs[0] }
  if (reservations.docs[0]) return { collection: 'reservations' as const, doc: reservations.docs[0] }
  return null
}

export async function POST(req: Request) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!stripe || !secret) return NextResponse.json({ error: 'A fizetés nincs konfigurálva.' }, { status: 503 })

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Hiányzó aláírás' }, { status: 400 })

  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    console.error('[Stripe Connect webhook] aláírás-ellenőrzés hibás:', err)
    return NextResponse.json({ error: 'Érvénytelen aláírás' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  try {
    switch (event.type) {
      // Onboarding-állapot változás — mindkét irányban idempotens (bekapcsolt fiók
      // korlátozódhat is, ilyenkor visszaáll false-ra).
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const business = await findBusinessByConnectAccount(payload, account.id)
        if (business) {
          await payload.update({
            collection: business.collection,
            id: business.doc.id,
            overrideAccess: true,
            data: { stripe_connect_onboarded: isAccountFullyOnboarded(account) },
          })
        }
        break
      }

      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent

        // Ajándékutalvány — admin által küldött fizetési link sikeres fizetése (a guest
        // online-vásárlás flow-ja NEM ide fut be, azt a kliens hívja meg közvetlenül a
        // `/api/vouchers` route-on, ez itt csak a link-alapú útra vonatkozik). A metadata a
        // `manual-create` route-ban lett feltöltve. Dupla-védelem: ha már létezik voucher
        // ezzel a payment_intent_id-vel (pl. a kliens-oldal is lefutott), nem hoz létre újat.
        // A vendég-vásárlás (`gift-voucher-guest`) ide nem tartozik. A régi, még `gift-voucher`
        // jelölésű vendég-intentek vevő-adat nélküliek — ezeket is kihagyjuk, különben a webhook
        // a kliens `/api/vouchers` hívása ELŐTT név/e-mail nélkül hozná létre az utalványt.
        if (intent.metadata?.kind === 'gift-voucher' && intent.metadata?.purchaserEmail) {
          const existing = await payload.find({ collection: 'gift-vouchers', where: { payment_intent_id: { equals: intent.id } }, limit: 1, overrideAccess: true })
          if (existing.totalDocs === 0) {
            const md = intent.metadata
            const kind: 'salon' | 'restaurant' = md.salonId ? 'salon' : 'restaurant'
            const business = kind === 'salon'
              ? ((await payload.findByID({ collection: 'salons', id: md.salonId, overrideAccess: true }).catch(() => null)) as Salon | null)
              : ((await payload.findByID({ collection: 'restaurants', id: md.restaurantId, overrideAccess: true }).catch(() => null)) as Restaurant | null)
            if (business) {
              await createGiftVoucher({
                paymentMethod: 'payment_link',
                kind,
                business,
                amountHuf: Math.round(intent.amount / 100),
                voucherTypeId: md.voucherTypeId,
                paymentIntentId: intent.id,
                buyer: { name: md.purchaserName, email: md.purchaserEmail, city: md.purchaserCity, address: md.purchaserAddress, taxNumber: md.purchaserTaxNumber || undefined },
                recipient: { name: md.recipientName || undefined, email: md.recipientEmail || undefined, message: md.message || undefined },
              })
            }
          }
          break
        }

        const found = await findBookingByPaymentIntent(payload, intent.id)
        if (found && (found.doc as { payment_status?: string }).payment_status !== 'paid') {
          await payload.update({ collection: found.collection, id: found.doc.id, overrideAccess: true, data: { payment_status: 'paid', deposit_paid: true } })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const found = await findBookingByPaymentIntent(payload, intent.id)
        if (found) {
          await payload.update({ collection: found.collection, id: found.doc.id, overrideAccess: true, data: { payment_status: 'failed' } })
        }
        break
      }

      // Belt-and-suspenders: a szinkron refund a cancel route-ban már beállítja ezt — ez az
      // esetleges késés/hiba esetére a webhook felőli megerősítés, idempotens no-op ha már kész.
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (intentId) {
          const found = await findBookingByPaymentIntent(payload, intentId)
          if (found && !(found.doc as { deposit_refunded?: boolean }).deposit_refunded) {
            await payload.update({ collection: found.collection, id: found.doc.id, overrideAccess: true, data: { payment_status: 'refunded', deposit_refunded: true } })
          }
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[Stripe Connect webhook] feldolgozási hiba (${event.type}):`, err)
    return NextResponse.json({ error: 'Feldolgozási hiba' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
