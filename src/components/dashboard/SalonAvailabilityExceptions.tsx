'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TimeSelect } from '@/components/ui/time-select'
import { WheelTimePicker } from '@/components/ui/wheel-time-picker'
import { ChevronLeft, ChevronRight, CalendarOff, Clock, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']
const MONTH_ABBR = ['JAN', 'FEB', 'MÁR', 'ÁPR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SZEP', 'OKT', 'NOV', 'DEC']
// getDay() (0=vasárnap) → az availability day_of_week értékei.
const WK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/** Egy szalon-kivétel a UI-hoz — az availability rekordból leképezve (exception_date + is_available). */
export type SalonException = {
  id: number | string
  date: string        // exception_date (yyyy-MM-dd)
  is_closed: boolean  // !is_available
  open_time: string   // start_time
  close_time: string  // end_time
}

type EditState = { id?: string; is_closed: boolean; open_time: string; close_time: string }
type WeeklyHours = Record<string, { is_open: boolean; open_time: string; close_time: string }>

/**
 * Eltérő napok a szalonhoz — az étterem OpeningHoursExceptions szalon-párja. A kivételek
 * az `availability` kollekcióban élnek: recurring:false + exception_date + a nap day_of_week-je,
 * is_available (false = zárva), start_time/end_time. „tiles" kártya + naptár-szerkesztő sheet.
 */
export function SalonAvailabilityExceptions({
  salonId,
  initial,
  weeklyHours,
}: {
  salonId: number | string
  initial: SalonException[]
  weeklyHours?: WeeklyHours
}) {
  const router = useRouter()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'right' | 'bottom'>('right')
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const upd = () => setSide(mq.matches ? 'bottom' : 'right')
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [exceptions, setExceptions] = useState<Record<string, SalonException>>(() =>
    Object.fromEntries(initial.map((e) => [e.date, e])),
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [excPicker, setExcPicker] = useState<'open' | 'close' | null>(null)

  const selectDay = (d: Date) => {
    if (isBefore(d, today)) return
    const ds = format(d, 'yyyy-MM-dd')
    setSelectedDate(ds)
    const exc = exceptions[ds]
    if (exc) {
      setEditState({ id: String(exc.id), is_closed: exc.is_closed, open_time: exc.open_time || '09:00', close_time: exc.close_time || '18:00' })
    } else {
      setEditState({ is_closed: true, open_time: '09:00', close_time: '18:00' })
    }
  }

  // ── Rendes heti nyitvatartás összevetése (felirat + „megegyező = felesleges eltérés") ──
  const HM = (t?: string | null) => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const durationOf = (open?: string | null, close?: string | null) => {
    const o = HM(open)
    let c = HM(close)
    if (c <= o) c += 1440
    return c - o
  }
  const normalFor = (dateStr: string) => {
    if (!weeklyHours) return null
    const d = new Date(dateStr + 'T00:00:00')
    return weeklyHours[WK[d.getDay()]] ?? null
  }
  const matchesNormal = (dateStr: string, st: EditState) => {
    const n = normalFor(dateStr)
    return !st.is_closed && !!n && n.is_open && n.open_time === st.open_time && n.close_time === st.close_time
  }
  const excSubtitle = (x: SalonException): string => {
    if (x.is_closed) return 'Egész nap zárva'
    const n = normalFor(x.date)
    if (!n || !n.is_open) return 'Rendhagyó nyitva'
    const xd = durationOf(x.open_time, x.close_time)
    const nd = durationOf(n.open_time, n.close_time)
    if (xd > nd) return 'Hosszabbított nyitva'
    if (xd < nd) return 'Rövidített nyitva'
    return 'Módosított időpont'
  }

  const saveDay = async () => {
    if (!editState || !selectedDate) return
    // Ha a nyitott eltérés MEGEGYEZIK a nap rendes nyitvatartásával → felesleges: töröljük / nem hozzuk létre.
    if (matchesNormal(selectedDate, editState)) {
      if (editState.id) {
        await deleteExc({ id: editState.id, date: selectedDate })
        toast.success('Megegyezik a rendes nyitvatartással — az eltérő nap törölve')
      } else {
        toast.success('Ez a rendes nyitvatartás — nincs szükség eltérő napra')
      }
      setEditState(null); setSelectedDate(null); setOpen(false)
      return
    }
    setSaving(true)
    try {
      const dow = WK[new Date(selectedDate + 'T00:00:00').getDay()]
      const body = {
        salon: Number(salonId),
        day_of_week: dow,
        recurring: false,
        exception_date: selectedDate,
        is_available: !editState.is_closed,
        start_time: editState.is_closed ? '00:00' : editState.open_time,
        end_time: editState.is_closed ? '00:00' : editState.close_time,
      }
      const res = editState.id
        ? await fetch(`/api/availability/${editState.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
        : await fetch('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const id = String(json.doc?.id ?? editState.id)
      const saved: SalonException = { id, date: selectedDate, is_closed: editState.is_closed, open_time: editState.open_time, close_time: editState.close_time }
      setExceptions((prev) => ({ ...prev, [selectedDate]: saved }))
      setEditState((s) => (s ? { ...s, id } : null))
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
    await deleteExc({ id: editState.id, date: selectedDate })
    setEditState(null); setSelectedDate(null)
    toast.success('Visszaállítva az alapértelmezettre')
  }

  const deleteExc = async (exc: Pick<SalonException, 'id' | 'date'>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/availability/${exc.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setExceptions((prev) => { const next = { ...prev }; delete next[exc.date]; return next })
      if (selectedDate === exc.date) { setEditState(null); setSelectedDate(null) }
      router.refresh()
    } catch {
      toast.error('Nem sikerült törölni')
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
    .filter((x) => x.date >= format(today, 'yyyy-MM-dd'))
    .sort((a, b) => a.date.localeCompare(b.date))

  const openOnDay = (dateStr: string) => { setOpen(true); selectDay(new Date(dateStr + 'T00:00:00')) }
  const card = 'dav-card-glass rounded-[26px]'

  return (
    <>
      <div className={cn(card, 'px-5 py-5 sm:px-6')}>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">Eltérő napok</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Eltérő nap hozzáadása"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink-dark transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5 text-gold" strokeWidth={1.9} />
          </button>
        </div>

        {sortedExceptions.length === 0 ? (
          <p className="pt-4 text-[13px] text-ink-soft">Nincs eltérő nap. Adj hozzá ünnepnapot vagy rövidített nyitvatartást a „+” gombbal.</p>
        ) : (
          sortedExceptions.map((x, i) => {
            const d = new Date(x.date + 'T00:00:00')
            return (
              <div key={x.id} className={cn('group flex w-full items-center gap-2', i < sortedExceptions.length - 1 && 'border-b border-line')}>
                <button type="button" onClick={() => openOnDay(x.date)} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left">
                  <div className="flex h-[42px] w-[42px] shrink-0 flex-col items-center justify-center rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                    <span className="text-sm font-semibold leading-none text-ink">{String(d.getDate()).padStart(2, '0')}</span>
                    <span className={cn('text-[9px] font-medium', x.is_closed ? 'text-bad' : 'text-[#9A8B52]')}>{MONTH_ABBR[d.getMonth()]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{format(d, 'MMMM d., EEEE', { locale: hu })}</div>
                    <div className="text-xs text-ink-soft">{excSubtitle(x)}</div>
                  </div>
                  {x.is_closed ? (
                    <span className="shrink-0 rounded-[9px] bg-bad-bg px-2.5 py-1 text-[11px] font-semibold text-bad">Zárva</span>
                  ) : (
                    <span className="shrink-0 rounded-[9px] bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink">{x.open_time}–{x.close_time}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => deleteExc(x)}
                  disabled={saving}
                  aria-label="Eltérő nap törlése"
                  title="Törlés"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft2 transition-colors hover:bg-bad-bg hover:text-bad disabled:opacity-40"
                >
                  <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.7} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Naptár + nap-szerkesztő sheet */}
      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent side={side} className={cn('w-full overflow-y-auto', side === 'bottom' ? 'rounded-t-[26px] max-h-[88vh]' : 'sm:max-w-md')}>
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-light tracking-[-0.02em] text-ink">Nyitvatartási kivételek</SheetTitle>
          </SheetHeader>

          <div className="space-y-5">
            {/* Hónapnavigáció */}
            <div className="flex items-center justify-between">
              <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} disabled={month <= minMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold capitalize text-ink">{format(month, 'MMMM yyyy', { locale: hu })}</p>
              <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} disabled={month >= maxMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Naptár */}
            <div>
              <div className="mb-1 grid grid-cols-7">
                {DAY_LABELS.map((l) => (<div key={l} className="py-1 text-center text-xs font-semibold text-ink-soft2">{l}</div>))}
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
                        'relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all',
                        isPast && 'cursor-default opacity-25',
                        isToday(d) && !isSelected && 'ring-2 ring-ink-dark ring-offset-1',
                        isSelected ? 'bg-ink-dark text-white' : !isPast && 'text-ink hover:bg-paper',
                      )}
                    >
                      <span>{d.getDate()}</span>
                      {!isPast && (
                        <span className={cn('mt-0.5 h-1 w-1 rounded-full', isSelected ? 'bg-white/60' : exc?.is_closed ? 'bg-bad' : exc ? 'bg-ink-dark' : 'bg-transparent')} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-5 pb-2 text-xs text-ink-soft2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-bad" />Zárva</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-ink-dark" />Eltérő nyitvatartás</span>
            </div>

            {/* Nap-szerkesztő */}
            {selectedDate && editState && (
              <div className="space-y-4 rounded-[22px] bg-paper p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">{format(new Date(selectedDate + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}</p>
                  {exceptions[selectedDate] && (
                    <button onClick={resetDay} disabled={saving} className="text-xs text-ink-soft2 transition-colors hover:text-bad">Visszaállít</button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditState((s) => s ? { ...s, is_closed: !s.is_closed } : null)}
                    className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', editState.is_closed ? 'bg-bad' : 'bg-ink-dark')}
                  >
                    <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', editState.is_closed ? 'left-1' : 'left-5')} />
                  </button>
                  <span className="text-sm font-medium text-ink-soft">{editState.is_closed ? 'Zárva ezen a napon' : 'Eltérő nyitvatartás'}</span>
                </div>

                {!editState.is_closed && (
                  side === 'bottom' ? (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setExcPicker('open')} className="h-12 flex-1 rounded-2xl border border-line bg-white text-lg font-semibold tabular-nums text-ink">{editState.open_time}</button>
                      <span className="text-sm text-ink-soft2">–</span>
                      <button type="button" onClick={() => setExcPicker('close')} className="h-12 flex-1 rounded-2xl border border-line bg-white text-lg font-semibold tabular-nums text-ink">{editState.close_time}</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <TimeSelect value={editState.open_time} onChange={(v) => setEditState((s) => s ? { ...s, open_time: v } : null)} className="w-[7rem]" />
                      <span className="text-sm text-ink-soft2">–</span>
                      <TimeSelect value={editState.close_time} onChange={(v) => setEditState((s) => s ? { ...s, close_time: v } : null)} className="w-[7rem]" />
                    </div>
                  )
                )}

                <button onClick={saveDay} disabled={saving} className="h-11 w-full rounded-dav-pill bg-ink-dark text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            )}

            {/* Meglévő kivételek listája */}
            {sortedExceptions.length > 0 && (
              <div className="border-t border-line pt-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-soft2">Hozzáadott kivételek</p>
                <div className="-mr-2 max-h-64 space-y-1 overflow-y-auto pr-2">
                  {sortedExceptions.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => selectDay(new Date(x.date + 'T00:00:00'))}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-paper/60', x.date === selectedDate && 'bg-paper')}
                    >
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', x.is_closed ? 'bg-bad-bg text-bad' : 'bg-ink-dark/10 text-ink')}>
                        {x.is_closed ? <CalendarOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold capitalize text-ink">{format(new Date(x.date + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}</span>
                        <span className="block text-xs text-ink-soft">{x.is_closed ? 'Zárva' : `${x.open_time}–${x.close_time}`}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Kerék időválasztó (mobil) */}
      {editState && !editState.is_closed && (
        <WheelTimePicker
          open={excPicker != null}
          onClose={() => setExcPicker(null)}
          title={excPicker === 'close' ? 'Záróra' : 'Nyitás'}
          value={excPicker === 'close' ? editState.close_time : editState.open_time}
          onChange={(v) => setEditState((s) => (s ? { ...s, [excPicker === 'close' ? 'close_time' : 'open_time']: v } : null))}
          shorthands={excPicker === 'close' ? ['17:00', '18:00', '19:00', '20:00'] : ['08:00', '09:00', '10:00', '11:00']}
        />
      )}
    </>
  )
}
