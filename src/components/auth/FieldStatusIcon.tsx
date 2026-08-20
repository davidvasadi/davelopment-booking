'use client'

import { Check, X, Loader2 } from 'lucide-react'
import type { AvailabilityStatus } from '@/components/auth/useAvailabilityCheck'

/** Mező jobb szélén megjelenő állapot-ikon (pipa/X/töltés-jelző) — input-mezők `relative`
 *  wrapperébe téve, `absolute right-3 top-1/2` pozícióval.
 *
 *  A KÜLSŐ span végzi a függőleges középre-igazítást (`-translate-y-1/2`), a BELSŐ ikon
 *  csak forog (`animate-spin`) — ha ugyanazon az elemen lenne mindkettő, a forgó keyframe
 *  (ami maga is a `transform`-ot animálja) felülírná/eltüntetné a translate-et, és az ikon
 *  forgás helyett láthatóan "felugrik" a doboz tetejére (ez volt a jelzett hiba). */
export function FieldStatusIcon({ status }: { status: AvailabilityStatus }) {
  if (status === 'idle') return null
  return (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center">
      {status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-ink-soft2" />}
      {status === 'available' && <Check className="h-4 w-4" style={{ color: '#74AA19' }} />}
      {status === 'taken' && <X className="h-4 w-4 text-bad" />}
    </span>
  )
}
