import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'

export const dynamic = 'force-dynamic'

const MONTH_SHORT = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']

/**
 * Beállítások › Ajándékutalvány (design 16.14) összesítője: az idei eladás (összeg, darab, mennyi beváltva), az utolsó
 * hat hónap havi eladása a tavalyi ugyanazon hónapokkal, a 30 napon belül lejáró aktív utalványok, és az aktív típusok.
 * A fül megnyitásakor kérjük le.
 */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const sp = request.nextUrl.searchParams
  const kind = sp.get('kind')
  const raw = sp.get('businessId')
  if ((kind !== 'salon' && kind !== 'restaurant') || !raw) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const businessId = /^\d+$/.test(raw) ? Number(raw) : raw
  const denied = await assertAnyCapability(user.id, kind, businessId, ['payments.manage', 'vouchers.view', 'vouchers.manage'])
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const scope = { [kind]: { equals: businessId } }
  const now = new Date()
  // a tavalyi azonos hónapokhoz: az utolsó 6 hónap elejétől egy évvel korábbról
  const from = new Date(now.getFullYear() - 1, now.getMonth() - 5, 1)
  const in30 = new Date(now.getTime() + 30 * 86400000)
  type V = { code: string; amount_huf: number; status: string; createdAt: string; purchaser_name?: string | null; recipient_name?: string | null; expires_at?: string }
  const [sold, expiring, types, total] = await Promise.all([
    payload.find({ collection: 'gift-vouchers', where: { and: [scope, { createdAt: { greater_than_equal: from.toISOString() } }, { status: { not_equals: 'refunded' } }] }, limit: 10000, depth: 0, overrideAccess: true, select: { amount_huf: true, status: true, createdAt: true } as never }),
    payload.find({ collection: 'gift-vouchers', where: { and: [scope, { status: { equals: 'active' } }, { expires_at: { greater_than_equal: now.toISOString() } }, { expires_at: { less_than_equal: in30.toISOString() } }] }, sort: 'expires_at', limit: 5, depth: 0, overrideAccess: true, select: { code: true, amount_huf: true, purchaser_name: true, recipient_name: true, expires_at: true } as never }),
    payload.find({ collection: 'gift-voucher-types', where: { and: [scope, { active: { not_equals: false } }] }, sort: 'amount_huf', limit: 50, depth: 0, overrideAccess: true, select: { amount_huf: true } as never }),
    payload.find({ collection: 'gift-vouchers', where: { and: [scope, { status: { not_equals: 'refunded' } }] }, limit: 0, depth: 0, overrideAccess: true }),
  ])
  const docs = sold.docs as unknown as V[]
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1))
  const sumIn = (y: number, m: number) => docs.filter((d) => { const c = new Date(d.createdAt); return c.getFullYear() === y && c.getMonth() === m }).reduce((n, d) => n + (d.amount_huf ?? 0), 0)
  const thisYear = docs.filter((d) => new Date(d.createdAt).getFullYear() === now.getFullYear())
  return NextResponse.json({
    yearTotal: thisYear.reduce((n, d) => n + (d.amount_huf ?? 0), 0),
    yearCount: thisYear.length,
    redeemedPct: thisYear.length ? Math.round((thisYear.filter((d) => d.status === 'redeemed').length / thisYear.length) * 100) : 0,
    months: months.map((m) => ({ label: MONTH_SHORT[m.getMonth()], now: sumIn(m.getFullYear(), m.getMonth()), prev: sumIn(m.getFullYear() - 1, m.getMonth()) })),
    expiring: (expiring.docs as unknown as V[]).map((v) => ({ code: v.code, who: v.recipient_name || v.purchaser_name || '', amount: v.amount_huf, expires: v.expires_at ?? '' })),
    types: { count: types.totalDocs, amounts: (types.docs as unknown as V[]).map((t) => t.amount_huf), sold: total.totalDocs },
  })
}
