import { redirect } from 'next/navigation'

export default function RestaurantSubscriptionPage() {
  redirect('/restaurant/settings?tab=billing')
}
