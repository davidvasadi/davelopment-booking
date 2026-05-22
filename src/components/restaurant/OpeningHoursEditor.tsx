'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DAY_LABELS_HU, type DayOfWeek } from '@/lib/restaurantTemplates'
import { Input } from '@/components/ui/input'
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
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden max-w-2xl">
      {days.map((d, idx) => (
        <div
          key={d.day_of_week}
          className={cn(
            'flex items-center gap-4 px-6 py-4 transition-colors',
            idx < days.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.06]' : '',
            !d.is_open && 'opacity-40'
          )}
        >
          <div className="w-24 shrink-0">
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
            <>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={d.open_time}
                  onChange={(e) => update(idx, { open_time: e.target.value })}
                  className="w-32 h-9 text-sm rounded-lg bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white"
                />
                <span className="text-zinc-400 dark:text-white/30 text-sm">–</span>
                <Input
                  type="time"
                  value={d.close_time}
                  onChange={(e) => update(idx, { close_time: e.target.value })}
                  className="w-32 h-9 text-sm rounded-lg bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white"
                />
              </div>
              {d.dirty && (
                <button
                  onClick={() => saveRow(idx)}
                  disabled={saving === d.day_of_week}
                  className="h-8 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors"
                >
                  {saving === d.day_of_week ? '...' : 'Mentés'}
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-between">
              <p className="text-sm text-zinc-400 dark:text-white/30">Zárva</p>
              {d.dirty && (
                <button
                  onClick={() => saveRow(idx)}
                  disabled={saving === d.day_of_week}
                  className="h-8 px-4 rounded-full border border-zinc-200 dark:border-white/[0.1] text-zinc-400 dark:text-white/50 text-xs font-semibold hover:border-zinc-400 dark:hover:border-white/[0.3] transition-colors"
                >
                  {saving === d.day_of_week ? '...' : 'Mentés'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
