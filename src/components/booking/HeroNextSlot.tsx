'use client'

import { useEffect, useState } from 'react'
import { format, addDays, isToday, isTomorrow } from 'date-fns'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui-kit'
import { ON_PHOTO } from '@/components/blocks/public'
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
  // az étterem kártyája a `book=1`-re nyílik ki a megadott idővel (a /book átirányít ide)
  if (source.kind === 'restaurant') q.set('book', '1')

  // design 21.1: sötét üveg gomb a fotón, óra-ikonnal — „Legközelebbi szabad: ma · 14:30”
  return (
    <Button size="lg" variant="onDark" icon={Clock} href={`/${slug}/book?${q}`} className={`px-6 ${ON_PHOTO} border-0`}>
      {t(locale, 'nextSlots.heading')}: {dayLabel(date, locale)} · {time}
    </Button>
  )
}
