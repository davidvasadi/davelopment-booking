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

  return (
    <div className="flex gap-1.5">
      <select
        value={plan}
        disabled={isPending}
        onChange={e => update(status, e.target.value)}
        className="text-xs bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50 cursor-pointer"
      >
        {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select
        value={status}
        disabled={isPending}
        onChange={e => update(e.target.value, plan)}
        className="text-xs bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50 cursor-pointer"
      >
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
