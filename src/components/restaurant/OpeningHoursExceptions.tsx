'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TimeSelect } from '@/components/ui/time-select'
import { ChevronLeft, ChevronRight, CalendarDays, CalendarOff, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']

export type Exception = {
  id: number | string
  label?: string | null
  start_date: string
  end_date: string
  is_closed: boolean
  open_time?: string | null
  close_time?: string | null
}

type EditState = {
  id?: string
  is_closed: boolean
  open_time: string
  close_time: string
}

export function OpeningHoursExceptions({
  restaurantId,
  initial,
}: {
  restaurantId: number | string
  initial: Exception[]
}) {
  const router = useRouter()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  // dátum (yyyy-MM-dd) -> kivétel
  const [exceptions, setExceptions] = useState<Record<string, Exception>>(() =>
    Object.fromEntries(initial.map((e) => [e.start_date, e]))
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const selectDay = (d: Date) => {
    if (isBefore(d, today)) return
    const ds = format(d, 'yyyy-MM-dd')
    setSelectedDate(ds)
    const exc = exceptions[ds]
    if (exc) {
      setEditState({
        id: String(exc.id),
        is_closed: exc.is_closed,
        open_time: exc.open_time ?? '11:00',
        close_time: exc.close_time ?? '22:00',
      })
    } else {
      setEditState({ is_closed: true, open_time: '11:00', close_time: '22:00' })
    }
  }

  const saveDay = async () => {
    if (!editState || !selectedDate) return
    setSaving(true)
    try {
      const body = {
        restaurant: Number(restaurantId),
        start_date: selectedDate,
        end_date: selectedDate,
        is_closed: editState.is_closed,
        open_time: editState.is_closed ? undefined : editState.open_time,
        close_time: editState.is_closed ? undefined : editState.close_time,
      }
      const res = editState.id
        ? await fetch(`/api/opening-hours-exceptions/${editState.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          })
        : await fetch('/api/opening-hours-exceptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: Exception = { ...json.doc, id: String(json.doc.id) }
      setExceptions((prev) => ({ ...prev, [selectedDate]: saved }))
      setEditState((s) => (s ? { ...s, id: String(json.doc.id) } : null))
      router.refresh()
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
      const res = await fetch(`/api/opening-hours-exceptions/${editState.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setExceptions((prev) => {
        const next = { ...prev }
        delete next[selectedDate]
        return next
      })
      setEditState(null)
      setSelectedDate(null)
      router.refresh()
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
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + 12, 1)

  const sortedExceptions = Object.values(exceptions)
    .filter((x) => x.end_date >= format(today, 'yyyy-MM-dd'))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const exceptionCount = sortedExceptions.length

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/80 dark:hover:border-white/[0.2]"
      >
        <CalendarDays className="h-4 w-4" />
        Kivételek kezelése
        {exceptionCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-black">
            {exceptionCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-black tracking-tight">
              Nyitvatartási kivételek
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
            {/* Hónapnavigáció */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                disabled={month <= minMonth}
                className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 transition-colors dark:hover:bg-white/[0.06]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-black text-sm text-zinc-900 capitalize dark:text-white">
                {format(month, 'MMMM yyyy', { locale: hu })}
              </p>
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                disabled={month >= maxMonth}
                className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 transition-colors dark:hover:bg-white/[0.06]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Naptár */}
            <div>
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map((l) => (
                  <div key={l} className="text-center text-xs font-semibold text-zinc-400 py-1">{l}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                {days.map((d) => {
                  const ds = format(d, 'yyyy-MM-dd')
                  const isPast = isBefore(d, today)
                  const isSelected = ds === selectedDate
                  const exc = exceptions[ds]
                  return (
                    <button
                      key={ds}
                      onClick={() => selectDay(d)}
                      disabled={isPast}
                      className={cn(
                        'relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all',
                        isPast && 'opacity-25 cursor-default',
                        isToday(d) && !isSelected && 'ring-2 ring-zinc-950 ring-offset-1 dark:ring-white',
                        isSelected ? 'bg-zinc-950 text-white dark:bg-white dark:text-black' : !isPast && 'hover:bg-zinc-100 text-zinc-900 dark:hover:bg-white/[0.06] dark:text-white'
                      )}
                    >
                      <span>{d.getDate()}</span>
                      {!isPast && (
                        <span className={cn(
                          'h-1 w-1 rounded-full mt-0.5',
                          isSelected ? 'bg-white/60 dark:bg-black/40' :
                          exc?.is_closed ? 'bg-red-400' :
                          exc ? 'bg-[#0099ff]' : 'bg-transparent'
                        )} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Jelmagyarázat */}
            <div className="flex items-center gap-5 text-xs text-zinc-400 pb-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />Zárva</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0099ff] shrink-0" />Eltérő nyitvatartás</span>
            </div>

            {/* Nap-szerkesztő */}
            {selectedDate && editState && (
              <div className="bg-zinc-50 rounded-2xl p-5 space-y-4 dark:bg-white/[0.04]">
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
                    onClick={() => setEditState((s) => s ? { ...s, is_closed: !s.is_closed } : null)}
                    className={cn(
                      'w-10 h-6 rounded-full transition-colors relative shrink-0',
                      editState.is_closed ? 'bg-red-500' : 'bg-[#0099ff]'
                    )}
                  >
                    <span className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                      editState.is_closed ? 'left-1' : 'left-5'
                    )} />
                  </button>
                  <span className="text-sm font-medium text-zinc-700 dark:text-white/70">
                    {editState.is_closed ? 'Zárva ezen a napon' : 'Eltérő nyitvatartás'}
                  </span>
                </div>

                {!editState.is_closed && (
                  <div className="flex items-center gap-3">
                    <TimeSelect
                      value={editState.open_time}
                      onChange={(v) => setEditState((s) => s ? { ...s, open_time: v } : null)}
                      className="w-[7rem]"
                    />
                    <span className="text-sm text-zinc-300 dark:text-white/25">–</span>
                    <TimeSelect
                      value={editState.close_time}
                      onChange={(v) => setEditState((s) => s ? { ...s, close_time: v } : null)}
                      className="w-[7rem]"
                    />
                  </div>
                )}

                <button
                  onClick={saveDay}
                  disabled={saving}
                  className="w-full h-11 rounded-full bg-zinc-950 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  {saving ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            )}

            {/* Meglévő kivételek listája */}
            {sortedExceptions.length > 0 && (
              <div className="border-t border-zinc-100 pt-5 dark:border-white/[0.06]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">
                  Hozzáadott kivételek
                </p>
                <div className="space-y-1">
                  {sortedExceptions.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => selectDay(new Date(x.start_date + 'T00:00:00'))}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04]',
                        x.start_date === selectedDate && 'bg-zinc-50 dark:bg-white/[0.04]'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          x.is_closed ? 'bg-red-50 text-red-500 dark:bg-red-500/10' : 'bg-[#0099ff]/10 text-[#0099ff]'
                        )}
                      >
                        {x.is_closed ? <CalendarOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold capitalize text-zinc-800 dark:text-white/90">
                          {format(new Date(x.start_date + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}
                        </span>
                        <span className="block text-xs text-zinc-500 dark:text-white/40">
                          {x.is_closed ? 'Zárva' : `${x.open_time}–${x.close_time}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
