import { redirect } from 'next/navigation'

export default function SubscriptionPage() {
  redirect('/dashboard/settings?tab=billing')
}
