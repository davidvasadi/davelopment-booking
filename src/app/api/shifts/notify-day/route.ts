import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { notifyShiftMember, notifyShiftStaff } from '@/lib/notifyShift'
import type { Shift } from '@/payload/payload-types'

/**
 * Nap véglegesítése — küldi az értesítéseket az adott napon beosztott ÖSSZES tagnak.
 * A ScheduleView DayEditor "Nap véglegesítése" gombja POST-ol ide.
 * Body: { date: 'YYYY-MM-DD', bizType: 'salon' | 'restaurant', bizId: string }
 * RBAC: `schedule.manage` a megadott üzletben.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { date?: unknown; bizType?: unknown; bizId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const date = typeof body.date === 'string' ? body.date : null
  const bizType = body.bizType === 'restaurant' ? 'restaurant' : body.bizType === 'salon' ? 'salon' : null
  const bizId = typeof body.bizId === 'string' ? body.bizId : null

  if (!date || !bizType || !bizId) {
    return NextResponse.json({ error: 'Hiányzó paraméter (date / bizType / bizId)' }, { status: 400 })
  }

  const denied = await assertCapability(user.id, bizType, bizId, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  // A shift.date timestampként van tárolva (T12:00:00.000Z) → range query kell, nem LIKE.
  const shifts = await payload.find({
    collection: 'shifts',
    where: {
      and: [
        { [bizType]: { equals: bizId } },
        { date: { greater_than_equal: `${date}T00:00:00.000Z` } },
        { date: { less_than_equal: `${date}T23:59:59.999Z` } },
      ],
    },
    depth: 0,
    limit: 200,
    overrideAccess: true,
  })

  let sent = 0
  for (const shift of shifts.docs as Shift[]) {
    if (shift.owner_shift) continue
    try {
      const shiftDate = typeof shift.date === 'string' ? shift.date.slice(0, 10) : date
      if (bizType === 'restaurant' && shift.member) {
        await notifyShiftMember(payload, shift.member as string | number, 'restaurant', bizId, 'created', shiftDate, shift.start_time)
        sent++
      } else if (bizType === 'salon' && shift.staff) {
        await notifyShiftStaff(payload, shift.staff as string | number, bizId, 'created', shiftDate, shift.start_time)
        sent++
      }
    } catch (err) {
      console.error('[notify-day] shift értesítés hiba:', shift.id, err)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
