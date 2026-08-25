import { AlertTriangle } from 'lucide-react'
import SubscriptionStatusSelect from '../subscriptions/SubscriptionStatusSelect'

export type OrphanSub = {
  id: string
  plan: string
  status: string
  breakdown: string | null
  createdAt: string
}

/** Owner nélküli előfizetés-sorok — nincs kihez tartozó fiók-oldal, ezért itt, külön
 *  jelenik meg (lásd `accounts/page.tsx` indoklása). Ritka, tipikusan törölt/hibás állapot. */
export default function OrphanSubscriptions({ subs }: { subs: OrphanSub[] }) {
  return (
    <div className="rounded-[26px] border border-warn/30 bg-warn-bg/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warn" />
        <p className="text-[13px] font-semibold text-ink">Owner nélküli előfizetések ({subs.length})</p>
      </div>
      <div className="space-y-2">
        {subs.map(s => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-ink">{s.breakdown || `Előfizetés #${s.id}`}</p>
              <p className="text-[11px] text-ink-soft2">
                {new Date(s.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <SubscriptionStatusSelect subId={s.id} ownerId={null} currentStatus={s.status} currentPlan={s.plan} />
          </div>
        ))}
      </div>
    </div>
  )
}
