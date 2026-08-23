import { redirect } from 'next/navigation'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { VouchersManager, type VoucherRow } from '@/components/dashboard/VouchersManager'
import type { GiftVoucher, GiftVoucherType } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

export default async function RestaurantVouchersPage() {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['vouchers.view', 'vouchers.manage'], '/restaurant')
  if (!restaurant.voucher_settings?.enabled) redirect('/restaurant/settings')
  const payload = await getPayloadClient()

  const [res, typesRes] = await Promise.all([
    payload.find({
      collection: 'gift-vouchers',
      where: { restaurant: { equals: restaurant.id } },
      sort: '-createdAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'gift-voucher-types',
      where: { restaurant: { equals: restaurant.id } },
      sort: 'amount_huf',
      limit: 100,
      overrideAccess: true,
    }),
  ])

  const vouchers: VoucherRow[] = (res.docs as GiftVoucher[]).map((v) => ({
    id: String(v.id),
    code: v.code,
    amount_huf: v.amount_huf,
    type_name: v.type_name,
    purchaser_name: v.purchaser_name,
    status: v.status,
    expires_at: v.expires_at,
    redeemed_at: v.redeemed_at,
    createdAt: v.createdAt,
  }))

  const voucherTypes = (typesRes.docs as GiftVoucherType[]).map((t) => ({
    id: String(t.id),
    name: t.name,
    amount_huf: t.amount_huf,
    description: t.description,
    active: t.active,
    image: typeof t.image === 'object' && t.image ? { id: String(t.image.id), url: t.image.url } : null,
  }))

  return (
    <div className="p-5 lg:p-0">
      <VouchersManager
        variant="restaurant"
        businessId={String(restaurant.id)}
        initialVouchers={vouchers}
        voucherTypes={voucherTypes}
        minAmountHuf={restaurant.voucher_settings?.min_amount_huf ?? 2000}
        maxAmountHuf={restaurant.voucher_settings?.max_amount_huf ?? 100000}
        supportedLocales={restaurant.supported_locales}
        canManage={can(capabilities, 'vouchers.manage')}
      />
    </div>
  )
}
