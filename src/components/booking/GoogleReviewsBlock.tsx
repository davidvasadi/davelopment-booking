import type { GoogleReview } from '@/lib/googleReviews'
import { ExternalLink } from 'lucide-react'

export type GoogleReviewsData = { rating: number | null; count: number | null; mapsUrl: string | null; reviews: GoogleReview[] }

/**
 * Google-értékelések blokk a publikus foglalón (szalon + étterem). A Places API feltétele a
 * szerző és a forrás (Google) feltüntetése — ezért a név a szerző Google-profiljára mutat, és
 * alul „Google" megjelölés áll. Az adat a tárolt, kérésre frissülő másolat (lib/googleReviews.ts)
 * — NEM élő Google-hívás minden megjelenítéskor, max naponta egyszer frissül.
 *
 * Minden egyes vélemény szövege alá egy "Megnézem a Google-on" link kerül (`r.authorUrl`-ra,
 * ugyanarra, amire a szerző neve is mutat) — explicit, látható CTA vissza a forráshoz, nem csak
 * a kevésbé nyilvánvaló, névre kattintós link.
 */
export function GoogleReviewsBlock({ google, locale, title, countLabel, allLabel, openLabel, className = '' }: {
  google: GoogleReviewsData
  locale: string
  title: string
  countLabel: string
  allLabel: string
  /** Egy-egy vélemény alatti "Megnézem a Google-on" gomb felirata. */
  openLabel: string
  className?: string
}) {
  if (google.rating == null) return null
  const shown = google.reviews.filter((r) => r.text).slice(0, 5)
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{title}</p>
        <span className="text-[12px] font-medium text-white/60">
          ★ {google.rating.toLocaleString(locale, { maximumFractionDigits: 1 })} · {google.count ?? 0} {countLabel}
        </span>
      </div>
      <div className="space-y-2.5">
        {shown.map((r, i) => (
          <div key={i} className="rounded-2xl p-3.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center gap-2.5">
              {r.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white">{r.author.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                {r.authorUrl
                  ? <a href={r.authorUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] font-semibold text-white hover:underline">{r.author}</a>
                  : <p className="truncate text-[13px] font-semibold text-white">{r.author}</p>}
                <p className="text-[11px] text-white/45"><span className="text-ui-yellow">{'★'.repeat(Math.round(r.rating))}</span> · {r.relativeTime}</p>
              </div>
            </div>
            <p className="mt-2 line-clamp-4 text-[12.5px] leading-relaxed text-white/75">{r.text}</p>
            {r.authorUrl && (
              <a
                href={r.authorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white"
              >
                {openLabel} <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </a>
            )}
          </div>
        ))}
      </div>
      {google.mapsUrl && (
        <a href={google.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[12px] font-semibold text-white/70 underline underline-offset-2 hover:text-white">
          {allLabel} →
        </a>
      )}
      <p className="mt-1.5 text-[10.5px] text-white/35">Google</p>
    </div>
  )
}
