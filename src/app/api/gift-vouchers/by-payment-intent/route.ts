import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getStripe } from '@/lib/stripe'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'
import type { Salon, Restaurant } from '@/payload/payload-types'

/**
 * A dashboard "fizetési link" wizard-lépése ezt pollozza (owner-hitelesített), hogy ÉLŐBEN
 * lássa, mikor fizetett a vendég — a Connect webhook aszinkron hozza létre a voucher-rekordot
 * (a vendég a SAJÁT eszközén fizet, nincs böngésző-visszahívás), ez a route ad live
 * visszajelzést a dashboardnak anélkül, hogy a vendégre/webhookra kellene várni külön oldalon.
 *
 * `sessionId`-t kap (a Checkout Session ID-ja, MINDIG megvan a session-létrehozás válaszában) —
 * NEM a kliens által korábban elmentett `payment_intent`-et, mert az a session-létrehozás
 * pillanatában nem feltétlenül populált még szinkron módon. Itt minden pollozáskor FRISSEN
 * lekérjük a session-t a Stripe-tól, hogy biztosan a valós payment_intent-tel keressünk.
 */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const sp = request.nextUrl.searchParams
  const sessionId = sp.get('sessionId')
  const salonId = sp.get('salonId')
  const restaurantId = sp.get('restaurantId')
  if (!sessionId || (!salonId && !restaurantId)) {
    return NextResponse.json({ error: 'Hiányzó paraméterek' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const owns = salonId ? await ownsThisSalon(payload, user, salonId) : await ownsThisRestaurant(payload, user, restaurantId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  const business =
    salonId
      ? ((await payload.findByID({ collection: 'salons', id: salonId, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | null)
      : ((await payload.findByID({ collection: 'restaurants', id: restaurantId!, depth: 0, overrideAccess: true }).catch(() => null)) as Restaurant | null)
  if (!business?.stripe_connect_account_id) return NextResponse.json({ found: false })

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ found: false })

  const session = await stripe.checkout.sessions.retrieve(sessionId, undefined, { stripeAccount: business.stripe_connect_account_id }).catch(() => null)
  const paymentIntentId = typeof session?.payment_intent === 'string' ? session.payment_intent : session?.payment_intent?.id
  if (!paymentIntentId) return NextResponse.json({ found: false })

  const result = await payload.find({
    collection: 'gift-vouchers',
    where: { payment_intent_id: { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const voucher = result.docs[0]
  if (!voucher) return NextResponse.json({ found: false })

  return NextResponse.json({ found: true, code: voucher.code, amountHuf: voucher.amount_huf, qrCodeDataUrl: voucher.qr_code_url })
}
