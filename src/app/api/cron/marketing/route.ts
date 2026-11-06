import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { dispatchCampaign } from '@/lib/marketingSend'
import { parseTranslations } from '@/lib/marketingSegments'
import type { MarketingCampaign } from '@/payload/payload-types'

/**
 * Ütemezett marketing-kampányok kiküldése (design 13.4 „Ütemezve”). A VPS cron hívja 5 percenként, CRON_SECRET-tel:
 *   *\/5 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://booking.davelopment.hu/api/cron/marketing
 * A lejárt időpontú „scheduled” kampányokat a közös `dispatchCampaign` küldi ki (keret, zár, leiratkozó-link ugyanaz).
 */
export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret')
  if (!secret || provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayloadClient()
  const due = await payload.find({
    collection: 'marketing-campaigns',
    where: { and: [{ status: { equals: 'scheduled' } }, { scheduled_at: { less_than_equal: new Date().toISOString() } }] },
    limit: 20, depth: 0, overrideAccess: true,
  })
  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const c of due.docs as MarketingCampaign[]) {
    const kind = c.salon ? 'salon' : 'restaurant'
    const businessId = (c.salon ?? c.restaurant) as string | number | { id: string | number }
    const id = typeof businessId === 'object' ? businessId.id : businessId
    if (!c.body_html) { results.push({ id: String(c.id), ok: false, error: 'nincs HTML' }); continue }
    const r = await dispatchCampaign(payload, { kind, businessId: id, subject: c.subject, bodyHtml: c.body_html, blocks: c.blocks_json, customerIds: (c.target_customer_ids as string[] | null) ?? null, translations: parseTranslations(c.translations), campaignId: c.id })
    results.push({ id: String(c.id), ok: r.ok, ...(r.ok ? {} : { error: r.error }) })
    // ha a keret miatt nem ment ki, piszkozatba kerül (különben minden futáskor újra próbálná)
    if (!r.ok && r.status === 400) await payload.update({ collection: 'marketing-campaigns', id: c.id, data: { status: 'draft' }, overrideAccess: true }).catch(() => null)
  }
  return NextResponse.json({ processed: results.length, results })
}
