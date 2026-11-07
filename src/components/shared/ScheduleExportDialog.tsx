'use client'

import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { Avatar, Button, Checkbox, Meta, Modal, Pill } from '@/components/ui-kit'
import { PeriodPicker } from '@/components/blocks/calendar'
import { Popup } from './Popup'
import { addDays, shiftHours, TYPE_LABEL, type ShiftType, type ShiftVM } from '@/lib/schedule'
import { ymdLocal } from '@/lib/utils'
import { saveFile, toCsv } from '@/lib/csv'

/**
 * A Naptár export-ablaka — ugyanaz a felépítés, mint a közös export (Vendégek / Foglalások, design 7.6): időszak
 * (gyors-gomb vagy Egyedi a naptárban), kinek, milyen típus, mely mezők; a gombon a letöltendő sorok száma.
 * A beosztás már be van töltve az oldalon, így a CSV itt készül; telefonon a megosztás-lappal menti (`saveFile`).
 */
const FIELDS: [string, string][] = [['date', 'Dátum'], ['staff', 'Munkatárs'], ['type', 'Típus'], ['start', 'Kezdés'], ['end', 'Vége'], ['hours', 'Óra'], ['note', 'Megjegyzés']]
const TYPES: ('all' | ShiftType)[] = ['all', 'shift', 'leave', 'sick', 'vacation']

export function ScheduleExportDialog({ shifts, staff, month, selected = null, canManage = true, onClose }: {
  shifts: ShiftVM[]
  staff: { id: string; name: string; avatarUrl?: string | null }[]
  /** a nézett hónap (`YYYY-MM`) — ez az alap időszak */
  month: string
  /** a nézetben kiválasztott munkatárs (alapból őt exportáljuk) */
  selected?: string | null
  canManage?: boolean
  onClose: () => void
}) {
  const today = ymdLocal(new Date())
  const monthRange = (): [string, string] => { const [y, m] = month.split('-').map(Number); return [`${month}-01`, ymdLocal(new Date(y, m, 0))] }
  const presetRange = (i: number): [string, string] => (i === 0 ? monthRange() : i === 1 ? [addDays(today, -29), today] : [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`])
  const [preset, setPreset] = useState(0)
  const [[from, to], setRange] = useState<[string, string]>(monthRange)
  const [pickEnd, setPickEnd] = useState(false)
  const [who, setWho] = useState<string | null>(selected)
  const [type, setType] = useState<'all' | ShiftType>('all')
  const [fields, setFields] = useState<string[]>(FIELDS.map(([k]) => k).filter((k) => k !== 'note'))
  const [busy, setBusy] = useState(false)

  const nameOf = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])
  const rows = useMemo(() => shifts
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to) && (!who || s.staffId === who) && (type === 'all' || s.type === type))
    .sort((a, b) => a.date.localeCompare(b.date) || (nameOf.get(a.staffId) ?? '').localeCompare(nameOf.get(b.staffId) ?? '', 'hu')),
  [shifts, from, to, who, type, nameOf])

  const onPreset = (i: number) => { setPreset(i); setPickEnd(false); if (i !== 3) setRange(presetRange(i)) }
  const onPick = (d: string) => {
    if (!pickEnd || preset !== 3) { setPreset(3); setRange([d, d]); setPickEnd(true); return }
    setRange(d < from ? [d, from] : [from, d])
    setPickEnd(false)
  }

  const download = async () => {
    setBusy(true)
    const val = (s: ShiftVM, k: string) => (k === 'date' ? s.date : k === 'staff' ? nameOf.get(s.staffId) ?? '' : k === 'type' ? TYPE_LABEL[s.type] : k === 'start' ? s.start_time : k === 'end' ? s.end_time : k === 'hours' ? Math.round(shiftHours(s) * 10) / 10 : s.note === '__auto__' ? '' : s.note)
    const picked = FIELDS.filter(([k]) => fields.includes(k))
    const csv = toCsv(picked.map(([, l]) => l), rows.map((s) => picked.map(([k]) => val(s, k) ?? '')))
    await saveFile(`naptar-${from}_${to}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    setBusy(false)
    onClose()
  }

  return (
    <Popup onClose={onClose}>
      <Modal size="sm" title="Export" subtitle="CSV — Excelben, Google Táblázatban megnyitható" onClose={onClose}>
        <Meta>Időszak</Meta>
        <PeriodPicker presets={['Ez a hónap', '30 nap', 'Év', 'Egyedi']} active={preset} live={{ from, to, onPick, onPreset }} className="mt-1.5" />
        {canManage && staff.length > 1 && (
          <>
            <Meta className="mt-3">Munkatárs</Meta>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setWho(null)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={who ? 'cell' : 'dark'}>Mind</Pill></button>
              {staff.map((st) => (
                <button key={st.id} type="button" title={st.name} aria-label={st.name} aria-pressed={who === st.id} onClick={() => setWho(st.id)} className={`rounded-full outline-none ${who === st.id ? 'ring-2 ring-ui-dark ring-offset-2' : ''}`}><Avatar size="sm" src={st.avatarUrl ?? null} name={st.name} /></button>
              ))}
            </div>
          </>
        )}
        <Meta className="mt-3">Típus</Meta>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={type === t ? 'dark' : 'cell'}>{t === 'all' ? 'Mind' : TYPE_LABEL[t]}</Pill></button>
          ))}
        </div>
        <Meta className="mt-3">Mezők</Meta>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2">
          {FIELDS.map(([k, l]) => <Checkbox key={k} label={l} checked={fields.includes(k)} onChange={() => setFields((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]))} />)}
        </div>
        <Button className="mt-4 w-full" icon={FileText} onClick={download} loading={busy} disabled={!rows.length || !fields.length}>{`CSV letöltése · ${rows.length.toLocaleString('hu-HU')} sor`}</Button>
      </Modal>
    </Popup>
  )
}
