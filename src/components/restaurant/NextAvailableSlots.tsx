'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
}: {
  restaurantId: string | number
  slug: string
  pax?: number
  locale?: Locale
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])

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
    const ds = format(date, 'yyyy-MM-dd')
    const q = new URLSearchParams({ date: ds, pax: String(pax) })
    if (time) q.set('time', time)
    router.push(`/${slug}/book?${q}`)
  }

  if (loading) {
    return (
      <div className="rounded-[16px] bg-white/40 px-5 py-5">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <CalendarClock className="h-4 w-4 animate-pulse" />
          Szabad időpontok keresése…
        </div>
      </div>
    )
  }

  if (!date || !slots.length) {
    return (
      <div className="rounded-[16px] bg-white/40 px-5 py-5">
        <p className="text-sm text-ink-soft">
          A következő napokra nincs szabad időpont — kérjük, válasszon dátumot a foglalásnál.
        </p>
      </div>
    )
  }

  const shown = slots.slice(0, SLOTS_SHOWN)
  const more = slots.length - shown.length

  return (
    <div className="rounded-[16px] bg-white/40 px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            {t(locale, 'nextSlots.heading')} · {dayLabel(date, locale)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((s) => (
          <button
            key={s.start}
            type="button"
            onClick={() => goToBook(date, s.start)}
            className="h-10 px-4 rounded-full bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-colors"
          >
            {s.start}
          </button>
        ))}
        {more > 0 && (
          <button
            type="button"
            onClick={() => goToBook(date)}
            className="h-10 px-4 rounded-full bg-paper/50 text-ink-soft text-sm font-semibold hover:bg-paper/80 transition-colors inline-flex items-center gap-1"
          >
            {t(locale, 'nextSlots.moreSlots', { n: more })} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
