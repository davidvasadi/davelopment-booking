import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { googlePlacesEnabled, refreshBusinessGoogleReviews, searchPlaces } from '@/lib/googleReviews'

/**
 * Google-profil kiválasztása az AKTÍV üzlethez (Beállítások → Google).
 *   GET  ?q=…            → találatok a Places keresőből (név + cím), a tulaj ebből választ.
 *   POST { placeId }     → mentés + azonnali értékelés-frissítés; `placeId: null` → leválasztás.
 * A Google-hívás a platform kulcsával megy (GOOGLE_PLACES_API_KEY); kulcs nélkül 503.
 */
async function guard(requireKey = true) {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { active } = await getActiveBusiness(user)
  if (!active) return { error: NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 }) }
  const denied = await assertCapability(user.id, active.type, active.id, 'settings.profile')
  if (denied) return { error: NextResponse.json({ error: denied.error }, { status: denied.status }) }
  if (requireKey && !googlePlacesEnabled()) return { error: NextResponse.json({ error: 'A Google-értékelések nincsenek bekapcsolva a platformon.' }, { status: 503 }) }
  return { active }
}

export async function GET(req: NextRequest) {
  // `?current=1` → a jelenlegi kiválasztás + hogy a platformon be van-e kapcsolva a funkció.
  if (req.nextUrl.searchParams.get('current') === '1') {
    const c = await guard(false)
    if ('error' in c) return c.error
    const payload = await getPayloadClient()
    const doc = await payload.findByID({ collection: c.active.type === 'salon' ? 'salons' : 'restaurants', id: c.active.id, depth: 0, overrideAccess: true }) as Record<string, unknown>
    return NextResponse.json({
      enabled: googlePlacesEnabled(),
      place: doc.google_place_id
        ? { id: doc.google_place_id, name: doc.google_place_name ?? null, rating: doc.google_rating ?? null, count: doc.google_rating_count ?? null, updatedAt: doc.google_reviews_updated_at ?? null }
        : null,
    })
  }
  const g = await guard()
  if ('error' in g) return g.error
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json({ results: [] })
  try {
    return NextResponse.json({ results: await searchPlaces(q) })
  } catch (err) {
    console.error('[google/place] search', err)
    return NextResponse.json({ error: 'A Google-keresés nem sikerült.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ('error' in g) return g.error
  const body = (await req.json().catch(() => null)) as { placeId?: string | null } | null
  const placeId = typeof body?.placeId === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(body.placeId) ? body.placeId : null
  if (body?.placeId && !placeId) return NextResponse.json({ error: 'Érvénytelen Google-azonosító' }, { status: 400 })

  const payload = await getPayloadClient()
  const collection = g.active.type === 'salon' ? 'salons' : 'restaurants'
  await payload.update({
    collection,
    id: g.active.id,
    data: (placeId
      ? { google_place_id: placeId }
      : { google_place_id: null, google_place_name: null, google_maps_url: null, google_rating: null, google_rating_count: null, google_reviews: null, google_reviews_updated_at: null }) as never,
    overrideAccess: true,
  })
  if (placeId) {
    try {
      await refreshBusinessGoogleReviews(payload, g.active.type, g.active.id)
    } catch (err) {
      console.error('[google/place] refresh', err)
      return NextResponse.json({ error: 'A profil mentve, de az értékelések lekérése nem sikerült.' }, { status: 502 })
    }
  }
  const doc = await payload.findByID({ collection, id: g.active.id, depth: 0, overrideAccess: true }) as Record<string, unknown>
  return NextResponse.json({
    ok: true,
    place: placeId ? { id: placeId, name: doc.google_place_name ?? null, rating: doc.google_rating ?? null, count: doc.google_rating_count ?? null } : null,
  })
}
