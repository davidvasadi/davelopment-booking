import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { validateAndAllocate } from '@/lib/restaurantBooking'
import { sendReservationConfirmation, sendReservationNotification } from '@/lib/restaurantEmail'
import { generateSeriesDates, MAX_SERIES_COUNT } from '@/lib/recurrence'
import { isGuestBlocked } from '@/lib/blocklist'
import type { Restaurant, Reservation } from '@/payload/payload-types'

const schema = z.object({
  restaurantId: z.coerce.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  locale: z.enum(['hu', 'en', 'de', 'es', 'it', 'fr']).default('hu'),
  // Opcionális ismétlődés. Hiánya → PONTOSAN a jelenlegi egyszeri viselkedés.
  repeat: z
    .object({
      freq: z.enum(['weekly', 'biweekly', 'monthly']),
      count: z.coerce.number().int().min(1).max(MAX_SERIES_COUNT),
    })
    .optional(),
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
  const { restaurantId, date, start_time, pax, customer_name, customer_email, customer_phone, country, notes, locale, repeat } = parsed.data

  try {
    const payload = await getPayloadClient()

    // A foglalás nyelvén töltjük (localized tulaj-szöveg a visszaigazoló emailhez); üresnél HU fallback.
    const restaurant = (await payload.findByID({
      collection: 'restaurants',
      id: restaurantId,
      overrideAccess: true,
      locale,
      fallbackLocale: 'hu',
    })) as Restaurant | null
    if (!restaurant) return NextResponse.json({ error: 'Étterem nem található' }, { status: 404 })

    if (restaurant.require_phone && !customer_phone?.trim()) {
      return NextResponse.json({ error: 'A telefonszám megadása kötelező' }, { status: 400 })
    }

    // Tiltólista (üzletenként): tiltott e-mail/telefon → ÁLTALÁNOS hiba (nem áruljuk el a tiltást).
    if (await isGuestBlocked({ business: 'restaurant', businessId: restaurantId, email: customer_email, phone: customer_phone })) {
      return NextResponse.json({ error: 'Ez az időpont sajnos nem foglalható. Kérjük, válassz másik időpontot.' }, { status: 409 })
    }

    const alloc = await validateAndAllocate({ restaurantId, date, start_time, pax })
    if (!alloc.ok) {
      // Defenzív: ha telt/nincs asztal ÉS az étteremnél be van kapcsolva a várólista,
      // jelezzük a kliensnek (waitlist:true). A flag KI → változatlan 409 hiba.
      const waitlistAvailable = !!restaurant.feature_modules?.waitlist_on
      return NextResponse.json(
        { error: alloc.error, ...(waitlistAvailable ? { waitlist: true } : {}) },
        { status: 409 },
      )
    }

    // Defenzív auto_confirm: alap (null/true) → 'confirmed' (változatlan). Csak explicit
    // false esetén 'pending' → a tulaj a meglévő státusz-kezeléssel erősíti meg.
    const reservationStatus: 'confirmed' | 'pending' =
      restaurant.booking_rules?.auto_confirm === false ? 'pending' : 'confirmed'

    // Ismétlődés csak akkor él, ha jött `repeat` ÉS a modul be van kapcsolva. Máskülönben
    // (nincs repeat, vagy recurring_on ki) → egyszeri foglalás, közös series_id nélkül.
    const seriesActive = !!repeat && !!restaurant.feature_modules?.recurring_on
    const seriesId = seriesActive ? randomBytes(16).toString('hex') : undefined
    const seriesDates = seriesActive && repeat ? generateSeriesDates(date, repeat) : [date]

    const created: Reservation[] = []
    const skipped: string[] = []
    for (const d of seriesDates) {
      // Az első alkalom asztal-allokációja már megvan (alloc). A többinél alkalmanként
      // lefuttatjuk a MEGLÉVŐ validateAndAllocate-ot; a telt/nincs-asztal alkalmakat
      // KIHAGYJUK (nem hibázunk).
      let dEnd = alloc.end_time
      let dTableIds = alloc.tableIds
      if (d !== date) {
        const a = await validateAndAllocate({ restaurantId, date: d, start_time, pax })
        if (!a.ok) {
          skipped.push(d)
          continue
        }
        dEnd = a.end_time
        dTableIds = a.tableIds
      }
      const reservation = (await payload.create({
        collection: 'reservations',
        data: {
          restaurant: Number(restaurantId),
          date: d,
          start_time,
          end_time: dEnd,
          pax,
          ...(dTableIds.length > 0 ? { tables: dTableIds.map(Number) } : {}),
          customer_name,
          customer_email,
          ...(customer_phone ? { customer_phone } : {}),
          ...(country ? { country } : {}),
          ...(notes ? { notes } : {}),
          status: reservationStatus,
          locale,
          cancel_token: randomBytes(24).toString('hex'),
          ...(seriesId ? { series_id: seriesId } : {}),
        },
        overrideAccess: true,
        depth: 1,
      })) as Reservation
      created.push(reservation)
    }

    // Az első (kért) alkalom mindig created[0], mert az alloc fent már átment.
    const reservation = created[0]
    // Emailek — best-effort, ne blokkoljanak hibára. Sorozatnál minden alkalomra megy.
    if (restaurant.notification_prefs?.confirm_email !== false) {
      for (const r of created) void sendReservationConfirmation({ reservation: r, restaurant })
    }
    void sendReservationNotification({ reservation, restaurant })

    // Egyszeri esetben a válasz alakja változatlan. Sorozatnál kiegészítjük series-metaadatokkal.
    if (seriesActive) {
      return NextResponse.json({
        ok: true,
        reservationId: reservation.id,
        cancel_token: reservation.cancel_token,
        series_id: seriesId,
        created_count: created.length,
        skipped_dates: skipped,
      })
    }
    return NextResponse.json({ ok: true, reservationId: reservation.id, cancel_token: reservation.cancel_token })
  } catch (err) {
    console.error('[Restaurant Reservations API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
