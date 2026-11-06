import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { referralSummary } from '@/lib/referrals'

/** GET /api/referral — a tulaj ajánló-kártyája (Partnerprogram, Beállítások › Telephelyek): a kód, a megnyitások, kiket hozott. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'salon_owner' && user.role !== 'restaurant_owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const data = await referralSummary(await getPayloadClient(), user.id, user.name)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
