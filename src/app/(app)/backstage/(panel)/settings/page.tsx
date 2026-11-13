import { requireAuth } from '@/lib/auth'
import { PageHead } from '@/components/ui-kit'
import { PricingView } from '@/components/backstage/BackstageViews'
import type { PricingKey } from '@/components/blocks/backstage'
import { getPricing } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

/** Backstage › Beállítások (design B.15): a globális árazás a Beállítások lap-mintájával. */
export default async function BackstageSettingsPage() {
  await requireAuth('admin')
  const p = await getPricing()
  const initial = {
    salon_starter_huf: p.salon_starter_huf, salon_pro_huf: p.salon_pro_huf, salon_extra_staff_huf: p.salon_extra_staff_huf,
    restaurant_starter_huf: p.restaurant_starter_huf, restaurant_pro_huf: p.restaurant_pro_huf,
    annual_discount_pct: p.annual_discount_pct, trial_days: p.trial_days,
    starter_email_cap: p.starter_email_cap, pro_email_cap: p.pro_email_cap, egyedi_email_cap: p.egyedi_email_cap,
  } satisfies Record<PricingKey, number>
  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Beállítások" sub="Globális árazás — a csomagok díja, a próbaidő és a hírlevél-keretek" />
      <PricingView initial={initial} />
    </div>
  )
}
