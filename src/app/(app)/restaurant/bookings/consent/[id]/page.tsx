import { notFound } from 'next/navigation'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { capsWords } from '@/lib/utils'
import { ConsentCheckIn } from '@/components/dashboard/ConsentCheckIn'
import type { Reservation } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

export default async function RestaurantConsentCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { restaurant } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const reservation = (await payload
    .findByID({ collection: 'reservations', id, depth: 0, overrideAccess: true })
    .catch(() => null)) as Reservation | null
  const reservationRestaurantId = reservation && (typeof reservation.restaurant === 'object' ? reservation.restaurant.id : reservation.restaurant)
  if (!reservation || String(reservationRestaurantId) !== String(restaurant.id)) notFound()

  if (!restaurant.consent_settings?.enabled || !restaurant.consent_settings?.template_text?.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ui-page p-6 text-center">
        <p className="text-ui-body text-ui-muted">A beleegyező nyilatkozat funkció nincs bekapcsolva ennél az üzletnél.</p>
      </div>
    )
  }

  return (
    <ConsentCheckIn
      id={reservation.id}
      customerName={reservation.customer_name}
      alreadyAccepted={!!reservation.consent_accepted}
      title={restaurant.consent_settings.title}
      templateText={restaurant.consent_settings.template_text ?? ''}
      submitUrl="/api/restaurant/consent-accept"
      idField="reservationId"
      backHref={`/restaurant/bookings?date=${reservation.date}`}
      business={restaurant.name}
      when={`${capsWords(new Date(`${reservation.date}T12:00:00`).toLocaleDateString('hu-HU', { weekday: 'long', month: 'short', day: 'numeric' }))}${reservation.start_time ? ` · ${reservation.start_time}` : ''}`}
      what={`${reservation.pax ?? 0} fő`}
    />
  )
}
