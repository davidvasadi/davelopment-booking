'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, addDays, isToday, isTomorrow } from 'date-fns'
import { CalendarClock } from 'lucide-react'
import { t, dfLocale, type Locale } from '@/lib/i18n'

/**
 * Diszkrét, hero-ba illő lebegő kártya: a LEGKÖZELEBBI szabad időpontot mutatja.
 * Szalon → /api/slots (serviceId kell), étterem → /api/restaurant/slots (pax).
 * Ha nincs adat / még tölt, a kártya nem jelenik meg (nem hagy csúnya üres helyet).
 */
interface Slot { start: string; end: string }

const MAX_DAYS_AHEAD = 14

function dayLabel(d: Date, locale: Locale): string {
  if (isToday(d)) return t(locale, 'nextSlots.today')
  if (isTomorrow(d)) return t(locale, 'nextSlots.tomorrow')
  return format(d, 'EEEE', { locale: dfLocale(locale) })
}

type Source =
  | { kind: 'restaurant'; id: string | number; pax?: number }
  | { kind: 'salon'; id: string | number; serviceId: string | number }

export function HeroNextSlot({ slug, source, locale = 'hu' }: { slug: string; source: Source; locale?: Locale }) {
  const [date, setDate] = useState<Date | null>(null)
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function findSoonest() {
      for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
        const d = addDays(new Date(), i)
        const ds = format(d, 'yyyy-MM-dd')
        const url =
          source.kind === 'restaurant'
            ? `/api/restaurant/slots?${new URLSearchParams({ restaurantId: String(source.id), date: ds, pax: String(source.pax ?? 2) })}`
            : `/api/slots?${new URLSearchParams({ salonId: String(source.id), serviceId: String(source.serviceId), date: ds })}`
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const data = await res.json()
          const found: Slot[] = data.slots ?? []
          if (found.length && !cancelled) {
            setDate(d)
            setTime(found[0].start)
            return
          }
        } catch { /* következő nap */ }
      }
    }
    findSoonest()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!date || !time) return null

  const ds = format(date, 'yyyy-MM-dd')
  const q = new URLSearchParams({ date: ds, time })
  if (source.kind === 'restaurant' && source.pax) q.set('pax', String(source.pax))

  return (
    <Link
      href={`/${slug}/book?${q}`}
      className="group inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/90 py-2 pl-2 pr-4 backdrop-blur-[10px] transition-colors hover:bg-white"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/30 text-ink transition-transform group-hover:scale-105">
        <CalendarClock className="h-[16px] w-[16px]" strokeWidth={2} />
      </span>
      <span className="leading-tight">
        <span className="block text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink/50">{t(locale, 'nextSlots.heading')}</span>
        <span className="block text-[13px] font-semibold text-ink">{dayLabel(date, locale)} · {time}</span>
      </span>
    </Link>
  )
}
