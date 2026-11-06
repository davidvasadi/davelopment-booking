'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button, FIELD, Field, FieldRow, Input, Modal, Segmented } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { TimeSelect } from '@/components/ui/time-select'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { HoursExceptionsCard, OccupancyCard, OpeningHoursCard, type HoursRow } from '@/components/blocks/settings'
import { MONTHS_SHORT } from '@/lib/schedule'
import { nextHuHolidays } from '@/lib/huHolidays'
import type { HoursDay, HoursException, OpeningHoursVM } from '@/lib/openingHours'

/**
 * Beállítások › Nyitvatartás (design 16.8) — szalon és étterem: a heti rend (egy napra kattintva szerkeszthető: nyitva /
 * zárva, nyitás, zárás), az e heti foglaltság, és a kivételek (ünnep, szabadság, rövidített nap — étteremnél dátum-
 * tartomány megnevezéssel). Minden módosítás azonnal mentődik (a régi Nyitvatartás oldal végpontjain).
 */

const DAY_NAMES = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
const SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const WK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const hours = (t: string) => { const [h, m] = t.split(':').map(Number); const v = (h || 0) + (m || 0) / 60; return v === 0 ? 24 : v }
const dLabel = (d: string) => { const x = new Date(`${d}T12:00:00`); return `${MONTHS_SHORT[x.getMonth()]} ${x.getDate()}.` }
const range = (e: HoursException) => {
  const days = e.from === e.to ? dLabel(e.from) : `${dLabel(e.from)}–${new Date(`${e.from}T12:00:00`).getMonth() === new Date(`${e.to}T12:00:00`).getMonth() ? new Date(`${e.to}T12:00:00`).getDate() + '.' : dLabel(e.to)}`
  return e.closed ? days : `${days} · ${e.openTime ?? ''}–${e.closeTime ?? ''}`
}

type ExcDraft = { id: string | null; label: string; from: string; to: string; closed: boolean; openTime: string; closeTime: string }

