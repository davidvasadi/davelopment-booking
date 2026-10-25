import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ImportResolver, buildMatchReport, collectEntityValues } from '@/lib/importResolver'
import type { EntityMap } from '@/lib/importMatching'
import type { Where } from 'payload'
import { SILENT_IMPORT } from '@/lib/silentImport'
import { ALIASES_BY_TYPE, type ImportType } from '@/lib/importSchema'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { REG_SETUP_COOKIE, verifyRegistrationSetupToken } from '@/lib/registrationSetupToken'

// ── Helpers ─────────────────────────────────────────────────────────────

function normalizeDate(v: string): string | null {
  const s = v?.trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const ymd = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`

  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }

  return null
}

/** Szabad szöveges "nem" import-érték a saját select-opcióinkra (female/male/other) — csak
 *  egyértelmű, teljes szavakat fogad el (sem a magyar, sem az angol rövidítés — "F"/"N" —
 *  nem egyértelmű a két nyelv/konvenció között, azt inkább érintetlenül hagyjuk, mint hogy
 *  rosszul találjuk ki). */
function normalizeGender(v: string): 'female' | 'male' | 'other' | null {
  const s = v?.trim().toLowerCase()
  if (!s) return null
  if (['nő', 'no', 'female', 'woman'].includes(s)) return 'female'
  if (['férfi', 'ferfi', 'male', 'man'].includes(s)) return 'male'
  if (['egyéb', 'egyeb', 'other', 'non-binary', 'nonbinary'].includes(s)) return 'other'
  return null
}

/** Szöveges "igen/nem"-jellegű import-érték boolean-ra — más rendszerek exportjai sokfélét
 *  írhatnak (igen/nem, yes/no, true/false, 1/0, x/✓) ugyanarra a checkbox-mezőre. */
function parseBoolish(v: string): boolean | null {
  const s = v?.trim().toLowerCase()
  if (!s) return null
  if (['igen', 'yes', 'true', '1', 'x', '✓', 'y', 'van'].includes(s)) return true
  if (['nem', 'no', 'false', '0', 'nincs'].includes(s)) return false
  return null
}

function normalizeTime(v: string): string | null {
  const s = v?.trim()
  if (!s) return null

  const hm = s.match(/^(\d{1,2})[:\.](\d{2})/)
  if (hm && Number(hm[1]) < 24 && Number(hm[2]) < 60) {
    return `${hm[1].padStart(2, '0')}:${hm[2]}`
  }

  const hhmm = s.match(/^(\d{2})(\d{2})$/)
  if (hhmm && Number(hhmm[1]) < 24 && Number(hhmm[2]) < 60) {
    return `${hhmm[1]}:${hhmm[2]}`
  }

  return null
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function normalizeStatus(v: string): 'pending' | 'confirmed' | 'cancelled' | 'completed' {
  const s = v?.toLowerCase().trim() ?? ''
  if (['cancelled', 'lemondott', 'lemondva', 'cancel', 'canceled'].includes(s)) return 'cancelled'
  if (['pending', 'függő', 'függőben', 'megerősítésre vár'].includes(s)) return 'pending'
  if (['confirmed', 'megerősített', 'megerősítve'].includes(s)) return 'confirmed'
  return 'completed'
}

const DOW_MAP: Record<string, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> = {
  'hétfő': 'monday', 'hetfo': 'monday', 'hétfő.': 'monday', 'monday': 'monday', 'mon': 'monday', '1': 'monday',
  'kedd': 'tuesday', 'tuesday': 'tuesday', 'tue': 'tuesday', '2': 'tuesday',
  'szerda': 'wednesday', 'wednesday': 'wednesday', 'wed': 'wednesday', '3': 'wednesday',
  'csütörtök': 'thursday', 'csutortok': 'thursday', 'thursday': 'thursday', 'thu': 'thursday', '4': 'thursday',
  'péntek': 'friday', 'pentek': 'friday', 'friday': 'friday', 'fri': 'friday', '5': 'friday',
  'szombat': 'saturday', 'saturday': 'saturday', 'sat': 'saturday', '6': 'saturday',
  'vasárnap': 'sunday', 'vasarnap': 'sunday', 'sunday': 'sunday', 'sun': 'sunday', '7': 'sunday',
}

function normalizeDayOfWeek(v: string): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' | null {
  return DOW_MAP[v?.toLowerCase().trim()] ?? null
}

function normalizeBool(v: string): boolean {
  const s = v?.toLowerCase().trim() ?? ''
  return ['igen', 'yes', 'true', '1', 'nyitva', 'open', 'x', 'i', 'y'].includes(s)
}

// ── Oszlop-aliasok: a közös src/lib/importSchema.ts-ből (a felülettel azonos lista) ──


// ── Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayloadClient()

    let user = await getCurrentUser()
    if (!user) {
      // Nincs normál (megerősített, bejelentkezett) session — próbáljuk a szűkre szabott
      // regisztráció-folytatás tokent (a wizard 2. lépése után kiállítva, MÉG az email-
      // megerősítés előtt). Csak EZ a route fogadja el — a dashboard/minden más útvonal
      // változatlanul a valódi bejelentkezést követeli. Lásd `registrationSetupToken.ts`.
      const setupTokenValue = (await cookies()).get(REG_SETUP_COOKIE)?.value
      const setup = setupTokenValue ? await verifyRegistrationSetupToken(setupTokenValue) : null
      if (setup) {
        user = (await payload
          .findByID({ collection: 'users', id: setup.userId, overrideAccess: true })
          .catch(() => null)) as unknown as typeof user
      }
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json()) as {
      headers: string[]
      rows: string[][]
      userMapping?: Record<string, string>
      importType?: string
      module?: 'salon' | 'restaurant'
      // 'match': csak a párosító lépés javaslatait adja vissza, nem ír semmit
      mode?: 'match'
      // a felhasználó párosító döntései (munkatárs, szolgáltatás, kategória, asztal, terem)
      entityMap?: EntityMap
    }

    const { headers = [], rows = [], userMapping = {} } = body
    const importType = body.importType ?? 'bookings'

    const aliases = ALIASES_BY_TYPE[importType as ImportType] ?? ALIASES_BY_TYPE.bookings
    const colMap: Record<number, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      // Oszlop-INDEX szerint, nem fejléc-szöveg szerint — egy exportban két azonos nevű oszlop
      // is előfordulhat (pl. kétszer "Életkor"), és fejléc-szöveg kulcs esetén a kliens oldali
      // mapping-objektum is csak egyet tudna megkülönböztetni belőlük (lásd ImportPanel.tsx
      // autoDetect/mapping — ugyanez a döntés tükrözve).
      const override = userMapping[String(i)]
      const auto = aliases[h.toLowerCase().trim()]
      const field = override === undefined ? auto : override
      if (field) colMap[i] = field
    }

    const { active } = await getActiveBusiness(user)
    const isRestaurant = active ? active.type === 'restaurant' : body.module === 'restaurant'
    const businessId = active?.id ? Number(active.id) : null

    if (!businessId) {
      return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 400 })
    }

    console.log(`[import-csv] start user=${user.id} business=${businessId} type=${importType} rows=${rows.length}`)

    const getField = (row: string[], field: string): string => {
      for (const [idx, fname] of Object.entries(colMap)) {
        if (fname === field) return row[Number(idx)]?.trim() ?? ''
      }
      return ''
    }

    // Újraimport-védelem: ugyanannak a vendégnek ugyanarra a napra+időpontra az üzletben már van
    // foglalás → nem hozzuk létre újra (pl. ugyanaz a fájl kétszer feltöltve). Vendég-azonosítás:
    // valódi email, ha van; különben név.
    const visitAlreadyImported = async (
      collection: 'bookings' | 'reservations',
      date: string, startTime: string, name: string, email: string,
    ): Promise<boolean> => {
      const realEmail = email && email !== 'import@placeholder.local' ? email : ''
      if (!realEmail && !name) return false
      const found = await payload.find({
        collection,
        where: {
          and: [
            { [collection === 'reservations' ? 'restaurant' : 'salon']: { equals: businessId } },
            { date: { equals: date } },
            { start_time: { equals: startTime } },
            realEmail ? { customer_email: { equals: realEmail } } : { customer_name: { equals: name } },
          ],
        },
        limit: 1, depth: 0, overrideAccess: true,
      })
      return found.docs.length > 0
    }

    // Katalógus-import (szándékos feltöltés) → az új elem aktív; vendég-/foglalás-import
    // mellékhatásaként létrejövő elem → inaktív, „Importált” kategóriában (lásd importResolver.ts)
    const catalogImport = ['staff', 'services', 'service_categories', 'tables', 'rooms'].includes(importType)
    const resolver = new ImportResolver(payload, businessId, isRestaurant, body.entityMap, catalogImport)

    if (body.mode === 'match') {
      const values = collectEntityValues(importType, isRestaurant, rows, getField)
      return NextResponse.json(await buildMatchReport(resolver, values))
    }

    const result = {
      imported: {
        customers: 0, bookings: 0, staff: 0, tables: 0, services: 0,
        opening_hours: 0, rooms: 0, service_categories: 0, billing_info: 0,
      },
      updated: 0,
      skipped: 0,
      duplicates: 0,
      errors: [] as string[],
    }

    // ── STAFF ────────────────────────────────────────────────────────────
    if (importType === 'staff') {
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const name = getField(row, 'name')
        if (!name) { result.skipped++; continue }

        const email = getField(row, 'email') || undefined
        const phone = getField(row, 'phone') || undefined
        const role_title = getField(row, 'role_title') || undefined
        const department = getField(row, 'department') || undefined
        const birthdayRaw = getField(row, 'birthday')
        const birthday = birthdayRaw ? normalizeDate(birthdayRaw) ?? undefined : undefined

        try {
          // Párosítás: a felhasználó döntése (vagy biztos névegyezés) → meglévő munkatárs frissül;
          // döntés nélkül az email-egyezés is meglévőnek számít (korábbi viselkedés)
          const decision = await resolver.decide('staff', name)
          if (decision.action === 'skip') { result.skipped++; continue }
          let existingId: number | null = decision.action === 'match' ? decision.id : null
          if (!existingId && email && !resolver.hasExplicitDecision('staff', name)) {
            const byEmail = (await payload.find({
              collection: 'staff',
              where: { and: [{ email: { equals: email } }, { salon: { equals: businessId } }] },
              limit: 1, depth: 0, overrideAccess: true,
            })).docs[0]
            if (byEmail) existingId = Number(byEmail.id)
          }

          if (existingId) {
            await payload.update({
              collection: 'staff',
              id: existingId,
              data: { name, email, phone, role_title, department, birthday },
              overrideAccess: true, context: SILENT_IMPORT })
          } else {
            await payload.create({
              collection: 'staff',
              data: { name, salon: businessId, email, phone, role_title, department, birthday, is_active: true },
              overrideAccess: true, context: SILENT_IMPORT })
          }

          // SZINKRON: minden e-maillel rendelkező munkatárs egyben membership is legyen —
          // enélkül a Csapat & jogok panel sosem mutatja őket (az kizárólag a memberships
          // collectionből olvas). Csendben (email-küldés nélkül) — a `/api/staff` egyenkénti
          // felvételnél KÜLD meghívót, de tömeges CSV-importnál ez váratlan e-mail-áradat
          // lenne; a tulaj a Csapat & jogokból bármikor tud onnan is meghívót küldeni.
          if (email) {
            const existingMembership = await payload.find({
              collection: 'memberships',
              where: { and: [{ salon: { equals: businessId } }, { email: { equals: email.toLowerCase() } }] },
              limit: 1, depth: 0, overrideAccess: true,
            })
            if (existingMembership.docs.length === 0) {
              await payload.create({
                collection: 'memberships',
                overrideAccess: true,
                data: {
                  email: email.toLowerCase(),
                  name,
                  role: 'staff',
                  status: 'invited',
                  invite_token: crypto.randomBytes(24).toString('hex'),
                  position: role_title,
                  salon: businessId,
                }, context: SILENT_IMPORT })
            }
          }
          result.imported.staff++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── TABLES ───────────────────────────────────────────────────────────
    } else if (importType === 'tables') {
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const name = getField(row, 'name')
        if (!name) { result.skipped++; continue }

        const capacityRaw = getField(row, 'capacity')
        const capacity = parseInt(capacityRaw) || 2

        try {
          const decision = await resolver.decide('tables', name)
          if (decision.action === 'skip') { result.skipped++; continue }
          if (decision.action === 'match') { result.duplicates++; continue }

          await payload.create({
            collection: 'tables',
            data: { name, capacity, restaurant: businessId, is_active: true },
            overrideAccess: true, context: SILENT_IMPORT })
          result.imported.tables++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── SERVICES ─────────────────────────────────────────────────────────
    } else if (importType === 'services') {
      // Kategória nélküli sor → „Importált” kategória (NEM a tulaj első, tetszőleges kategóriája)
      const defaultCatId: number | null = await resolver.getImportCategoryId().catch(() => null)

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const name = getField(row, 'name')
        if (!name) { result.skipped++; continue }

        const durationRaw = getField(row, 'duration')
        const priceRaw = getField(row, 'price').replace(/[^\d.,]/g, '').replace(',', '.')
        const categoryName = getField(row, 'category')

        const duration_minutes = parseInt(durationRaw) || 60
        const price = parseFloat(priceRaw) || 0
        const categoryId = categoryName ? ((await resolver.resolve('categories', categoryName)) ?? defaultCatId) : defaultCatId

        if (!categoryId) {
          result.errors.push(`Sor ${rowNum}: nincs kategória — kihagyva`)
          result.skipped++
          continue
        }

        try {
          const decision = await resolver.decide('services', name)
          if (decision.action === 'skip') { result.skipped++; continue }
          if (decision.action === 'match') { result.duplicates++; continue }

          await payload.create({
            collection: 'services',
            data: { name, salon: businessId, category: categoryId, duration_minutes, price, is_active: true },
            overrideAccess: true, context: SILENT_IMPORT })
          result.imported.services++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── CUSTOMERS (standalone) ────────────────────────────────────────────
    } else if (importType === 'customers') {
      // Ha az export tartalmaz "Első/Utolsó szolgáltatás" dátumot, ehhez — szalonnál — tényleges
      // `bookings` sort is hozunk létre (max 2/vendég: az első és az utolsó látogatás), ugyanazzal
      // a szolgáltatás/munkatárs-feloldó logikával, mint a BOOKINGS ág. A köztes (csak az
      // "Időpontok összesen"-ben megjelenő) látogatásokat nem lehet rekonstruálni — ezek csak az
      // Import-összesítő mezőkön élnek (lásd lejjebb + Customers.ts).
      // Relationship-mezőkhöz (category/service/staff) a Payload+Postgres kombó SZÁM id-t vár,
      // nem numerikus stringet — lásd a BOOKINGS ág azonos komment ja fentebb.
      // Szolgáltatás/munkatárs feloldása: a párosító döntés szerint (ImportResolver) — új elem
      // csak inaktívan, „Importált” kategóriában jön létre, a meglévőket nem duplikálja.

      // "YYYY-MM-DD HH:MM:SS" alakú összevont dátum+idő mező szétbontása (ilyet ad pl. a Salonic
      // "Első/Utolsó szolgáltatás időpont" oszlopa) — a normalizeDate/normalizeTime ÖNMAGÁBAN nem
      // várja ezt az összevont formát, a dátum- és idő-részt itt vágjuk külön.
      const splitDateTime = (v: string): { date: string | null; time: string | null } => {
        const s = v?.trim()
        if (!s) return { date: null, time: null }
        const [datePart, timePart] = s.split(/\s+/)
        return { date: normalizeDate(datePart), time: timePart ? normalizeTime(timePart) : null }
      }

      /** Legfeljebb 1 db szintetikus `bookings` sor egy ismert (szolgáltatás+dátum+idő) pontra —
       *  visszaadja, sikerült-e, hogy a hívó tudja, mennyit oszt szét az árbevételből. */
      const createSyntheticBooking = async (opts: {
        serviceName: string; date: string; time: string
        customerName: string; customerEmail: string; customerPhone: string
        staffHint: string; priceHuf: number
      }): Promise<boolean> => {
        // „Kihagyás” döntés → nincs szolgáltatás → ez a látogatás nem jön létre foglalásként
        const serviceId = await resolver.resolve('services', opts.serviceName)
        if (!serviceId) return false

        // Több név egy cellában ("Oravecz András, Csonka Bence") → az első feloldható; ha nincs, az
        // üzlet első aktív munkatársa (a foglaláshoz kötelező)
        const staffId = (opts.staffHint ? await resolver.resolveStaff(opts.staffHint) : null) ?? (await resolver.defaultStaffId())
        if (!staffId) return false

        try {
          if (await visitAlreadyImported('bookings', opts.date, opts.time, opts.customerName, opts.customerEmail)) {
            result.duplicates++
            return false
          }
          await payload.create({
            collection: 'bookings',
            data: {
              // importált foglalás: eleve „kiküldve” — se emlékeztető, se értékeléskérés ne menjen ki
              reminder_sent: true, feedback_sent: true,
              salon: businessId, service: serviceId, staff: staffId,
              price_snapshot: opts.priceHuf, price_snapshot_currency: 'HUF',
              date: opts.date, start_time: opts.time, end_time: addMinutes(opts.time, 60),
              customer_name: opts.customerName || 'Importált ügyfél',
              customer_email: opts.customerEmail || 'import@placeholder.local',
              customer_phone: opts.customerPhone || undefined,
              status: 'completed',
              notes: 'Import — korábbi rendszerből (összesítő exportból rekonstruált látogatás)',
            },
            overrideAccess: true, context: SILENT_IMPORT })
          return true
        } catch (e) { console.error('[import-csv] synthetic booking create failed', e); return false }
      }

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const customerName = getField(row, 'customer_name')
        const customerEmail = getField(row, 'customer_email')
        const customerPhone = getField(row, 'customer_phone')
        const customerCity = getField(row, 'customer_city') || undefined
        const birthdayRaw = getField(row, 'birthday')
        const birthday = birthdayRaw ? normalizeDate(birthdayRaw) ?? undefined : undefined
        const groupTag = getField(row, 'group_tag') || undefined
        const notes = getField(row, 'notes') || undefined
        const billingName = getField(row, 'billing_name') || undefined
        const billingTaxNumber = getField(row, 'billing_tax_number') || undefined
        const billingEmail = getField(row, 'billing_email') || undefined
        const billingPostalCode = getField(row, 'billing_postal_code') || undefined
        const billingCity = getField(row, 'billing_city') || undefined
        const billingStreetName = getField(row, 'billing_street_name')
        const billingStreetType = getField(row, 'billing_street_type')
        const billingStreetNumber = getField(row, 'billing_street_number')
        const billingStreetCombined = [billingStreetName, billingStreetType, billingStreetNumber].filter(Boolean).join(' ').trim()
        const billingStreet = billingStreetCombined || getField(row, 'billing_street') || undefined
        const marketingConsent = parseBoolish(getField(row, 'marketing_consent')) ?? undefined
        const blockedRaw = parseBoolish(getField(row, 'blocked'))
        const blockReason = getField(row, 'block_reason') || undefined
        const gender = normalizeGender(getField(row, 'gender')) ?? undefined

        // Import-összesítő — guest-szintű élettartam-aggregátumok (ld. fenti komment).
        const visitCountRaw = parseInt(getField(row, 'visit_count'))
        const visitCount = !isNaN(visitCountRaw) ? visitCountRaw : undefined
        const cancellationCountRaw = parseInt(getField(row, 'cancellation_count'))
        const cancellationCount = !isNaN(cancellationCountRaw) ? cancellationCountRaw : undefined
        const noShowCountRaw = parseInt(getField(row, 'no_show_count'))
        const noShowCount = !isNaN(noShowCountRaw) ? noShowCountRaw : undefined
        const lastCancellationReason = getField(row, 'last_cancellation_reason') || undefined
        const revenueRaw = parseFloat(getField(row, 'total_revenue_huf').replace(/[^\d.,]/g, '').replace(',', '.'))
        const totalRevenueHuf = !isNaN(revenueRaw) && revenueRaw > 0 ? revenueRaw : undefined

        const externalId = getField(row, 'external_id') || undefined

        if (!customerName && !customerEmail) { result.skipped++; continue }

        try {
          // A KÜLSŐ ID megbízhatóbb dedup-kulcs, mint az email — egy exportban előfordulhat
          // email nélküli vagy (ritkán) ismétlődő email, miközben a forrásrendszer saját ID-ja
          // garantáltan egyedi; csak ha nincs ID, esünk vissza az email-egyezésre.
          const scope: Where = isRestaurant ? { restaurant: { equals: businessId } } : { salon: { equals: businessId } }
          const byExternalId = externalId
            ? (await payload.find({
                collection: 'customers',
                where: { external_id: { equals: externalId }, ...scope },
                limit: 1, depth: 0, overrideAccess: true,
              })).docs[0]
            : undefined
          // Ha az ID-re nincs találat, emailre is keresünk: egy korábbi, még ID nélküli import
          // vendégét így frissítjük (és megkapja az ID-t), nem hozunk létre mellé egy másodikat.
          const existing = byExternalId ?? (customerEmail
            ? (await payload.find({
                collection: 'customers',
                where: { customer_email: { equals: customerEmail }, ...scope },
                limit: 1, depth: 0, overrideAccess: true,
              })).docs[0]
            : null)

          const customerData = {
            external_id: externalId,
            customer_name: customerName || undefined,
            customer_email: customerEmail || undefined,
            customer_phone: customerPhone || undefined,
            customer_city: customerCity,
            birthday,
            gender,
            group_tag: groupTag,
            notes,
            billing_name: billingName,
            billing_tax_number: billingTaxNumber,
            billing_email: billingEmail,
            billing_postal_code: billingPostalCode,
            billing_city: billingCity,
            billing_street: billingStreet,
            visit_count: visitCount,
            cancellation_count: cancellationCount,
            no_show_count: noShowCount,
            last_cancellation_reason: lastCancellationReason,
            total_revenue_huf: totalRevenueHuf,
            ...(marketingConsent !== undefined ? { marketing_consent: marketingConsent, marketing_consent_at: marketingConsent ? new Date().toISOString() : undefined } : {}),
            ...(blockedRaw !== null ? { blocked: blockedRaw, block_reason: blockedRaw ? blockReason : undefined, blocked_at: blockedRaw ? new Date().toISOString() : undefined } : {}),
          }

          if (!existing) {
            await payload.create({
              collection: 'customers',
              data: { ...customerData, ...(isRestaurant ? { restaurant: businessId } : { salon: businessId }) },
              overrideAccess: true, context: SILENT_IMPORT })
            result.imported.customers++
          } else {
            // Meglévő vendég — NEM kihagyjuk, hanem a most beküldött (nem üres) mezőkkel
            // frissítjük, hogy egy korábbi, csak alap-adatos import (pl. hibás oszlop-mappolással
            // lefutott Salonic-import) utólag kiegészíthető legyen ugyanazon fájl újra-
            // feltöltésével, duplikáció nélkül (email alapján azonosítva).
            const patch = Object.fromEntries(Object.entries(customerData).filter(([, v]) => v !== undefined && v !== ''))
            if (Object.keys(patch).length > 0) {
              await payload.update({ collection: 'customers', id: existing.id, data: patch, overrideAccess: true, context: SILENT_IMPORT })
              result.updated++
            } else {
              result.skipped++
            }
          }

          // Első + utolsó látogatás — ha van hozzá dátum+szolgáltatás, valódi `bookings` sor (csak
          // szalonnál; az étteremi "Reservations" más oszlop-sémát igényelne, ezt a konkrét
          // guest-summary export-formátumot nem támogatja).
          if (!isRestaurant) {
            // a feloldó szétbontja a több nevet és levágja a zárójeles beosztást ("Csonka Bence(alapító)")
            const staffHint = getField(row, 'staff_name_hint')
            const firstName = getField(row, 'first_service_name')
            const first = splitDateTime(getField(row, 'first_service_at'))
            const lastName = getField(row, 'last_service_name')
            const last = splitDateTime(getField(row, 'last_service_at'))
            const isSameVisit = first.date === last.date && first.time === last.time
            const revenueSplit = totalRevenueHuf ? Math.round(totalRevenueHuf / (isSameVisit || !lastName ? 1 : 2)) : 0

            if (firstName && first.date && first.time) {
              const ok = await createSyntheticBooking({
                serviceName: firstName, date: first.date, time: first.time,
                customerName, customerEmail, customerPhone, staffHint, priceHuf: revenueSplit,
              })
              if (ok) result.imported.bookings++
            }
            if (lastName && last.date && last.time && !isSameVisit) {
              const ok = await createSyntheticBooking({
                serviceName: lastName, date: last.date, time: last.time,
                customerName, customerEmail, customerPhone, staffHint, priceHuf: revenueSplit,
              })
              if (ok) result.imported.bookings++
            }
          }
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── OPENING HOURS ─────────────────────────────────────────────────────
    } else if (importType === 'opening_hours') {
      if (!isRestaurant) {
        return NextResponse.json({ error: 'Nyitvatartás import jelenleg csak étteremnél elérhető.' }, { status: 400 })
      }

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const dayRaw = getField(row, 'day_of_week')
        const day = normalizeDayOfWeek(dayRaw)
        if (!day) {
          result.errors.push(`Sor ${rowNum}: ismeretlen nap "${dayRaw}" — kihagyva`)
          result.skipped++
          continue
        }

        const isOpenRaw = getField(row, 'is_open')
        const is_open = isOpenRaw ? normalizeBool(isOpenRaw) : true
        const open_time = normalizeTime(getField(row, 'open_time')) ?? undefined
        const close_time = normalizeTime(getField(row, 'close_time')) ?? undefined

        try {
          const existing = (await payload.find({
            collection: 'opening-hours',
            where: { and: [{ day_of_week: { equals: day } }, { restaurant: { equals: businessId } }] },
            limit: 1, depth: 0, overrideAccess: true,
          })).docs[0]

          if (existing) {
            await payload.update({
              collection: 'opening-hours',
              id: existing.id,
              data: { is_open, open_time, close_time },
              overrideAccess: true, context: SILENT_IMPORT })
          } else {
            await payload.create({
              collection: 'opening-hours',
              data: { restaurant: businessId, day_of_week: day, is_open, open_time, close_time },
              overrideAccess: true, context: SILENT_IMPORT })
          }
          result.imported.opening_hours++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── ROOMS ─────────────────────────────────────────────────────────────
    } else if (importType === 'rooms') {
      if (!isRestaurant) {
        return NextResponse.json({ error: 'Termek import csak étteremnél elérhető.' }, { status: 400 })
      }

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const name = getField(row, 'name')
        if (!name) { result.skipped++; continue }

        const isOutdoorRaw = getField(row, 'is_outdoor')
        const is_outdoor = isOutdoorRaw ? normalizeBool(isOutdoorRaw) : false
        const isActiveRaw = getField(row, 'is_active')
        const is_active = isActiveRaw ? normalizeBool(isActiveRaw) : true

        try {
          const decision = await resolver.decide('rooms', name)
          if (decision.action === 'skip') { result.skipped++; continue }
          if (decision.action === 'match') { result.duplicates++; continue }

          await payload.create({
            collection: 'rooms',
            data: { name, restaurant: businessId, is_outdoor, is_active },
            overrideAccess: true, context: SILENT_IMPORT })
          result.imported.rooms++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── SERVICE CATEGORIES ────────────────────────────────────────────────
    } else if (importType === 'service_categories') {
      if (isRestaurant) {
        return NextResponse.json({ error: 'Kategória import csak szalonnál elérhető.' }, { status: 400 })
      }

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const name = getField(row, 'name')
        if (!name) { result.skipped++; continue }

        const sortRaw = getField(row, 'sort_order')
        const sort_order = sortRaw ? (parseInt(sortRaw) || undefined) : undefined

        try {
          const decision = await resolver.decide('categories', name)
          if (decision.action === 'skip') { result.skipped++; continue }
          if (decision.action === 'match') { result.duplicates++; continue }

          await payload.create({
            collection: 'service-categories',
            data: { name, salon: businessId, sort_order },
            overrideAccess: true, context: SILENT_IMPORT })
          result.imported.service_categories++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── BILLING INFO ──────────────────────────────────────────────────────
    } else if (importType === 'billing_info') {
      const row = rows.find((r) => r.some((c) => c.trim()))
      if (!row) {
        result.skipped++
      } else {
        const legal_name = getField(row, 'legal_name') || undefined
        const tax_number = getField(row, 'tax_number') || undefined
        const company_reg_number = getField(row, 'company_reg_number') || undefined
        const registered_seat = getField(row, 'registered_seat') || undefined
        const billing_email = getField(row, 'billing_email') || undefined
        const billing_postal_code = getField(row, 'billing_postal_code') || undefined
        const billing_city = getField(row, 'billing_city') || undefined
        const billing_street = getField(row, 'billing_street') || undefined

        const rawData = { legal_name, tax_number, company_reg_number, registered_seat, billing_email, billing_postal_code, billing_city, billing_street }
        const cleanData = Object.fromEntries(Object.entries(rawData).filter(([, v]) => v !== undefined))

        try {
          const collection = isRestaurant ? 'restaurants' : 'salons'
          await payload.update({
            collection,
            id: businessId,
            data: cleanData,
            overrideAccess: true, context: SILENT_IMPORT })
          result.imported.billing_info++
        } catch (e) {
          result.errors.push(`Számlázási adatok: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── BOOKINGS (default) ────────────────────────────────────────────────
    } else {
      // Relationship-mezőkhöz (category/service/staff) a Payload+Postgres kombó SZÁM id-t vár,
      // nem numerikus stringet — stringgel a `payload.create` csendben ValidationError-t dob
      // ("The following field is invalid"), amit a hívó oldali try/catch szó nélkül elnyel.
      // Ezért itt MINDENÜTT number (nem String(...)) a cache/alapértelmezett-érték típusa.
      // Szolgáltatás/munkatárs: a párosító döntés szerint (ImportResolver). Ha a fájlban nincs
      // szolgáltatás-oszlop, az üzlet első aktív szolgáltatása (korábbi viselkedés).
      let defaultServiceId: number | null = null
      if (!isRestaurant) {
        const svcs = await resolver.loadCandidates('services')
        defaultServiceId = (svcs.find((x) => x.is_active !== false) ?? svcs[0])?.id ?? null
      }

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const customerName = getField(row, 'customer_name')
        const customerEmail = getField(row, 'customer_email')
        const customerPhone = getField(row, 'customer_phone')

        if (!customerName && !customerEmail) { result.skipped++; continue }

        try {
          const existing = customerEmail
            ? (await payload.find({
                collection: 'customers',
                where: {
                  customer_email: { equals: customerEmail },
                  ...(isRestaurant ? { restaurant: { equals: businessId } } : { salon: { equals: businessId } }),
                },
                limit: 1, depth: 0, overrideAccess: true,
              })).docs[0]
            : null

          if (!existing) {
            await payload.create({
              collection: 'customers',
              data: {
                customer_name: customerName || undefined,
                customer_email: customerEmail || undefined,
                customer_phone: customerPhone || undefined,
                ...(isRestaurant ? { restaurant: businessId } : { salon: businessId }),
              },
              overrideAccess: true, context: SILENT_IMPORT })
            result.imported.customers++
          }
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: vendég — ${e instanceof Error ? e.message : 'hiba'}`)
        }

        const date = normalizeDate(getField(row, 'date'))
        const startTime = normalizeTime(getField(row, 'start_time'))
        if (!date || !startTime) continue

        const durationRaw = getField(row, 'duration')
        let endTime = normalizeTime(getField(row, 'end_time'))
        if (!endTime && durationRaw) {
          const mins = parseInt(durationRaw)
          if (!isNaN(mins) && mins > 0) endTime = addMinutes(startTime, mins)
        }
        if (!endTime) endTime = addMinutes(startTime, 60)

        const statusRaw = getField(row, 'status')
        const status = statusRaw ? normalizeStatus(statusRaw) : 'completed'
        const notes = getField(row, 'notes') || undefined

        try {
          if (await visitAlreadyImported(isRestaurant ? 'reservations' : 'bookings', date, startTime, customerName, customerEmail)) {
            result.duplicates++
            continue
          }
          if (isRestaurant) {
            const pax = parseInt(getField(row, 'pax')) || 2
            await payload.create({
              collection: 'reservations',
              data: {
                // importált foglalás: eleve „kiküldve” — se emlékeztető, se értékeléskérés ne menjen ki
                reminder_sent: true, feedback_sent: true,
                restaurant: businessId,
                date, start_time: startTime, end_time: endTime, pax,
                customer_name: customerName || 'Importált vendég',
                customer_email: customerEmail || undefined,
                customer_phone: customerPhone || undefined,
                status, source: 'online', notes,
              },
              overrideAccess: true, context: SILENT_IMPORT })
            result.imported.bookings++
          } else {
            const serviceName = getField(row, 'service')
            const priceRaw = getField(row, 'price').replace(/[^\d.,]/g, '').replace(',', '.')
            const serviceId = serviceName
              ? await resolver.resolve('services', serviceName, {
                  duration_minutes: parseInt(durationRaw) || 60,
                  price: parseFloat(priceRaw) || 0,
                })
              : defaultServiceId
            if (!serviceId) {
              result.errors.push(`Sor ${rowNum}: nincs szolgáltatás — foglalás kihagyva`)
              result.skipped++
              continue
            }

            const staffName = getField(row, 'staff')
            const staffId = (staffName ? await resolver.resolveStaff(staffName) : null) ?? (await resolver.defaultStaffId())

            if (!staffId) {
              result.errors.push(`Sor ${rowNum}: nincs munkatárs — foglalás kihagyva`)
              result.skipped++
              continue
            }

            // a fájlban szereplő tényleges ár, ha van; különben a szolgáltatás ára
            const rowPrice = parseFloat(priceRaw) || 0
            const svcPrice = rowPrice > 0 ? { price: rowPrice, currency: 'HUF' } : resolver.priceOf(serviceId)
            await payload.create({
              collection: 'bookings',
              data: {
                // importált foglalás: eleve „kiküldve” — se emlékeztető, se értékeléskérés ne menjen ki
                reminder_sent: true, feedback_sent: true,
                salon: businessId, service: serviceId, staff: staffId,
                price_snapshot: svcPrice?.price ?? 0,
                price_snapshot_currency: svcPrice?.currency ?? 'HUF',
                date, start_time: startTime, end_time: endTime,
                customer_name: customerName || 'Importált ügyfél',
                customer_email: customerEmail || 'import@placeholder.local',
                customer_phone: customerPhone || undefined,
                status, notes,
              },
              overrideAccess: true, context: SILENT_IMPORT })
            result.imported.bookings++
          }
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: foglalás — ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }
    }

    console.log(`[import-csv] done: type=${importType}`, result.imported, `updated=${result.updated} skipped=${result.skipped} duplicates=${result.duplicates}`)
    // az import során újonnan létrehozott elemek (szolgáltatás/munkatárs inaktívan) — a felület
    // „nézd át” listájához
    return NextResponse.json({ ...result, created: resolver.created, errors: result.errors.slice(0, 30) })
  } catch (err) {
    console.error('[import-csv]', err)
    return NextResponse.json({ error: 'Szerver hiba az importálás során' }, { status: 500 })
  }
}
