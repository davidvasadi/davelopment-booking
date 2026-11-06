import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import type { Reservation, Booking } from '@/payload/payload-types'

/**
 * Csak akkor irányítjuk oda a jó értékelést adó vendéget, ha a beállított link ténylegesen
 * egy jól formázott http(s) URL — a mező szabad szöveg (nincs validáció mentéskor), így egy
 * elgépelt/hibás érték itt akadna el, nem a vendég böngészőjében egy törött átirányításnál.
 */
function validGoogleUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim()
  if (!v || !/^https?:\/\//i.test(v)) return null
  try {
    new URL(v)
    return v
  } catch {
    return null
  }
}

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
        context: { auditActor: 'Vendég (értékelés)' },
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
        context: { auditActor: 'Vendég (értékelés)' },
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

    let googleReviewUrl: string | null = null
    // Hova küldjük az elégedett vendéget (design 16.15 „Hol értékeljen még”): a választott hely linkje; ha az üres vagy
    // hibás, a Google-link a tartalék.
    let reviewUrl: string | null = null
    let reviewPlace = 'Google'
    // az értékelő oldal fejlécéhez: az üzlet neve és logója
    let business: { name: string; logo: string | null } | null = null
    try {
      let fm: { google_review_url?: string | null; review_target?: string | null; tripadvisor_review_url?: string | null; facebook_review_url?: string | null } | null | undefined
      if (reservation) {
        const restaurantId = typeof reservation.restaurant === 'object' ? reservation.restaurant.id : reservation.restaurant
        const restaurant = await payload.findByID({ collection: 'restaurants', id: restaurantId, depth: 1, overrideAccess: true })
        fm = restaurant?.feature_modules
        if (restaurant) business = { name: restaurant.name, logo: restaurant.logo && typeof restaurant.logo === 'object' ? (restaurant.logo as { url?: string | null }).url ?? null : null }
      } else if (booking) {
        const salonId = typeof booking.salon === 'object' ? booking.salon.id : booking.salon
        const salon = await payload.findByID({ collection: 'salons', id: salonId, depth: 1, overrideAccess: true })
        fm = salon?.feature_modules
        if (salon) business = { name: salon.name, logo: salon.logo && typeof salon.logo === 'object' ? (salon.logo as { url?: string | null }).url ?? null : null }
      }
      googleReviewUrl = validGoogleUrl(fm?.google_review_url)
      const target = fm?.review_target === 'tripadvisor' ? validGoogleUrl(fm.tripadvisor_review_url) : fm?.review_target === 'facebook' ? validGoogleUrl(fm.facebook_review_url) : null
      if (target) { reviewUrl = target; reviewPlace = fm?.review_target === 'tripadvisor' ? 'TripAdvisor' : 'Facebook' } else reviewUrl = googleReviewUrl
    } catch {
      googleReviewUrl = null
      reviewUrl = null
    }

    return NextResponse.json({
      found: true,
      already: existing.docs.length > 0,
      customer_name: reservation?.customer_name ?? booking?.customer_name ?? null,
      google_review_url: googleReviewUrl,
      review_url: reviewUrl,
      review_place: reviewPlace,
      business,
    })
  } catch (err) {
    console.error('[Review API GET]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
