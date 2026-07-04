import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import type { Reservation, Booking } from '@/payload/payload-types'

/**
 * Publikus értékelés-beküldő. A token azonosítja a foglalást (reservation.cancel_token
 * VAGY booking.cancellation_token) — nem lehet tetszőleges beküldés. Foglalásonként
 * CSAK EGYSZER lehet értékelni. rating 1–5 kötelező.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Hiányzó token' }, { status: 400 })

  let body: { rating?: number; comment?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Az értékelés 1 és 5 csillag között lehet' }, { status: 400 })
  }
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : ''

  try {
    const payload = await getPayloadClient()

    // 1) Reservation (étterem)?
    const resvRes = await payload.find({
      collection: 'reservations',
      where: { cancel_token: { equals: token } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const reservation = resvRes.docs[0] as Reservation | undefined

    // 2) Booking (szalon)?
    let booking: Booking | undefined
    if (!reservation) {
      const bookRes = await payload.find({
        collection: 'bookings',
        where: { cancellation_token: { equals: token } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      booking = bookRes.docs[0] as Booking | undefined
    }

    if (!reservation && !booking) {
      return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
    }

    // Már értékelt? (foglalásonként egyszer)
    const existing = await payload.find({
      collection: 'reviews',
      where: reservation
        ? { reservation: { equals: reservation.id } }
        : { booking: { equals: booking!.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      return NextResponse.json({ error: 'Ehhez a foglaláshoz már érkezett értékelés', already: true }, { status: 409 })
    }

    if (reservation) {
      const restaurantId = typeof reservation.restaurant === 'object' ? reservation.restaurant.id : reservation.restaurant
      await payload.create({
        collection: 'reviews',
        data: {
          restaurant: restaurantId,
          reservation: reservation.id,
          rating,
          comment,
          customer_name: reservation.customer_name,
        },
        overrideAccess: true,
      })
    } else {
      const salonId = typeof booking!.salon === 'object' ? booking!.salon.id : booking!.salon
      await payload.create({
        collection: 'reviews',
        data: {
          salon: salonId,
          booking: booking!.id,
          rating,
          comment,
          customer_name: booking!.customer_name,
        },
        overrideAccess: true,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Review API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}

/** GET: megnézi, hogy a token érvényes-e és értékelt-e már (az oldal betöltésekor). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Hiányzó token' }, { status: 400 })

  try {
    const payload = await getPayloadClient()

    const resvRes = await payload.find({
      collection: 'reservations',
      where: { cancel_token: { equals: token } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const reservation = resvRes.docs[0] as Reservation | undefined

    let booking: Booking | undefined
    if (!reservation) {
      const bookRes = await payload.find({
        collection: 'bookings',
        where: { cancellation_token: { equals: token } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      booking = bookRes.docs[0] as Booking | undefined
    }

    if (!reservation && !booking) {
      return NextResponse.json({ found: false }, { status: 404 })
    }

    const existing = await payload.find({
      collection: 'reviews',
      where: reservation
        ? { reservation: { equals: reservation.id } }
        : { booking: { equals: booking!.id } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    return NextResponse.json({
      found: true,
      already: existing.docs.length > 0,
      customer_name: reservation?.customer_name ?? booking?.customer_name ?? null,
    })
  } catch (err) {
    console.error('[Review API GET]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
