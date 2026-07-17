import { CalendarClock, CalendarDays, Clock } from 'lucide-react'
import type { MyShift } from '@/lib/myShifts'

/**
 * Staff (Dolgozó) személyes áttekintése — az üzleti KPI-k HELYETT a saját műszak-adatok,
 * a cég többi metrikája nélkül. Azonos vizuális nyelv (üveg-kártyák), mint a tulaj/vezető nézeté.
 * Szerver-komponens: a számításokat itt végezzük (nincs interaktivitás).
 */

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long' })
}

/** Órák két HH:MM között (negatívnál 0). */
function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  return mins > 0 ? mins / 60 : 0
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[22px] p-5 lg:p-6 dav-card-glass">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/20 text-ink-dark">{icon}</div>
      <div className="mt-3 text-xl lg:text-3xl font-light tracking-[-0.02em] leading-none text-ink">{value}</div>
      <div className="mt-1.5 text-[13px] font-medium text-ink-soft">{label}</div>
    </div>
  )
}

export function StaffOverview({
  greeting,
  userName,
  roleLabel,
  businessName,
  todayLabel,
  shifts,
}: {
  greeting: string
  userName: string
  roleLabel: string
  businessName: string
  todayLabel: string
  shifts: MyShift[]
}) {
  const now = new Date()
  // A jelenlegi hét (hétfő–vasárnap).
  const dow = (now.getDay() + 6) % 7 // 0 = hétfő
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const wStart = ymd(monday)
  const wEnd = ymd(sunday)

  const weekShifts = shifts.filter((s) => s.date >= wStart && s.date <= wEnd)
  const weekHours = weekShifts.reduce((a, s) => a + hoursBetween(s.start, s.end), 0)
  const next = shifts[0] ?? null
  const nextValue = next
    ? `${fmtDate(next.date)}${next.start ? ` · ${next.start}` : ''}`
    : '—'

  return (
    <div className="space-y-6 p-5 lg:p-0">
      {/* Hero — személyes köszöntés */}
      <div>
        <div className="text-[15px] text-ink-soft">{greeting},</div>
        <h1 className="text-4xl lg:text-[46px] font-light leading-[1.05] tracking-[-0.02em] text-ink">{userName}</h1>
        <div className="mt-2 text-[13px] text-ink-soft">
          {roleLabel} · {businessName} · {todayLabel}
        </div>
      </div>

      {/* Személyes KPI-k */}
      <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-3">
        <KpiCard icon={<CalendarClock className="h-[18px] w-[18px]" strokeWidth={1.8} />} label="Következő műszak" value={nextValue} />
        <KpiCard icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} />} label="Műszak a héten" value={String(weekShifts.length)} />
        <KpiCard icon={<Clock className="h-[18px] w-[18px]" strokeWidth={1.8} />} label="Óra a héten" value={weekHours ? `${weekHours.toFixed(weekHours % 1 ? 1 : 0)} ó` : '0 ó'} />
      </div>

      {/* Közelgő műszakok */}
      <div className="rounded-[26px] p-5 lg:p-6 dav-card-glass">
        <div className="mb-4 text-[17px] font-medium text-ink">Közelgő műszakok</div>
        {shifts.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-ink-soft">Nincs beosztott műszakod a közeljövőben.</div>
        ) : (
          <ul className="divide-y divide-line">
            {shifts.slice(0, 12).map((s, i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <span className="text-[14px] text-ink">{fmtDate(s.date)}</span>
                <span className="text-[13px] font-semibold text-ink">
                  {s.start && s.end ? `${s.start} – ${s.end}` : s.start || 'egész nap'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
