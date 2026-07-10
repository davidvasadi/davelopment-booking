import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { TipsContent } from '@/components/onboarding/TipsContent'

export const metadata = { title: 'Súgó' }

export default async function RestaurantHelpPage() {
  // Auth + modul-gate (átirányít, ha nem étterem / nincs bejelentkezve).
  await getOwnedRestaurant()
  return <TipsContent variant="restaurant" />
}
