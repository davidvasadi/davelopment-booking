import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { loadInvoicePdf } from '@/lib/invoicePdf'
import { makeZip } from '@/lib/zip'

export const dynamic = 'force-dynamic'

/**
 * GET /api/invoicing/zip?kind=&id=&refs=v-1,b-2,… — a kijelölt számlák PDF-jei egy ZIP-ben (Beállítások › Számlák,
 * „Kijelöltek letöltése”). Legfeljebb 50 egyszerre; ami nem kérhető le, kimarad (a ZIP-ben egy hibalista jelzi).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const kind = sp.get('kind') === 'restaurant' ? 'restaurant' : 'salon'
  const id = sp.get('id')
  const refs = (sp.get('refs') ?? '').split(',').map((x) => x.trim()).filter((x) => /^[vb]-[\w-]+$/.test(x)).slice(0, 50)
  if (!id || refs.length === 0) return NextResponse.json({ error: 'Hiányzó paraméter' }, { status: 400 })
  let denied = await assertCapability(user.id, kind, id, 'payments.manage')
  if (denied) denied = await assertCapability(user.id, kind, id, 'settings.profile')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const files: { name: string; data: Uint8Array }[] = []
  const failed: string[] = []
  for (const ref of refs) {
    const r = await loadInvoicePdf(payload, kind, id, ref)
    if (!r.ok) { failed.push(`${ref}: ${r.error}`); continue }
    if (r.pdf) { files.push({ name: `${r.number}.pdf`, data: r.pdf }); continue }
    try {
      const res = await fetch(r.url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(String(res.status))
      files.push({ name: `${r.number}.pdf`, data: new Uint8Array(await res.arrayBuffer()) })
    } catch { failed.push(`${r.number}: a PDF nem tölthető le`) }
  }
  if (failed.length) files.push({ name: 'hibak.txt', data: new TextEncoder().encode(`Ezek a számlák nem kerültek bele:\n${failed.join('\n')}\n`) })
  if (files.length === 0) return NextResponse.json({ error: 'Egyik számla sem tölthető le.' }, { status: 404 })
  const zip = makeZip(files)
  return new NextResponse(zip as unknown as BodyInit, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="szamlak-${new Date().toISOString().slice(0, 10)}.zip"`, 'Cache-Control': 'no-store' },
  })
}
