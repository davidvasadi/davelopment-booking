'use client'

import { useState } from 'react'
import { toast } from 'sonner'
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
  const [days, setDays] = useState<DayRow[]>(initialDays)
  const [saving, setSaving] = useState<DayOfWeek | null>(null)

  const update = (idx: number, patch: Partial<DayRow>) =>
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch, dirty: true } : d)))

  const saveRow = async (idx: number) => {
    const d = days[idx]
    setSaving(d.day_of_week)
    try {
      const payload = {
        restaurant: restaurantId,
        day_of_week: d.day_of_week,
        is_open: d.is_open,
        open_time: d.open_time,
        close_time: d.close_time,
      }
      let res: Response
      if (d.id) {
        res = await fetch(`/api/opening-hours/${d.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/opening-hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
      }
      if (!res.ok) throw new Error()
      const json = await res.json()
      const newId = d.id ?? json.doc?.id ?? null
      setDays((prev) => prev.map((x, i) => (i === idx ? { ...x, id: newId, dirty: false } : x)))
      toast.success('Mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
      {days.map((d, idx) => (
        <div
          key={d.day_of_week}
          className={cn(
            'px-4 py-4 transition-colors sm:px-6',
            idx < days.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.06]' : ''
          )}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-20 shrink-0 sm:w-24">
              <p className="text-sm font-semibold text-zinc-700 dark:text-white/80">{DAY_LABELS_HU[d.day_of_week]}</p>
            </div>

            <button
              type="button"
              onClick={() => update(idx, { is_open: !d.is_open })}
              className={cn(
                'w-10 h-6 rounded-full transition-colors relative shrink-0',
                d.is_open ? 'bg-[#0099ff]' : 'bg-zinc-200 dark:bg-white/[0.1]'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                  d.is_open ? 'left-5' : 'left-1'
                )}
              />
            </button>

            {d.is_open ? (
              <div className="flex flex-1 items-center gap-2">
                <TimeSelect
                  value={d.open_time}
                  onChange={(v) => update(idx, { open_time: v })}
                  className="w-full max-w-[8rem] sm:w-32"
                />
                <span className="text-zinc-400 dark:text-white/30 text-sm">–</span>
                <TimeSelect
                  value={d.close_time}
                  onChange={(v) => update(idx, { close_time: v })}
                  className="w-full max-w-[8rem] sm:w-32"
                />
                {d.dirty && (
                  <button
                    onClick={() => saveRow(idx)}
                    disabled={saving === d.day_of_week}
                    className="ml-auto hidden h-8 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors shrink-0 sm:block"
                  >
                    {saving === d.day_of_week ? '...' : 'Mentés'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-between">
                <p className="text-sm text-zinc-400 dark:text-white/30">Zárva</p>
                {d.dirty && (
                  <button
                    onClick={() => saveRow(idx)}
                    disabled={saving === d.day_of_week}
                    className="hidden h-8 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors shrink-0 sm:block"
                  >
                    {saving === d.day_of_week ? '...' : 'Mentés'}
                  </button>
                )}
              </div>
            )}
          </div>

          {d.dirty && (
            <button
              onClick={() => saveRow(idx)}
              disabled={saving === d.day_of_week}
              className="mt-3 w-full h-9 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors sm:hidden"
            >
              {saving === d.day_of_week ? '...' : 'Mentés'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
