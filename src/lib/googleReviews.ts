import type { Payload } from 'payload'

/**
 * Google-értékelések a Places API (New)-val, a PLATFORM egyetlen kulcsával
 * (`GOOGLE_PLACES_API_KEY` env). Az üzletnek nem kell Google-fiókot összekötnie: az értékelések
 * nyilvánosak, csak a saját Google-profilját (Place ID) választja ki a beállításokban.
 *
 * Költség-kontroll: KÉRÉSRE frissül, cron nélkül — amikor valaki megnyitja az üzlet oldalát, és a
 * tárolt másolat 24 óránál régebbi, a háttérben (a válasz után) frissítjük (`refreshGoogleReviewsIfStale`).
 * A látogató sosem vár a Google-re, és egy nem látogatott üzlet egyáltalán nem kerül pénzbe. A Google
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

/** Egy üzlet gyorsítótárának frissítése (a kiválasztáskor azonnal, utána kérésre, legfeljebb naponta). */
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

/** A tárolt értékelések biztonságos kiolvasása (a json mező bármi lehet). */
export function storedGoogleReviews(v: unknown): GoogleReview[] {
  return Array.isArray(v) ? (v as GoogleReview[]).filter((r) => r && typeof r.rating === 'number') : []
}

const STALE_MS = 24 * 3600_000
const inFlight = new Set<string>()

/**
 * A publikus oldal hívja (a válasz elküldése UTÁN, `after()`-ből): ha van kiválasztott Google-
 * profil és a tárolt adat 24 óránál régebbi, frissít. Folyamaton belül egy üzletre egyszerre csak
 * egy frissítés fut. A frissítés után a Salons/Restaurants afterChange hookja érvényteleníti a
 * publikus oldal cache-ét, így a következő betöltés már az új adatot mutatja.
 */
export async function refreshGoogleReviewsIfStale(
  payload: Payload,
  kind: 'salon' | 'restaurant',
  biz: { id: string | number; google_place_id?: string | null; google_reviews_updated_at?: string | null },
): Promise<void> {
  if (!googlePlacesEnabled() || !biz.google_place_id) return
  const last = biz.google_reviews_updated_at ? Date.parse(biz.google_reviews_updated_at) : 0
  if (Number.isFinite(last) && Date.now() - last < STALE_MS) return
  const key = `${kind}:${String(biz.id)}`
  if (inFlight.has(key)) return
  inFlight.add(key)
  try {
    await refreshBusinessGoogleReviews(payload, kind, biz.id)
  } catch (err) {
    payload.logger.error(`[googleReviews] ${key}: ${String(err)}`)
  } finally {
    inFlight.delete(key)
  }
}
