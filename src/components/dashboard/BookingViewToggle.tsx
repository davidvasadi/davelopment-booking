'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, List } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BookingViewToggle({ current }: { current: 'day' | 'list' }) {
  const router = useRouter()
  return (
    <div className="flex gap-1 rounded-2xl border border-line bg-[var(--dav-glass)] p-1">
      <button
        onClick={() => router.push('/dashboard/bookings?view=day')}
        className={cn(
          'flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-[13px] font-semibold transition-all',
          current === 'day'
            ? 'bg-ink-dark text-white'
            : 'text-ink-soft2 hover:text-ink'
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" /> Napi
      </button>
      <button
        onClick={() => router.push('/dashboard/bookings?view=list')}
        className={cn(
          'flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-[13px] font-semibold transition-all',
          current === 'list'
            ? 'bg-ink-dark text-white'
            : 'text-ink-soft2 hover:text-ink'
        )}
      >
        <List className="h-3.5 w-3.5" /> Lista
      </button>
    </div>
  )
}
