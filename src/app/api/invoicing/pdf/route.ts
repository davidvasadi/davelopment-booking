import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { decrypt } from '@/lib/encryption'
import { fetchInvoicePdf } from '@/lib/szamlazz'
import type { Salon, Restaurant } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/invoicing/pdf?kind=&id=&ref=v-<voucherId>|b-<bookingId>[&download=1] — egy vendégnek
 * kiállított számla PDF-je. Ha a rekordon van tárolt PDF-link (pl. Billingo), oda irányít; különben
 * az üzlet SAJÁT Számlázz.hu fiókjából kéri le számlaszám alapján. Alapból inline (előnézet).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const kind = sp.get('kind') === 'restaurant' ? 'restaurant' : 'salon'
  const id = sp.get('id')
  const ref = sp.get('ref') ?? ''
  if (!id || !/^[vb]-.+$/.test(ref)) return NextResponse.json({ error: 'Hiányzó paraméter' }, { status: 400 })
  let denied = await assertCapability(user.id, kind, id, 'payments.manage')
  if (denied) denied = await assertCapability(user.id, kind, id, 'settings.profile')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const recId = ref.slice(2)
  const collection = ref.startsWith('v-') ? 'gift-vouchers' : kind === 'salon' ? 'bookings' : 'reservations'
  const rec = (await payload.findByID({ collection, id: recId, depth: 0, overrideAccess: true }).catch(() => null)) as
    | { salon?: unknown; restaurant?: unknown; invoice_number?: string | null; invoice_pdf_url?: string | null }
    | null
  const owner = rec ? (kind === 'salon' ? rec.salon : rec.restaurant) : null
  const ownerId = owner && typeof owner === 'object' ? (owner as { id: unknown }).id : owner
  if (!rec || String(ownerId) !== String(id)) return NextResponse.json({ error: 'Számla nem található' }, { status: 404 })
  if (rec.invoice_pdf_url) return NextResponse.redirect(rec.invoice_pdf_url)
  if (!rec.invoice_number) return NextResponse.json({ error: 'Ehhez a tételhez nem készült számla.' }, { status: 404 })

  const biz = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | Restaurant | null
  const enc = biz?.invoice_settings?.szamlazz_agent_key_enc
  if (!enc) return NextResponse.json({ error: 'A PDF a számlázó fiókodból kérhető le — nincs elmentett Számlázz.hu-kulcs.' }, { status: 404 })
  let key = ''
  try { key = decrypt(enc) } catch { return NextResponse.json({ error: 'A Számlázz.hu-kulcs nem olvasható.' }, { status: 500 }) }
  const r = await fetchInvoicePdf(key, rec.invoice_number)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${sp.get('download') ? 'attachment' : 'inline'}; filename="${rec.invoice_number}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
