import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { createGiftVoucher } from './createGiftVoucher'
import type { Salon, Restaurant, GiftVoucher } from '@/payload/payload-types'

/**
 * Fizetési linkes (admin által küldött) utalvány létrehozása a SIKERES PaymentIntentből — a
 * Connect webhook ÉS a dashboard élő pollozása (`/api/gift-vouchers/by-payment-intent`) is ezt
 * hívja. Így akkor is létrejön az utalvány, ha a webhook nem érkezik meg (pl. helyi fejlesztésnél
 * nincs `stripe listen`, vagy élesben késik/nincs bekötve). Idempotens: a `payment_intent_id`
 * egyedi mező, ha a két út egyszerre futna, a második létrehozás elhasal, és a meglévőt adjuk vissza.
 */
export async function ensureVoucherFromPaymentIntent(payload: Payload, intent: Stripe.PaymentIntent): Promise<GiftVoucher | null> {
  const find = async () =>
    (await payload.find({ collection: 'gift-vouchers', where: { payment_intent_id: { equals: intent.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as GiftVoucher | undefined

  const existing = await find()
  if (existing) return existing
  if (intent.status !== 'succeeded') return null
  // csak az admin fizetési linkje (vevő-adatokkal); a vendég online vásárlását a kliens hozza létre
  const md = intent.metadata ?? {}
  if (md.kind !== 'gift-voucher' || !md.purchaserEmail) return null

  const kind: 'salon' | 'restaurant' = md.salonId ? 'salon' : 'restaurant'
  const business = kind === 'salon'
    ? ((await payload.findByID({ collection: 'salons', id: md.salonId, overrideAccess: true }).catch(() => null)) as Salon | null)
    : ((await payload.findByID({ collection: 'restaurants', id: md.restaurantId, overrideAccess: true }).catch(() => null)) as Restaurant | null)
  if (!business) return null

  try {
    await createGiftVoucher({
      paymentMethod: 'payment_link',
      kind,
      business,
      amountHuf: Math.round(intent.amount / 100),
      voucherTypeId: md.voucherTypeId,
      paymentIntentId: intent.id,
      buyer: { name: md.purchaserName, email: md.purchaserEmail, city: md.purchaserCity, address: md.purchaserAddress, taxNumber: md.purchaserTaxNumber || undefined },
      recipient: { name: md.recipientName || undefined, email: md.recipientEmail || undefined, message: md.message || undefined },
      issuedBy: md.issuedBy || null,
      // régi (e mező előtti) linkeknél nincs érték → számla készül, mint eddig
      issueInvoice: md.issueInvoice !== '0',
    })
  } catch (e) {
    // egyidejű létrehozás (unique ütközés) → a másik út már létrehozta
    const again = await find()
    if (again) return again
    throw e
  }
  return (await find()) ?? null
}
