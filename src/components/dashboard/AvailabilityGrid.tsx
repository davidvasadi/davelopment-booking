'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Clock } from 'lucide-react'
import type { Availability } from '@/payload/payload-types'
import { TimeSelect } from '@/components/ui/time-select'
import { cn } from '@/lib/utils'

const DAYS = [
  { key: 'monday', label: 'Hétfő', abbr: 'Hé' },
  { key: 'tuesday', label: 'Kedd', abbr: 'Ke' },
  { key: 'wednesday', label: 'Szerda', abbr: 'Sze' },
  { key: 'thursday', label: 'Csütörtök', abbr: 'Csü' },
  { key: 'friday', label: 'Péntek', abbr: 'Pé' },
  { key: 'saturday', label: 'Szombat', abbr: 'Szo' },
  { key: 'sunday', label: 'Vasárnap', abbr: 'Va' },
] as const

type DayKey = typeof DAYS[number]['key']

interface DayState {
  id?: string
  is_available: boolean
  start_time: string
  end_time: string
  dirty: boolean
}

interface Props {
  salonId: string
  staffId?: string
  initialRecords: Availability[]
}

/** Perc két HH:mm időpont közt. */
function minutesBetween(open: string, close: string): number {
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  if ([oh, om, ch, cm].some(Number.isNaN)) return 0
  return Math.max(0, ch * 60 + cm - (oh * 60 + om))
}

function DayBadge({ abbr }: { abbr: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-[11px] font-bold text-ink-soft2">
      {abbr}
    </span>
  )
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-md">
      <p className="text-2xl font-light tracking-[-0.02em]">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/45 truncate">{label}</p>
    </div>
  )
}

function buildInitialState(records: Availability[]): Record<DayKey, DayState> {
  const map = Object.fromEntries(
    DAYS.map(d => [d.key, { is_available: false, start_time: '09:00', end_time: '18:00', dirty: false }])
  ) as Record<DayKey, DayState>

  for (const rec of records) {
    map[rec.day_of_week as DayKey] = {
      id: rec.id,
      is_available: rec.is_available ?? false,
      start_time: rec.start_time,
      end_time: rec.end_time,
      dirty: false,
    }
  }
  return map
}

