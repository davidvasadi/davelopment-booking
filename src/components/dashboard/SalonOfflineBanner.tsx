'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { WifiOff, Loader2, AlertTriangle, ChevronRight } from 'lucide-react'
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
  const [open, setOpen] = useState(false)

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

  // Nincs mit mutatni
  if (online && drafts.length === 0) return null

  return (
    <div className="space-y-2">
      {!online && (
        <div className="flex items-center gap-2.5 rounded-[18px] border border-gold/60 bg-gold/[0.14] px-4 py-2.5 text-sm text-ink">
          <WifiOff className="h-4 w-4 shrink-0 text-[#9A8B52]" />
          <span className="font-medium">Nincs internetkapcsolat — vázlat módban dolgozol.</span>
          <span className="hidden sm:inline text-ink-soft">
            Az új foglalások az eszközön maradnak, amíg vissza nem jön a net.
          </span>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="rounded-[18px] border border-line bg-white shadow-dav-card">
          <button
            onClick={() => (drafts.length === 1 ? onReview(drafts[0]) : setOpen((o) => !o))}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-left"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#9A8B52]" />
            <span className="font-semibold text-ink">
              {drafts.length} mentésre váró vázlat
            </span>
            {online && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink-dark text-white px-3 py-1 text-xs font-bold">
                Átnézés
              </span>
            )}
          </button>

          {open && (
            <div className="border-t border-line divide-y divide-line">
              {drafts.map((d) => (
                <button
                  key={d.draftId}
                  onClick={() => onReview(d)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-[var(--dav-glass)] transition-colors"
                >
                  <span className="tabular-nums font-semibold text-ink w-12 shrink-0">
                    {d.start_time}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-ink-soft2">
                    {d.customer_name}
                    {d.serviceName ? ` · ${d.serviceName}` : ''}
                    {d.staffName ? ` · ${d.staffName}` : ''}
                  </span>
                  {busyId === d.draftId && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-soft shrink-0" />}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft2" />
                </button>
              ))}
              {online && drafts.length > 1 && (
                <div className="px-4 py-2.5">
                  <button
                    onClick={finalizeAll}
                    disabled={!!busyId}
                    className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 disabled:opacity-60"
                  >
                    {busyId ? 'Mentés…' : 'Összes véglegesítése'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
