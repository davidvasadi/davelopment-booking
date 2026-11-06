/**
 * Magyar munkaszüneti napok (Mt. 102. § (1)) — Beállítások › Nyitvatartás „Munkaszüneti napokon zárva” (design 16.8):
 * Jan. 1., Márc. 15., Nagypéntek, Húsvét vasárnap és hétfő, Máj. 1., Pünkösd vasárnap és hétfő, Aug. 20., Okt. 23.,
 * Nov. 1., (2026-tól) Dec. 24., Dec. 25–26. A Húsvét a Gauss-féle (Meeus) számítással; a Nagypéntek és a Pünkösd ebből.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(y, month - 1, day))
}
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86400000)

/** Az adott év munkaszüneti napjai (YYYY-MM-DD → megnevezés). */
export function huHolidays(year: number): Map<string, string> {
  const e = easter(year)
  return new Map([
    [`${year}-01-01`, 'Újév'], [`${year}-03-15`, 'Nemzeti ünnep'], [ymd(shift(e, -2)), 'Nagypéntek'], [ymd(e), 'Húsvét'], [ymd(shift(e, 1)), 'Húsvéthétfő'],
    [`${year}-05-01`, 'A munka ünnepe'], [ymd(shift(e, 49)), 'Pünkösd'], [ymd(shift(e, 50)), 'Pünkösdhétfő'], [`${year}-08-20`, 'Államalapítás ünnepe'],
    [`${year}-10-23`, 'Nemzeti ünnep'], [`${year}-11-01`, 'Mindenszentek'],
    // Szenteste: a törvénymódosítással munkaszüneti nap (2026-tól számoljuk)
    ...(year >= 2026 ? [[`${year}-12-24`, 'Szenteste'] as [string, string]] : []),
    [`${year}-12-25`, 'Karácsony'], [`${year}-12-26`, 'Karácsony másnapja'],
  ])
}

/** Munkaszüneti nap-e (YYYY-MM-DD); ha igen, a megnevezése. */
export function huHoliday(date: string): string | null {
  const y = Number(date.slice(0, 4))
  return Number.isFinite(y) ? huHolidays(y).get(date.slice(0, 10)) ?? null : null
}

/** A következő `n` munkaszüneti nap a megadott naptól (a kivételek listájához). */
export function nextHuHolidays(from: string, n: number): { date: string; label: string }[] {
  const y = Number(from.slice(0, 4))
  return [...huHolidays(y), ...huHolidays(y + 1)].filter(([d]) => d >= from).sort(([a], [b]) => a.localeCompare(b)).slice(0, n).map(([date, label]) => ({ date, label }))
}
