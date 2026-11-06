'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Áthúzható sorrend (rács vagy lista) könyvtár nélkül, egérrel: egy kis mozdulat után indul (sima kattintás marad
 * kattintás), húzás közben a többi elem azonnal a helyére csúszik (a hívó `motion` layout-tal animálja), elengedéskor
 * `onCommit` az új sorrenddel. `bind(id)` az elemre teendő tulajdonságok, `dragging` az épp húzott elem.
 */
export function useSortable(ids: string[], onCommit: (ids: string[]) => void) {
  const [order, setOrder] = useState(ids)
  const key = ids.join('|')
  useEffect(() => { setOrder(ids) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const [dragging, setDragging] = useState<string | null>(null)
  const suppressClick = useRef(false)

  const bind = (id: string) => ({
    'data-sort-id': id,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || e.pointerType !== 'mouse') return
      const s = { x: e.clientX, y: e.clientY, started: false, order }
      const move = (ev: PointerEvent) => {
        if (!s.started) {
          if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < 6) return
          s.started = true
          setDragging(id)
          document.body.style.userSelect = 'none'
        }
        const over = (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-sort-id]') as HTMLElement | null)?.dataset.sortId
        if (!over || over === id || !s.order.includes(over)) return
        const from = s.order.indexOf(id), to = s.order.indexOf(over)
        const next = s.order.filter((x) => x !== id)
        next.splice(to, 0, id)
        if (from === to) return
        s.order = next
        setOrder(next)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        document.body.style.userSelect = ''
        if (!s.started) return
        suppressClick.current = true
        setTimeout(() => { suppressClick.current = false }, 0)
        setDragging(null)
        if (s.order.join('|') !== key) onCommit(s.order)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    // a húzás végén ne nyíljon meg a szerkesztő
    onClickCapture: (e: React.MouseEvent) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation() } },
  })
  return { order, dragging, bind }
}
