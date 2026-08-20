import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, mapStripeStatus } from '@/lib/stripe'
import { applyCheckoutCompleted, ensureInvoiceForStripeInvoice } from '@/lib/stripeCheckoutSync'
import type { Subscription } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * A checkout-redirect (`?checkout=success&session_id=...`) UTÁNI azonnali fallback-ellenőrzés —
 * a kliens ezt hívja meg, amint visszaér a Stripe-tól. NEM helyettesíti a webhookot (az marad az
 * elsődleges, megbízható forrás minden KÉSŐBBI eseményhez — megújulás, lemondás stb.), csak azt a
 * rést zárja be, amikor a webhook lokálisan nem fut (`stripe listen` hiányzik) vagy késik: enélkül
 * a UI a fizetés UTÁN is "Próbaidőszak"-ot mutatna, és elmaradna a Számlázz.hu-s számla.
 *
 * A session ténylegesen a Stripe-nál igazolt fizetési állapotát olvassuk (`payment_status`) — ha a
 * fizetés valójában NEM sikerült (pl. a teszt-kártya elutasította), ezt hűen visszaadjuk, nem
 * hazudunk sikert csak azért, mert a redirect megtörtént.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés nincs konfigurálva.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as { sessionId?: string }
  if (!body.sessionId) return NextResponse.json({ error: 'Hiányzó session' }, { status: 400 })

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(body.sessionId, { expand: ['subscription'] })
  } catch {
    return NextResponse.json({ error: 'Érvénytelen session' }, { status: 404 })
  }

  // Csak a SAJÁT checkout-session-jét ellenőrizheti (nem valaki más session_id-jét sétáltatva be).
  if (session.metadata?.userId !== String(user.id)) {
    return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ ok: true, paid: false, status: session.payment_status })
  }

  const ourSubId = session.metadata?.subscriptionId
  const stripeSub = typeof session.subscription === 'object' ? (session.subscription as Stripe.Subscription) : null
  if (!ourSubId || !stripeSub) {
    return NextResponse.json({ ok: true, paid: true, status: 'unknown' })
  }

  const custId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const cycle = session.metadata?.cycle === 'annual' ? 'annual' : 'monthly'
  const payload = await getPayloadClient()

  await applyCheckoutCompleted(payload, { ourSubId, stripeSub, custId, cycle })

  // A számla-kiállítás rendesen az `invoice.paid` webhookon menne — fallbackként itt is
  // megpróbáljuk, ha az adott előfizetés legutóbbi számlája még nincs nálunk rögzítve.
  try {
    const invoices = await stripe.invoices.list({ subscription: stripeSub.id, limit: 1 })
    const latestInv = invoices.data[0]
    if (latestInv && latestInv.status === 'paid') {
      const our = await payload.findByID({ collection: 'subscriptions', id: ourSubId, depth: 0, overrideAccess: true }) as Subscription
      await ensureInvoiceForStripeInvoice(payload, our, latestInv)
    }
  } catch (e) {
    console.error('[checkout/verify] számla-fallback hiba:', e)
  }

  return NextResponse.json({ ok: true, paid: true, status: mapStripeStatus(stripeSub.status) })
}
