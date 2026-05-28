'use client'

import { AlertTriangle } from 'lucide-react'

/**
 * Megerősítő párbeszéd a böngésző natív `confirm()` helyett — a projekt
 * glass/blur stílusában (lásd CancelSubscriptionButton). Kontrollált: az `open`
 * vezérli, a gombok az `onConfirm` / `onCancel`-t hívják.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Törlés',
  cancelLabel = 'Mégse',
  tertiaryLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
  onTertiary,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Opcionális harmadik gomb (pl. „Elvetés") — a confirm és a cancel között. */
  tertiaryLabel?: string
  /** Igaz esetén a megerősítő gomb piros (törlés-jellegű művelet). */
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  onTertiary?: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${destructive ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            <AlertTriangle className={`h-5 w-5 ${destructive ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-1">{title}</h3>
            {description && <p className="text-sm text-zinc-500 dark:text-white/50">{description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/80 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          {tertiaryLabel && onTertiary && (
            <button
              type="button"
              onClick={onTertiary}
              disabled={busy}
              className="flex-1 h-11 rounded-full border border-zinc-200 dark:border-white/[0.12] text-zinc-600 dark:text-white/70 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              {tertiaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-11 rounded-full text-white text-sm font-semibold transition-colors disabled:opacity-50 ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-900 dark:bg-white dark:text-black hover:opacity-90'}`}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
