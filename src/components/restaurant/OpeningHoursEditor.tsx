'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { DAY_LABELS_HU, type DayOfWeek } from '@/lib/restaurantTemplates'
import { TimeSelect } from '@/components/ui/time-select'
import { cn } from '@/lib/utils'

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
}: {
  restaurantId: number | string
  initialDays: DayRow[]
}) {
  const router = useRouter()
  const [days, setDays] = useState<DayRow[]>(initialDays)
  const [saving, setSaving] = useState<DayOfWeek | null>(null)
  const [savingAll, setSavingAll] = useState(false)

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
    <div className="space-y-4">
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
              {/* ════════ MOBIL (< lg) — változatlan ════════ */}
              <div className="px-4 py-4 sm:px-6 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <p className="text-sm font-semibold text-zinc-700 dark:text-white/80">
                      {DAY_LABELS_HU[d.day_of_week]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => update(idx, { is_open: !d.is_open })}
                      className={cn(
                        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                        d.is_open ? 'bg-[#0099ff]' : 'bg-zinc-200 dark:bg-white/[0.1]'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 h-4 w-4 rounded-full bg-white transition-all',
                          d.is_open ? 'left-5' : 'left-1'
                        )}
                      />
                    </button>
                  </div>
                  {d.is_open ? (
                    <div className="flex flex-1 items-center gap-2">
                      <TimeSelect
                        value={d.open_time}
                        onChange={(v) => update(idx, { open_time: v })}
                        className="w-full max-w-[8rem]"
                      />
                      <span className="text-center text-sm text-zinc-400 dark:text-white/30">–</span>
                      <TimeSelect
                        value={d.close_time}
                        onChange={(v) => update(idx, { close_time: v })}
                        className="w-full max-w-[8rem]"
                      />
                    </div>
                  ) : (
                    <p className="flex-1 text-sm text-zinc-400 dark:text-white/30">Zárva</p>
                  )}
                </div>
                {d.dirty && (
                  <button
                    onClick={() => saveRow(idx)}
                    disabled={isSaving}
                    className="mt-3 h-9 w-full rounded-full bg-zinc-900 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  >
                    {isSaving ? '...' : 'Mentés'}
                  </button>
                )}
              </div>

              {/* ════════ DESKTOP (lg+) — új elrendezés ════════ */}
              <div className="hidden items-center gap-x-6 px-8 py-3.5 lg:grid lg:grid-cols-3">
                {/* Nap */}
                <p
                  className={cn(
                    'text-[15px] font-semibold',
                    d.is_open ? 'text-zinc-800 dark:text-white/90' : 'text-zinc-400 dark:text-white/35'
                  )}
                >
                  {DAY_LABELS_HU[d.day_of_week]}
                </p>

                {/* Állapot: kapcsoló + felirat */}
                <button
                  type="button"
                  onClick={() => update(idx, { is_open: !d.is_open })}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={cn(
                      'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                      d.is_open ? 'bg-[#0099ff]' : 'bg-zinc-200 dark:bg-white/[0.12]'
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

                {/* Nyitvatartás + soron belüli mentés */}
                <div className="flex items-center justify-between gap-4">
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
                      Ezen a napon nem fogadtok foglalást
                    </p>
                  )}

                  {d.dirty && (
                    <button
                      onClick={() => saveRow(idx)}
                      disabled={isSaving}
                      className="h-8 shrink-0 rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      {isSaving ? '...' : 'Mentés'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── DESKTOP „összes mentése” sáv — csak ha több piszkos sor van ── */}
      {dirtyCount > 1 && (
        <div className="hidden items-center justify-between gap-4 rounded-2xl border border-[#0099ff]/20 bg-[#0099ff]/[0.06] px-6 py-3.5 lg:flex dark:border-[#0099ff]/25 dark:bg-[#0099ff]/[0.08]">
          <p className="text-sm font-medium text-zinc-600 dark:text-white/60">
            {dirtyCount} nem mentett módosítás
          </p>
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0099ff] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#0088ee] disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {savingAll ? 'Mentés...' : 'Összes mentése'}
          </button>
        </div>
      )}
    </div>
  )
}
