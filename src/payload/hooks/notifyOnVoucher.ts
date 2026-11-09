import type { CollectionAfterChangeHook } from 'payload'
import { sendPushToUsers } from '../../lib/webPush'
import { formatPrice } from '../../lib/utils'

function relId(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'object' && val !== null && 'id' in val) return String((val as { id: unknown }).id)
  return String(val)
}

/**
 * App-on belüli értesítés (harang) + web push az utalvány tulajdonosának, amikor egy
 * ajándékutalvány LÉTREJÖTT (sikeres fizetés után — mindegy hogy a guest-flow, az admin
 * "már kifizetve" út, vagy a fizetési-linkes Connect webhook hozta létre, mindhárom ugyanazt a
 * `gift-vouchers` create-et futtatja). A `notifyOnBooking.ts` mintáját követi.
 */
export const notifyOnVoucher: CollectionAfterChangeHook = async ({ req, doc, operation }) => {
  if (operation !== 'create') return doc

  const kind: 'salon' | 'restaurant' | null = doc.salon ? 'salon' : doc.restaurant ? 'restaurant' : null
  const placeId = kind ? relId(doc[kind]) : ''
  if (!kind || !placeId) return doc

  try {
    const place = await req.payload.findByID({
      collection: kind === 'salon' ? 'salons' : 'restaurants',
      id: placeId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (!place) return doc

    const title = 'Új ajándékutalvány vásárlás'
    const body = `${doc.purchaser_name} vásárolt egy ${formatPrice(doc.amount_huf, 'HUF')}-os utalványt`

    await req.payload.create({
      collection: 'notifications',
      overrideAccess: true,
      req,
      data: {
        [kind]: Number(placeId),
        audience: 'owner' as const,
        type: 'voucher_purchase',
        title,
        body,
        read: false,
        voucher: Number(doc.id),
      },
    })

    try {
      const ownerId = relId((place as { owner?: unknown }).owner)
      const url = `${kind === 'restaurant' ? '/restaurant/vouchers' : '/dashboard/vouchers'}?voucher=${doc.id}`
      await sendPushToUsers(req.payload, [ownerId], {
        title: `${title} · ${place.name ?? ''}`.trim().replace(/ ·\s*$/, ''),
        body,
        url,
        tag: `voucher-${doc.id}`,
      })
    } catch (pushErr) {
      req.payload.logger.error(`notifyOnVoucher push hiba: ${String(pushErr)}`)
    }
  } catch (err) {
    req.payload.logger.error(`notifyOnVoucher hiba: ${String(err)}`)
  }

  return doc
}
