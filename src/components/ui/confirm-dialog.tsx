'use client'

import { TriangleAlert, type LucideIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button, IconCircle, Panel, SheetHandle } from '@/components/ui-kit'

/**
 * Megerősítő ablak (a /design 6.10): felül nagy jelző-kör, alatta a kérdés, egy sor arról, mire vonatkozik,
 * opcionálisan adatsorok (`children` — pl. ki kap értesítést, mi lesz az előleggel, régi → új időpont), lent jobbra
 * Mégse és a fő gomb (visszafordíthatatlan lépésnél piros). Mobilon alulról nyíló lap fogantyúval.
 * Kontrollált: az `open` vezérli. createPortal-lal a body-ra kerül, hogy egy transform-os ős ne törje a fixed pozíciót.
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
  zIndexClass = 'z-[60]',
  icon,
  children,
}: {
  open: boolean
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Opcionális harmadik gomb (pl. „Elvetés") — a Mégse és a fő gomb között. */
  tertiaryLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  onTertiary?: () => void
  zIndexClass?: string
  /** a jelző-kör ikonja (alapból figyelmeztető háromszög) */
  icon?: LucideIcon
  /** adatsorok a kérdés alatt (kit FieldRow boxed, régi → új időpont stb.) */
  children?: React.ReactNode
}) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className={`fixed inset-0 ${zIndexClass} flex items-end justify-center sm:items-center sm:p-4`}>
      <div className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div role="alertdialog" aria-modal="true" className="relative w-full sm:max-w-[440px]">
        <Panel pad="lg" className="max-sm:rounded-b-none max-sm:pt-3">
          <SheetHandle className="pb-3 sm:hidden" />
          <IconCircle icon={icon ?? TriangleAlert} tone={destructive ? 'bad' : 'yellow'} size="lg" />
          <h3 className="mt-4 text-ui-sub font-light text-ui-text">{title}</h3>
          {description && <div className="mt-1 text-ui-body text-ui-muted">{description}</div>}
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="cell" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
            {tertiaryLabel && onTertiary && <Button variant="glass" onClick={onTertiary} disabled={busy}>{tertiaryLabel}</Button>}
            <Button variant={destructive ? 'danger' : 'dark'} onClick={onConfirm} disabled={busy}>{busy ? '…' : confirmLabel}</Button>
          </div>
        </Panel>
      </div>
    </div>,
    document.body
  )
}
