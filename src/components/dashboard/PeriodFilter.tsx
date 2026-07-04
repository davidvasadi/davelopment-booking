'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, ChevronDown } from 'lucide-react'

const PERIODS = [
  { label: 'Ma', value: 1 },
  { label: '7 nap', value: 7 },
  { label: '30 nap', value: 30 },
  { label: '90 nap', value: 90 },
  { label: '6 hónap', value: 180 },
  { label: '1 év', value: 365 },
]

const VALID = PERIODS.map(p => p.value)
const STORAGE_KEY = 'analytics-period'

export default function PeriodFilter({
  current,
  basePath = '/dashboard/analytics',
  csvExport = true,
  module,
}: {
  current: number
  basePath?: string
  csvExport?: boolean
  /** Melyik modul foglalásait exportálja a CSV. Üresen a user role-ja dönt. */
  module?: 'restaurant' | 'salon'
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Period param nélküli betöltéskor a korábban mentett választásra irányítunk.
  useEffect(() => {
    if (searchParams.get('period')) return
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    if (VALID.includes(saved) && saved !== current) {
      router.replace(`${basePath}?period=${saved}`)
    }
  }, [searchParams, current, basePath, router])

  const select = (value: number) => {
    localStorage.setItem(STORAGE_KEY, String(value))
    router.push(`${basePath}?period=${value}`)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Időszak — select gomb (mockup „This Month ⌄" stílus) */}
      <div className="relative">
        <select
          value={current}
          onChange={(e) => select(Number(e.target.value))}
          className="appearance-none bg-[var(--dav-glass-strong)] border border-line rounded-[12px] pl-4 pr-9 h-9 text-sm font-semibold text-ink focus:outline-none focus:border-line-strong cursor-pointer transition-colors"
        >
          {PERIODS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
      </div>
      {csvExport && (
        <a
          href={`/api/export-csv?days=${current}${module ? `&module=${module}` : ''}`}
          download
          className="flex items-center gap-1.5 h-8 px-3 rounded-[12px] border border-line text-xs font-semibold text-ink-soft2 hover:text-ink hover:border-line-strong transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          CSV export
        </a>
      )}
    </div>
  )
}
