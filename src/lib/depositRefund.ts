import { getPayloadClient } from './payload'
import { getStripe } from './stripe'

/**
 * Lemondáskor kiértékeli az előleg visszatérítési szabályát (időalapú — `refund_hours_before`
 * órával a foglalás előtt még teljes visszatérítés jár, utána nem) és ha jogosult, elindítja a
 * Stripe refundot. Idempotens (a hívó ELLENŐRIZZE a `deposit_refunded`-et hívás előtt, ez a
 * függvény csak a tényleges refund-hívást végzi). A Stripe-hívás SOSE dobhat — egy refund-hiba
 * nem blokkolhatja magát a lemondást, csak naplózódik; a Connect-webhook `charge.refunded` ága
 * vagy manuális admin-retry rendezi később.
 */
export async function refundDepositIfEligible({
  collection,
  doc,
  connectAccountId,
  refundHoursBefore,
}: {
  collection: 'bookings' | 'reservations'
  doc: { id: string | number; date: string; start_time: string }
  connectAccountId: string | null | undefined
  refundHoursBefore: number
}): Promise<void> {
  const stripe = getStripe()
  if (!stripe || !connectAccountId) return

  const slotDateTime = new Date(`${doc.date}T${doc.start_time}:00`)
  const hoursUntil = (slotDateTime.getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursUntil < refundHoursBefore) return // az előleg az üzletnél marad — ez a no-show-védelem lényege

  const payload = await getPayloadClient()
  const fresh = (await payload.findByID({ collection, id: doc.id, overrideAccess: true }).catch(() => null)) as
    | { payment_status?: string | null; payment_intent_id?: string | null }
    | null
  if (!fresh?.payment_intent_id || fresh.payment_status !== 'paid') return

  try {
    await stripe.refunds.create({ payment_intent: fresh.payment_intent_id }, { stripeAccount: connectAccountId })
    await payload.update({ collection, id: doc.id, overrideAccess: true, data: { payment_status: 'refunded', deposit_refunded: true } })
  } catch (e) {
    console.error(`[depositRefund] refund hiba (${collection}#${doc.id}):`, e)
  }
}
