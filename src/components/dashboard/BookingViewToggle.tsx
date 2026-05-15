'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, List } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BookingViewToggle({ current }: { current: 'day' | 'list' }) {
  const router = useRouter()
  return (
    <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1">
      <button
        onClick={() => router.push('/bookly/dashboard/bookings?view=day')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
          current === 'day'
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" /> Napi
      </button>
      <button
        onClick={() => router.push('/bookly/dashboard/bookings?view=list')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
          current === 'list'
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'
        )}
      >
        <List className="h-3.5 w-3.5" /> Lista
      </button>
    </div>
  )
}
