'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Mail, Phone, CheckCircle2, Circle } from 'lucide-react'
import type { ContactMessage } from '@/payload/payload-types'

export default function ContactMessageCard({ message }: { message: ContactMessage }) {
  const router = useRouter()
  const [status, setStatus] = useState(message.status ?? 'new')
  const [busy, setBusy] = useState(false)
  const isAnswered = status === 'answered'

  async function toggle() {
    const next = isAnswered ? 'new' : 'answered'
    const prev = status
    setStatus(next)
    setBusy(true)
    try {
      const res = await fetch(`/api/backstage/contact/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next === 'answered' ? 'Megjelölve megválaszoltnak' : 'Megjelölve újnak')
      router.refresh()
    } catch {
      setStatus(prev)
      toast.error('A módosítás nem sikerült.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-[22px] p-5 dav-card-glass ${!isAnswered ? 'ring-1 ring-inset ring-gold/40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{message.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-ink-soft">
            <a href={`mailto:${message.email}`} className="flex items-center gap-1 hover:text-ink">
              <Mail className="h-3 w-3" />{message.email}
            </a>
            {message.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />{message.phone}
              </span>
            )}
            <span className="text-ink-soft2">
              {new Date(message.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
            isAnswered ? 'bg-ok-bg text-ok' : 'bg-paper text-ink-soft hover:bg-line-strong'
          }`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAnswered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {isAnswered ? 'Megválaszolva' : 'Új'}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{message.message}</p>
    </div>
  )
}
