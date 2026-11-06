import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { autofillSalonSchedule } from '@/lib/scheduleAutofill'
import { bookableDayCount, type BookingWindowSource } from '@/lib/bookingWindow'

/**
 * A Naptár üres állapota (design 11.4): „Alap munkaidőből kitöltöm” — ugyanaz az automatikus kitöltés, amit a napi cron
 * futtat (a munkatársak heti alap-mintájából, a foglalási ablakon belül), csak azonnal, erre a szalonra.
 * Csak szalon: az étteremnek nincs munkatársankénti alap-munkaideje. POST { salon }.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { salon?: string | number }
  if (body.salon == null) return NextResponse.json({ error: 'Hiányzó szalon' }, { status: 400 })
  const denied = await assertCapability(user.id, 'salon', String(body.salon), 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const payload = await getPayloadClient()
  const salon = await payload.findByID({ collection: 'salons', id: body.salon, depth: 0, overrideAccess: true }).catch(() => null)
  if (!salon) return NextResponse.json({ error: 'A szalon nem található' }, { status: 404 })
  const summary = await autofillSalonSchedule(payload, String(salon.id), bookableDayCount(salon as BookingWindowSource))
  return NextResponse.json({ ok: true, ...summary })
}
