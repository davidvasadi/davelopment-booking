import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertBusinessOwner, numId as num } from '@/lib/shiftAuth'

/**
 * Beosztás — műszak LÉTREHOZÁSA. A ScheduleView ide POST-ol
 * (`{ member/staff, restaurant/salon, date, type, start_time, end_time, hours, note }`).
 * A relationship id-k STRING-ként érkeznek → SZÁM-ra coerce (Postgres). Defenzív: csak az
 * adott üzlet (szalon/étterem) tulaja hozhat létre műszakot.
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

  const ownerErr = await assertBusinessOwner({ salon: body.salon, restaurant: body.restaurant }, user.id)
  if (ownerErr) return NextResponse.json({ error: ownerErr }, { status: 403 })

  if (!body.date || !body.type) return NextResponse.json({ error: 'Hiányzó dátum vagy típus' }, { status: 400 })

  const payload = await getPayloadClient()
  const data: Record<string, unknown> = {
    // A napot DÉL-UTC-re rögzítjük, hogy a date-only ne csússzon el időzóna miatt (nap ± 1).
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? `${body.date}T12:00:00.000Z` : body.date,
    type: body.type,
    start_time: body.start_time ?? null,
    end_time: body.end_time ?? null,
    hours: body.hours ?? null,
    note: body.note ?? null,
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
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error('[api/shifts POST] create failed', e)
    return NextResponse.json({ error: 'A műszak mentése sikertelen' }, { status: 500 })
  }
}
