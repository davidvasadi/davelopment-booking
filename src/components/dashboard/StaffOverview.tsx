import { StaffHome, type StaffShiftRow } from '@/components/blocks/overview'
import type { WeekBar } from '@/components/blocks/charts'
import type { MyShift } from '@/lib/myShifts'

/**
 * A munkatárs (nem tulaj) Áttekintése — design 4.7: a saját hete (műszakok, órák, következő műszak), profil, a hét órái
 * napra bontva, a hónap beosztott napjai, a közelgő műszakok. Az adat a `lib/myShifts` (ma-tól előre).
 */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoursBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return 0
  const [sh, sm] = a.split(':').map(Number), [eh, em] = b.split(':').map(Number)
  const m = eh * 60 + em - (sh * 60 + sm)
  return m > 0 ? m / 60 : 0
}
const fmtH = (h: number) => `${h % 1 ? h.toFixed(1).replace('.', ',') : h} ó`
const cap = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase())
const DOW = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

export function StaffOverview({ greeting, userName, roleLabel, businessName, todayLabel, shifts, profileImg = null, variant = 'salon' }: {
  greeting: string; userName: string; roleLabel: string; businessName: string; todayLabel: string
  shifts: MyShift[]; profileImg?: string | null; variant?: 'salon' | 'restaurant'
}) {
  const base = variant === 'restaurant' ? '/restaurant' : '/dashboard'
  const now = new Date()
  const today = ymd(now)
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)))
  const week = shifts.filter((s) => s.date >= days[0] && s.date <= days[6])
  const weekHours = week.reduce((n, s) => n + hoursBetween(s.start, s.end), 0)
  const bars: WeekBar[] = days.map((d, i) => {
    const v = Math.round(shifts.filter((s) => s.date === d).reduce((n, s) => n + hoursBetween(s.start, s.end), 0) * 10) / 10
    return { d: DOW[i], v, peak: d === today, closed: v === 0 }
  })
  const dayLabel = (d: string) => (d === today ? 'Ma' : d === tomorrow ? 'Holnap' : cap(new Date(`${d}T12:00:00`).toLocaleDateString('hu-HU', { weekday: 'short', month: 'short', day: 'numeric' })))
  const next = shifts[0] ?? null
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthKey = today.slice(0, 7)
  const monthDays = new Set(shifts.filter((s) => s.date.startsWith(monthKey)).map((s) => s.date)).size
  const limit = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30))
  const rows: StaffShiftRow[] = shifts.filter((s) => s.date <= limit).slice(0, 12).map((s, i) => ({
    key: `${s.date}-${i}`,
    day: s.date === today ? `Ma, ${cap(new Date(`${s.date}T12:00:00`).toLocaleDateString('hu-HU', { weekday: 'long' }))}` : dayLabel(s.date),
    time: s.start && s.end ? `${s.start} – ${s.end}` : 'egész nap', hours: fmtH(hoursBetween(s.start, s.end)), today: s.date === today,
  }))

  return (
    <div className="p-4 lg:p-0">
      <StaffHome greeting={`${greeting}, ${userName.split(' ').slice(-1)[0] || userName}!`} sub={`${todayLabel} · ${businessName}`}
        weekCount={week.length} weekHours={fmtH(Math.round(weekHours * 10) / 10)}
        next={next ? { value: next.start ?? '—', label: dayLabel(next.date) } : null}
        profile={{ name: userName, role: roleLabel, img: profileImg }} profileHref={`${base}/settings?tab=self`}
        week={bars} monthPct={Math.round((monthDays / daysInMonth) * 100)} monthFoot={['beosztott nap', `${monthDays} / ${daysInMonth}`]}
        shifts={rows} scheduleHref={`${base}/schedule`} />
    </div>
  )
}
