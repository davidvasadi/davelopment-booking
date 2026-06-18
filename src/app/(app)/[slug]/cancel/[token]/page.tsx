'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { X, Check, Loader2 } from 'lucide-react'
import { makeT } from '@/lib/i18n'
import { useClientLocale } from '@/lib/i18n/client'

export default function RestaurantCancelPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>
}) {
  const { slug, token } = use(params)
  const locale = useClientLocale()
  const tt = makeT(locale)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const cancel = async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/restaurant/reservations/cancel/${token}`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {state === 'done' ? (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-[#00bb88]/10 items-center justify-center mb-6">
              <Check className="h-8 w-8 text-[#00bb88]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{tt('public.cancel.doneTitle')}</h1>
            <p className="text-zinc-500 dark:text-white/50 mb-8">{tt('public.cancel.done')}</p>
          </>
        ) : (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-red-500/10 items-center justify-center mb-6">
              <X className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{tt('public.cancel.title')}</h1>
            <p className="text-zinc-500 dark:text-white/50 mb-8">
              {state === 'error' ? tt('public.cancel.failed') : tt('public.cancel.confirm')}
            </p>
            {state !== 'error' && (
              <button
                onClick={cancel}
                disabled={state === 'loading'}
                className="inline-flex h-12 px-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-40 items-center gap-2 mb-4"
              >
                {state === 'loading' ? <><Loader2 className="h-4 w-4 animate-spin" />{tt('public.cancel.cancelling')}</> : tt('public.cancel.yes')}
              </button>
            )}
          </>
        )}
        <div>
          <Link href={`/${slug}`} className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-white/70 transition-colors">
            {tt('public.cancel.backToPlace')}
          </Link>
        </div>
      </div>
    </main>
  )
}
