'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Star, Check, Loader2, AlertCircle } from 'lucide-react'
import { makeT } from '@/lib/i18n'
import { useClientLocale } from '@/lib/i18n/client'

type Phase = 'loading' | 'form' | 'submitting' | 'done' | 'already' | 'invalid' | 'error'

export default function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const locale = useClientLocale()
  const tt = makeT(locale)

  const [phase, setPhase] = useState<Phase>('loading')
  const [name, setName] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/review/${token}`)
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok || data.found === false) return setPhase('invalid')
        if (data.already) return setPhase('already')
        setName(data.customer_name ?? null)
        setPhase('form')
      } catch {
        if (alive) setPhase('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const submit = async () => {
    if (rating < 1) return
    setPhase('submitting')
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 || data.already) return setPhase('already')
      if (!res.ok) return setPhase('form')
      setPhase('done')
    } catch {
      setPhase('form')
    }
  }

  const active = hover || rating

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md w-full">
        {phase === 'loading' && (
          <Loader2 className="h-8 w-8 animate-spin text-zinc-300 dark:text-white/30 mx-auto" />
        )}

        {phase === 'done' && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-[#00bb88]/10 items-center justify-center mb-6">
              <Check className="h-8 w-8 text-[#00bb88]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{tt('public.review.doneTitle')}</h1>
            <p className="text-zinc-500 dark:text-white/50">{tt('public.review.done')}</p>
          </>
        )}

        {phase === 'already' && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-[#00bb88]/10 items-center justify-center mb-6">
              <Check className="h-8 w-8 text-[#00bb88]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{tt('public.review.alreadyTitle')}</h1>
            <p className="text-zinc-500 dark:text-white/50">{tt('public.review.already')}</p>
          </>
        )}

        {(phase === 'invalid' || phase === 'error') && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-red-500/10 items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{tt('public.review.invalidTitle')}</h1>
            <p className="text-zinc-500 dark:text-white/50">{tt('public.review.invalid')}</p>
          </>
        )}

        {(phase === 'form' || phase === 'submitting') && (
          <>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">{tt('public.review.title')}</h1>
            <p className="text-zinc-500 dark:text-white/50 mb-8">
              {name ? tt('public.review.subtitle', { name }) : tt('public.review.subtitleGeneric')}
            </p>

            <div className="flex justify-center gap-2 mb-8" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${
                      n <= active ? 'fill-[#ffc107] text-[#ffc107]' : 'text-zinc-300 dark:text-white/20'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={tt('public.review.commentPlaceholder')}
              className="w-full rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 outline-none focus:border-zinc-400 dark:focus:border-white/30 resize-none mb-6"
            />

            <button
              onClick={submit}
              disabled={rating < 1 || phase === 'submitting'}
              className="inline-flex h-12 px-8 rounded-full bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 font-semibold text-sm transition disabled:opacity-40 items-center gap-2"
            >
              {phase === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tt('public.review.submitting')}
                </>
              ) : rating < 1 ? (
                tt('public.review.pickRating')
              ) : (
                tt('public.review.submit')
              )}
            </button>
          </>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-white/70 transition-colors">
            {tt('public.back')}
          </Link>
        </div>
      </div>
    </main>
  )
}
