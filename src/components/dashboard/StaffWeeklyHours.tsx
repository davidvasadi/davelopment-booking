'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/toggle-switch'

/**
 * Munkatárs heti, napra lebontott munkaideje (pl. hétfőn 9–17, kedden 12–20, szerdán szabad).
 * A foglalható időpontok számítása (`resolveStaffWorkHours`) már eddig is ezt használta, ha
 * volt — csak felület nem volt hozzá. Kikapcsolva a munkatárs a szalon nyitvatartását követi.
 * Tárolás: Availability rekordok (recurring, staff + day_of_week), a meglévő API-n keresztül.
 */

const DAYS: { key: string; label: string }[] = [
  { key: 'monday', label: 'Hétfő' },
  { key: 'tuesday', label: 'Kedd' },
  { key: 'wednesday', label: 'Szerda' },
  { key: 'thursday', label: 'Csütörtök' },
  { key: 'friday', label: 'Péntek' },
  { key: 'saturday', label: 'Szombat' },
  { key: 'sunday', label: 'Vasárnap' },
]

type Rec = { id?: number | string; staff?: unknown; day_of_week?: string; is_available?: boolean; start_time?: string; end_time?: string; exception_date?: string | null }
type Day = { on: boolean; start: string; end: string; id?: string }

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function StaffWeeklyHours({ salonId, staffId }: { salonId: string; staffId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [custom, setCustom] = useState(false)
  const [days, setDays] = useState<Record<string, Day>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/availability?where[staff][equals]=${encodeURIComponent(staffId)}&where[recurring][equals]=true&limit=50`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`/api/availability?where[salon][equals]=${encodeURIComponent(salonId)}&where[recurring][equals]=true&limit=300`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([own, salon]: [{ docs?: Rec[] }, { docs?: Rec[] }]) => {
        if (cancelled) return
        const ownDocs = (own.docs ?? []).filter((r) => !r.exception_date)
        const salonDefaults = (salon.docs ?? []).filter((r) => !r.staff && !r.exception_date)
        const next: Record<string, Day> = {}
        for (const d of DAYS) {
          const mine = ownDocs.find((r) => r.day_of_week === d.key)
          const base = salonDefaults.find((r) => r.day_of_week === d.key)
          const src = mine ?? base
          next[d.key] = {
            on: ownDocs.length > 0 ? !!mine && mine.is_available !== false : (base ? base.is_available !== false : false),
            start: src?.start_time ?? '09:00',
            end: src?.end_time ?? '17:00',
            id: mine?.id != null ? String(mine.id) : undefined,
          }
        }
        setDays(next)
        setCustom(ownDocs.length > 0)
      })
      .catch(() => { if (!cancelled) toast.error('A munkaidő betöltése sikertelen') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [salonId, staffId])

  const setDay = (key: string, patch: Partial<Day>) => setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const save = async () => {
    if (custom) {
      for (const d of DAYS) {
        const v = days[d.key]
        if (v.on && (!TIME_RE.test(v.start) || !TIME_RE.test(v.end) || v.start >= v.end)) {
          toast.error(`${d.label}: a kezdés legyen korábban, mint a vége`)
          return
        }
      }
    }
    setSaving(true)
    try {
      if (!custom) {
        // Vissza a szalon nyitvatartására: a munkatárs saját heti rekordjait töröljük.
        const ids = DAYS.map((d) => days[d.key]?.id).filter(Boolean) as string[]
        for (const id of ids) {
          const res = await fetch(`/api/availability/${id}`, { method: 'DELETE', credentials: 'include' })
          if (!res.ok) throw new Error()
        }
        setDays((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, id: undefined }])))
      } else {
        const next = { ...days }
        for (const d of DAYS) {
          const v = days[d.key]
          const body = {
            salon: Number(salonId),
            staff: Number(staffId),
            day_of_week: d.key,
            recurring: true,
            is_available: v.on,
            start_time: v.start,
            end_time: v.end,
          }
          const res = v.id
            ? await fetch(`/api/availability/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
            : await fetch('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
          if (!res.ok) throw new Error()
          const json = await res.json().catch(() => null)
          const id = json?.doc?.id ?? v.id
          next[d.key] = { ...v, id: id != null ? String(id) : undefined }
        }
        setDays(next)
      }
      toast.success('Munkaidő mentve')
    } catch {
      toast.error('A munkaidő mentése sikertelen')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Munkaidő betöltése…</div>
  }

  const timeCls = 'h-9 w-[92px] rounded-[10px] border border-line-strong bg-white px-2 text-[16px] text-ink disabled:opacity-40 lg:text-[13px]'

  return (
    <div className="space-y-3">
      {/* Ugyanaz a kapcsoló, mint a sidebar „Aktív” sora */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[#f4f4f4] px-4 py-3.5">
        <span>
          <span className="block text-sm font-medium text-ink">Egyéni munkaidő</span>
          <span className="mt-0.5 block text-xs text-ink-soft">Kikapcsolva a szalon nyitvatartása érvényes</span>
        </span>
        <Switch checked={custom} onChange={setCustom} ariaLabel="Egyéni munkaidő" />
      </div>
      {custom && (
        <div className="divide-y divide-line rounded-[14px] border border-line bg-white">
          {DAYS.map((d) => {
            const v = days[d.key]
            return (
              <div key={d.key} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="w-24 text-sm text-ink">{d.label}</span>
                  {v.on ? (
                    <div className="flex items-center gap-1.5">
                      <input type="time" value={v.start} onChange={(e) => setDay(d.key, { start: e.target.value })} className={timeCls} />
                      <span className="text-ink-soft">–</span>
                      <input type="time" value={v.end} onChange={(e) => setDay(d.key, { end: e.target.value })} className={timeCls} />
                    </div>
                  ) : (
                    <span className="text-[13px] text-ink-soft2">Szabadnap</span>
                  )}
                </div>
                <Switch checked={v.on} onChange={(on) => setDay(d.key, { on })} ariaLabel={`${d.label} munkanap`} />
              </div>
            )
          })}
        </div>
      )}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex h-10 items-center gap-1.5 rounded-dav-pill bg-ink-dark px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Munkaidő mentése
      </button>
    </div>
  )
}

