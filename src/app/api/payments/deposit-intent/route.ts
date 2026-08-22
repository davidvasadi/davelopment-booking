import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { getAvailableSlots, resolveAnyStaff } from '@/lib/availability'
import { validateAndAllocate } from '@/lib/restaurantBooking'
import { computeSalonDepositHuf, computeRestaurantDepositHuf } from '@/lib/depositCalc'
import type { Salon, Restaurant, Service } from '@/payload/payload-types'

const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('salon'),
    salonId: z.coerce.string(),
    serviceId: z.coerce.string(),
    // "Bármelyik szakember" → null a kliensről; lásd a bookings/route.ts azonos megjegyzését.
    staffId: z.coerce.string().min(1).nullable().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    // Opcionális: ha a wizard ezen a ponton már ismeri a vendég emailjét, a Stripe ide küldi
    // a fizetési nyugtát (`receipt_email`) — ez FÜGGETLEN az üzlet saját Számlázz.hu/Billingo
    // bizonylatától (lásd `depositInvoice.ts`), a kettő együtt fut, nem helyettesíti egymást.
    email: z.string().email().optional(),
  }),
  z.object({
    kind: z.literal('restaurant'),
    restaurantId: z.coerce.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    pax: z.coerce.number().int().min(1).max(50),
    email: z.string().email().optional(),
  }),
])

/**
 * Előleg-fizetési szándék létrehozása — publikus (vendég, bejelentkezés nélkül), ugyanaz a
 * bizalmi modell mint a `/api/bookings` / `/api/restaurant/reservations`. Ez a route MÉG NEM
 * hozza létre a foglalást, csak a Stripe PaymentIntentet — a tényleges foglalás-létrehozás
 * (és időpont-lefoglalás) a meglévő booking route-okban történik, `payment_intent_id`-vel.
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

    if (data.kind === 'salon') {
      const salon = (await payload.findByID({ collection: 'salons', id: data.salonId, overrideAccess: true }).catch(() => null)) as Salon | null
      if (!salon) return NextResponse.json({ error: 'Szalon nem található' }, { status: 404 })

      // Sose bízzunk kliens-oldali "az előleg be van kapcsolva" jelzésben — a szerver mindig
      // maga ellenőrzi, hogy tényleg elérhető-e az előleg ennél az üzletnél.
      if (!salon.deposit_settings?.enabled || !salon.stripe_connect_onboarded || !salon.stripe_connect_account_id) {
        return NextResponse.json({ error: 'Az előleg jelenleg nem elérhető ennél az üzletnél.' }, { status: 400 })
      }

      const service = (await payload.findByID({ collection: 'services', id: data.serviceId, overrideAccess: true }).catch(() => null)) as Service | null
      if (!service) return NextResponse.json({ error: 'Szolgáltatás nem található' }, { status: 404 })

      let staffId = data.staffId
      if (!staffId) {
        const resolved = await resolveAnyStaff({
          salonId: data.salonId, serviceId: data.serviceId, date: data.date,
          startTime: data.start_time, durationMinutes: service.duration_minutes ?? 30,
        })
        if (!resolved) return NextResponse.json({ error: 'Ez az időpont már foglalt' }, { status: 409 })
        staffId = resolved
      }

      const availableSlots = await getAvailableSlots({ salonId: data.salonId, staffId, serviceId: data.serviceId, date: data.date })
      if (!availableSlots.some((s) => s.start === data.start_time)) {
        return NextResponse.json({ error: 'Ez az időpont már foglalt' }, { status: 409 })
      }

      const depositHuf = computeSalonDepositHuf(salon.deposit_settings, service.price ?? 0)
      if (!depositHuf || depositHuf <= 0) {
        return NextResponse.json({ error: 'Nem sikerült kiszámolni az előleg összegét.' }, { status: 400 })
      }

      const intent = await stripe.paymentIntents.create(
        {
          amount: hufToStripeMinor(depositHuf),
          currency: 'huf',
          automatic_payment_methods: { enabled: true },
          receipt_email: data.email,
          metadata: {
            kind: 'salon', salonId: data.salonId, serviceId: data.serviceId, staffId,
            date: data.date, start_time: data.start_time, depositHuf: String(depositHuf),
          },
        },
        { stripeAccount: salon.stripe_connect_account_id },
      )

      return NextResponse.json({
        clientSecret: intent.client_secret,
        connectedAccountId: salon.stripe_connect_account_id,
        depositAmountHuf: depositHuf,
        paymentIntentId: intent.id,
      })
    }

    // kind === 'restaurant'
    const restaurant = (await payload.findByID({ collection: 'restaurants', id: data.restaurantId, overrideAccess: true }).catch(() => null)) as Restaurant | null
    if (!restaurant) return NextResponse.json({ error: 'Étterem nem található' }, { status: 404 })

    if (!restaurant.deposit_settings?.enabled || !restaurant.stripe_connect_onboarded || !restaurant.stripe_connect_account_id) {
      return NextResponse.json({ error: 'Az előleg jelenleg nem elérhető ennél az üzletnél.' }, { status: 400 })
    }

    const alloc = await validateAndAllocate({ restaurantId: data.restaurantId, date: data.date, start_time: data.start_time, pax: data.pax })
    if (!alloc.ok) return NextResponse.json({ error: alloc.error }, { status: 409 })

    const depositHuf = computeRestaurantDepositHuf(restaurant.deposit_settings, data.pax)
    if (!depositHuf || depositHuf <= 0) {
      return NextResponse.json({ error: 'Nem sikerült kiszámolni az előleg összegét.' }, { status: 400 })
    }

    const intent = await stripe.paymentIntents.create(
      {
        amount: hufToStripeMinor(depositHuf),
        currency: 'huf',
        automatic_payment_methods: { enabled: true },
        receipt_email: data.email,
        metadata: {
          kind: 'restaurant', restaurantId: data.restaurantId, date: data.date,
          start_time: data.start_time, pax: String(data.pax), depositHuf: String(depositHuf),
        },
      },
      { stripeAccount: restaurant.stripe_connect_account_id },
    )

    return NextResponse.json({
      clientSecret: intent.client_secret,
      connectedAccountId: restaurant.stripe_connect_account_id,
      depositAmountHuf: depositHuf,
      paymentIntentId: intent.id,
    })
  } catch (err) {
    console.error('[deposit-intent]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
