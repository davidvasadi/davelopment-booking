import { notFound } from 'next/navigation'
import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { ConsentCheckIn } from '@/components/dashboard/ConsentCheckIn'
import type { Booking } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

export default async function SalonConsentCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  const booking = (await payload
    .findByID({ collection: 'bookings', id, depth: 0, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const bookingSalonId = booking && (typeof booking.salon === 'object' ? booking.salon.id : booking.salon)
  if (!booking || String(bookingSalonId) !== String(salon.id)) notFound()

  if (!salon.consent_settings?.enabled || !salon.consent_settings?.template_text?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6 text-center">
        <p className="text-sm text-ink-soft">A beleegyező nyilatkozat funkció nincs bekapcsolva ennél az üzletnél.</p>
      </div>
    )
  }

  return (
    <ConsentCheckIn
      id={booking.id}
      customerName={booking.customer_name}
      alreadyAccepted={!!booking.consent_accepted}
      title={salon.consent_settings.title}
      templateText={salon.consent_settings.template_text ?? ''}
      submitUrl="/api/salon/consent-accept"
      idField="bookingId"
      backHref={`/dashboard/bookings?date=${booking.date}`}
    />
  )
}
