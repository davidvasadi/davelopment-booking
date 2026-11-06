import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'

export const dynamic = 'force-dynamic'

export type IssuedInvoice = {
  id: string
  type: 'deposit' | 'voucher' | 'service'
  /** pontosítás: előleg / utalvány – foglalóoldal, fizetési link, helyszíni */
  source: string
  customer: string
  email: string | null
  amountHuf: number
  date: string
  number: string | null
  status: 'issued' | 'failed' | 'skipped' | 'storno' | 'register' | 'manual'
  /** hogyan fizettek (helyszíni fizetésnél) */
  pay?: string | null
  pdf: string | null
  /** sztornózott számlánál a sztornó számla száma */
  storno: string | null
  /** ki állította ki — szakemberenkénti számlázásnál a foglalás szakembere, az utalványnál az üzlet; különben null */
  issuer?: string | null
}

const PAY: Record<string, string> = { cash: 'Készpénz · helyszínen', card: 'Bankkártya · helyszínen', transfer: 'Átutalás', link: 'Fizetési link' }
const firstLine = (v: unknown) => (Array.isArray(v) && v[0] && typeof (v[0] as { name?: unknown }).name === 'string' ? String((v[0] as { name: string }).name) : 'helyszíni fizetés')

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
  const [vouchers, deposits, onsite] = await Promise.all([
    payload.find({
      collection: 'gift-vouchers',
      where: { and: [{ [kind]: { equals: id } }, { invoice_status: { in: ['issued', 'failed', 'skipped', 'storno'] } }] } as never,
      sort: '-createdAt', limit: 300, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: kind === 'salon' ? 'bookings' : 'reservations',
      where: { and: [{ [kind]: { equals: id } }, { invoice_status: { in: ['issued', 'failed', 'storno'] } }] } as never,
      sort: '-createdAt', limit: 300, depth: 0, overrideAccess: true,
    }),
    // helyszíni fizetések számla nélkül (pénztárgép / nem kért / végszámla kézzel) — a számlázottak fent, az invoice_status-szal jönnek
    kind === 'salon' ? payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: id } }, { paid_at: { exists: true } }, { pay_receipt: { in: ['register', 'none', 'manual'] } }] } as never,
      sort: '-paid_at', limit: 300, depth: 0, overrideAccess: true,
    }) : Promise.resolve({ docs: [] as unknown[] }),
  ])

  type V = { id: string | number; code: string; amount_huf: number; purchaser_name: string; purchaser_email: string; payment_method?: string | null; invoice_status: 'issued' | 'failed' | 'skipped' | 'storno'; invoice_number?: string | null; invoice_pdf_url?: string | null; invoice_storno_number?: string | null; createdAt: string }
  type B = { id: string | number; staff?: unknown; paid_at?: string | null; paid_amount_huf?: number | null; pay_method?: string | null; pay_receipt?: string | null; paid_lines?: unknown; customer_name: string; customer_email?: string | null; deposit_amount_huf?: number | null; date?: string; invoice_status: 'issued' | 'failed' | 'storno'; invoice_number?: string | null; invoice_pdf_url?: string | null; invoice_storno_number?: string | null; createdAt: string }

  // szakemberenkénti számlázásnál a „Kiállító” oszlop: a foglalás szakembere (az utalvány az üzleté)
  let staffNames: Record<string, string> | null = null
  if (kind === 'salon') {
    const sal = (await payload.findByID({ collection: 'salons', id, depth: 0, overrideAccess: true }).catch(() => null)) as { name?: string; invoice_settings?: { issuer?: string | null } | null } | null
    if (sal?.invoice_settings?.issuer === 'staff') {
      const st = await payload.find({ collection: 'staff', where: { salon: { equals: id } }, limit: 500, depth: 0, overrideAccess: true })
      staffNames = Object.fromEntries((st.docs as { id: string | number; name: string }[]).map((m) => [String(m.id), m.name]))
      staffNames.__biz = sal.name ?? 'Az üzlet'
    }
  }
  const staffName = (v: unknown) => (staffNames && v != null ? staffNames[String(typeof v === 'object' ? (v as { id: unknown }).id : v)] ?? null : null)

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
      storno: v.invoice_storno_number ?? null,
      issuer: staffNames ? staffNames.__biz : null,
    })),
    ...(deposits.docs as unknown as B[]).map((b) => {
      // előleg nélküli, helyben fizetett foglalás számlája: szolgáltatás (a helyben fizetett összeg)
      const service = !!b.paid_at && !(b.deposit_amount_huf ?? 0)
      return {
      id: `b-${b.id}`,
      type: service ? 'service' as const : 'deposit' as const,
      source: service ? `Szolgáltatás · ${firstLine(b.paid_lines)}` : `Előleg · ${kind === 'salon' ? 'foglalás' : 'asztalfoglalás'}${b.date ? ` ${new Date(b.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}` : ''}`,
      customer: b.customer_name,
      email: b.customer_email ?? null,
      amountHuf: service ? Number(b.paid_amount_huf ?? 0) : b.deposit_amount_huf ?? 0,
      pay: service ? PAY[b.pay_method ?? ''] ?? null : 'Online kártya',
      date: b.createdAt,
      number: b.invoice_number ?? null,
      status: b.invoice_status,
      pdf: b.invoice_pdf_url ?? null,
      storno: b.invoice_storno_number ?? null,
      issuer: staffName(b.staff),
    }}),
    ...(onsite.docs as unknown as B[]).map((b) => ({
      id: `p-${b.id}`,
      type: 'service' as const,
      source: `Szolgáltatás · ${firstLine(b.paid_lines)}`,
      customer: b.customer_name,
      email: b.customer_email ?? null,
      amountHuf: Number(b.paid_amount_huf ?? 0),
      date: b.paid_at ?? b.createdAt,
      number: null,
      status: (b.pay_receipt === 'register' ? 'register' : b.pay_receipt === 'manual' ? 'manual' : 'skipped') as IssuedInvoice['status'],
      pay: PAY[b.pay_method ?? ''] ?? null,
      pdf: null,
      storno: null,
      issuer: staffName(b.staff),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ rows })
}
