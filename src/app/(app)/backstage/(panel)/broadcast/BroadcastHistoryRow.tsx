'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'

const TARGET_LABELS: Record<string, string> = { all: 'Mindenki', paying: 'Csak fizetők', trial: 'Csak próbaidősök', custom: 'Egyedi kiválasztás' }

export default function BroadcastHistoryRow({
  id, title, body, target, createdAt, senderLabel, delivered, opened,
}: {
  id: string
  title: string
  body: string
  target: string
  createdAt: string
  senderLabel: string | null
  delivered: number
  opened: number
}) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removed, setRemoved] = useState(false)

  async function del() {
    if (!armed) { setArmed(true); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/backstage/broadcast/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Körüzenet visszavonva.')
      setRemoved(true)
      router.refresh()
    } catch {
      toast.error('A törlés nem sikerült.')
      setBusy(false)
      setArmed(false)
    }
  }

  if (removed) return null

  const pct = delivered > 0 ? Math.round((opened / delivered) * 100) : 0

  return (
    <div className="group px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-semibold text-ink">{title}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-paper px-2.5 py-1 text-[10.5px] font-semibold text-ink-soft">
            {TARGET_LABELS[target] ?? target}
          </span>
          <button
            type="button"
            onClick={del}
            disabled={busy}
            onBlur={() => setTimeout(() => setArmed(false), 2000)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-bad transition-colors disabled:opacity-50 ${
              armed ? 'bg-bad-bg' : 'opacity-0 hover:bg-bad-bg group-hover:opacity-100'
            }`}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            {armed ? 'Biztos?' : 'Törlés'}
          </button>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-soft">{body}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11.5px] text-ink-soft2">
        <span>{createdAt}</span>
        {senderLabel && <span>Küldte: {senderLabel}</span>}
        <span className="font-semibold text-ink-soft">{delivered} helynek kiküldve</span>
        <span className={`font-semibold ${pct >= 50 ? 'text-ok' : 'text-ink-soft'}`}>{opened}/{delivered} elolvasva ({pct}%)</span>
      </div>
    </div>
  )
}
