import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { validateAndAllocate } from '@/lib/restaurantBooking'
import { sendReservationConfirmation, sendReservationNotification } from '@/lib/restaurantEmail'
import type { Restaurant, Reservation } from '@/payload/payload-types'

const schema = z.object({
  restaurantId: z.coerce.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }
  const { restaurantId, date, start_time, pax, customer_name, customer_email, customer_phone, country, notes } = parsed.data

  try {
    const payload = await getPayloadClient()

    const restaurant = (await payload.findByID({
      collection: 'restaurants',
      id: restaurantId,
      overrideAccess: true,
    })) as Restaurant | null
    if (!restaurant) return NextResponse.json({ error: 'Étterem nem található' }, { status: 404 })

    if (restaurant.require_phone && !customer_phone?.trim()) {
      return NextResponse.json({ error: 'A telefonszám megadása kötelező' }, { status: 400 })
    }

    const alloc = await validateAndAllocate({ restaurantId, date, start_time, pax })
    if (!alloc.ok) {
      return NextResponse.json({ error: alloc.error }, { status: 409 })
    }

    const cancelToken = randomBytes(24).toString('hex')

    const reservation = (await payload.create({
      collection: 'reservations',
      data: {
        restaurant: Number(restaurantId),
        date,
        start_time,
        end_time: alloc.end_time,
        pax,
        ...(alloc.tableIds.length > 0 ? { tables: alloc.tableIds.map(Number) } : {}),
        customer_name,
        customer_email,
        ...(customer_phone ? { customer_phone } : {}),
        ...(country ? { country } : {}),
        ...(notes ? { notes } : {}),
        status: 'confirmed',
        cancel_token: cancelToken,
      },
      overrideAccess: true,
      depth: 1,
    })) as Reservation

    // Emailek — best-effort, ne blokkoljanak hibára
    void sendReservationConfirmation({ reservation, restaurant })
    void sendReservationNotification({ reservation, restaurant })

    return NextResponse.json({ ok: true, reservationId: reservation.id, cancel_token: cancelToken })
  } catch (err) {
    console.error('[Restaurant Reservations API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
