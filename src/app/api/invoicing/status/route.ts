import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { decrypt } from '@/lib/encryption'
import type { Salon, Restaurant } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

type Recent = { kind: 'voucher' | 'booking'; label: string; number: string | null; status: 'issued' | 'failed'; pdf: string | null; at: string }
type Status = { provider: 'szamlazz' | 'billingo' | null; ok: boolean; reason?: string; detail?: string; recent?: Recent[] }

/**
 * GET /api/invoicing/status?kind=salon|restaurant&id=… — él-e az üzlet számlázó-bekötése
 * (utalvány-kiállítás előtt mutatjuk, kiáll-e majd a számla). Ellenőrzés:
 *  - van-e kiválasztott szolgáltató és elmentett, visszafejthető kulcs;
 *  - Billingo: ÉLŐ hívás a Billingo API-ra (érvényes-e a kulcs) — számla nem keletkezik;
 *  - Számlázz.hu: nincs mellékhatás-mentes kulcs-ellenőrző hívása, ezért a legutóbbi
 *    számla-kiállítás eredményét nézzük (sikertelen → jelezzük az okkal).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const kind = req.nextUrl.searchParams.get('kind') === 'restaurant' ? 'restaurant' : 'salon'
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Hiányzó azonosító' }, { status: 400 })
  // utalvány-kiállító (vouchers.manage) VAGY a Beállítások → Számlázás (payments.manage)
  // (a Számlázás fül mentése `settings.profile` jogot kér — azzal is lekérdezhető)
  let denied = await assertCapability(user.id, kind, id, 'vouchers.manage')
  if (denied) denied = await assertCapability(user.id, kind, id, 'payments.manage')
  if (denied) denied = await assertCapability(user.id, kind, id, 'settings.profile')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const withRecent = req.nextUrl.searchParams.get('recent') === '1'

  const payload = await getPayloadClient()
  const biz = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | Restaurant | null
  if (!biz) return NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 })

  const s = biz.invoice_settings
  const provider = s?.invoice_provider && s.invoice_provider !== 'none' ? s.invoice_provider : null

  // Legutóbbi kiállítások (utalvány + foglalás/asztalfoglalás) — a Beállítások kártyán listázzuk
  const where = { and: [{ [kind]: { equals: id } }, { invoice_status: { in: ['issued', 'failed'] } }] }
  const [rv, rb] = await Promise.all([
    payload.find({ collection: 'gift-vouchers', where: where as never, sort: '-updatedAt', limit: withRecent ? 5 : 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: kind === 'salon' ? 'bookings' : 'reservations', where: where as never, sort: '-updatedAt', limit: withRecent ? 5 : 1, depth: 0, overrideAccess: true }),
  ])
  type Doc = { invoice_status?: string; invoice_number?: string | null; invoice_pdf_url?: string | null; updatedAt: string; code?: string; customer_name?: string; date?: string }
  const recentAll: Recent[] = [
    ...(rv.docs as unknown as Doc[]).map((d) => ({ kind: 'voucher' as const, label: `Utalvány ${d.code ?? ''}`.trim(), number: d.invoice_number ?? null, status: d.invoice_status as 'issued' | 'failed', pdf: d.invoice_pdf_url ?? null, at: d.updatedAt })),
    ...(rb.docs as unknown as Doc[]).map((d) => ({ kind: 'booking' as const, label: `Előleg — ${d.customer_name ?? 'foglalás'}`, number: d.invoice_number ?? null, status: d.invoice_status as 'issued' | 'failed', pdf: d.invoice_pdf_url ?? null, at: d.updatedAt })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  const recent = withRecent ? recentAll.slice(0, 5) : undefined
  const out = (st: Status) => NextResponse.json({ ...st, recent })
  if (!provider) return out({ provider: null, ok: false, reason: 'Nincs bekötve számlázó, ezért nem készül számla. Beállítások → Fizetés oldalon kötheted be.' })

  const enc = provider === 'szamlazz' ? s?.szamlazz_agent_key_enc : s?.billingo_api_key_enc
  const name = provider === 'szamlazz' ? 'Számlázz.hu' : 'Billingo'
  if (!enc) return out({ provider, ok: false, reason: `${name} van kiválasztva, de nincs elmentve a ${provider === 'szamlazz' ? 'Számla Agent-kulcs' : 'API-kulcs'}.` })
  let key = ''
  try { key = decrypt(enc) } catch { return out({ provider, ok: false, reason: `A ${name}-kulcs nem olvasható — mentsd el újra a Beállításokban.` }) }
  if (!key.trim()) return out({ provider, ok: false, reason: `Üres ${name}-kulcs — mentsd el újra a Beállításokban.` })

  if (provider === 'billingo') {
    try {
      const res = await fetch('https://api.billingo.hu/v3/document-blocks', { headers: { 'X-API-KEY': key }, signal: AbortSignal.timeout(6000) })
      if (res.status === 401 || res.status === 403) return out({ provider, ok: false, reason: 'A Billingo elutasította az API-kulcsot (érvénytelen vagy visszavont kulcs).' })
      if (!res.ok) return out({ provider, ok: false, reason: `A Billingo most nem érhető el (HTTP ${res.status}).` })
    } catch {
      return out({ provider, ok: false, reason: 'A Billingo most nem érhető el (időtúllépés).' })
    }
    return out({ provider, ok: true, detail: 'Billingo bekötve' })
  }

  // Számlázz.hu: nincs mellékhatás-mentes kulcs-ellenőrzés → a legutóbbi kiállítás eredménye
  const last = recentAll[0]
  if (last?.status === 'failed') {
    return out({ provider, ok: false, reason: 'A legutóbbi Számlázz.hu-számla kiállítása sikertelen volt — ellenőrizd az Agent-kulcsot és a fiók adatait.' })
  }
  return out({ provider, ok: true, detail: 'Számlázz.hu bekötve' })
}
