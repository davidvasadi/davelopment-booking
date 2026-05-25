'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

const ITEM_H = 36 // px – egy wheel-elem magassága

function parse(value: string): { h: string; m: string } {
  const [h = '00', m = '00'] = (value ?? '').slice(0, 5).split(':')
  const mi = MINUTES.includes(m) ? m : MINUTES[Math.round(parseInt(m || '0', 10) / 15) % 4] ?? '00'
  return { h: HOURS.includes(h) ? h : '00', m: mi }
}

function Wheel({
  items,
  value,
  onChange,
}: {
  items: string[]
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Nyitáskor egyszer a kezdőértékre pozícionálunk; utána szabad a görgetés.
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = Math.max(0, items.indexOf(value)) * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScroll = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      if (items[i] !== value) onChange(items[i])
    }, 120)
  }, [items, value, onChange])

  return (
    <div className="relative h-[180px] flex-1">
      {/* középső kiemelő sáv */}
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-9 -translate-y-1/2 rounded-lg bg-zinc-100 dark:bg-white/[0.08]" />
      <div
        ref={ref}
        onScroll={handleScroll}
        data-lenis-prevent
        className="no-scrollbar relative z-10 h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {/* 2-2 üres sor fent/lent, hogy az első és utolsó elem is középre snapeljen */}
        <div style={{ height: ITEM_H * 2 }} aria-hidden />
        {items.map((it) => (
          <button
            key={it}
            type="button"
            onClick={() => onChange(it)}
            style={{ height: ITEM_H }}
            className={cn(
              'flex w-full snap-center items-center justify-center text-base tabular-nums transition-colors',
              it === value
                ? 'font-bold text-zinc-900 dark:text-white'
                : 'text-zinc-300 dark:text-white/25'
            )}
          >
            {it}
          </button>
        ))}
        <div style={{ height: ITEM_H * 2 }} aria-hidden />
      </div>
    </div>
  )
}

export function TimeSelect({
  value,
  onChange,
  className,
  disabled,
  container,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  /** Hova portálozzon a legördülő. Alapból a body; Sheet/Dialog belsejében add át
   *  a panel saját konténerét, hogy a scroll-lock ne nyelje el a görgetést. */
  container?: HTMLElement | null
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { h, m } = parse(value)
  const display = `${h}:${m}`

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left })
    // Ha nincs explicit konténer, és Radix Dialog/Sheet-en belül vagyunk, a panelt
    // a dialog tartalmába portáljuk (nem a body-ra). Különben a react-remove-scroll
    // scroll-lockja a body-portált a lockolt elemen kívülinek látja és preventDefault-tal
    // elnyeli a wheel/touch eseményeket, így nem lehetne görgetni a görgőt.
    const dialog = triggerRef.current.closest<HTMLElement>('[role="dialog"]')
    setTarget(container ?? dialog ?? document.body)
  }, [open, container])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm tabular-nums text-zinc-900 transition-colors hover:border-zinc-300 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-white dark:hover:border-white/[0.2]',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {display}
        <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && target && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[100] w-[140px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-white/[0.1] dark:bg-zinc-900"
        >
          <div className="flex">
            <Wheel items={HOURS} value={h} onChange={(nh) => onChange(`${nh}:${m}`)} />
            <div className="flex items-center text-base font-bold text-zinc-300 dark:text-white/20">:</div>
            <Wheel items={MINUTES} value={m} onChange={(nm) => onChange(`${h}:${nm}`)} />
          </div>
        </div>,
        target
      )}
    </div>
  )
}
