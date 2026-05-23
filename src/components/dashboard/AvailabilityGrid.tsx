'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Availability } from '@/payload/payload-types'
import { TimeSelect } from '@/components/ui/time-select'
import { cn } from '@/lib/utils'

const DAYS = [
  { key: 'monday', label: 'Hétfő' },
  { key: 'tuesday', label: 'Kedd' },
  { key: 'wednesday', label: 'Szerda' },
  { key: 'thursday', label: 'Csütörtök' },
  { key: 'friday', label: 'Péntek' },
  { key: 'saturday', label: 'Szombat' },
  { key: 'sunday', label: 'Vasárnap' },
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
  const [saving, setSaving] = useState<DayKey | null>(null)

  const toggle = (day: DayKey) =>
    setRows(prev => ({ ...prev, [day]: { ...prev[day], is_available: !prev[day].is_available, dirty: true } }))

  const setTime = (day: DayKey, field: 'start_time' | 'end_time', value: string) =>
    setRows(prev => ({ ...prev, [day]: { ...prev[day], [field]: value, dirty: true } }))

  const saveRow = async (day: DayKey) => {
    const row = rows[day]
    setSaving(day)
    try {
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
      } else if (row.is_available) {
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
        setRows(prev => ({ ...prev, [day]: { ...prev[day], id: json.doc.id, dirty: false } }))
        toast.success('Mentve')
        return
      }
      setRows(prev => ({ ...prev, [day]: { ...prev[day], dirty: false } }))
      toast.success('Mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
      {DAYS.map(({ key, label }, i) => {
        const row = rows[key]
        return (
          <div
            key={key}
            className={cn(
              'px-4 py-4 transition-colors sm:px-6',
              i < DAYS.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.06]' : ''
            )}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-20 shrink-0 sm:w-24">
                <p className="text-sm font-semibold text-zinc-700 dark:text-white/80">{label}</p>
              </div>

              <button
                type="button"
                onClick={() => toggle(key)}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors relative shrink-0',
                  row.is_available ? 'bg-[#0099ff]' : 'bg-zinc-200 dark:bg-white/[0.1]'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    row.is_available ? 'left-5' : 'left-1'
                  )}
                />
              </button>

              {row.is_available ? (
                <div className="flex flex-1 items-center gap-2">
                  <TimeSelect
                    value={row.start_time}
                    onChange={v => setTime(key, 'start_time', v)}
                    className="w-full max-w-[8rem] sm:w-32"
                  />
                  <span className="text-zinc-400 dark:text-white/30 text-sm">–</span>
                  <TimeSelect
                    value={row.end_time}
                    onChange={v => setTime(key, 'end_time', v)}
                    className="w-full max-w-[8rem] sm:w-32"
                  />
                  {row.dirty && (
                    <button
                      onClick={() => saveRow(key)}
                      disabled={saving === key}
                      className="ml-auto hidden h-8 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors shrink-0 sm:block"
                    >
                      {saving === key ? '...' : 'Mentés'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-between">
                  <p className="text-sm text-zinc-400 dark:text-white/30">Zárva</p>
                  {row.dirty && (
                    <button
                      onClick={() => saveRow(key)}
                      disabled={saving === key}
                      className="hidden h-8 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors shrink-0 sm:block"
                    >
                      {saving === key ? '...' : 'Mentés'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {row.dirty && (
              <button
                onClick={() => saveRow(key)}
                disabled={saving === key}
                className="mt-3 w-full h-9 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors sm:hidden"
              >
                {saving === key ? '...' : 'Mentés'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
