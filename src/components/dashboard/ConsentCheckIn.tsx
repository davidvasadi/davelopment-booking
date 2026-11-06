'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ConsentDone, ConsentKiosk } from '@/components/blocks/importer'

/**
 * Helyszíni nyilatkozat (design 23.6) — a személyzet a saját belépésével nyitja meg a foglalásból (tableten), a vendég
 * ott olvassa el és fogadja el; utána a köszönő képernyő, és vissza a foglaláshoz. Közös a szalonnak és az étteremnek,
 * csak a submit-URL / az id-mező / a vissza-link különbözik.
 */
export function ConsentCheckIn({ id, customerName, alreadyAccepted, title, templateText, submitUrl, idField, backHref, business, when, what }: {
  id: string | number
  customerName: string
  alreadyAccepted: boolean
  title?: string | null
  templateText: string
  submitUrl: string
  idField: 'bookingId' | 'reservationId'
  backHref: string
  /** a fejléchez: az üzlet neve, az időpont („Csütörtök, Nov. 6. · 10:30”), mire jött („Festés · Viktória” / „4 fő”) */
  business: string
  when: string
  what: string
}) {
  const [given, setGiven] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [doneAt, setDoneAt] = useState<string | null>(alreadyAccepted ? '' : null)

  const submit = async () => {
    if (!given || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [idField]: id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'Hiba történt')
      setDoneAt(new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ui-page p-6">
      {doneAt !== null
        ? <ConsentDone guest={customerName} at={doneAt || undefined} backHref={backHref} />
        : <ConsentKiosk className="w-full max-w-[640px]" business={business} guest={customerName} when={when} what={what} title={title?.trim() || 'Beleegyező nyilatkozat'}
            text={templateText} accepted={given} onAccepted={setGiven} onSubmit={() => void submit()} busy={submitting} cancelHref={backHref} />}
    </div>
  )
}
