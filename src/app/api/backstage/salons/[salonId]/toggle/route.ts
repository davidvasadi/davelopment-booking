import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { syncAccountSubscription } from '@/lib/accountSubscription'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ salonId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { salonId } = await params
  const body = await req.json()
  // Több mezőt kezel: a toggle gomb `is_active`-ot, a sheet jegyzet-mentése `admin_notes`-t,
  // a csomag-szerkesztő `tier`/`custom_monthly_fee_huf`-ot küld.
  const data: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') data.is_active = body.is_active
  if (typeof body.admin_notes === 'string') data.admin_notes = body.admin_notes
  if (body.tier === 'starter' || body.tier === 'pro' || body.tier === 'egyedi') data.tier = body.tier
  if (body.custom_monthly_fee_huf === null) data.custom_monthly_fee_huf = null
  else if (typeof body.custom_monthly_fee_huf === 'number' && Number.isFinite(body.custom_monthly_fee_huf) && body.custom_monthly_fee_huf >= 0) {
    data.custom_monthly_fee_huf = Math.round(body.custom_monthly_fee_huf)
  }

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'salons',
    id: salonId,
    data,
    overrideAccess: true,
    user,
  })

  // A csomag/díj-váltás azonnal módosítja a fiók havidíját — szinkronizáljuk.
  if ('tier' in data || 'custom_monthly_fee_huf' in data) {
    const doc = await payload.findByID({ collection: 'salons', id: salonId, depth: 0, overrideAccess: true })
    const ownerId = doc.owner && typeof doc.owner === 'object' ? (doc.owner as { id: unknown }).id : doc.owner
    if (ownerId != null) await syncAccountSubscription({ payload }, ownerId as string | number)
  }

  return NextResponse.json({ ok: true })
}
