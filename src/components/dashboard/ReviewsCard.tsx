import { Star } from 'lucide-react'
import { DashboardCard } from '@/components/ui/dashboard-card'
import type { ReviewSummary } from '@/lib/reviews'

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= Math.round(value) ? 'fill-gold text-gold' : 'text-line'}`}
        />
      ))}
    </div>
  )
}

/** Tulaj-nézet: átlag csillag + legutóbbi vélemények egy dashboard-kártyában. */
export function ReviewsCard({ summary }: { summary: ReviewSummary }) {
  return (
    <DashboardCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-dark">Értékelések</h3>
        {summary.count > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-ink-dark">{summary.average.toFixed(1)}</span>
            <Stars value={summary.average} />
            <span className="text-xs text-ink-soft">({summary.count})</span>
          </div>
        )}
      </div>

      {summary.count === 0 ? (
        <p className="text-sm text-ink-soft">Még nem érkezett értékelés.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {summary.recent.map((r) => (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink-dark truncate">
                  {r.customer_name || 'Vendég'}
                </span>
                <Stars value={r.rating} />
              </div>
              {r.comment && <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}
