import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { SubscriptionCard } from '@/components/dashboard/SubscriptionCard'
import { RestaurantSettingsForm } from '@/components/restaurant/RestaurantSettingsForm'
import type { Restaurant } from '@/payload/payload-types'

export default async function RestaurantSettingsPage() {
  const { restaurant, businessCount, userId } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const sub = await findAccountSubscription({ payload }, userId)
  const feeLabel = `Havidíj: ${(sub?.amount_huf ?? 0).toLocaleString('hu-HU')} Ft/hó`

  const r = restaurant as Restaurant

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Étterem adatok</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Beállítások</h1>
      </div>

      <SubscriptionCard sub={sub} href="/restaurant/subscription" proPriceLabel={feeLabel} />

      <RestaurantSettingsForm
        restaurantId={r.id}
        restaurantName={r.name}
        businessCount={businessCount}
        slug={r.slug}
        supportedLocales={r.supported_locales}
        logo={r.logo}
        coverImage={r.cover_image}
        initial={{
          name: r.name,
          city: r.city ?? '',
          address: r.address ?? '',
          phone: r.phone ?? '',
          email: r.email ?? '',
          website: r.website ?? '',
          turn_duration_minutes: r.turn_duration_minutes ?? 120,
          slot_step_minutes: r.slot_step_minutes ?? 30,
          last_seating_buffer_minutes: r.last_seating_buffer_minutes ?? 0,
          lead_time_hours: r.lead_time_hours ?? 2,
          booking_window_days: r.booking_window_days ?? 60,
          require_phone: r.require_phone ?? true,
          notify_new_bookings: r.notify_new_bookings ?? true,
          booking_email_subject: r.booking_email_subject ?? '',
          booking_email_intro: r.booking_email_intro ?? '',
          email_show_phone: r.email_show_phone ?? true,
          email_contact_phone: r.email_contact_phone ?? '',
          email_show_email: r.email_show_email ?? false,
          email_show_address: r.email_show_address ?? false,
          email_show_directions: r.email_show_directions ?? false,
          email_directions_address: r.email_directions_address ?? '',
          legal_name: r.legal_name ?? '',
          tax_number: r.tax_number ?? '',
          company_reg_number: r.company_reg_number ?? '',
          registered_seat: r.registered_seat ?? '',
          terms_sections: (r.terms_sections ?? []).map((s) => ({ title: s.title ?? '', body: s.body ?? '' })),
          good_to_know: (r.good_to_know ?? []).map((s) => ({ icon: s.icon ?? 'info', title: s.title ?? '', body: s.body ?? '' })),
        }}
      />
    </div>
  )
}
