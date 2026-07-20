import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Service, StaffMember } from '@/payload/payload-types'

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

// ── Shared column aliases per import type ────────────────────────────────

const ALIASES_BY_TYPE: Record<string, Record<string, string>> = {
  bookings: {
    'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name',
    'vendég': 'customer_name', 'vendég neve': 'customer_name',
    'név': 'customer_name', 'name': 'customer_name',
    'client': 'customer_name', 'client name': 'customer_name',
    'customer': 'customer_name', 'customer name': 'customer_name',
    'guest': 'customer_name', 'guest name': 'customer_name',
    'email': 'customer_email', 'e-mail': 'customer_email',
    'e-mail cím': 'customer_email', 'email cím': 'customer_email',
    'telefon': 'customer_phone', 'telefonszám': 'customer_phone',
    'phone': 'customer_phone', 'mobile': 'customer_phone', 'mobil': 'customer_phone',
    'phone number': 'customer_phone',
    'dátum': 'date', 'date': 'date', 'foglalás dátuma': 'date', 'appointment date': 'date',
    'időpont': 'start_time', 'kezdés': 'start_time', 'kezdési idő': 'start_time',
    'kezdési idő (hh:mm)': 'start_time', 'time': 'start_time',
    'start time': 'start_time', 'appointment time': 'start_time',
    'vége': 'end_time', 'befejezési idő': 'end_time', 'befejezési idő (hh:mm)': 'end_time',
    'end time': 'end_time', 'end': 'end_time',
    'fő': 'pax', 'pax': 'pax', 'guests': 'pax', 'vendégek száma': 'pax', 'covers': 'pax', 'party size': 'pax',
    'szolgáltatás': 'service', 'service': 'service', 'treatment': 'service', 'kezelés': 'service', 'service name': 'service',
    'munkatárs': 'staff', 'szakember': 'staff', 'staff': 'staff',
    'stylist': 'staff', 'employee': 'staff', 'therapist': 'staff', 'provider': 'staff',
    'időtartam (perc)': 'duration', 'időtartam': 'duration', 'duration': 'duration',
    'duration (min)': 'duration', 'duration (minutes)': 'duration',
    'ár (ft)': 'price', 'ár': 'price', 'price': 'price', 'díj': 'price', 'cost': 'price',
    'státusz': 'status', 'status': 'status', 'booking status': 'status',
    'megjegyzés': 'notes', 'megjegyzések': 'notes', 'notes': 'notes',
    'note': 'notes', 'comment': 'notes', 'comments': 'notes',
  },
  customers: {
    'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name',
    'vendég': 'customer_name', 'vendég neve': 'customer_name',
    'név': 'customer_name', 'name': 'customer_name',
    'customer': 'customer_name', 'customer name': 'customer_name',
    'guest': 'customer_name', 'guest name': 'customer_name',
    'email': 'customer_email', 'e-mail': 'customer_email', 'e-mail cím': 'customer_email',
    'telefon': 'customer_phone', 'phone': 'customer_phone', 'mobile': 'customer_phone', 'mobil': 'customer_phone',
    'megjegyzés': 'notes', 'notes': 'notes', 'note': 'notes', 'comment': 'notes',
  },
  staff: {
    'név': 'name', 'name': 'name', 'munkatárs': 'name', 'munkatárs neve': 'name',
    'employee': 'name', 'employee name': 'name', 'staff name': 'name', 'full name': 'name',
    'email': 'email', 'e-mail': 'email', 'e-mail cím': 'email',
    'telefon': 'phone', 'phone': 'phone', 'mobile': 'phone', 'mobil': 'phone',
    'pozíció': 'role_title', 'beosztás': 'role_title', 'role': 'role_title',
    'title': 'role_title', 'job title': 'role_title', 'foglalkozás': 'role_title',
    'részleg': 'department', 'department': 'department', 'team': 'department', 'csapat': 'department',
    'születésnap': 'birthday', 'birthday': 'birthday', 'date of birth': 'birthday', 'dob': 'birthday',
  },
  tables: {
    'asztal': 'name', 'asztal neve': 'name', 'table': 'name', 'table name': 'name',
    'name': 'name', 'név': 'name', 'azonosító': 'name',
    'férőhely': 'capacity', 'kapacitás': 'capacity', 'capacity': 'capacity',
    'seats': 'capacity', 'max guests': 'capacity', 'max fő': 'capacity',
  },
  services: {
    'szolgáltatás': 'name', 'service': 'name', 'service name': 'name',
    'name': 'name', 'kezelés': 'name', 'treatment': 'name', 'név': 'name',
    'időtartam': 'duration', 'duration': 'duration', 'időtartam (perc)': 'duration', 'duration (min)': 'duration',
    'ár': 'price', 'price': 'price', 'díj': 'price', 'cost': 'price', 'ár (ft)': 'price',
    'kategória': 'category', 'category': 'category', 'group': 'category', 'csoport': 'category',
  },
  opening_hours: {
    'nap': 'day_of_week', 'day': 'day_of_week', 'day of week': 'day_of_week',
    'weekday': 'day_of_week', 'napja': 'day_of_week', 'hét napja': 'day_of_week',
    'nyitva': 'is_open', 'is_open': 'is_open', 'nyitva?': 'is_open',
    'open': 'is_open', 'open?': 'is_open', 'nyitva-e': 'is_open',
    'nyitás': 'open_time', 'nyitas': 'open_time', 'open time': 'open_time',
    'opens': 'open_time', 'nyitási idő': 'open_time', 'from': 'open_time', 'tól': 'open_time',
    'zárás': 'close_time', 'zaras': 'close_time', 'close time': 'close_time',
    'closes': 'close_time', 'záró idő': 'close_time', 'to': 'close_time', 'ig': 'close_time',
    'zárási idő': 'close_time',
  },
  rooms: {
    'terem': 'name', 'terem neve': 'name', 'room': 'name', 'room name': 'name',
    'name': 'name', 'név': 'name', 'szoba': 'name', 'helyiség': 'name',
    'zóna': 'name', 'zona': 'name', 'section': 'name', 'szekció': 'name', 'area': 'name',
    'szabadtéri': 'is_outdoor', 'szabadteri': 'is_outdoor', 'outdoor': 'is_outdoor',
    'terasz': 'is_outdoor', 'kert': 'is_outdoor',
    'aktív': 'is_active', 'aktiv': 'is_active', 'active': 'is_active', 'enabled': 'is_active',
  },
  service_categories: {
    'kategória': 'name', 'kategoria': 'name', 'category': 'name', 'name': 'name', 'név': 'name',
    'csoport': 'name', 'group': 'name', 'type': 'name', 'típus': 'name',
    'sorrend': 'sort_order', 'sort': 'sort_order', 'order': 'sort_order',
    'pozíció': 'sort_order', 'sort order': 'sort_order',
  },
  billing_info: {
    'cégnév': 'legal_name', 'cegnev': 'legal_name', 'legal name': 'legal_name',
    'company name': 'legal_name', 'vállalkozás neve': 'legal_name', 'company': 'legal_name',
    'adószám': 'tax_number', 'adoszam': 'tax_number', 'tax number': 'tax_number',
    'vat number': 'tax_number', 'vat': 'tax_number', 'tax id': 'tax_number',
    'adó azonosító': 'tax_number', 'adó': 'tax_number',
    'cégjegyzékszám': 'company_reg_number', 'cegj.szam': 'company_reg_number',
    'company registration': 'company_reg_number', 'reg number': 'company_reg_number',
    'cégj szám': 'company_reg_number',
    'székhely': 'registered_seat', 'szekhelycim': 'registered_seat',
    'registered address': 'registered_seat', 'registered seat': 'registered_seat',
    'számlázási email': 'billing_email', 'billing email': 'billing_email',
    'email': 'billing_email', 'számlázási e-mail': 'billing_email',
    'irányítószám': 'billing_postal_code', 'irsz': 'billing_postal_code',
    'postal code': 'billing_postal_code', 'zip': 'billing_postal_code', 'zip code': 'billing_postal_code',
    'város': 'billing_city', 'varos': 'billing_city', 'city': 'billing_city', 'town': 'billing_city',
    'utca': 'billing_street', 'cím': 'billing_street', 'street': 'billing_street',
    'address': 'billing_street', 'számlázási cím': 'billing_street', 'billing address': 'billing_street',
  },
}

