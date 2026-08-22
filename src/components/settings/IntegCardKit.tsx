'use client'

import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Megosztott apró építőelemek az „API & Integrációk" ÉS a „Google" beállítás-fülnek —
 *  mindkettő ugyanazt a kártya-nyelvet használja (lenyitható `IntegCard`, URL-sor, lépés-lista). */

export type CardStatus = 'active' | 'setup' | 'soon'

export function CopyBtn({ value, label = 'Másolás' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Másolva' : label}
    </button>
  )
}

export function UrlRow({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-line bg-[#FBF9F2] px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-soft">{url}</span>
      <CopyBtn value={url} />
    </div>
  )
}

export function SnippetBox({ code }: { code: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[12px] border border-line bg-[#FBF9F2] px-3 py-2.5">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] text-ink-soft">{code}</pre>
      <CopyBtn value={code} />
    </div>
  )
}

export function Steps({ steps }: { steps: (string | ReactNode)[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-[13px] text-ink-soft leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[10px] font-bold text-white">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function IntegCard({
  icon: Icon,
  title,
  description,
  status,
  children,
  defaultOpen = false,
}: {
  icon: typeof Copy
  title: string
  description: string
  status: CardStatus
  children?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const statusCfg: Record<CardStatus, { label: string; cls: string }> = {
    active:  { label: 'Aktív',       cls: 'bg-[#E3F0D8] text-[#4A7A2A]' },
    setup:   { label: 'Beállítható', cls: 'bg-[#FDF3CF] text-[#8A6D12]' },
    soon:    { label: 'Hamarosan',   cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' },
  }
  const { label, cls } = statusCfg[status]

  return (
    <div className="rounded-[20px] dav-card-glass overflow-hidden">
      <button
        type="button"
        onClick={() => status !== 'soon' && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
          status !== 'soon' ? 'hover:bg-black/[0.02] cursor-pointer' : 'cursor-default',
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FBF9F2]">
          <Icon className="h-5 w-5 text-ink-soft2" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-ink">{title}</span>
            <span className={`rounded-[8px] px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>
        </div>
        {status !== 'soon' && (
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-soft2 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && children && (
        <div className="border-t border-line px-5 pb-5 pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}
