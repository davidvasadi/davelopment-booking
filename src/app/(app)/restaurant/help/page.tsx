import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { TipsContent } from '@/components/onboarding/TipsContent'

export const metadata = { title: 'Súgó' }

export default async function RestaurantHelpPage() {
  const { capabilities } = await getOwnedRestaurant()
  return <TipsContent variant="restaurant" capabilities={capabilities} />
}
