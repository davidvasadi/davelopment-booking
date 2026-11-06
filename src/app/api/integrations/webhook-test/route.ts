import { NextRequest, NextResponse } from 'next/server'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'
import { postWebhook } from '@/lib/outboundWebhook'

export const dynamic = 'force-dynamic'

/** Beállítások › API & integrációk „Próba-küldés” (design 16.15.2): egy minta-foglalás a megadott (még nem mentett is
 *  lehet) webhook-címre, `test: true` jelöléssel. Visszaadja, mit válaszolt a cím. */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const body = await request.json().catch(() => null) as { kind?: string; businessId?: string; url?: string } | null
  const kind = body?.kind
  if ((kind !== 'salon' && kind !== 'restaurant') || !body?.businessId || !body.url) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const businessId = /^\d+$/.test(body.businessId) ? Number(body.businessId) : body.businessId
  const denied = await assertAnyCapability(user.id, kind, businessId, ['settings.profile'])
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const today = new Date().toISOString().slice(0, 10)
  const r = await postWebhook(body.url, 'booking.created', {
    business: { type: kind, id: String(businessId), name: 'Minta üzlet' },
    booking: {
      id: 'test', status: 'confirmed', date: today, start_time: '14:00', end_time: '15:00',
      customer_name: 'Minta Vendég', customer_email: 'vendeg@example.com', customer_phone: '+36 30 123 4567', notes: 'Próba-küldés',
      ...(kind === 'salon' ? { service: 'Minta szolgáltatás', staff: 'Minta munkatárs' } : { pax: 2, table: 'Asztal 1' }),
    },
  }, true)
  if (!r.ok) return NextResponse.json({ error: r.error ?? `A cím ${r.status} kóddal válaszolt.` }, { status: 400 })
  return NextResponse.json({ ok: true, status: r.status })
}
