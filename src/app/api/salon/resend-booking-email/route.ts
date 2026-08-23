import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { sendBookingConfirmation } from '@/lib/email'
import type { Booking, Salon, Service, StaffMember } from '@/payload/payload-types'

/**
 * POST /api/salon/resend-booking-email — a visszaigazoló emailt küldi el ÚJRA egy meglévő
 * foglaláshoz (a szerkesztő ablak "Küldés újra" gombja, sikertelen/visszapattant küldés után).
 * Az étteremi `/api/restaurant/resend-reservation-email` párja.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { bookingId?: string | number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  if (!body.bookingId) return NextResponse.json({ error: 'Hiányzó bookingId' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })

  const denied = await assertCapability(user.id, 'salon', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  const booking = (await payload
    .findByID({ collection: 'bookings', id: body.bookingId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const salonId = booking && (typeof booking.salon === 'object' ? booking.salon.id : booking.salon)
  if (!booking || String(salonId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }
  if (!booking.customer_email) {
    return NextResponse.json({ error: 'A foglaláshoz nincs email cím megadva' }, { status: 400 })
  }

  const [salon, service, staff] = await Promise.all([
    payload.findByID({ collection: 'salons', id: active.id, overrideAccess: true }) as Promise<Salon>,
    payload.findByID({ collection: 'services', id: typeof booking.service === 'object' ? booking.service.id : booking.service, overrideAccess: true }) as Promise<Service>,
    payload.findByID({ collection: 'staff', id: typeof booking.staff === 'object' ? booking.staff.id : booking.staff, overrideAccess: true }) as Promise<StaffMember>,
  ])

  await sendBookingConfirmation({ booking, salon, service, staff })
  return NextResponse.json({ ok: true })
}
