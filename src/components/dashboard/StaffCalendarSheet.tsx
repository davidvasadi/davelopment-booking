'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']

const DOW_MAP: Record<number, string> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday',
  5: 'friday', 6: 'saturday', 0: 'sunday',
}

type AvailRecord = {
  id?: string
  is_available: boolean
  start_time: string
  end_time: string
  recurring: boolean
  day_of_week?: string
  exception_date?: string
}

interface Props {
  open: boolean
  onClose: () => void
  staffId: string
  staffName: string
  salonId: string
}

export default function StaffCalendarSheet({ open, onClose, staffId, staffName, salonId }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [recurring, setRecurring] = useState<Record<string, AvailRecord>>({})
  const [exceptions, setExceptions] = useState<Record<string, AvailRecord>>({})
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editState, setEditState] = useState<AvailRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/availability?where[staff][equals]=${staffId}&limit=300`,
        { credentials: 'include' },
      )
      const json = await res.json()
      const recMap: Record<string, AvailRecord> = {}
      const excMap: Record<string, AvailRecord> = {}
      for (const r of json.docs ?? []) {
        const record: AvailRecord = {
          id: String(r.id),
          is_available: r.is_available ?? true,
          start_time: r.start_time ?? '09:00',
          end_time: r.end_time ?? '18:00',
          recurring: r.recurring ?? true,
          day_of_week: r.day_of_week,
          exception_date: r.exception_date,
        }
        if (record.recurring && record.day_of_week) {
          recMap[record.day_of_week] = record
        } else if (!record.recurring && record.exception_date) {
          excMap[record.exception_date] = record
        }
      }
      setRecurring(recMap)
      setExceptions(excMap)
    } catch {
      toast.error('Nem sikerült betölteni az elérhetőséget')
    } finally {
      setLoading(false)
    }
  }, [open, staffId])

  useEffect(() => { load() }, [load])

  const getDayInfo = (d: Date): AvailRecord | null => {
    const ds = format(d, 'yyyy-MM-dd')
    return exceptions[ds] ?? recurring[DOW_MAP[d.getDay()]] ?? null
  }

  const selectDay = (d: Date) => {
    if (isBefore(d, today)) return
    const ds = format(d, 'yyyy-MM-dd')
    setSelectedDate(ds)
    const exc = exceptions[ds]
    if (exc) {
      setEditState({ ...exc })
    } else {
      const rec = recurring[DOW_MAP[d.getDay()]]
      setEditState({
        is_available: rec?.is_available ?? true,
        start_time: rec?.start_time ?? '09:00',
        end_time: rec?.end_time ?? '18:00',
        recurring: false,
        exception_date: ds,
      })
    }
  }

  const saveDay = async () => {
    if (!editState || !selectedDate) return
    setSaving(true)
    try {
      const body = {
        salon: Number(salonId),
        staff: Number(staffId),
        day_of_week: DOW_MAP[new Date(selectedDate + 'T00:00:00').getDay()],
        is_available: editState.is_available,
        start_time: editState.start_time,
        end_time: editState.end_time,
        recurring: false,
        exception_date: selectedDate,
      }
      if (editState.id) {
        const res = await fetch(`/api/availability/${editState.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        const updated = { ...editState, id: String(json.doc.id) }
        setExceptions(prev => ({ ...prev, [selectedDate]: updated }))
        setEditState(updated)
      } else {
        const res = await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        const created = { ...editState, id: String(json.doc.id) }
        setExceptions(prev => ({ ...prev, [selectedDate]: created }))
        setEditState(created)
      }
      toast.success('Mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  const resetDay = async () => {
    if (!editState?.id || !selectedDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/availability/${editState.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setExceptions(prev => {
        const next = { ...prev }
        delete next[selectedDate]
        return next
      })
      setEditState(null)
      setSelectedDate(null)
      toast.success('Visszaállítva az alapértelmezettre')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  const monthStart = startOfMonth(month)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) })
  const startPad = (monthStart.getDay() + 6) % 7

  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + 2, 1)

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-black tracking-tight">
            {staffName} — Elérhetőség
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-zinc-400">Betöltés...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Month nav */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                disabled={month <= minMonth}
                className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-black text-sm text-zinc-900 dark:text-white capitalize">
                {format(month, 'MMMM yyyy', { locale: hu })}
              </p>
              <button
                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                disabled={month >= maxMonth}
                className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Calendar */}
            <div>
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(l => (
                  <div key={l} className="text-center text-xs font-semibold text-zinc-400 dark:text-white/40 py-1">{l}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                {days.map(d => {
                  const ds = format(d, 'yyyy-MM-dd')
                  const isPast = isBefore(d, today)
                  const isSelected = ds === selectedDate
                  const info = getDayInfo(d)
                  const hasException = !!exceptions[ds]
                  return (
                    <button
                      key={ds}
                      onClick={() => selectDay(d)}
                      disabled={isPast}
                      className={cn(
                        'relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all',
                        isPast && 'opacity-25 cursor-default',
                        isToday(d) && !isSelected && 'ring-2 ring-zinc-950 dark:ring-white ring-offset-1 dark:ring-offset-zinc-900',
                        isSelected ? 'bg-zinc-950 dark:bg-white text-white dark:text-black' : !isPast && 'hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-900 dark:text-white',
                      )}
                    >
                      <span>{d.getDate()}</span>
                      {!isPast && (
                        <span className={cn(
                          'h-1 w-1 rounded-full mt-0.5',
                          isSelected ? 'bg-white/60' :
                          hasException && info?.is_available ? 'bg-emerald-500' :
                          hasException && !info?.is_available ? 'bg-red-400' :
                          info?.is_available ? 'bg-zinc-300' : 'bg-transparent',
                        )} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 text-xs text-zinc-400 dark:text-white/40 pb-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />Egyéni (elérhető)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />Egyéni (zárva)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-300 shrink-0" />Alap</span>
            </div>

            {/* Day editor */}
            {selectedDate && editState && (
              <div className="bg-zinc-50 dark:bg-white/[0.04] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">
                    {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}
                  </p>
                  {exceptions[selectedDate] && (
                    <button
                      onClick={resetDay}
                      disabled={saving}
                      className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      Visszaállít
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditState(s => s ? { ...s, is_available: !s.is_available } : null)}
                    className={cn(
                      'w-10 h-6 rounded-full transition-colors relative shrink-0',
                      editState.is_available ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-200 dark:bg-white/[0.15]',
                    )}
                  >
                    <span className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 transition-all',
                      editState.is_available ? 'left-5' : 'left-1',
                    )} />
                  </button>
                  <span className="text-sm font-medium text-zinc-700 dark:text-white/70">
                    {editState.is_available ? 'Elérhető' : 'Nem elérhető ezen a napon'}
                  </span>
                </div>

                {editState.is_available && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={editState.start_time}
                      onChange={e => setEditState(s => s ? { ...s, start_time: e.target.value } : null)}
                      className="w-32 h-9 text-sm rounded-xl bg-white dark:bg-white/[0.06] border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white dark:[color-scheme:dark]"
                    />
                    <span className="text-zinc-400 text-sm">–</span>
                    <Input
                      type="time"
                      value={editState.end_time}
                      onChange={e => setEditState(s => s ? { ...s, end_time: e.target.value } : null)}
                      className="w-32 h-9 text-sm rounded-xl bg-white dark:bg-white/[0.06] border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                )}

                <button
                  onClick={saveDay}
                  disabled={saving}
                  className="w-full h-11 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
