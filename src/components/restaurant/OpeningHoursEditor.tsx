'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CalendarDays, Clock, Hourglass } from 'lucide-react'
import { DAY_LABELS_HU, DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import { TimeSelect } from '@/components/ui/time-select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { WheelTimePicker } from '@/components/ui/wheel-time-picker'
import { cn } from '@/lib/utils'

/** 2 betűs nap-rövidítések a badge-hez. */
const DAY_ABBR: Record<DayOfWeek, string> = {
  monday: 'Hé', tuesday: 'Ke', wednesday: 'Sze', thursday: 'Csü', friday: 'Pé', saturday: 'Szo', sunday: 'Va',
}

/** Perc két HH:mm időpont közt (záróra > nyitás). */
function minutesBetween(open: string, close: string): number {
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  if ([oh, om, ch, cm].some(Number.isNaN)) return 0
  return Math.max(0, ch * 60 + cm - (oh * 60 + om))
}

function DayBadge({ day }: { day: DayOfWeek }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-[11px] font-bold text-zinc-500 dark:bg-white/[0.06] dark:text-white/50">
      {DAY_ABBR[day]}
    </span>
  )
}

/** Kompakt üveges stat-elem a sötét heron belül. */
function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 backdrop-blur-md">
      <p className="text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/45 truncate">{label}</p>
    </div>
  )
}

type DayRow = {
  day_of_week: DayOfWeek
  id: number | string | null
  is_open: boolean
  open_time: string
  close_time: string
  dirty?: boolean
}

