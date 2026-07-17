import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/subscription/cancel
 *
 * A FIÓK (account-level) előfizetésének lemondása / visszavonása (`{ undo: true }`) a
 * `cancel_at_period_end` flag váltásával. Egy fiók = egy előfizetés, ezért az egész fiók
 * (minden üzlet) számlázása mondódik le egyszerre.
 *
 * KRITIKUS: ha a fiók már FIZETŐ (van `stripe_subscription_id`), a Stripe-nál is be kell
 * állítani a `cancel_at_period_end`-et, különben a Stripe a lemondás ellenére tovább terhelne.
 * A tényleges státusz-változást a `customer.subscription.updated` webhook szinkronizálja
 * vissza — a DB-t itt is frissítjük, hogy az UI azonnal a helyes állapotot mutassa.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { undo?: boolean }
  const undo = body.undo === true

  const payload = await getPayloadClient()
  const sub = await findAccountSubscription({ payload }, user.id)
  if (!sub) return NextResponse.json({ error: 'No subscription' }, { status: 404 })

  // Ha van Stripe-előfizetés, a lemondás/visszavonás a Stripe-nál is történjen meg.
  // Best-effort: ha a Stripe-hívás elbukik, NE hagyjuk a DB-t inkonzisztensen — hibát adunk,
  // hogy a felhasználó lássa, a lemondás nem ment át (ne higgye lemondottnak, míg a Stripe terhel).
  const stripe = getStripe()
  if (stripe && sub.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: !undo })
    } catch (e) {
      console.error('[subscription/cancel] Stripe update sikertelen', e)
      return NextResponse.json({ error: 'A lemondás a fizetési szolgáltatónál nem sikerült. Próbáld újra.' }, { status: 502 })
    }
  }

  const updated = await payload.update({
    collection: 'subscriptions',
    id: sub.id,
    data: { cancel_at_period_end: !undo },
    overrideAccess: true,
  })

  return NextResponse.json({ subscription: updated })
}
