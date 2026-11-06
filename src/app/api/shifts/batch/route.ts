import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
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
 * Body: { staff/member, salon/restaurant, type, start_date, end_date, note?, paid?, start_time?, end_time?, hours?, breaks?,
 *   days? (a hét napjai, 0 = vasárnap — csak ezeken), keep_absences? (műszaknál a meglévő szabadság / beteg napot kihagyja), skip_dates? (ezek a napok kimaradnak) }
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
    const dow = cursor.getUTCDay()
    const iso = cursor.toISOString().slice(0, 10)
    // skip_dates: a hívó által kihagyott napok (a Naptár a zárt napokat küldi műszaknál)
    if ((!Array.isArray(body.days) || (body.days as unknown[]).includes(dow)) && !(Array.isArray(body.skip_dates) && (body.skip_dates as unknown[]).includes(iso))) dates.push(iso)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (dates.length === 0) return NextResponse.json({ ok: true, created: 0, results: [] }, { status: 201 })

  const payload = await getPayloadClient()
  // kié a műszak: étterem-tag, szalon-munkatárs, vagy étteremnél a tulajdonos (owner_shift — neki nincs tag-rekordja)
  const owner = !!body.owner_shift && body.restaurant != null
  const staffKey = body.member != null ? 'member' : 'staff'
  const staffVal = num(body.member ?? body.staff)
  if (!owner && staffVal == null) return NextResponse.json({ error: 'Hiányzó munkatárs' }, { status: 400 })
  const whoWhere: Where = owner
    ? { and: [{ owner_shift: { equals: true } }, { restaurant: { equals: num(body.restaurant) } }] }
    : { [staffKey]: { equals: staffVal } }

  let created = 0
  const results: { id: string | number; date: string }[] = []
  for (const d of dates) {
    const isoDate = `${d}T12:00:00.000Z`
    // Ha már van rekordja erre a napra, felülírjuk (a szabadság-tartomány elsőbbséget élvez
    // egy esetleg korábban felvitt, ütköző bejegyzéssel szemben), nem duplikáljuk.
    const existing = await payload.find({
      collection: 'shifts',
      where: { and: [whoWhere, { date: { equals: isoDate } }] },
      depth: 0,
      overrideAccess: true,
      limit: 1,
    })
    // „+ Beosztás” (design 11.6): a meglévő szabadság / beteg napot nem írja felül a műszak
    const ex = existing.docs[0] as { type?: string } | undefined
    if (body.keep_absences && ex && (ex.type === 'leave' || ex.type === 'sick')) continue
    const data: Record<string, unknown> = {
      date: isoDate,
      type,
      start_time: body.start_time ?? null,
      end_time: body.end_time ?? null,
      hours: body.hours ?? null,
      ...(Array.isArray(body.breaks) ? { breaks: body.breaks } : {}),
      ...('paid' in body ? { paid: !!body.paid } : {}),
      note: body.note ?? null,
      ...(body.restaurant != null ? { restaurant: num(body.restaurant) } : {}),
      ...(body.salon != null ? { salon: num(body.salon) } : {}),
      ...(owner ? { owner_shift: true } : { [staffKey]: staffVal }),
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
