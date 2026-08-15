import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'
import { syncAccountSubscription } from '@/lib/accountSubscription'

const VALID_PACKAGES = new Set(['none', 'ingyenes', 'alap', 'premium'])

/**
 * A hírlevél-csomag váltása (Nincs/Alap/Prémium) — owner-hitelesített, a `voucher-types`
 * route mintáját követve. A csomag FIZETŐS, ezért a mentés után explicit meghívjuk a
 * `syncAccountSubscription`-t (a `/api/subscription/select` route mintájához hasonlóan) —
 * a Salon/Restaurant `afterChange` hook ezt csak `create`-nél hívja, sima update-nél nem.
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: { kind?: 'salon' | 'restaurant'; businessId?: string | number; package?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const { kind, businessId, package: pkg } = body
  if (!kind || !businessId || !pkg || !VALID_PACKAGES.has(pkg)) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const owns = kind === 'salon' ? await ownsThisSalon(payload, user, businessId) : await ownsThisRestaurant(payload, user, businessId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const doc = await payload.update({
      collection: kind === 'salon' ? 'salons' : 'restaurants',
      id: businessId,
      data: { newsletter_settings: { package: pkg } },
      overrideAccess: true,
    })
    // A csomagváltás azonnal módosítja a fiók havidíját — a TÉNYLEGES üzlet-tulajdonost
    // szinkronizáljuk (nem a hívó usert, mert admin is módosíthatja mások üzletét).
    const ownerId = doc.owner && typeof doc.owner === 'object' ? doc.owner.id : doc.owner
    if (ownerId != null) await syncAccountSubscription({ payload }, ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/marketing/package POST]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
