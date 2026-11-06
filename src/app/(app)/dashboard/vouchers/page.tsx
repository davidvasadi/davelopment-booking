import { redirect } from 'next/navigation'
import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { fixMediaUrl } from '@/lib/utils'
import { resolveAvailableLocales } from '@/lib/i18n'
import { getVouchersVM } from '@/lib/vouchersView'
import { VouchersView } from '@/components/dashboard/VouchersView'
import type { Media } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/** Utalványok — szalon (design 12.1–12.8). */
export default async function VouchersPage() {
  const { salon, capabilities } = await getOwnedSalon(1)
  requireAnyCapability(capabilities, ['vouchers.view', 'vouchers.manage'], '/dashboard')
  if (!salon.voucher_settings?.enabled) redirect('/dashboard/settings')
  const { vouchers, types } = await getVouchersVM('salon', salon.id)
  const phone = (salon as { phone?: string | null }).phone
  return (
    <VouchersView businessId={String(salon.id)} vouchers={vouchers} types={types} base="/dashboard"
      biz={{ name: salon.name, logo: salon.logo && typeof salon.logo === 'object' ? fixMediaUrl((salon.logo as Media).url) : null, addr: [[salon.city, salon.address].filter(Boolean).join(', '), phone].filter(Boolean).join(' · ') || null }}
      stripe={!!salon.stripe_connect_onboarded} locales={resolveAvailableLocales(salon.supported_locales ?? null)}
      minAmount={salon.voucher_settings?.min_amount_huf ?? 2000} maxAmount={salon.voucher_settings?.max_amount_huf ?? 100000}
      canManage={can(capabilities, 'vouchers.manage')} />
  )
}
