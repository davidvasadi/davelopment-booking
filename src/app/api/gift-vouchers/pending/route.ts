import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getPayloadClient } from '@/lib/payload'
import { getStripe } from '@/lib/stripe'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'
import { ensureVoucherFromPaymentIntent } from '@/lib/voucherFromIntent'
import type { Salon, Restaurant } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

export type PendingVoucher = {
  sessionId: string
  url: string | null
  amountHuf: number
  typeName: string | null
  purchaserName: string | null
  purchaserEmail: string | null
  issuedByName: string | null
  createdAt: string
  expiresAt: string
}

/** Az üzlet (Connect-fiók) és a jogosultság feloldása — GET: megtekintés, DELETE: kezelés. */
async function resolve(req: NextRequest, manage: boolean) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return { error: user }
  const sp = req.nextUrl.searchParams
  const kind = sp.get('kind') === 'restaurant' ? 'restaurant' : 'salon'
  const id = sp.get('id')
  if (!id) return { error: NextResponse.json({ error: 'Hiányzó azonosító' }, { status: 400 }) }
  const view = manage ? null : await assertCapability(user.id, kind, id, 'vouchers.view')
  const denied = view || manage ? await assertCapability(user.id, kind, id, 'vouchers.manage') : null
  if (denied) return { error: NextResponse.json({ error: denied.error }, { status: denied.status }) }
  const payload = await getPayloadClient()
  const biz = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | Restaurant | null
  if (!biz) return { error: NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 }) }
  return { payload, biz, kind, id, stripe: getStripe(), account: biz.stripe_connect_account_id ?? null }
}

/** Fizetési-linkes utalvány-sessionök azonosítása: új linkeknél a session metadata, régieknél a PaymentIntenté. */
function voucherMeta(s: Stripe.Checkout.Session): Record<string, string> | null {
  if (s.metadata?.kind === 'gift-voucher') return s.metadata as Record<string, string>
  const pi = typeof s.payment_intent === 'object' ? s.payment_intent : null
  if (pi?.metadata?.kind === 'gift-voucher') return pi.metadata as Record<string, string>
  return null
}

/**
 * GET /api/gift-vouchers/pending?kind=&id= — a még ki nem fizetett (nyitott) fizetési linkek az
 * Utalványok listához, ÉS egyben szinkron: a már kifizetett, de utalvánnyá még nem vált sessionökből
 * létrehozza az utalványt (ha a webhook nem érkezett meg / a kiállító ablak be volt zárva).
 */
export async function GET(req: NextRequest) {
  const r = await resolve(req, false)
  if ('error' in r) return r.error
  const { payload, biz, kind, stripe, account } = r
  if (!stripe || !account) return NextResponse.json({ pending: [], reconciled: 0 })

  const since = Math.floor(Date.now() / 1000) - 30 * 86400
  const list = await stripe.checkout.sessions
    .list({ created: { gte: since }, limit: 100, expand: ['data.payment_intent'] }, { stripeAccount: account })
    .catch((e) => { console.error('[vouchers/pending] Stripe lista hiba:', e); return null })
  if (!list) return NextResponse.json({ pending: [], reconciled: 0, error: 'A Stripe most nem érhető el.' })

  const bizKey = kind === 'salon' ? 'salonId' : 'restaurantId'
  const mine = list.data.filter((s) => { const md = voucherMeta(s); return md && String(md[bizKey] ?? '') === String(biz.id) })

  // kifizetett → utalvány biztosítása
  let reconciled = 0
  for (const s of mine.filter((x) => x.status === 'complete')) {
    const pi = typeof s.payment_intent === 'object' ? s.payment_intent : null
    if (!pi || pi.status !== 'succeeded') continue
    const before = await payload.find({ collection: 'gift-vouchers', where: { payment_intent_id: { equals: pi.id } }, limit: 1, depth: 0, overrideAccess: true })
    if (before.totalDocs > 0) continue
    const made = await ensureVoucherFromPaymentIntent(payload, pi).catch((e) => { console.error('[vouchers/pending] létrehozás hiba:', e); return null })
    if (made) reconciled++
  }

  const open = mine.filter((s) => s.status === 'open')
  const issuerIds = Array.from(new Set(open.map((s) => voucherMeta(s)?.issuedBy).filter(Boolean))) as string[]
  const users = issuerIds.length
    ? await payload.find({ collection: 'users', where: { id: { in: issuerIds } }, limit: issuerIds.length, depth: 0, overrideAccess: true })
    : { docs: [] }
  const nameOf = new Map((users.docs as { id: string | number; name?: string | null; email?: string | null }[]).map((u) => [String(u.id), u.name || u.email || null]))

  const pending: PendingVoucher[] = open.map((s) => {
    const md = voucherMeta(s) ?? {}
    return {
      sessionId: s.id,
      url: s.url,
      amountHuf: Math.round((s.amount_total ?? 0) / 100),
      typeName: md.typeName || null,
      purchaserName: md.purchaserName || null,
      purchaserEmail: md.purchaserEmail || s.customer_email || null,
      issuedByName: md.issuedBy ? nameOf.get(md.issuedBy) ?? null : null,
      createdAt: new Date(s.created * 1000).toISOString(),
      expiresAt: new Date(s.expires_at * 1000).toISOString(),
    }
  })
  return NextResponse.json({ pending, reconciled })
}

/** DELETE /api/gift-vouchers/pending?kind=&id=&sessionId= — a fizetési link visszavonása (Stripe: expire). */
export async function DELETE(req: NextRequest) {
  const r = await resolve(req, true)
  if ('error' in r) return r.error
  const { biz, kind, stripe, account } = r
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'Hiányzó sessionId' }, { status: 400 })
  if (!stripe || !account) return NextResponse.json({ error: 'A fizetés nincs konfigurálva.' }, { status: 503 })
  const s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }, { stripeAccount: account }).catch(() => null)
  const md = s ? voucherMeta(s) : null
  if (!s || !md || String(md[kind === 'salon' ? 'salonId' : 'restaurantId'] ?? '') !== String(biz.id)) {
    return NextResponse.json({ error: 'A link nem található' }, { status: 404 })
  }
  if (s.status === 'complete') return NextResponse.json({ error: 'Ezt a linket már kifizették — az utalvány a listában van.' }, { status: 409 })
  if (s.status === 'open') {
    try { await stripe.checkout.sessions.expire(sessionId, {}, { stripeAccount: account }) } catch (e) {
      console.error('[vouchers/pending] expire hiba:', e)
      return NextResponse.json({ error: 'A link visszavonása nem sikerült.' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
