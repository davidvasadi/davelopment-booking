import type { Payload } from 'payload'
import { getPayloadClient } from '@/lib/payload'

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

export type PlaceAutocompleteSuggestion = { placeId: string; mainText: string; secondaryText: string }

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

/**
 * Biztonsági havi keret — a Google-fiók TÉNYLEGESEN fizetőssé váló ingyenes kerete alatt, hogy
 * SOSE lépjük túl (lásd a 2026-10-14-i user-beszélgetést):
 *   - `autocomplete`: a gépelés-közbeni élő találatok (Autocomplete New, "Autocomplete Requests"
 *     SKU) — havi 5000 ingyenes hívás. Ha a keresési "munkamenet" egy Place Details-hívással zárul
 *     (nálunk MINDIG így van, amikor ténylegesen csatlakoztatnak egy profilt — Enterprise+
 *     Atmoszféra szintű, mert ratinget és véleményt is kérünk), a köztes gépelés-tippek a Google
 *     saját session-alapú díjszabása szerint TELJESEN INGYENESEK, a havi kerettől függetlenül;
 *     csak egy FÉLBEHAGYOTT (kiválasztás nélküli) keresgélés számít bele ebbe az 5000-be. Ez a
 *     keret tehát a ténylegesen legrosszabb esetre (mindenki félbehagyja) szóló biztonsági háló.
 *   - `place_details`: a kiválasztás utáni csillag/vélemény-lekérés (Enterprise+Atmoszféra szint).
 *     1000/hó ingyenes.
 * A küszöböt mindenhol a tényleges keret alá tesszük (biztonsági sáv), hogy a számlálás
 * pontatlansága (egyidejű kérések, számolási késés) se vihessen át a fizetős sávba. Határ
 * elérésekor a funkció "karbantartás alatt áll" hibát dob — ÚJ Google-hívás nem történik, csak a
 * számlálás (ami maga NEM Google-hívás, a saját DB-nket nézi).
 */
type GoogleApiCallKind = 'autocomplete' | 'place_details' | 'address_details'
const MONTHLY_SAFETY_CAPS: Record<GoogleApiCallKind, number> = {
  autocomplete: 4900,
  place_details: 950,
  // A számlázási cím-autocomplete kiválasztás-utáni lekérése csak `addressComponents`-et kér
  // (NEM rating/review-t) — ez a Places API olcsóbb "Essentials" szintje, 10000/hó ingyenes
  // (nem az Enterprise+Atmosphere 1000/hó-s kerete, amit a Google-profil csatlakoztatás használ).
  address_details: 9500,
}

export class GoogleApiCapReachedError extends Error {
  constructor(kind: GoogleApiCallKind, used: number) {
    super(`A Google-értékelések funkció ezen a hónapon elérte a biztonsági keretét (${kind}: ${used}/${MONTHLY_SAFETY_CAPS[kind]}) — ideiglenesen karbantartás alatt áll, a hónap fordulásával automatikusan visszaáll.`)
    this.name = 'GoogleApiCapReachedError'
  }
}

function startOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

