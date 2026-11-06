import { redirect } from 'next/navigation'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { PartnerProgramView } from '@/components/dashboard/PartnerProgramView'

export const metadata = { title: 'Partnerprogram' }

export default async function RestaurantPartnerProgramPage() {
  const { role } = await getOwnedRestaurant()
  if (role !== 'owner') redirect('/restaurant')
  return <PartnerProgramView />
}
