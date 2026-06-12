import { requireAuth } from '@/lib/auth'
import { getPricing } from '@/lib/pricing'
import PricingForm from './PricingForm'

export default async function BackstageSettingsPage() {
  await requireAuth('admin')
  const pricing = await getPricing()

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Backstage</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Beállítások</h1>
        <p className="text-zinc-500 dark:text-white/40 text-sm mt-1">Globális árazás és próbaidőszak</p>
      </div>

      <PricingForm initial={pricing} />
    </div>
  )
}
