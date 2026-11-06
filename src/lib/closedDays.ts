import type { Payload } from 'payload'
import type { Availability, OpeningHoursException } from '@/payload/payload-types'

const DOW_NUM: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

/** Egy üzlet zárt napjai: egyszeri kivétel-zárások (dátumok) és a heti visszatérő zárvatartás (0 = vasárnap … 6 = szombat).
 *  Szalon: az üzlet-szintű (szakember nélküli) availability; étterem: opening-hours + opening-hours-exceptions.
 *  A Foglalások, a Naptár és a dátumválasztó is ebből dolgozik. */
export async function getClosedDays(payload: Payload, kind: 'salon' | 'restaurant', id: string | number): Promise<{ closedDates: string[]; closedWeekdays: number[] }> {
  if (kind === 'salon') {
    const [ex, weekly] = await Promise.all([
      payload.find({ collection: 'availability', where: { and: [{ salon: { equals: id } }, { staff: { exists: false } }, { exception_date: { exists: true } }, { is_available: { equals: false } }] }, depth: 0, limit: 500, overrideAccess: true }),
      payload.find({ collection: 'availability', where: { and: [{ salon: { equals: id } }, { staff: { exists: false } }, { recurring: { equals: true } }, { is_available: { equals: false } }] }, depth: 0, limit: 20, overrideAccess: true }),
    ])
    return {
      closedDates: (ex.docs as Availability[]).map((e) => e.exception_date).filter((d): d is string => !!d).map((d) => d.slice(0, 10)),
      closedWeekdays: Array.from(new Set((weekly.docs as Availability[]).map((e) => DOW_NUM[e.day_of_week ?? '']).filter((n): n is number => n != null))),
    }
  }
  const [ex, weekly] = await Promise.all([
    payload.find({ collection: 'opening-hours-exceptions', where: { and: [{ restaurant: { equals: id } }, { is_closed: { equals: true } }] }, depth: 0, limit: 500, overrideAccess: true }),
    payload.find({ collection: 'opening-hours', where: { and: [{ restaurant: { equals: id } }, { is_open: { equals: false } }] }, depth: 0, limit: 20, overrideAccess: true }),
  ])
  return {
    closedDates: (ex.docs as OpeningHoursException[]).flatMap((e) => {
      const dates: string[] = []
      const cur = new Date(e.start_date)
      const end = new Date(e.end_date)
      while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
      return dates
    }),
    closedWeekdays: Array.from(new Set((weekly.docs as { day_of_week?: string | null }[]).map((e) => DOW_NUM[e.day_of_week ?? '']).filter((n): n is number => n != null))),
  }
}

/** Zárva-e a nap: egyszeri zárás bármikor, a heti zárvatartás csak a mai naptól előre (ugyanaz a szabály, mint a Naptárban). */
export const isClosedDay = (day: string, today: string, c: { closedDates: string[]; closedWeekdays: number[] }) => {
  const [y, m, d] = day.split('-').map(Number)
  return c.closedDates.includes(day) || (day >= today && c.closedWeekdays.includes(new Date(y, m - 1, d).getDay()))
}
