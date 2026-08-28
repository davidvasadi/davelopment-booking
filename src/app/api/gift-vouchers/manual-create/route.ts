import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'
import { createGiftVoucher } from '@/lib/createGiftVoucher'
import type { Salon, Restaurant, GiftVoucherType } from '@/payload/payload-types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

const buyerFields = {
  purchaserName: z.string().min(1), purchaserEmail: z.string().email(),
  purchaserCity: z.string().min(1), purchaserAddress: z.string().min(1),
  purchaserTaxNumber: z.string().optional(),
  recipientName: z.string().optional(), recipientEmail: z.string().email().optional().or(z.literal('')),
  message: z.string().optional(),
  voucherTypeId: z.string().min(1),
  paymentMode: z.enum(['paid', 'link']),
}
const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('salon'), salonId: z.coerce.string(), ...buyerFields }),
  z.object({ kind: z.literal('restaurant'), restaurantId: z.coerce.string(), ...buyerFields }),
])

/**
 * Admin/személyzet-oldali utalvány-kiállítás a dashboard "Utalványok" oldaláról
 * (`VoucherCreateWizard.tsx`) — owner-hitelesített, NEM publikus. Két mód:
 * - `paid`: a vendég helyben már fizetett (készpénz/POS-kártya) — a kódot AZONNAL kiállítjuk,
 *   nincs új Stripe-tranzakció (szintetikus, egyedi `payment_intent_id`).
 * - `link`: Stripe Checkout Session-t hozunk létre a csatlakoztatott (Connect) fiókon — a
 *   voucher-rekord csak a SIKERES fizetés után, a Connect webhookból jön létre (lásd
 *   `src/app/api/stripe/connect/webhook/route.ts`), mert a vendég a saját eszközén fizet.
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const data = parsed.data

  const payload = await getPayloadClient()
  const denied = data.kind === 'salon'
    ? await assertCapability(user.id, 'salon', data.salonId, 'vouchers.manage')
    : await assertCapability(user.id, 'restaurant', data.restaurantId, 'vouchers.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const business =
    data.kind === 'salon'
      ? ((await payload.findByID({ collection: 'salons', id: data.salonId, overrideAccess: true }).catch(() => null)) as Salon | null)
      : ((await payload.findByID({ collection: 'restaurants', id: data.restaurantId, overrideAccess: true }).catch(() => null)) as Restaurant | null)
  if (!business) return NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 })

  const voucherType = (await payload.findByID({ collection: 'gift-voucher-types', id: data.voucherTypeId, depth: 0, overrideAccess: true }).catch(() => null)) as GiftVoucherType | null
  const belongsToBusiness = data.kind === 'salon' ? String(voucherType?.salon) === String(data.salonId) : String(voucherType?.restaurant) === String(data.restaurantId)
  if (!voucherType || !belongsToBusiness) return NextResponse.json({ error: 'Érvénytelen utalvány-típus.' }, { status: 400 })

  try {
    if (data.paymentMode === 'paid') {
      const code = `manual-${Date.now()}-${Math.round(Math.random() * 1e6)}`
      const result = await createGiftVoucher({
        kind: data.kind,
        business,
        amountHuf: voucherType.amount_huf,
        voucherTypeId: voucherType.id,
        paymentIntentId: code,
        buyer: { name: data.purchaserName, email: data.purchaserEmail, city: data.purchaserCity, address: data.purchaserAddress, taxNumber: data.purchaserTaxNumber },
        recipient: { name: data.recipientName, email: data.recipientEmail, message: data.message },
      })
      return NextResponse.json(result)
    }

    // paymentMode === 'link'
    if (!business.stripe_connect_account_id) {
      return NextResponse.json({ error: 'Ehhez az üzlethez nincs Stripe Connect fiók bekötve.' }, { status: 400 })
    }
    const stripe = getStripe()
    if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'huf',
            unit_amount: hufToStripeMinor(voucherType.amount_huf),
            product_data: { name: voucherType.name || 'Ajándékutalvány' },
          },
          quantity: 1,
        }],
        customer_email: data.purchaserEmail,
        payment_intent_data: {
          receipt_email: data.purchaserEmail,
          metadata: {
            kind: 'gift-voucher',
            ...(data.kind === 'salon' ? { salonId: data.salonId } : { restaurantId: data.restaurantId }),
            voucherTypeId: String(voucherType.id),
            purchaserName: data.purchaserName,
            purchaserEmail: data.purchaserEmail,
            purchaserCity: data.purchaserCity,
            purchaserAddress: data.purchaserAddress ?? '',
            purchaserTaxNumber: data.purchaserTaxNumber ?? '',
            recipientName: data.recipientName ?? '',
            recipientEmail: data.recipientEmail ?? '',
            message: (data.message ?? '').slice(0, 480),
          },
        },
        success_url: `${APP_URL}/${business.slug}?voucher_purchased=1`,
        cancel_url: `${APP_URL}/${business.slug}`,
      },
      { stripeAccount: business.stripe_connect_account_id },
    )

    if (!session.url) return NextResponse.json({ error: 'Nem sikerült létrehozni a fizetési linket.' }, { status: 500 })
    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      purchaserName: data.purchaserName,
      purchaserEmail: data.purchaserEmail,
      amountHuf: voucherType.amount_huf,
      typeName: voucherType.name,
    })
  } catch (err) {
    console.error('[gift-vouchers/manual-create]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
