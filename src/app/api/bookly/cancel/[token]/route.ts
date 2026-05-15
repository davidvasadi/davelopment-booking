import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendCancellationEmail } from '@/lib/email'
import type { Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const payload = await getPayloadClient()

    const result = await payload.find({
      collection: 'bookings',
      where: { cancellation_token: { equals: token } },
      depth: 2,
      limit: 1,
      overrideAccess: true,
    })

    const booking = result.docs[0] as Booking | undefined
    if (!booking) {
      return NextResponse.redirect(new URL('/bookly/booking/cancelled?error=not_found', appUrl))
    }

    if (booking.status === 'cancelled') {
      return NextResponse.redirect(new URL('/bookly/booking/cancelled?already=1', appUrl))
    }

    if (booking.status === 'completed') {
      return NextResponse.redirect(new URL('/bookly/booking/cancelled?error=completed', appUrl))
    }

    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'cancelled' },
      overrideAccess: true,
    })

    const [salon, service, staff] = await Promise.all([
      payload.findByID({ collection: 'salons', id: String(typeof booking.salon === 'object' ? booking.salon.id : booking.salon) }) as Promise<Salon>,
      payload.findByID({ collection: 'services', id: String(typeof booking.service === 'object' ? booking.service.id : booking.service) }) as Promise<Service>,
      payload.findByID({ collection: 'staff', id: String(typeof booking.staff === 'object' ? booking.staff.id : booking.staff) }) as Promise<StaffMember>,
    ])

    void sendCancellationEmail({ booking, salon, service, staff })

    const salonName = encodeURIComponent(salon.name)
    const serviceName = encodeURIComponent(service.name)
    return NextResponse.redirect(
      new URL(`/bookly/booking/cancelled?salon=${salonName}&service=${serviceName}&date=${booking.date}&time=${booking.start_time}`, appUrl)
    )
  } catch (err) {
    console.error('[Cancel] Error:', err)
    return NextResponse.redirect(new URL('/bookly/booking/cancelled?error=server', appUrl))
  }
}
