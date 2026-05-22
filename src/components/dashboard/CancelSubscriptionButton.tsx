'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Undo2, AlertTriangle } from 'lucide-react'

type Props = {
  cancelScheduled: boolean
  periodEndLabel: string
}

export function CancelSubscriptionButton({ cancelScheduled, periodEndLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  async function submit(undo: boolean) {
    await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ undo }),
    })
    startTransition(() => {
      setOpen(false)
      router.refresh()
    })
  }

  if (cancelScheduled) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => submit(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-zinc-100 dark:bg-white/[0.08] text-zinc-700 dark:text-white/80 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Lemondás visszavonása
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-white/60 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Előfizetés lemondása
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Biztosan lemondod az előfizetést?</h3>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  <span className="text-zinc-900 dark:text-white font-semibold">{periodEndLabel}</span>-ig hozzáférsz minden Pro funkcióhoz.
                  Utána a dashboard letiltásra kerül, de a nyilvános foglalási oldalad érintetlen marad.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/80 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={pending}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {pending ? 'Lemondás...' : 'Igen, lemondom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
