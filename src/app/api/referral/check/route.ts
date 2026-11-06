import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { resolveCode } from '@/lib/referrals'
import { clientIp, rateLimit } from '@/lib/rateLimit'

/** GET /api/referral/check?code=ANNA — a regisztráció ajánló-mezője: érvényes-e, és ki ajánlotta (az üzlet neve). */
export async function GET(req: NextRequest) {
  const rl = rateLimit(`ref-check:${clientIp(req.headers)}`, 60, 15 * 60_000)
  if (!rl.allowed) return NextResponse.json({ valid: false }, { status: 429 })
  const ref = await resolveCode(await getPayloadClient(), req.nextUrl.searchParams.get('code')).catch(() => null)
  return NextResponse.json(ref ? { valid: true, code: ref.code, by: ref.by } : { valid: false })
}
