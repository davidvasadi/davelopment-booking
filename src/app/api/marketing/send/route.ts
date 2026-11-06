import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'
import { dispatchCampaign, marketingAudience } from '@/lib/marketingSend'
import { resolveTier } from '@/lib/tier'
import { parseSegments, parseTranslations, resolveSegmentIds } from '@/lib/marketingSegments'

/**
 * A marketing-hírlevél kiküldése — azonnal, vagy (`scheduledAt`) ütemezve: ilyenkor a kampány „Ütemezve” állapotban,
 * a kész HTML-lel elmentődik, és a `/api/cron/marketing` küldi ki a megadott időpontban (design 13.4). A tényleges küldés
 * a közös `dispatchCampaign` (lib/marketingSend).
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: { kind?: 'salon' | 'restaurant'; businessId?: string | number; subject?: string; bodyHtml?: string; blocks?: unknown; customerIds?: string[]; scheduledAt?: string; draftId?: string; segments?: string[]; translations?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 }) }

  const { kind, subject, bodyHtml, blocks, scheduledAt } = body
  const businessId = typeof body.businessId === 'string' && /^\d+$/.test(body.businessId) ? Number(body.businessId) : body.businessId
  const plain = bodyHtml?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
  if (!kind || !businessId || !subject?.trim() || !plain) return NextResponse.json({ error: 'Tárgy és szöveg megadása kötelező' }, { status: 400 })

  const payload = await getPayloadClient()
  const denied = await assertCapability(user.id, kind, businessId, 'marketing.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  // címzettek: a kézzel kijelölt vendégek, különben a szegmensek (Kinek megy) — `null` = minden feliratkozott
  const segs = parseSegments(body.segments)
  const picked = Array.isArray(body.customerIds) && body.customerIds.length ? body.customerIds.map(String) : null
  const customerIds = picked ?? (await resolveSegmentIds(payload, kind, businessId, segs))
  if (customerIds && !customerIds.length) return NextResponse.json({ error: 'A kiválasztott csoportban nincs feliratkozott vendég.' }, { status: 400 })
  const audience = picked ? null : segs.join(',')
  const translations = parseTranslations(body.translations)

  // a piszkozat (ha abból küldjük) csak a SAJÁT, még nem kiküldött rekord lehet
  let draftId: string | number | undefined
  if (body.draftId) {
    const d = await payload.findByID({ collection: 'marketing-campaigns', id: body.draftId, depth: 0, overrideAccess: true }).catch(() => null)
    const owner = d ? (kind === 'salon' ? d.salon : d.restaurant) : null
    const ownerId = owner && typeof owner === 'object' ? owner.id : owner
    if (!d || d.status === 'sent' || String(ownerId) !== String(businessId)) return NextResponse.json({ error: 'A piszkozat nem található' }, { status: 404 })
    draftId = d.id
  }

  // ── ütemezés ──
  if (scheduledAt) {
    const at = new Date(scheduledAt)
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) return NextResponse.json({ error: 'Az ütemezett időpont legyen a jövőben.' }, { status: 400 })
    const aud = await marketingAudience(payload, kind, businessId, customerIds)
    if (!aud) return NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 })
    if (!aud.recipients.length) return NextResponse.json({ error: 'Nincs feliratkozott vendég, akinek küldeni lehetne.' }, { status: 400 })
    const data = {
      ...(kind === 'salon' ? { salon: businessId as number } : { restaurant: businessId as number }),
      subject: subject.trim(), body_text: plain, body_html: bodyHtml, blocks_json: blocks ?? [], status: 'scheduled' as const, scheduled_at: at.toISOString(),
      recipient_count: aud.recipients.length, package: resolveTier(aud.business.tier), target_customer_ids: customerIds && customerIds.length ? customerIds : null, audience, translations,
    }
    // a piszkozatból ütemezve ugyanaz a rekord lesz ütemezett (nem marad mellette egy piszkozat)
    const doc = draftId
      ? await payload.update({ collection: 'marketing-campaigns', id: draftId, data, overrideAccess: true }).catch(() => null)
      : null
    const saved = doc ?? (await payload.create({ collection: 'marketing-campaigns', data, overrideAccess: true }))
    return NextResponse.json({ ok: true, scheduled: true, id: saved.id, scheduledAt: at.toISOString() })
  }

  const r = await dispatchCampaign(payload, { kind, businessId, subject, bodyHtml: bodyHtml!, blocks, customerIds, audience, translations, campaignId: draftId })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, sent: r.sent, id: r.campaignId })
}
