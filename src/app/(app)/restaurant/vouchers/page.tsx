import { redirect } from 'next/navigation'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl } from '@/lib/utils'
import { resolveAvailableLocales } from '@/lib/i18n'
import { getVouchersVM } from '@/lib/vouchersView'
import { VouchersView } from '@/components/dashboard/VouchersView'
import type { Media, Restaurant } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/** Utalványok — étterem (design 12.9: ugyanaz az oldal, az étterem adataival). */
export default async function RestaurantVouchersPage() {
  const { restaurant: r0, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['vouchers.view', 'vouchers.manage'], '/restaurant')
  if (!r0.voucher_settings?.enabled) redirect('/restaurant/settings')
  // a logó a kártyához (depth 1)
  const payload = await getPayloadClient()
  const restaurant = (await payload.findByID({ collection: 'restaurants', id: r0.id, depth: 1, overrideAccess: true })) as Restaurant
  const { vouchers, types } = await getVouchersVM('restaurant', restaurant.id)
  return (
    <VouchersView restaurant businessId={String(restaurant.id)} vouchers={vouchers} types={types} base="/restaurant"
      biz={{ name: restaurant.name, logo: restaurant.logo && typeof restaurant.logo === 'object' ? fixMediaUrl((restaurant.logo as Media).url) : null, icon: restaurant.icon && typeof restaurant.icon === 'object' ? fixMediaUrl((restaurant.icon as Media).url) : null, addr: [[restaurant.city, restaurant.address].filter(Boolean).join(', '), restaurant.phone].filter(Boolean).join(' · ') || null }}
      stripe={!!(restaurant as { stripe_connect_onboarded?: boolean | null }).stripe_connect_onboarded} locales={resolveAvailableLocales(restaurant.supported_locales ?? null)}
      minAmount={restaurant.voucher_settings?.min_amount_huf ?? 2000} maxAmount={restaurant.voucher_settings?.max_amount_huf ?? 100000}
      canManage={can(capabilities, 'vouchers.manage')} />
  )
}
