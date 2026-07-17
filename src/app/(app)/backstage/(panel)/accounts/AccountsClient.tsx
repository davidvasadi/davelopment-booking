'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Users, CalendarCheck, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listStagger } from '@/lib/motion'
import { StatusBadge, formatHuf } from '@/components/backstage/BackstageUi'
import { EmptyState } from '@/components/ui/empty-state'
import type { SubStatus } from '@/lib/backstageMetrics'

export type AccountRow = {
  ownerId: string
  email: string
  name: string
  status: SubStatus | null
  mrr: number
  salonCount: number
  restaurantCount: number
  placeCount: number
  totalBookings: number
  recentBookings: number
  createdAt: string
  trialEndsAt: string | null
}

type Filter = 'all' | 'active' | 'trialing' | 'past_due' | 'canceled'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Mind' },
  { value: 'active', label: 'Fizető' },
  { value: 'trialing', label: 'Próba' },
  { value: 'past_due', label: 'Lejárt' },
  { value: 'canceled', label: 'Lemondott' },
]

function composition(a: AccountRow): string {
  const parts: string[] = []
  if (a.salonCount) parts.push(`${a.salonCount} szalon`)
  if (a.restaurantCount) parts.push(`${a.restaurantCount} étterem`)
  return parts.length ? parts.join(' · ') : 'nincs üzlet'
}

export default function AccountsClient({ accounts }: { accounts: AccountRow[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => accounts.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return a.email.toLowerCase().includes(q) || (a.name ?? '').toLowerCase().includes(q)
  }), [accounts, query, filter])

  return (
    <div className="space-y-3">
      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-[18px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Keresés email vagy név alapján…"
            className="w-full rounded-[22px] border border-line bg-white py-[11px] pl-11 pr-4 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:border-line-strong focus:outline-none"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto rounded-[22px] border border-line bg-white p-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'h-9 shrink-0 rounded-[18px] px-3.5 text-[13px] font-semibold transition-colors',
                filter === f.value ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[26px] p-2.5 dav-card-glass">
        {/* Desktop header */}
        <div className="hidden grid-cols-[1fr_150px_120px_120px_90px_40px] gap-4 px-[13px] py-2 lg:grid">
          {['Fiók', 'Összetétel', 'Havi díj', 'Foglalás', 'Státusz', ''].map((h, i) => (
            <span key={i} className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title={query || filter !== 'all' ? 'Nincs találat' : 'Nincs egyetlen fiók sem'} description={query || filter !== 'all' ? 'Próbálj más keresést vagy szűrőt.' : undefined} />
        ) : (
          <motion.div variants={listStagger.container} initial="hidden" animate="show" className="flex flex-col gap-[3px]">
            {filtered.map((a) => {
              const date = new Date(a.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })
              const initial = (a.name || a.email || '?').trim()[0]?.toUpperCase() ?? '?'
              return (
                <motion.div key={a.ownerId} variants={listStagger.item}>
                  <Link
                    href={`/backstage/accounts/${a.ownerId}`}
                    className="group block rounded-[18px] px-[13px] py-3 transition-colors hover:bg-white"
                  >
                    {/* Desktop */}
                    <div className="hidden grid-cols-[1fr_150px_120px_120px_90px_40px] items-center gap-4 lg:grid">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[13px] font-bold text-white">{initial}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-ink">{a.email}</p>
                          {a.name && <p className="truncate text-[11.5px] text-ink-soft">{a.name} · {date}</p>}
                        </div>
                      </div>
                      <span className="truncate text-[12.5px] text-ink-soft">{composition(a)}</span>
                      <span className="text-[13.5px] font-semibold text-ink">{a.mrr > 0 ? formatHuf(a.mrr) : '—'}</span>
                      <span className="flex items-center gap-1.5 text-[13px] text-ink"><CalendarCheck className="h-3.5 w-3.5 text-ink-soft" />{a.totalBookings}</span>
                      <StatusBadge status={a.status} />
                      <ArrowRight className="h-4 w-4 text-ink-soft2 transition-transform group-hover:translate-x-0.5" />
                    </div>

                    {/* Mobile */}
                    <div className="flex items-start gap-3 lg:hidden">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[13px] font-bold text-white">{initial}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-[14px] font-semibold text-ink">{a.email}</p>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="truncate text-[11.5px] text-ink-soft">{composition(a)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-soft">
                          {a.mrr > 0 && <span className="font-semibold text-ink">{formatHuf(a.mrr)}</span>}
                          <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" />{a.totalBookings}</span>
                          <span>{date}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {(query || filter !== 'all') && filtered.length > 0 && (
        <p className="text-center text-[12px] text-ink-soft">{filtered.length} találat</p>
      )}
    </div>
  )
}
