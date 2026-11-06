import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { closeBookingWithPayment } from '@/lib/bookingCheckout'
import type { Booking, Salon } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/salon/booking-checkout — a foglalás lezárása a helyszíni fizetéssel (design 6.7.1).
 *  - `skip`: „Fizetés nélkül zárom” — csak Befejezett, bevétel nem rögzül.
 *  - különben: a tételek (szolgáltatás + termék), a fizetési mód; a levonások (a már fizetett előleg, a beváltott
 *    utalvány) a foglalásból jönnek, nem a klienstől. A fizetendő = tételek − levonások.
 *  - bizonylat: pénztárgépes üzletnél csak rögzítés („register”); számlázós üzletnél, ha a vendég kér számlát:
 *    előleg NÉLKÜL a rendszer kiállítja (a kiállító: az üzlet vagy szakemberenként a szakember — lib/payee),
 *    előleges foglalásnál a végszámlát első körben kézzel kell kiállítani („manual” — a Számlák listában látszik);
 *    nem kért számlát: „none”.
 */
const schema = z.object({
  bookingId: z.union([z.string(), z.number()]),
  skip: z.boolean().optional(),
  lines: z.array(z.object({ name: z.string().trim().min(1).max(120), amount: z.number().int().min(0).max(10_000_000) })).max(30).optional(),
  method: z.enum(['cash', 'card', 'transfer']).optional(),
  invoice: z.boolean().optional(),
  buyer: z.object({
    name: z.string().trim().max(160), email: z.string().trim().max(200).optional(), taxNumber: z.string().trim().max(20).optional(),
    zip: z.string().trim().max(10).optional(), city: z.string().trim().max(80).optional(), address: z.string().trim().max(200).optional(),
  }).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  const b = parsed.data

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })
  const denied = await assertCapability(user.id, 'salon', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const booking = (await payload.findByID({ collection: 'bookings', id: b.bookingId, depth: 0, overrideAccess: true }).catch(() => null)) as Booking | null
  const salonId = booking && (typeof booking.salon === 'object' ? booking.salon.id : booking.salon)
  if (!booking || String(salonId) !== String(active.id)) return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Lemondott foglalás nem zárható le' }, { status: 400 })
  if (booking.paid_at) return NextResponse.json({ error: 'Ez a foglalás már le van zárva fizetéssel' }, { status: 409 })

  if (b.skip) {
    await payload.update({ collection: 'bookings', id: booking.id, overrideAccess: true, user, data: { status: 'completed' } })
    return NextResponse.json({ ok: true })
  }

  const salon = (await payload.findByID({ collection: 'salons', id: active.id, depth: 0, overrideAccess: true })) as Salon
  const { due, receipt } = await closeBookingWithPayment(payload, booking, salon, { lines: b.lines ?? [], method: b.method ?? 'cash', invoice: !!b.invoice, buyer: b.buyer }, user)

  return NextResponse.json({ ok: true, due, receipt })
}
