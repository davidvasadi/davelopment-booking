import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Invoice, Subscription } from '@/payload/payload-types'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get('id')
  if (!invoiceId) return NextResponse.json({ error: 'Hiányzó id' }, { status: 400 })

  const payload = await getPayloadClient()

  const inv = await payload.findByID({ collection: 'invoices', id: invoiceId, depth: 1, overrideAccess: true }).catch(() => null) as Invoice | null
  if (!inv) return NextResponse.json({ error: 'Számla nem található' }, { status: 404 })

  const sub = typeof inv.subscription === 'object' ? inv.subscription as Subscription : null
  const ownerId = sub ? (typeof sub.owner === 'object' && sub.owner ? (sub.owner as { id: string | number }).id : sub.owner) : null
  if (String(ownerId) !== String(user.id) && user.role !== 'admin') {
    return NextResponse.json({ error: 'Nincs jogosultságod' }, { status: 403 })
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URI })
  try {
    const { rows } = await pool.query<{ pdf_base64: string | null }>(
      'SELECT pdf_base64 FROM invoice_pdfs WHERE invoice_id = $1',
      [invoiceId]
    )
    const pdfBase64 = rows[0]?.pdf_base64
    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF nem elérhető (régi számla)' }, { status: 404 })
    }
    const pdf = Buffer.from(pdfBase64, 'base64')
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${inv.invoice_number}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } finally {
    await pool.end()
  }
}
