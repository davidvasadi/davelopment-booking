'use client'

import { useEffect, useRef } from 'react'

/** Görgető doboz a heti rácsokhoz (mobil): betöltéskor és `k` változásakor oldalra görget, hogy a `[data-today]` elem a
 *  ragadós első oszlop (`[data-first-col]`) mellett, elöl legyen. Kliens-elem, így a szerveren renderelt blokkok is
 *  használhatják (a design-oldal is). */
export function TodayScroller({ k, className = '', children }: { k: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current, el = box?.querySelector<HTMLElement>('[data-today]')
    if (!box) return
    // nem az aktuális hét (nincs benne a mai nap): a hét elejétől
    if (!el) { box.scrollLeft = 0; return }
    if (box.scrollWidth <= box.clientWidth) return
    const first = (box.querySelector<HTMLElement>('[data-first-col]')?.offsetWidth ?? 0) + 6
    box.scrollLeft = Math.max(0, el.offsetLeft - first)
  }, [k])
  return <div ref={ref} className={className}>{children}</div>
}
