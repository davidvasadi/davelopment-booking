import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'
import type { Salon, Restaurant } from '@/payload/payload-types'

type Ctx = { params: Promise<{ id: string }> }

async function clampToVoucherRange(payload: Awaited<ReturnType<typeof getPayloadClient>>, kind: 'salon' | 'restaurant', businessId: string | number, amountHuf: number): Promise<number> {
  const business = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: businessId, depth: 0, overrideAccess: true }).catch(() => null)) as (Salon | Restaurant | null)
  const min = business?.voucher_settings?.min_amount_huf ?? 0
  const max = business?.voucher_settings?.max_amount_huf ?? Number.MAX_SAFE_INTEGER
  return Math.min(Math.max(Math.round(amountHuf), min), max)
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'gift-voucher-types', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const owns = existing.salon ? await ownsThisSalon(payload, user, existing.salon) : await ownsThisRestaurant(payload, user, existing.restaurant)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  // A tulajdonos (salon/restaurant) szerkesztéskor nem változhat — a klienstől jövő értéket
  // eldobjuk (ne is próbáljuk típus-konvertálni), a meglévő rekordét visszük tovább.
  const { salon: _salon, restaurant: _restaurant, ...data }: Record<string, unknown> = { ...body }
  if (body.amount_huf != null) {
    const kind = existing.salon ? 'salon' : 'restaurant'
    const businessId = (existing.salon ?? existing.restaurant) as string | number
    data.amount_huf = await clampToVoucherRange(payload, kind, businessId, Number(body.amount_huf) || 0)
  }

  try {
    const doc = await payload.update({ collection: 'gift-voucher-types', id, data: data as never, overrideAccess: true })
    return NextResponse.json({ doc })
  } catch (e) {
    console.error('[api/gift-voucher-types PATCH]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'gift-voucher-types', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const owns = existing.salon ? await ownsThisSalon(payload, user, existing.salon) : await ownsThisRestaurant(payload, user, existing.restaurant)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    await payload.delete({ collection: 'gift-voucher-types', id, overrideAccess: true })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/gift-voucher-types DELETE]', e)
    return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
  }
}
