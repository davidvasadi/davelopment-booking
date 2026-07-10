'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TimeSelect } from '@/components/ui/time-select'
import { WheelTimePicker } from '@/components/ui/wheel-time-picker'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, CalendarOff, Clock, Plus, Trash2 } from 'lucide-react'
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

type WeeklyHours = Record<string, { is_open: boolean; open_time: string; close_time: string }>

export function OpeningHoursExceptions({
  restaurantId,
  initial,
  variant = 'default',
  weeklyHours,
}: {
  restaurantId: number | string
  initial: Exception[]
  /** 'tiles' = a Nyitvatartás-oldal referencia dátum-tile kártyája. */
  variant?: 'default' | 'tiles'
  /** A rendes heti nyitvatartás (nap → idők) — helyes felirathoz + „rendessel megegyező = törlés". */
  weeklyHours?: WeeklyHours
}) {
  const router = useRouter()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [open, setOpen] = useState(false)
  // A sidebar mobilon alulról jön fel, desktopon oldalról.
  const [side, setSide] = useState<'right' | 'bottom'>('right')
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const upd = () => setSide(mq.matches ? 'bottom' : 'right')
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  // dátum (yyyy-MM-dd) -> kivétel
  const [exceptions, setExceptions] = useState<Record<string, Exception>>(() =>
    Object.fromEntries(initial.map((e) => [e.start_date, e]))
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
    // Ha a nyitott eltérés MEGEGYEZIK a nap rendes nyitvatartásával → nincs rá szükség: töröljük
    // (ha volt), vagy meg se hozzuk létre → eltűnik a listáról.
    if (matchesNormal(selectedDate, editState)) {
      if (editState.id) {
        await deleteExc({ id: editState.id, start_date: selectedDate })
        toast.success('Megegyezik a rendes nyitvatartással — az eltérő nap törölve')
      } else {
        toast.success('Ez a rendes nyitvatartás — nincs szükség eltérő napra')
      }
      setEditState(null)
      setSelectedDate(null)
      setOpen(false)
      return
    }
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

  // ── Rendes nyitvatartás összevetése (felirat + „megegyező = felesleges eltérés") ──
  const HM = (t?: string | null) => {
    if (!t) return 0
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const durationOf = (open?: string | null, close?: string | null) => {
    const o = HM(open)
    let c = HM(close)
    if (c <= o) c += 1440 // 00:00 / éjfél utáni zárás
    return c - o
  }
  const WK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const normalFor = (dateStr: string) => {
    if (!weeklyHours) return null
    const d = new Date(dateStr + 'T00:00:00')
    return weeklyHours[WK[d.getDay()]] ?? null
  }
  /** Egy NYITOTT eltérés megegyezik-e a nap rendes nyitvatartásával → felesleges. */
  const matchesNormal = (dateStr: string, st: EditState) => {
    const n = normalFor(dateStr)
    return !st.is_closed && !!n && n.is_open && n.open_time === st.open_time && n.close_time === st.close_time
  }
  const excSubtitle = (x: Exception): string => {
    if (x.is_closed) return 'Egész nap zárva'
    const n = normalFor(x.start_date)
    if (!n || !n.is_open) return 'Rendhagyó nyitva'
    const xd = durationOf(x.open_time, x.close_time)
    const nd = durationOf(n.open_time, n.close_time)
    if (xd > nd) return 'Hosszabbított nyitva'
    if (xd < nd) return 'Rövidített nyitva'
    return 'Módosított időpont'
  }

  /** Gyors törlés (a listáról közvetlenül). */
  const deleteExc = async (exc: Pick<Exception, 'id' | 'start_date'>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/opening-hours-exceptions/${exc.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setExceptions((prev) => {
        const next = { ...prev }
        delete next[exc.start_date]
        return next
      })
      if (selectedDate === exc.start_date) { setEditState(null); setSelectedDate(null) }
      router.refresh()
      toast.success('Törölve')
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
    .filter((x) => x.end_date >= format(today, 'yyyy-MM-dd'))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const exceptionCount = sortedExceptions.length

  // Hónap szerinti csoportosítás az oldali listához (sok kivételnél átlátható marad).
  const groups = (() => {
    const map = new Map<string, { label: string; items: Exception[] }>()
    for (const x of sortedExceptions) {
      const d = new Date(x.start_date + 'T00:00:00')
      const key = format(d, 'yyyy-MM')
      if (!map.has(key)) map.set(key, { label: format(d, 'yyyy. MMMM', { locale: hu }), items: [] })
      map.get(key)!.items.push(x)
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }))
  })()

  // Összecsukott hónap-szekciók (localStorage, böngészőnként).
  const COLLAPSE_KEY = `exc-collapsed-${restaurantId}`
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      setCollapsed(new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]') as string[]))
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const openOnDay = (dateStr: string) => {
    setOpen(true)
    selectDay(new Date(dateStr + 'T00:00:00'))
  }

  const card = 'dav-card-glass rounded-[26px]'

  const MONTH_ABBR = ['JAN', 'FEB', 'MÁR', 'ÁPR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SZEP', 'OKT', 'NOV', 'DEC']

  // A naptár + nap-szerkesztő + időválasztó sheet — mindkét variáns ezt használja (CRUD változatlan).
  const renderSheet = () => (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent side={side} className={cn('w-full overflow-y-auto', side === 'bottom' ? 'rounded-t-[26px] max-h-[88vh]' : 'sm:max-w-md')}>
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-light tracking-[-0.02em] text-ink">
              Nyitvatartási kivételek
            </SheetTitle>
          </SheetHeader>
          {renderSheetBody()}
        </SheetContent>
      </Sheet>

      {/* Kerék időválasztó (mobil) — a Kivételek-szerkesztő fölött */}
      {editState && !editState.is_closed && (
        <WheelTimePicker
          open={excPicker != null}
          onClose={() => setExcPicker(null)}
          title={excPicker === 'close' ? 'Záróra' : 'Nyitás'}
          value={excPicker === 'close' ? editState.close_time : editState.open_time}
          onChange={(v) => setEditState((s) => (s ? { ...s, [excPicker === 'close' ? 'close_time' : 'open_time']: v } : null))}
          shorthands={excPicker === 'close' ? ['22:00', '22:30', '23:00', '00:00'] : ['08:00', '09:00', '10:00', '11:00']}
        />
      )}
    </>
  )

  // ── Referencia dátum-tile variáns (Nyitvatartás-oldal jobb oszlop) ──
  if (variant === 'tiles') {
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
              const d = new Date(x.start_date + 'T00:00:00')
              return (
                <div
                  key={x.id}
                  className={cn(
                    'group flex w-full items-center gap-2',
                    i < sortedExceptions.length - 1 && 'border-b border-line',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openOnDay(x.start_date)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left"
                  >
                    <div className="flex h-[42px] w-[42px] shrink-0 flex-col items-center justify-center rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,.06)]">
                      <span className="text-sm font-semibold leading-none text-ink">{String(d.getDate()).padStart(2, '0')}</span>
                      <span className={cn('text-[9px] font-medium', x.is_closed ? 'text-bad' : 'text-[#9A8B52]')}>{MONTH_ABBR[d.getMonth()]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">
                        {x.label || format(d, 'MMMM d., EEEE', { locale: hu })}
                      </div>
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
        {renderSheet()}
      </>
    )
  }

  return (
    <>
      {/* Kompakt kártya — a teljes kártya kattintható. */}
      <button onClick={() => setOpen(true)} className={cn(card, 'w-full flex items-center gap-3 p-4 lg:p-5 text-left transition-colors hover:border-line-strong')}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-soft">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink">Eltérő napok</h3>
          <p className="hidden sm:block text-sm text-ink-soft">Ünnepnapok és eltérő nyitvatartás — ezek felülírják a heti rendet.</p>
        </div>
        {exceptionCount > 0 && (
          <span className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-dark px-1.5 text-[11px] font-bold text-white">
            {exceptionCount}
          </span>
        )}
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft2" />
      </button>

      {/* Oldali, hónap szerint csoportosított, összecsukható lista. */}
      {groups.length > 0 && (
        <div className="mt-4 space-y-3">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key)
            return (
              <div key={g.key} className={`${card} overflow-hidden`}>
                <button
                  onClick={() => toggleGroup(g.key)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  title={isCollapsed ? 'Kibontás' : 'Összecsukás'}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    <span className="font-semibold text-sm text-ink capitalize truncate">{g.label}</span>
                  </span>
                  <span className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-paper px-1.5 text-[11px] font-bold text-ink-soft">
                    {g.items.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="max-h-72 overflow-y-auto border-t border-line divide-y divide-line">
                    {g.items.map((x) => (
                      <button
                        key={x.id}
                        onClick={() => openOnDay(x.start_date)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper/60"
                      >
                        <span className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          x.is_closed ? 'bg-bad-bg text-bad' : 'bg-ink-dark/10 text-ink',
                        )}>
                          {x.is_closed ? <CalendarOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold capitalize text-ink">
                            {format(new Date(x.start_date + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}
                          </span>
                          <span className="block text-xs text-ink-soft">
                            {x.is_closed ? 'Zárva' : `${x.open_time}–${x.close_time}`}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {renderSheet()}
    </>
  )

  function renderSheetBody() {
    return (
          <div className="space-y-5">
            {/* Hónapnavigáció */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                disabled={month <= minMonth}
                className="h-8 w-8 rounded-full flex items-center justify-center text-ink-soft hover:bg-paper disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-semibold text-sm text-ink capitalize">
                {format(month, 'MMMM yyyy', { locale: hu })}
              </p>
              <button
                onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                disabled={month >= maxMonth}
                className="h-8 w-8 rounded-full flex items-center justify-center text-ink-soft hover:bg-paper disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Naptár */}
            <div>
              <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map((l) => (
                  <div key={l} className="text-center text-xs font-semibold text-ink-soft2 py-1">{l}</div>
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
                        isToday(d) && !isSelected && 'ring-2 ring-ink-dark ring-offset-1',
                        isSelected ? 'bg-ink-dark text-white' : !isPast && 'hover:bg-paper text-ink'
                      )}
                    >
                      <span>{d.getDate()}</span>
                      {!isPast && (
                        <span className={cn(
                          'h-1 w-1 rounded-full mt-0.5',
                          isSelected ? 'bg-white/60' :
                          exc?.is_closed ? 'bg-bad' :
                          exc ? 'bg-ink-dark' : 'bg-transparent'
                        )} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Jelmagyarázat */}
            <div className="flex items-center gap-5 text-xs text-ink-soft2 pb-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bad shrink-0" />Zárva</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-dark shrink-0" />Eltérő nyitvatartás</span>
            </div>

            {/* Nap-szerkesztő */}
            {selectedDate && editState && (
              <div className="bg-paper rounded-[22px] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-ink">
                    {format(new Date(selectedDate + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}
                  </p>
                  {exceptions[selectedDate] && (
                    <button
                      onClick={resetDay}
                      disabled={saving}
                      className="text-xs text-ink-soft2 hover:text-bad transition-colors"
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
                      editState.is_closed ? 'bg-bad' : 'bg-ink-dark'
                    )}
                  >
                    <span className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                      editState.is_closed ? 'left-1' : 'left-5'
                    )} />
                  </button>
                  <span className="text-sm font-medium text-ink-soft">
                    {editState.is_closed ? 'Zárva ezen a napon' : 'Eltérő nyitvatartás'}
                  </span>
                </div>

                {!editState.is_closed && (
                  side === 'bottom' ? (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setExcPicker('open')} className="flex-1 h-12 rounded-2xl bg-white border border-line text-lg font-semibold tabular-nums text-ink">{editState.open_time}</button>
                      <span className="text-sm text-ink-soft2">–</span>
                      <button type="button" onClick={() => setExcPicker('close')} className="flex-1 h-12 rounded-2xl bg-white border border-line text-lg font-semibold tabular-nums text-ink">{editState.close_time}</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <TimeSelect
                        value={editState.open_time}
                        onChange={(v) => setEditState((s) => s ? { ...s, open_time: v } : null)}
                        className="w-[7rem]"
                      />
                      <span className="text-sm text-ink-soft2">–</span>
                      <TimeSelect
                        value={editState.close_time}
                        onChange={(v) => setEditState((s) => s ? { ...s, close_time: v } : null)}
                        className="w-[7rem]"
                      />
                    </div>
                  )
                )}

                <button
                  onClick={saveDay}
                  disabled={saving}
                  className="w-full h-11 rounded-dav-pill bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            )}

            {/* Meglévő kivételek listája */}
            {sortedExceptions.length > 0 && (
              <div className="border-t border-line pt-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-soft2">
                  Hozzáadott kivételek
                </p>
                <div className="space-y-1 max-h-64 overflow-y-auto -mr-2 pr-2">
                  {sortedExceptions.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => selectDay(new Date(x.start_date + 'T00:00:00'))}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-paper/60',
                        x.start_date === selectedDate && 'bg-paper'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          x.is_closed ? 'bg-bad-bg text-bad' : 'bg-ink-dark/10 text-ink'
                        )}
                      >
                        {x.is_closed ? <CalendarOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold capitalize text-ink">
                          {format(new Date(x.start_date + 'T00:00:00'), 'MMMM d., EEEE', { locale: hu })}
                        </span>
                        <span className="block text-xs text-ink-soft">
                          {x.is_closed ? 'Zárva' : `${x.open_time}–${x.close_time}`}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
    )
  }
}
