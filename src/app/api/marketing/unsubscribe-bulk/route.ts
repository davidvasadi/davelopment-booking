import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'

/**
 * Tömeges leiratkoztatás a hírlevél dashboard-listából — owner-hitelesített, a
 * `marketing/package` route mintáját követve. A `where` egyszerre szűr id-listára ÉS a
 * hívó üzletére, hogy más üzlet vendégét ne lehessen véletlenül leiratkoztatni.
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: { kind?: 'salon' | 'restaurant'; businessId?: string | number; customerIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const { kind, businessId, customerIds } = body
  if (!kind || !businessId || !Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const owns = kind === 'salon' ? await ownsThisSalon(payload, user, businessId) : await ownsThisRestaurant(payload, user, businessId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const result = await payload.update({
      collection: 'customers',
      where: {
        and: [
          { id: { in: customerIds } },
          kind === 'salon' ? { salon: { equals: businessId } } : { restaurant: { equals: businessId } },
        ],
      },
      data: { marketing_consent: false },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, count: result.docs?.length ?? 0 })
  } catch (e) {
    console.error('[api/marketing/unsubscribe-bulk POST]', e)
    return NextResponse.json({ error: 'Leiratkoztatás sikertelen' }, { status: 500 })
  }
}
