'use client'

import { useState, useTransition } from 'react'

const STATUS_OPTIONS = [
  { value: 'trialing', label: 'Próbaidőszak' },
  { value: 'active', label: 'Aktív' },
  { value: 'past_due', label: 'Lejárt fizetés' },
  { value: 'paused', label: 'Szüneteltetett' },
  { value: 'canceled', label: 'Megszakítva' },
]
const PLAN_OPTIONS = [
  { value: 'free', label: 'Ingyenes' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
]
const PLAN_AMOUNTS: Record<string, number> = { free: 0, starter: 9900, pro: 19900 }

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
      await fetch(`/api/bookly/backstage/subscriptions/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          plan: newPlan,
          amount_huf: PLAN_AMOUNTS[newPlan] ?? 0,
        }),
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
