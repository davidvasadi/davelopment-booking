'use client'

import { useEffect, useState } from 'react'
import { Check, CheckCheck, MailOpen, AlertTriangle, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | null
type EmailStatusResponse = { ok: boolean | null; status: EmailStatus; deliveredAt: string | null; openedAt: string | null }

const MAP: Record<string, { icon: typeof Check; label: string; cls: string }> = {
  sent: { icon: Check, label: 'Elküldve', cls: 'text-ink-soft2' },
  delivered: { icon: CheckCheck, label: 'Kézbesítve', cls: 'text-ink-soft2' },
  opened: { icon: MailOpen, label: 'Megnyitva', cls: 'text-emerald-600' },
  clicked: { icon: MailOpen, label: 'Megnyitva', cls: 'text-emerald-600' },
  bounced: { icon: AlertTriangle, label: 'Visszapattant', cls: 'text-red-600' },
  complained: { icon: AlertTriangle, label: 'Spam-panasz', cls: 'text-red-600' },
  failed: { icon: AlertTriangle, label: 'Küldés sikertelen', cls: 'text-red-600' },
}
const RETRYABLE = new Set<EmailStatus>(['bounced', 'complained', 'failed'])

/**
 * A visszaigazoló/módosítás/lemondás email kézbesítési állapota (elküldve → kézbesítve →
 * megnyitva), a Resend webhook (src/app/api/webhooks/resend) által utólag frissített
 * `email-log` rekordból. `endpoint`-ot csak MEGLÉVŐ (mentett) foglalásnál adjunk át.
 * Sikertelen/visszapattant/panaszolt küldésnél — ha `resendEndpoint` is meg van adva — egy
 * "Küldés újra" gomb is megjelenik.
 */
export function EmailStatusBadge({
  endpoint, resendEndpoint, resendBody,
}: {
  endpoint: string | null
  resendEndpoint?: string
  resendBody?: Record<string, unknown>
}) {
  const [state, setState] = useState<EmailStatusResponse | null>(null)
  const [sending, setSending] = useState(false)

  const load = () => {
    if (!endpoint) return
    fetch(endpoint, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() as Promise<EmailStatusResponse> : null))
      .then(setState)
      .catch(() => {})
  }

  useEffect(() => {
    setState(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  if (!state || state.ok === null) return null

  const status = state.ok === false ? 'failed' : (state.status ?? 'sent')
  const entry = MAP[status] ?? MAP.sent
  const Icon = entry.icon
  const canRetry = !!resendEndpoint && (state.ok === false || RETRYABLE.has(state.status))

  const handleResend = async () => {
    if (!resendEndpoint || sending) return
    setSending(true)
    try {
      const res = await fetch(resendEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(resendBody ?? {}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Sikertelen küldés')
      toast.success('Email újraküldve')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setSending(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${entry.cls}`}>
        <Icon className="h-3 w-3" /> {entry.label}
      </span>
      {canRetry && (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          <RotateCw className={`h-2.5 w-2.5 ${sending ? 'animate-spin' : ''}`} /> Küldés újra
        </button>
      )}
    </span>
  )
}
