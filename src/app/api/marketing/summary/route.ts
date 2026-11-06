import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'
import { getPricing } from '@/lib/pricing'
import { monthlyEmailCapForTier, resolveTier } from '@/lib/tier'

export const dynamic = 'force-dynamic'

/**
 * Beállítások › Hírlevél (design 16.13): a lap összesítője — feliratkozók (és e havi új), leiratkozottak, e havi keret, és
 * az utolsó kiküldött kampányok megnyitási aránya (a legutóbbi az élen, mellette az átlag). A fül megnyitásakor kérjük le.
 */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const sp = request.nextUrl.searchParams
  const kind = sp.get('kind')
  const raw = sp.get('businessId')
  if ((kind !== 'salon' && kind !== 'restaurant') || !raw) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const businessId = /^\d+$/.test(raw) ? Number(raw) : raw
  const denied = await assertAnyCapability(user.id, kind, businessId, ['marketing.view', 'marketing.manage', 'settings.profile'])
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const scope = { [kind]: { equals: businessId } }
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [biz, subs, newSubs, unsubs, used, sent, pricing] = await Promise.all([
    payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: businessId, depth: 0, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: true } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: true } }, { marketing_consent_at: { greater_than_equal: monthStart } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: false } }, { marketing_unsubscribed_at: { exists: true } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, scope, { createdAt: { greater_than_equal: monthStart } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'marketing-campaigns', where: { and: [scope, { status: { equals: 'sent' } }] }, sort: '-createdAt', limit: 6, depth: 0, overrideAccess: true, select: { subject: true, recipient_count: true, createdAt: true } as never }),
    getPricing(),
  ])
  const tier = resolveTier((biz as { tier?: string | null } | null)?.tier)
  const campaigns = sent.docs as { id: string | number; subject?: string; recipient_count?: number | null; createdAt: string }[]
  const rates = await Promise.all(campaigns.map(async (c) => {
    const opened = (await payload.find({ collection: 'email-log', where: { and: [{ campaign: { equals: c.id } }, { or: [{ status: { in: ['opened', 'clicked'] } }, { opened_at: { exists: true } }] }] }, limit: 0, depth: 0, overrideAccess: true })).totalDocs
    return { subject: c.subject ?? '', at: c.createdAt, recipients: c.recipient_count ?? 0, pct: c.recipient_count ? Math.round((opened / c.recipient_count) * 100) : 0 }
  }))
  return NextResponse.json({
    subscribers: subs.totalDocs, newThisMonth: newSubs.totalDocs, unsubscribed: unsubs.totalDocs,
    used: used.totalDocs, cap: monthlyEmailCapForTier(pricing, tier), tier,
    campaigns: rates.reverse(),
  })
}
