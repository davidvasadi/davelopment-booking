'use client'

import { useEffect, useId } from 'react'

/**
 * Egyszerre csak EGY lenyíló / panel legyen nyitva: amikor egy megnyílik, szól a többinek, és azok bezárulnak
 * (pl. a „Több” menü és a Foglalások szűrő-panele ne álljon egymáson). Használat: `useExclusivePopover(open, () => setOpen(false))`.
 */
const EVENT = 'davelopment:popover-open'

export function useExclusivePopover(open: boolean, close: () => void) {
  const id = useId()
  // megnyíláskor szól a többinek
  useEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
  }, [open, id])
  // ha egy másik nyílik meg, ez bezárul
  useEffect(() => {
    if (!open) return
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) close() }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [open, id, close])
}
