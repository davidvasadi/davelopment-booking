import { redirect } from 'next/navigation'
import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { VouchersManager, type VoucherRow } from '@/components/dashboard/VouchersManager'
import type { GiftVoucher, GiftVoucherType } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

export default async function VouchersPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'payments.manage', '/dashboard')
  if (!salon.voucher_settings?.enabled) redirect('/dashboard/settings')
  const payload = await getPayloadClient()

  const [res, typesRes] = await Promise.all([
    payload.find({
      collection: 'gift-vouchers',
      where: { salon: { equals: salon.id } },
      sort: '-createdAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'gift-voucher-types',
      where: { salon: { equals: salon.id } },
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
        variant="salon"
        businessId={String(salon.id)}
        initialVouchers={vouchers}
        voucherTypes={voucherTypes}
        minAmountHuf={salon.voucher_settings?.min_amount_huf ?? 2000}
        maxAmountHuf={salon.voucher_settings?.max_amount_huf ?? 100000}
      />
    </div>
  )
}
