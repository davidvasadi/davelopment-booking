'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { OfflineDraftsBar } from '@/components/shared/OfflineDraftsBar'
import { useOnline } from '@/lib/useOnline'
import { removeDraft, type SalonBookingDraft } from '@/lib/salonBookingDrafts'

/**
 * Állapotsáv a szalon foglalás-oldal tetején (az étterem `OfflineBanner` párja):
 *  - offline: figyelmeztet, hogy vázlat módban dolgozunk
 *  - online + függő vázlatok: felkínálja a véglegesítést
 *
 * A véglegesítés a `manage-booking` POST-ot futtatja soronként — ez a szerveroldali
 * validátor (átfedés ellen), nincs külön ütközés-logika itt.
 */
export function SalonOfflineBanner({
  salonId,
  drafts,
  onReview,
}: {
  salonId: string
  drafts: SalonBookingDraft[]
  /** Egy vázlat megnyitása ugyanabban a sheetben, mint a listából/idővonalból. */
  onReview: (draft: SalonBookingDraft) => void
}) {
  const online = useOnline()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const finalizeOne = async (d: SalonBookingDraft): Promise<boolean> => {
    setBusyId(d.draftId)
    try {
      const res = await fetch('/api/salon/manage-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: d.date,
          start_time: d.start_time,
          serviceId: d.serviceId,
          staffId: d.staffId,
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
      removeDraft(salonId, d.draftId)
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
      // sorban, hogy a szakember-foglaltság ne ütközzön önmagával
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
      drafts={drafts.map((d) => ({ id: d.draftId, time: d.start_time, label: [d.customer_name, d.serviceName, d.staffName].filter(Boolean).join(' · ') }))}
      busyId={busyId}
      onReview={(id) => { const d = drafts.find((x) => x.draftId === id); if (d) onReview(d) }}
      onFinalizeAll={finalizeAll}
    />
  )
}
