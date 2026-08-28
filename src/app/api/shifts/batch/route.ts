import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { notifyShiftMember, notifyShiftStaff } from '@/lib/notifyShift'

const num = (v: unknown) => (v == null ? v : /^\d+$/.test(String(v)) ? Number(v) : v)

/**
 * Beosztás LÉTREHOZÁSA egy dátumtartományra egy művelettel (pl. "szabadság aug. 3-tól 10-ig") —
 * a Shifts-tábla NAPONKÉNTI rekordokból áll (nincs "meddig" mező), ezért ez az endpoint napra
 * bontva hozza létre/frissíti a tartomány mindegyik napját, és a résztvevőnek EGYETLEN,
 * összevont értesítést küld (nem naponta egyet — az naponta 5-10 push/email lenne).
 * Body: { staff/member, salon/restaurant, type, start_date, end_date, note? }
 * RBAC: `schedule.manage` (ugyanaz, mint a sima /api/shifts POST-nál).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const bizType: 'salon' | 'restaurant' | null = body.restaurant ? 'restaurant' : body.salon ? 'salon' : null
  const bizId = (body.restaurant ?? body.salon) as string | undefined
  const denied = await assertCapability(user.id, bizType ?? 'salon', bizId, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const startDate = typeof body.start_date === 'string' ? body.start_date : null
  const endDate = typeof body.end_date === 'string' ? body.end_date : null
  const type = typeof body.type === 'string' ? body.type : null
  if (!startDate || !endDate || !type) {
    return NextResponse.json({ error: 'Hiányzó dátumtartomány vagy típus' }, { status: 400 })
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'A záró dátum nem lehet a kezdő előtt' }, { status: 400 })
  }

  // Max. 92 nap egy művelettel (kb. 3 hónap) — védőháló véletlen, óriási tartomány ellen.
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  while (cursor <= end && dates.length < 92) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const payload = await getPayloadClient()
  const staffKey = body.member != null ? 'member' : 'staff'
  const staffVal = num(body.member ?? body.staff)

  let created = 0
  const results: { id: string | number; date: string }[] = []
  for (const d of dates) {
    const isoDate = `${d}T12:00:00.000Z`
    // Ha már van rekordja erre a napra, felülírjuk (a szabadság-tartomány elsőbbséget élvez
    // egy esetleg korábban felvitt, ütköző bejegyzéssel szemben), nem duplikáljuk.
    const existing = await payload.find({
      collection: 'shifts',
      where: { and: [{ [staffKey]: { equals: staffVal } }, { date: { equals: isoDate } }] },
      depth: 0,
      overrideAccess: true,
      limit: 1,
    })
    const data: Record<string, unknown> = {
      date: isoDate,
      type,
      start_time: body.start_time ?? null,
      end_time: body.end_time ?? null,
      hours: body.hours ?? null,
      note: body.note ?? null,
      ...(body.restaurant != null ? { restaurant: num(body.restaurant) } : {}),
      ...(body.salon != null ? { salon: num(body.salon) } : {}),
      [staffKey]: staffVal,
    }
    if (existing.docs[0]) {
      const doc = await payload.update({ collection: 'shifts', id: existing.docs[0].id, data: data as never, overrideAccess: true, user })
      results.push({ id: doc.id, date: d })
    } else {
      const doc = await payload.create({ collection: 'shifts', data: data as never, overrideAccess: true, user })
      results.push({ id: doc.id, date: d })
      created++
    }
  }

  // Egyetlen, összevont értesítés a teljes tartományról.
  const when = dates.length === 1 ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`
  if (bizType === 'restaurant' && body.member) {
    void notifyShiftMember(payload, body.member as string | number, bizType, String(bizId), 'created', when, null)
  } else if (bizType === 'salon' && body.staff) {
    void notifyShiftStaff(payload, body.staff as string | number, String(bizId), 'created', when, null)
  }

  return NextResponse.json({ ok: true, created, results }, { status: 201 })
}
