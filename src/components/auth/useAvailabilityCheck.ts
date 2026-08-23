'use client'

import { useEffect, useRef, useState } from 'react'

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken'

/**
 * Debounce-olt élő elérhetőség-ellenőrzés (email / szalon-étterem név) a regisztrációs
 * formokhoz — a `/api/auth/check-availability` route-ot hívja gépelés után 500ms-mal.
 * `isFormatValid` a hívó saját, szinkron formátum-ellenőrzése (pl. email-regex, min. hossz) —
 * amíg az hamis, nem indít hálózati kérést.
 */
export function useAvailabilityCheck(type: 'email' | 'business-name', value: string, isFormatValid: boolean): AvailabilityStatus {
  const [status, setStatus] = useState<AvailabilityStatus>('idle')
  const seq = useRef(0)

  useEffect(() => {
    if (!isFormatValid || !value.trim()) {
      setStatus('idle')
      return
    }
    setStatus('checking')
    const mySeq = ++seq.current
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-availability?type=${type}&value=${encodeURIComponent(value.trim())}`)
        const data = await res.json().catch(() => null)
        if (seq.current !== mySeq) return // időközben új érték jött, ez a válasz már elavult
        setStatus(data?.available === false ? 'taken' : 'available')
      } catch {
        if (seq.current === mySeq) setStatus('idle')
      }
    }, 500)
    return () => clearTimeout(t)
  }, [type, value, isFormatValid])

  return status
}
