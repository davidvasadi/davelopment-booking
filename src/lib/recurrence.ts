/**
 * Ismétlődő foglalás-sorozat segédfüggvényei (additív, defenzív).
 * Egyszeri foglalásnál (nincs `repeat`) ez a modul NEM fut le a hívó route-okban.
 */

export type RecurrenceFreq = 'weekly' | 'biweekly' | 'monthly'

/** Ésszerű felső korlát a generált alkalmakra (az első alkalmat is beleértve). */
export const MAX_SERIES_COUNT = 12

export interface RepeatSpec {
  freq: RecurrenceFreq
  count: number
}

/** UTC-alapú, TZ-független dátumaritmetika a "YYYY-MM-DD" stringeken. */
function parseYMD(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toYMD(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * A sorozat dátumainak listája: az első a kért dátum, a többi a frekvencia szerint előre.
 * `count`-ot 1..MAX_SERIES_COUNT közé szorítja. Havinál a hónap napját tartja (a hónap
 * végi túlcsordulást a natív Date normalizálja, pl. jan 31 → márc 3 helyett feb-kezelést
 * nem erőltetünk; a slot-ellenőrzés úgyis kihagyja a nem elérhető alkalmakat).
 */
export function generateSeriesDates(startDate: string, spec: RepeatSpec): string[] {
  const count = Math.max(1, Math.min(MAX_SERIES_COUNT, Math.floor(spec.count)))
  const base = parseYMD(startDate)
  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime())
    if (spec.freq === 'weekly') d.setUTCDate(base.getUTCDate() + i * 7)
    else if (spec.freq === 'biweekly') d.setUTCDate(base.getUTCDate() + i * 14)
    else d.setUTCMonth(base.getUTCMonth() + i) // monthly
    dates.push(toYMD(d))
  }
  return dates
}
