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
  /** Több-üzlet: hány üzlet tartozik ehhez a fiókhoz (>1 esetén jelöljük). */
  ownerBusinessCount?: number
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-[18px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Keresés név, email, város alapján…"
            className="w-full rounded-[22px] border border-line bg-white py-[11px] pl-11 pr-4 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:outline-none"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-[22px] bg-[#F6F2E4] p-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'h-9 flex-1 rounded-[18px] px-3.5 text-[13px] font-semibold transition-colors sm:flex-none',
                filter === f.value
                  ? 'bg-ink-dark text-white'
                  : 'text-ink-soft hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-line bg-white p-2.5 shadow-dav-card">
        {/* Desktop header */}
        <div className="hidden grid-cols-[1fr_200px_110px_100px_60px] gap-4 px-[13px] py-2 lg:grid">
          {['Hely', 'Tulajdonos', 'Foglalások', 'Regisztrált', 'Aktív'].map(h => (
            <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-ink-soft">
            {query || filter !== 'all' ? 'Nincs találat.' : 'Nincs egyetlen hely sem.'}
          </p>
        ) : (
          <div className="flex flex-col gap-[3px]">
            {filtered.map((p) => {
              const Icon = p.kind === 'restaurant' ? UtensilsCrossed : Building2
              const typeLabel = p.kind === 'restaurant' ? 'Étterem' : 'Szalon'
              const date = new Date(p.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <div key={`${p.kind}-${p.id}`}>
                  {/* Mobile — card stack */}
                  <div
                    className="flex cursor-pointer items-start gap-3 rounded-[20px] p-[13px] transition-colors hover:bg-[#FCFAF1] lg:hidden"
                    onClick={() => openDetail(p)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#F0EAD8]">
                      <Icon className="h-4 w-4 text-ink" strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-[14px] font-semibold text-ink">{p.name}</p>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{typeLabel}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.is_active ? 'bg-[#E7F2EA] text-[#1D9D63]' : 'bg-[#F0EAD8] text-ink-soft'}`}>
                          {p.is_active ? 'Aktív' : 'Inaktív'}
                        </span>
                      </div>
                      <p className="truncate text-[11.5px] text-ink-soft">{p.ownerEmail ?? '—'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {p.city && <span className="flex items-center gap-1 text-[11.5px] text-ink-soft"><MapPin className="h-3 w-3" />{p.city}</span>}
                        <span className="flex items-center gap-1 text-[11.5px] text-ink-soft"><CalendarCheck className="h-3 w-3" />{p.bookingCount}</span>
                        <span className="text-[11.5px] text-ink-soft">{date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div
                    className="hidden cursor-pointer grid-cols-[1fr_200px_110px_100px_60px] items-center gap-4 rounded-[20px] px-[13px] py-3 transition-colors hover:bg-[#FCFAF1] lg:grid"
                    onClick={() => openDetail(p)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#F0EAD8]">
                        <Icon className="h-4 w-4 text-ink" strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold text-ink">{p.name}</span>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{typeLabel}</span>
                        </p>
                        {p.city && <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-soft"><MapPin className="h-3 w-3" />{p.city}</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[13px] text-ink">
                        <span className="truncate">{p.ownerEmail ?? '—'}</span>
                        {(p.ownerBusinessCount ?? 1) > 1 && (
                          <span className="shrink-0 rounded-full bg-[#FBF4DC] px-1.5 py-0.5 text-[10px] font-bold text-[#7A6A2E]">
                            {p.ownerBusinessCount} üzletből
                          </span>
                        )}
                      </p>
                      {p.ownerName && <p className="mt-0.5 truncate text-[11px] text-ink-soft">{p.ownerName}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-ink-soft" />
                      <span className="text-[13.5px] font-semibold text-ink">{p.bookingCount}</span>
                    </div>
                    <span className="text-[11.5px] text-ink-soft">{date}</span>
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
        <p className="text-center text-[12px] text-ink-soft">{filtered.length} találat</p>
      )}
    </>
  )
}
