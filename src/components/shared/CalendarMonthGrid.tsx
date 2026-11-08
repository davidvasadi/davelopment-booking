'use client'

import { IconCircle } from '@/components/ui-kit'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Egy hónap napjai (a /design MiniMonth-ja szerint): sima számok, a kiválasztott nap sötét körben, a hónapon
 * kívüli halvány, a zárt nap csíkos és halvány (nem foglalható). `rangeTo`: időszak (`value`–`rangeTo`) — a két vég sötét
 * körben, köztük cella-szín (a design MiniMonth tartománya).
 */
export function CalendarMonthGrid({ year, month, value, rangeTo, closed, load, onSelectDay }: {
  year: number
  /** 0-indexelt (Date.getMonth() konvenció) */
  month: number
  /** A kijelölt nap (`YYYY-MM-DD`), vagy `null` ha nincs kijelölés. */
  value: string | null
  /** időszak vége (`YYYY-MM-DD`) — ha adott, `value`–`rangeTo` tartomány */
  rangeTo?: string | null
  /** zárt nap-e (csíkos) */
  closed?: (date: string) => boolean
  /** foglaltsági fokozat (design 6.20): 1 szabad, 2 közepes, 3 telt — ha adott, a napok színes cellák, a kiválasztott sötét */
  load?: (date: string) => 1 | 2 | 3
  onSelectDay: (date: string) => void
}) {
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7 // Hétfő = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  return (
    <div className="grid grid-cols-7 gap-y-1 text-center">
      {Array.from({ length: totalCells }, (_, i) => {
        const dayNum = i - startOffset + 1
        const date = new Date(year, month, dayNum)
        const inMonth = dayNum >= 1 && dayNum <= daysInMonth
        const key = ymd(date)
        const isClosed = inMonth && !!closed?.(key)
        const end = key === value || (!!rangeTo && key === rangeTo)
        const inside = !!value && !!rangeTo && key > value && key < rangeTo
        if (load && inMonth) {
          const tier = isClosed ? 0 : load(key)
          const cls = end ? 'bg-ui-dark text-white' : isClosed ? 'ui-hatch-cell text-ui-muted' : tier === 3 ? 'bg-ui-yellow text-ui-dark' : tier === 2 ? 'bg-ui-yellow/40 text-ui-text' : 'bg-ui-cell text-ui-text'
          return (
            <button key={i} type="button" onClick={() => onSelectDay(key)} title={isClosed ? 'Zárva' : undefined}
              className={`mx-0.5 flex h-9 items-center justify-center rounded-ui-control text-ui-meta outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${cls}`}>
              {date.getDate()}
            </button>
          )
        }
        return (
          <button key={i} type="button" onClick={() => onSelectDay(key)} title={isClosed ? 'Zárva' : undefined}
            className={`flex h-9 items-center justify-center text-ui-meta outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${inside ? `bg-ui-cell ${i % 7 === 0 ? 'rounded-l-full' : ''} ${i % 7 === 6 ? 'rounded-r-full' : ''}` : 'rounded-ui-control'} ${isClosed && !end ? 'ui-hatch-cell text-ui-muted' : ''}`}>
            {end
              ? <IconCircle size="md">{date.getDate()}</IconCircle>
              : <span className={!inMonth ? 'text-ui-grey' : isClosed ? 'text-ui-muted' : 'text-ui-text'}>{date.getDate()}</span>}
          </button>
        )
      })}
    </div>
  )
}
