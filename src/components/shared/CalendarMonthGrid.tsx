'use client'

// Megosztott hónap-rács renderelő — a `DatePickerPopover` mini-naptárának KÖZÖS, terheltség-
// színezett cella-logikája. Csak a rácsot rajzolja — a fejlécet (hónap-navigáció), az
// adatlekérést és a legendát a hívó felelőssége.

const LOAD_TIERS = [
  { bg: 'rgba(29,157,99,0.50)', text: 'text-ink' },   // Befejezett zöld (nyugodt)
  { bg: '#FFD85F', text: 'text-ink' },                // Függő arany (közepes)
  { bg: 'rgba(29,28,25,0.85)', text: 'text-white' },  // Megerősítve sötét (forgalmas)
] as const

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export { LOAD_TIERS }

export function CalendarMonthGrid({
  year,
  month, // 0-indexelt (Date.getMonth() konvenció)
  value,
  counts,
  onSelectDay,
}: {
  year: number
  month: number
  /** A kijelölt nap (`YYYY-MM-DD`), vagy `null` ha nincs kijelölés. */
  value: string | null
  /** Az adott hónap napi terheltsége (`day-load` API válaszából). */
  counts: Record<string, number>
  onSelectDay: (date: string) => void
}) {
  const maxCount = Math.max(0, ...Object.values(counts))
  const today = ymd(new Date())
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7 // hétfő = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1
    const date = new Date(year, month, dayNum)
    return { date, inMonth: dayNum >= 1 && dayNum <= daysInMonth }
  })

  return (
    <div className="grid grid-cols-7 gap-y-1">
      {cells.map(({ date, inMonth }, i) => {
        const dstr = ymd(date)
        const isSelected = dstr === value
        const isToday = dstr === today
        const count = inMonth ? (counts[dstr] ?? 0) : 0
        // Terheltség-szín: csak a hónap saját napjaira, a max. 3 sávra bontva a hónap
        // legforgalmasabb napjához képest (relatív, nem abszolút kapacitás-százalék).
        const tier =
          isSelected || !inMonth || count === 0 || maxCount === 0
            ? null
            : count > (maxCount * 2) / 3
              ? LOAD_TIERS[2]
              : count > maxCount / 3
                ? LOAD_TIERS[1]
                : LOAD_TIERS[0]
        return (
          <button
            key={i}
            type="button"
            title={count > 0 ? `${count} foglalás` : undefined}
            onClick={() => onSelectDay(dstr)}
            style={tier ? { backgroundColor: tier.bg } : undefined}
            className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium tabular-nums transition-colors ${
              isSelected
                ? `bg-ink-dark text-white ${isToday ? 'ring-2 ring-ink-dark ring-offset-2 ring-offset-white' : ''}`
                : isToday
                  ? `font-bold ring-2 ring-ink-dark ring-offset-2 ring-offset-white ${tier ? tier.text : 'text-ink'}`
                  : tier
                    ? tier.text
                    : inMonth
                      ? 'text-ink hover:bg-paper'
                      : 'text-ink-soft2/50 hover:bg-paper'
            }`}
          >
            {date.getDate()}
          </button>
        )
      })}
    </div>
  )
}
