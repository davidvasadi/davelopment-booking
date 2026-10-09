/**
 * Előre foglalási ablak — EGY helyen számolva a foglaló felülethez (hány napot mutat a
 * dátumsáv), a szerver-oldali ellenőrzéshez (szalon + étterem foglalás-API) és a napi
 * időszak-kezelő cronhoz, hogy ezek ne térjenek el. Minden dátum budapesti naptári nap
 * (`YYYY-MM-DD`), nem UTC. Szerver- és kliens-oldalon is futtatható (nincs Node-függés).
 *
 * Két mód:
 *  - gördülő (alap): mindig a mai nappal kezdődő N nap foglalható, minden nap egy nappal tovább nyílik;
 *  - időszakos (`booking_window_periodic`): egyszerre N nap nyílik meg, `booking_window_end` napig.
 *    Lejáratkor automatikus megújításnál újabb N nap nyílik (a cron menti el és értesít), anélkül
 *    a vendégek új időpontot nem foglalhatnak, amíg a tulaj új időszakot nem indít.
 */

const DAY_MS = 86_400_000

/** Hány nappal a lejárat előtt menjen ki a „hamarosan lejár” értesítés. */
export const WINDOW_NOTICE_DAYS = 7

/** A mai budapesti naptári nap `YYYY-MM-DD` alakban. */
export function budapestToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** `YYYY-MM-DD` + n nap (naptári, időzóna-független). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

/** „2026. december 7.” */
export function huDate(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00.000Z`))
}

/** Két `YYYY-MM-DD` közti napok száma (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00.000Z`).getTime() - new Date(`${a}T12:00:00.000Z`).getTime()) / DAY_MS)
}

export type BookingWindowSource = {
  booking_window_days?: number | null
  booking_window_periodic?: boolean | null
  booking_window_end?: string | null
  booking_window_auto_renew?: boolean | null
}

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function windowLength(place: BookingWindowSource): number {
  return Math.max(1, Math.min(365, place.booking_window_days ?? 60))
}

/** Egy új időszak utolsó napja, ha `start` napon indul. */
export function periodEndFrom(place: BookingWindowSource, start: string): string {
  return addDays(start, windowLength(place) - 1)
}

/**
 * Az utolsó foglalható nap. Időszakos módban az elmentett időszak-vége; ha az már elmúlt és
 * be van kapcsolva a megújítás, az időszakot N napos lépésekben előregörgetjük (így a vendég
 * akkor is foglalhat, ha a napi cron még nem futott le). `null` = jelenleg nincs foglalható nap.
 */
export function effectiveWindowEnd(place: BookingWindowSource, today: string = budapestToday()): string | null {
  if (!place.booking_window_periodic) return periodEndFrom(place, today)
  const stored = place.booking_window_end
  if (!isIsoDate(stored)) return periodEndFrom(place, today)
  if (stored >= today) return stored
  if (place.booking_window_auto_renew === false) return null
  const len = windowLength(place)
  const periods = Math.ceil(daysBetween(stored, today) / len)
  return addDays(stored, periods * len)
}

/** Hány nap foglalható a mai nappal együtt (a dátumsáv hossza). 0 = most semmi. */
export function bookableDayCount(place: BookingWindowSource, today: string = budapestToday()): number {
  const end = effectiveWindowEnd(place, today)
  return end ? Math.max(0, daysBetween(today, end) + 1) : 0
}

/** Foglalható-e a nap: nem múltbeli, és belefér az ablakba. */
export function isWithinBookingWindow(place: BookingWindowSource, date: string, today: string = budapestToday()): boolean {
  if (date < today) return false
  const end = effectiveWindowEnd(place, today)
  return !!end && date <= end
}
