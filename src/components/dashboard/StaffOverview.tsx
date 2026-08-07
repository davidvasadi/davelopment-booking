'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarClock, CalendarDays, Clock, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { HeroKpi, CARD } from '@/components/dashboard/overview-ui'
import { OccupancyDonut } from '@/components/shared/OverviewCharts'
import { OverviewAccordion, type AccItem } from '@/components/shared/OverviewPanels'
import { PageHeader } from '@/components/ui/page-header'
import type { MyShift } from '@/lib/myShifts'

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long' })
}

function fmtShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })
}

function hoursBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  return mins > 0 ? mins / 60 : 0
}

export function StaffOverview({
  greeting,
  userName,
  roleLabel,
  businessName,
  todayLabel,
  shifts,
  profileImg = null,
  variant = 'salon',
}: {
  greeting: string
  userName: string
  roleLabel: string
  businessName: string
  todayLabel: string
  shifts: MyShift[]
  profileImg?: string | null
  variant?: 'salon' | 'restaurant'
}) {
  const now = new Date()
  const today = ymd(now)
  const dow = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const wStart = ymd(monday)
  const wEnd = ymd(sunday)

  const weekShifts = shifts.filter((s) => s.date >= wStart && s.date <= wEnd)
  const weekHours = weekShifts.reduce((a, s) => a + hoursBetween(s.start, s.end), 0)
  const weekHoursLabel = weekHours ? `${weekHours.toFixed(weekHours % 1 ? 1 : 0)} ó` : '0 ó'

  const next = shifts[0] ?? null
  // KPI: a nagy szám legyen rövid (pl. "09:00"), a kis felirat a dátum
  const nextKpiValue = next ? (next.start ?? '—') : '—'
  const nextKpiLabel = next ? fmtShort(next.date) : 'Következő műszak'

  // StatusPills: e-heti / jövő heti / után
  // +1 a nevező: soha ne töltse ki 100%-ban a fekete sávot, maradjon kis "szabad" csík
  const afterWeek = shifts.filter((s) => s.date > wEnd)
  const totalPill = weekShifts.length + afterWeek.length + 1
  const weekPct = Math.round((weekShifts.length / totalPill) * 100)
  const futurePct = Math.round((Math.min(afterWeek.length, 10) / totalPill) * 100)
  const emptyPct = 100 - weekPct - futurePct

  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [profileImg])

  // ── Heti oszlopdiagram: óra/nap (H–V) ──
  const DOW_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const dtStr = ymd(dt)
    const dayH = weekShifts.filter((s) => s.date === dtStr).reduce((sum, s) => sum + hoursBetween(s.start, s.end), 0)
    return { label: DOW_LABELS[i], value: dayH }
  })
  const weekMax = Math.max(1, ...weekBars.map((b) => b.value))
  const weekPeakVal = Math.max(0, ...weekBars.map((b) => b.value))
  const weekBarsWithPeak = weekBars.map((b) => ({ ...b, peak: b.value === weekPeakVal && weekPeakVal > 0 }))
  const weekLoadPct = Math.min(100, Math.round((weekHours / 40) * 100))

  // ── Havi mini naptár ──
  const calMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const shiftDateSet = new Set(shifts.filter((s) => s.date.startsWith(calMonthStr)).map((s) => s.date))
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const firstDow = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7 // 0=Hétfő
  const monthName = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
  const monthShiftDays = shiftDateSet.size
  const monthDaysPct = Math.round((monthShiftDays / daysInMonth) * 100)

  const settingsHref = variant === 'restaurant' ? '/restaurant/settings?tab=self' : '/dashboard/settings?tab=self'
  const bookingsHref = variant === 'restaurant' ? '/restaurant/bookings' : '/dashboard/bookings'
  const scheduleHref = variant === 'restaurant' ? '/restaurant/schedule' : '/dashboard/schedule'

  // Accordion elemek: csak a legközelebbi 5 műszak részletei
  const accItems: AccItem[] = [
    {
      label: `E heti műszakok (${weekShifts.length})`,
      body: weekShifts.length === 0 ? (
        <div className="py-2 text-[13px] text-ink-soft2">Ezen a héten nincs beosztva.</div>
      ) : (
        <ul className="space-y-1">
          {weekShifts.map((s, i) => (
            <li key={i} className="flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">{fmtDate(s.date)}</span>
              <span className="font-medium text-ink">
                {s.start && s.end ? `${s.start}–${s.end}` : s.start || '—'}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      label: 'Következő 30 nap',
      body: shifts.length === 0 ? (
        <div className="py-2 text-[13px] text-ink-soft2">Nincs közelgő beosztásod.</div>
      ) : (
        <div className="text-[30px] font-light tracking-[-0.02em] text-ink">
          {shifts.length}
          <span className="ml-2 text-[14px] font-medium text-ink-soft">műszak</span>
        </div>
      ),
    },
    {
      label: 'Ledolgozott idő a héten',
      body: (
        <div className="text-[30px] font-light tracking-[-0.02em] text-ink">
          {weekHoursLabel}
          <span className="ml-2 text-[14px] font-medium text-ink-soft">a héten</span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-5 lg:p-0">

      <PageHeader
        eyebrow={businessName}
        title="Áttekintés"
        description={`${greeting}, ${userName} · ${roleLabel} · ${todayLabel}`}
      />

      {/* ── STÁTUSZ-CSÍK + KPI-k ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills
          eager
          className="w-full max-w-[440px]"
          segments={[
            { label: 'E héten', pct: weekPct, background: '#1D1C19', color: '#fff', value: weekShifts.length, suffix: ' db' },
            { label: 'Közelgő', pct: futurePct, background: '#F1CE45', color: '#1D1C19', value: afterWeek.length, suffix: ' db' },
            ...(emptyPct > 0
              ? [{ label: 'Szabad', pct: emptyPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' as const, value: daysInMonth - monthShiftDays, suffix: ' nap' }]
              : []),
          ]}
        />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <HeroKpi icon={CalendarDays} value={String(weekShifts.length)} label="Műszak a héten" />
          <HeroKpi icon={Clock} value={weekHoursLabel} label="Óra a héten" />
          <HeroKpi icon={CalendarClock} value={nextKpiValue} label={nextKpiLabel} />
        </div>
      </div>

      {/* ── BENTO — 2 oszlop (mint a főoldal, profil + content) ── */}
      <div className="grid grid-cols-1 gap-[5px] lg:grid-cols-[300px_minmax(0,1fr)] lg:items-stretch">

        {/* COL1: Profil-chip + accordion */}
        <div className="flex flex-col gap-[5px]">
          {/* Portré profil-kártya — 1:1 a tulajdonos overview-val (frosted glass overlay) */}
          <div className={`${CARD} group relative shrink-0 overflow-hidden p-0`} style={{ aspectRatio: '0.82', transform: 'translateZ(0)' }}>
            <Link href={settingsHref} aria-label="Saját profil" className="absolute inset-0 z-20" />
            {profileImg && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImg} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/30" style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }} />
                <UserRound className="relative h-20 w-20" strokeWidth={1.2} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  top: '-64px',
                  background: 'rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(36px) saturate(125%)',
                  WebkitBackdropFilter: 'blur(36px) saturate(125%)',
                  maskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,.45)' }}>
                  <div className="truncate text-[17px] font-semibold leading-tight text-white">{userName}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-white/85">{roleLabel}</div>
                </div>
                <span
                  className="shrink-0 rounded-[14px] px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{
                    background: 'transparent',
                    backdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    WebkitBackdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    textShadow: '0 1px 3px rgba(0,0,0,.45)',
                  }}
                >
                  {weekShifts.length} e héten
                </span>
              </div>
            </div>
          </div>

          {/* Accordion */}
          <div className="min-h-0 flex-1">
            <OverviewAccordion items={accItems} defaultOpen={0} />
          </div>
        </div>

        {/* COL2: 2 grafikon-kártya + műszak-idővonal (mint a tulaj overview) */}
        <div className="flex min-h-0 flex-col gap-[5px]">

          <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-2">
            {/* Heti műszakok — oszlopdiagram */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="text-[17px] font-medium text-ink">Heti műszakok</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[32px] font-light tracking-[-0.02em] text-ink">{weekHoursLabel}</span>
                <span className="text-[11.5px] leading-[1.2] text-ink-soft">óra<br />e héten</span>
              </div>
              <div className="mt-4 flex flex-1 flex-col justify-end">
                <div className="relative flex items-end justify-between gap-1.5" style={{ minHeight: '118px' }}>
                  <div className="pointer-events-none absolute inset-x-0 bottom-[3px] border-t border-dashed border-[#d9d4c5]" />
                  {weekBarsWithPeak.map((b, i) => (
                    <div key={i} className="group relative z-10 flex flex-1 cursor-default flex-col items-center justify-end">
                      {b.peak && weekPeakVal > 0 ? <span className="mb-1.5 rounded-[8px] bg-gold px-2 py-0.5 text-[10px] font-bold text-ink-dark">{b.value}ó</span> : null}
                      <div className="w-[6px] rounded-full" style={{ height: `${Math.max(8, (b.value / weekMax) * 92)}px`, background: b.peak ? '#F1CE45' : '#1D1C19' }} />
                      <span className="mt-1.5 h-[6px] w-[6px] rounded-full" style={{ background: b.peak ? '#F1CE45' : '#c9c3b4' }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between gap-1.5">
                  {weekBarsWithPeak.map((b, i) => (
                    <span key={i} className="flex-1 text-center text-[10px] font-medium text-ink-soft">{b.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Havi beosztás — donut (napok a hónapban) */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="text-[17px] font-medium text-ink">Havi beosztás</div>
              <div className="flex flex-1 items-center justify-center py-1">
                <div className="scale-[1.08]">
                  <OccupancyDonut pct={monthDaysPct} centerLabel="beosztva" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-[15px] font-semibold text-ink">{monthShiftDays}</div>
                  <div className="text-[11px] text-[#A8A496]">munkanap</div>
                </div>
                <div className="h-[24px] w-px bg-line-strong" />
                <div className="text-center">
                  <div className="text-[15px] font-semibold text-ink">{daysInMonth - monthShiftDays}</div>
                  <div className="text-[11px] text-[#A8A496]">szabad nap</div>
                </div>
                <div className="h-[24px] w-px bg-line-strong" />
                <div className="text-center">
                  <div className="text-[15px] font-semibold text-ink">{daysInMonth}</div>
                  <div className="text-[11px] text-[#A8A496]">összesen</div>
                </div>
              </div>
            </div>
          </div>

          {/* Közelgő műszakok lista */}
          <div className={`${CARD} flex flex-col p-[22px]`}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[17px] font-medium text-ink">Közelgő műszakok</div>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-dark">
                {shifts.length} beosztva
              </span>
            </div>

            {shifts.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <CalendarClock className="mx-auto h-10 w-10 text-ink-soft2/30" strokeWidth={1.3} />
                <div className="mt-3 text-[14px] font-medium text-ink-soft">Nincs közelgő beosztásod</div>
                <div className="mt-1 text-[12.5px] text-ink-soft2">A beosztás-kezelő felveszi a műszakokat</div>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {shifts.slice(0, 20).map((s, i) => {
                  const isToday = s.date === today
                  const hours = hoursBetween(s.start, s.end)
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-3 py-3 ${isToday ? 'rounded-[14px] bg-gold/10 px-3' : ''}`}
                    >
                      <div className="flex w-[48px] shrink-0 flex-col items-center rounded-[11px] bg-[#F4F2EC] px-1.5 py-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                          {new Date(s.date).toLocaleDateString('hu-HU', { month: 'short' })}
                        </span>
                        <span className="text-[20px] font-light leading-none text-ink">
                          {new Date(s.date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium text-ink">
                          {fmtDate(s.date)}
                          {isToday && (
                            <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-ink-dark">Ma</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-ink-soft">
                          {s.start && s.end ? `${s.start} – ${s.end}` : s.start ? `${s.start}-tól` : 'Egész nap'}
                        </div>
                      </div>
                      {hours > 0 && (
                        <div className="shrink-0 text-[13px] font-semibold text-ink">
                          {hours.toFixed(hours % 1 ? 1 : 0)} ó
                        </div>
                      )}
                    </li>
                  )
                })}
                {shifts.length > 20 && (
                  <li className="py-3 text-center text-[12.5px] text-ink-soft">
                    +{shifts.length - 20} további műszak
                  </li>
                )}
              </ul>
            )}

            <div className="mt-4 border-t border-line pt-4">
              <Link
                href={scheduleHref}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
              >
                <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
                Naptár megtekintése
                <ArrowUpRight className="h-3.5 w-3.5 text-ink-soft2" strokeWidth={2} />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
