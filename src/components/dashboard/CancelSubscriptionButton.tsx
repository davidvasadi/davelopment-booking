'use client'
import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X, Undo2, AlertTriangle, Loader2 } from 'lucide-react'

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
        className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-line-strong px-5 py-2.5 text-[13px] font-semibold text-ink-soft transition-opacity hover:opacity-70 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
        Lemondás visszavonása
      </button>
    )
  }

  const modal = open
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-sub-title"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          {/* Backdrop — teljes képernyős blur, body-n renderelve */}
          <div
            className="absolute inset-0 bg-ink-dark/40 backdrop-blur-md"
            onClick={() => !pending && setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-[26px] bg-white p-6 shadow-[0_32px_64px_-20px_rgba(40,35,15,0.45)]">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#FEF3E9]">
                <AlertTriangle className="h-5 w-5 text-[#D97706]" strokeWidth={1.8} />
              </div>
              <div className="flex-1">
                <h3 id="cancel-sub-title" className="text-[17px] font-semibold text-ink">
                  Biztosan lemondod az előfizetést?
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{periodEndLabel}</span>-ig hozzáférsz minden
                  Pro funkcióhoz. Utána a dashboard letiltásra kerül, de a nyilvános foglalási oldalad
                  érintetlen marad.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 rounded-[14px] bg-[#F4F2EC] py-3 text-[14px] font-semibold text-ink transition-opacity hover:opacity-70 disabled:opacity-50"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={pending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#C0392B] py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? 'Lemondás…' : 'Igen, lemondom'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-line-strong px-5 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-[rgba(192,57,43,.4)] hover:text-[#C0392B]"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
        Előfizetés lemondása
      </button>
      {modal}
    </>
  )
}
