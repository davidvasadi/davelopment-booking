import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

/** Egységes kártya a dashboard-oldalakon. */
export function DashboardCard({ noPadding, className, children, ...props }: DashboardCardProps) {
  return (
    <div
      className={cn(
        'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl',
        !noPadding && 'px-5 py-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
