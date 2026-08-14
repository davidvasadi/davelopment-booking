import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getStripe } from '@/lib/stripe'
import { createGiftVoucher } from '@/lib/createGiftVoucher'
import type { Salon, Restaurant } from '@/payload/payload-types'

const voucherFields = {
  paymentIntentId: z.string().min(1),
  purchaserName: z.string().min(1), purchaserEmail: z.string().email(),
  purchaserCity: z.string().min(1), purchaserAddress: z.string().min(1),
  purchaserTaxNumber: z.string().optional(),
  recipientName: z.string().optional(), recipientEmail: z.string().email().optional().or(z.literal('')),
  message: z.string().optional(), locale: z.string().optional(),
}
const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('salon'), salonId: z.coerce.string(), ...voucherFields }),
  z.object({ kind: z.literal('restaurant'), restaurantId: z.coerce.string(), ...voucherFields }),
])

/**
 * Ajándékutalvány létrehozása sikeres fizetés után — publikus (vendég, bejelentkezés nélkül),
 * a `/api/bookings` fizetés-újraellenőrző blokkjának mintáját követve: a `paymentIntentId`-t
 * SOSE hisszük el a kliensnek nyersen, mindig visszakérdezzük a Stripe-tól, és csak onnan vett
 * (nem kliens-küldött) összeggel dolgozunk. A tényleges rekord-létrehozás a közös
 * `createGiftVoucher` helperben van (`src/lib/createGiftVoucher.ts`), amit az admin-oldali
 * manuális kiállítás és a fizetési-linkes Connect webhook is használ.
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
    if (!business.voucher_settings?.enabled || !business.stripe_connect_account_id) {
      return NextResponse.json({ error: 'Az ajándékutalvány jelenleg nem elérhető ennél az üzletnél.' }, { status: 400 })
    }

    // Dupla-felhasználás védelem: ez a PaymentIntent már felhasználva egy másik voucheren?
    const existing = await payload.find({
      collection: 'gift-vouchers', where: { payment_intent_id: { equals: data.paymentIntentId } }, limit: 1, overrideAccess: true,
    })
    if (existing.totalDocs > 0) {
      return NextResponse.json({ error: 'Ez a fizetés már fel lett használva.' }, { status: 409 })
    }

    const intent = await stripe.paymentIntents.retrieve(data.paymentIntentId, undefined, { stripeAccount: business.stripe_connect_account_id })
    if (intent.status !== 'succeeded') {
      return NextResponse.json({ error: 'A fizetés ellenőrzése sikertelen. Kérjük, próbáld újra.' }, { status: 400 })
    }
    // Az összeget ÉS a megvásárolt típust KIZÁRÓLAG a Stripe PaymentIntent metadata-jából
    // vesszük (nem a kliens body-ból) — ez a voucher-intent route-ban lett szerver-oldalon
    // beállítva, miután ellenőrizte, hogy a típus tényleg az adott üzleté és aktív.
    const amountHuf = Math.round(intent.amount / 100)
    const voucherTypeId = intent.metadata?.voucherTypeId

    const result = await createGiftVoucher({
      kind: data.kind,
      business,
      amountHuf,
      voucherTypeId,
      paymentIntentId: data.paymentIntentId,
      buyer: { name: data.purchaserName, email: data.purchaserEmail, city: data.purchaserCity, address: data.purchaserAddress, taxNumber: data.purchaserTaxNumber },
      recipient: { name: data.recipientName, email: data.recipientEmail, message: data.message },
      locale: data.locale,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[vouchers]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
