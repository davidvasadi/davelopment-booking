import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getStripe } from '@/lib/stripe'
import { findAccountSubscription } from '@/lib/accountSubscription'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Stripe Billing Portal session indítása. A portál a Stripe-hoszt oldala, ahol a fizető ügyfél
 * a SAJÁT előfizetését kezeli: bankkártya csere, számlák letöltése, lemondás. Nálunk kevés kódot
 * igényel, és mindig naprakész — a változásokat a Stripe-webhook (`customer.subscription.updated`)
 * szinkronizálja vissza a mi `subscriptions` sorunkba.
 *
 * Csak akkor van értelme, ha a fióknak van Stripe-customerje (azaz már indított legalább egy
 * Checkoutot). Trial-fióknál (még nincs customer) 400-at adunk — ott a Checkout gomb a helyes út.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  const body = (await req.json().catch(() => ({}))) as { returnPath?: string }
  const returnPath =
    typeof body.returnPath === 'string' && body.returnPath.startsWith('/') ? body.returnPath : '/dashboard/subscription'

  const payload = await getPayloadClient()
  const sub = await findAccountSubscription({ payload }, user.id)
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'Még nincs aktív fizetés ehhez a fiókhoz.' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${APP_URL}${returnPath}`,
  })

  return NextResponse.json({ url: session.url })
}
