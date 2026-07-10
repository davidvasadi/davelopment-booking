/**
 * Vendég-aggregálás — étterem (reservations) ÉS szalon (bookings) foglalásokból.
 * Dedup kulcs: customer_email || customer_phone (kisbetűsítve). Vendégenként:
 * név, kapcsolat, látogatások száma, utolsó látogatás, összes pax (étterem),
 * ország (étterem), visszatérő-e (>1 látogatás), és törzsvendég-szint.
 */

import { isoFromPhone } from '@/lib/phoneCountry'
import { ISO2_TO_CAPITAL } from '@/lib/geoLookup'

export type GuestTier = 1 | 2 | 3

export interface Guest {
  key: string
  name: string
  email: string | null
  phone: string | null
  visits: number
  lastVisit: string | null // ISO date (YYYY-MM-DD)
  totalPax: number
  country: string | null
  returning: boolean
  tier: GuestTier // 1 = Új, 2 = Visszatérő, 3 = Törzsvendég
}

export interface GuestSource {
  name: string
  email?: string | null
  phone?: string | null
  date?: string | null
  pax?: number | null
  country?: string | null
  /** A vendég által megadott város (opcionális, a foglalóból). Az érkezéseknél előnyt élvez az ország-főváros fallback-kel szemben. */
  city?: string | null
  status?: string | null
}

/** Beeső / walk-in placeholder-nevek — ezeket NEM mérjük a vendégek közé. */
const WALKIN_NAMES = new Set([
  'beeső', 'beeso', 'beeső vendég', 'beeso vendeg', 'walk-in', 'walkin', 'walk in',
  'telefon', 'telefonos', 'telefonos foglalás', 'telefonos foglalas',
])

/**
 * Valós vendég-e a foglalás (CRM-listához)? Akkor igen, ha:
 *  - van valós elérhetősége (e-mail VAGY telefon) — ekkor placeholder-név ("beeső"/"telefonos")
 *    mellett is VENDÉG, hisz azonosítható és utolérhető; VAGY
 *  - van értelmes neve, ami nem beeső/telefon-placeholder.
 * Így a beeső/telefonos foglalás, ha KAP telefont vagy e-mailt, bekerül a vendégek közé.
 */
export function isRealGuest(s: { name?: string | null; email?: string | null; phone?: string | null }): boolean {
  const hasContact = !!(s.email?.trim() || s.phone?.trim())
  if (hasContact) return true
  const name = s.name?.trim().toLowerCase()
  if (!name) return false
  return !WALKIN_NAMES.has(name)
}

/** Csak a beeső (walk-in) placeholder-nevek — a telefonos foglalás NEM ide tartozik. */
const WALKIN_ONLY = new Set(['beeső', 'beeso', 'beeső vendég', 'beeso vendeg', 'walk-in', 'walkin', 'walk in'])

/**
 * Beeső (walk-in) foglalás-e? Az ÉRKEZÉSEKHEZ csak ezt zárjuk ki — a telefonos foglalás
 * valós foglalás (jön valaki), csak nincs CRM-profilja.
 */
export function isWalkin(s: { name?: string | null }): boolean {
  const name = s.name?.trim().toLowerCase()
  return !!name && WALKIN_ONLY.has(name)
}

/** Placeholder-név-e ("beeső"/"telefonos") — ilyenkor a kontaktot mutatjuk névként. */
export function isPlaceholderName(name?: string | null): boolean {
  const n = name?.trim().toLowerCase()
  return !!n && WALKIN_NAMES.has(n)
}

/** Megjelenítendő vendégnév: valós név, vagy placeholder-nél a kontakt (telefon/e-mail). */
export function displayName(s: { name?: string | null; email?: string | null; phone?: string | null }): string {
  const name = s.name?.trim()
  if (name && !isPlaceholderName(name)) return name
  return s.phone?.trim() || s.email?.trim() || name || 'Vendég'
}

/** Egységes vendég-kulcs: e-mail → telefon → név (`name:…`). Csak valós vendégnél hívjuk. */
export function guestKeyOf(s: { email?: string | null; phone?: string | null; name?: string | null }): string | null {
  const email = s.email?.trim().toLowerCase() || null
  const phone = s.phone?.trim() || null
  const name = s.name?.trim().toLowerCase() || null
  return email || phone || (name ? `name:${name}` : null)
}

/** Törzsvendég-szint a látogatások számából. */
export function tierFor(visits: number): GuestTier {
  if (visits >= 4) return 3
  if (visits >= 2) return 2
  return 1
}

export const TIER_LABEL: Record<GuestTier, string> = {
  1: 'Új',
  2: 'Visszatérő',
  3: 'Törzsvendég',
}

