import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { findAccountSubscription, syncAccountSubscription } from '@/lib/accountSubscription'

/**
 * POST /api/subscription/select
 *   body: { type: 'salon'|'restaurant', id: string, tier: 'pro'|'egyedi', cycle: 'monthly'|'annual' }
 *
 * SZÁNDÉKOS csomag-választás: egy BIRTOKOLT üzlet tierjét ÉS a fiók számlázási ciklusát EGYSZERRE
 * állítja (a havi/éves toggle csak előnézet a kliensen — a tényleges átállás csak itt, kiválasztáskor
 * történik, hogy egy meglévő előfizetés ne számolódjon át menet közben).
 *
 * Stripe: TRIAL (nem-fizető) fióknál a ciklusváltás azonnal érvényesül, terhelés nélkül (a majdani
 * Checkout a helyes ciklussal indul). FIZETŐ fióknál (`stripe_subscription_id`) a havi↔éves váltást
 * NEM írjuk némán felül — az a Stripe-nál intervallum-váltás (proration), amit a felhasználó a Billing
 * Portalon / új fizetéssel intézzen. Így a mi árunk sosem csúszik el a Stripe-tól. A választ
 * `cycleLocked`-kal jelöljük, hogy a UI a Portal felé irányíthasson.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { type?: string; id?: string; tier?: string; cycle?: string }
  const collection = body.type === 'salon' ? 'salons' : body.type === 'restaurant' ? 'restaurants' : null
  const tier = body.tier === 'egyedi' ? 'egyedi' : body.tier === 'pro' ? 'pro' : null
  const cycle = body.cycle === 'annual' ? 'annual' : body.cycle === 'monthly' ? 'monthly' : null
  if (!collection || !tier || !body.id) {
    return NextResponse.json({ error: 'Érvénytelen kérés' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  // RBAC: `billing.manage` (owner-only) az érintett üzletben.
  const denied = await assertCapability(user.id, collection === 'salons' ? 'salon' : 'restaurant', body.id, 'billing.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const biz = await payload.findByID({ collection, id: body.id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!biz) return NextResponse.json({ error: 'Nincs ilyen üzlet' }, { status: 404 })

  // 1) Az üzlet tierje (field-szintű admin-only write → overrideAccess a kontrollált úton).
  await payload.update({ collection, id: body.id, data: { tier }, overrideAccess: true })

  // 2) A fiók számlázási ciklusa (csak ha kaptunk érvényeset és tér el).
  //    Fizető fiónál (van élő Stripe-sub) a ciklust NEM váltjuk itt — a Stripe-nál az
  //    intervallum-váltás proration-t igényel; a felhasználó a Billing Portalon intézze.
  const sub = await findAccountSubscription({ payload }, user.id)
  const isPaidWithStripe = !!sub?.stripe_subscription_id
  let cycleLocked = false
  if (sub && cycle && cycle !== sub.billing_cycle) {
    if (isPaidWithStripe) {
      cycleLocked = true // a UI a Billing Portal felé irányít; a mostani ciklus marad
    } else {
      await payload.update({ collection: 'subscriptions', id: sub.id, data: { billing_cycle: cycle }, overrideAccess: true })
    }
  }

  // 3) Effektív díj újraszámolása (tier + ciklus alapján).
  await syncAccountSubscription({ payload }, user.id)

  return NextResponse.json({ ok: true, tier, cycle: cycleLocked ? sub?.billing_cycle : cycle, cycleLocked })
}
