import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Booking, EmailLogEntry } from '@/payload/payload-types'

/**
 * GET /api/salon/booking-email-status?bookingId= — a foglaláshoz tartozó legutóbbi kimenő email
 * (visszaigazolás/módosítás/lemondás/emlékeztető) kézbesítési állapota, a szerkesztő ablak
 * fejlécéhez (elküldve/kézbesítve/megnyitva). A Resend webhook (src/app/api/webhooks/resend)
 * frissíti utólag ezt az `email-log` rekordot.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const bookingId = req.nextUrl.searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'Hiányzó bookingId' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })

  const payload = await getPayloadClient()

  const booking = (await payload
    .findByID({ collection: 'bookings', id: bookingId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const salonId = booking && (typeof booking.salon === 'object' ? booking.salon.id : booking.salon)
  if (!booking || String(salonId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  const logs = await payload.find({
    collection: 'email-log',
    where: { booking: { equals: bookingId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = logs.docs[0] as EmailLogEntry | undefined

  return NextResponse.json({
    ok: doc?.ok ?? null,
    status: doc?.status ?? null,
    deliveredAt: doc?.delivered_at ?? null,
    openedAt: doc?.opened_at ?? null,
  })
}