async function monthlyCallCount(kind: GoogleApiCallKind): Promise<number> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'google-api-log',
    where: { and: [{ kind: { equals: kind } }, { createdAt: { greater_than_equal: startOfMonthIso() } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return res.totalDocs
}

/** Ellenőrzi a keretet, majd (ha átment) naplózza a hívást — EGY helyen, hogy a kereten felüli
 *  hívás fizikailag ne történhessen meg (a dobott hiba a `call()` ELŐTT áll meg). */
async function guardAndLog(kind: GoogleApiCallKind): Promise<void> {
  const used = await monthlyCallCount(kind)
  if (used >= MONTHLY_SAFETY_CAPS[kind]) throw new GoogleApiCapReachedError(kind, used)
  try {
    const payload = await getPayloadClient()
    await payload.create({ collection: 'google-api-log', overrideAccess: true, data: { kind } })
  } catch {
    /* a naplózás nem blokkoló — ha ez hibázik, a tényleges hívás még mehet */
  }
}

/** A UI ezzel kérdezi le ELŐRE (Google-hívás nélkül, csak a saját naplónkat nézve), hogy a
 *  keresés/csatlakoztatás jelenleg "karbantartás alatt" állapotban van-e — hogy ne kelljen
 *  megvárni egy ténylegesen elutasított próbálkozást a felhasználói üzenethez. */
export async function googleApiMaintenanceStatus(): Promise<{ search: boolean; details: boolean }> {
  const [autocompleteUsed, placeDetailsUsed] = await Promise.all([monthlyCallCount('autocomplete'), monthlyCallCount('place_details')])
  return {
    search: autocompleteUsed >= MONTHLY_SAFETY_CAPS.autocomplete,
    details: placeDetailsUsed >= MONTHLY_SAFETY_CAPS.place_details,
  }
}

/** Ugyanez a számlázási cím-autocomplete-nek — a `search` itt UGYANAZT az 'autocomplete' keretet
 *  nézi, mint a Google-profil kereső (ugyanaz a valós Google-SKU, egy közös havi kvóta), csak a
 *  kiválasztás-utáni részlet-lekérés (`details`) számol külön, olcsóbb kerettel. */
export async function googleAddressMaintenanceStatus(): Promise<{ search: boolean; details: boolean }> {
  const [autocompleteUsed, addressDetailsUsed] = await Promise.all([monthlyCallCount('autocomplete'), monthlyCallCount('address_details')])
  return {
    search: autocompleteUsed >= MONTHLY_SAFETY_CAPS.autocomplete,
    details: addressDetailsUsed >= MONTHLY_SAFETY_CAPS.address_details,
  }
}

/**
 * Élő, gépelés-közbeni találatok (Place Autocomplete New) — a `sessionToken`-t a KLIENS
 * generálja (egy véletlen azonosító), és ugyanazt a tokent küldi minden gépelés-közbeni hívásnál
 * ÉS a végén a kiválasztás utáni `fetchPlaceDetails`-nél is. A Google ezeket egy közös
 * "munkamenetként" kezeli — ha a session egy Place Details-hívással zárul, a köztes
 * Autocomplete-hívások a Google saját díjszabása szerint ingyenesek (session-alapú SKU).
 */
export async function autocompletePlaces(input: string, sessionToken: string, languageCode = 'hu'): Promise<PlaceAutocompleteSuggestion[]> {
  await guardAndLog('autocomplete')
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY nincs beállítva')
  const res = await fetch(`${API}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ input, sessionToken, languageCode }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  type Resp = {
    suggestions?: {
      placePrediction?: {
        placeId?: string
        text?: { text?: string }
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
      }
    }[]
  }
  const data = (await res.json()) as Resp
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId as string,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
    }))
}

/**
 * Postai cím-autocomplete (Számlázási adatok) — UGYANAZ az Autocomplete (New) SKU, mint a
 * Google-profil kereső fent, csak Magyarországra szűkítve (`includedRegionCodes`) és üzlet-típus
 * helyett cím-típusokra súlyozva. Ugyanazt az 'autocomplete' havi keretet fogyasztja, mert ez a
 * valóságban is UGYANAZ a Google-kvóta — két külön számláló kettőzné a tényleges kockázatot.
 */
export async function autocompleteAddress(input: string, sessionToken: string, languageCode = 'hu'): Promise<PlaceAutocompleteSuggestion[]> {
  await guardAndLog('autocomplete')
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY nincs beállítva')
  const res = await fetch(`${API}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ input, sessionToken, languageCode, includedRegionCodes: ['hu'], includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'postal_code'] }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  type Resp = {
    suggestions?: {
      placePrediction?: {
        placeId?: string
        text?: { text?: string }
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
      }
    }[]
  }
  const data = (await res.json()) as Resp
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
    .map((p) => ({
      placeId: p.placeId as string,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
    }))
}

export type AddressDetails = { postalCode: string; city: string; street: string }

/** Kiválasztás utáni cím-részletek — csak `addressComponents`-et kér (NEM rating/review-t), ezért
 *  az olcsóbb "Essentials" szintbe esik, külön (`address_details`) kerettel számol. */
export async function getAddressDetails(placeId: string, sessionToken: string): Promise<AddressDetails> {
  await guardAndLog('address_details')
  type Resp = { addressComponents?: { longText?: string; shortText?: string; types?: string[] }[] }
  const qs = new URLSearchParams({ sessionToken })
  const data = await call<Resp>(`/places/${encodeURIComponent(placeId)}?${qs.toString()}`, {
    method: 'GET',
    fieldMask: 'addressComponents',
  })
  const comps = data.addressComponents ?? []
  const find = (type: string) => comps.find((c) => c.types?.includes(type))?.longText ?? ''
  const route = find('route')
  const streetNumber = find('street_number')
  return {
    postalCode: find('postal_code'),
    city: find('locality') || find('postal_town') || find('administrative_area_level_2'),
    street: [route, streetNumber].filter(Boolean).join(' ').trim(),
  }
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

/** `sessionToken` — ha a hívás egy előzőleg Autocomplete-tel futott keresési próbálkozást zár le,
 *  ugyanazt a tokent add át, ami a `autocompletePlaces()`-nek ment — ez bundle-olja ingyenesre a
 *  köztes gépelés-tippeket a Google session-alapú díjszabásában. A háttér-frissítésnél (nincs
 *  előzmény Autocomplete-munkamenet) hagyd üresen. */
export async function fetchPlaceDetails(placeId: string, languageCode = 'hu', sessionToken?: string) {
  await guardAndLog('place_details')
  const qs = new URLSearchParams({ languageCode, ...(sessionToken ? { sessionToken } : {}) })
  const d = await call<PlaceDetails>(`/places/${encodeURIComponent(placeId)}?${qs.toString()}`, {
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
export async function refreshBusinessGoogleReviews(payload: Payload, kind: 'salon' | 'restaurant', id: string | number, sessionToken?: string): Promise<boolean> {
  if (!googlePlacesEnabled()) return false
  const collection = kind === 'salon' ? 'salons' : 'restaurants'
  const biz = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
  const placeId = (biz as { google_place_id?: string | null }).google_place_id
  if (!placeId) return false
  const d = await fetchPlaceDetails(placeId, 'hu', sessionToken)
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
// Sikertelen hívás után (pl. hibás kulcs, Google-leállás) ne próbálkozzon minden látogatásnál
// újra — üzletenként legfeljebb óránként egy kísérlet.
const RETRY_AFTER_FAILURE_MS = 3600_000
const lastFailure = new Map<string, number>()

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
  if (Date.now() - (lastFailure.get(key) ?? 0) < RETRY_AFTER_FAILURE_MS) return
  inFlight.add(key)
  try {
    await refreshBusinessGoogleReviews(payload, kind, biz.id)
    lastFailure.delete(key)
  } catch (err) {
    lastFailure.set(key, Date.now())
    payload.logger.error(`[googleReviews] ${key}: ${String(err)}`)
  } finally {
    inFlight.delete(key)
  }
}
