import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'
import { fixMediaUrl } from '@/lib/utils'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({ status: z.enum(['active', 'redeemed', 'expired', 'refunded']) })

/**
 * Egy utalvány RÉSZLETEI a dashboard részletes nézetéhez (lista-sorra kattintva) — vásárló,
 * megajándékozott, üzenet, fizetés, számla, beváltás, QR. Megtekintési (`vouchers.view`) vagy
 * kezelési joggal.
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const { id } = await params
  const payload = await getPayloadClient()
  const v = await payload.findByID({ collection: 'gift-vouchers', id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!v) return NextResponse.json({ error: 'Nem található' }, { status: 404 })
  const kind = v.salon ? 'salon' : 'restaurant'
  const bizRef = v.salon ?? v.restaurant
  const bizId = bizRef && typeof bizRef === 'object' ? (bizRef as { id: string | number }).id : bizRef
  const deniedView = await assertCapability(user.id, kind, bizId as string, 'vouchers.view')
  const deniedManage = deniedView ? await assertCapability(user.id, kind, bizId as string, 'vouchers.manage') : null
  if (deniedView && deniedManage) return NextResponse.json({ error: deniedManage.error }, { status: deniedManage.status })

  const ref = (r: unknown) => (r && typeof r === 'object' ? r as { id: string | number; date?: string; start_time?: string; customer_name?: string } : null)
  const rb = ref(v.redeemed_booking) ?? ref(v.redeemed_reservation)
  return NextResponse.json({
    id: String(v.id),
    code: v.code,
    amount_huf: v.amount_huf,
    type_name: v.type_name ?? null,
    status: v.status,
    payment_method: v.payment_method ?? null,
    purchaser_name: v.purchaser_name,
    purchaser_email: v.purchaser_email,
    recipient_name: v.recipient_name ?? null,
    recipient_email: v.recipient_email ?? null,
    message: v.message ?? null,
    expires_at: v.expires_at,
    redeemed_at: v.redeemed_at ?? null,
    redeemed_for: rb ? { date: rb.date ?? null, time: rb.start_time ?? null, name: rb.customer_name ?? null } : null,
    invoice_status: v.invoice_status ?? 'none',
    invoice_number: v.invoice_number ?? null,
    invoice_pdf_url: v.invoice_pdf_url ?? null,
    qr_code_url: v.qr_code_url ?? null,
    createdAt: v.createdAt,
    // ki állította ki: dashboard-felhasználó, vagy null (vendég online vásárlása / régi rekord)
    issued_by: v.issued_by && typeof v.issued_by === 'object'
      ? {
          name: (v.issued_by as { name?: string | null }).name ?? null,
          email: (v.issued_by as { email?: string | null }).email ?? null,
          avatarUrl: fixMediaUrl((v.issued_by as { avatar_url?: string | null }).avatar_url) ?? null,
        }
      : null,
  })
}

/**
 * Kézi státusz-módosítás a dashboard "Utalványok" listájából (StaffManager-mintájú
 * kattintható pill + legördülő) — szabad felülbírálás bármelyik irányba (pl. tévesen
 * beváltott visszaállítása aktívra, vagy visszatérítés jelölése), a felelősség a
 * személyzeté, nincs extra üzleti szabály.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'gift-vouchers', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const denied = existing.salon
    ? await assertCapability(user.id, 'salon', existing.salon, 'vouchers.manage')
    : await assertCapability(user.id, 'restaurant', existing.restaurant, 'vouchers.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const { status } = parsed.data
  const doc = await payload.update({
    collection: 'gift-vouchers',
    id,
    overrideAccess: true,
    data: {
      status,
      ...(status === 'redeemed' && !existing.redeemed_at ? { redeemed_at: new Date().toISOString() } : {}),
    },
  })

  return NextResponse.json({ id: doc.id, status: doc.status, redeemed_at: doc.redeemed_at })
}

/**
 * Utalvány-rekord törlése a dashboard listából (StaffManager törlés-mintája) — a tulaj/
 * személyzet takaríthatja a listát (pl. teszt-rekordok), a Stripe-tranzakció/számla ettől
 * függetlenül megmarad a szolgáltatóknál, ez csak a mi rekordunkat törli.
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'gift-vouchers', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const denied = existing.salon
    ? await assertCapability(user.id, 'salon', existing.salon, 'vouchers.manage')
    : await assertCapability(user.id, 'restaurant', existing.restaurant, 'vouchers.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  await payload.delete({ collection: 'gift-vouchers', id, overrideAccess: true })
  return NextResponse.json({ success: true })
}
