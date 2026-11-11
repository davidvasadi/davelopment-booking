'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Loader2, TriangleAlert, WifiOff } from 'lucide-react'
import { Button, Card, ListRow, Note } from '@/components/ui-kit'

/** Az offline vázlat-mód sávja a Foglalások tetején (szalon és étterem közös megjelenítése): netkiesésnél figyelmeztetés,
 *  a mentésre váró vázlatok lenyitható listája (koppintásra a szerkesztőben nyílik), online pedig az összes véglegesítése.
 *  A mentés a hívó dolga (szalonnál / étteremnél más a végpont). */
export function OfflineDraftsBar({ online, drafts, busyId, onReview, onFinalizeAll }: {
  online: boolean
  /** conflict: a net visszajöttekor a szerver próba-ellenőrzése szerint ütközik (a hibaüzenet) */
  drafts: { id: string; time: string; label: string; conflict?: string }[]
  busyId: string | null
  onReview: (id: string) => void
  onFinalizeAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const conflictCount = drafts.filter((d) => d.conflict).length
  // ha ütközés derül ki, a lista magától kinyílik, hogy látszódjon, melyik vázlat az
  useEffect(() => { if (conflictCount > 0) setOpen(true) }, [conflictCount])
  if (online && drafts.length === 0) return null
  return (
    <div className="space-y-2">
      {!online && (
        <Note warn icon={WifiOff}>
          <strong className="font-medium">Nincs internetkapcsolat — vázlat módban dolgozol.</strong> Az új foglalások az eszközön maradnak, amíg vissza nem jön a net.
        </Note>
      )}
      {drafts.length > 0 && (
        <Card pad="xs">
          <button type="button" onClick={() => (drafts.length === 1 ? onReview(drafts[0].id) : setOpen((o) => !o))} className="flex w-full items-center gap-2.5 rounded-ui-inner px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
            <TriangleAlert className="h-4 w-4 shrink-0 text-ui-warn" />
            <span className="text-ui-body text-ui-text">{drafts.length} mentésre váró vázlat{conflictCount > 0 && <span className="text-ui-bad"> · {conflictCount} ütközik</span>}</span>
            {online && <span className="ml-auto text-ui-meta text-ui-muted">Átnézés</span>}
            <ChevronRight className={`h-4 w-4 shrink-0 text-ui-muted transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
          {open && (
            <div className="px-1 pb-1">
              {drafts.map((d) => (
                <button key={d.id} type="button" onClick={() => onReview(d.id)} className="block w-full text-left">
                  <ListRow
                    leading={<span className="w-11 shrink-0 text-ui-body tabular-nums text-ui-text">{d.time}</span>}
                    title={d.label}
                    meta={d.conflict ? <span className="text-ui-bad">{d.conflict} — nyisd meg, és tedd át másik időpontra</span> : undefined}
                    trailing={busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin text-ui-muted" /> : <ChevronRight className="h-4 w-4 text-ui-muted" />}
                  />
                </button>
              ))}
              {online && drafts.length > 1 && <Button className="mt-2 w-full" disabled={!!busyId} onClick={onFinalizeAll}>{busyId ? 'Mentés…' : 'Összes véglegesítése'}</Button>}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
