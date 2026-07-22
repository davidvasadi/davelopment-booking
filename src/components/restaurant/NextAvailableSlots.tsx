'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { format, addDays, isToday, isTomorrow } from 'date-fns'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { t, dfLocale, type Locale } from '@/lib/i18n'

interface Slot { start: string; end: string }

const MAX_DAYS_AHEAD = 14
const SLOTS_SHOWN = 5

function dayLabel(d: Date, locale: Locale): string {
  if (isToday(d)) return t(locale, 'nextSlots.today')
  if (isTomorrow(d)) return t(locale, 'nextSlots.tomorrow')
  return format(d, 'EEEE', { locale: dfLocale(locale) })
}

export default function NextAvailableSlots({
  restaurantId,
  slug,
  pax = 2,
  locale = 'hu',
  variant = 'light',
  onSlotClick,
}: {
  restaurantId: string | number
  slug: string
  pax?: number
  locale?: Locale
  variant?: 'light' | 'dark'
  onSlotClick?: (date: string, time: string, pax: number) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const dk = variant === 'dark'

  useEffect(() => {
    let cancelled = false
    async function findSoonest() {
      for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
        const d = addDays(new Date(), i)
        const ds = format(d, 'yyyy-MM-dd')
        const q = new URLSearchParams({ restaurantId: String(restaurantId), date: ds, pax: String(pax) })
        try {
          const res = await fetch(`/api/restaurant/slots?${q}`)
          if (!res.ok) continue
          const data = await res.json()
          const found: Slot[] = data.slots ?? []
          if (found.length && !cancelled) {
            setDate(d)
            setSlots(found)
            setLoading(false)
            return
          }
        } catch {
          /* következő nap */
        }
      }
      if (!cancelled) setLoading(false)
    }
    findSoonest()
    return () => { cancelled = true }
  }, [restaurantId, pax])

  function goToBook(date: Date, time?: string) {
    if (onSlotClick && time) {
      onSlotClick(format(date, 'yyyy-MM-dd'), time, pax)
      return
    }
    const ds = format(date, 'yyyy-MM-dd')
    const q = new URLSearchParams({ date: ds, pax: String(pax) })
    if (time) q.set('time', time)
    router.push(`/${slug}/book?${q}`)
  }

  const containerCls = dk
    ? 'rounded-[16px] px-5 py-5 border border-white/10'
    : 'rounded-[16px] bg-white/40 px-5 py-5'
  const containerStyle = dk ? { background: 'rgba(255,255,255,0.07)' } : undefined

  if (loading) {
    return (
      <div className={containerCls} style={containerStyle}>
        <div className={`flex items-center gap-2 text-sm ${dk ? 'text-white/50' : 'text-ink-soft'}`}>
          <CalendarClock className="h-4 w-4 animate-pulse" />
          {t(locale, 'nextSlots.heading')}…
        </div>
      </div>
    )
  }

  if (!date || !slots.length) {
    return (
      <div className={containerCls} style={containerStyle}>
        <p className={`text-sm ${dk ? 'text-white/50' : 'text-ink-soft'}`}>
          {t(locale, 'nextSlots.none')}
        </p>
      </div>
    )
  }

  const shown = slots.slice(0, SLOTS_SHOWN)
  const more = slots.length - shown.length

  return (
    <div className={containerCls} style={containerStyle}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${dk ? 'text-white/50' : 'text-ink-soft'}`}>
            {t(locale, 'nextSlots.heading')} · {dayLabel(date, locale)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((s, i) => (
          <motion.button
            key={s.start}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: i * 0.055 }}
            onClick={() => goToBook(date, s.start)}
            className={`h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
              dk
                ? 'text-white border border-white/20 hover:bg-white/20'
                : 'bg-ink-dark text-white hover:opacity-90'
            }`}
            style={dk ? { background: 'rgba(255,255,255,0.12)' } : undefined}
          >
            {s.start}
          </motion.button>
        ))}
        {more > 0 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: shown.length * 0.055 }}
            onClick={() => goToBook(date)}
            className={`h-10 px-4 rounded-full text-sm font-semibold transition-colors inline-flex items-center gap-1 ${
              dk
                ? 'text-white/60 border border-white/12 hover:bg-white/10'
                : 'bg-paper/50 text-ink-soft hover:bg-paper/80'
            }`}
            style={dk ? { background: 'rgba(255,255,255,0.06)' } : undefined}
          >
            {t(locale, 'nextSlots.moreSlots', { n: more })} <ChevronRight className="h-3.5 w-3.5" />
          </motion.button>
        )}
      </div>
    </div>
  )
}
