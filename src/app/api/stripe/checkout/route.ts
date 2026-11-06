import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { computeAccountFee, getOrCreateAccountSubscription } from '@/lib/accountSubscription'
import { applyCycle } from '@/lib/tier'
import { getPricing } from '@/lib/pricing'
import { BRAND_NAME } from '@/lib/brand'
import { getActiveBusiness } from '@/lib/activeBusiness'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

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

  // A számlázási adatok kötelezők a fizetés előtt (a felület is kéri, de ez a kapu nem kerülhető meg): nélkülük nem
  // tudunk szabályos számlát kiállítani. Az aktív üzlet adatai — ugyanazok, amiket az Előfizetés lap szerkeszt.
  const { active } = await getActiveBusiness(user)
  if (active) {
    const biz = (await payload.findByID({ collection: active.type === 'salon' ? 'salons' : 'restaurants', id: active.id, depth: 0, overrideAccess: true }).catch(() => null)) as Record<string, unknown> | null
    const missing = (['legal_name', 'billing_email', 'billing_postal_code', 'billing_city', 'billing_street'] as const).filter((k) => !String(biz?.[k] ?? '').trim())
    if (!biz || missing.length) {
      return NextResponse.json({ error: 'Töltsd ki a számlázási adatokat a fizetés előtt.', missingBilling: missing }, { status: 400 })
    }
  }
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

  // Külön ellenőrzés a KEDVEZMÉNY UTÁNI végösszegre is — egy elrontott/szélsőséges
  // annual_discount_pct (pl. tévedésből 100%) a fenti guardot megkerülve 0 Ft-os Stripe
  // session-t hozna létre, ami valódi fizetés nélkül "sikeresnek" tűnne.
  if (unitForint <= 0) {
    return NextResponse.json({ error: 'Érvénytelen előfizetési díj (0 Ft). Ellenőrizd az árazási beállításokat.' }, { status: 400 })
  }

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
    // Csak kártya — más fizetési mód (pl. Revolut Pay) nem menthető el újra-terhelhető
    // alapértelmezett fizetési módként egy előfizetéshez. E nélkül Stripe csendben (hiba
    // nélkül) létrehozza az előfizetést valódi terhelés nélkül, a díjat a vevő Stripe-
    // egyenlegére írva tartozásként, a számlát pedig tévesen "paid"-nek jelölve.
    payment_method_types: ['card'],
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
    success_url: `${APP_URL}${returnPath}${returnPath.includes('?') ? '&' : '?'}checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}${returnPath}${returnPath.includes('?') ? '&' : '?'}checkout=cancel`,
    metadata: { userId: String(user.id), subscriptionId: String(sub.id), cycle },
    subscription_data: { metadata: { userId: String(user.id), subscriptionId: String(sub.id), cycle } },
  })

  return NextResponse.json({ url: session.url })
}
