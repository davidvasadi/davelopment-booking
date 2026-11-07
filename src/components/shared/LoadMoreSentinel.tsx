'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Görgetésre töltés a listák végén (a lapozó mellett): amikor ez a láthatatlan sáv a lista aljához közeledve
 * (`rootMargin` = előre, 400px-szel) láthatóvá válik, meghívja az `onMore`-t — a következő oldal hozzáfűződik.
 * Egyszerre csak egy töltés fut (`loading`), és csak ha van még (`hasMore`). Görgethető dobozban is működik (a böngésző
 * a szülők levágását is figyelembe veszi). Töltés közben egy kis forgó jelzés.
 */
export function LoadMoreSentinel({ hasMore, loading, onMore }: { hasMore: boolean; loading: boolean; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onMore)
  cb.current = onMore
  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || loading || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) cb.current() }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading])
  if (!hasMore && !loading) return null
  return (
    <div ref={ref} className="flex h-10 items-center justify-center text-ui-muted" aria-hidden={!loading}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  )
}
