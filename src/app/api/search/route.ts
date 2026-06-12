/**
 * GET /api/search?q=...
 *
 * Globális kereső a dashboardhoz: a bejelentkezett felhasználó éttermének/szalonjának
 * foglalásai között keres név / email / telefon alapján. A találatok a megfelelő
 * Foglalások oldalra mutatnak (a kártya megnyitásához reservation/booking query-vel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

export type SearchHit = {
  id: string | number
  kind: 'reservation' | 'booking' | 'place' | 'subscription'
  name: string
  sub: string // pl. "2026-06-04 · 18:00 · 4 fő"
  href: string
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ hits: [] }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ hits: [] })

  const payload = await getPayloadClient()
  const like = { like: q }

  try {
    // Admin (backstage) → helyek (szalon + étterem) név/owner-email + előfizetések.
    // A találatok a backstage aloldalakra mutatnak, a hely a detail-sheetet nyitja query-paramból.
    if (user.role === 'admin') {
      const [salons, restaurants] = await Promise.all([
        payload.find({ collection: 'salons', where: { or: [{ name: like }, { city: like }] }, sort: '-createdAt', limit: 6, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'restaurants', where: { or: [{ name: like }, { city: like }] }, sort: '-createdAt', limit: 6, depth: 0, overrideAccess: true }),
      ])
      const hits: SearchHit[] = [
        ...salons.docs.map((s) => ({
          id: s.id,
          kind: 'place' as const,
          name: s.name,
          sub: `Szalon${s.city ? ` · ${s.city}` : ''}`,
          href: `/backstage/salons?place=salon:${encodeURIComponent(String(s.id))}&t=${Date.now()}`,
        })),
        ...restaurants.docs.map((r) => ({
          id: r.id,
          kind: 'place' as const,
          name: r.name,
          sub: `Étterem${r.city ? ` · ${r.city}` : ''}`,
          href: `/backstage/salons?place=restaurant:${encodeURIComponent(String(r.id))}&t=${Date.now()}`,
        })),
      ]
      return NextResponse.json({ hits })
    }

    // Étterem-tulajdonos → reservations, szalon-tulajdonos → bookings.
    if (user.role === 'restaurant_owner' && user.restaurant) {
      const restaurantId = typeof user.restaurant === 'object' ? user.restaurant.id : user.restaurant
      const res = await payload.find({
        collection: 'reservations',
        where: {
          and: [
            { restaurant: { equals: restaurantId } },
            { or: [{ customer_name: like }, { customer_email: like }, { customer_phone: like }] },
          ],
        },
        sort: '-date',
        limit: 8,
        overrideAccess: true,
      })
      const hits: SearchHit[] = res.docs.map((r) => ({
        id: r.id,
        kind: 'reservation',
        name: r.customer_name,
        sub: `${r.date} · ${r.start_time} · ${r.pax} fő`,
        href: `/restaurant/bookings?reservation=${encodeURIComponent(String(r.id))}&t=${Date.now()}`,
      }))
      return NextResponse.json({ hits })
    }

    if (user.salon) {
      const salonId = typeof user.salon === 'object' ? user.salon.id : user.salon
      const res = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { salon: { equals: salonId } },
            { or: [{ customer_name: like }, { customer_email: like }, { customer_phone: like }] },
          ],
        },
        sort: '-date',
        limit: 8,
        overrideAccess: true,
      })
      const hits: SearchHit[] = res.docs.map((b) => ({
        id: b.id,
        kind: 'booking',
        name: b.customer_name,
        sub: `${b.date} · ${b.start_time}`,
        href: `/dashboard/bookings?booking=${encodeURIComponent(String(b.id))}&t=${Date.now()}`,
      }))
      return NextResponse.json({ hits })
    }

    return NextResponse.json({ hits: [] })
  } catch {
    return NextResponse.json({ hits: [] }, { status: 500 })
  }
}
