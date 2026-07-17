import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'
import { sendBookingConfirmation, sendNewBookingNotification } from '@/lib/email'
import type { User, Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

/**
 * A felhasználó AKTÍV szalonját adja vissza (több-üzlet aware) — a store-switcherrel
 * kiválasztott üzlet, NEM az „első". Az étterem `manage-reservation` szalon-párja.
 */
async function getOwnerSalon(user: User) {
  const payload = await getPayloadClient()
  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return { payload, salon: undefined }
  const salon = (await payload.findByID({
    collection: 'salons',
    id: active.id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)) as Salon | undefined
  return { payload, salon }
}

interface Body {
  bookingId?: string | number
  serviceId: string | number
  staffId: string | number
  date: string
  start_time: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  notes?: string
  status?: Booking['status']
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

/**
 * POST /api/salon/manage-booking — tulajdonosi foglalás-rögzítés vagy -szerkesztés
 * a dashboardról (a publikus /api/bookings-tól elkülönítve). bookingId megadásával
 * módosít (idő/szakember/szolgáltatás áthelyezés is), enélkül újat hoz létre.
 * A vége-idő a szolgáltatás hosszából számolódik; szerveroldalon validál átfedés ellen
 * (ugyanaz a szakember nem lehet két foglaláson egyszerre).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  // Bármely tulaj (több-üzlet fiók: a szerep lehet restaurant_owner is, miközben szalonban dolgozik)
  // vagy admin — a tényleges jogosultságot a getOwnerSalon (aktív üzlet) szűkíti a saját szalonra.
  if (!user || (user.role !== 'salon_owner' && user.role !== 'restaurant_owner' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const { bookingId, serviceId, staffId, date, start_time } = body
  if (!serviceId || !staffId || !date || !start_time) {
    return NextResponse.json({ error: 'Hiányzó adat (szolgáltatás, szakember, dátum, idő)' }, { status: 400 })
  }

  // A Bookings.customer_email kollekció-szinten kötelező → itt is megköveteljük (érvényes formátum).
  const email = (body.customer_email ?? '').trim()
  if (!email) return NextResponse.json({ error: 'Az e-mail cím megadása kötelező' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Érvénytelen e-mail cím' }, { status: 400 })

  const { payload, salon } = await getOwnerSalon(user)
  if (!salon) return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })

  // A szolgáltatás a saját szalonhoz tartozzon; a hossza adja a vége-időt.
  const service = (await payload
    .findByID({ collection: 'services', id: serviceId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Service | null
  const serviceSalonId = service && (typeof service.salon === 'object' ? service.salon.id : service.salon)
  if (!service || String(serviceSalonId) !== String(salon.id)) {
    return NextResponse.json({ error: 'A szolgáltatás nem található' }, { status: 404 })
  }

  // A szakember a saját szalonhoz tartozzon.
  const staff = (await payload
    .findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true })
    .catch(() => null)) as StaffMember | null
  const staffSalonId = staff && (typeof staff.salon === 'object' ? staff.salon.id : staff.salon)
  if (!staff || String(staffSalonId) !== String(salon.id)) {
    return NextResponse.json({ error: 'A szakember nem található' }, { status: 404 })
  }

  const startMin = hhmmToMinutes(start_time)
  const endMin = startMin + (service.duration_minutes || 30)
  const end_time = minutesToHHMM(endMin)

  // Szerkesztésnél: a foglalás a saját szalonhoz tartozzon.
  if (bookingId != null) {
    const existing = (await payload
      .findByID({ collection: 'bookings', id: bookingId, depth: 0, overrideAccess: true })
      .catch(() => null)) as Booking | null
    const existingSalonId =
      existing && (typeof existing.salon === 'object' ? existing.salon.id : existing.salon)
    if (!existing || String(existingSalonId) !== String(salon.id)) {
      return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
    }
  }

  // ── Átfedés-ellenőrzés: ugyanaz a szakember, ugyanaznap, nem lemondott, a szerkesztett
  //    foglalást kizárva. Tiszta idő-átfedés (foglaló számára a szomszédos időpont engedett). ──
  const dayBookings = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { staff: { equals: staffId } },
        { date: { equals: date } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    limit: 300,
    depth: 0,
    overrideAccess: true,
  })
  const clash = (dayBookings.docs as Booking[]).some((b) => {
    if (bookingId != null && String(b.id) === String(bookingId)) return false
    const bs = hhmmToMinutes(b.start_time)
    const be = hhmmToMinutes(b.end_time)
    return startMin < be && endMin > bs
  })
  if (clash) {
    return NextResponse.json({ error: 'Ütközés: a szakembernek már van foglalása erre az időre' }, { status: 409 })
  }

  const data: Partial<Booking> = {
    service: Number(serviceId) as unknown as Booking['service'],
    staff: Number(staffId) as unknown as Booking['staff'],
    date,
    start_time,
    end_time,
    customer_email: email,
  }
  if (body.customer_name !== undefined) data.customer_name = body.customer_name.trim() || 'Vendég'
  if (body.customer_phone !== undefined) data.customer_phone = body.customer_phone
  if (body.notes !== undefined) data.notes = body.notes
  if (body.status !== undefined) data.status = body.status

  if (bookingId != null) {
    const updated = await payload.update({
      collection: 'bookings',
      id: bookingId,
      data,
      overrideAccess: true,
      user,
    })
    return NextResponse.json({ ok: true, booking: updated })
  }

  const created = await payload.create({
    collection: 'bookings',
    data: {
      ...data,
      salon: Number(salon.id),
      customer_name: body.customer_name?.trim() || 'Vendég',
      status: body.status ?? 'confirmed',
      // Önlemondó token — hogy a visszaigazoló emailben legyen működő lemondás-link.
      cancellation_token: randomBytes(32).toString('hex'),
    } as unknown as Booking,
    overrideAccess: true,
    user,
  })

  // Visszaigazoló email a vendégnek (mint a publikus foglalónál) — a kézi (dashboard) rögzítésnél is.
  // Csak ha a tulaj nem tiltotta le a megerősítő emailt.
  const emailData = { booking: created as unknown as Booking, salon, service, staff }
  if (salon.notification_prefs?.confirm_email !== false) {
    void sendBookingConfirmation(emailData)
  }
  // Értesítő a szolgáltatónak: az üzlet e-mail címére, vagy ha üres, a tulaj fiók-emailjére.
  void sendNewBookingNotification(emailData, user.email)

  return NextResponse.json({ ok: true, booking: created })
}
