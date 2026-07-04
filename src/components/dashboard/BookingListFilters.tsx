'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Összes' },
  { value: 'pending', label: 'Függő' },
  { value: 'confirmed', label: 'Megerősített' },
  { value: 'cancelled', label: 'Lemondott' },
  { value: 'completed', label: 'Befejezett' },
]

const RANGE_OPTIONS = [
  { value: 'week', label: 'Ez a hét' },
  { value: 'month', label: 'Ez a hónap' },
  { value: '30', label: '30 nap' },
  { value: '90', label: '90 nap' },
  { value: 'all', label: 'Összes' },
]

interface Props {
  status: string
  range: string
  search: string
}

export default function BookingListFilters({ status, range, search }: Props) {
  const router = useRouter()
  const [searchVal, setSearchVal] = useState(search)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    const timer = setTimeout(() => {
      push({ search: searchVal, page: '1' })
    }, 380)
    return () => clearTimeout(timer)
  }, [searchVal])

  const push = (override: Record<string, string>) => {
    const params = new URLSearchParams({
      view: 'list', status, range, search: searchVal, page: '1', ...override,
    })
    router.push(`/dashboard/bookings?${params}`)
  }

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => push({ status: value, page: '1' })}
            className={cn(
              'rounded-dav-pill px-4 py-1.5 text-[13px] font-semibold transition-all',
              status === value
                ? 'bg-ink-dark text-white'
                : 'border border-line bg-[var(--dav-glass)] text-ink-soft2 hover:text-ink'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Range + Search row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl border border-line bg-[var(--dav-glass)] p-1">
          {RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => push({ range: value, page: '1' })}
              className={cn(
                'rounded-xl px-4 py-1.5 text-[13px] font-semibold transition-all',
                range === value
                  ? 'bg-ink-dark text-white'
                  : 'text-ink-soft2 hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            placeholder="Ügyfélnév..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            className="h-[42px] w-48 rounded-2xl border border-line bg-white pl-9 pr-9 text-sm text-ink placeholder:text-ink-soft focus:border-line-strong focus:outline-none transition-colors"
          />
          {searchVal && (
            <button
              onClick={() => { setSearchVal(''); push({ search: '', page: '1' }) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
