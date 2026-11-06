import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'

export const dynamic = 'force-dynamic'

const MONTH_SHORT = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']

/**
 * Beállítások › Értékelések (design 16.15) összesítője — a SAJÁT értékelő-oldalunkról (Google-hívás nélkül): e havi
 * értékelések, az utolsó hat hónap értékelései és kiküldött kérései (e-mail napló, `feedback`), e havi átlag, és a
 * legutóbbi három értékelés. A fül megnyitásakor kérjük le.
 */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const sp = request.nextUrl.searchParams
  const kind = sp.get('kind')
  const raw = sp.get('businessId')
  if ((kind !== 'salon' && kind !== 'restaurant') || !raw) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const businessId = /^\d+$/.test(raw) ? Number(raw) : raw
  const denied = await assertAnyCapability(user.id, kind, businessId, ['settings.profile'])
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const scope = { [kind]: { equals: businessId } }
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
  type R = { rating?: number | null; comment?: string | null; customer_name?: string | null; createdAt: string }
  const [reviews, requests, recent] = await Promise.all([
    payload.find({ collection: 'reviews', where: { and: [scope, { createdAt: { greater_than_equal: from } }] }, limit: 10000, depth: 0, overrideAccess: true, select: { rating: true, createdAt: true } as never }),
    payload.find({ collection: 'email-log', where: { and: [scope, { type: { equals: 'feedback' } }, { createdAt: { greater_than_equal: from } }] }, limit: 10000, depth: 0, overrideAccess: true, select: { createdAt: true } as never }),
    payload.find({ collection: 'reviews', where: scope, sort: '-createdAt', limit: 3, depth: 0, overrideAccess: true, select: { rating: true, comment: true, customer_name: true, createdAt: true } as never }),
  ])
  const rv = reviews.docs as unknown as R[]
  const rq = requests.docs as unknown as { createdAt: string }[]
  const inMonth = (iso: string, y: number, m: number) => { const d = new Date(iso); return d.getFullYear() === y && d.getMonth() === m }
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)).map((m) => ({
    label: MONTH_SHORT[m.getMonth()],
    reviews: rv.filter((r) => inMonth(r.createdAt, m.getFullYear(), m.getMonth())).length,
    requests: rq.filter((r) => inMonth(r.createdAt, m.getFullYear(), m.getMonth())).length,
  }))
  const thisMonth = rv.filter((r) => inMonth(r.createdAt, now.getFullYear(), now.getMonth()) && r.rating)
  return NextResponse.json({
    monthCount: months[5].reviews,
    monthRequests: months[5].requests,
    monthAvg: thisMonth.length ? Math.round((thisMonth.reduce((n, r) => n + (r.rating ?? 0), 0) / thisMonth.length) * 10) / 10 : null,
    months,
    recent: (recent.docs as unknown as R[]).map((r) => ({ name: r.customer_name ?? '', rating: r.rating ?? 0, comment: r.comment ?? '', at: r.createdAt })),
  })
}
