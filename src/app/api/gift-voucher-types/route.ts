import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'
import type { Salon, Restaurant } from '@/payload/payload-types'

/**
 * Ajándékutalvány-típusok listázása/létrehozása — a `Services`-route pontos mintája, csak
 * polimorf (salon VAGY restaurant). A `amount_huf` a business `voucher_settings.min/max_amount_huf`
 * sávjához van szorítva (a beállítások mezők itt kapnak értelmet: a szabad vendég-összeg helyett
 * a tulaj által létrehozható típusok határát adják).
 */

async function clampToVoucherRange(payload: Awaited<ReturnType<typeof getPayloadClient>>, kind: 'salon' | 'restaurant', businessId: string | number, amountHuf: number): Promise<number> {
  const business = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: businessId, depth: 0, overrideAccess: true }).catch(() => null)) as (Salon | Restaurant | null)
  const min = business?.voucher_settings?.min_amount_huf ?? 0
  const max = business?.voucher_settings?.max_amount_huf ?? Number.MAX_SAFE_INTEGER
  return Math.min(Math.max(Math.round(amountHuf), min), max)
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const salonId = sp.get('salonId')
  const restaurantId = sp.get('restaurantId')
  if (!salonId && !restaurantId) return NextResponse.json({ error: 'salonId vagy restaurantId kötelező' }, { status: 400 })

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'gift-voucher-types',
    where: salonId ? { salon: { equals: salonId } } : { restaurant: { equals: restaurantId! } },
    sort: 'amount_huf',
    limit: 100,
    overrideAccess: true,
  })
  return NextResponse.json({ docs: result.docs })
}

export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const salonId = body.salon as string | number | undefined
  const restaurantId = body.restaurant as string | number | undefined
  if (!salonId && !restaurantId) return NextResponse.json({ error: 'salon vagy restaurant kötelező' }, { status: 400 })

  const payload = await getPayloadClient()
  const owns = salonId ? await ownsThisSalon(payload, user, salonId) : await ownsThisRestaurant(payload, user, restaurantId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  const amountHuf = await clampToVoucherRange(payload, salonId ? 'salon' : 'restaurant', (salonId ?? restaurantId)!, Number(body.amount_huf) || 0)

  try {
    const doc = await payload.create({
      collection: 'gift-voucher-types',
      data: {
        ...body,
        ...(salonId ? { salon: Number(salonId) } : {}),
        ...(restaurantId ? { restaurant: Number(restaurantId) } : {}),
        amount_huf: amountHuf,
      } as never,
      overrideAccess: true,
    })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e) {
    console.error('[api/gift-voucher-types POST]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
