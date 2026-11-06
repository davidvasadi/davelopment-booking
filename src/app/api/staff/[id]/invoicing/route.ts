import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { encrypt } from '@/lib/encryption'
import { vatFromTaxNumber } from '@/lib/vatFromTaxNumber'
import type { StaffMember } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * A szakember saját számlázása (szakemberenkénti számlázás — design 10.4 „Saját számlázás”): a számlázója
 * (Számlázz.hu / Billingo + kulcs, titkosítva — sosem megy vissza a kliensre), az adószáma (belőle az ÁFA), és a
 * saját Stripe-fiókja állapota (a bekötés: /api/stripe/connect/staff). Olvashatja / írhatja maga a szakember és aki
 * az üzletben `staff.manage` vagy `payments.manage` jogú.
 */
async function load(id: string) {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const payload = await getPayloadClient()
  const staff = (await payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true }).catch(() => null)) as StaffMember | null
  if (!staff) return { error: NextResponse.json({ error: 'A munkatárs nem található' }, { status: 404 }) }
  const salonId = staff.salon ? (typeof staff.salon === 'object' ? staff.salon.id : staff.salon) : null
  const self = staff.user != null && String(typeof staff.user === 'object' ? staff.user.id : staff.user) === String(user.id)
  if (!self) {
    const a = await assertCapability(user.id, 'salon', salonId, 'staff.manage')
    const b = a ? await assertCapability(user.id, 'salon', salonId, 'payments.manage') : null
    if (a && b) return { error: NextResponse.json({ error: b.error }, { status: b.status }) }
  }
  return { payload, staff }
}

const view = (s: StaffMember) => ({
  provider: (s.invoice_provider ?? 'none') as 'szamlazz' | 'billingo' | 'none',
  hasKey: s.invoice_provider === 'szamlazz' ? !!s.szamlazz_agent_key_enc : s.invoice_provider === 'billingo' ? !!s.billingo_api_key_enc : false,
  taxNumber: s.tax_number ?? '',
  vat: vatFromTaxNumber(s.tax_number)?.label ?? null,
  stripe: s.stripe_connect_onboarded && s.stripe_connect_account_id ? 'ok' : s.stripe_connect_account_id ? 'pending' : 'none',
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await load((await params).id)
  if ('error' in r) return r.error
  return NextResponse.json(view(r.staff))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await load((await params).id)
  if ('error' in r) return r.error
  const body = (await req.json().catch(() => ({}))) as { provider?: string; key?: string; taxNumber?: string }
  const data: Record<string, unknown> = {}
  if (body.provider === 'szamlazz' || body.provider === 'billingo' || body.provider === 'none') data.invoice_provider = body.provider
  const provider = (data.invoice_provider as string | undefined) ?? r.staff.invoice_provider
  if (typeof body.key === 'string' && body.key.trim()) {
    if (provider === 'szamlazz') data.szamlazz_agent_key_enc = encrypt(body.key.trim())
    else if (provider === 'billingo') data.billingo_api_key_enc = encrypt(body.key.trim())
  }
  if (typeof body.taxNumber === 'string') data.tax_number = body.taxNumber.trim().slice(0, 20)
  const doc = (await r.payload.update({ collection: 'staff', id: r.staff.id, overrideAccess: true, data: data as never })) as StaffMember
  return NextResponse.json(view(doc))
}
