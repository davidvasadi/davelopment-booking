import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { findMyStaffId } from '@/lib/myStaffLink'
import { authQuery, sql } from '@/lib/authDb'
import { ymdLocal } from '@/lib/utils'

export type BookingSearchHit = { id: string; date: string; start: string; end: string; name: string; phone: string | null; status: string; who: string | null }

/**
 * GET /api/bookings/search?q=… — foglalás keresése az AKTÍV üzlet ÖSSZES foglalásában (nem csak a betöltött napon):
 * vendég neve vagy telefonszáma (a telefonnál a tagolás nélkül is). Legfeljebb 20 találat: előbb a mai és a jövőbeli
 * (időrendben), utána a korábbiak (a legfrissebb elöl). A mobil Foglalások kereső listázza; a találatra koppintva a
 * napjára ugrik és megnyílik. Közvetlen SQL (egy lekérdezés, LIMIT 20) — lásd docs/sebesseg. Jog: `bookings.view`;
 * szalonban a nem-tulaj csak a saját foglalásait látja (mint a Foglalások oldal).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 })
  const denied = await assertCapability(user.id, active.type, active.id, 'bookings.view')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const digits = q.replace(/\D/g, '')
  const phoneLike = digits.length >= 4 ? `%${digits}%` : null
  const today = ymdLocal(new Date())
  const bizId = Number(active.id)
  const match = phoneLike
    ? sql`(b.customer_name ILIKE ${like} OR regexp_replace(coalesce(b.customer_phone, ''), '\\D', '', 'g') LIKE ${phoneLike})`
    : sql`b.customer_name ILIKE ${like}`
  const order = sql`ORDER BY (b.date < ${today}), CASE WHEN b.date >= ${today} THEN b.date END ASC, b.date DESC, b.start_time ASC LIMIT 20`

  type Row = { id: number; date: string; start_time: string | null; end_time: string | null; customer_name: string | null; customer_phone: string | null; status: string; who: string | null }
  let rows: Row[]
  if (active.type === 'salon') {
    const own = active.role !== 'owner' ? await findMyStaffId(bizId, user.id, user.email) : null
    if (active.role !== 'owner' && own == null) return NextResponse.json({ results: [] })
    rows = await authQuery<Row>(sql`SELECT b.id, b.date, b.start_time, b.end_time, b.customer_name, b.customer_phone, b.status::text AS status, s.name AS who
      FROM bookings b LEFT JOIN staff s ON s.id = b.staff_id
      WHERE b.salon_id = ${bizId} AND ${match}${own != null ? sql` AND b.staff_id = ${Number(own)}` : sql``} ${order}`)
  } else {
    rows = await authQuery<Row>(sql`SELECT b.id, b.date, b.start_time, b.end_time, b.customer_name, b.customer_phone, b.status::text AS status, NULL AS who
      FROM reservations b WHERE b.restaurant_id = ${bizId} AND ${match} ${order}`)
  }
  const results: BookingSearchHit[] = rows.map((r) => ({ id: String(r.id), date: String(r.date).slice(0, 10), start: r.start_time ?? '', end: r.end_time ?? '', name: r.customer_name ?? '', phone: r.customer_phone, status: r.status, who: r.who }))
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
}