export function OpeningHoursView({ vm, canManage = false }: { vm: OpeningHoursVM; canManage?: boolean }) {
  const router = useRouter()
  const salon = vm.kind === 'salon'
  const [days, setDays] = useState<HoursDay[]>(vm.days)
  const [exceptions, setExceptions] = useState<HoursException[]>(vm.exceptions)
  const [edit, setEdit] = useState<{ i: number; d: HoursDay } | null>(null)
  const [exc, setExc] = useState<ExcDraft | null>(null)
  const [busy, setBusy] = useState(false)
  // a kártya alja (design 16.8): utolsó foglalható időpont, munkaszüneti napokon zárva — azonnal mentődik
  const [lastBuffer, setLastBuffer] = useState(vm.lastBuffer)
  const patchBiz = async (body: Record<string, unknown>, ok: string) => {
    const res = await fetch(salon ? '/api/salon/settings' : '/api/restaurant/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).catch(() => null)
    if (!res?.ok) { toast.error('A mentés nem sikerült'); return false }
    toast.success(ok); router.refresh(); return true
  }
  const LAST = lastBuffer && ![0, 30, 60, 90].includes(lastBuffer) ? [0, 30, 60, 90, lastBuffer].sort((a, b) => a - b) : [0, 30, 60, 90]
  // a következő munkaszüneti napok — csak jelezzük (nem zárunk automatikusan); amelyikre már van kivétel, azt nem
  const upcoming = nextHuHolidays(new Date().toISOString().slice(0, 10), 6).filter((h) => !exceptions.some((e) => h.date >= e.from && h.date <= e.to)).slice(0, 3)

  const rows: HoursRow[] = days.map((d, i) => (d.open ? { d: SHORT[i], from: hours(d.from) === 24 ? 0 : hours(d.from), to: hours(d.to) } : { d: SHORT[i], closed: true }))

  // ── a heti rend egy napja ──
  const saveDay = async () => {
    if (!edit) return
    const d = edit.d
    setBusy(true)
    try {
      const body = salon
        ? { salon: vm.businessId, day_of_week: d.dow, is_available: d.open, start_time: d.from, end_time: d.to, recurring: true }
        : { restaurant: vm.businessId, day_of_week: d.dow, is_open: d.open, open_time: d.from, close_time: d.to }
      const base = salon ? '/api/availability' : '/api/opening-hours'
      const res = await fetch(d.id ? `${base}/${d.id}` : base, { method: d.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const j = await res.json().catch(() => ({}))
      setDays((cur) => cur.map((x, i) => (i === edit.i ? { ...d, id: d.id ?? (j.doc?.id != null ? String(j.doc.id) : null) } : x)))
      setEdit(null); toast.success(`${DAY_NAMES[edit.i]} mentve`); router.refresh()
    } catch { toast.error('A mentés nem sikerült') } finally { setBusy(false) }
  }

  // ── kivétel ──
  const openExc = (e?: HoursException) => {
    const today = new Date(); const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setExc(e ? { id: e.id, label: e.label ?? '', from: e.from, to: e.to, closed: e.closed, openTime: e.openTime ?? '09:00', closeTime: e.closeTime ?? '13:00' } : { id: null, label: '', from: t, to: t, closed: true, openTime: '09:00', closeTime: '13:00' })
  }
  // ünnepnapból új kivétel: a nap és (étteremnél) a megnevezés előre kitöltve, alapból zárva — mentés csak, ha te úgy döntesz
  const openHoliday = (h: { date: string; label: string }) => setExc({ id: null, label: h.label, from: h.date, to: h.date, closed: true, openTime: '09:00', closeTime: '13:00' })
  const saveExc = async () => {
    if (!exc) return
    if (exc.to < exc.from) { toast.error('A vége nem lehet korábban, mint a kezdete'); return }
    setBusy(true)
    try {
      const base = salon ? '/api/availability' : '/api/opening-hours-exceptions'
      const body = salon
        ? { salon: Number(vm.businessId), day_of_week: WK[new Date(`${exc.from}T12:00:00`).getDay()], recurring: false, exception_date: exc.from, is_available: !exc.closed, start_time: exc.closed ? '00:00' : exc.openTime, end_time: exc.closed ? '00:00' : exc.closeTime }
        : { restaurant: Number(vm.businessId), label: exc.label.trim() || null, start_date: exc.from, end_date: exc.to, is_closed: exc.closed, open_time: exc.closed ? undefined : exc.openTime, close_time: exc.closed ? undefined : exc.closeTime }
      const res = await fetch(exc.id ? `${base}/${exc.id}` : base, { method: exc.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const j = await res.json().catch(() => ({}))
      const saved: HoursException = { id: exc.id ?? String(j.doc?.id ?? Date.now()), label: salon ? null : exc.label.trim() || null, from: exc.from, to: salon ? exc.from : exc.to, closed: exc.closed, openTime: exc.closed ? null : exc.openTime, closeTime: exc.closed ? null : exc.closeTime }
      setExceptions((cur) => [...cur.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.from.localeCompare(b.from)))
      setExc(null); toast.success('Kivétel mentve'); router.refresh()
    } catch { toast.error('A mentés nem sikerült') } finally { setBusy(false) }
  }
  const removeExc = async () => {
    if (!exc?.id) return
    setBusy(true)
    const res = await fetch(`${salon ? '/api/availability' : '/api/opening-hours-exceptions'}/${exc.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { toast.error('A törlés nem sikerült'); return }
    setExceptions((cur) => cur.filter((x) => x.id !== exc.id)); setExc(null); toast.success('Kivétel törölve'); router.refresh()
  }
  const date = (v: string, set: (d: string) => void) => (
    <DatePickerPopover value={v} onChange={set} triggerClassName={`${FIELD} h-9 w-full text-left`}>{dLabel(v)}</DatePickerPopover>
  )

  return (
    <div className="grid gap-[5px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <OpeningHoursCard rows={rows} scope={false} onDay={canManage ? (i) => setEdit({ i, d: { ...days[i] } }) : undefined}
        footer={[
          ['Utolsó foglalható időpont', <Segmented key="l" tone="cell" size="sm" options={LAST.map((m) => (m ? `${m} p` : 'Zárásig'))} active={LAST.indexOf(lastBuffer)}
            onSelect={canManage ? (i) => { const v = LAST[i]; const prev = lastBuffer; setLastBuffer(v); void patchBiz(salon ? { last_booking_buffer_minutes: v } : { last_seating_buffer_minutes: v }, 'Mentve').then((ok) => { if (!ok) setLastBuffer(prev) }) } : undefined} />] as [string, React.ReactNode],
          ...(vm.bufferMinutes != null ? [['Szünet két foglalás közt', <span key="b" className="text-ui-body text-ui-text">{vm.bufferMinutes} perc</span>] as [string, React.ReactNode]] : []),
          ['Heti összesen', null],
        ]} />
      <div className="flex flex-col gap-[5px] [&>*:last-child]:flex-1">
        <OccupancyCard pct={vm.occupancy.pct} perDay={vm.occupancy.perDay} />
        <HoursExceptionsCard onAdd={canManage ? () => openExc() : undefined} onOpen={canManage ? (k) => { if (k.startsWith('hol:')) { const h = upcoming.find((x) => `hol:${x.date}` === k); if (h) openHoliday(h) } else openExc(exceptions.find((e) => e.id === k)) } : undefined}
          items={[
            ...exceptions.map((e) => ({ key: e.id, tone: e.closed ? 'closed' as const : 'short' as const, title: e.label ?? (e.closed ? 'Zárva' : 'Rövidített nap'), range: range(e) })),
            // a következő munkaszüneti napok jelzésként — rákattintva új kivétel nyílik erre a napra, te döntöd el, mi legyen
            ...upcoming.map((h) => ({ key: `hol:${h.date}`, tone: 'short' as const, title: `${h.label} · ünnepnap — mi legyen?`, range: dLabel(h.date) })),
          ]} />
      </div>

      <PopupModal open={!!edit} onClose={() => setEdit(null)} panel={edit ? (
        <Modal size="sm" title={DAY_NAMES[edit.i]} subtitle="Heti nyitvatartás — minden ilyen napra érvényes" onClose={() => setEdit(null)}
          footer={<><Button variant="cell" onClick={() => setEdit(null)}>Mégse</Button><Button loading={busy} onClick={() => void saveDay()}>Mentés</Button></>}>
          <FieldRow label="Ezen a napon"><Segmented tone="cell" size="sm" options={['Nyitva', 'Zárva']} active={edit.d.open ? 0 : 1} onSelect={(i) => setEdit({ ...edit, d: { ...edit.d, open: i === 0 } })} /></FieldRow>
          {edit.d.open && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Nyitás"><TimeSelect value={edit.d.from} onChange={(v) => setEdit({ ...edit, d: { ...edit.d, from: v } })} /></Field>
              <Field label="Zárás"><TimeSelect value={edit.d.to} onChange={(v) => setEdit({ ...edit, d: { ...edit.d, to: v } })} /></Field>
            </div>
          )}
        </Modal>
      ) : undefined} />

      <PopupModal open={!!exc} onClose={() => setExc(null)} panel={exc ? (
        <Modal size="sm" title={exc.id ? 'Kivétel' : 'Új kivétel'} subtitle="Ünnep, szabadság vagy rövidített nap — a foglalóoldal ehhez igazodik" onClose={() => setExc(null)}
          footer={<>{exc.id && <Button variant="ghost" icon={Trash2} className="mr-auto text-ui-bad" onClick={() => void removeExc()}>Törlés</Button>}<Button variant="cell" onClick={() => setExc(null)}>Mégse</Button><Button loading={busy} onClick={() => void saveExc()}>Mentés</Button></>}>
          {!salon && <Field label="Megnevezés" className="mb-3"><Input size="sm" value={exc.label} onChange={(e) => setExc({ ...exc, label: e.target.value })} placeholder="pl. Karácsony, Csapat-szabadság" /></Field>}
          <div className={`grid gap-2 ${salon ? '' : 'grid-cols-2'}`}>
            <Field label={salon ? 'Nap' : 'Ettől'}>{date(exc.from, (d) => setExc({ ...exc, from: d, to: salon || exc.to < d ? d : exc.to }))}</Field>
            {!salon && <Field label="Eddig">{date(exc.to, (d) => setExc({ ...exc, to: d }))}</Field>}
          </div>
          <FieldRow label="Aznap" className="mt-3"><Segmented tone="cell" size="sm" options={['Zárva', 'Rövidített']} active={exc.closed ? 0 : 1} onSelect={(i) => setExc({ ...exc, closed: i === 0 })} /></FieldRow>
          {!exc.closed && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="Nyitás"><TimeSelect value={exc.openTime} onChange={(v) => setExc({ ...exc, openTime: v })} /></Field>
              <Field label="Zárás"><TimeSelect value={exc.closeTime} onChange={(v) => setExc({ ...exc, closeTime: v })} /></Field>
            </div>
          )}
        </Modal>
      ) : undefined} />
    </div>
  )
}
