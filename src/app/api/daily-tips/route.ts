import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertBusinessOwner, numId } from '@/lib/shiftAuth'
import type { Restaurant } from '@/payload/payload-types'

/**
 * Napi KÖZPONTI borravaló beállítása egy napra. A Naptár nap-szerkesztője POST-ol ide.
 * Body: { restaurant, date: 'YYYY-MM-DD', amount: number }. amount <= 0 → törli az adott napot.
 * Az összeg a Restaurant.daily_tips tömbben él (date-only szöveg, hogy ne csússzon időzóna miatt);
 * a profil havi szinten összegzi az aznap dolgozó jogosultak közt elosztva. Auth: tulaj/vezető.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { restaurant?: unknown; date?: unknown; amount?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const restaurant = body.restaurant
  const date = typeof body.date === 'string' ? body.date : ''
  if (!restaurant || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Hiányzó étterem vagy dátum' }, { status: 400 })
  }

  const ownerErr = await assertBusinessOwner({ restaurant }, user.id)
  if (ownerErr) return NextResponse.json({ error: ownerErr }, { status: 403 })

  const amount = Number(body.amount)
  const keep = Number.isFinite(amount) && amount > 0
  const payload = await getPayloadClient()
  try {
    const rest = (await payload.findByID({ collection: 'restaurants', id: numId(restaurant) as string, depth: 0, overrideAccess: true })) as Restaurant
    // Az adott nap meglévő bejegyzését kivesszük, majd (ha van összeg) újra beszúrjuk.
    const others = (rest.daily_tips ?? []).filter((t) => (t.date ?? '').slice(0, 10) !== date)
    const next = keep ? [...others, { date, amount: Math.round(amount) }] : others
    await payload.update({ collection: 'restaurants', id: numId(restaurant) as string, data: { daily_tips: next } as never, overrideAccess: true, user })
    return NextResponse.json({ ok: true, date, amount: keep ? Math.round(amount) : 0 })
  } catch (e) {
    console.error('[api/daily-tips POST] failed', e)
    return NextResponse.json({ error: 'A borravaló mentése sikertelen' }, { status: 500 })
  }
}
