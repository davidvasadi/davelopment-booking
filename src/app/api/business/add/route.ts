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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { type?: string; name?: string; city?: string; phone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const type = body.type
  const name = (body.name ?? '').trim()
  if ((type !== 'restaurant' && type !== 'salon') || name.length < 2) {
    return NextResponse.json({ error: 'Adj meg típust és nevet (min. 2 karakter)' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const collection = type === 'salon' ? 'salons' : 'restaurants'

  // Az owner reláció int-oszlop a DB-ben — ha a user.id numerikus string, számmá alakítjuk
  // (különben a downstream hookok NaN-t kaphatnak a where-feltételben).
  const ownerId = typeof user.id === 'string' && /^\d+$/.test(user.id) ? Number(user.id) : user.id

  const baseData = {
    name,
    owner: ownerId,
    ...(body.city ? { city: body.city } : {}),
    ...(body.phone ? { phone: body.phone } : {}),
  }

  // Slug: a Restaurants hookja auto-generál a névből, a Salons NEM — ezért egységesen
  // előállítjuk. SEO-barát, OLVASHATÓ slug: a tiszta névből; ütközéskor `-2`, `-3`, …
  // inkrementálisan (nem random suffix). A slug a két collection KÖZÖS namespace-ében
  // egyedi (a /[slug] route szalont és éttermet is kiszolgál).
  const baseSlug = slugify(name) || 'uzlet'

  const slugTaken = async (slug: string): Promise<boolean> => {
    const [s, r] = await Promise.all([
      payload.find({ collection: 'salons', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'restaurants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true }),
    ])
    return s.docs.length > 0 || r.docs.length > 0
  }

  let slug = baseSlug
  for (let i = 2; (await slugTaken(slug)) && i < 100; i++) slug = `${baseSlug}-${i}`

  let created: { id: string | number } | null = null
  try {
    created = await payload.create({
      collection,
      data: { ...baseData, slug, is_active: true },
      overrideAccess: true,
    })
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

  // Aktív üzlet = az új (cookie + DB), hogy egyből oda jusson a felhasználó.
  try {
    await payload.update({ collection: 'users', id: user.id, data: { last_active_business: key }, overrideAccess: true })
  } catch {
    /* nem blokkoló */
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
