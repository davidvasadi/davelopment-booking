import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { validateAndAllocate } from '@/lib/restaurantBooking'
import { sendReservationConfirmation } from '@/lib/restaurantEmail'
import { generateSeriesDates, MAX_SERIES_COUNT } from '@/lib/recurrence'
import { isGuestBlocked } from '@/lib/blocklist'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { computeRestaurantDepositHuf, depositApplies } from '@/lib/depositCalc'
import { issueDepositInvoiceBestEffort } from '@/lib/depositInvoice'
import { isWithinBookingWindow } from '@/lib/bookingWindow'
import { upsertMarketingConsent } from '@/lib/customerConsent'
import type { Restaurant, Reservation } from '@/payload/payload-types'
import { isBusinessLocked, LOCKED_ERROR } from '@/lib/businessLock'
import { isForeignCountry, normalizeCountry } from '@/lib/countries'

const schema = z.object({
  restaurantId: z.coerce.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50),
  customer_name: z.string().min(2).max(120),
  customer_email: z.string().email().max(254),
  customer_phone: z.string().max(30).optional(),
  customer_city: z.string().max(120).optional(),
  customer_address: z.string().max(200).optional(),
  customer_tax_number: z.string().max(30).optional(),
  /** számlázási ország (ISO) — a `country` a telefonszám országa, ez a számláé */
  customer_country: z.string().max(2).optional(),
  country: z.string().max(60).optional(),
  notes: z.string().max(1000).optional(),
  occasion: z.string().max(80).optional(),
  occasion_icon: z.string().max(40).optional(),
  locale: z.enum(['hu', 'en', 'de', 'es', 'it', 'fr']).default('hu'),
  // Opcionális ismétlődés. Hiánya → PONTOSAN a jelenlegi egyszeri viselkedés.
  repeat: z
    .object({
      freq: z.enum(['weekly', 'biweekly', 'monthly']),
      count: z.coerce.number().int().min(1).max(MAX_SERIES_COUNT),
    })
    .optional(),
  payment_intent_id: z.string().optional(),
  voucher_code: z.string().max(20).optional(),
  marketing_consent: z.boolean().optional(),
  // Digitális beleegyező nyilatkozat elfogadása — csak a toggle be/ki állapotát küldi a
  // kliens, a szöveg-verziót és az IP-t a szerver írja be, sose bízunk a kliensben.
  consent_accepted: z.boolean().optional(),
  // Egyedi kérdések válaszai — a kliens csak a kérdés-id-t és a választ küldi, a kérdés
  // pontos szövegét (snapshothoz) a szerver a saját, friss étterem-rekordjából olvassa ki.
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
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }
  const { restaurantId, date, start_time, pax, customer_name, customer_email, customer_phone, customer_city, customer_address, customer_tax_number: taxIn, customer_country: countryIn, country, notes, occasion, occasion_icon, locale, repeat, payment_intent_id, voucher_code, marketing_consent, consent_accepted, custom_answers } = parsed.data
  // számlázási ország; külföldi vevő csak magánszemélyként — az adószámot ilyenkor eldobjuk (lib/countries)
  const customer_country = normalizeCountry(countryIn) ?? undefined
  const customer_tax_number = isForeignCountry(customer_country) ? undefined : taxIn

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
    // zárolt üzlet (lejárt / szünetelő előfizetés): nincs új online foglalás (design 21.13)
    if (await isBusinessLocked(payload, restaurant.owner)) return NextResponse.json({ error: LOCKED_ERROR, locked: true }, { status: 423 })

    // Foglalási ablak — ugyanaz a szabály, mint a szalonnál (eddig itt egyáltalán nem volt
    // ellenőrizve, közvetlen API-hívással bármilyen távoli napra lehetett foglalni).
    if (!isWithinBookingWindow(restaurant, date)) {
      return NextResponse.json({ error: 'Erre a napra még nem lehet foglalni.' }, { status: 400 })
    }

    if (restaurant.require_phone && !customer_phone?.trim()) {
      return NextResponse.json({ error: 'A telefonszám megadása kötelező' }, { status: 400 })
    }

    // Tiltólista (üzletenként): tiltott e-mail/telefon → ÁLTALÁNOS hiba (nem áruljuk el a tiltást).
    if (await isGuestBlocked({ business: 'restaurant', businessId: restaurantId, email: customer_email, phone: customer_phone })) {
      return NextResponse.json({ error: 'Ez az időpont sajnos nem foglalható. Kérjük, válassz másik időpontot.' }, { status: 409 })
    }

    const alloc = await validateAndAllocate({ restaurantId, date, start_time, pax, online: true })
    if (!alloc.ok) {
      // Ha volt már sikeres előleg-terhelés — AZONNALI visszatérítés, mint a szalon oldalon.
      let refunded = false
      if (payment_intent_id && restaurant.stripe_connect_account_id) {
        const stripe = getStripe()
        if (stripe) {
          try {
            await stripe.refunds.create({ payment_intent: payment_intent_id }, { stripeAccount: restaurant.stripe_connect_account_id })
            refunded = true
          } catch (e) {
            console.error('[Restaurant Reservations API] refund-on-conflict hiba:', e)
          }
        }
      }
      // Defenzív: ha telt/nincs asztal ÉS az étteremnél be van kapcsolva a várólista,
      // jelezzük a kliensnek (waitlist:true). A flag KI → változatlan 409 hiba.
      const waitlistAvailable = !!restaurant.feature_modules?.waitlist_on
      return NextResponse.json(
        {
          error: refunded ? 'Ez az időpont időközben lefoglalásra került. Az előleget visszatérítettük.' : alloc.error,
          ...(waitlistAvailable ? { waitlist: true } : {}),
        },
        { status: 409 },
      )
    }

    // Defenzív auto_confirm: alap (null/true) → 'confirmed' (változatlan). Csak explicit
    // false esetén 'pending' → a tulaj a meglévő státusz-kezeléssel erősíti meg.
    // Előleges foglalás MINDIG azonnal megerősített (a vendég már fizetett — jóváhagyásra várás
    // és utólagos elutasítás itt visszatérítési zűrt okozna); a szerkesztő sem engedi kikapcsolni.
    const depositOnForAutoConfirm = !!restaurant.deposit_settings?.enabled && !!restaurant.stripe_connect_onboarded && !!restaurant.stripe_connect_account_id && depositApplies(restaurant.deposit_settings, { date, pax })
    const reservationStatus: 'confirmed' | 'pending' =
      restaurant.booking_rules?.auto_confirm === false && !depositOnForAutoConfirm ? 'pending' : 'confirmed'

    // Ha az étteremnél be van kapcsolva az előleg ÉS a Stripe onboarding kész, a fizetés
    // KÖTELEZŐ — sose bízzunk kliens-oldali jelzésben.
    // „Mely foglalásoknál” (16.1): ugyanaz a szabály, mint a foglalóoldalon
    const depositRequired = !!restaurant.deposit_settings?.enabled && !!restaurant.stripe_connect_onboarded && !!restaurant.stripe_connect_account_id && depositApplies(restaurant.deposit_settings, { date, pax })
    let depositHuf: number | null = null
    if (depositRequired) {
      if (!payment_intent_id) {
        return NextResponse.json({ error: 'Előleg szükséges ehhez a foglaláshoz' }, { status: 400 })
      }
      const existing = await payload.find({
        collection: 'reservations', where: { payment_intent_id: { equals: payment_intent_id } }, limit: 1, overrideAccess: true,
      })
      if (existing.totalDocs > 0) {
        return NextResponse.json({ error: 'Ez az előleg-fizetés már fel lett használva.' }, { status: 409 })
      }
      const stripe = getStripe()
      if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })
      const intent = await stripe.paymentIntents.retrieve(payment_intent_id, undefined, { stripeAccount: restaurant.stripe_connect_account_id! })
      const expectedHuf = computeRestaurantDepositHuf(restaurant.deposit_settings, pax, date)
      if (intent.status !== 'succeeded' || !expectedHuf || intent.amount !== hufToStripeMinor(expectedHuf)) {
        if (intent.status === 'succeeded') {
          await stripe.refunds.create({ payment_intent: payment_intent_id }, { stripeAccount: restaurant.stripe_connect_account_id! }).catch((e) =>
            console.error('[Restaurant Reservations API] anomália-refund hiba:', e),
          )
        }
        return NextResponse.json({ error: 'A fizetés ellenőrzése sikertelen. Kérjük, próbáld újra.' }, { status: 400 })
      }
      depositHuf = expectedHuf
    }

    // Beleegyező nyilatkozat — ha az étteremnél be van kapcsolva ÉS van megadott szöveg, az
    // elfogadás KÖTELEZŐ, sose bízunk kliens-oldali jelzésben.
    const consentTemplateText = restaurant.consent_settings?.template_text?.trim() || null
    const consentRequired = !!restaurant.consent_settings?.enabled && !!consentTemplateText
    if (consentRequired && !consent_accepted) {
      return NextResponse.json({ error: 'A beleegyező nyilatkozat elfogadása szükséges a foglaláshoz' }, { status: 400 })
    }

    // Egyedi kérdések — kötelező kérdésre KÖTELEZŐ nem-üres válasz, a snapshot (kérdés + válasz)
    // a szerver saját, friss `custom_questions` sablonjából épül, sose a kliens szövegéből.
    const customQuestionDefs = restaurant.custom_questions ?? []
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

    // Ajándékutalvány beváltása — egyszeri, teljes felhasználás, ugyanaz a minta, mint a
    // szalon `/api/bookings` route-jában.
    let voucher: { id: string | number; code: string; amount_huf: number } | null = null
    if (voucher_code) {
      const voucherResult = await payload.find({
        collection: 'gift-vouchers',
        where: { and: [{ code: { equals: voucher_code.trim().toUpperCase() } }, { restaurant: { equals: restaurantId } }] },
        limit: 1,
        overrideAccess: true,
      })
      const found = voucherResult.docs[0]
      if (!found || found.status !== 'active' || new Date(found.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Az utalvány-kód érvénytelen vagy már felhasznált.' }, { status: 400 })
      }
      voucher = { id: found.id, code: found.code, amount_huf: found.amount_huf }
    }

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
        const a = await validateAndAllocate({ restaurantId, date: d, start_time, pax, online: true })
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
          ...(customer_city ? { customer_city } : {}),
          ...(customer_address ? { customer_address } : {}),
          ...(customer_tax_number ? { customer_tax_number } : {}),
          ...(customer_country ? { customer_country } : {}),
          ...(country ? { country } : {}),
          ...(notes ? { notes } : {}),
          ...(occasion ? { occasion } : {}),
          ...(occasion_icon ? { occasion_icon } : {}),
          status: reservationStatus,
          locale,
          cancel_token: randomBytes(24).toString('hex'),
          ...(seriesId ? { series_id: seriesId } : {}),
          // Az előleg-kötelezettség FÁZIS 1-ben csak az ELSŐ (kért) alkalomra vonatkozik.
          ...(d === date && depositRequired
            ? { payment_gateway: 'stripe' as const, payment_status: 'paid' as const, deposit_amount_huf: depositHuf ?? undefined, deposit_paid: true, deposit_kind: 'foglalo', payment_intent_id }
            : {}),
          ...(d === date && voucher ? { voucher_code: voucher.code, voucher_discount_huf: voucher.amount_huf } : {}),
          ...(d === date && consentRequired
            ? {
                consent_accepted: true,
                consent_accepted_at: new Date().toISOString(),
                consent_accepted_via: 'online' as const,
                consent_text_snapshot: consentTemplateText,
                consent_accepted_ip: getIp(request),
              }
            : {}),
          ...(d === date && Object.keys(customAnswersSnapshot).length > 0
            ? { custom_answers: customAnswersSnapshot }
            : {}),
        },
        overrideAccess: true,
        context: { auditActor: 'Online foglalás' },
        depth: 1,
      })) as Reservation
      created.push(reservation)
    }

    // Az első (kért) alkalom mindig created[0], mert az alloc fent már átment.
    const reservation = created[0]
    if (voucher) {
      void payload.update({
        collection: 'gift-vouchers',
        id: voucher.id,
        overrideAccess: true,
        data: { status: 'redeemed', redeemed_at: new Date().toISOString(), redeemed_reservation: reservation.id },
      })
    }
    if (marketing_consent) {
      void upsertMarketingConsent({ kind: 'restaurant', businessId: restaurantId, name: customer_name, email: customer_email, phone: customer_phone, city: customer_city, country })
    }
    // Emailek — best-effort, ne blokkoljanak hibára. Sorozatnál minden alkalomra megy.
    // Függő (nem automatikusan megerősített) foglalásnál a visszaigazoló a jóváhagyáskor megy ki
    // (`confirmOnApproval` hook) — korábban azonnal kiment, mintha meg lenne erősítve.
    if (restaurant.notification_prefs?.confirm_email !== false && reservationStatus === 'confirmed') {
      for (const r of created) void sendReservationConfirmation({ reservation: r, restaurant })
    }
    // Nincs owner email — a digest összefoglalja a napot.
    if (depositRequired && depositHuf) {
      void issueDepositInvoiceBestEffort({
        collection: 'reservations',
        id: reservation.id,
        invoiceSettings: restaurant.invoice_settings,
        sellerTaxNumber: restaurant.tax_number,
        buyer: { name: customer_name, email: customer_email, city: customer_city, address: customer_address, taxNumber: customer_tax_number, country: customer_country },
        // foglaló: áfa nélküli (TAHK) — megjelenéskor beszámít a végösszegbe, az ÁFA az étterem végszámláján (docs/manual)
        label: isForeignCountry(customer_country) ? `Booking deposit — ${restaurant.name} · ${date} · ${pax} ${pax === 1 ? 'guest' : 'guests'} (outside the scope of VAT)` : `Foglaló — ${restaurant.name} · ${date} · ${pax} fő (ÁFA tv. hatályán kívül)`,
        vatOverride: 'TAHK',
        note: isForeignCountry(customer_country) ? 'The deposit is deducted from the final bill; VAT is charged on the final invoice.' : 'A foglaló megjelenéskor beszámít a végösszegbe; az ÁFA a végszámlán kerül felszámításra.',
        grossHuf: depositHuf,
        orderRef: String(payment_intent_id),
      })
    }

    // Egyszeri esetben a válasz alakja változatlan. Sorozatnál kiegészítjük series-metaadatokkal.
    if (seriesActive) {
      return NextResponse.json({
        ok: true,
        reservationId: reservation.id,
        cancel_token: reservation.cancel_token,
        status: reservationStatus,
        series_id: seriesId,
        created_count: created.length,
        skipped_dates: skipped,
      })
    }
    return NextResponse.json({ ok: true, reservationId: reservation.id, cancel_token: reservation.cancel_token, status: reservationStatus })
  } catch (err) {
    console.error('[Restaurant Reservations API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
