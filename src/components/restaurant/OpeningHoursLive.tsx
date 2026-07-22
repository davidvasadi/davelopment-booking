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

const JS_DAY_TO_KEY: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function toMinutes(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

export default function OpeningHoursLive({
  hours,
  locale = 'hu',
  variant = 'light',
}: {
  hours: DayHour[]
  locale?: Locale
  variant?: 'light' | 'dark'
}) {
  const dk = variant === 'dark'
  const dayLbl = dayLabels(locale)
  const [open, setOpen] = useState(false)
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

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const todayKey = now ? JS_DAY_TO_KEY[now.getDay()] : null

  let label = t(locale, 'openingHours.title')
  let dotClass = 'bg-ink-soft2'
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

  const triggerBg = dk ? { background: 'rgba(255,255,255,0.07)' } : undefined
  const triggerCls = dk
    ? 'flex w-full items-center justify-between gap-3 rounded-[16px] border border-white/10 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]'
    : 'flex w-full items-center justify-between gap-3 rounded-[16px] bg-white/40 px-5 py-4 text-left transition-colors hover:bg-white/60'
  const clockBgCls = dk ? 'bg-white/15' : 'bg-ink-dark'
  const clockIconCls = dk ? 'text-white/80' : 'text-white'
  const dotRingCls = dk ? '' : 'ring-2 ring-white'
  const labelCls = dk ? 'text-white' : 'text-ink'
  const subLabelCls = dk ? 'text-white/50' : 'text-ink-soft'
  const chevronCls = dk ? 'text-white/30' : 'text-ink-soft'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerCls} style={triggerBg}>
        <span className="flex items-center gap-3 min-w-0">
          <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${clockBgCls}`}>
            <Clock className={`h-4 w-4 ${clockIconCls}`} />
            {status?.open && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 opacity-70 animate-ping" />
            )}
            <span className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ${dotRingCls} ${dotClass}`} />
          </span>
          <span className="min-w-0">
            <span className={`block font-semibold text-sm leading-tight truncate ${labelCls}`}>{label}</span>
            <span className={`block text-xs mt-0.5 ${subLabelCls}`}>{t(locale, 'openingHours.viewHours')}</span>
          </span>
        </span>
        <ChevronRight className={`h-4 w-4 shrink-0 ${chevronCls}`} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, 'openingHours.title')}
        >
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full sm:max-w-md mx-auto sm:mx-5 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-[slideup_.25s_ease-out]"
            style={{
              background: 'rgba(22,22,26,0.90)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{t(locale, 'openingHours.when')}</p>
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-white">{t(locale, 'openingHours.title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label={t(locale, 'openingHours.close')}
              >
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>
            <div className="px-3 pb-5">
              <div className="rounded-[18px] divide-y divide-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                {DAYS_OF_WEEK.map((d) => {
                  const h = byDay.get(d)
                  const isToday = d === todayKey
                  return (
                    <div
                      key={d}
                      className={`flex items-center justify-between px-4 py-3 text-sm ${isToday ? 'bg-white/10' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        {isToday && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-white/15 text-white/70 px-1.5 py-0.5 rounded-full">
                            {t(locale, 'openingHours.today')}
                          </span>
                        )}
                        <span className={isToday ? 'font-semibold text-white' : 'text-white/50'}>{dayLbl[d]}</span>
                      </span>
                      <span className={h?.is_open ? (isToday ? 'font-semibold text-white' : 'text-white/70') : 'text-white/30'}>
                        {h?.is_open ? `${h.open_time} – ${h.close_time}` : t(locale, 'openingHours.closed')}
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
