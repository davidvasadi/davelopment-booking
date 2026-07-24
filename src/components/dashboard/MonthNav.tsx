'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, addMonths, subMonths, startOfMonth, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export function MonthNav({ basePath }: { basePath: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const monthParam = searchParams.get('month')
  const current = monthParam
    ? startOfMonth(parseISO(monthParam + '-01'))
    : startOfMonth(new Date())

  const nextMonth = addMonths(current, 1)
  const nowMonth = startOfMonth(new Date())
  const isAtPresent = current >= nowMonth

  const label = format(current, 'LLLL', { locale: hu })
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1)

  function navigate(d: Date) {
    router.push(`${basePath}?month=${format(d, 'yyyy-MM')}`)
  }

  return (
    <div className="flex items-center h-9 bg-[var(--dav-glass-strong)] border border-line rounded-[12px] overflow-hidden">
      <button
        type="button"
        onClick={() => navigate(subMonths(current, 1))}
        className="flex items-center justify-center w-8 h-full text-ink-soft hover:text-ink hover:bg-white/50 transition-colors"
        aria-label="Előző hónap"
      >
        <ChevronLeft className="h-[15px] w-[15px]" />
      </button>
      <span className="px-1.5 text-sm font-semibold text-ink min-w-[76px] text-center select-none">
        {displayLabel}
      </span>
      <button
        type="button"
        onClick={() => !isAtPresent && navigate(nextMonth)}
        disabled={isAtPresent}
        className={cn(
          'flex items-center justify-center w-8 h-full transition-colors',
          isAtPresent
            ? 'text-ink-soft/30 cursor-not-allowed'
            : 'text-ink-soft hover:text-ink hover:bg-white/50',
        )}
        aria-label="Következő hónap"
      >
        <ChevronRight className="h-[15px] w-[15px]" />
      </button>
    </div>
  )
}
