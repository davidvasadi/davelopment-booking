import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import type { Salon, Restaurant, GiftVoucherType } from '@/payload/payload-types'
import { isBusinessLocked, LOCKED_ERROR } from '@/lib/businessLock'

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('salon'), salonId: z.coerce.string(), voucherTypeId: z.coerce.string(), email: z.string().email().optional() }),
  z.object({ kind: z.literal('restaurant'), restaurantId: z.coerce.string(), voucherTypeId: z.coerce.string(), email: z.string().email().optional() }),
])

/**
 * Ajándékutalvány-vásárlás fizetési szándéka — publikus (vendég, bejelentkezés nélkül), a
 * `deposit-intent` route pontos mintáját követve. Ez a route MÉG NEM hozza létre az
 * utalványt, csak a Stripe PaymentIntentet — a tényleges utalvány-rekord létrehozása a
 * `/api/vouchers` route-ban történik, `payment_intent_id`-vel, a fizetés újra-ellenőrzése után.
 * Az összeg a KIVÁLASZTOTT (tulaj által létrehozott) típus `amount_huf`-jából jön — a vendég
 * innentől semmilyen összeget nem küldhet a szervernek.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }
  const data = parsed.data

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  try {
    const payload = await getPayloadClient()

    const business =
      data.kind === 'salon'
        ? ((await payload.findByID({ collection: 'salons', id: data.salonId, overrideAccess: true }).catch(() => null)) as Salon | null)
        : ((await payload.findByID({ collection: 'restaurants', id: data.restaurantId, overrideAccess: true }).catch(() => null)) as Restaurant | null)
    if (!business) return NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 })
    if (await isBusinessLocked(payload, business.owner)) return NextResponse.json({ error: LOCKED_ERROR, locked: true }, { status: 423 })

    // Sose bízzunk kliens-oldali "az ajándékutalvány be van kapcsolva" jelzésben — a szerver
    // mindig maga ellenőrzi, hogy tényleg elérhető-e ennél az üzletnél.
    if (!business.voucher_settings?.enabled || !business.stripe_connect_onboarded || !business.stripe_connect_account_id) {
      return NextResponse.json({ error: 'Az ajándékutalvány jelenleg nem elérhető ennél az üzletnél.' }, { status: 400 })
    }

    const voucherType = (await payload.findByID({ collection: 'gift-voucher-types', id: data.voucherTypeId, depth: 0, overrideAccess: true }).catch(() => null)) as GiftVoucherType | null
    const belongsToBusiness = data.kind === 'salon'
      ? String(voucherType?.salon) === String(data.salonId)
      : String(voucherType?.restaurant) === String(data.restaurantId)
    if (!voucherType || !voucherType.active || !belongsToBusiness) {
      return NextResponse.json({ error: 'Érvénytelen utalvány-típus.' }, { status: 400 })
    }
    const amountHuf = Math.round(voucherType.amount_huf)

    const intent = await stripe.paymentIntents.create(
      {
        amount: hufToStripeMinor(amountHuf),
        currency: 'huf',
        automatic_payment_methods: { enabled: true },
        receipt_email: data.email,
        metadata: {
          // Külön jelölés a vendég-vásárlásnak: ezt a kliens zárja le a `/api/vouchers` hívással,
          // a Connect-webhook csak a `gift-voucher` (admin fizetési link) utat kezeli.
          kind: 'gift-voucher-guest',
          ...(data.kind === 'salon' ? { salonId: data.salonId } : { restaurantId: data.restaurantId }),
          voucherTypeId: String(voucherType.id),
          amountHuf: String(amountHuf),
        },
      },
      { stripeAccount: business.stripe_connect_account_id },
    )

    return NextResponse.json({
      clientSecret: intent.client_secret,
      connectedAccountId: business.stripe_connect_account_id,
      amountHuf,
      paymentIntentId: intent.id,
    })
  } catch (err) {
    console.error('[voucher-intent]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
