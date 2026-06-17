import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { validateManualReservation } from '@/lib/restaurantBooking'
import type { User, Restaurant, Reservation } from '@/payload/payload-types'

/**
 * A felhasználó AKTÍV éttermét adja vissza (több-üzlet aware): a store-switcherrel kiválasztott
 * üzlet, NEM az „első". Korábban az első éttermet vette → több éttermes fióknál a másik étterem
 * foglalása „nem található" (404) volt, vagy rossz étteremre futott a szabad-asztal validáció.
 */
async function getOwnerRestaurant(user: User) {
  const payload = await getPayloadClient()
  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') return { payload, restaurant: undefined }
  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: active.id,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)) as Restaurant | undefined
  return { payload, restaurant }
}

interface Body {
  reservationId?: string | number
  date: string
  start_time: string
  pax: number
  tableIds?: (string | number)[] | null
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  notes?: string
  internal_notes?: string
  status?: Reservation['status']
  source?: Reservation['source']
  is_birthday?: boolean
  /** Egyedi ülésidő (perc). Üres → az étterem alap turnusa. */
  duration_minutes?: number | null
}

/** Üres név esetén a forrás szerinti alapnév, hogy telt ház alatt ne kelljen nevet gépelni. */
const defaultNameForSource: Record<NonNullable<Reservation['source']>, string> = {
  walk_in: 'Beeső',
  phone: 'Telefon',
  online: 'Foglalás',
}

/**
 * POST /api/restaurant/manage-reservation — tulajdonosi foglalás-rögzítés vagy -szerkesztés
 * a dashboardról (a publikus /api/restaurant/reservations-tól elkülönítve).
 * reservationId megadásával módosít (idő/asztal/létszám áthelyezés is), enélkül újat hoz létre.
 * Mindkét esetben szerveroldalon validál túlfoglalás ellen (validateManualReservation).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const { reservationId, date, start_time, pax } = body
  if (!date || !start_time || !pax) {
    return NextResponse.json({ error: 'Hiányzó adat (dátum, idő, létszám)' }, { status: 400 })
  }

  const { payload, restaurant } = await getOwnerRestaurant(user)
  if (!restaurant) return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 404 })

  // Szerkesztésnél: a foglalás a saját étteremhez tartozzon
  if (reservationId != null) {
    const existing = (await payload
      .findByID({ collection: 'reservations', id: reservationId, depth: 0, overrideAccess: true })
      .catch(() => null)) as Reservation | null
    const existingRestId =
      existing && (typeof existing.restaurant === 'object' ? existing.restaurant.id : existing.restaurant)
    if (!existing || String(existingRestId) !== String(restaurant.id)) {
      return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
    }
  }

  const validation = await validateManualReservation({
    restaurantId: restaurant.id,
    date,
    start_time,
    pax,
    preferredTableIds: body.tableIds ?? null,
    excludeReservationId: reservationId,
    durationMinutes: body.duration_minutes ?? null,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 409 })
  }

  const data: Partial<Reservation> = {
    date,
    start_time,
    end_time: validation.end_time,
    pax,
    tables: validation.tableIds.map(Number) as unknown as Reservation['tables'],
  }
  if (body.customer_name !== undefined) data.customer_name = body.customer_name
  if (body.customer_phone !== undefined) data.customer_phone = body.customer_phone
  // Üres email-t ne küldjünk: a Payload 'email' mezője az üres stringet is validálja → hiba.
  if (body.customer_email) data.customer_email = body.customer_email
  if (body.notes !== undefined) data.notes = body.notes
  if (body.internal_notes !== undefined) data.internal_notes = body.internal_notes
  if (body.status !== undefined) data.status = body.status
  if (body.source !== undefined) data.source = body.source
  if (body.is_birthday !== undefined) data.is_birthday = body.is_birthday

  if (reservationId != null) {
    const updated = await payload.update({
      collection: 'reservations',
      id: reservationId,
      data,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, reservation: updated })
  }

  // Forrás-alapú default név: walk-in → „Beeső", telefon → „Telefon".
  const source = body.source ?? 'walk_in'
  const created = await payload.create({
    collection: 'reservations',
    data: {
      ...data,
      restaurant: restaurant.id,
      customer_name: body.customer_name?.trim() || defaultNameForSource[source] || 'Foglalás',
      status: body.status ?? 'confirmed',
      source,
    } as Reservation,
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, reservation: created })
}
