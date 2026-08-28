'use client'

/**
 * Saját napi szünet — önkiszolgáló beállítás a „Saját profil" fülön. Az itt megadott alap
 * szünetidőt a beosztás-automatizáló minden napra automatikusan ráírja a Naptáron (Shifts.
 * break_start/break_end), amit a munkatárs (vagy a tulaj/vezető) utána a Naptárban/Munkatársak
 * nap-szerkesztőjében napra szólóan felülírhat — mindhárom felület UGYANAZT a mezőt mutatja.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Coffee } from 'lucide-react'
import { TimeSelect } from '@/components/ui/time-select'
import { Switch } from '@/components/ui/toggle-switch'

const CARD = 'rounded-[20px] border border-line bg-[var(--dav-glass,rgba(255,255,255,.6))] p-5 sm:p-6'

export function DefaultBreakCard({ staffId, defaultBreakStart, defaultBreakEnd }: { staffId: string; defaultBreakStart: string | null; defaultBreakEnd: string | null }) {
  const router = useRouter()
  const [has, setHas] = useState(!!(defaultBreakStart && defaultBreakEnd))
  const [start, setStart] = useState(defaultBreakStart ?? '12:00')
  const [end, setEnd] = useState(defaultBreakEnd ?? '13:00')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ default_break_start: has ? start : null, default_break_end: has ? end : null }),
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
      <div className="mb-4 flex items-center gap-2.5">
        <Coffee className="h-[18px] w-[18px] text-ink-soft" strokeWidth={1.8} />
        <div>
          <p className="text-[14px] font-semibold text-ink">Napi szünet</p>
          <p className="text-[12px] text-ink-soft2">Az alap szünetidőd — minden napra automatikusan bekerül, egy adott napon felülírhatod a Naptárban.</p>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink">Van napi szünetem</span>
        <Switch checked={has} onChange={setHas} />
      </div>
      {has && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-ink-soft">Kezdete</p>
            <TimeSelect value={start} onChange={setStart} />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-ink-soft">Vége</p>
            <TimeSelect value={end} onChange={setEnd} />
          </div>
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
