import type { BreakWindow } from '@/payload/payload-types'

/* A Naptár (beosztás) közös típusai és segédei — szalon és étterem, az oldalak és a nézet is ezt használja. */

/** shift = műszak, leave = szabadság, sick = beteg, vacation = szabadnap. */
export type ShiftType = 'shift' | 'leave' | 'sick' | 'vacation'

export interface ShiftVM {
  id: string
  staffId: string
  date: string // YYYY-MM-DD
  type: ShiftType
  start_time: string | null
  end_time: string | null
  hours: number | null
  breaks: BreakWindow[]
  note: string | null
  // Státuszváltás a napon belül: a műszak vége előtt hazament (pl. délben beteg lett). Nincs duplázás.
  left_early_at: string | null
  left_early_reason: 'sick' | 'personal' | null
  /** beteg / szabadság: fizetett-e */
  paid?: boolean
  /** betegnél a feltöltött táppénzes papír */
  sickNote?: { filename: string; mimeType: string | null; filesize: number | null } | null
}

export interface StaffVM {
  id: string
  name: string
  ini: string
  avatarUrl?: string | null // valós profilkép (media URL / Google avatar); null → monogram
  role: string
  birthday: string | null // YYYY-MM-DD
  join_date: string | null
  weekly_hours: number | null
  /** éves szabadság-keret (nap) */
  annual_leave_days?: number | null
  phone: string | null
  documents: { label: string; sizeLabel: string }[]
  /** étterem: borravalóra jogosult (a napi borravaló-elosztáshoz) */
  tipEligible?: boolean
  /** Van függőben lévő meghívója (még nem fogadta el) — addig nem osztható be műszakra. */
  pending?: boolean
}

/** A nap-szerkesztő űrlap-értéke (hozzáadás/módosítás közös alakja). */
export type ShiftInput = {
  type: ShiftType
  start_time: string
  end_time: string
  breaks: BreakWindow[]
  note: string
  left_early_at: string | null
  left_early_reason: 'sick' | 'personal' | null
}

export const TYPE_LABEL: Record<ShiftType, string> = { shift: 'Műszak', leave: 'Szabadság', sick: 'Beteg', vacation: 'Szabadnap' }

export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function diffHours(s: string | null, e: string | null): number | null {
  if (!s || !e) return null
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}

/** Tényleges ledolgozott óra: műszaknál start→(korai távozás ?? vége); egyébként null. */
export function effHours(p: ShiftInput): number | null {
  if (p.type !== 'shift') return null
  return diffHours(p.start_time || null, p.left_early_at || p.end_time || null)
}

/** Egy bejegyzés órája: műszaknál a tényleges, távollétnél (beteg, szabadság) a nap 8 órája. */
export const shiftHours = (s: ShiftVM) => s.hours ?? (s.type === 'shift' ? diffHours(s.start_time, s.end_time) ?? 0 : 8)

/* ── Dátum- és felirat-segédek (a Naptár nézetei és szerkesztői közösen) ── */

export const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
export const MONTHS_SHORT = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
export const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
export const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const ymdOf = (d: Date) => ymd(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (s: string, n: number) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymdOf(d) }
export const mondayOf = (s: string) => { const d = toDate(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymdOf(d) }
/** „7,5 ó” */
export const fmtH = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} ó`
/** „Nov. 4–5.” / „Nov. 30. – Dec. 2.” */
export function rangeLabel(a: string, b: string) {
  const da = toDate(a), db = toDate(b)
  if (a === b) return `${MONTHS_SHORT[da.getMonth()]} ${da.getDate()}.`
  return da.getMonth() === db.getMonth() ? `${MONTHS_SHORT[da.getMonth()]} ${da.getDate()}–${db.getDate()}.` : `${MONTHS_SHORT[da.getMonth()]} ${da.getDate()}. – ${MONTHS_SHORT[db.getMonth()]} ${db.getDate()}.`
}
/** A műszak rövid ideje a cellán / pillen: „9–17”, „12:30–20”. */
export const shortTime = (t: string | null) => (t ? (t.endsWith(':00') ? String(Number(t.slice(0, 2))) : `${Number(t.slice(0, 2))}:${t.slice(3)}`) : '')
export const shiftLabel = (s: ShiftVM) => (s.type === 'shift' ? (s.start_time ? `${shortTime(s.start_time)}–${shortTime(s.left_early_at ?? s.end_time)}` : 'Műszak') : TYPE_LABEL[s.type])
/** a munkatárs pozíciója (a szerep-felirat „ · meghívva” nélkül) */
export const posOf = (st: StaffVM) => (st.role ?? '').split(' ·')[0].trim()
/** Az a több napos távollét (azonos típusú, egymást követő napok), amelybe a nap esik — a felirathoz („Nov. 4–5.”). */
export function absenceRun(shifts: ShiftVM[], s: ShiftVM): { from: string; to: string } {
  const same = (d: string) => shifts.some((x) => x.staffId === s.staffId && x.date === d && x.type === s.type)
  let from = s.date, to = s.date
  while (same(addDays(from, -1))) from = addDays(from, -1)
  while (same(addDays(to, 1))) to = addDays(to, 1)
  return { from, to }
}
