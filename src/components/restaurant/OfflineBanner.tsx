'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OfflineDraftsBar } from '@/components/shared/OfflineDraftsBar'
import { useOnline } from '@/lib/useOnline'
import { removeDraft, type ReservationDraft } from '@/lib/offlineDrafts'

/**
 * Állapotsáv a foglalás-oldal tetején:
 *  - offline: figyelmeztet, hogy vázlat módban dolgozunk
 *  - online + függő vázlatok: felkínálja a véglegesítést (A út)
 *
 * A véglegesítés a meglévő `manage-reservation` POST-ot futtatja soronként —
 * ez a szerveroldali validátor (túlfoglalás ellen), nincs külön ütközés-logika.
 */
export function OfflineBanner({
  restaurantId,
  drafts,
  onReview,
}: {
  restaurantId: string
  drafts: ReservationDraft[]
  /** Egy vázlat megnyitása ugyanabban a sliderben, mint a listából/idővonalból. */
  onReview: (draft: ReservationDraft) => void
}) {
  const online = useOnline()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const finalizeOne = async (d: ReservationDraft): Promise<boolean> => {
    setBusyId(d.draftId)
    try {
      const res = await fetch('/api/restaurant/manage-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: d.date,
          start_time: d.start_time,
          pax: d.pax,
          tableIds: d.tableIds,
          customer_name: d.customer_name,
          customer_city: d.customer_city,
          customer_phone: d.customer_phone,
          customer_email: d.customer_email,
          notes: d.notes,
          status: d.status,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(`${d.customer_name}: ${json.error ?? 'nem rögzíthető'}`)
        return false
      }
      removeDraft(restaurantId, d.draftId)
      return true
    } catch {
      toast.error('Nincs kapcsolat — próbáld újra később')
      return false
    } finally {
      setBusyId(null)
    }
  }

  const finalizeAll = async () => {
    let ok = 0
    for (const d of drafts) {
      // sorban, hogy az asztal-foglaltság ne ütközzön önmagával
      if (await finalizeOne(d)) ok++
    }
    if (ok > 0) {
      toast.success(`${ok} vázlat véglegesítve`)
      router.refresh()
    }
  }

  return (
    <OfflineDraftsBar
      online={online}
      drafts={drafts.map((d) => ({ id: d.draftId, time: d.start_time, label: [d.customer_name, `${d.pax} fő`, d.tableNames?.length ? d.tableNames.join(' + ') : null].filter(Boolean).join(' · ') }))}
      busyId={busyId}
      onReview={(id) => { const d = drafts.find((x) => x.draftId === id); if (d) onReview(d) }}
      onFinalizeAll={finalizeAll}
    />
  )
}
