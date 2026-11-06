import type { HoursDay } from '@/lib/openingHours'

const SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const t = (s: string, end = false) => (end && s === '00:00' ? '24:00' : s.replace(/^0(\d)/, '$1'))

/** A heti nyitvatartás rövid sorai (a QR-os nyomtatott laphoz): az egymás utáni, azonos napok összevonva —
 *  pl. `['H–P', '9:00–19:00'], ['Szo', '9:00–14:00'], ['V', 'zárva']`. Ha egy nap sincs nyitva: üres. */
export function hoursRows(days: Pick<HoursDay, 'open' | 'from' | 'to'>[]): [string, string][] {
  if (!days.some((d) => d.open)) return []
  const val = (d: Pick<HoursDay, 'open' | 'from' | 'to'>) => (d.open ? `${t(d.from)}–${t(d.to, true)}` : 'zárva')
  const out: [string, string][] = []
  let i = 0
  while (i < days.length) {
    let j = i
    while (j + 1 < days.length && val(days[j + 1]) === val(days[i])) j++
    out.push([j > i ? `${SHORT[i]}–${SHORT[j]}` : SHORT[i], val(days[i])])
    i = j + 1
  }
  return out
}
