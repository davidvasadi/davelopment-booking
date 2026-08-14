import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('salon'), salonId: z.coerce.string(), code: z.string().min(1) }),
  z.object({ kind: z.literal('restaurant'), restaurantId: z.coerce.string(), code: z.string().min(1) }),
])

/**
 * Helyszíni (nem online-foglalásos) beváltás — a tulaj/személyzet a dashboard "Utalványok"
 * oldaláról hívja, kód kézi beírásával vagy kamerás QR-beolvasással. Önálló beváltás: NEM
 * hoz létre/igényel foglalás-rekordot, csak a voucher `status`-át állítja `redeemed`-re (a
 * `redeemed_booking`/`redeemed_reservation` mezők üresek maradnak ezen az úton).
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const data = parsed.data

  const payload = await getPayloadClient()
  const owns = data.kind === 'salon' ? await ownsThisSalon(payload, user, data.salonId) : await ownsThisRestaurant(payload, user, data.restaurantId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  const code = data.code.trim().toUpperCase()
  const result = await payload.find({
    collection: 'gift-vouchers',
    where: {
      and: [
        { code: { equals: code } },
        data.kind === 'salon' ? { salon: { equals: data.salonId } } : { restaurant: { equals: data.restaurantId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const voucher = result.docs[0]
  if (!voucher) return NextResponse.json({ error: 'Nincs ilyen kódú utalvány ennél az üzletnél.' }, { status: 404 })

  if (voucher.status !== 'active') {
    const labels: Record<string, string> = { redeemed: 'már be lett váltva', expired: 'lejárt', refunded: 'vissza lett térítve' }
    return NextResponse.json({ error: `Ez az utalvány ${labels[voucher.status] ?? 'nem aktív'}.` }, { status: 409 })
  }
  if (new Date(voucher.expires_at) < new Date()) {
    await payload.update({ collection: 'gift-vouchers', id: voucher.id, overrideAccess: true, data: { status: 'expired' } })
    return NextResponse.json({ error: 'Ez az utalvány lejárt.' }, { status: 409 })
  }

  const redeemed_at = new Date().toISOString()
  const doc = await payload.update({
    collection: 'gift-vouchers',
    id: voucher.id,
    overrideAccess: true,
    data: { status: 'redeemed', redeemed_at },
  })

  return NextResponse.json({
    id: doc.id,
    code: doc.code,
    status: doc.status,
    redeemed_at: doc.redeemed_at,
  })
}
