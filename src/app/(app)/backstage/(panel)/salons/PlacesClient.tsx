'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Building2, UtensilsCrossed, MapPin, CalendarCheck, Search } from 'lucide-react'
import PlaceToggle from './PlaceToggle'
import PlaceDetailSheet from '@/components/backstage/PlaceDetailSheet'
import type { PlaceKind } from '@/lib/backstagePlaces'
import { cn } from '@/lib/utils'

export type PlaceRow = {
  kind: PlaceKind
  id: string
  name: string
  slug: string
  city?: string | null
  is_active?: boolean | null
  createdAt: string
  ownerEmail?: string
  ownerName?: string
  bookingCount: number
}

type Filter = 'all' | PlaceKind

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'salon', label: 'Szalonok' },
  { value: 'restaurant', label: 'Éttermek' },
]

export default function PlacesClient({ places }: { places: PlaceRow[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<{ id: string; kind: PlaceKind } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const searchParams = useSearchParams()

  // A ⌘K kereső találata `?place=salon:ID` / `?place=restaurant:ID`-vel ide navigál → sheet nyit.
  const placeParam = searchParams.get('place')
  useEffect(() => {
    if (!placeParam) return
    const [kind, id] = placeParam.split(':')
    if ((kind === 'salon' || kind === 'restaurant') && id) {
      setSelected({ id, kind })
      setSheetOpen(true)
    }
  }, [placeParam])

  const filtered = places.filter(p => {
    if (filter !== 'all' && p.kind !== filter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.ownerEmail ?? '').toLowerCase().includes(q) ||
      (p.city ?? '').toLowerCase().includes(q)
    )
  })

  function openDetail(p: PlaceRow) {
    setSelected({ id: p.id, kind: p.kind })
    setSheetOpen(true)
  }

  return (
    <>
      <PlaceDetailSheet place={selected} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Search + type filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Keresés név, email, város alapján…"
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-white/[0.2] transition-colors"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-xl bg-zinc-100 dark:bg-white/[0.04] p-1 shrink-0">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex-1 sm:flex-none px-3 h-8 rounded-lg text-xs font-semibold transition-colors',
                filter === f.value
                  ? 'bg-white dark:bg-white/[0.08] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white/70',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
        {/* Desktop header */}
        <div className="hidden lg:grid grid-cols-[1fr_200px_110px_100px_60px] gap-4 px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
          {['Hely', 'Tulajdonos', 'Foglalások', 'Regisztrált', 'Aktív'].map(h => (
            <span key={h} className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-zinc-400 dark:text-zinc-600 text-sm text-center">
            {query || filter !== 'all' ? 'Nincs találat.' : 'Nincs egyetlen hely sem.'}
          </p>
        ) : (
          <div>
            {filtered.map((p, i) => {
              const Icon = p.kind === 'restaurant' ? UtensilsCrossed : Building2
              const typeLabel = p.kind === 'restaurant' ? 'Étterem' : 'Szalon'
              const date = new Date(p.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })
              const showBorder = i < filtered.length - 1

              return (
                <div key={`${p.kind}-${p.id}`} className={showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}>
                  {/* Mobile */}
                  <div
                    className="lg:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => openDetail(p)}
                  >
                    <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-zinc-900 dark:text-white text-sm font-semibold truncate">{p.name}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 shrink-0">{typeLabel}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${p.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-400'}`}>
                          {p.is_active ? 'Aktív' : 'Inaktív'}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs truncate">{p.ownerEmail ?? '—'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {p.city && <span className="flex items-center gap-1 text-zinc-400 dark:text-zinc-600 text-xs"><MapPin className="h-3 w-3" />{p.city}</span>}
                        <span className="flex items-center gap-1 text-zinc-400 dark:text-zinc-600 text-xs"><CalendarCheck className="h-3 w-3" />{p.bookingCount}</span>
                        <span className="text-zinc-400 dark:text-zinc-600 text-xs">{date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div
                    className="hidden lg:grid grid-cols-[1fr_200px_110px_100px_60px] gap-4 items-center px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => openDetail(p)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 min-w-0">
                          <span className="text-zinc-900 dark:text-white text-sm font-medium truncate">{p.name}</span>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{typeLabel}</span>
                        </p>
                        {p.city && <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{p.city}</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-zinc-600 dark:text-zinc-300 text-xs truncate">{p.ownerEmail ?? '—'}</p>
                      {p.ownerName && <p className="text-zinc-400 dark:text-zinc-600 text-[11px] truncate mt-0.5">{p.ownerName}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-600" />
                      <span className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">{p.bookingCount}</span>
                    </div>
                    <span className="text-zinc-400 dark:text-zinc-600 text-xs">{date}</span>
                    <div onClick={e => e.stopPropagation()}>
                      <PlaceToggle kind={p.kind} placeId={p.id} isActive={p.is_active ?? false} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {(query || filter !== 'all') && filtered.length > 0 && (
        <p className="text-zinc-400 dark:text-zinc-600 text-xs text-center">{filtered.length} találat</p>
      )}
    </>
  )
}
