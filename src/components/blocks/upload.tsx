import { Loader2, RotateCcw } from 'lucide-react'

/* Feltöltés (design 21.6.2 — a foglalóoldal galériája; minden képfeltöltés ugyanígy néz ki). */

/** Állapot feltöltés közben: a választott fájl helyi előnézete, a százalék, a feldolgozás (kicsinyítés, WebP), a hiba. */
export type UploadState = { src: string; pct: number; proc: boolean; error?: string | null }

/** Feltöltés alatti kép: a választott fájl előnézete sötétítve — `pct`: töltődik (százalék + csík), `proc`: feldolgozás
 *  (kicsinyítés, WebP), `error`: nem sikerült (Újra). A méretet és a formát a hívó adja (alap: négyzet). */
export function UploadTile({ src, pct = 0, proc = false, error = false, onRetry, className = 'aspect-square rounded-ui-control' }: { src?: string; pct?: number; proc?: boolean; error?: boolean; onRetry?: () => void; className?: string }) {
  if (error) {
    const body = <><RotateCcw className="h-4 w-4" />Újra</>
    const cls = `flex flex-col items-center justify-center gap-1 bg-ui-cell text-ui-label text-ui-muted ${className}`
    return onRetry ? <button type="button" title="Újra" onClick={onRetry} className={`${cls} w-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{body}</button> : <span title="Újra" className={cls}>{body}</span>
  }
  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ui-dark/60 text-ui-label text-white">
        {proc ? <><Loader2 className="h-4 w-4 animate-spin" />Kicsinyítés</> : <>{pct}%<span className="h-1 w-3/4 overflow-hidden rounded-full bg-white/25"><span className="block h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></span></>}
      </span>
    </span>
  )
}
