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
    router.push(`/bookly/dashboard/bookings?${params}`)
  }

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => push({ status: value, page: '1' })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              status === value
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white/80'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Range + Search row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1">
          {RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => push({ range: value, page: '1' })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                range === value
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-white/30 pointer-events-none" />
          <input
            type="text"
            placeholder="Ügyfélnév..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            className="h-9 pl-8 pr-8 rounded-xl bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.1] text-sm text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:border-zinc-400 dark:focus:border-white/[0.3] transition-colors w-44"
          />
          {searchVal && (
            <button
              onClick={() => { setSearchVal(''); push({ search: '', page: '1' }) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
