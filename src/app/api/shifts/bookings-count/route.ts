import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'

/**
 * GET /api/shifts/bookings-count?staff=…&from=YYYY-MM-DD&to=YYYY-MM-DD — a szalon-munkatárs (nem lemondott) foglalásainak
 * száma a napokon. A Naptár nap-szerkesztője mutatja (design 11.5: „ezen a napon 3 foglalása van”, „erre az időre 4
 * foglalása van — áthelyezed őket?”). RBAC: `schedule.manage` a munkatárs szalonjában.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const staff = sp.get('staff'), from = sp.get('from'), to = sp.get('to') ?? from
  if (!staff || !from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  const payload = await getPayloadClient()
  const st = await payload.findByID({ collection: 'staff', id: staff, depth: 0, overrideAccess: true }).catch(() => null)
  const salonId = st?.salon != null ? String(typeof st.salon === 'object' ? st.salon.id : st.salon) : null
  if (!salonId) return NextResponse.json({ count: 0 })
  const denied = await assertCapability(user.id, 'salon', salonId, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const res = await payload.count({
    collection: 'bookings',
    where: { and: [{ staff: { equals: staff } }, { date: { greater_than_equal: from } }, { date: { less_than_equal: to } }, { status: { not_in: ['cancelled', 'no_show'] } }] },
    overrideAccess: true,
  })
  return NextResponse.json({ count: res.totalDocs })
}
