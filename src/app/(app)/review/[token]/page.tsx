'use client'

import { useEffect, useState, use } from 'react'
import { Loader2 } from 'lucide-react'
import { makeT } from '@/lib/i18n'
import { useClientLocale } from '@/lib/i18n/client'
import { GuestResult, GuestShell, ReviewForm, type GuestBiz } from '@/components/blocks/guest-pages'

type Phase = 'loading' | 'form' | 'submitting' | 'done' | 'redirecting' | 'already' | 'invalid' | 'error'

/**
 * Értékelés a látogatás után (a visszajelzés-kérő levél linkje) — design 21.12: 5 csillag és szöveg. 4–5 csillagnál a
 * vendég utána a választott helyre (Google / TripAdvisor / Facebook) megy, a többi csak nálunk marad.
 */
export default function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const locale = useClientLocale()
  const tt = makeT(locale)
  const [phase, setPhase] = useState<Phase>('loading')
  const [name, setName] = useState<string | null>(null)
  const [biz, setBiz] = useState<GuestBiz | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [targetUrl, setTargetUrl] = useState<string | null>(null)
  const [place, setPlace] = useState('Google')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch(`/api/review/${token}`)
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (data.business) setBiz(data.business)
        if (!res.ok || data.found === false) return setPhase('invalid')
        if (data.already) return setPhase('already')
        setName(data.customer_name ?? null)
        setTargetUrl(data.review_url ?? data.google_review_url ?? null)
        setPlace(data.review_place ?? 'Google')
        setPhase('form')
      } catch { if (alive) setPhase('error') }
    })()
    return () => { alive = false }
  }, [token])

  const submit = async () => {
    if (rating < 1) return
    setPhase('submitting'); setFailed(false)
    try {
      const res = await fetch(`/api/review/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, comment }) })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 || data.already) return setPhase('already')
      if (!res.ok) { setFailed(true); return setPhase('form') }
      if (rating >= 4 && targetUrl) {
        setPhase('redirecting')
        setTimeout(() => { window.location.href = targetUrl }, 1200)
      } else setPhase('done')
    } catch { setFailed(true); setPhase('form') }
  }

  return (
    <GuestShell biz={biz}>
      {phase === 'loading' && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ui-muted" /></div>}
      {phase === 'done' && <GuestResult tone="ok" title={tt('public.review.doneTitle')} text={tt('public.review.done')} />}
      {phase === 'redirecting' && <GuestResult tone="ok" title={tt('public.review.doneTitle')} text={tt('public.review.redirecting', { place })} />}
      {phase === 'already' && <GuestResult tone="ok" title={tt('public.review.alreadyTitle')} text={tt('public.review.already')} />}
      {(phase === 'invalid' || phase === 'error') && <GuestResult tone="bad" title={tt('public.review.invalidTitle')} text={tt('public.review.invalid')} />}
      {(phase === 'form' || phase === 'submitting') && (
        <>
          <ReviewForm rating={rating} onRating={setRating} comment={comment} onComment={setComment} onSubmit={() => void submit()} busy={phase === 'submitting'}
            l={{ title: tt('public.review.title'), subtitle: name ? tt('public.review.subtitle', { name }) : tt('public.review.subtitleGeneric'), placeholder: tt('public.review.commentPlaceholder'), submit: tt('public.review.submit'), pick: tt('public.review.pickRating') }} />
          {failed && <div role="alert" className="mt-3 text-center text-ui-label text-ui-bad">{tt('public.review.failed')}</div>}
        </>
      )}
    </GuestShell>
  )
}