/** Nyers foglalás-forrásokból dedup-olt, rendezett vendéglistát épít. */
export function aggregateGuests(sources: GuestSource[]): Guest[] {
  const map = new Map<string, Guest>()

  for (const s of sources) {
    // A lemondott/no-show foglalások nem számítanak valós látogatásnak.
    if (s.status === 'cancelled' || s.status === 'no_show') continue
    // Beeső / névtelen nem vendég.
    if (!isRealGuest(s)) continue

    const email = s.email?.trim().toLowerCase() || null
    const phone = s.phone?.trim() || null
    const key = guestKeyOf(s)
    if (!key) continue

    const existing = map.get(key)
    const date = s.date ?? null
    const pax = s.pax ?? 0
    // Ország: elsőként az explicit mező, hiánya esetén a telefon-előhívóból.
    const country = s.country?.trim().toUpperCase() || isoFromPhone(phone) || null

    if (existing) {
      existing.visits += 1
      existing.totalPax += pax
      if (date && (!existing.lastVisit || date > existing.lastVisit)) existing.lastVisit = date
      if (!existing.country && country) existing.country = country
      if (!existing.email && email) existing.email = email
      if (!existing.phone && phone) existing.phone = phone
      // Legfrissebb foglalás neve nyer, ha van dátum (placeholder-nevet kontaktra cserélve).
      if (date && existing.lastVisit === date && s.name) existing.name = displayName(s)
    } else {
      map.set(key, {
        key,
        name: displayName(s),
        email,
        phone,
        visits: 1,
        lastVisit: date,
        totalPax: pax,
        country,
        returning: false,
        tier: 1,
      })
    }
  }

  const guests = Array.from(map.values())
  for (const g of guests) {
    g.returning = g.visits > 1
    g.tier = tierFor(g.visits)
  }

  // Rendezés: utolsó látogatás szerint csökkenő (legfrissebb elöl).
  guests.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  return guests
}

/**
 * Ország ISO2 → [lat, lng] centroid. Minden országot lefed, amit a telefon-előhívó
 * választó (PhoneCountryInput) felkínál — így egy vendég sem esik vissza a
 * DEFAULT_CENTROID-ra (ami Közép-Európa volt, ezért kerültek pl. a tajvani / Fülöp-
 * szigeteki foglalások tévesen Bécsbe).
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  // Közép- és Kelet-Európa
  HU: [47.16, 19.5], AT: [47.6, 14.55], DE: [51.17, 10.45], SK: [48.67, 19.7],
  RO: [45.94, 24.97], HR: [45.1, 15.2], RS: [44.02, 21.0], SI: [46.15, 14.99],
  PL: [51.92, 19.15], CZ: [49.82, 15.47], UA: [48.38, 31.17], BG: [42.73, 25.49],
  MD: [47.41, 28.37], BA: [43.92, 17.68], ME: [42.71, 19.37], MK: [41.61, 21.75],
  AL: [41.15, 20.17], BY: [53.71, 27.95],
  // Nyugat- és Észak-Európa
  FR: [46.6, 2.35], GB: [54.0, -2.0], IE: [53.4, -8.0], NL: [52.13, 5.29],
  BE: [50.64, 4.67], CH: [46.8, 8.23], LU: [49.82, 6.13], IT: [42.5, 12.5],
  ES: [40.0, -4.0], PT: [39.5, -8.0], GR: [39.07, 22.96], SE: [62.0, 15.0],
  NO: [61.0, 8.5], DK: [56.0, 9.5], FI: [64.0, 26.0], IS: [64.96, -19.02],
  EE: [58.6, 25.01], LV: [56.88, 24.6], LT: [55.17, 23.88], CY: [35.13, 33.43],
  MT: [35.94, 14.38], AD: [42.55, 1.6], MC: [43.75, 7.41],
  // Kelet-Európa / Kaukázus / Közép-Ázsia
  RU: [61.52, 105.32], TR: [39.0, 35.0], GE: [42.32, 43.36], AM: [40.07, 45.04],
  AZ: [40.14, 47.58], KZ: [48.02, 66.92],
  // Közel-Kelet
  IL: [31.05, 34.85], AE: [23.42, 53.85], SA: [23.89, 45.08], QA: [25.35, 51.18],
  KW: [29.31, 47.48], BH: [26.07, 50.56], JO: [30.59, 36.24], LB: [33.85, 35.86],
  // Ázsia
  CN: [35.86, 104.2], JP: [36.2, 138.25], KR: [35.91, 127.77], HK: [22.32, 114.17],
  TW: [23.7, 120.96], IN: [20.59, 78.96], PK: [30.38, 69.35], BD: [23.68, 90.36],
  TH: [15.87, 100.99], VN: [14.06, 108.28], PH: [12.88, 121.77], MY: [4.21, 101.98],
  ID: [-0.79, 113.92], SG: [1.35, 103.82], AF: [33.94, 67.71],
  // Afrika
  EG: [26.82, 30.8], MA: [31.79, -7.09], DZ: [28.03, 1.66], NG: [9.08, 8.68],
  KE: [-0.02, 37.91], ZA: [-30.56, 22.94], AO: [-11.2, 17.87],
  // Amerika
  US: [39.5, -98.35], CA: [56.13, -106.35], MX: [23.63, -102.55], BR: [-14.24, -51.93],
  AR: [-38.42, -63.62], CL: [-35.68, -71.54], CO: [4.57, -74.3], CR: [9.75, -83.75],
  // Óceánia
  AU: [-25.27, 133.78], NZ: [-40.9, 174.89],
}

export const DEFAULT_CENTROID: [number, number] = [48.0, 16.0]

export interface CountryBucket {
  iso: string
  count: number
  centroid: [number, number]
  /** A vendégek által megadott városok az adott országban (foglalás-szám szerint). A térkép
   *  magas zoomon ezeket geokódolja és a valós városra rakja a tűt (fallback: az ország fővárosa). */
  cities?: { name: string; count: number }[]
}

