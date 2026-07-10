import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertBusinessOwner, numId as num } from '@/lib/shiftAuth'
import type { Shift } from '@/payload/payload-types'

/**
 * Beosztás — egy műszak MÓDOSÍTÁSA / TÖRLÉSE. Defenzív: csak a műszak üzletének (szalon/
 * étterem) tulaja. A relationship id-k SZÁM-ra coerce-ölve.
 */

const relId = (v: string | { id: string | number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

async function loadOwnedShift(id: string, userId: string | number) {
  const payload = await getPayloadClient()
  let shift: Shift | undefined
  try {
    shift = (await payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true })) as Shift
  } catch {
    return { error: 'A műszak nem található', status: 404 as const }
  }
  const ownerErr = await assertBusinessOwner(
    { salon: relId(shift.salon), restaurant: relId(shift.restaurant) },
    userId,
  )
  if (ownerErr) return { error: ownerErr, status: 403 as const }
  return { payload }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const loaded = await loadOwnedShift(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const data: Record<string, unknown> = {
    ...(body.date != null ? { date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? `${body.date}T12:00:00.000Z` : body.date } : {}),
    ...(body.type != null ? { type: body.type } : {}),
    ...('start_time' in body ? { start_time: body.start_time ?? null } : {}),
    ...('end_time' in body ? { end_time: body.end_time ?? null } : {}),
    ...('hours' in body ? { hours: body.hours ?? null } : {}),
    ...('note' in body ? { note: body.note ?? null } : {}),
    ...('left_early_at' in body ? { left_early_at: body.left_early_at ?? null } : {}),
    ...('left_early_reason' in body ? { left_early_reason: body.left_early_reason ?? null } : {}),
    ...(body.member != null ? { member: num(body.member) } : {}),
    ...(body.restaurant != null ? { restaurant: num(body.restaurant) } : {}),
    ...(body.staff != null ? { staff: num(body.staff) } : {}),
    ...(body.salon != null ? { salon: num(body.salon) } : {}),
  }

  try {
    const doc = await loaded.payload.update({ collection: 'shifts', id, data: data as never, overrideAccess: true, user })
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[api/shifts PATCH] update failed', e)
    return NextResponse.json({ error: 'A műszak mentése sikertelen' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadOwnedShift(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  await loaded.payload.delete({ collection: 'shifts', id, overrideAccess: true, user })
  return NextResponse.json({ ok: true })
}
