import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getAvailableSlots } from '@/lib/availability'
import { sendBookingConfirmation, sendNewBookingNotification } from '@/lib/email'
import { generateSeriesDates, MAX_SERIES_COUNT } from '@/lib/recurrence'
import { isGuestBlocked } from '@/lib/blocklist'
import type { Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

const schema = z.object({
  salonId: z.coerce.string(),
  serviceId: z.coerce.string(),
  staffId: z.coerce.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().min(7),
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
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>
    const firstField = Object.keys(fieldErrors)[0]
    const firstMsg = firstField ? `${firstField}: ${fieldErrors[firstField]?.[0]}` : 'Érvénytelen adatok'
    console.error('[Bookings API] Validation error:', fieldErrors)
    return NextResponse.json({ error: firstMsg }, { status: 400 })
  }

  const { salonId, serviceId, staffId, date, start_time, end_time, customer_name, customer_email, customer_phone, notes, locale, repeat } = parsed.data

  // Tiltólista (üzletenként): tiltott e-mail/telefon → ÁLTALÁNOS hiba (nem áruljuk el a tiltást).
  if (await isGuestBlocked({ business: 'salon', businessId: salonId, email: customer_email, phone: customer_phone })) {
    return NextResponse.json({ error: 'Ez az időpont sajnos nem foglalható. Kérjük, válassz másik időpontot.' }, { status: 409 })
  }

  // Reject bookings in the past
  const today = new Date().toISOString().split('T')[0]
  if (date < today) {
    return NextResponse.json({ error: 'Múltbeli időpontra nem lehet foglalni' }, { status: 400 })
  }
  if (date === today) {
    const [h, m] = start_time.split(':').map(Number)
    const slotMinutes = h * 60 + m
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
    if (slotMinutes <= nowMinutes) {
      return NextResponse.json({ error: 'Ez az időpont már elmúlt' }, { status: 400 })
    }
  }

  try {
    const payload = await getPayloadClient()

    // Double-check slot is still available (race condition guard)
    const availableSlots = await getAvailableSlots({ salonId, staffId, serviceId, date })
    if (!availableSlots.some(s => s.start === start_time)) {
      // Defenzív: ha telt a slot ÉS az üzletnél be van kapcsolva a várólista, jelezzük a
      // kliensnek, hogy feliratkozhat (waitlist:true). A flag KI → változatlan „foglalt” hiba.
      const salonForWaitlist = (await payload.findByID({
        collection: 'salons', id: salonId, overrideAccess: true, depth: 0,
      }).catch(() => null)) as Salon | null
      const waitlistAvailable = !!salonForWaitlist?.feature_modules?.waitlist_on
      return NextResponse.json(
        { error: 'Ez az időpont már foglalt', ...(waitlistAvailable ? { waitlist: true } : {}) },
        { status: 409 },
      )
    }

    // overrideAccess: a publikus foglalás-flow (bejelentkezetlen vendég) — a route
    // a jogosultságot maga validálja (slot szabad, nem múltbeli). A create utáni
    // visszaolvasás és e három find a szigorított read-en máskülönben elhasalna.
    // A salon/service/staff a foglalás nyelvén töltve (localized tulaj-szöveg a visszaigazoló
    // emailhez); üres nyelvnél HU fallback.
    const [salon, service, staff] = await Promise.all([
      payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, locale, fallbackLocale: 'hu' }) as Promise<Salon>,
      payload.findByID({ collection: 'services', id: serviceId, overrideAccess: true, locale, fallbackLocale: 'hu' }) as Promise<Service>,
      payload.findByID({ collection: 'staff', id: staffId, overrideAccess: true, locale, fallbackLocale: 'hu' }) as Promise<StaffMember>,
    ])

    // Defenzív auto_confirm: alap (null/true) → 'confirmed' (változatlan). Csak ha a tulaj
    // EXPLICIT kikapcsolta (auto_confirm === false), akkor 'pending' → kézi jóváhagyás.
    const bookingStatus: 'confirmed' | 'pending' =
      salon.booking_rules?.auto_confirm === false ? 'pending' : 'confirmed'

    // Ismétlődés csak akkor él, ha jött `repeat` ÉS a modul be van kapcsolva. Máskülönben
    // (nincs repeat, vagy recurring_on ki) → egyszeri foglalás, közös series_id nélkül.
    const seriesActive = !!repeat && !!salon.feature_modules?.recurring_on
    const seriesId = seriesActive ? randomBytes(16).toString('hex') : undefined
    const seriesDates = seriesActive && repeat ? generateSeriesDates(date, repeat) : [date]

    const created: Booking[] = []
    const skipped: string[] = []
    for (const d of seriesDates) {
      // A sorozat első alkalmát (a kért dátum) már ellenőriztük fent; a többinél
      // alkalmanként lefuttatjuk a MEGLÉVŐ szabad-slot ellenőrzést. A foglalt/nem elérhető
      // alkalmakat KIHAGYJUK (nem hibázunk), így a sorozat a szabad időpontokból áll össze.
      if (d !== date) {
        const slots = await getAvailableSlots({ salonId, staffId, serviceId, date: d })
        if (!slots.some((s) => s.start === start_time)) {
          skipped.push(d)
          continue
        }
      }
      const booking = (await payload.create({
        collection: 'bookings',
        overrideAccess: true,
        data: {
          salon: Number(salonId),
          service: Number(serviceId),
          staff: Number(staffId),
          customer_name,
          customer_email,
          customer_phone,
          date: d,
          start_time,
          end_time,
          status: bookingStatus,
          notes: notes ?? undefined,
          locale,
          cancellation_token: randomBytes(32).toString('hex'),
          ...(seriesId ? { series_id: seriesId } : {}),
        },
      })) as unknown as Booking
      created.push(booking)
    }

    // Első (elsődleges) foglalás — a kért dátum mindig created[0], mert a fenti fő
    // availability-guard már átengedte, itt nem hagyjuk ki.
    const booking = created[0]
    const emailData = { booking, salon, service, staff }
    if (salon.notification_prefs?.confirm_email !== false) {
      // A sorozat minden létrejött alkalmára megy visszaigazoló (a meglévő minta szerint).
      for (const b of created) void sendBookingConfirmation({ booking: b, salon, service, staff })
    }
    void sendNewBookingNotification(emailData)

    // Egyszeri esetben a válasz alakja változatlan ({ booking }). Sorozatnál kiegészítjük
    // a series-metaadatokkal, de a `booking` mező (első alkalom) marad a kompatibilitásért.
    if (seriesActive) {
      return NextResponse.json(
        { booking, series_id: seriesId, created_count: created.length, skipped_dates: skipped },
        { status: 201 },
      )
    }
    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    console.error('[Bookings API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