/** Egy foglalás-forrás országa: explicit mező, hiánya esetén a telefon-előhívóból. */
export function sourceCountry(s: GuestSource): string | null {
  return s.country?.trim().toUpperCase() || isoFromPhone(s.phone) || null
}

/**
 * Ország-aggregálás a térkép pinjeihez — FOGLALÁSONKÉNT (nem vendégenként!).
 * Így egyetlen külföldi telefonszámú foglalás nem „billenti át" egy visszatérő
 * vendég teljes előzményét egy másik országba. A pin a tényleges érkezés-számot mutatja.
 */
export function bucketByCountry(sources: GuestSource[]): CountryBucket[] {
  const counts = new Map<string, number>()
  // Országonként a megadott városok (normalizált kulcs → megjelenített név + darab).
  const cityCounts = new Map<string, Map<string, { name: string; count: number }>>()
  for (const s of sources) {
    if (s.status === 'cancelled' || s.status === 'no_show') continue
    if (!isRealGuest(s)) continue
    const iso = sourceCountry(s)
    if (!iso) continue
    counts.set(iso, (counts.get(iso) ?? 0) + 1)
    const city = s.city?.trim()
    if (city) {
      const m = cityCounts.get(iso) ?? new Map<string, { name: string; count: number }>()
      const nk = city.toLowerCase()
      const e = m.get(nk) ?? { name: city, count: 0 }
      e.count += 1
      m.set(nk, e)
      cityCounts.set(iso, m)
    }
  }
  return Array.from(counts.entries())
    .map(([iso, count]) => ({
      iso,
      count,
      // A pin a FŐVÁROSRA kerül (a referencia így teszi), nem az ország mértani
      // közepére — így a vendég a valós helyére kerül. Fallback: centroid.
      centroid: ISO2_TO_CAPITAL[iso]?.latlng ?? COUNTRY_CENTROIDS[iso] ?? DEFAULT_CENTROID,
      cities: cityCounts.has(iso)
        ? Array.from(cityCounts.get(iso)!.values()).sort((a, b) => b.count - a.count)
        : undefined,
    }))
    .sort((a, b) => b.count - a.count)
}

/** ISO2 → zászló-emoji (regional indicator). */
export function flagEmoji(iso: string | null): string {
  if (!iso || iso.length !== 2) return '🌐'
  const A = 0x1f1e6
  return String.fromCodePoint(A + iso.charCodeAt(0) - 65, A + iso.charCodeAt(1) - 65)
}

/** Gyakori országok magyar neve (a régió-fókusz piacaira); a többit az Intl adja. */
const COUNTRY_HU: Record<string, string> = {
  HU: 'Magyarország', AT: 'Ausztria', DE: 'Németország', SK: 'Szlovákia', RO: 'Románia',
  HR: 'Horvátország', RS: 'Szerbia', SI: 'Szlovénia', IT: 'Olaszország', FR: 'Franciaország',
  GB: 'Egyesült Királyság', IE: 'Írország', US: 'Egyesült Államok', PL: 'Lengyelország',
  CZ: 'Csehország', NL: 'Hollandia', BE: 'Belgium', ES: 'Spanyolország', PT: 'Portugália',
  CH: 'Svájc', SE: 'Svédország', NO: 'Norvégia', DK: 'Dánia', FI: 'Finnország', GR: 'Görögország',
  UA: 'Ukrajna', BG: 'Bulgária', TR: 'Törökország', RU: 'Oroszország', MA: 'Marokkó',
}

/** ISO2 → magyar országnév (kézi lista → Intl.DisplayNames → maga az ISO). */
export function countryName(iso: string | null): string | null {
  if (!iso) return null
  const code = iso.trim().toUpperCase()
  if (COUNTRY_HU[code]) return COUNTRY_HU[code]
  try {
    const dn = new Intl.DisplayNames(['hu'], { type: 'region' })
    return dn.of(code) ?? code
  } catch {
    return code
  }
}

/** Monogram a névből (avatar). */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
