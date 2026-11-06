import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { decrypt } from '@/lib/encryption'
import { stornoInvoice } from '@/lib/szamlazz'
import { cancelInvoice } from '@/lib/billingo'
import { invoiceSettingsForRecord } from '@/lib/payee'
import type { Salon, Restaurant } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/invoicing/storno { kind, id, refs: ['v-…' | 'b-…'] } — a kijelölt (kiállított) számlák sztornózása az üzlet
 * SAJÁT számlázójában (Számlázz.hu Agent / Billingo API): ellenszámla, nálunk „Sztornózva” + a sztornó számla száma.
 * Végleges, nem vonható vissza (a felület megerősítést kér). Legfeljebb 20 egyszerre; tételenként az eredmény.
 */
const schema = z.object({ kind: z.enum(['salon', 'restaurant']), id: z.coerce.string(), refs: z.array(z.string().regex(/^[vb]-[\w-]+$/)).min(1).max(20) })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen kérés' }, { status: 400 })
  const { kind, id, refs } = parsed.data
  const denied = await assertCapability(user.id, kind, id, 'payments.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const biz = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | Restaurant | null
  if (!biz) return NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 })

  const results: { ref: string; ok: boolean; number?: string; error?: string }[] = []
  for (const ref of refs) {
    const collection = ref.startsWith('v-') ? 'gift-vouchers' : kind === 'salon' ? 'bookings' : 'reservations'
    const rec = (await payload.findByID({ collection, id: ref.slice(2), depth: 0, overrideAccess: true }).catch(() => null)) as
      | { id: string | number; salon?: unknown; restaurant?: unknown; staff?: unknown; invoice_status?: string | null; invoice_number?: string | null; customer_email?: string | null; purchaser_email?: string | null } | null
    const owner = rec ? (kind === 'salon' ? rec.salon : rec.restaurant) : null
    const ownerId = owner && typeof owner === 'object' ? (owner as { id: unknown }).id : owner
    if (!rec || String(ownerId) !== String(id)) { results.push({ ref, ok: false, error: 'Nem található' }); continue }
    if (rec.invoice_status !== 'issued' || !rec.invoice_number) { results.push({ ref, ok: false, error: 'Csak kiállított számla sztornózható' }); continue }
    // melyik számlázóból ment (szakemberenkénti számlázásnál a szakemberéből — lib/payee)
    const inv = await invoiceSettingsForRecord(payload, biz, collection, rec)
    const provider = inv?.invoice_provider === 'billingo' ? 'billingo' : 'szamlazz'
    const enc = provider === 'billingo' ? inv?.billingo_api_key_enc : inv?.szamlazz_agent_key_enc
    if (!enc) { results.push({ ref, ok: false, error: 'Nincs elmentett számlázó-kulcs' }); continue }
    let key = ''
    try { key = decrypt(enc) } catch { results.push({ ref, ok: false, error: 'A számlázó-kulcs nem olvasható' }); continue }
    const r = provider === 'billingo'
      ? await cancelInvoice(key, rec.invoice_number)
      : await stornoInvoice(key, rec.invoice_number, rec.customer_email ?? rec.purchaser_email ?? null)
    if (!r.ok) { results.push({ ref, ok: false, error: r.error }); continue }
    await payload.update({ collection, id: rec.id, data: { invoice_status: 'storno', invoice_storno_number: r.number || null } as never, overrideAccess: true, context: { auditActor: user.name ?? user.email } })
    results.push({ ref, ok: true, number: r.number })
  }
  return NextResponse.json({ results })
}
