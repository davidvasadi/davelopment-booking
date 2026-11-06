import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { notifyShiftMember, notifyShiftStaff } from '@/lib/notifyShift'

/**
 * Beosztás — műszak LÉTREHOZÁSA. A Naptár (CalendarView) ide POST-ol
 * (`{ member/staff, restaurant/salon, date, type, start_time, end_time, hours, note }`).
 * A relationship id-k STRING-ként érkeznek → SZÁM-ra coerce (Postgres).
 * RBAC: `schedule.manage` (owner + manager) az adott üzletben (szalon/étterem).
 */
const num = (v: unknown) => (v == null ? v : /^\d+$/.test(String(v)) ? Number(v) : v)

/**
 * GET /api/shifts?staff=X&date=YYYY-MM-DD — egyetlen nap egyetlen munkatárs bejegyzése (a Napi
 * szünet önkiszolgáló szerkesztéséhez a Munkatársak-oldalon és a Saját profilban). Jogosultság:
 * `schedule.manage` az üzletben, VAGY a saját (linkelt) staff-rekordja — hogy a munkatárs a
 * SAJÁT napját is lekérdezhesse `schedule.manage` nélkül.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const staffId = request.nextUrl.searchParams.get('staff')
  const date = request.nextUrl.searchParams.get('date')
  if (!staffId || !date) return NextResponse.json({ error: 'Hiányzó staff vagy date' }, { status: 400 })

  const payload = await getPayloadClient()
  const staffDoc = await payload.findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!staffDoc) return NextResponse.json({ error: 'Nem található munkatárs' }, { status: 404 })

  const isSelf = staffDoc.user != null && String(typeof staffDoc.user === 'object' ? staffDoc.user.id : staffDoc.user) === String(user.id)
  if (!isSelf) {
    const denied = await assertCapability(user.id, 'salon', staffDoc.salon, 'schedule.manage')
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  const res = await payload.find({
    collection: 'shifts',
    where: { and: [{ staff: { equals: staffId } }, { date: { equals: `${date}T12:00:00.000Z` } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return NextResponse.json({ doc: res.docs[0] ?? null })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  // Az üzlet a body-ból: étterem VAGY szalon (a kettő közül a jelenlévő).
  const bizType: 'salon' | 'restaurant' | null = body.restaurant ? 'restaurant' : body.salon ? 'salon' : null
  const bizId = (body.restaurant ?? body.salon) as string | undefined
  const denied = await assertCapability(user.id, bizType ?? 'salon', bizId, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  if (!body.date || !body.type) return NextResponse.json({ error: 'Hiányzó dátum vagy típus' }, { status: 400 })

  const payload = await getPayloadClient()
  const data: Record<string, unknown> = {
    // A napot DÉL-UTC-re rögzítjük, hogy a date-only ne csússzon el időzóna miatt (nap ± 1).
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? `${body.date}T12:00:00.000Z` : body.date,
    type: body.type,
    start_time: body.start_time ?? null,
    end_time: body.end_time ?? null,
    hours: body.hours ?? null,
    breaks: Array.isArray(body.breaks) ? body.breaks : [],
    note: body.note ?? null,
    ...('paid' in body ? { paid: !!body.paid } : {}),
    ...('left_early_at' in body ? { left_early_at: body.left_early_at ?? null } : {}),
    ...('left_early_reason' in body ? { left_early_reason: body.left_early_reason ?? null } : {}),
    ...(body.owner_shift ? { owner_shift: true } : {}),
    ...(body.member != null ? { member: num(body.member) } : {}),
    ...(body.restaurant != null ? { restaurant: num(body.restaurant) } : {}),
    ...(body.staff != null ? { staff: num(body.staff) } : {}),
    ...(body.salon != null ? { salon: num(body.salon) } : {}),
  }

  try {
    const doc = await payload.create({ collection: 'shifts', data: data as never, overrideAccess: true, user })
    // Push + in-app + email értesítés az érintett dolgozónak.
    if (!body.owner_shift) {
      const shiftDate = String(body.date ?? '').slice(0, 10)
      const startTime = (body.start_time as string | null | undefined) ?? null
      if (bizType === 'restaurant' && body.member) {
        void notifyShiftMember(payload, body.member as string | number, bizType, String(bizId), 'created', shiftDate, startTime)
      } else if (bizType === 'salon' && body.staff) {
        void notifyShiftStaff(payload, body.staff as string | number, String(bizId), 'created', shiftDate, startTime)
      }
    }
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error('[api/shifts POST] create failed', e)
    return NextResponse.json({ error: 'A műszak mentése sikertelen' }, { status: 500 })
  }
}
