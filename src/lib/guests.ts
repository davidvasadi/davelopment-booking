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
  status?: string | null
}

/** Beeső / walk-in placeholder-nevek — ezeket NEM mérjük a vendégek közé. */
const WALKIN_NAMES = new Set([
  'beeső', 'beeso', 'beeső vendég', 'beeso vendeg', 'walk-in', 'walkin', 'walk in',
  'telefon', 'telefonos', 'telefonos foglalás', 'telefonos foglalas',
])

/**
 * Valós vendég-e a foglalás (CRM-listához)? Csak névvel, és az nem beeső/telefon-placeholder.
 * Így a beesőt és a névtelen telefonost nem mérjük VENDÉGKÉNT.
 */
export function isRealGuest(s: { name?: string | null }): boolean {
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
      // Legfrissebb foglalás neve nyer, ha van dátum.
      if (date && existing.lastVisit === date && s.name) existing.name = s.name
    } else {
      map.set(key, {
        key,
        name: s.name || email || phone || 'Vendég',
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

/** Ország ISO2 → [lat, lng] centroid a gyakori piacokra (Közép-Európa fókusz). */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  HU: [47.16, 19.5],
  AT: [47.6, 14.55],
  DE: [51.17, 10.45],
  SK: [48.67, 19.7],
  RO: [45.94, 24.97],
  HR: [45.1, 15.2],
  RS: [44.02, 21.0],
  SI: [46.15, 14.99],
  IT: [42.5, 12.5],
  FR: [46.6, 2.35],
  GB: [54.0, -2.0],
  IE: [53.4, -8.0],
  US: [39.5, -98.35],
  PL: [51.92, 19.15],
  CZ: [49.82, 15.47],
  NL: [52.13, 5.29],
  BE: [50.64, 4.67],
  ES: [40.0, -4.0],
  PT: [39.5, -8.0],
  CH: [46.8, 8.23],
  SE: [62.0, 15.0],
  NO: [61.0, 8.5],
  DK: [56.0, 9.5],
  FI: [64.0, 26.0],
  GR: [39.07, 22.96],
  UA: [48.38, 31.17],
  BG: [42.73, 25.49],
  TR: [39.0, 35.0],
  RU: [61.52, 105.32],
  CA: [56.13, -106.35],
}

export const DEFAULT_CENTROID: [number, number] = [48.0, 16.0]

export interface CountryBucket {
  iso: string
  count: number
  centroid: [number, number]
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
  for (const s of sources) {
    if (s.status === 'cancelled' || s.status === 'no_show') continue
    if (!isRealGuest(s)) continue
    const iso = sourceCountry(s)
    if (!iso) continue
    counts.set(iso, (counts.get(iso) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([iso, count]) => ({
      iso,
      count,
      // A pin a FŐVÁROSRA kerül (a referencia így teszi), nem az ország mértani
      // közepére — így a vendég a valós helyére kerül. Fallback: centroid.
      centroid: ISO2_TO_CAPITAL[iso]?.latlng ?? COUNTRY_CENTROIDS[iso] ?? DEFAULT_CENTROID,
    }))
    .sort((a, b) => b.count - a.count)
}

/** ISO2 → zászló-emoji (regional indicator). */
export function flagEmoji(iso: string | null): string {
  if (!iso || iso.length !== 2) return '🌐'
  const A = 0x1f1e6
  return String.fromCodePoint(A + iso.charCodeAt(0) - 65, A + iso.charCodeAt(1) - 65)
}

/** Monogram a névből (avatar). */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
