import type { Payload } from 'payload'

/**
 * Google-értékelések a Places API (New)-val, a PLATFORM egyetlen kulcsával
 * (`GOOGLE_PLACES_API_KEY` env). Az üzletnek nem kell Google-fiókot összekötnie: az értékelések
 * nyilvánosak, csak a saját Google-profilját (Place ID) választja ki a beállításokban.
 *
 * Költség-kontroll: a publikus oldal SOSEM hívja a Google-t — üzletenként naponta egyszer
 * frissítjük (`refreshAllGoogleReviews`, a napi cron), és a tárolt másolatot mutatjuk. A Google
 * helyenként legfeljebb 5 értékelést ad vissza (a legrelevánsabbakat) + az átlagot és a darabszámot.
 * Kulcs nélkül minden függvény csendben semmit sem csinál — a funkció rejtve marad.
 */

const API = 'https://places.googleapis.com/v1'

export type GoogleReview = {
  author: string
  authorUrl: string | null
  photoUrl: string | null
  rating: number
  text: string
  relativeTime: string
  publishedAt: string | null
}

export type PlaceSearchResult = { id: string; name: string; address: string }

export function googlePlacesEnabled(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY
}

async function call<T>(path: string, init: RequestInit & { fieldMask: string }): Promise<T> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY nincs beállítva')
  const { fieldMask, headers, ...rest } = init
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask, ...headers },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json() as Promise<T>
}

/** Üzlet keresése név (+ város) alapján — a tulaj ebből választja ki a saját profilját. */
export async function searchPlaces(query: string, languageCode = 'hu'): Promise<PlaceSearchResult[]> {
  type Resp = { places?: { id: string; displayName?: { text?: string }; formattedAddress?: string }[] }
  const data = await call<Resp>('/places:searchText', {
    method: 'POST',
    fieldMask: 'places.id,places.displayName,places.formattedAddress',
    body: JSON.stringify({ textQuery: query, languageCode, pageSize: 6 }),
  })
  return (data.places ?? []).map((p) => ({ id: p.id, name: p.displayName?.text ?? '', address: p.formattedAddress ?? '' }))
}

type PlaceDetails = {
  displayName?: { text?: string }
  googleMapsUri?: string
  rating?: number
  userRatingCount?: number
  reviews?: {
    rating?: number
    text?: { text?: string }
    originalText?: { text?: string }
    relativePublishTimeDescription?: string
    publishTime?: string
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string }
  }[]
}

export async function fetchPlaceDetails(placeId: string, languageCode = 'hu') {
  const d = await call<PlaceDetails>(`/places/${encodeURIComponent(placeId)}?languageCode=${languageCode}`, {
    method: 'GET',
    fieldMask: 'displayName,googleMapsUri,rating,userRatingCount,reviews',
  })
  const reviews: GoogleReview[] = (d.reviews ?? [])
    .map((r) => ({
      author: r.authorAttribution?.displayName ?? 'Google-felhasználó',
      authorUrl: r.authorAttribution?.uri ?? null,
      photoUrl: r.authorAttribution?.photoUri ?? null,
      rating: r.rating ?? 0,
      text: (r.text?.text ?? r.originalText?.text ?? '').trim(),
      relativeTime: r.relativePublishTimeDescription ?? '',
      publishedAt: r.publishTime ?? null,
    }))
    .filter((r) => r.rating > 0)
  return {
    name: d.displayName?.text ?? null,
    mapsUrl: d.googleMapsUri ?? null,
    rating: typeof d.rating === 'number' ? d.rating : null,
    count: typeof d.userRatingCount === 'number' ? d.userRatingCount : null,
    reviews,
  }
}

/** Egy üzlet gyorsítótárának frissítése (a kiválasztáskor azonnal, utána naponta). */
export async function refreshBusinessGoogleReviews(payload: Payload, kind: 'salon' | 'restaurant', id: string | number): Promise<boolean> {
  if (!googlePlacesEnabled()) return false
  const collection = kind === 'salon' ? 'salons' : 'restaurants'
  const biz = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
  const placeId = (biz as { google_place_id?: string | null }).google_place_id
  if (!placeId) return false
  const d = await fetchPlaceDetails(placeId)
  await payload.update({
    collection,
    id,
    data: {
      google_place_name: d.name,
      google_maps_url: d.mapsUrl,
      google_rating: d.rating,
      google_rating_count: d.count,
      google_reviews: d.reviews,
      google_reviews_updated_at: new Date().toISOString(),
    } as never,
    overrideAccess: true,
  })
  return true
}

/** Napi frissítés minden olyan üzletre, amelyiknek van kiválasztott Google-profilja. */
export async function refreshAllGoogleReviews(payload: Payload): Promise<{ refreshed: number; errors: number }> {
  const summary = { refreshed: 0, errors: 0 }
  if (!googlePlacesEnabled()) return summary
  for (const kind of ['salon', 'restaurant'] as const) {
    const res = await payload.find({
      collection: kind === 'salon' ? 'salons' : 'restaurants',
      where: { google_place_id: { exists: true } },
      depth: 0,
      limit: 1000,
      overrideAccess: true,
    })
    for (const doc of res.docs as { id: string | number; google_place_id?: string | null }[]) {
      if (!doc.google_place_id) continue
      try {
        if (await refreshBusinessGoogleReviews(payload, kind, doc.id)) summary.refreshed++
      } catch (err) {
        summary.errors++
        payload.logger.error(`[googleReviews] ${kind} ${String(doc.id)}: ${String(err)}`)
      }
    }
  }
  return summary
}

/** A tárolt értékelések biztonságos kiolvasása (a json mező bármi lehet). */
export function storedGoogleReviews(v: unknown): GoogleReview[] {
  return Array.isArray(v) ? (v as GoogleReview[]).filter((r) => r && typeof r.rating === 'number') : []
}
