'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { HoverArrow } from '@/components/ui/HoverArrow'

/**
 * Teljes szélességű foglalás-CTA — text-roll felirat + görgő HoverArrow.
 * Ugyanaz a stílus, mint a wizard "Foglalás megerősítése" gombja.
 * Link-ként (href) vagy gombként (onClick) is használható.
 */
type Props = {
  label?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  /** 'dark' = sötét gomb világos felületre (alap); 'light' = fehér gomb sötét felületre/kártyára. */
  variant?: 'dark' | 'light'
  /** Betöltés alatt spinner + felirat (a text-roll/nyíl helyett). */
  loading?: boolean
  loadingLabel?: string
}

export function BookCtaButton({ label = 'Időpontfoglalás', href, onClick, disabled, className = '', variant = 'dark', loading = false, loadingLabel = 'Küldés...' }: Props) {
  const inner = loading ? (
    <><Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}</>
  ) : (
    <>
      <span className="overflow-hidden inline-block" style={{ height: '1.25rem' }}>
        <span
          className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-[1.25rem]"
          style={{ lineHeight: '1.25rem' }}
        >
          <span className="block">{label}</span>
          <span className="block" aria-hidden>{label}</span>
        </span>
      </span>
      <HoverArrow className="h-4 w-4" />
    </>
  )

  const palette =
    variant === 'light'
      ? 'bg-white text-zinc-950 hover:bg-zinc-100'
      : 'bg-zinc-950 text-white hover:bg-zinc-800'
  const cls =
    `group w-full h-14 rounded-2xl font-black text-sm transition-all shadow-lg disabled:opacity-40 ` +
    `flex items-center justify-center gap-2 ${palette} ${className}`

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={label}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} aria-label={label}>
      {inner}
    </button>
  )
}
