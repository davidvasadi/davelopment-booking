import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { businessLogoUrl, getMarketingVM } from '@/lib/marketingView'
import { MarketingView } from '@/components/dashboard/MarketingView'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/** Marketing — szalon (design 13.1–13.8). */
export default async function MarketingPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['marketing.view', 'marketing.manage'], '/dashboard')
  const vm = await getMarketingVM('salon', salon, `${APP_URL}/${salon.slug}`)
  const phone = (salon as { phone?: string | null }).phone
  const logo = await businessLogoUrl(salon.logo)
  const icon = await businessLogoUrl(salon.icon)
  return (
    <MarketingView businessId={String(salon.id)} vm={vm} canManage={can(capabilities, 'marketing.manage')}
      biz={{ name: salon.name, logo, icon, footer: [salon.address, phone].filter(Boolean).join(' · ') || null, social: (salon.social_links ?? []).map((l) => l.url).filter(Boolean) }} />
  )
}
