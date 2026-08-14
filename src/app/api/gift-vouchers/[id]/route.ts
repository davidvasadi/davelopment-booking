import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({ status: z.enum(['active', 'redeemed', 'expired', 'refunded']) })

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

  const owns = existing.salon ? await ownsThisSalon(payload, user, existing.salon) : await ownsThisRestaurant(payload, user, existing.restaurant)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

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

  const owns = existing.salon ? await ownsThisSalon(payload, user, existing.salon) : await ownsThisRestaurant(payload, user, existing.restaurant)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  await payload.delete({ collection: 'gift-vouchers', id, overrideAccess: true })
  return NextResponse.json({ success: true })
}
