import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { businessLogoUrl, getMarketingVM } from '@/lib/marketingView'
import { MarketingView } from '@/components/dashboard/MarketingView'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/** Marketing — étterem (design 13.1–13.8). */
export default async function MarketingPage() {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['marketing.view', 'marketing.manage'], '/restaurant')
  const vm = await getMarketingVM('restaurant', restaurant, `${APP_URL}/${restaurant.slug}`)
  const phone = (restaurant as { phone?: string | null }).phone
  const logo = await businessLogoUrl(restaurant.logo)
  const icon = await businessLogoUrl(restaurant.icon)
  return (
    <MarketingView restaurant businessId={String(restaurant.id)} vm={vm} canManage={can(capabilities, 'marketing.manage')}
      biz={{ name: restaurant.name, logo, icon, footer: [restaurant.address, phone].filter(Boolean).join(' · ') || null, social: (restaurant.social_links ?? []).map((l) => l.url).filter(Boolean) }} />
  )
}
