import { notFound } from 'next/navigation'
import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { capsWords } from '@/lib/utils'
import { ConsentCheckIn } from '@/components/dashboard/ConsentCheckIn'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'

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
    .findByID({ collection: 'bookings', id, depth: 1, populate: { salons: { name: true } }, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const bookingSalonId = booking && (typeof booking.salon === 'object' ? booking.salon.id : booking.salon)
  if (!booking || String(bookingSalonId) !== String(salon.id)) notFound()

  if (!salon.consent_settings?.enabled || !salon.consent_settings?.template_text?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ui-page p-6 text-center">
        <p className="text-ui-body text-ui-muted">A beleegyező nyilatkozat funkció nincs bekapcsolva ennél az üzletnél.</p>
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
      business={salon.name}
      when={`${capsWords(new Date(`${booking.date}T12:00:00`).toLocaleDateString('hu-HU', { weekday: 'long', month: 'short', day: 'numeric' }))}${booking.start_time ? ` · ${booking.start_time}` : ''}`}
      what={[typeof booking.service === 'object' && booking.service ? (booking.service as Service).name : '', typeof booking.staff === 'object' && booking.staff ? (booking.staff as StaffMember).name : ''].filter(Boolean).join(' · ') || 'Foglalás'}
    />
  )
}
