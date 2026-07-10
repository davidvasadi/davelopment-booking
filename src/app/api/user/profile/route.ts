/**
 * PATCH /api/user/profile
 *
 * A bejelentkezett felhasználó (tulajdonos) SAJÁT fiók-szintű adatlapja. A tulajnak
 * nincs membershipje, ezért a személyes adatai (telefon, szül.nap, cím stb.) a User-fiókon
 * élnek — a HiringView adatlap ugyanúgy szerkeszti, mint a munkatársakét, csak ide POST-ol.
 * Bér/borravaló SOHA nem kerül ide (azt a membershipek hordozzák).
 *
 * Body: { name?, phone?, birthday?, join_date?, address?, tax_id?, emergency_contact?, weekly_hours?, bio? }
 * A user MINDIG csak a saját rekordját frissíti (id = a session user-e).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

/** Date-only mezőt DÉL-UTC-re rögzítünk, hogy a nap ne csússzon időzóna miatt. */
function toNoonUtc(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const s = v.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s
}
function toText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s === '' ? null : s
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if ('name' in body) {
    const name = toText(body.name)
    if (!name) return NextResponse.json({ error: 'name-required' }, { status: 400 })
    data.name = name
  }
  if ('phone' in body) data.phone = toText(body.phone)
  if ('address' in body) data.address = toText(body.address)
  if ('tax_id' in body) data.tax_id = toText(body.tax_id)
  if ('emergency_contact' in body) data.emergency_contact = toText(body.emergency_contact)
  if ('bio' in body) data.bio = toText(body.bio)
  if ('birthday' in body) data.birthday = toNoonUtc(body.birthday)
  if ('join_date' in body) data.join_date = toNoonUtc(body.join_date)
  if ('weekly_hours' in body) {
    const n = body.weekly_hours
    data.weekly_hours = n === '' || n == null ? null : Number(n)
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true })

  try {
    const doc = await payloadUpdate(user.id, data)
    return NextResponse.json({ ok: true, user: doc })
  } catch (e) {
    console.error('[api/user/profile PATCH] update failed', e)
    return NextResponse.json({ error: 'update-failed' }, { status: 500 })
  }
}

async function payloadUpdate(id: string | number, data: Record<string, unknown>) {
  const payload = await getPayloadClient()
  return payload.update({ collection: 'users', id, data: data as never, overrideAccess: true })
}
