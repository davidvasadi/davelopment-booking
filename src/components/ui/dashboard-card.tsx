import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface DashboardCardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

/** Régi név, új kinézet: a kit krém-üveg kártyája (Card tone="glass": fehér 60% + elmosás, 26px, árnyék nélkül, p-5).
 *  Az oldalak átépítésekor a hívók a kit Card-ját kapják, és ez a fájl törlődik. */
export function DashboardCard({ noPadding, className, children, ...props }: DashboardCardProps) {
  return (
    <div className={cn('rounded-ui-card bg-white/60 backdrop-blur-lg', !noPadding && 'p-5', className)} {...props}>
      {children}
    </div>
  )
}
