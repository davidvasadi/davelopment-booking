import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'
import { parseSegments, resolveSegmentIds } from '@/lib/marketingSegments'

/** A „Kinek megy” címzett-száma a kiválasztott szegmensekre (design 13.4) — a szerkesztő élőben kérdezi. */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const sp = request.nextUrl.searchParams
  const kind = sp.get('kind')
  const raw = sp.get('businessId')
  if ((kind !== 'salon' && kind !== 'restaurant') || !raw) return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  const businessId = /^\d+$/.test(raw) ? Number(raw) : raw
  const denied = await assertCapability(user.id, kind, businessId, 'marketing.view')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const payload = await getPayloadClient()
  const ids = await resolveSegmentIds(payload, kind, businessId, parseSegments(sp.get('segments')))
  if (ids) return NextResponse.json({ count: ids.length })
  const all = await payload.find({ collection: 'customers', where: { and: [{ [kind]: { equals: businessId } }, { marketing_consent: { equals: true } }, { customer_email: { exists: true } }] }, limit: 0, depth: 0, overrideAccess: true })
  return NextResponse.json({ count: all.totalDocs })
}
