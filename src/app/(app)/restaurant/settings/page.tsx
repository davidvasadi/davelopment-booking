import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { SubscriptionCard } from '@/components/dashboard/SubscriptionCard'
import { RestaurantSettingsForm } from '@/components/restaurant/RestaurantSettingsForm'
import type { Restaurant, Subscription } from '@/payload/payload-types'

export default async function RestaurantSettingsPage() {
  const { restaurant } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const subResult = await payload.find({
    collection: 'subscriptions',
    where: { restaurant: { equals: restaurant.id } },
    limit: 1,
    overrideAccess: true,
  })
  const sub = (subResult.docs[0] as Subscription) ?? null

  const r = restaurant as Restaurant

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Étterem adatok</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Beállítások</h1>
      </div>

      <SubscriptionCard sub={sub} href="/restaurant/subscription" proPriceLabel="Étterem Pro: 9 900 Ft/hó" />

      <RestaurantSettingsForm
        restaurantId={r.id}
        restaurantName={r.name}
        slug={r.slug}
        logo={r.logo}
        coverImage={r.cover_image}
        initial={{
          name: r.name,
          city: r.city ?? '',
          address: r.address ?? '',
          phone: r.phone ?? '',
          email: r.email ?? '',
          website: r.website ?? '',
          capacity_mode: r.capacity_mode,
          max_pax: r.max_pax ?? 40,
          turn_duration_minutes: r.turn_duration_minutes ?? 120,
          slot_step_minutes: r.slot_step_minutes ?? 30,
          last_seating_buffer_minutes: r.last_seating_buffer_minutes ?? 0,
          lead_time_hours: r.lead_time_hours ?? 2,
          require_phone: r.require_phone ?? true,
        }}
      />
    </div>
  )
}
