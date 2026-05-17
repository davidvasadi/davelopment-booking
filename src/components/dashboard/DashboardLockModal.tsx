'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, Settings, ArrowRight } from 'lucide-react'

const SETTINGS_PATH = '/bookly/dashboard/settings'
const SUBSCRIPTION_PATH = '/bookly/dashboard/subscription'

export function DashboardLockModal({ status }: { status: 'past_due' | 'canceled' | 'paused' }) {
  const pathname = usePathname()

  // Settings és subscription oldalon ne mutassuk a modalt
  if (pathname?.startsWith(SETTINGS_PATH) || pathname?.startsWith(SUBSCRIPTION_PATH)) {
    return null
  }

  const title = status === 'past_due'
    ? 'Lejárt a próbaidőszakod'
    : status === 'canceled'
    ? 'Az előfizetésed megszűnt'
    : 'Az előfizetésed szünetel'

  const description = status === 'past_due'
    ? 'A próbaidőszakod véget ért. A dashboard funkciók addig le vannak tiltva, amíg nem aktiválod a Pro csomagot.'
    : status === 'canceled'
    ? 'Az előfizetésed megszűnt. A fiókodat csak a beállítások oldalon tudod kezelni vagy törölni.'
    : 'Az előfizetésed jelenleg szünetel. A funkciók eléréséhez folytasd az előfizetést.'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-2xl">
      <div className="w-full max-w-md bg-white/95 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/[0.08] shadow-2xl p-7 lg:p-9 text-center">
        <div className="h-16 w-16 rounded-2xl bg-red-500/15 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-5">
          <Lock className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>

        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">
          {title}
        </h2>

        <p className="text-sm text-zinc-600 dark:text-white/60 mb-7 leading-relaxed">
          {description}
        </p>

        <Link
          href={SETTINGS_PATH}
          className="flex items-center justify-center gap-2 h-12 w-full rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Settings className="h-4 w-4" />
          Tovább a beállításokhoz
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="text-xs text-zinc-400 dark:text-white/30 mt-4">
          Ott tudod kezelni az előfizetésed vagy törölni a fiókodat
        </p>
      </div>
    </div>
  )
}
