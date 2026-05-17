'use client'

import { useState } from 'react'
import { Building2, MapPin, CalendarCheck, Search } from 'lucide-react'
import SalonToggle from './SalonToggle'
import SalonDetailSheet from '@/components/backstage/SalonDetailSheet'

type SalonRow = {
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

export default function SalonsClient({ salons }: { salons: SalonRow[] }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const filtered = query.trim()
    ? salons.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        (s.ownerEmail ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (s.city ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : salons

  function openDetail(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <>
      <SalonDetailSheet salonId={selectedId} open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Keresés név, email, város alapján..."
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-white/[0.2] transition-colors"
        />
      </div>

      <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Desktop header */}
        <div className="hidden lg:grid grid-cols-[1fr_200px_110px_100px_60px] gap-4 px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
          {['Szalon', 'Tulajdonos', 'Foglalások', 'Regisztrált', 'Aktív'].map(h => (
            <span key={h} className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-zinc-400 dark:text-zinc-600 text-sm text-center">
            {query ? 'Nincs találat.' : 'Nincs egyetlen szalon sem.'}
          </p>
        ) : (
          <div>
            {filtered.map((s, i) => {
              const date = new Date(s.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })
              const showBorder = i < filtered.length - 1

              return (
                <div key={s.id} className={showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}>
                  {/* Mobile */}
                  <div
                    className="lg:hidden flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => openDetail(s.id)}
                  >
                    <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-zinc-900 dark:text-white text-sm font-semibold truncate">{s.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${s.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-400'}`}>
                          {s.is_active ? 'Aktív' : 'Inaktív'}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-xs truncate">{s.ownerEmail ?? '—'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {s.city && <span className="flex items-center gap-1 text-zinc-400 dark:text-zinc-600 text-xs"><MapPin className="h-3 w-3" />{s.city}</span>}
                        <span className="flex items-center gap-1 text-zinc-400 dark:text-zinc-600 text-xs"><CalendarCheck className="h-3 w-3" />{s.bookingCount}</span>
                        <span className="text-zinc-400 dark:text-zinc-600 text-xs">{date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div
                    className="hidden lg:grid grid-cols-[1fr_200px_110px_100px_60px] gap-4 items-center px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => openDetail(s.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{s.name}</p>
                        {s.city && <p className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{s.city}</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-zinc-600 dark:text-zinc-300 text-xs truncate">{s.ownerEmail ?? '—'}</p>
                      {s.ownerName && <p className="text-zinc-400 dark:text-zinc-600 text-[11px] truncate mt-0.5">{s.ownerName}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-600" />
                      <span className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">{s.bookingCount}</span>
                    </div>
                    <span className="text-zinc-400 dark:text-zinc-600 text-xs">{date}</span>
                    <div onClick={e => e.stopPropagation()}>
                      <SalonToggle salonId={s.id} isActive={s.is_active ?? false} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {query && filtered.length > 0 && (
        <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-3 text-center">{filtered.length} találat</p>
      )}
    </>
  )
}
