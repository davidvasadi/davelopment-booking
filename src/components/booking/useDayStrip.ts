'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import type { PickDay } from '@/components/blocks/booking'

/**
 * A foglalóoldal görgethető nap-sávja (szalon és étterem, design 21.x): a mától a foglalási ablak végéig (max. 60) minden
 * nap; a mai „Ma” felirattal, keretezve; ahol nincs szabad időpont (zárva, betelt, ma már elmúlt), az sötétebb és nem
 * választható — ezt a `daysUrl` adja (`{ open: string[] }`). Ha a választott nap nem foglalható, a legelső szabadra ugrik.
 * A `stripRef` a sáv köré tett elem: a választott nap mindig látszik benne.
 */
export function useDayStrip({ daysUrl, windowDays, selected, onAutoPick, dfLocale, todayLabel }: {
  daysUrl: string | null
  windowDays: number
  selected: string
  onAutoPick: (date: string) => void
  dfLocale: Locale
  todayLabel: string
}) {
  const [open, setOpen] = useState<Set<string> | null>(null)
  const n = Math.max(0, Math.min(windowDays, 60))
  useEffect(() => {
    setOpen(null)
    if (!daysUrl || n <= 0) return
    let cancelled = false
    fetch(`${daysUrl}&n=${n}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('days'))))
      .then((d: { open?: string[] }) => { if (!cancelled) setOpen(new Set(d.open ?? [])) })
      .catch(() => { /* ha nem jön meg, minden nap választható marad — a napi lekérés úgyis megmondja */ })
    return () => { cancelled = true }
  }, [daysUrl, n])

  // ha a választott nap nem foglalható (pl. ma már nincs hely), az első szabadra ugrunk
  useEffect(() => {
    if (!open || open.has(selected)) return
    const first = [...open].sort()[0]
    if (first) onAutoPick(first)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const days: PickDay[] = Array.from({ length: n }, (_, i) => {
    const dt = new Date(`${todayKey}T12:00:00`); dt.setDate(dt.getDate() + i)
    const key = format(dt, 'yyyy-MM-dd')
    return { key, d: i === 0 ? todayLabel : format(dt, 'EEEEEE', { locale: dfLocale }), n: dt.getDate(), today: i === 0, on: key === selected, off: !!open && !open.has(key), title: format(dt, 'PPPP', { locale: dfLocale }) }
  })

  // a választott nap a sávban mindig látszódjon (pl. ha a munkatárs legközelebbi szabad napjára ugrottunk)
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = stripRef.current?.firstElementChild as HTMLElement | null
    const btn = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box || !btn) return
    const b = box.getBoundingClientRect(), r = btn.getBoundingClientRect()
    if (r.left < b.left || r.right > b.right) box.scrollTo({ left: box.scrollLeft + r.left - b.left - 8, behavior: 'smooth' })
  }, [selected, open])

  return { days, stripRef }
}
