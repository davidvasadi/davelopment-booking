import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendCancellationEmail } from '@/lib/email'
import { promoteWaitlistOnCancel } from '@/lib/waitlistPromote'
import { refundDepositIfEligible } from '@/lib/depositRefund'
import type { Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

// A lemondás CSAK POST-ra fut (a megerősítő oldal űrlapja küldi). GET-re soha nem módosítunk:
// a Next.js <Link> prefetch-e és az email-kliensek link-ellenőrzői GET-tel hívják meg a linket,
// ami korábban kattintás nélkül lemondta a foglalást. A GET csak a megerősítő oldalra irányít.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  return NextResponse.redirect(new URL(`/booking/confirm-cancel/${encodeURIComponent(token)}`, appUrl))
}

// POST után 303-mal irányítunk, hogy a böngésző GET-tel töltse be az eredmény-oldalt.
const redirect = (path: string, appUrl: string) => NextResponse.redirect(new URL(path, appUrl), 303)

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
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
      return redirect('/booking/cancelled?error=not_found', appUrl)
    }

    if (booking.status === 'cancelled') {
      return redirect('/booking/cancelled?already=1', appUrl)
    }

    if (booking.status === 'completed') {
      return redirect('/booking/cancelled?error=completed', appUrl)
    }

    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'cancelled', cancelled_at: new Date().toISOString() },
      overrideAccess: true,
      context: { auditActor: 'Vendég (lemondás)' },
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

    // Előleg visszatérítése, ha a lemondás az időablakon belül történt (best-effort, nem
    // blokkolja a redirectet).
    void refundDepositIfEligible({
      collection: 'bookings',
      doc: { id: booking.id, date: booking.date, start_time: booking.start_time },
      connectAccountId: salon.stripe_connect_account_id,
      refundHoursBefore: salon.deposit_settings?.refund_hours_before ?? 24,
    })

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
        await payload.update({ collection: 'bookings', id: sib.id, data: { status: 'cancelled', cancelled_at: new Date().toISOString() }, overrideAccess: true, context: { auditActor: 'Vendég (lemondás)' } })
        if (salon.notification_prefs?.cancel_email !== false) {
          void sendCancellationEmail({ booking: { ...sib, status: 'cancelled' }, salon, service, staff })
        }
        void promoteWaitlistOnCancel({ kind: 'salon', business: salon, date: sib.date, time: sib.start_time })
        // FÁZIS 1-ben a sorozat többi tagja sose kap előleget (csak az első alkalom), tehát
        // ez itt no-op ma — de defenzíven megírva, hogy jövőbeli sorozat-előleg esetén is
        // helyesen működjön a lemondás-visszatérítés.
        void refundDepositIfEligible({
          collection: 'bookings',
          doc: { id: sib.id, date: sib.date, start_time: sib.start_time },
          connectAccountId: salon.stripe_connect_account_id,
          refundHoursBefore: salon.deposit_settings?.refund_hours_before ?? 24,
        })
      }
    }

    const salonName = encodeURIComponent(salon.name)
    const serviceName = encodeURIComponent(service.name)
    return redirect(`/booking/cancelled?salon=${salonName}&service=${serviceName}&date=${booking.date}&time=${booking.start_time}`, appUrl)
  } catch (err) {
    console.error('[Cancel] Error:', err)
    return redirect('/booking/cancelled?error=server', appUrl)
  }
}
