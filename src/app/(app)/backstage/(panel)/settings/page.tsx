import { requireAuth } from '@/lib/auth'
import { getPricing } from '@/lib/pricing'
import PricingForm from './PricingForm'

export default async function BackstageSettingsPage() {
  await requireAuth('admin')
  const pricing = await getPricing()

  return (
    <div className="space-y-[22px] p-5 font-onest lg:p-8">
      <div>
        <h1 className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[43px]">Beállítások</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Globális árazás és próbaidőszak</p>
      </div>

      <PricingForm initial={pricing} />
    </div>
  )
}