// ── Route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await getPayloadClient()

    const body = (await req.json()) as {
      headers: string[]
      rows: string[][]
      userMapping?: Record<string, string>
      importType?: string
      module?: 'salon' | 'restaurant'
    }

    const { headers = [], rows = [], userMapping = {} } = body
    const importType = body.importType ?? 'bookings'

    const aliases = ALIASES_BY_TYPE[importType] ?? ALIASES_BY_TYPE.bookings
    const colMap: Record<number, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      const override = userMapping[h]
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

    const result = {
      imported: {
        customers: 0, bookings: 0, staff: 0, tables: 0, services: 0,
        opening_hours: 0, rooms: 0, service_categories: 0, billing_info: 0,
      },
      skipped: 0,
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
          const existing = email
            ? (await payload.find({
                collection: 'staff',
                where: { and: [{ email: { equals: email } }, { salon: { equals: businessId } }] },
                limit: 1, depth: 0, overrideAccess: true,
              })).docs[0]
            : null

          if (existing) {
            await payload.update({
              collection: 'staff',
              id: existing.id,
              data: { name, email, phone, role_title, department, birthday },
              overrideAccess: true,
            })
          } else {
            await payload.create({
              collection: 'staff',
              data: { name, salon: businessId, email, phone, role_title, department, birthday, is_active: true },
              overrideAccess: true,
            })
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
          const existing = (await payload.find({
            collection: 'tables',
            where: { and: [{ name: { equals: name } }, { restaurant: { equals: businessId } }] },
            limit: 1, depth: 0, overrideAccess: true,
          })).docs[0]

          if (existing) { result.skipped++; continue }

          await payload.create({
            collection: 'tables',
            data: { name, capacity, restaurant: businessId, is_active: true },
            overrideAccess: true,
          })
          result.imported.tables++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── SERVICES ─────────────────────────────────────────────────────────
    } else if (importType === 'services') {
      const catCache: Record<string, number> = {}
      const existingCats = await payload.find({
        collection: 'service-categories',
        where: { salon: { equals: businessId } },
        limit: 200, depth: 0, overrideAccess: true,
      })
      for (const c of existingCats.docs) {
        catCache[(c as unknown as { name: string }).name.toLowerCase()] = Number(c.id)
      }

      let defaultCatId: number | null = existingCats.docs.length > 0 ? Number(existingCats.docs[0].id) : null

      const getOrCreateCat = async (catName: string): Promise<number | null> => {
        const key = catName.toLowerCase()
        if (catCache[key]) return catCache[key]
        try {
          const created = await payload.create({
            collection: 'service-categories',
            data: { name: catName, salon: businessId },
            overrideAccess: true,
          })
          catCache[key] = Number(created.id)
          if (!defaultCatId) defaultCatId = Number(created.id)
          return Number(created.id)
        } catch { return defaultCatId }
      }

      if (!defaultCatId) {
        try {
          const created = await payload.create({
            collection: 'service-categories',
            data: { name: 'Importált', salon: businessId },
            overrideAccess: true,
          })
          defaultCatId = Number(created.id)
          catCache['importált'] = defaultCatId
        } catch { /* no category available */ }
      }

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
        const categoryId = categoryName ? await getOrCreateCat(categoryName) : defaultCatId

        if (!categoryId) {
          result.errors.push(`Sor ${rowNum}: nincs kategória — kihagyva`)
          result.skipped++
          continue
        }

        try {
          const existing = (await payload.find({
            collection: 'services',
            where: { and: [{ name: { equals: name } }, { salon: { equals: businessId } }] },
            limit: 1, depth: 0, overrideAccess: true,
          })).docs[0]

          if (existing) { result.skipped++; continue }

          await payload.create({
            collection: 'services',
            data: { name, salon: businessId, category: categoryId, duration_minutes, price, is_active: true },
            overrideAccess: true,
          })
          result.imported.services++
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── CUSTOMERS (standalone) ────────────────────────────────────────────
    } else if (importType === 'customers') {
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri]
        if (!row.some((c) => c.trim())) continue
        const rowNum = ri + 2

        const customerName = getField(row, 'customer_name')
        const customerEmail = getField(row, 'customer_email')
        const customerPhone = getField(row, 'customer_phone')
        const notes = getField(row, 'notes') || undefined

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
                notes,
                ...(isRestaurant ? { restaurant: businessId } : { salon: businessId }),
              },
              overrideAccess: true,
            })
            result.imported.customers++
          } else {
            result.skipped++
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
              overrideAccess: true,
            })
          } else {
            await payload.create({
              collection: 'opening-hours',
              data: { restaurant: businessId, day_of_week: day, is_open, open_time, close_time },
              overrideAccess: true,
            })
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
          const existing = (await payload.find({
            collection: 'rooms',
            where: { and: [{ name: { equals: name } }, { restaurant: { equals: businessId } }] },
            limit: 1, depth: 0, overrideAccess: true,
          })).docs[0]

          if (existing) { result.skipped++; continue }

          await payload.create({
            collection: 'rooms',
            data: { name, restaurant: businessId, is_outdoor, is_active },
            overrideAccess: true,
          })
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
          const existing = (await payload.find({
            collection: 'service-categories',
            where: { and: [{ name: { equals: name } }, { salon: { equals: businessId } }] },
            limit: 1, depth: 0, overrideAccess: true,
          })).docs[0]

          if (existing) { result.skipped++; continue }

          await payload.create({
            collection: 'service-categories',
            data: { name, salon: businessId, sort_order },
            overrideAccess: true,
          })
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
            overrideAccess: true,
          })
          result.imported.billing_info++
        } catch (e) {
          result.errors.push(`Számlázási adatok: ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }

    // ── BOOKINGS (default) ────────────────────────────────────────────────
    } else {
      const serviceCache: Record<string, string> = {}
      const staffCache: Record<string, string> = {}
      let defaultStaffId: string | null = null
      let defaultServiceId: string | null = null
      let importCategoryId: string | null = null

      if (!isRestaurant) {
        const [svcs, staffList, cats] = await Promise.all([
          payload.find({ collection: 'services', where: { salon: { equals: businessId } }, limit: 500, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'staff', where: { salon: { equals: businessId } }, limit: 200, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'service-categories', where: { salon: { equals: businessId } }, limit: 200, depth: 0, overrideAccess: true }),
        ])

        for (const s of svcs.docs as Service[]) {
          serviceCache[s.name.toLowerCase()] = String(s.id)
          if (!defaultServiceId) defaultServiceId = String(s.id)
        }
        for (const s of staffList.docs as StaffMember[]) {
          staffCache[s.name.toLowerCase()] = String(s.id)
          if (!defaultStaffId) defaultStaffId = String(s.id)
        }

        const importCat = cats.docs.find((c) => ((c as unknown as { name: string }).name === 'Importált'))
        if (importCat) {
          importCategoryId = String(importCat.id)
        } else if (cats.docs.length > 0) {
          importCategoryId = String(cats.docs[0].id)
        } else {
          try {
            const created = await payload.create({
              collection: 'service-categories',
              data: { name: 'Importált', salon: businessId },
              overrideAccess: true,
            })
            importCategoryId = String(created.id)
          } catch { /* no category */ }
        }
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
              overrideAccess: true,
            })
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
          if (isRestaurant) {
            const pax = parseInt(getField(row, 'pax')) || 2
            await payload.create({
              collection: 'reservations',
              data: {
                restaurant: businessId,
                date, start_time: startTime, end_time: endTime, pax,
                customer_name: customerName || 'Importált vendég',
                customer_email: customerEmail || undefined,
                customer_phone: customerPhone || undefined,
                status, source: 'online', notes,
              },
              overrideAccess: true,
            })
            result.imported.bookings++
          } else {
            const serviceName = getField(row, 'service')
            let serviceId = serviceName ? (serviceCache[serviceName.toLowerCase()] ?? null) : null

            if (!serviceId && serviceName && importCategoryId) {
              try {
                const priceRaw = getField(row, 'price').replace(/[^\d.,]/g, '').replace(',', '.')
                const mins = parseInt(durationRaw) || 60
                const price = parseFloat(priceRaw) || 0
                const created = await payload.create({
                  collection: 'services',
                  data: { name: serviceName, salon: businessId, category: importCategoryId, duration_minutes: mins, price, is_active: true },
                  overrideAccess: true,
                })
                serviceId = String(created.id)
                serviceCache[serviceName.toLowerCase()] = serviceId
              } catch { serviceId = defaultServiceId }
            } else if (!serviceId) {
              serviceId = defaultServiceId
            }

            if (!serviceId) {
              result.errors.push(`Sor ${rowNum}: nincs szolgáltatás — foglalás kihagyva`)
              result.skipped++
              continue
            }

            const staffName = getField(row, 'staff')
            let staffId = staffName ? (staffCache[staffName.toLowerCase()] ?? null) : null

            if (!staffId && staffName) {
              try {
                const created = await payload.create({
                  collection: 'staff',
                  data: { name: staffName, salon: businessId, is_active: true },
                  overrideAccess: true,
                })
                staffId = String(created.id)
                staffCache[staffName.toLowerCase()] = staffId
                if (!defaultStaffId) defaultStaffId = staffId
              } catch { staffId = defaultStaffId }
            }
            if (!staffId) staffId = defaultStaffId

            if (!staffId) {
              result.errors.push(`Sor ${rowNum}: nincs munkatárs — foglalás kihagyva`)
              result.skipped++
              continue
            }

            await payload.create({
              collection: 'bookings',
              data: {
                salon: businessId, service: serviceId, staff: staffId,
                date, start_time: startTime, end_time: endTime,
                customer_name: customerName || 'Importált ügyfél',
                customer_email: customerEmail || 'import@placeholder.local',
                customer_phone: customerPhone || undefined,
                status, notes,
              },
              overrideAccess: true,
            })
            result.imported.bookings++
          }
        } catch (e) {
          result.errors.push(`Sor ${rowNum}: foglalás — ${e instanceof Error ? e.message : 'hiba'}`)
          result.skipped++
        }
      }
    }

    console.log(`[import-csv] done: type=${importType}`, result.imported, `skipped=${result.skipped}`)
    return NextResponse.json({ ...result, errors: result.errors.slice(0, 30) })
  } catch (err) {
    console.error('[import-csv]', err)
    return NextResponse.json({ error: 'Szerver hiba az importálás során' }, { status: 500 })
  }
}
