'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'

/**
 * Előleg-fizetési lépés a publikus foglaló-wizardokban (szalon + étterem — MINDKETTŐ ezt a
 * megosztott komponenst használja, hogy a fizetési UX ne csússzon szét). A `/api/payments/
 * deposit-intent`-et hívja meg mountoláskor a `requestBody`-val, majd a válaszban kapott
 * `clientSecret`/`connectedAccountId`-vel Stripe Elements-et renderel (direct charge a
 * csatlakoztatott Connect-számlán, lásd src/lib/stripeConnect.ts).
 */

type DepositStepProps = {
  requestBody: Record<string, unknown>
  /** A wizard hívja, ha a fizetés sikeresen megtörtént — a payment_intent_id-t a submit()-nak kell átadnia. */
  onPaid: (paymentIntentId: string, depositAmountHuf: number) => void
  dark?: boolean
}

function ConfirmForm({ depositAmountHuf, onPaid, dark }: { depositAmountHuf: number; onPaid: DepositStepProps['onPaid']; paymentIntentId: string } & Pick<DepositStepProps, 'onPaid' | 'dark'>) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    setSubmitting(false)
    if (error) {
      toast.error(error.message ?? 'A fizetés nem sikerült. Kérjük, próbáld újra.')
      return
    }
    if (paymentIntent?.status === 'succeeded') {
      onPaid(paymentIntent.id, depositAmountHuf)
    } else {
      toast.error('A fizetés feldolgozása még folyamatban — kérjük, várj egy pillanatot és próbáld újra.')
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <button
        type="button"
        disabled={submitting || !stripe}
        onClick={handleConfirm}
        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-dav-pill font-semibold text-sm transition-colors disabled:opacity-60 ${
          dark ? 'bg-gold text-ink-dark hover:opacity-90' : 'bg-ink-dark text-white hover:opacity-90'
        }`}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Előleg fizetése — ${formatPrice(depositAmountHuf, 'HUF')}`}
      </button>
    </div>
  )
}

export function DepositStep({ requestBody, onPaid, dark }: DepositStepProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null)
  const [depositAmountHuf, setDepositAmountHuf] = useState<number | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/payments/deposit-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? 'Nem sikerült előkészíteni az előleg-fizetést.')
        if (cancelled) return
        setClientSecret(json.clientSecret)
        setConnectedAccountId(json.connectedAccountId)
        setDepositAmountHuf(json.depositAmountHuf)
        setPaymentIntentId(json.paymentIntentId)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestBody a wizard render-fázisában stabil, JSON-szerű objektum, nincs értelme mély-figyelni
  }, [])

  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    if (!connectedAccountId) return null
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!pk) return null
    return loadStripe(pk, { stripeAccount: connectedAccountId })
  }, [connectedAccountId])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className={`h-5 w-5 animate-spin ${dark ? 'text-white' : 'text-ink'}`} />
      </div>
    )
  }

  if (error || !clientSecret || !stripePromise || !paymentIntentId || !depositAmountHuf) {
    return (
      <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? 'border-white/15 text-white/80' : 'border-line text-ink-soft'}`}>
        {error ?? 'Az előleg-fizetés jelenleg nem elérhető.'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-xs ${dark ? 'text-white/60' : 'text-ink-soft'}`}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>Az időpont biztosításához előleg szükséges — a fizetés biztonságos, a Stripe kezeli.</span>
      </div>
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: dark ? 'night' : 'stripe' } }}>
        <ConfirmForm depositAmountHuf={depositAmountHuf} onPaid={onPaid} dark={dark} paymentIntentId={paymentIntentId} />
      </Elements>
    </div>
  )
}
