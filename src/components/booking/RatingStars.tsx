import { Star } from 'lucide-react'

/**
 * Értékelés csillag-sor: kitöltött / rész-kitöltött / üres csillagok + a szám és (opcionálisan)
 * az értékelők száma. A `rating` 0–5, `count` az értékelők száma — saját, natív értékelés-adat
 * (`getReviewSummary()`), nem Google-ből.
 * A design az Áttekintés hangulata: arany csillag, ink szám, ink-soft másodlagos szöveg —
 * `dark` esetén (pl. sötét/borítóképes publikus hero) fehér szám + fehér/áttetsző üres csillag,
 * hogy sötét háttéren is olvasható maradjon (világos ink-szín ott gyakorlatilag láthatatlan volt).
 */
export function RatingStars({
  rating,
  count,
  source = 'értékelés',
  className = '',
  dark = false,
}: {
  rating: number
  count?: number | null
  source?: string
  className?: string
  dark?: boolean
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
              <Star className={`absolute inset-0 h-[17px] w-[17px] ${dark ? 'text-white/25' : 'text-black/12'}`} strokeWidth={0} fill="currentColor" />
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
        <span className={`text-[15px] font-semibold tracking-[-0.01em] ${dark ? 'text-white' : 'text-ink'}`}>{rating.toFixed(1)}</span>
        {count != null && (
          <span className={`text-[12px] font-medium ${dark ? 'text-white/60' : 'text-ink-soft'}`}>· {count} {source}</span>
        )}
      </div>
    </div>
  )
}
