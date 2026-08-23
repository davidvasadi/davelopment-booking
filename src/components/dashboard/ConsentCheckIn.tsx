'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/toggle-switch'

/**
 * Helyszíni check-in felület a digitális beleegyező nyilatkozathoz — a személyzet a saját
 * bejelentkezésével nyitja meg (tableten), a vendég ott olvassa el és fogadja el. Közös
 * shell a szalon és étterem oldalnak, csak a submit-URL/id-mező/vissza-link különbözik.
 */
export function ConsentCheckIn({
  id,
  customerName,
  alreadyAccepted,
  title,
  templateText,
  submitUrl,
  idField,
  backHref,
}: {
  id: string | number
  customerName: string
  alreadyAccepted: boolean
  title?: string | null
  templateText: string
  submitUrl: string
  idField: 'bookingId' | 'reservationId'
  backHref: string
}) {
  const [given, setGiven] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(alreadyAccepted)

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
      setDone(true)
      toast.success('Nyilatkozat elfogadva')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#DCF3E2]">
          <CheckCircle className="h-10 w-10 text-[#1D7A3C]" />
        </div>
        <h1 className="mb-2 text-2xl font-light tracking-[-0.01em] text-ink">Elfogadva</h1>
        <p className="mb-8 text-sm text-ink-soft">A nyilatkozat elfogadása rögzítve.</p>
        <Link
          href={backHref}
          className="flex h-12 items-center justify-center rounded-full bg-ink-dark px-6 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Vissza a foglaláshoz
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-[26px] font-light tracking-[-0.01em] text-ink">{title?.trim() || 'Beleegyező nyilatkozat'}</h1>
          <p className="mt-1 text-sm text-ink-soft">{customerName}</p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-[20px] border border-line-strong bg-white p-5 text-[15px] leading-relaxed text-ink">
          {templateText || 'A szolgáltató még nem adta meg a nyilatkozat szövegét.'}
        </div>
        <div className="flex items-center justify-between gap-4 rounded-[16px] border border-line-strong bg-white px-5 py-4">
          <span className="text-[15px] font-medium text-ink">Elolvastam és elfogadom a fenti nyilatkozatot</span>
          <Switch checked={given} onChange={setGiven} ariaLabel="Nyilatkozat elfogadása" />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!given || submitting}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-ink-dark text-[16px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          Elfogadom és aláírom
        </button>
        <Link href={backHref} className="block text-center text-[13px] font-medium text-ink-soft hover:text-ink">
          Mégse
        </Link>
      </div>
    </div>
  )
}
