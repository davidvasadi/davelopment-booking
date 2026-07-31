import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { notifyShiftMember, notifyShiftStaff } from '@/lib/notifyShift'
import type { Shift } from '@/payload/payload-types'

function relNum(v: unknown): string | number | null {
  if (v == null) return null
  if (typeof v === 'object' && 'id' in (v as object)) return (v as { id: string | number }).id
  return v as string | number
}

/**
 * Beosztás — egy műszak MÓDOSÍTÁSA / TÖRLÉSE. RBAC: `schedule.manage` (owner + manager)
 * a műszak üzletében (szalon/étterem). A relationship id-k SZÁM-ra coerce-ölve.
 */
const num = (v: unknown) => (v == null ? v : /^\d+$/.test(String(v)) ? Number(v) : v)

const relId = (v: string | { id: string | number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

async function loadManageableShift(id: string, userId: string | number) {
  const payload = await getPayloadClient()
  let shift: Shift | undefined
  try {
    shift = (await payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true })) as Shift
  } catch {
    return { error: 'A műszak nem található', status: 404 as const }
  }
  // Az üzlet-típus + id a műszak rekordjából (salon VAGY restaurant).
  const restaurantId = relId(shift.restaurant)
  const salonId = relId(shift.salon)
  const bizType: 'salon' | 'restaurant' | null = restaurantId ? 'restaurant' : salonId ? 'salon' : null
  const bizId = restaurantId ?? salonId
  if (!bizType || !bizId) return { error: 'Érvénytelen műszak', status: 400 as const }
  const denied = await assertCapability(userId, bizType, bizId, 'schedule.manage')
  if (denied) return { error: denied.error, status: denied.status }
  return { payload, shift, bizType, bizId }
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

  const loaded = await loadManageableShift(id, user.id)
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
    // Push + in-app + email értesítés az érintett dolgozónak.
    const { shift, bizType, bizId } = loaded
    const memberId = relNum(shift.member)
    const staffId = relNum(shift.staff)
    const shiftDate = (doc.date as string | null | undefined)?.slice(0, 10) ?? shift.date?.slice(0, 10) ?? ''
    const startTime = (doc.start_time ?? shift.start_time ?? null) as string | null
    if (!shift.owner_shift) {
      if (bizType === 'restaurant' && memberId) {
        void notifyShiftMember(loaded.payload, memberId, bizType, bizId, 'modified', shiftDate, startTime)
      } else if (bizType === 'salon' && staffId) {
        void notifyShiftStaff(loaded.payload, staffId, bizId, 'modified', shiftDate, startTime)
      }
    }
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

  const loaded = await loadManageableShift(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const { shift, bizType, bizId } = loaded
  const memberId = relNum(shift.member)
  const staffId = relNum(shift.staff)
  const shiftDate = shift.date?.slice(0, 10) ?? ''
  const startTime = (shift.start_time ?? null) as string | null

  await loaded.payload.delete({ collection: 'shifts', id, overrideAccess: true, user })

  // Push + in-app + email értesítés az érintett dolgozónak.
  if (!shift.owner_shift) {
    if (bizType === 'restaurant' && memberId) {
      void notifyShiftMember(loaded.payload, memberId, bizType, bizId, 'deleted', shiftDate, startTime)
    } else if (bizType === 'salon' && staffId) {
      void notifyShiftStaff(loaded.payload, staffId, bizId, 'deleted', shiftDate, startTime)
    }
  }
  return NextResponse.json({ ok: true })
}
