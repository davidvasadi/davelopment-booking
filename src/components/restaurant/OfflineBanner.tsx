'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { WifiOff, Loader2, AlertTriangle, ChevronRight } from 'lucide-react'
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
  const [open, setOpen] = useState(false)

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

  // Nincs mit mutatni
  if (online && drafts.length === 0) return null

  return (
    <div className="space-y-2">
      {!online && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="font-medium">Nincs internetkapcsolat — vázlat módban dolgozol.</span>
          <span className="hidden sm:inline text-amber-700/80 dark:text-amber-300/70">
            Az új foglalások az eszközön maradnak, amíg vissza nem jön a net.
          </span>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:bg-white/[0.04] dark:border-white/[0.1]">
          <button
            onClick={() => (drafts.length === 1 ? onReview(drafts[0]) : setOpen((o) => !o))}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-left"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="font-semibold text-zinc-900 dark:text-white">
              {drafts.length} mentésre váró vázlat
            </span>
            {online && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 px-3 py-1 text-xs font-bold">
                Átnézés
              </span>
            )}
          </button>

          {open && (
            <div className="border-t border-zinc-100 dark:border-white/[0.06] divide-y divide-zinc-100 dark:divide-white/[0.06]">
              {drafts.map((d) => (
                <button
                  key={d.draftId}
                  onClick={() => onReview(d)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-white w-12 shrink-0">
                    {d.start_time}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                    {d.customer_name} · {d.pax} fő
                    {d.tableNames?.length ? ` · ${d.tableNames.join(' + ')}` : ''}
                  </span>
                  {busyId === d.draftId && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400 shrink-0" />}
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 dark:text-white/30" />
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
