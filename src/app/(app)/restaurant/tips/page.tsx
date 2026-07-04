import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { BookingFeatures, type FeatureModules } from '@/components/onboarding/BookingFeatures'
import type { Restaurant } from '@/payload/payload-types'

export const metadata = { title: 'Funkciók' }

export default async function RestaurantFeaturesPage() {
  const { restaurant } = await getOwnedRestaurant()
  const r = restaurant as Restaurant
  const fm = r.feature_modules ?? {}
  const initial: FeatureModules = {
    reminders_on: fm.reminders_on ?? true,
    reminder_ch_email: fm.reminder_ch_email ?? true,
    reminder_ch_push: fm.reminder_ch_push ?? false,
    reminder_t_24h: fm.reminder_t_24h ?? true,
    reminder_t_3h: fm.reminder_t_3h ?? true,
    reminder_t_1h: fm.reminder_t_1h ?? false,
    waitlist_on: fm.waitlist_on ?? false,
    waitlist_auto_promote: fm.waitlist_auto_promote ?? false,
    recurring_on: fm.recurring_on ?? false,
    reviews_on: fm.reviews_on ?? false,
  }
  return <BookingFeatures variant="restaurant" apiBase={`/api/restaurants/${r.id}`} initial={initial} />
}
