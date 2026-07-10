import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

/** Egységes kártya a dashboard-oldalakon (davelopment-design: fehér, lekerekített, finom árnyék). */
export function DashboardCard({ noPadding, className, children, ...props }: DashboardCardProps) {
  return (
    <div
      className={cn(
        'dav-card-glass rounded-[22px]',
        !noPadding && 'px-5 py-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
