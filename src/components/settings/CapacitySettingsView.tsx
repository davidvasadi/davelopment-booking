'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RestaurantRulesPage, TablesRoomsPage, type RestaurantRulesValue } from '@/components/blocks/settings'
import type { CapacityVM } from '@/lib/restaurantCapacity'

/**
 * Étterem: Beállítások › Asztalok & termek (design 16.22) és › Foglalási szabályok (16.21). A termek online
 * foglalhatósága (`/api/rooms/:id`), az online kiadható férőhely %, a legkisebb / legnagyobb online létszám és az alap
 * asztal-idő (az étterem beállításai). Mindez csak a vendég ONLINE foglalására hat (lib/restaurantBooking `online`);
 * a terem-rajz és az asztalok összevonása az Asztalok oldalon. A mentés a hub közös sávján megy.
 */

const MONTHS = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const md = (d: string) => { const [, m, day] = d.split('-').map(Number); return m && day ? `${MONTHS[m - 1]} ${day}.` : d }

export function CapacitySettingsView({ part, vm, apiBase, onDirtyChange, registerApi }: {
  part: 'tables' | 'rules'
  vm: CapacityVM
  apiBase: string
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}) {
  const baseOnline = useMemo(() => Object.fromEntries(vm.rooms.map((r) => [r.id, r.online])), [vm])
  const baseRules = useMemo<RestaurantRulesValue>(() => ({ minPax: vm.minPax, maxPax: vm.maxPax, turnMinutes: vm.turnMinutes }), [vm])
  const [online, setOnline] = useState<Record<string, boolean>>(baseOnline)
  const [pct, setPct] = useState(vm.pct)
  const [rules, setRules] = useState(baseRules)

  const roomsDirty = vm.rooms.filter((r) => online[r.id] !== baseOnline[r.id])
  const bizDirty = pct !== vm.pct || JSON.stringify(rules) !== JSON.stringify(baseRules)
  useEffect(() => { onDirtyChange?.(roomsDirty.length > 0 || bizDirty) }, [roomsDirty.length, bizDirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const ref = useRef({ online, pct, rules, roomsDirty, bizDirty })
  ref.current = { online, pct, rules, roomsDirty, bizDirty }
  useEffect(() => {
    registerApi?.({
      save: async () => {
        const c = ref.current
        if (c.rules.maxPax != null && c.rules.maxPax < c.rules.minPax) { toast.error('A legnagyobb létszám nem lehet kisebb a legkisebbnél'); return false }
        try {
          for (const r of c.roomsDirty) {
            const res = await fetch(`/api/rooms/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ online_bookable: c.online[r.id] }) })
            if (!res.ok) throw new Error()
          }
          if (c.bizDirty) {
            const res = await fetch(apiBase, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ online_capacity_pct: c.pct, min_online_pax: c.rules.minPax, max_online_pax: c.rules.maxPax, turn_duration_minutes: c.rules.turnMinutes }) })
            if (!res.ok) throw new Error()
          }
          return true
        } catch { toast.error('A mentés nem sikerült'); return false }
      },
      discard: () => { setOnline(baseOnline); setPct(vm.pct); setRules(baseRules) },
    })
  }, [baseOnline, baseRules, vm, apiBase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (part === 'rules') return <RestaurantRulesPage save={false} value={rules} onChange={setRules} tablesMax={vm.tablesMaxPax} tablesHref="/restaurant/settings?tab=tables" />

  const seats = vm.rooms.reduce((n, r) => n + r.seats, 0) + vm.loose.seats
  const tables = vm.rooms.reduce((n, r) => n + r.tables, 0) + vm.loose.tables
  const onlineSeats = vm.rooms.filter((r) => online[r.id]).reduce((n, r) => n + r.seats, 0) + vm.loose.seats
  return (
    <TablesRoomsPage save={false} tablesHref="/restaurant/settings?tab=tables" pct={pct} onPct={setPct}
      total={{ seats, meta: `${tables} asztal · ${vm.rooms.length} terem · online ${Math.floor((onlineSeats * pct) / 100)} fő` }}
      rooms={vm.rooms.map((r) => ({
        key: r.id, name: r.name, online: online[r.id], onOnline: (on) => setOnline((o) => ({ ...o, [r.id]: on })),
        detail: [`${r.tables} asztal`, `${r.seats} fő`, r.outdoor ? 'kültéri' : null, r.seasonal ? `${r.start ? md(r.start) : '…'} – ${r.end ? md(r.end) : '…'}` : 'egész évben', online[r.id] ? null : 'csak telefonon'].filter(Boolean).join(' · '),
      }))} />
  )
}
