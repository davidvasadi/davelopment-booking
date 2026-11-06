import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { HelpView } from '@/components/dashboard/HelpView'

export const metadata = { title: 'Súgó' }

export default async function RestaurantHelpPage() {
  const { capabilities } = await getOwnedRestaurant()
  return <HelpView variant="restaurant" capabilities={capabilities} />
}
