import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

/**
 * Fallback subId-alapú módosítás, csak árva előfizetéshez (nincs owner, tehát az
 * owner-alapú /api/backstage/accounts/[ownerId] nem használható). A normál útvonal
 * az accounts route — lásd SubscriptionStatusSelect.tsx.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subId } = await params
  const data = await req.json()

  const payload = await getPayloadClient()

  // Lásd /api/backstage/accounts/[ownerId] azonos megjegyzését: admin-manuális próbaidő-
  // állítás MOSTANTÓL számoljon, ne egy régi/lejárt trial_ends_at-ból.
  if (data.status === 'trialing') {
    const pricing = await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true })
    const trialDays = (pricing as { trial_days?: number }).trial_days ?? 14
    data.trial_ends_at = new Date(Date.now() + trialDays * 86_400_000).toISOString()
  }

  await payload.update({
    collection: 'subscriptions',
    id: subId,
    data,
    overrideAccess: true,
    user,
  })

  return NextResponse.json({ ok: true })
}
