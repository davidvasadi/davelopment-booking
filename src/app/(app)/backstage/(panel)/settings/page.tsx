import { requireAuth } from '@/lib/auth'
import { getPricing } from '@/lib/pricing'
import { BackstageHeader } from '@/components/backstage/BackstageUi'
import PricingForm from './PricingForm'
import { CleanupCard } from './CleanupCard'

export const dynamic = 'force-dynamic'

export default async function BackstageSettingsPage() {
  await requireAuth('admin')
  const pricing = await getPricing()

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHeader title="Beállítások" subtitle="Globális árazás és adattisztítás" />
      <PricingForm initial={pricing} />
      <CleanupCard />
    </div>
  )
}
