'use client'

import { useState, useTransition } from 'react'
import { PLAN_LABELS } from '@/lib/backstagePlaces'

const STATUS_OPTIONS = [
  { value: 'trialing', label: 'Próbaidőszak' },
  { value: 'active', label: 'Aktív' },
  { value: 'past_due', label: 'Lejárt fizetés' },
  { value: 'paused', label: 'Szüneteltetett' },
  { value: 'canceled', label: 'Megszakítva' },
]
// Fiók-szintű modell: a jelleg trial vagy paid. Az ár NEM itt dől el — az a fiók üzlet-
// összetételéből számolódik (syncAccountSubscription), a kliens nem küld amount_huf-ot.
const PLAN_OPTIONS = (['trial', 'paid'] as const).map(value => ({
  value,
  label: PLAN_LABELS[value],
}))

interface Props {
  subId: string
  currentStatus: string
  currentPlan: string
}

export default function SubscriptionStatusSelect({ subId, currentStatus, currentPlan }: Props) {
  const [status, setStatus] = useState(currentStatus)
  const [plan, setPlan] = useState(currentPlan)
  const [isPending, startTransition] = useTransition()

  function update(newStatus: string, newPlan: string) {
    setStatus(newStatus)
    setPlan(newPlan)
    startTransition(async () => {
      await fetch(`/api/backstage/subscriptions/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, plan: newPlan }),
      })
    })
  }

  const selectClass = 'min-w-0 flex-1 text-[12px] font-medium bg-white border border-line text-ink rounded-[14px] px-2 py-1.5 focus:outline-none disabled:opacity-50 cursor-pointer'

  return (
    <div className="flex min-w-0 gap-1.5">
      <select
        value={plan}
        disabled={isPending}
        onChange={e => update(status, e.target.value)}
        className={selectClass}
      >
        {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select
        value={status}
        disabled={isPending}
        onChange={e => update(e.target.value, plan)}
        className={selectClass}
      >
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
