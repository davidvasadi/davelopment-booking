import { NextRequest, NextResponse } from 'next/server'
import { loginEmailWhere } from '@/lib/loginEmail'
import { getPayloadClient } from '@/lib/payload'
import { slugify } from '@/payload/lib/slugify'

/**
 * GET /api/auth/check-availability?type=email|business-name&value=...
 *
 * Élő elérhetőség-ellenőrzés a regisztrációs formokhoz (email zöld pipa/piros X, szalon/
 * étterem név ütközés-jelzés) — a kliens ezt debounce-olva hívja gépelés közben, a végleges
 * validáció (email formátum, duplikált cím, slug-ütközés) továbbra is a `/api/auth/register`
 * route-ban / a collection-ök saját validátoraiban fut submitkor.
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const value = (req.nextUrl.searchParams.get('value') ?? '').trim()
  if (!value) return NextResponse.json({ available: true })

  const payload = await getPayloadClient()

  if (type === 'email') {
    const res = await payload.find({
      collection: 'users',
      where: loginEmailWhere(value),
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return NextResponse.json({ available: res.docs.length === 0 })
  }

  if (type === 'business-name') {
    const slug = slugify(value)
    if (!slug) return NextResponse.json({ available: true })
    const [salons, restaurants] = await Promise.all([
      payload.find({ collection: 'salons', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'restaurants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true }),
    ])
    return NextResponse.json({ available: salons.docs.length === 0 && restaurants.docs.length === 0 })
  }

  return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
}
