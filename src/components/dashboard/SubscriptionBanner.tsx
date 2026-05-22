'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, XCircle } from 'lucide-react'

type SubInfo = {
  plan: 'trial' | 'pro' | 'restaurant_pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export function SubscriptionBanner({
  subscription,
  basePath = '/dashboard',
}: {
  subscription: SubInfo
  /** A dashboard alap-útvonala (szalon: '/dashboard', étterem: '/restaurant'). */
  basePath?: string
}) {
  const pathname = usePathname()
  if (!subscription) return null

  const subscriptionHref = `${basePath}/subscription`

  // Beállítások és subscription oldalon ne mutassuk (ott a kártya / oldal úgyis mutatja)
  if (pathname?.startsWith(`${basePath}/settings`) || pathname?.startsWith(subscriptionHref)) {
    return null
  }

  const days = subscription.status === 'trialing' ? daysLeft(subscription.trial_ends_at) : null
  const showBanner =
    subscription.status === 'past_due' ||
    subscription.status === 'canceled' ||
    subscription.status === 'paused' ||
    (subscription.status === 'trialing' && days !== null && days <= 3)

  if (!showBanner) return null

  const isError = subscription.status === 'past_due' || subscription.status === 'canceled'

  let message = ''
  if (subscription.status === 'past_due') message = 'Fizetési probléma — az előfizetésed megújítása sikertelen volt.'
  else if (subscription.status === 'canceled') message = 'Az előfizetésed megszűnt.'
  else if (subscription.status === 'paused') message = 'Az előfizetésed szünetel.'
  else if (days === 0) message = 'A próbaidőszakod ma lejár!'
  else message = `A próbaidőszakod ${days} nap múlva lejár.`

  return (
    <div className={`flex items-center gap-3 px-5 py-3 text-sm ${isError ? 'bg-red-50 border-b border-red-100 dark:bg-red-950/40 dark:border-red-900/40' : 'bg-amber-50 border-b border-amber-100 dark:bg-amber-950/40 dark:border-amber-900/40'}`}>
      {isError
        ? <XCircle className={`h-4 w-4 shrink-0 ${isError ? 'text-red-500' : 'text-amber-500'}`} />
        : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
      }
      <span className={isError ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>
        {message}
      </span>
      <Link
        href={subscriptionHref}
        className={`ml-auto shrink-0 font-semibold hover:opacity-70 transition-opacity ${isError ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}
      >
        Részletek →
      </Link>
    </div>
  )
}
