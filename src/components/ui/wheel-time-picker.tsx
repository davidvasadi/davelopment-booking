'use client'

import { useEffect, useRef } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui-kit'
import { cn } from '@/lib/utils'

const ITEM_H = 40
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

/** Görgethető kerék-oszlop (a középre kerülő elem a kiválasztott). */
function WheelColumn({ values, value, onChange }: { values: string[]; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Megnyitáskor a kiválasztott értékre görget.
  useEffect(() => {
    const i = values.indexOf(value)
    if (ref.current && i >= 0) ref.current.scrollTop = i * ITEM_H
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => {
      if (!ref.current) return
      const i = Math.round(ref.current.scrollTop / ITEM_H)
      const v = values[Math.max(0, Math.min(values.length - 1, i))]
      if (v && v !== value) onChange(v)
    }, 90)
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      data-lenis-prevent
      className="h-[200px] w-20 overflow-y-auto snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div style={{ height: ITEM_H * 2 }} />
      {values.map((v) => (
        <div
          key={v}
          className={cn(
            'flex h-10 snap-center items-center justify-center text-ui-title tabular-nums transition-colors',
            v === value ? 'font-medium text-ui-text' : 'text-ui-muted'
          )}
        >
          {v}
        </div>
      ))}
      <div style={{ height: ITEM_H * 2 }} />
    </div>
  )
}

export function WheelTimePicker({
  open,
  onClose,
  title,
  subtitle,
  value,
  onChange,
  shorthands = [],
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  value: string
  onChange: (v: string) => void
  shorthands?: string[]
}) {
  const [h, m] = (value || '00:00').split(':')
  const mm = MINUTES.includes(m) ? m : '00'

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="font-onest">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="truncate text-ui-title text-ui-text">{title}</p>
            {subtitle && <p className="truncate text-ui-meta text-ui-muted">{subtitle}</p>}
          </div>
          <Button size="sm" onClick={onClose}>Kész</Button>
        </div>

        <div className="relative">
          {/* középső kijelölő-sáv */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-ui-control bg-ui-cell" />
          <div className="flex items-center justify-center gap-1">
            <WheelColumn values={HOURS} value={h} onChange={(nh) => onChange(`${nh}:${mm}`)} />
            <span className="text-ui-title">:</span>
            <WheelColumn values={MINUTES} value={mm} onChange={(nm) => onChange(`${h}:${nm}`)} />
          </div>
        </div>

        {shorthands.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {shorthands.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className={cn(
                  'h-9 rounded-full px-3.5 text-ui-meta tabular-nums transition-colors',
                  s === value ? 'bg-ui-dark text-white' : 'bg-ui-cell text-ui-text'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