export default function AvailabilityGrid({ salonId, staffId, initialRecords }: Props) {
  const [rows, setRows] = useState(() => buildInitialState(initialRecords))
  const [savingAll, setSavingAll] = useState(false)

  const toggle = (day: DayKey) =>
    setRows(prev => ({ ...prev, [day]: { ...prev[day], is_available: !prev[day].is_available, dirty: true } }))

  const setTime = (day: DayKey, field: 'start_time' | 'end_time', value: string) =>
    setRows(prev => ({ ...prev, [day]: { ...prev[day], [field]: value, dirty: true } }))

  const stats = useMemo(() => {
    const open = DAYS.filter(d => rows[d.key].is_available)
    const weeklyMin = open.reduce((s, d) => s + minutesBetween(rows[d.key].start_time, rows[d.key].end_time), 0)
    return { openCount: open.length, weeklyHours: Math.round(weeklyMin / 60) }
  }, [rows])

  const dirtyCount = useMemo(() => DAYS.filter(d => rows[d.key].dirty).length, [rows])

  const persist = async (day: DayKey, row: DayState): Promise<DayState> => {
    if (row.id) {
      const res = await fetch(`/api/availability/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          salon: Number(salonId),
          is_available: row.is_available,
          start_time: row.start_time,
          end_time: row.end_time,
        }),
      })
      if (!res.ok) throw new Error()
      return { ...row, dirty: false }
    }
    if (row.is_available) {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          salon: salonId,
          ...(staffId ? { staff: staffId } : {}),
          day_of_week: day,
          is_available: true,
          start_time: row.start_time,
          end_time: row.end_time,
          recurring: true,
        }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      return { ...row, id: json.doc.id, dirty: false }
    }
    return { ...row, dirty: false }
  }

  const saveAll = async () => {
    setSavingAll(true)
    try {
      const next = { ...rows }
      for (const { key } of DAYS) {
        if (next[key].dirty) next[key] = await persist(key, next[key])
      }
      setRows(next)
      toast.success('Minden módosítás mentve')
    } catch {
      toast.error('Néhány nap mentése nem sikerült')
    } finally {
      setSavingAll(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero — sötét kártya */}
      <div className="relative overflow-hidden rounded-[26px] bg-ink-dark text-white p-5 lg:p-7 shadow-dav-card">
        <Clock className="absolute -right-8 -bottom-10 h-44 w-44 text-white/[0.05]" />
        <span className="absolute right-5 top-5 z-10 flex items-center gap-1.5 rounded-dav-pill border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
          <span className={cn('h-2 w-2 rounded-full', stats.openCount > 0 ? 'bg-gold shadow-[0_0_8px_var(--dav-accent)]' : 'bg-white/30')} />
          {stats.openCount > 0 ? 'Elérhető' : 'Zárva'}
        </span>
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Heti elérhetőség</p>
          <h2 className="mt-1 text-2xl lg:text-3xl font-light tracking-[-0.02em]">Nyitvatartás</h2>
          <p className="mt-1 text-sm text-white/55 lg:hidden">{stats.openCount}/7 nap elérhető · {stats.weeklyHours} óra/hét</p>
          <div className="hidden lg:flex gap-3 mt-6">
            <HeroStat value={`${stats.openCount}/7`} label="Elérhető nap / hét" />
            <HeroStat value={`${stats.weeklyHours} ó`} label="Heti óraszám" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[26px] dav-card-glass">
        {/* DESKTOP fejléc */}
        <div className="hidden grid-cols-3 items-center gap-x-6 border-b border-line px-8 py-3.5 lg:grid">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft2">Nap</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft2">Állapot</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft2 text-right">Nyitvatartás</span>
        </div>

        {DAYS.map(({ key, label, abbr }, i) => {
          const row = rows[key]
          return (
            <div
              key={key}
              className={cn(
                'transition-colors',
                i < DAYS.length - 1 && 'border-b border-line',
                !row.is_available && 'lg:bg-paper/40'
              )}
            >
              {/* MOBIL */}
              <div className="flex items-center gap-3 px-4 py-3.5 lg:hidden">
                <DayBadge abbr={abbr} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  {row.is_available ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <TimeSelect value={row.start_time} onChange={v => setTime(key, 'start_time', v)} className="min-w-0 flex-1" />
                      <span className="shrink-0 text-sm text-ink-soft2">–</span>
                      <TimeSelect value={row.end_time} onChange={v => setTime(key, 'end_time', v)} className="min-w-0 flex-1" />
                    </div>
                  ) : (
                    <p className="text-xs text-ink-soft">Zárva</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-label={row.is_available ? 'Zárás' : 'Nyitás'}
                  className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', row.is_available ? 'bg-ink-dark' : 'bg-line-strong')}
                >
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', row.is_available ? 'left-5' : 'left-1')} />
                </button>
              </div>

              {/* DESKTOP */}
              <div className="hidden items-center gap-x-6 px-8 py-3.5 lg:grid lg:grid-cols-3">
                <div className="flex items-center gap-3">
                  <DayBadge abbr={abbr} />
                  <p className={cn('text-[15px] font-semibold', row.is_available ? 'text-ink' : 'text-ink-soft2')}>{label}</p>
                </div>

                <button type="button" onClick={() => toggle(key)} className="flex items-center gap-2.5">
                  <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', row.is_available ? 'bg-ink-dark' : 'bg-line-strong')}>
                    <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all', row.is_available ? 'left-5' : 'left-1')} />
                  </span>
                  <span className={cn('text-xs font-medium', row.is_available ? 'text-ink-soft' : 'text-ink-soft2')}>
                    {row.is_available ? 'Nyitva' : 'Zárva'}
                  </span>
                </button>

                <div className="flex items-center justify-end">
                  {row.is_available ? (
                    <div className="flex items-center gap-3">
                      <TimeSelect value={row.start_time} onChange={v => setTime(key, 'start_time', v)} className="w-[7rem]" />
                      <span className="text-sm text-ink-soft2">–</span>
                      <TimeSelect value={row.end_time} onChange={v => setTime(key, 'end_time', v)} className="w-[7rem]" />
                    </div>
                  ) : (
                    <p className="text-sm text-ink-soft2">Egész nap zárva</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Közös mentés-sáv (warning) */}
      {dirtyCount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-[22px] border border-amber-300/50 bg-amber-50 px-5 py-3.5 lg:px-6">
          <p className="text-sm font-medium text-amber-800">{dirtyCount} nem mentett módosítás</p>
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-dav-pill bg-amber-500 px-5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {savingAll ? 'Mentés...' : 'Összes mentése'}
          </button>
        </div>
      )}
    </div>
  )
}
