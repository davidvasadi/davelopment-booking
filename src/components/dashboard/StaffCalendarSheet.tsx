'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import { PopupModal } from '@/components/ui/popup-modal'
import { TimeSelect } from '@/components/ui/time-select'
import { Switch } from '@/components/ui/toggle-switch'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
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
/** Egy nap effektív beosztása + hogy honnan jön (egyéni felülírás vagy a szalon alapja). */
type DayInfo = { is_available: boolean; start_time: string; end_time: string; source: 'exception' | 'base' } | null

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
  // A szalon-szintű heti nyitvatartás = ALAP minden napra (ezt örökli a munkatárs).
  const [salonDefault, setSalonDefault] = useState<Record<string, AvailRecord>>({})
  // A munkatárs SAJÁT heti beosztása (ha van; felülírja a szalon-alapot). Általában üres.
  const [staffRecurring, setStaffRecurring] = useState<Record<string, AvailRecord>>({})
  // A munkatárs dátum-kivételei (egy-egy napra: szabadnap / eltérő idősáv).
  const [exceptions, setExceptions] = useState<Record<string, AvailRecord>>({})
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editState, setEditState] = useState<AvailRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const [staffRes, salonRes] = await Promise.all([
        fetch(`/api/availability?where[staff][equals]=${staffId}&limit=300`, { credentials: 'include' }),
        // Szalon-szintű heti (staff nélküli, recurring) — ez az alap. A staff-szűrést kliens-oldalon tesszük.
        fetch(`/api/availability?where[salon][equals]=${salonId}&where[recurring][equals]=true&limit=300`, { credentials: 'include' }),
      ])
      const staffJson = await staffRes.json()
      const salonJson = await salonRes.json()

      const recMap: Record<string, AvailRecord> = {}
      const excMap: Record<string, AvailRecord> = {}
      for (const r of staffJson.docs ?? []) {
        const record: AvailRecord = {
          id: String(r.id),
          is_available: r.is_available ?? true,
          start_time: r.start_time ?? '09:00',
          end_time: r.end_time ?? '18:00',
          recurring: r.recurring ?? true,
          day_of_week: r.day_of_week,
          exception_date: r.exception_date,
        }
        if (record.recurring && record.day_of_week) recMap[record.day_of_week] = record
        else if (!record.recurring && record.exception_date) excMap[record.exception_date] = record
      }

      const defMap: Record<string, AvailRecord> = {}
      for (const r of salonJson.docs ?? []) {
        // Csak a szalon-szintű (staff nélküli), heti rekordok az alaphoz.
        if (r.staff) continue
        if (!r.recurring || !r.day_of_week) continue
        defMap[r.day_of_week] = {
          id: String(r.id),
          is_available: r.is_available ?? false,
          start_time: r.start_time ?? '09:00',
          end_time: r.end_time ?? '18:00',
          recurring: true,
          day_of_week: r.day_of_week,
        }
      }

      setStaffRecurring(recMap)
      setExceptions(excMap)
      setSalonDefault(defMap)
    } catch {
      toast.error('Nem sikerült betölteni az elérhetőséget')
    } finally {
      setLoading(false)
    }
  }, [open, staffId, salonId])

  useEffect(() => { load() }, [load])

  // A munkatárs saját heti beosztása felülírja a szalon-alapot; annak hiányában a szalon-alap.
  const baseFor = (weekday: string): AvailRecord | null => staffRecurring[weekday] ?? salonDefault[weekday] ?? null

  const getDayInfo = (d: Date): DayInfo => {
    const ds = format(d, 'yyyy-MM-dd')
    const exc = exceptions[ds]
    if (exc) return { is_available: exc.is_available, start_time: exc.start_time, end_time: exc.end_time, source: 'exception' }
    const base = baseFor(DOW_MAP[d.getDay()])
    if (base) return { is_available: base.is_available, start_time: base.start_time, end_time: base.end_time, source: 'base' }
    return null
  }

  const selectDay = (d: Date) => {
    if (isBefore(d, today)) return
    const ds = format(d, 'yyyy-MM-dd')
    setSelectedDate(ds)
    const exc = exceptions[ds]
    if (exc) {
      setEditState({ ...exc })
    } else {
      // Új felülírás a szalon-alapból (vagy a munkatárs saját heti beosztásából) indul.
      const base = baseFor(DOW_MAP[d.getDay()])
      setEditState({
        is_available: base?.is_available ?? true,
        start_time: base?.start_time ?? '09:00',
        end_time: base?.end_time ?? '18:00',
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
      const res = editState.id
        ? await fetch(`/api/availability/${editState.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
        : await fetch('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved = { ...editState, id: String(json.doc.id) }
      setExceptions(prev => ({ ...prev, [selectedDate]: saved }))
      setEditState(saved)
      toast.success('Mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  // Egyéni felülírás törlése → visszaáll a szalon alapjára.
  const resetDay = async () => {
    if (!editState?.id || !selectedDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/availability/${editState.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setExceptions(prev => { const next = { ...prev }; delete next[selectedDate]; return next })
      setEditState(null)
      setSelectedDate(null)
      toast.success('Visszaállítva a szalon alapjára')
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
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + 3, 1)

  const selBase = selectedDate ? baseFor(DOW_MAP[new Date(selectedDate + 'T00:00:00').getDay()]) : null
  const baseLabel = selBase ? (selBase.is_available ? `${selBase.start_time}–${selBase.end_time}` : 'zárva') : 'nincs beállítva'

  return (
    <PopupModal open={open} onClose={onClose} title={`${staffName} — Elérhetőség`} maxWidth="sm:max-w-[440px]">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-ink-soft">Betöltés...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Szalon-alap magyarázat */}
            <div className="flex items-start gap-2.5 rounded-[16px] bg-paper px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft2" strokeWidth={1.8} />
              <p className="text-[12.5px] leading-relaxed text-ink-soft">
                Alap a <span className="font-semibold text-ink">szalon nyitvatartása</span>. Itt egyénileg felülírhatod ennél a munkatársnál — pl. szabadnap vagy eltérő idősáv.
              </p>
            </div>

            {/* Hónapnavigáció */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                disabled={month <= minMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold capitalize text-ink">{format(month, 'MMMM yyyy', { locale: hu })}</p>
              <button
                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                disabled={month >= maxMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Naptár */}
            <div>
              <div className="mb-1 grid grid-cols-7">
                {DAY_LABELS.map(l => (<div key={l} className="py-1 text-center text-xs font-semibold text-ink-soft2">{l}</div>))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                {days.map(d => {
                  const ds = format(d, 'yyyy-MM-dd')
                  const isPast = isBefore(d, today)
                  const isSelected = ds === selectedDate
                  const info = getDayInfo(d)
                  const dot =
                    info?.source === 'exception'
                      ? info.is_available ? 'bg-[#1D9D63]' : 'bg-bad'
                      : info?.source === 'base' && info.is_available ? 'bg-line-strong' : 'bg-transparent'
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
                      {!isPast && <span className={cn('mt-0.5 h-1 w-1 rounded-full', isSelected ? 'bg-white/60' : dot)} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Jelmagyarázat */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-1 text-xs text-ink-soft2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-[#1D9D63]" />Egyéni: dolgozik</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-bad" />Szabadnap</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-line-strong" />Szalon alap</span>
            </div>

            {/* Nap-szerkesztő */}
            {selectedDate && editState && (
              <div className="space-y-4 rounded-[22px] bg-paper p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold capitalize text-ink">
                      {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}
                    </p>
                    <p className="text-[11px] text-ink-soft2">Szalon alap: {baseLabel}</p>
                  </div>
                  {exceptions[selectedDate] && (
                    <button onClick={resetDay} disabled={saving} className="shrink-0 text-xs text-ink-soft2 transition-colors hover:text-bad">
                      Vissza a szalon alapra
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Switch checked={editState.is_available} onChange={(v) => setEditState(s => s ? { ...s, is_available: v } : null)} ariaLabel="Dolgozik ezen a napon" />
                  <span className="text-sm font-medium text-ink-soft">
                    {editState.is_available ? 'Dolgozik ezen a napon' : 'Szabadnap — nem dolgozik'}
                  </span>
                </div>

                {editState.is_available && (
                  <div className="flex items-center gap-3">
                    <TimeSelect value={editState.start_time} onChange={(v) => setEditState(s => s ? { ...s, start_time: v } : null)} className="w-[7rem]" />
                    <span className="text-sm text-ink-soft2">–</span>
                    <TimeSelect value={editState.end_time} onChange={(v) => setEditState(s => s ? { ...s, end_time: v } : null)} className="w-[7rem]" />
                  </div>
                )}

                <button
                  onClick={saveDay}
                  disabled={saving}
                  className="h-11 w-full rounded-dav-pill bg-ink-dark text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Mentés...' : 'Egyéni felülírás mentése'}
                </button>
              </div>
            )}
          </div>
        )}
    </PopupModal>
  )
}
