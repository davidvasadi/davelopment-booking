/**
 * Előre foglalási ablak — EGY helyen számolva a foglaló felülethez (hány napot mutat a
 * dátumsáv) és a szerver-oldali ellenőrzéshez (szalon + étterem foglalás-API), hogy a kettő ne
 * térjen el. Minden dátum budapesti naptári nap (`YYYY-MM-DD`), nem UTC.
 */

const DAY_MS = 86_400_000

/** A mai budapesti naptári nap `YYYY-MM-DD` alakban. */
export function budapestToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** `YYYY-MM-DD` + n nap (naptári, időzóna-független). */
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

/** Két `YYYY-MM-DD` közti napok száma (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00.000Z`).getTime() - new Date(`${a}T12:00:00.000Z`).getTime()) / DAY_MS)
}

export type BookingWindowSource = {
  booking_window_days?: number | null
}

/** Hány nap foglalható a mai nappal együtt (a dátumsáv hossza). Gördülő ablak: a beállított
 *  napszám — ma + (N − 1) az utolsó foglalható nap. */
export function bookableDayCount(place: BookingWindowSource): number {
  return Math.max(1, place.booking_window_days ?? 60)
}

/** Foglalható-e a nap: nem múltbeli, és belefér az ablakba. */
export function isWithinBookingWindow(place: BookingWindowSource, date: string, today: string = budapestToday()): boolean {
  if (date < today) return false
  const count = bookableDayCount(place)
  return count > 0 && date <= addDays(today, count - 1)
}
