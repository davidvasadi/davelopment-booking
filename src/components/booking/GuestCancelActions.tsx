'use client'

import { useState } from 'react'
import { Button } from '@/components/ui-kit'
import { GuestResult } from '@/components/blocks/guest-pages'

/** Étterem: a lemondás megerősítése a vendég-oldalon (design 21.12) — a gomb a lemondó végpontot hívja, utána kész / hiba. */
export function GuestCancelActions({ token, rows, home, l }: {
  token: string; rows: [string, string][]; home: string
  /** a vendég nyelvén: cím, kérdés, gombok, kész / hiba szövegek */
  l: { title: string; confirm: string; yes: string; no: string; doneTitle: string; done: string; failed: string; back: string }
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const cancel = async () => {
    setState('busy')
    const r = await fetch(`/api/restaurant/reservations/cancel/${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => null)
    setState(r?.ok ? 'done' : 'error')
  }
  if (state === 'done') return <GuestResult tone="ok" title={l.doneTitle} text={l.done} rows={rows}><Button href={home}>{l.back}</Button></GuestResult>
  return (
    <GuestResult tone={state === 'error' ? 'bad' : 'warn'} title={l.title} text={state === 'error' ? l.failed : l.confirm} rows={rows}>
      {state !== 'error' && <Button variant="danger" loading={state === 'busy'} onClick={() => void cancel()}>{l.yes}</Button>}
      <Button variant="cell" href={home}>{state === 'error' ? l.back : l.no}</Button>
    </GuestResult>
  )
}
