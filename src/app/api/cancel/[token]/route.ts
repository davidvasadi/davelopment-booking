import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendCancellationEmail } from '@/lib/email'
import { promoteWaitlistOnCancel } from '@/lib/waitlistPromote'
import type { Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  // Opcionális sorozat-lemondás: ?scope=series → a token foglalásán túl a sorozat
  // JÖVŐBELI, nem lemondott alkalmait is lemondja. Hiánya → csak az egy alkalom (változatlan).
  const cancelSeries = _req.nextUrl.searchParams.get('scope') === 'series'

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
      return NextResponse.redirect(new URL('/booking/cancelled?error=not_found', appUrl))
    }

    if (booking.status === 'cancelled') {
      return NextResponse.redirect(new URL('/booking/cancelled?already=1', appUrl))
    }

    if (booking.status === 'completed') {
      return NextResponse.redirect(new URL('/booking/cancelled?error=completed', appUrl))
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

    if (salon.notification_prefs?.cancel_email !== false) {
      void sendCancellationEmail({ booking, salon, service, staff })
    }

    // Auto-promote: a felszabaduló időpontra egyező várólista-bejegyzés értesítése (ha be van kapcsolva).
    void promoteWaitlistOnCancel({ kind: 'salon', business: salon, date: booking.date, time: booking.start_time })

    // Sorozat-lemondás: a token foglalás series_id-jéhez tartozó JÖVŐBELI (a mai naptól),
    // még nem lemondott/befejezett alkalmakat is lemondjuk. Csak explicit ?scope=series-re.
    if (cancelSeries && booking.series_id) {
      const today = new Date().toISOString().split('T')[0]
      const siblings = await payload.find({
        collection: 'bookings',
        where: {
          series_id: { equals: booking.series_id },
          id: { not_equals: booking.id },
          status: { in: ['pending', 'confirmed'] },
          date: { greater_than_equal: today },
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      for (const sib of siblings.docs as Booking[]) {
        await payload.update({ collection: 'bookings', id: sib.id, data: { status: 'cancelled' }, overrideAccess: true })
        if (salon.notification_prefs?.cancel_email !== false) {
          void sendCancellationEmail({ booking: { ...sib, status: 'cancelled' }, salon, service, staff })
        }
        void promoteWaitlistOnCancel({ kind: 'salon', business: salon, date: sib.date, time: sib.start_time })
      }
    }

    const salonName = encodeURIComponent(salon.name)
    const serviceName = encodeURIComponent(service.name)
    return NextResponse.redirect(
      new URL(`/booking/cancelled?salon=${salonName}&service=${serviceName}&date=${booking.date}&time=${booking.start_time}`, appUrl)
    )
  } catch (err) {
    console.error('[Cancel] Error:', err)
    return NextResponse.redirect(new URL('/booking/cancelled?error=server', appUrl))
  }
}
