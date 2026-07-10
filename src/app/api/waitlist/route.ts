import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { sendWaitlistSignupEmail as sendSalonWaitlistSignup } from '@/lib/email'
import { sendWaitlistSignupEmail as sendRestaurantWaitlistSignup } from '@/lib/restaurantEmail'
import type { Salon, Restaurant } from '@/payload/payload-types'

/**
 * Publikus várólista-feliratkozás. Additív, defenzív: csak akkor hoz létre bejegyzést, ha az
 * adott üzletnél a várólista TÉNYLEG be van kapcsolva — EGYETLEN kapcsoló: a Funkció-központ
 * `feature_modules.waitlist_on`-ja. Pontosan az egyik közül salonId VAGY restaurantId adandó
 * meg. A tényleges foglalás-flow-t nem érinti.
 */
const schema = z.object({
  salonId: z.coerce.string().optional(),
  restaurantId: z.coerce.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50).optional(),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().optional(),
  locale: z.enum(['hu', 'en', 'de', 'es', 'it', 'fr']).default('hu'),
})

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
  const { salonId, restaurantId, date, time, pax, customer_name, customer_email, customer_phone, locale } = parsed.data

  if ((!salonId && !restaurantId) || (salonId && restaurantId)) {
    return NextResponse.json({ error: 'Pontosan egy üzlet (salonId vagy restaurantId) adandó meg' }, { status: 400 })
  }

  try {
    const payload = await getPayloadClient()

    let salon: Salon | null = null
    let restaurant: Restaurant | null = null
    if (salonId) {
      salon = (await payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, depth: 0, locale, fallbackLocale: 'hu' }).catch(() => null)) as Salon | null
      if (!salon) return NextResponse.json({ error: 'Szalon nem található' }, { status: 404 })
    } else {
      restaurant = (await payload.findByID({ collection: 'restaurants', id: restaurantId!, overrideAccess: true, depth: 0, locale, fallbackLocale: 'hu' }).catch(() => null)) as Restaurant | null
      if (!restaurant) return NextResponse.json({ error: 'Étterem nem található' }, { status: 404 })
    }

    const biz = (salon ?? restaurant)!
    // A várólista EGYETLEN kapcsolója a Funkció-központ `feature_modules.waitlist_on`-ja.
    const waitlistEnabled = !!biz.feature_modules?.waitlist_on
    if (!waitlistEnabled) {
      return NextResponse.json({ error: 'A várólista ennél az üzletnél nem elérhető' }, { status: 400 })
    }

    const token = randomBytes(24).toString('hex')

    await payload.create({
      collection: 'waitlist',
      overrideAccess: true,
      context: { auditActor: 'Várólista (vendég)' },
      data: {
        ...(salon ? { salon: Number(salonId) } : { restaurant: Number(restaurantId) }),
        date,
        time,
        ...(pax != null ? { pax } : {}),
        customer_name,
        customer_email,
        ...(customer_phone ? { customer_phone } : {}),
        status: 'waiting',
        token,
        locale,
      },
    })

    // Feliratkozás-visszaigazoló email — best-effort, ne blokkoljon hibára.
    if (salon) {
      void sendSalonWaitlistSignup({ salon, customer_name, customer_email, date, time })
    } else if (restaurant) {
      void sendRestaurantWaitlistSignup({ restaurant, customer_name, customer_email, date, time, pax })
    }

    return NextResponse.json({ ok: true, token }, { status: 201 })
  } catch (err) {
    console.error('[Waitlist API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
