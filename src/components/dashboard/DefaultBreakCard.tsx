'use client'

/**
 * Saját napi szünet(ek) — önkiszolgáló beállítás a „Saját profil" fülön. Az itt megadott alap
 * szünetidő(ke)t a beosztás-automatizáló minden napra automatikusan ráírja a Naptáron (Shifts.
 * breaks), amit a munkatárs (vagy a tulaj/vezető) utána a Naptárban/Munkatársak
 * nap-szerkesztőjében napra szólóan felülírhat — mindhárom felület UGYANAZT a mezőt mutatja.
 * Egy nap TÖBB szünetet is tarthat (pl. ebéd + délutáni pihenő) — "+" gombbal bővíthető lista.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Coffee, Plus, Trash2 } from 'lucide-react'
import { TimeSelect } from '@/components/ui/time-select'
import type { BreakWindow } from '@/payload/payload-types'

const CARD = 'rounded-[20px] border border-line bg-[var(--dav-glass,rgba(255,255,255,.6))] p-5 sm:p-6'

export function DefaultBreakCard({ staffId, defaultBreaks }: { staffId: string; defaultBreaks: BreakWindow[] | null }) {
  const router = useRouter()
  const [breaks, setBreaks] = useState<BreakWindow[]>(defaultBreaks ?? [])
  const [saving, setSaving] = useState(false)

  const addBreak = () => setBreaks((b) => [...b, { start_time: '12:00', end_time: '13:00' }])
  const updateBreak = (i: number, patch: Partial<BreakWindow>) => setBreaks((b) => b.map((w, idx) => (idx === i ? { ...w, ...patch } : w)))
  const removeBreak = (i: number) => setBreaks((b) => b.filter((_, idx) => idx !== i))

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ default_breaks: breaks.filter((w) => w.start_time && w.end_time) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Mentve')
      router.refresh()
    } catch {
      toast.error('Nem sikerült menteni')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Coffee className="h-[18px] w-[18px] text-ink-soft" strokeWidth={1.8} />
          <div>
            <p className="text-[14px] font-semibold text-ink">Napi szünet(ek)</p>
            <p className="text-[12px] text-ink-soft2">Az alap szünetidőid — minden napra automatikusan bekerülnek, egy adott napon felülírhatod a Naptárban.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={addBreak}
          className="flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> Szünet
        </button>
      </div>
      {breaks.length > 0 && (
        <div className="mb-4 space-y-2.5">
          {breaks.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-[14px] border border-line bg-white p-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-ink-soft">Kezdete</p>
                <TimeSelect value={w.start_time} onChange={(v) => updateBreak(i, { start_time: v })} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold text-ink-soft">Vége</p>
                <TimeSelect value={w.end_time} onChange={(v) => updateBreak(i, { end_time: v })} />
              </div>
              <button type="button" onClick={() => removeBreak(i)} aria-label="Szünet törlése" className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-soft2 transition-colors hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-dav-pill bg-ink-dark text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mentés'}
      </button>
    </div>
  )
}
