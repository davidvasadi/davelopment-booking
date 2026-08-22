import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'
import { sendVoucherPaymentLinkEmail } from '@/lib/email'
import { sendVoucherPaymentLinkEmail as sendRestaurantVoucherPaymentLinkEmail } from '@/lib/restaurantEmail'
import type { Salon, Restaurant } from '@/payload/payload-types'

const buyerFields = {
  url: z.string().url(),
  purchaserName: z.string().min(1),
  purchaserEmail: z.string().email(),
  amountHuf: z.coerce.number().int().positive(),
  typeName: z.string().optional(),
}
const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('salon'), salonId: z.coerce.string(), ...buyerFields }),
  z.object({ kind: z.literal('restaurant'), restaurantId: z.coerce.string(), ...buyerFields }),
])

/**
 * A dashboard "fizetési link" wizard "Elküldés emailben" gombja hívja — owner-hitelesített, a
 * korábban létrehozott Checkout Session linkjét küldi el a vásárlónak, a stílus a meglévő
 * `sendVoucherPurchaseEmail`-mintát követi, de MÁSODIK, önálló email-típusként (a kód/QR csak a
 * sikeres fizetés után, külön emailben megy).
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const data = parsed.data

  const payload = await getPayloadClient()
  const denied = data.kind === 'salon'
    ? await assertCapability(user.id, 'salon', data.salonId, 'vouchers.manage')
    : await assertCapability(user.id, 'restaurant', data.restaurantId, 'vouchers.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  try {
    if (data.kind === 'salon') {
      const salon = (await payload.findByID({ collection: 'salons', id: data.salonId, overrideAccess: true })) as Salon
      await sendVoucherPaymentLinkEmail({ salon, purchaserName: data.purchaserName, purchaserEmail: data.purchaserEmail, amountHuf: data.amountHuf, typeName: data.typeName, url: data.url })
    } else {
      const restaurant = (await payload.findByID({ collection: 'restaurants', id: data.restaurantId, overrideAccess: true })) as Restaurant
      await sendRestaurantVoucherPaymentLinkEmail({ restaurant, purchaserName: data.purchaserName, purchaserEmail: data.purchaserEmail, amountHuf: data.amountHuf, typeName: data.typeName, url: data.url })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gift-vouchers/send-link-email]', err)
    return NextResponse.json({ error: 'Nem sikerült elküldeni az emailt.' }, { status: 500 })
  }
}
