import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { validateManualReservation } from '@/lib/restaurantBooking'
import type { Restaurant, Reservation } from '@/payload/payload-types'

async function getOwnerRestaurant(userId: string | number) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'restaurants',
    where: { owner: { equals: userId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return { payload, restaurant: result.docs[0] as Restaurant | undefined }
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

  const { payload, restaurant } = await getOwnerRestaurant(user.id)
  if (!restaurant) return NextResponse.json({ error: 'Nincs étterem' }, { status: 404 })

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
  if (body.customer_email !== undefined) data.customer_email = body.customer_email
  if (body.notes !== undefined) data.notes = body.notes
  if (body.internal_notes !== undefined) data.internal_notes = body.internal_notes
  if (body.status !== undefined) data.status = body.status

  if (reservationId != null) {
    const updated = await payload.update({
      collection: 'reservations',
      id: reservationId,
      data,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, reservation: updated })
  }

  const created = await payload.create({
    collection: 'reservations',
    data: {
      ...data,
      restaurant: restaurant.id,
      customer_name: body.customer_name || 'Telefonos foglalás',
      customer_email: body.customer_email || '',
      status: body.status ?? 'confirmed',
    } as Reservation,
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, reservation: created })
}
