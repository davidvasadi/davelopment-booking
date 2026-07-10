import { Star } from 'lucide-react'

/**
 * Google-értékelés csillag-sor: kitöltött / rész-kitöltött / üres csillagok + a szám és
 * (opcionálisan) az értékelők száma. A `rating` 0–5, `count` az értékelők száma.
 * Jelenleg placeholder-adattal hívjuk; a Google Places API bekötésekor valós adatot kap.
 * A design az Áttekintés hangulata: arany csillag, ink szám, ink-soft másodlagos szöveg.
 */
export function RatingStars({
  rating,
  count,
  source = 'Google',
  className = '',
}: {
  rating: number
  count?: number | null
  source?: string
  className?: string
}) {
  const full = Math.floor(rating)
  const frac = rating - full
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = i < full ? 1 : i === full ? frac : 0
          return (
            <span key={i} className="relative inline-block h-[17px] w-[17px]">
              <Star className="absolute inset-0 h-[17px] w-[17px] text-black/12" strokeWidth={0} fill="currentColor" />
              {fill > 0 && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                  <Star className="h-[17px] w-[17px] text-gold" strokeWidth={0} fill="currentColor" />
                </span>
              )}
            </span>
          )
        })}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{rating.toFixed(1)}</span>
        {count != null && (
          <span className="text-[12px] font-medium text-ink-soft">· {count} {source}</span>
        )}
      </div>
    </div>
  )
}
