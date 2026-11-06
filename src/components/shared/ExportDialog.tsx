'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Popup } from './Popup'
import { ExportModal, exportDefaultFields, type ExportValue } from '@/components/blocks/guests'
import { addDays } from '@/lib/schedule'
import { ymdLocal } from '@/lib/utils'
import { saveFile } from '@/lib/csv'

/**
 * Az export-ablak (design 7.6) élőben — a Vendégek és a Foglalások is ezt nyitja: mit (vendégek / foglalások), milyen
 * időszakra (30 nap / Év / Minden / Egyedi a naptárban), mely mezőkkel. A sorok száma előre látszik
 * (/api/guests/export?count=1), a letöltés telefonon a megosztás-lappal megy (a telepített appban is).
 * `initial`: a kezdő állapot (pl. a Foglalásoknál a nézett napok, „Foglalások”); `keys`: csak a kijelölt vendégek;
 * `guests`: választható-e a „Vendégek” (a vendégadatokhoz külön jog kell).
 */
export function ExportDialog({ initial, keys = [], guestsTotal, guests = true, onClose }: { initial?: Partial<ExportValue>; keys?: string[]; guestsTotal?: number; guests?: boolean; onClose: () => void }) {
  const today = ymdLocal(new Date())
  const presetRange = (i: number): [string, string] => (i === 0 ? [addDays(today, -29), today] : i === 1 ? [`${today.slice(0, 4)}-01-01`, today] : ['', ''])
  const [v, setV] = useState<ExportValue>(() => {
    const [from, to] = presetRange(0)
    const what = initial?.what ?? 'guests'
    return { what, preset: 0, from, to, fields: exportDefaultFields(what), ...initial }
  })
  const [rows, setRows] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const qs = (x: ExportValue) => {
    const p = new URLSearchParams({ what: x.what, fields: x.fields.join(',') })
    if (x.preset !== 2 && x.from) p.set('from', x.from)
    if (x.preset !== 2 && x.to) p.set('to', x.to)
    if (keys.length) p.set('keys', keys.join('|'))
    return p
  }
  useEffect(() => {
    setRows(null)
    const t = setTimeout(() => { fetch(`/api/guests/export?${qs(v)}&count=1`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j) => setRows(j?.rows ?? null)).catch(() => {}) }, 200)
    return () => clearTimeout(t)
  }, [v]) // eslint-disable-line react-hooks/exhaustive-deps

  // a naptárban: első kattintás az időszak eleje, a második a vége (Egyedi)
  const [pickEnd, setPickEnd] = useState(false)
  const onPick = (d: string) => {
    if (!pickEnd || v.preset !== 3 || !v.from) { setV({ ...v, preset: 3, from: d, to: d }); setPickEnd(true); return }
    setV({ ...v, preset: 3, ...(d < v.from ? { from: d, to: v.from } : { to: d }) })
    setPickEnd(false)
  }
  const onChange = (n: ExportValue) => {
    if (!guests && n.what === 'guests') return
    if (n.preset !== v.preset && n.preset !== 3) { const [from, to] = presetRange(n.preset); setV({ ...n, from, to }); return }
    setV(n)
  }
  const download = async () => {
    setBusy(true)
    const res = await fetch(`/api/guests/export?${qs(v)}`, { credentials: 'include' }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { toast.error('Nem sikerült az export.'); return }
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'export.csv'
    await saveFile(name, await res.blob())
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <ExportModal value={v} onChange={onChange} onPick={onPick} rows={rows} selected={keys.length} busy={busy} onDownload={download} onClose={onClose}
        counts={{ guests: guests ? `${(keys.length || guestsTotal || 0).toLocaleString('hu-HU')} vendég` : 'nincs jogosultság', bookings: v.preset === 2 ? 'minden foglalás' : 'az időszak foglalásai' }} />
    </Popup>
  )
}
