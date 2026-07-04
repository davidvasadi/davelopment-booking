import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription, syncAccountSubscription } from '@/lib/accountSubscription'

/**
 * POST /api/subscription/select
 *   body: { type: 'salon'|'restaurant', id: string, tier: 'pro'|'egyedi', cycle: 'monthly'|'annual' }
 *
 * SZÁNDÉKOS csomag-választás: egy BIRTOKOLT üzlet tierjét ÉS a fiók számlázási ciklusát EGYSZERRE
 * állítja (a havi/éves toggle csak előnézet a kliensen — a tényleges átállás csak itt, kiválasztáskor
 * történik, hogy egy meglévő előfizetés ne számolódjon át menet közben).
 *
 * Megj.: online fizetés (Stripe) még nincs — a váltás egyelőre azonnal érvényesül, terhelés nélkül.
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

  // Ownership-ellenőrzés: csak a saját üzlet csomagját állíthatja.
  const biz = await payload.findByID({ collection, id: body.id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!biz) return NextResponse.json({ error: 'Nincs ilyen üzlet' }, { status: 404 })
  const ownerId = biz.owner && typeof biz.owner === 'object' ? biz.owner.id : biz.owner
  if (String(ownerId) !== String(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 1) Az üzlet tierje (field-szintű admin-only write → overrideAccess a kontrollált úton).
  await payload.update({ collection, id: body.id, data: { tier }, overrideAccess: true })

  // 2) A fiók számlázási ciklusa (csak ha kaptunk érvényeset és tér el).
  const sub = await findAccountSubscription({ payload }, user.id)
  if (sub && cycle && cycle !== sub.billing_cycle) {
    await payload.update({ collection: 'subscriptions', id: sub.id, data: { billing_cycle: cycle }, overrideAccess: true })
  }

  // 3) Effektív díj újraszámolása (tier + ciklus alapján).
  await syncAccountSubscription({ payload }, user.id)

  return NextResponse.json({ ok: true, tier, cycle })
}