export function OpeningHoursEditor({
  restaurantId,
  initialDays,
  turnMinutes,
}: {
  restaurantId: number | string
  initialDays: DayRow[]
  /** Átlag ülésidő (turnus) perc — a 3. stat-kártyához. */
  turnMinutes?: number | null
}) {
  const router = useRouter()
  const [days, setDays] = useState<DayRow[]>(initialDays)
  const [saving, setSaving] = useState<DayOfWeek | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  // Mobil szerkesztő sheet: melyik nap + mely napokra alkalmazzuk + nyitva-e a picker.
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [applyDays, setApplyDays] = useState<Set<DayOfWeek>>(new Set())
  const [picker, setPicker] = useState<'open' | 'close' | null>(null)

  // Élő statisztika a kapcsolók/idők alapján.
  const stats = useMemo(() => {
    const openDays = days.filter((d) => d.is_open)
    const weeklyMin = openDays.reduce((s, d) => s + minutesBetween(d.open_time, d.close_time), 0)
    return { openCount: openDays.length, weeklyHours: Math.round(weeklyMin / 60) }
  }, [days])

  const update = (idx: number, patch: Partial<DayRow>) =>
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch, dirty: true } : d)))

  const persist = async (d: DayRow): Promise<DayRow> => {
    const payload = {
      restaurant: restaurantId,
      day_of_week: d.day_of_week,
      is_open: d.is_open,
      open_time: d.open_time,
      close_time: d.close_time,
    }
    const res = d.id
      ? await fetch(`/api/opening-hours/${d.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
      : await fetch('/api/opening-hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
    if (!res.ok) throw new Error()
    const json = await res.json()
    return { ...d, id: d.id ?? json.doc?.id ?? null, dirty: false }
  }

  const saveRow = async (idx: number) => {
    const d = days[idx]
    setSaving(d.day_of_week)
    try {
      const saved = await persist(d)
      setDays((prev) => prev.map((x, i) => (i === idx ? saved : x)))
      router.refresh()
      toast.success('Mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(null)
    }
  }

  const dirtyCount = useMemo(() => days.filter((d) => d.dirty).length, [days])

  const openSheet = (idx: number) => { setApplyDays(new Set([days[idx].day_of_week])); setEditIdx(idx) }
  const toggleApply = (day: DayOfWeek) =>
    setApplyDays((prev) => { const n = new Set(prev); if (n.has(day)) n.delete(day); else n.add(day); return n })

  // Mobil: a kapcsoló azonnal ment.
  const quickToggle = async (idx: number) => {
    const next = { ...days[idx], is_open: !days[idx].is_open, dirty: true }
    setDays((prev) => prev.map((x, i) => (i === idx ? next : x)))
    try {
      const saved = await persist(next)
      setDays((prev) => prev.map((x, i) => (i === idx ? saved : x)))
      router.refresh()
    } catch { toast.error('Hiba történt') }
  }

  // Sheet mentés: a szerkesztett nap beállításait a kijelölt napokra menti.
  const saveSheet = async () => {
    if (editIdx == null) return
    const src = days[editIdx]
    setSavingAll(true)
    try {
      const next = [...days]
      for (let i = 0; i < next.length; i++) {
        if (applyDays.has(next[i].day_of_week)) {
          next[i] = await persist({ ...next[i], is_open: src.is_open, open_time: src.open_time, close_time: src.close_time })
        }
      }
      setDays(next)
      router.refresh()
      toast.success('Mentve')
      setEditIdx(null)
    } catch { toast.error('Hiba történt') } finally { setSavingAll(false) }
  }

  const saveAll = async () => {
    setSavingAll(true)
    try {
      const next = [...days]
      for (let i = 0; i < next.length; i++) {
        if (next[i].dirty) next[i] = await persist(next[i])
      }
      setDays(next)
      router.refresh()
      toast.success('Minden módosítás mentve')
    } catch {
      toast.error('Néhány nap mentése nem sikerült')
    } finally {
      setSavingAll(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero — mobilon cím + összegző, desktopon a 3 stat is */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 dark:bg-white/[0.04] text-white p-5 lg:p-7 shadow-lg">
        <Clock className="absolute -right-8 -bottom-10 h-44 w-44 text-white/[0.05]" />
        {/* Nyitva/Zárva pill — jobb felső sarok (üveges) */}
        <span className="absolute right-5 top-5 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 shadow-sm backdrop-blur-md">
          <span className={cn('h-2 w-2 rounded-full', stats.openCount > 0 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-zinc-400')} />
          {stats.openCount > 0 ? 'Nyitva' : 'Zárva'}
        </span>
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Foglalási idősávok</p>
          <h2 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">Heti nyitvatartás</h2>
          <p className="mt-1 text-sm text-white/55 lg:hidden">{stats.openCount}/7 nap nyitva · {stats.weeklyHours} óra/hét</p>
          {/* 3 kompakt üveges stat — csak desktopon, a cím alatt */}
          <div className="hidden lg:flex gap-3 mt-6">
            <HeroStat value={`${stats.openCount}/7`} label="Nyitva nap / hét" />
            <HeroStat value={`${stats.weeklyHours} ó`} label="Heti óraszám" />
            <HeroStat value={turnMinutes ? `${turnMinutes} p` : '—'} label="Átlag ülésidő" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
        {/* ── DESKTOP fejléc (lg+) ── */}
        <div className="hidden grid-cols-3 items-center gap-x-6 border-b border-zinc-100 px-8 py-3.5 dark:border-white/[0.06] lg:grid">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">
            Nap
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">
            Állapot
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">
            Nyitvatartás
          </span>
        </div>

        {days.map((d, idx) => {
          const isSaving = saving === d.day_of_week
          return (
            <div
              key={d.day_of_week}
              className={cn(
                'transition-colors',
                idx < days.length - 1 && 'border-b border-zinc-100 dark:border-white/[0.06]',
                !d.is_open && 'lg:bg-zinc-50/50 dark:lg:bg-white/[0.015]'
              )}
            >
              {/* ════════ MOBIL (< lg) — tappolható sor, a szerkesztő sheetet nyitja ════════ */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openSheet(idx)}
                className="flex items-center gap-3 px-4 py-3.5 lg:hidden cursor-pointer"
              >
                <DayBadge day={d.day_of_week} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{DAY_LABELS_HU[d.day_of_week]}</p>
                  <p className="text-xs text-zinc-400 dark:text-white/35">{d.is_open ? `${d.open_time} – ${d.close_time}` : 'Zárva'}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); quickToggle(idx) }}
                  aria-label={d.is_open ? 'Zárás' : 'Nyitás'}
                  className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', d.is_open ? 'bg-[#5B54E8]' : 'bg-zinc-200 dark:bg-white/[0.1]')}
                >
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', d.is_open ? 'left-5' : 'left-1')} />
                </button>
              </div>

              {/* ════════ DESKTOP (lg+) — új elrendezés ════════ */}
              <div className="hidden items-center gap-x-6 px-8 py-3.5 lg:grid lg:grid-cols-3">
                {/* Nap */}
                <div className="flex items-center gap-3">
                  <DayBadge day={d.day_of_week} />
                  <p
                    className={cn(
                      'text-[15px] font-semibold',
                      d.is_open ? 'text-zinc-800 dark:text-white/90' : 'text-zinc-400 dark:text-white/35'
                    )}
                  >
                    {DAY_LABELS_HU[d.day_of_week]}
                  </p>
                </div>

                {/* Állapot: kapcsoló + felirat */}
                <button
                  type="button"
                  onClick={() => update(idx, { is_open: !d.is_open })}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={cn(
                      'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                      d.is_open ? 'bg-[#5B54E8]' : 'bg-zinc-200 dark:bg-white/[0.12]'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all',
                        d.is_open ? 'left-5' : 'left-1'
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      d.is_open ? 'text-zinc-500 dark:text-white/50' : 'text-zinc-400 dark:text-white/30'
                    )}
                  >
                    {d.is_open ? 'Nyitva' : 'Zárva'}
                  </span>
                </button>

                {/* Nyitvatartás — automatikusan a lenti mentés-sávval mentődik */}
                <div className="flex items-center justify-end">
                  {d.is_open ? (
                    <div className="flex items-center gap-3">
                      <TimeSelect
                        value={d.open_time}
                        onChange={(v) => update(idx, { open_time: v })}
                        className="w-[7rem]"
                      />
                      <span className="text-sm text-zinc-300 dark:text-white/25">–</span>
                      <TimeSelect
                        value={d.close_time}
                        onChange={(v) => update(idx, { close_time: v })}
                        className="w-[7rem]"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 dark:text-white/30">
                      Egész nap zárva
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── DESKTOP közös mentés-sáv (warning) — ha van nem mentett módosítás ── */}
      {dirtyCount > 0 && (
        <div className="hidden items-center justify-between gap-4 rounded-2xl border border-amber-300/50 bg-amber-50 px-6 py-3.5 lg:flex dark:border-amber-400/25 dark:bg-amber-400/[0.08]">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {dirtyCount} nem mentett módosítás
          </p>
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500 px-5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {savingAll ? 'Mentés...' : 'Összes mentése'}
          </button>
        </div>
      )}

      {/* ── MOBIL szerkesztő sheet ── */}
      <Sheet open={editIdx != null} onOpenChange={(o) => { if (!o) setEditIdx(null) }}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-zinc-950 max-h-[85vh] overflow-y-auto">
          {editIdx != null && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <DayBadge day={days[editIdx].day_of_week} />
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-white truncate">{DAY_LABELS_HU[days[editIdx].day_of_week]}</p>
                    <p className="text-xs text-zinc-400 dark:text-white/30">Heti nyitvatartás</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update(editIdx, { is_open: !days[editIdx].is_open })}
                  className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', days[editIdx].is_open ? 'bg-[#5B54E8]' : 'bg-zinc-200 dark:bg-white/[0.1]')}
                >
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', days[editIdx].is_open ? 'left-5' : 'left-1')} />
                </button>
              </div>

              {days[editIdx].is_open ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-2">Idősáv</p>
                  <div className="flex items-center gap-3 mb-6">
                    <button type="button" onClick={() => setPicker('open')} className="flex-1 h-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">{days[editIdx].open_time}</button>
                    <span className="text-sm text-zinc-300 dark:text-white/25">–</span>
                    <button type="button" onClick={() => setPicker('close')} className="flex-1 h-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">{days[editIdx].close_time}</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400 dark:text-white/30 mb-6">Ezen a napon zárva — nem fogadtok foglalást.</p>
              )}

              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-2">Alkalmazás több napra</p>
              <div className="flex flex-wrap gap-2 mb-7">
                {DAYS_OF_WEEK.map((day) => {
                  const on = applyDays.has(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleApply(day)}
                      className={cn(
                        'h-9 min-w-[2.5rem] rounded-xl px-3 text-xs font-bold transition-colors',
                        on ? 'bg-[#5B54E8] text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-white/50'
                      )}
                    >
                      {DAY_ABBR[day]}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setEditIdx(null)} className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-white/[0.1] text-sm font-semibold text-zinc-700 dark:text-white/80">Mégse</button>
                <button type="button" onClick={saveSheet} disabled={savingAll} className="flex-1 h-11 rounded-2xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black">{savingAll ? 'Mentés...' : 'Mentés'}</button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Kerék időválasztó (a szerkesztő sheet fölött) */}
      {editIdx != null && (
        <WheelTimePicker
          open={picker != null}
          onClose={() => setPicker(null)}
          title={picker === 'close' ? 'Záróra' : 'Nyitás'}
          subtitle={DAY_LABELS_HU[days[editIdx].day_of_week]}
          value={picker === 'close' ? days[editIdx].close_time : days[editIdx].open_time}
          onChange={(v) => editIdx != null && update(editIdx, picker === 'close' ? { close_time: v } : { open_time: v })}
          shorthands={picker === 'close' ? ['22:00', '22:30', '23:00', '00:00'] : ['08:00', '09:00', '10:00', '11:00']}
        />
      )}
    </div>
  )
}
