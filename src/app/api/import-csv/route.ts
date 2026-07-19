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

  // YYYY.MM.DD or YYYY. MM. DD.
  const ymd = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
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

// Maps CSV column header → internal field name
const COLUMN_ALIASES: Record<string, string> = {
  'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name',
  'vendég': 'customer_name', 'vendég neve': 'customer_name',
  'név': 'customer_name', 'name': 'customer_name',
  'client': 'customer_name', 'client name': 'customer_name',
  'customer': 'customer_name', 'customer name': 'customer_name',

  'email': 'customer_email', 'e-mail': 'customer_email',
  'e-mail cím': 'customer_email', 'email cím': 'customer_email',

  'telefon': 'customer_phone', 'telefonszám': 'customer_phone',
  'phone': 'customer_phone', 'mobile': 'customer_phone', 'mobil': 'customer_phone',
  'phone number': 'customer_phone',

  'dátum': 'date', 'date': 'date', 'foglalás dátuma': 'date', 'appointment date': 'date',

  'időpont': 'start_time', 'kezdés': 'start_time', 'kezdési idő': 'start_time',
  'kezdési idő (hh:mm)': 'start_time', 'time': 'start_time',
  'start time': 'start_time', 'start': 'start_time', 'appointment time': 'start_time',

  'vége': 'end_time', 'befejezési idő': 'end_time', 'befejezési idő (hh:mm)': 'end_time',
  'end time': 'end_time', 'end': 'end_time',

  'fő': 'pax', 'pax': 'pax', 'guests': 'pax', 'vendégek száma': 'pax', 'covers': 'pax',
  'party size': 'pax',

  'szolgáltatás': 'service', 'service': 'service', 'treatment': 'service', 'kezelés': 'service',
  'service name': 'service',

  'munkatárs': 'staff', 'szakember': 'staff', 'staff': 'staff', 'stylist': 'staff',
  'employee': 'staff', 'therapist': 'staff', 'provider': 'staff',

  'időtartam (perc)': 'duration', 'időtartam': 'duration', 'duration': 'duration',
  'duration (min)': 'duration', 'duration (minutes)': 'duration',

  'ár (ft)': 'price', 'ár': 'price', 'price': 'price', 'díj': 'price', 'cost': 'price',

  'státusz': 'status', 'status': 'status', 'booking status': 'status',

  'megjegyzés': 'notes', 'megjegyzések': 'notes', 'notes': 'notes',
  'note': 'notes', 'comment': 'notes', 'comments': 'notes',
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
      userMapping?: Record<string, string>  // CSV header → field name (user override)
      module?: 'salon' | 'restaurant'
    }

    const { headers = [], rows = [], userMapping = {} } = body

    // Build index mapping: column index → field name
    // User override takes precedence over auto-detection
    const colMap: Record<number, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i]
      const override = userMapping[h]
      const auto = COLUMN_ALIASES[h.toLowerCase().trim()]
      const field = override === undefined ? auto : override
      if (field) colMap[i] = field
    }

    const { active } = await getActiveBusiness(user)
    const isRestaurant = active ? active.type === 'restaurant' : body.module === 'restaurant'
    const businessId = active?.id ? String(active.id) : null

    if (!businessId) {
      return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 400 })
    }

    console.log(`[import-csv] start user=${user.id} business=${businessId} rows=${rows.length} isRestaurant=${isRestaurant}`)

    // ── Salon: pre-load services + staff ────────────────────────────────
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

      // Find or create "Importált" category for any new services
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
        } catch {
          // no category — service creation will fail; bookings skipped
        }
      }
    }

    // ── Import loop ──────────────────────────────────────────────────────
    let importedCustomers = 0
    let importedBookings = 0
    let skipped = 0
    const errors: string[] = []

    const getField = (row: string[], field: string): string => {
      for (const [idx, fname] of Object.entries(colMap)) {
        if (fname === field) return row[Number(idx)]?.trim() ?? ''
      }
      return ''
    }

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]
      if (!row.some((c) => c.trim())) continue

      const rowNum = ri + 2
      const customerName = getField(row, 'customer_name')
      const customerEmail = getField(row, 'customer_email')
      const customerPhone = getField(row, 'customer_phone')

      if (!customerName && !customerEmail) {
        skipped++
        continue
      }

      // Upsert customer record
      try {
        const existing = customerEmail
          ? (await payload.find({
              collection: 'customers',
              where: { customer_email: { equals: customerEmail }, ...(isRestaurant ? { restaurant: { equals: businessId } } : { salon: { equals: businessId } }) },
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
          importedCustomers++
        }
      } catch (e) {
        errors.push(`Sor ${rowNum}: vendég — ${e instanceof Error ? e.message : 'hiba'}`)
      }

      // Try booking/reservation
      const date = normalizeDate(getField(row, 'date'))
      const startTime = normalizeTime(getField(row, 'start_time'))

      if (!date || !startTime) continue  // customer-only row

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
              date,
              start_time: startTime,
              end_time: endTime,
              pax,
              customer_name: customerName || 'Importált vendég',
              customer_email: customerEmail || undefined,
              customer_phone: customerPhone || undefined,
              status,
              source: 'online',
              notes,
            },
            overrideAccess: true,
          })
          importedBookings++
        } else {
          // Resolve service
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
            } catch {
              serviceId = defaultServiceId
            }
          } else if (!serviceId) {
            serviceId = defaultServiceId
          }

          if (!serviceId) {
            errors.push(`Sor ${rowNum}: nincs szolgáltatás — foglalás kihagyva`)
            skipped++
            continue
          }

          // Resolve staff
          const staffName = getField(row, 'staff')
          const staffId = (staffName ? (staffCache[staffName.toLowerCase()] ?? defaultStaffId) : defaultStaffId)

          if (!staffId) {
            errors.push(`Sor ${rowNum}: nincs munkatárs — foglalás kihagyva`)
            skipped++
            continue
          }

          await payload.create({
            collection: 'bookings',
            data: {
              salon: businessId,
              service: serviceId,
              staff: staffId,
              date,
              start_time: startTime,
              end_time: endTime,
              customer_name: customerName || 'Importált ügyfél',
              customer_email: customerEmail || 'import@placeholder.local',
              customer_phone: customerPhone || undefined,
              status,
              notes,
            },
            overrideAccess: true,
          })
          importedBookings++
        }
      } catch (e) {
        errors.push(`Sor ${rowNum}: foglalás — ${e instanceof Error ? e.message : 'hiba'}`)
        skipped++
      }
    }

    console.log(`[import-csv] done: customers=${importedCustomers} bookings=${importedBookings} skipped=${skipped} errors=${errors.length}`)
    return NextResponse.json({ imported: { customers: importedCustomers, bookings: importedBookings }, skipped, errors: errors.slice(0, 30) })
  } catch (err) {
    console.error('[import-csv]', err)
    return NextResponse.json({ error: 'Szerver hiba az importálás során' }, { status: 500 })
  }
}
