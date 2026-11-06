import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { loadInvoicePdf } from '@/lib/invoicePdf'

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

  const r = await loadInvoicePdf(await getPayloadClient(), kind, id, ref)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  if (r.url) return NextResponse.redirect(r.url)
  return new NextResponse(r.pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${sp.get('download') ? 'attachment' : 'inline'}; filename="${r.number}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
