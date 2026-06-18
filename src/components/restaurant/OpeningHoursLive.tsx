'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock, ChevronRight, X } from 'lucide-react'
import { DAYS_OF_WEEK, dayLabels, type DayOfWeek } from '@/lib/restaurantTemplates'
import { t, type Locale } from '@/lib/i18n'

interface DayHour {
  day_of_week: DayOfWeek
  is_open?: boolean | null
  open_time?: string | null
  close_time?: string | null
}

// JS getDay(): 0 = Sunday … 6 = Saturday  →  DayOfWeek
const JS_DAY_TO_KEY: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function toMinutes(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

export default function OpeningHoursLive({ hours, locale = 'hu' }: { hours: DayHour[]; locale?: Locale }) {
  const dayLbl = dayLabels(locale)
  const [open, setOpen] = useState(false)
  // null amíg a kliens be nem tölt — így nincs SSR/CSR eltérés a státusznál
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const byDay = useMemo(() => {
    const map = new Map<DayOfWeek, DayHour>()
    for (const h of hours) map.set(h.day_of_week, h)
    return map
  }, [hours])

  const status = useMemo(() => {
    if (!now) return null
    const key = JS_DAY_TO_KEY[now.getDay()]
    const today = byDay.get(key)
    const cur = now.getHours() * 60 + now.getMinutes()
    if (!today?.is_open) return { open: false as const, today }
    const o = toMinutes(today.open_time)
    const c = toMinutes(today.close_time)
    if (o == null || c == null) return { open: false as const, today }
    const isOpen = cur >= o && cur < c
    return { open: isOpen, today, openSoon: !isOpen && cur < o }
  }, [now, byDay])

  // Lock body scroll amíg a modal nyitva
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const todayKey = now ? JS_DAY_TO_KEY[now.getDay()] : null

  let label = t(locale, 'openingHours.title')
  let dotClass = 'bg-zinc-300'
  if (status) {
    if (status.open) {
      label = t(locale, 'openingHours.closeAt', { time: status.today?.close_time ?? '' })
      dotClass = 'bg-emerald-400'
    } else if (status.openSoon && status.today?.open_time) {
      label = t(locale, 'openingHours.openAt', { time: status.today.open_time })
      dotClass = 'bg-amber-400'
    } else {
      label = t(locale, 'openingHours.nowClosed')
      dotClass = 'bg-rose-400'
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white/70 backdrop-blur-md ring-1 ring-zinc-900/5 shadow-sm px-5 py-4 text-left transition-colors hover:bg-white/90"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950">
            <Clock className="h-4 w-4 text-white" />
            <span className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${dotClass}`} />
          </span>
          <span className="min-w-0">
            <span className="block font-black text-zinc-900 text-sm leading-tight truncate">{label}</span>
            <span className="block text-xs text-zinc-500 mt-0.5">{t(locale, "openingHours.viewHours")}</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "openingHours.title")}
        >
          <div
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full sm:max-w-md mx-auto sm:mx-5 rounded-t-3xl sm:rounded-3xl bg-white/80 backdrop-blur-2xl ring-1 ring-white/60 shadow-2xl overflow-hidden animate-[slideup_.25s_ease-out]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{t(locale, "openingHours.when")}</p>
                <h3 className="text-xl font-black tracking-tight text-zinc-900">{t(locale, "openingHours.title")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full bg-zinc-900/5 hover:bg-zinc-900/10 flex items-center justify-center transition-colors"
                aria-label={t(locale, "openingHours.close")}
              >
                <X className="h-4 w-4 text-zinc-600" />
              </button>
            </div>
            <div className="px-3 pb-5">
              <div className="rounded-2xl bg-white/60 ring-1 ring-zinc-900/5 divide-y divide-zinc-900/5 overflow-hidden">
                {DAYS_OF_WEEK.map((d) => {
                  const h = byDay.get(d)
                  const isToday = d === todayKey
                  return (
                    <div
                      key={d}
                      className={`flex items-center justify-between px-4 py-3 text-sm ${isToday ? 'bg-zinc-950 text-white' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        {isToday && <span className="text-[10px] font-bold uppercase tracking-wide bg-white/15 px-1.5 py-0.5 rounded-full">{t(locale, "openingHours.today")}</span>}
                        <span className={isToday ? 'font-semibold' : 'text-zinc-700'}>{dayLbl[d]}</span>
                      </span>
                      <span className={h?.is_open ? (isToday ? 'font-semibold' : 'text-zinc-900 font-medium') : (isToday ? 'text-white/50' : 'text-zinc-400')}>
                        {h?.is_open ? `${h.open_time} – ${h.close_time}` : t(locale, "openingHours.closed")}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideup{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  )
}
