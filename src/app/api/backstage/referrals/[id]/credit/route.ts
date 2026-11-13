import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { retryReferrerCredit } from '@/lib/referrals'

/** POST /api/backstage/referrals/[id]/credit — elakadt ajánlói +1 hónap kézi pótlása (Backstage › Ajánlások). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = Number((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const ok = await retryReferrerCredit(await getPayloadClient(), id)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'credit_failed' }, { status: 409 })
}
