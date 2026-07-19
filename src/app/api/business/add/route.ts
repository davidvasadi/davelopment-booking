/**
 * POST /api/business/add
 *
 * Több-üzlet (multi-tenant): ÚJ üzlet (szalon/étterem) hozzáadása a MÁR BEJELENTKEZETT
 * felhasználóhoz — jelszó/újraregisztráció NÉLKÜL. Body: `{ type, name, city?, phone? }`.
 *
 *  - Az üzlet a meglévő userhez kötődik (`owner = user.id`).
 *  - Az előfizetést (trial vagy egyből fizetős, ha a fiók már fizet) a Salons/Restaurants
 *    `afterChange` hookja intézi automatikusan (buildNewPlaceSubscription) — itt nem kell.
 *  - Sikeres létrehozás után az AKTÍV üzletet az újra állítjuk (cookie + redirect-cél),
 *    hogy a felhasználó egyből az új üzlet dashboardján legyen.
 *
 * Megjegyzés a role-ról: a több-üzlet modellben a NÉZETET az aktív üzlet típusa dönti el,
 * nem a user.role — ezért a role-t NEM írjuk át (egy vegyes fiók role-ja maradhat bármi).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { slugify } from '@/payload/lib/slugify'
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/activeBusiness'

export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch (err) {
    console.error('[business/add] getCurrentUser failed:', err)
    return NextResponse.json({ error: 'Auth hiba' }, { status: 500 })
  }
  if (!user) {
    console.warn('[business/add] 401 — nincs bejelentkezett user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { type?: string; name?: string; city?: string; phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const type = body.type
  const name = (body.name ?? '').trim()

  console.log(`[business/add] user=${user.id} type=${type} name="${name}"`)

  if ((type !== 'restaurant' && type !== 'salon') || name.length < 2) {
    console.warn(`[business/add] validáció meghiúsult: type=${type} name="${name}"`)
    return NextResponse.json({ error: 'Adj meg típust és nevet (min. 2 karakter)' }, { status: 400 })
  }

  let payload: Awaited<ReturnType<typeof getPayloadClient>>
  try {
    payload = await getPayloadClient()
  } catch (err) {
    console.error('[business/add] getPayloadClient failed:', err)
    return NextResponse.json({ error: 'Szerver hiba (payload)' }, { status: 500 })
  }

  const collection = type === 'salon' ? 'salons' : 'restaurants'
  const ownerId = typeof user.id === 'string' && /^\d+$/.test(user.id) ? Number(user.id) : user.id

  const baseData = {
    name,
    owner: ownerId,
    ...(body.city ? { city: body.city } : {}),
    ...(body.phone ? { phone: body.phone } : {}),
  }

  const baseSlug = slugify(name) || 'uzlet'

  let slug = baseSlug
  try {
    const slugTaken = async (s: string): Promise<boolean> => {
      const [sl, r] = await Promise.all([
        payload.find({ collection: 'salons', where: { slug: { equals: s } }, limit: 1, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'restaurants', where: { slug: { equals: s } }, limit: 1, depth: 0, overrideAccess: true }),
      ])
      return sl.docs.length > 0 || r.docs.length > 0
    }
    for (let i = 2; (await slugTaken(slug)) && i < 100; i++) slug = `${baseSlug}-${i}`
  } catch (err) {
    console.error('[business/add] slug-keresés meghiúsult:', err)
    return NextResponse.json({ error: 'Szerver hiba (slug-ellenőrzés)' }, { status: 500 })
  }

  let created: { id: string | number } | null = null
  try {
    created = await payload.create({
      collection,
      data: { ...baseData, slug, is_active: true },
      overrideAccess: true,
      user,
    })
    console.log(`[business/add] létrehozva: ${collection}#${created.id} slug="${slug}"`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[business/add] create failed:', msg, err)
    return NextResponse.json(
      { error: 'Az üzlet létrehozása nem sikerült', detail: msg },
      { status: 500 },
    )
  }

  const key = `${type}:${created.id}`
  const redirectTo = type === 'restaurant' ? '/restaurant' : '/dashboard'

  try {
    await payload.update({ collection: 'users', id: user.id, data: { last_active_business: key }, overrideAccess: true })
  } catch (err) {
    console.warn('[business/add] last_active_business frissítés meghiúsult (nem blokkoló):', err)
  }

  const res = NextResponse.json({ ok: true, redirectTo })
  res.cookies.set(ACTIVE_BUSINESS_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
