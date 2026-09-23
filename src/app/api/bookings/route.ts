import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getAvailableSlots, resolveAnyStaff } from '@/lib/availability'
import { hhmmToMinutes } from '@/lib/utils'
import { sendBookingConfirmation, sendNewBookingNotification } from '@/lib/email'
import { sendPushToUsers } from '@/lib/webPush'
import { generateSeriesDates, MAX_SERIES_COUNT } from '@/lib/recurrence'
import { isGuestBlocked } from '@/lib/blocklist'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { computeSalonDepositHuf } from '@/lib/depositCalc'
import { issueDepositInvoiceBestEffort } from '@/lib/depositInvoice'
import { upsertMarketingConsent } from '@/lib/customerConsent'
import type { Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

const schema = z.object({
  salonId: z.coerce.string(),
  serviceId: z.coerce.string(),
  // "Bármelyik szakember" választásnál a kliens null-t küld — koraibban ez a `z.coerce.string()`
  // miatt a "null" SZÖVEGGÉ alakult (mert String(null) === "null"), ami átment a .min(1)-en, majd
  // egy nem-létező staff-id-ként 404-et dobott. A `.nullable()` a `null`-t a coerce ELŐTT engedi
  // át, így itt helyesen `null` marad — a route lent felold egy konkrét, szabad szakembert.
  staffId: z.coerce.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  customer_name: z.string().min(2).max(120).refine(v => !/<[^>]+>/.test(v), 'Érvénytelen karakter a névben'),
  customer_email: z.string().email().max(254),
  customer_phone: z.string().min(7).max(30),
  customer_city: z.string().max(120).optional(),
  customer_address: z.string().max(200).optional(),
  customer_tax_number: z.string().max(30).optional(),
  notes: z.string().max(1000).optional(),
  locale: z.enum(['hu', 'en', 'de', 'es', 'it', 'fr']).default('hu'),
  // Opcionális ismétlődés. Hiánya → PONTOSAN a jelenlegi egyszeri viselkedés.
  repeat: z
    .object({
      freq: z.enum(['weekly', 'biweekly', 'monthly']),
      count: z.coerce.number().int().min(1).max(MAX_SERIES_COUNT),
    })
    .optional(),
  // A `/api/payments/deposit-intent`-ből kapott, már sikeresen megfizetett Stripe PaymentIntent.
  payment_intent_id: z.string().optional(),
  // Ajándékutalvány beváltása — opcionális, a foglaló-varázsló details lépésén beírt kód.
  voucher_code: z.string().max(20).optional(),
  // Marketing-hírlevél hozzájárulás — alapból üres jelölőnégyzet a details lépésen, csak akkor
  // küldi a kliens `true`-val, ha a vendég MAGA bepipálta (sose retroaktív/előre kipipált).
  marketing_consent: z.boolean().optional(),
  // Digitális beleegyező nyilatkozat elfogadása — csak a toggle be/ki állapotát küldi a
  // kliens, a szöveg-verziót és az IP-t a szerver írja be, sose bízunk a kliensben.
  consent_accepted: z.boolean().optional(),
  // Egyedi kérdések válaszai — a kliens csak a kérdés-id-t és a választ küldi, a kérdés
  // pontos szövegét (snapshothoz) a szerver a saját, friss szalon-rekordjából olvassa ki.
  custom_answers: z.array(z.object({ id: z.string(), answer: z.string().max(500) })).optional(),
})

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

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

  const { salonId, serviceId, date, start_time, end_time, customer_name, customer_email, customer_phone, customer_city, customer_address, customer_tax_number, notes, locale, repeat, payment_intent_id, voucher_code, marketing_consent, consent_accepted, custom_answers } = parsed.data
  let staffId = parsed.data.staffId

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

    // "Bármelyik szakember" — a kliens nem választott konkrétat, itt oldjuk fel egy tényleges,
    // szabad szakemberre. Ha nincs egyáltalán szabad, 409 (ugyanaz a "már foglalt" élmény,
    // mint egy konkrét szakembernél).
    if (!staffId) {
      const durationMinutes = hhmmToMinutes(end_time) - hhmmToMinutes(start_time)
      const resolved = await resolveAnyStaff({ salonId, serviceId, date, startTime: start_time, durationMinutes })
      if (!resolved) {
        return NextResponse.json({ error: 'Ez az időpont már foglalt' }, { status: 409 })
      }
      staffId = resolved
    }

    // overrideAccess: a publikus foglalás-flow (bejelentkezetlen vendég) — a route
    // a jogosultságot maga validálja (slot szabad, nem múltbeli). A create utáni
    // visszaolvasás és e három find a szigorított read-en máskülönben elhasalna.
    // A salon/service/staff a foglalás nyelvén töltve (localized tulaj-szöveg a visszaigazoló
    // emailhez); üres nyelvnél HU fallback. A slot-check ELŐTT töltjük be, mert a foglalt-ág
    // (lent) és az előleg-visszatérítés is szüksége van a salon adatra.
    // Ha bármelyik id érvénytelen (pl. a "Bármelyik szakember" választás miatt staffId hibásan
    // "null" szövegre koerciálódna), a findByID dob — ezt tiszta 400-ként adjuk vissza, NEM
    // hagyjuk 500-as szerver-hibaként összeomlani a kérést.
    let salon: Salon, service: Service, staff: StaffMember
    try {
      const results = await Promise.allSettled([
        payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, locale, fallbackLocale: 'hu' }) as Promise<Salon>,
        payload.findByID({ collection: 'services', id: serviceId, overrideAccess: true, locale, fallbackLocale: 'hu' }) as Promise<Service>,
        payload.findByID({ collection: 'staff', id: staffId, overrideAccess: true, locale, fallbackLocale: 'hu' }) as Promise<StaffMember>,
      ])
      const failedNames = (['salon', 'service', 'staff'] as const).filter((_, i) => results[i].status === 'rejected')
      if (failedNames.length > 0) {
        console.error(
          `[Bookings API] nem található: ${failedNames.join(', ')} — salonId=${salonId} serviceId=${serviceId} staffId=${staffId}`,
        )
        throw new Error(`not found: ${failedNames.join(',')}`)
      }
      ;[salon, service, staff] = results.map((r) => (r as PromiseFulfilledResult<unknown>).value) as [Salon, Service, StaffMember]
    } catch (e) {
      console.error('[Bookings API] salon/service/staff nem található:', e)
      return NextResponse.json({ error: 'A foglaláshoz szükséges adatok nem találhatók. Kérjük, kezdd újra a foglalást.' }, { status: 400 })
    }

    // Double-check slot is still available (race condition guard)
    const availableSlots = await getAvailableSlots({ salonId, staffId, serviceId, date })
    if (!availableSlots.some(s => s.start === start_time)) {
      // Ha volt már sikeres előleg-terhelés (a guest a deposit-intent híváskor még szabadnak
      // látta a slotot, de közben más elvitte) — AZONNALI visszatérítés, a hiba explicit
      // közli, hogy a vendéget NEM terhelték meg.
      let refunded = false
      if (payment_intent_id && salon.stripe_connect_account_id) {
        const stripe = getStripe()
        if (stripe) {
          try {
            await stripe.refunds.create({ payment_intent: payment_intent_id }, { stripeAccount: salon.stripe_connect_account_id })
            refunded = true
          } catch (e) {
            console.error('[Bookings API] refund-on-conflict hiba:', e)
          }
        }
      }
      const waitlistAvailable = !!salon.feature_modules?.waitlist_on
      return NextResponse.json(
        {
          error: refunded
            ? 'Ez az időpont időközben lefoglalásra került. Az előleget visszatérítettük.'
            : 'Ez az időpont már foglalt',
          ...(waitlistAvailable ? { waitlist: true } : {}),
        },
        { status: 409 },
      )
    }

    // Ha az üzletnél be van kapcsolva az előleg ÉS a Stripe onboarding kész, a fizetés
    // KÖTELEZŐ — sose bízzunk kliens-oldali jelzésben, mindig a szerver dönt.
    const depositRequired = !!salon.deposit_settings?.enabled && !!salon.stripe_connect_onboarded && !!salon.stripe_connect_account_id
    let depositHuf: number | null = null
    if (depositRequired) {
      if (!payment_intent_id) {
        return NextResponse.json({ error: 'Előleg szükséges ehhez a foglaláshoz' }, { status: 400 })
      }
      // Dupla-terhelés védelem: ez a PaymentIntent már felhasználva egy másik foglaláson?
      const existing = await payload.find({
        collection: 'bookings', where: { payment_intent_id: { equals: payment_intent_id } }, limit: 1, overrideAccess: true,
      })
      if (existing.totalDocs > 0) {
        return NextResponse.json({ error: 'Ez az előleg-fizetés már fel lett használva.' }, { status: 409 })
      }
      const stripe = getStripe()
      if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })
      const intent = await stripe.paymentIntents.retrieve(payment_intent_id, undefined, { stripeAccount: salon.stripe_connect_account_id! })
      const expectedHuf = computeSalonDepositHuf(salon.deposit_settings, service.price ?? 0)
      if (intent.status !== 'succeeded' || !expectedHuf || intent.amount !== hufToStripeMinor(expectedHuf)) {
        // Sikeres terhelés, de eltérő összeg/állapot — anomália, AZONNALI visszatérítés
        // (nem hagyjuk "elakadva" a vendég pénzét manuális rendezésre várva).
        if (intent.status === 'succeeded') {
          await stripe.refunds.create({ payment_intent: payment_intent_id }, { stripeAccount: salon.stripe_connect_account_id! }).catch((e) =>
            console.error('[Bookings API] anomália-refund hiba:', e),
          )
        }
        return NextResponse.json({ error: 'A fizetés ellenőrzése sikertelen. Kérjük, próbáld újra.' }, { status: 400 })
      }
      depositHuf = expectedHuf
    }

    // Beleegyező nyilatkozat — ha az üzletnél be van kapcsolva ÉS van megadott szöveg, az
    // elfogadás KÖTELEZŐ, sose bízunk kliens-oldali jelzésben, mindig a szerver dönt.
    const consentTemplateText = salon.consent_settings?.template_text?.trim() || null
    const consentRequired = !!salon.consent_settings?.enabled && !!consentTemplateText
    if (consentRequired && !consent_accepted) {
      return NextResponse.json({ error: 'A beleegyező nyilatkozat elfogadása szükséges a foglaláshoz' }, { status: 400 })
    }

    // Egyedi kérdések — kötelező kérdésre KÖTELEZŐ nem-üres válasz, a snapshot (kérdés + válasz)
    // a szerver saját, friss `custom_questions` sablonjából épül, sose a kliens szövegéből.
    const customQuestionDefs = salon.custom_questions ?? []
    const customAnswersById = new Map((custom_answers ?? []).map((a) => [a.id, a.answer]))
    for (const q of customQuestionDefs) {
      if (q.required && q.type !== 'yesno' && !(customAnswersById.get(q.id ?? '') ?? '').trim()) {
        return NextResponse.json({ error: 'Egy kötelező kérdésre nem érkezett válasz' }, { status: 400 })
      }
    }
    const customAnswersSnapshot: Record<string, { question: string; answer: string }> = {}
    for (const q of customQuestionDefs) {
      const ans = (customAnswersById.get(q.id ?? '') ?? '').trim()
      if (q.id && ans) customAnswersSnapshot[q.id] = { question: q.label, answer: ans }
    }

    // Ajándékutalvány beváltása — egyszeri, teljes felhasználás (nincs egyenleg/tárca-modell,
    // a fel nem használt maradék elvész, mint egy papír-utalványnál). A kód érvényességét itt
    // ÚJRA leellenőrizzük (sose bízzunk a kliens korábbi, `/api/vouchers/validate`-es
    // ellenőrzésében, ami csak UX-célú élő visszajelzés volt) — a tényleges beváltás (a voucher
    // `redeemed`-re állítása) csak a foglalás sikeres létrehozása UTÁN történik.
    let voucher: { id: string | number; code: string; amount_huf: number } | null = null
    if (voucher_code) {
      const voucherResult = await payload.find({
        collection: 'gift-vouchers',
        where: { and: [{ code: { equals: voucher_code.trim().toUpperCase() } }, { salon: { equals: salonId } }] },
        limit: 1,
        overrideAccess: true,
      })
      const found = voucherResult.docs[0]
      if (!found || found.status !== 'active' || new Date(found.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Az utalvány-kód érvénytelen vagy már felhasznált.' }, { status: 400 })
      }
      voucher = { id: found.id, code: found.code, amount_huf: found.amount_huf }
    }

    // Szalonoknál nincs külön "függőben" munkafolyamat — minden online foglalás rögtön
    // megerősítve jön be (a lemondás/befejezés a kezelés útja, nem egy köztes jóváhagyás).
    const bookingStatus: 'confirmed' = 'confirmed'

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
        context: { auditActor: 'Online foglalás' },
        data: {
          salon: Number(salonId),
          service: Number(serviceId),
          // Az ár pillanatfelvétele foglaláskor — lásd Bookings.ts komment: nélküle egy
          // utólagos ár-változtatás visszamenőleg átírná a bevétel-statisztikákat.
          price_snapshot: service.price,
          price_snapshot_currency: service.currency ?? 'HUF',
          staff: Number(staffId),
          customer_name,
          customer_email,
          customer_phone,
          date: d,
          start_time,
          end_time,
          status: bookingStatus,
          notes: notes ?? undefined,
          ...(customer_city ? { customer_city } : {}),
          ...(customer_address ? { customer_address } : {}),
          ...(customer_tax_number ? { customer_tax_number } : {}),
          locale,
          cancellation_token: randomBytes(32).toString('hex'),
          ...(seriesId ? { series_id: seriesId } : {}),
          // Az előleg-kötelezettség FÁZIS 1-ben csak az ELSŐ (kért) alkalomra vonatkozik — a
          // sorozat többi tagja a mai logika szerint, előleg nélkül jön létre.
          ...(d === date && depositRequired
            ? { payment_gateway: 'stripe' as const, payment_status: 'paid' as const, deposit_amount_huf: depositHuf ?? undefined, deposit_paid: true, payment_intent_id }
            : {}),
          // Az utalvány-beváltás is csak az ELSŐ (kért) alkalomra vonatkozik, ugyanúgy mint az előleg.
          ...(d === date && voucher ? { voucher_code: voucher.code, voucher_discount_huf: voucher.amount_huf } : {}),
          // A nyilatkozat-elfogadás is csak az ELSŐ (kért) alkalomra vonatkozik.
          ...(d === date && consentRequired
            ? {
                consent_accepted: true,
                consent_accepted_at: new Date().toISOString(),
                consent_accepted_via: 'online' as const,
                consent_text_snapshot: consentTemplateText,
                consent_accepted_ip: getIp(request),
              }
            : {}),
          // Az egyedi kérdések válaszai is csak az ELSŐ (kért) alkalomra vonatkoznak.
          ...(d === date && Object.keys(customAnswersSnapshot).length > 0
            ? { custom_answers: customAnswersSnapshot }
            : {}),
        },
      })) as unknown as Booking
      created.push(booking)
    }

    // Első (elsődleges) foglalás — a kért dátum mindig created[0], mert a fenti fő
    // availability-guard már átengedte, itt nem hagyjuk ki.
    const booking = created[0]
    if (voucher) {
      void payload.update({
        collection: 'gift-vouchers',
        id: voucher.id,
        overrideAccess: true,
        data: { status: 'redeemed', redeemed_at: new Date().toISOString(), redeemed_booking: booking.id },
      })
    }
    if (marketing_consent) {
      void upsertMarketingConsent({ kind: 'salon', businessId: salonId, name: customer_name, email: customer_email, phone: customer_phone, city: customer_city })
    }
    const emailData = { booking, salon, service, staff }
    if (salon.notification_prefs?.confirm_email !== false) {
      // A sorozat minden létrejött alkalmára megy visszaigazoló (a meglévő minta szerint).
      for (const b of created) void sendBookingConfirmation({ booking: b, salon, service, staff })
    }
    // Bizonylat-kiállítás sikeres előleg után — best-effort, nem blokkolja a választ.
    if (depositRequired && depositHuf) {
      void issueDepositInvoiceBestEffort({
        collection: 'bookings',
        id: booking.id,
        invoiceSettings: salon.invoice_settings,
        buyer: { name: customer_name, email: customer_email, city: customer_city, address: customer_address, taxNumber: customer_tax_number },
        label: `Előleg — ${service.name} · ${salon.name} · ${date}`,
        grossHuf: depositHuf,
        orderRef: String(payment_intent_id),
      })
    }
    void sendNewBookingNotification(emailData)
    // Azonnali push a tulajdonosnak (publikus foglalásnál).
    const pubOwnerId = salon.owner != null ? (typeof salon.owner === 'object' ? (salon.owner as { id: string | number }).id : salon.owner) : null
    if (pubOwnerId) {
      void sendPushToUsers(payload, [pubOwnerId], {
        title: `Új foglalás – ${salon.name}`,
        body: `${booking.customer_name} · ${booking.date} ${booking.start_time}`,
        url: '/dashboard/bookings',
        tag: `new-booking-${String(booking.id)}`,
      })
    }

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
