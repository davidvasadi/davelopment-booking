'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Újrafelhasználható Google-értékelés jelző: 5 csillag (a pontszámnak megfelelően
 * kitöltve) + "X · N Google-értékelés alapján" szöveg. A szín mindig a hívóhelytől
 * örökölt `currentColor` — állítsd be `className`-mel (pl. `text-brand-accent`
 * a Footerben/Kapcsolat-formnál, `text-brand-ink` a sárga Testimonials-kártyán).
 */
export function GoogleRatingBadge({
  rating,
  userRatingCount,
  className,
}: {
  rating: number
  userRatingCount: number
  className?: string
}) {
  const rounded = Math.round(rating)
  return (
    <div className={cn('flex items-center gap-1.5 text-sm', className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="h-3.5 w-3.5"
            fill={i < rounded ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span>
        <span className="font-semibold">{rating}</span> · {userRatingCount} Google-értékelés alapján
      </span>
    </div>
  )
}
