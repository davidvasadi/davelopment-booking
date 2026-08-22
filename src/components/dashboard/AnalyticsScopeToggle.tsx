import Link from 'next/link'

/**
 * Üzlet ↔ Saját munka váltó a Statisztikák fejlécében — CSAK azoknak jelenik meg, akiknek
 * `analytics.view` (teljes cég) joguk van, DE ők is lehetnek egyben dolgozó szakemberek/
 * felszolgálók (pl. a tulaj maga is vág hajat, egy üzletvezető is dolgozik műszakot) — enélkül
 * nekik nem volt módjuk megnézni a SAJÁT munkájukkal kapcsolatos adatokat, csak a teljes
 * üzletet. Aki csak `.view.own`-nal rendelkezik, azt a page.tsx már eleve az „own" nézetre
 * kényszeríti — nekik ez a váltó nem is jelenik meg (nincs mit választani).
 */
export function AnalyticsScopeToggle({
  basePath,
  scope,
  period,
  from,
  to,
}: {
  basePath: string
  scope: 'business' | 'own'
  /** Az aktuális időszak megőrzéséhez, hogy a nézet-váltás ne dobja el a kiválasztott periódust. */
  period?: number
  from?: string
  to?: string
}) {
  const rangeQuery = from && to ? `from=${from}&to=${to}` : `period=${period ?? 30}`
  const hrefFor = (s: 'business' | 'own') => `${basePath}?${rangeQuery}&scope=${s}`
  const items: { key: 'business' | 'own'; label: string }[] = [
    { key: 'business', label: 'Üzlet' },
    { key: 'own', label: 'Saját munka' },
  ]
  return (
    <div className="inline-flex h-11 lg:h-9 items-center gap-0.5 rounded-dav-pill border border-line bg-[var(--dav-glass-strong)] p-1">
      {items.map(({ key, label }) => (
        <Link
          key={key}
          href={hrefFor(key)}
          className={`flex items-center px-3.5 sm:px-4 py-1.5 rounded-[15px] text-[13px] font-semibold transition-colors ${
            scope === key ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
