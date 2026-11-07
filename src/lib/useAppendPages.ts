'use client'

import { useEffect, useState } from 'react'

/**
 * Lapozás + görgetésre hozzáfűzés a már betöltött (kliens-oldali) listákhoz: a látható szelet `from`–`to`; a görgetés
 * (`more`) a következő oldalt fűzi hozzá, a lapozó (`goTo`) egy oldalra ugrik (onnan folytatódik). `page` = az utolsó
 * látható oldal (ezt mutatja a lapozó), `label` = „1–30 / 120”. `resetKey` változásakor (szűrő, keresés) az elejéről.
 */
export function useAppendPages(total: number, pageSize: number, resetKey?: unknown) {
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(1)
  useEffect(() => { setStart(1); setEnd(1) }, [resetKey])
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const s = Math.min(start, pages)
  const e = Math.min(Math.max(end, s), pages)
  const from = (s - 1) * pageSize
  const to = e * pageSize
  return {
    from, to, page: e, pages,
    hasMore: e < pages,
    more: () => setEnd((x) => Math.min(Math.max(x, s) + 1, pages)),
    goTo: (p: number) => { setStart(p); setEnd(p) },
    label: total ? `${from + 1}–${Math.min(total, to)} / ${total}` : '0',
  }
}
