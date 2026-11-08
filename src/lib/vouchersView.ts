import { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl } from '@/lib/utils'
import type { VoucherRow, VoucherTypeVM } from '@/components/dashboard/VouchersView'
import type { GiftVoucher, GiftVoucherType, Media } from '@/payload/payload-types'
import { voucherDesign } from './voucherDesign'

/** Az Utalványok oldal (design 12.x) adatai — szalon és étterem közös: az utalványok (kiállítóval, a típus képével) és a
 *  típusok (eladott darabszámmal). */
export async function getVouchersVM(kind: 'salon' | 'restaurant', businessId: string | number): Promise<{ vouchers: VoucherRow[]; types: VoucherTypeVM[] }> {
  const payload = await getPayloadClient()
  const scope = { [kind]: { equals: businessId } }
  const [res, typesRes] = await Promise.all([
    payload.find({ collection: 'gift-vouchers', where: scope, sort: '-createdAt', limit: 500, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'gift-voucher-types', where: scope, sort: 'amount_huf', limit: 100, depth: 1, overrideAccess: true }),
  ])
  const docs = res.docs as GiftVoucher[]
  const typeDocs = typesRes.docs as GiftVoucherType[]
  const relId = (v: unknown) => (v == null ? null : typeof v === 'object' ? String((v as { id: unknown }).id) : String(v))
  const imgOf = (t?: GiftVoucherType) => (t?.image && typeof t.image === 'object' ? fixMediaUrl((t.image as Media).url) ?? null : null)
  const typeById = new Map(typeDocs.map((t) => [String(t.id), t]))

  // ki állította ki (dashboard-felhasználó) — egy lekérdezéssel a nevekért
  const issuerIds = [...new Set(docs.map((v) => relId(v.issued_by)).filter((x): x is string => !!x))]
  const issuers = issuerIds.length ? await payload.find({ collection: 'users', where: { id: { in: issuerIds } }, limit: issuerIds.length, depth: 0, overrideAccess: true }) : { docs: [] }
  const issuerName = new Map((issuers.docs as { id: string | number; name?: string | null; email?: string | null }[]).map((u) => [String(u.id), u.name || u.email || null]))

  const sold = new Map<string, number>()
  for (const v of docs) { const t = relId(v.voucher_type); if (t && v.status !== 'refunded') sold.set(t, (sold.get(t) ?? 0) + 1) }

  return {
    vouchers: docs.map((v) => ({
      id: String(v.id), code: v.code, amount_huf: v.amount_huf, type_name: v.type_name ?? null, purchaser_name: v.purchaser_name,
      payment_method: v.payment_method ?? null, status: v.status, expires_at: v.expires_at, redeemed_at: v.redeemed_at ?? null, createdAt: v.createdAt,
      issued_by_name: relId(v.issued_by) ? issuerName.get(relId(v.issued_by)!) ?? null : null, recipient_name: v.recipient_name ?? null,
      image: imgOf(typeById.get(relId(v.voucher_type) ?? '')),
    })),
    types: typeDocs.map((t) => ({
      id: String(t.id), name: t.name, amount_huf: t.amount_huf, description: t.description ?? null, active: t.active !== false,
      image: t.image && typeof t.image === 'object' ? { id: String((t.image as Media).id), url: imgOf(t) } : null, design: voucherDesign(t.card_layout, t.card_color, t.card_text), sold: sold.get(String(t.id)) ?? 0,
    })),
  }
}
