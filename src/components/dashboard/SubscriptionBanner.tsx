'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AttentionBar } from '@/components/blocks/booking'
import { AlertTriangle, ArrowRight, XCircle } from 'lucide-react'
import { Button } from '@/components/ui-kit'

type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  setup_done?: boolean
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
  // a próbaidő-sáv elrejtése (X) — csak erre a munkamenetre, a következő belépéskor újra szól
  const [hidden, setHidden] = useState(false)
  useEffect(() => { try { setHidden(sessionStorage.getItem('trial-bar-hidden') === '1') } catch { /* privát mód */ } }, [])
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

  // próbaidő, az utolsó 3 nap (design 16.5.1 / 6.8.1): az alsó sáv — csak ha a fizetés még nincs beállítva
  if (subscription.status === 'trialing') {
    if (subscription.setup_done || hidden) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-6">
        <AttentionBar kind="trial" count={days ?? 0} when={days === 0 ? 'ma jár le — add meg a számlázási adatokat és a kártyát' : 'add meg a számlázási adatokat és a kártyát'}
          href={`${basePath}/settings?tab=billing`} className="pointer-events-auto"
          onDismiss={() => { setHidden(true); try { sessionStorage.setItem('trial-bar-hidden', '1') } catch { /* privát mód */ } }} />
      </div>
    )
  }

  const isError = subscription.status === 'past_due' || subscription.status === 'canceled'

  let message = ''
  if (subscription.status === 'past_due') message = 'Fizetési probléma — az előfizetésed megújítása sikertelen volt.'
  else if (subscription.status === 'canceled') message = 'Az előfizetésed megszűnt.'
  else if (subscription.status === 'paused') message = 'Az előfizetésed szünetel.'
  else if (days === 0) message = 'A próbaidőszakod ma lejár!'
  else message = `A próbaidőszakod ${days} nap múlva lejár.`

  return (
    <div className={`mb-4 flex items-center gap-3 rounded-ui-card px-4 py-3 text-ui-body max-lg:mx-4 ${isError ? 'bg-ui-bad-bg text-ui-bad' : 'bg-ui-warn-bg text-ui-warn'}`}>
      {isError ? <XCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 flex-1">{message}</span>
      <Button href={subscriptionHref} variant="glass" size="sm" icon={ArrowRight}>Részletek</Button>
    </div>
  )
}
