'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download } from 'lucide-react'

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
      <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1">
        {PERIODS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => select(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              current === value
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {csvExport && (
        <a
          href={`/api/export-csv?days=${current}${module ? `&module=${module}` : ''}`}
          download
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-zinc-200 dark:border-white/[0.1] text-xs font-semibold text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.3] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          CSV export
        </a>
      )}
    </div>
  )
}
