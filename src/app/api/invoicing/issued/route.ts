import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'

export const dynamic = 'force-dynamic'

export type IssuedInvoice = {
  id: string
  type: 'deposit' | 'voucher'
  /** pontosítás: előleg / utalvány – foglalóoldal, fizetési link, helyszíni */
  source: string
  customer: string
  email: string | null
  amountHuf: number
  date: string
  number: string | null
  status: 'issued' | 'failed' | 'skipped'
  pdf: string | null
}

const VOUCHER_SOURCE: Record<string, string> = {
  online: 'Utalvány · foglalóoldal',
  payment_link: 'Utalvány · fizetési link',
  cash: 'Utalvány · helyszín (készpénz)',
  pos_card: 'Utalvány · helyszín (bankkártya)',
  transfer: 'Utalvány · helyszín (átutalás)',
}

/**
 * GET /api/invoicing/issued?kind=&id= — a VENDÉGEKNEK kiállított számlák (az üzlet saját
 * Számlázz.hu/Billingo fiókjából): előleg (foglalás/asztalfoglalás) + ajándékutalvány. A
 * Beállítások → Fizetés & számlázás oldal listája. Szűrés/keresés a kliensen.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const kind = req.nextUrl.searchParams.get('kind') === 'restaurant' ? 'restaurant' : 'salon'
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Hiányzó azonosító' }, { status: 400 })
  let denied = await assertCapability(user.id, kind, id, 'payments.manage')
  if (denied) denied = await assertCapability(user.id, kind, id, 'settings.profile')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const [vouchers, deposits] = await Promise.all([
    payload.find({
      collection: 'gift-vouchers',
      where: { and: [{ [kind]: { equals: id } }, { invoice_status: { in: ['issued', 'failed', 'skipped'] } }] } as never,
      sort: '-createdAt', limit: 300, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: kind === 'salon' ? 'bookings' : 'reservations',
      where: { and: [{ [kind]: { equals: id } }, { invoice_status: { in: ['issued', 'failed'] } }] } as never,
      sort: '-createdAt', limit: 300, depth: 0, overrideAccess: true,
    }),
  ])

  type V = { id: string | number; code: string; amount_huf: number; purchaser_name: string; purchaser_email: string; payment_method?: string | null; invoice_status: 'issued' | 'failed' | 'skipped'; invoice_number?: string | null; invoice_pdf_url?: string | null; createdAt: string }
  type B = { id: string | number; customer_name: string; customer_email?: string | null; deposit_amount_huf?: number | null; date?: string; invoice_status: 'issued' | 'failed'; invoice_number?: string | null; invoice_pdf_url?: string | null; createdAt: string }

  const rows: IssuedInvoice[] = [
    ...(vouchers.docs as unknown as V[]).map((v) => ({
      id: `v-${v.id}`,
      type: 'voucher' as const,
      source: `${VOUCHER_SOURCE[v.payment_method ?? ''] ?? 'Utalvány'} · ${v.code}`,
      customer: v.purchaser_name,
      email: v.purchaser_email ?? null,
      amountHuf: v.amount_huf,
      date: v.createdAt,
      number: v.invoice_number ?? null,
      status: v.invoice_status,
      pdf: v.invoice_pdf_url ?? null,
    })),
    ...(deposits.docs as unknown as B[]).map((b) => ({
      id: `b-${b.id}`,
      type: 'deposit' as const,
      source: `Előleg · ${kind === 'salon' ? 'foglalás' : 'asztalfoglalás'}${b.date ? ` ${new Date(b.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}` : ''}`,
      customer: b.customer_name,
      email: b.customer_email ?? null,
      amountHuf: b.deposit_amount_huf ?? 0,
      date: b.createdAt,
      number: b.invoice_number ?? null,
      status: b.invoice_status,
      pdf: b.invoice_pdf_url ?? null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ rows })
}
