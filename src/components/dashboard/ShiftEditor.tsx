'use client'

/**
 * A Naptár szerkesztő-ablakai (design 11.5 / 11.6) élő adattal — a megjelenés a `blocks/calendar` DayEditor és
 * NewShiftForm eleme, itt csak az állapot és a mentés. Desktopon középen nyílnak, mobilon alulról (fogantyúval).
 */

import { useEffect, useRef, useState } from 'react'
import { DayEditor, NewShiftForm, SickNoteFile, type DayEditorValue, type NewShiftValue, type ShiftPreviewRow } from '@/components/blocks/calendar'
import { Button, FIELD, FieldRow, IconButton, Input, Note, Panel, SheetHandle } from '@/components/ui-kit'
import { TimeSelect } from '@/components/ui/time-select'
import { Plus, X } from 'lucide-react'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DAY_NAMES, MONTHS_SHORT, addDays, diffHours, mondayOf, pad, toDate, ymdOf, type ShiftInput, type ShiftType, type ShiftVM, type StaffVM } from '@/lib/schedule'

const TYPES: ShiftType[] = ['shift', 'leave', 'sick', 'vacation']
const dayLabel = (s: string) => { const d = toDate(s); return `${DAY_NAMES[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.` }
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000) + 1
const fmtH = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} óra`
/** „12:30–13:00, 15:00–15:15” → szünetek; a hibás részt kihagyja. */
function parseBreaks(s: string) {
  return s.split(',').map((x) => x.trim().match(/^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$/)).filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ start_time: `${pad(Number(m[1]))}:${m[2]}`, end_time: `${pad(Number(m[3]))}:${m[4]}` }))
}
/** „9”, „9:5”, „0930” → „09:00” / „09:05” / „09:30”; érvénytelen → null. */
function normTime(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})(?::?(\d{1,2}))?$/)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2] ?? 0)
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null
}
const breaksText = (b: { start_time?: string | null; end_time?: string | null }[]) => b.filter((x) => x.start_time && x.end_time).map((x) => `${x.start_time}–${x.end_time}`).join(', ')

/** Dátum-mező a kit felugró naptárával — a mezőben „Nov. 10.” (mint a designban), nem a böngésző saját mezője. */
function dateInput(width: string) {
  return function DateField(_k: 'from' | 'to', value: string, set: (v: string) => void) {
    const d = value ? toDate(value) : null
    return (
      <DatePickerPopover value={value} onChange={set} triggerClassName={`${FIELD} h-9 ${width} text-left`}>
        {d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.` : '—'}
      </DatePickerPopover>
    )
  }
}

/** Idő-mező a kit időválasztójával (görgethető óra / perc), nem a böngésző saját mezője. */
function timeInput(_k: 'start' | 'end', value: string, set: (v: string) => void) {
  return <TimeSelect value={value} onChange={set} />
}

/** Szünet(ek) a kit időválasztójával: kezdés–vége párok, törölhetők; „+ Szünet” újat ad. Az érték a régi szöveges alak
 *  („12:30–13:00, 15:00–15:15”), így a mentés változatlan. */
function breaksInput(value: string, set: (v: string) => void) {
  const list = parseBreaks(value)
  const write = (l: { start_time: string; end_time: string }[]) => set(l.map((b) => `${b.start_time}–${b.end_time}`).join(', '))
  return (
    <span className="flex flex-col items-end gap-1.5">
      {list.map((b, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="block w-[90px]"><TimeSelect value={b.start_time} onChange={(t) => write(list.map((x, j) => (j === i ? { ...x, start_time: t } : x)))} /></span>
          <span className="text-ui-muted">–</span>
          <span className="block w-[90px]"><TimeSelect value={b.end_time} onChange={(t) => write(list.map((x, j) => (j === i ? { ...x, end_time: t } : x)))} /></span>
          <IconButton icon={X} label="Szünet törlése" variant="cell" size="sm" onClick={() => write(list.filter((_, j) => j !== i))} />
        </span>
      ))}
      <Button variant="ghost" size="sm" icon={Plus} onClick={() => write([...list, { start_time: '12:00', end_time: '12:30' }])}>{list.length ? 'Még egy szünet' : 'Szünet'}</Button>
    </span>
  )
}

/** Középre nyíló ablak (desktop) / alulról felcsúszó lap fogantyúval (mobil) — mint a kit megerősítő ablaka. */
function Sheet({ onClose, wide = false, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  // az egységes felugró ablak (háttér, animáció, mobilon alsó lap) — benne a kit lapja
  return (
    <PopupModal open onClose={onClose} panel={
      <div role="dialog" aria-modal="true" className={`max-h-[92dvh] w-full overflow-y-auto ${wide ? 'sm:w-[920px] sm:max-w-[calc(100vw-2rem)]' : 'sm:w-[520px] sm:max-w-[calc(100vw-2rem)]'}`} data-lenis-prevent>
        <Panel pad="lg" className="max-sm:rounded-b-none max-sm:pt-3">
          <SheetHandle className="pb-3 sm:hidden" />
          {children}
        </Panel>
      </div>
    } />
  )
}

export type SaveRange = (staffId: string, p: ShiftInput, from: string, to: string, opts?: { days?: number[]; keepAbsences?: boolean; paid?: boolean }) => Promise<{ id: string; date: string }[] | null>

/** Nap-szerkesztő (design 11.5) egy munkatárs egy napjára — csapat-nézetből nyitva a munkatárs is itt választható. */
export function ShiftEditor({ date, staffId: initialStaff, staff, shifts, isRestaurant, closed = false, busy, dayTip, onSaveTips, onAdd, onRange, onEdit, onDelete, onUploadNote, onDeleteNote, onClose }: {
  date: string
  staffId: string | null
  staff: StaffVM[]
  shifts: ShiftVM[]
  isRestaurant: boolean
  /** a nap zárva van (a nyitvatartásból) — műszak nem adható, csak távollét */
  closed?: boolean
  busy: boolean
  dayTip: number
  onSaveTips: (amount: number) => Promise<boolean>
  onAdd: (staffId: string, p: ShiftInput, date: string, paid?: boolean) => Promise<string | null>
  onRange: SaveRange
  onEdit: (id: string, p: ShiftInput, paid?: boolean) => Promise<boolean>
  onDelete: (s: ShiftVM) => Promise<void>
  onUploadNote: (shiftId: string, file: File) => Promise<boolean>
  onDeleteNote: (shiftId: string) => Promise<boolean>
  onClose: () => void
}) {
  const [staffId, setStaffId] = useState<string | null>(initialStaff)
  const existing = staffId ? shifts.find((s) => s.staffId === staffId && s.date === date) ?? null : null
  const person = staffId ? staff.find((s) => s.id === staffId) ?? null : null
  const initial = (ex: ShiftVM | null): DayEditorValue => ({
    type: ex ? TYPES.indexOf(ex.type) : 0,
    start: ex?.start_time ?? '09:00', end: ex?.end_time ?? '17:00', breaks: breaksText(ex?.breaks ?? []), repeat: false,
    from: date, to: date, paid: ex?.paid ?? false, note: ex?.note && ex.note !== '__auto__' ? ex.note : '',
  })
  const [v, setV] = useState<DayEditorValue>(() => initial(existing))
  // másik munkatársra váltva az ő napja töltődik be
  useEffect(() => { setV(initial(existing)) }, [staffId]) // eslint-disable-line react-hooks/exhaustive-deps
  // a korábbi „hazament” időpont megmarad (a szerkesztőben nincs mezője)
  const leftAt = existing?.left_early_at ?? ''
  const [tip, setTip] = useState(dayTip > 0 ? String(dayTip) : '')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [noteBusy, setNoteBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // a munkatárs foglalásai az érintett napokon (szalon) — „ezen a napon 3 foglalása van”
  const [bookings, setBookings] = useState<number | null>(null)
  const [firstBooking, setFirstBooking] = useState<{ id: string; date: string } | null>(null)
  const from = v.type === 0 ? date : v.from || date
  const to = v.type === 0 ? date : v.to || from
  useEffect(() => {
    setBookings(null)
    setFirstBooking(null)
    if (isRestaurant || !staffId || to < from) return
    const ctrl = new AbortController()
    fetch(`/api/shifts/bookings-count?staff=${staffId}&from=${from}&to=${to}`, { credentials: 'include', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && typeof j.count === 'number') { setBookings(j.count); setFirstBooking(j.first ?? null) } }).catch(() => {})
    return () => ctrl.abort()
  }, [isRestaurant, staffId, from, to])

  const type = TYPES[v.type]
  const hours = type === 'shift' ? diffHours(v.start, leftAt || v.end) ?? 0 : 0
  const breakMin = parseBreaks(v.breaks).reduce((a, b) => a + (diffHours(b.start_time, b.end_time) ?? 0), 0)
  const nDays = to >= from ? daysBetween(from, to) : 0
  // éves szabadság-keret: az idei (fizetett) szabadság-napok, a mostani nélkül
  const year = date.slice(0, 4)
  const usedLeave = staffId ? shifts.filter((s) => s.staffId === staffId && s.type === 'leave' && s.date.startsWith(year) && !(s.date >= from && s.date <= to)).length : 0
  const keret = person?.annual_leave_days
  const leaveHint = keret != null ? `Éves keret: ${keret} nap · ezzel ${Math.max(0, keret - usedLeave - (v.type === 1 ? nDays : 0))} marad` : undefined
  // az érintett (legelső) foglalás nyílik meg a napján; ha még nem tudjuk, a nap / hét
  const bookingsLink = firstBooking
    ? `${isRestaurant ? '/restaurant' : '/dashboard'}/bookings?date=${firstBooking.date}&range=day&booking=${firstBooking.id}`
    : `${isRestaurant ? '/restaurant' : '/dashboard'}/bookings?date=${from}&range=${nDays > 1 ? 'week' : 'day'}`
  const warn = closed && type === 'shift' ? <Note warn className="mt-2">Ezen a napon zárva vagytok (a nyitvatartás szerint) — műszak nem adható.{existing?.type === 'shift' ? ' A meglévő műszakot töröld vagy állítsd át.' : ''}</Note> : bookings ? <Note warn className="mt-2">{nDays} nap · erre az időre {bookings} foglalása van — áthelyezed őket? <a href={bookingsLink} className="whitespace-nowrap underline underline-offset-4">Foglalások áthelyezése</a></Note> : null

  const input = (): ShiftInput => ({
    type, start_time: v.start, end_time: v.end, breaks: type === 'shift' ? parseBreaks(v.breaks) : [], note: v.note,
    left_early_at: type === 'shift' && leftAt ? leftAt : null, left_early_reason: type === 'shift' && leftAt ? 'personal' : null,
  })
  async function save() {
    if (!staffId) { alert('Válaszd ki, kinek szól a bejegyzés.'); return }
    if (type === 'shift') {
      const a = normTime(v.start), b = normTime(v.end)
      if (!a || !b || b <= a) { alert('Adj meg érvényes kezdést és véget (pl. 09:00 és 17:00).'); return }
      v.start = a; v.end = b
    }
    const p = input()
    let ok = false
    let noteTarget: string | null = existing?.id ?? null
    if (type !== 'shift' && from !== to) {
      const res = await onRange(staffId, p, from, to, { paid: v.paid })
      ok = !!res
      noteTarget = res?.[0]?.id ?? null
    } else if (existing && existing.date === from) {
      ok = await onEdit(existing.id, p, v.paid)
    } else {
      const id = await onAdd(staffId, p, from, v.paid)
      ok = !!id
      noteTarget = id
    }
    // minden munkanapján: a többi (későbbi) műszakja is ezt az időt és szünetet kapja — a napi megjegyzés marad
    if (ok && type === 'shift' && v.repeat) {
      for (const s of shifts.filter((x) => x.staffId === staffId && x.type === 'shift' && x.date > date)) {
        if (s.start_time === p.start_time && s.end_time === p.end_time && breaksText(s.breaks) === breaksText(p.breaks)) continue
        await onEdit(s.id, { ...p, note: s.note && s.note !== '__auto__' ? s.note : '', left_early_at: null, left_early_reason: null }, s.paid)
      }
    }
    if (ok && isRestaurant && Number(tip || 0) !== dayTip) await onSaveTips(Number(tip || 0))
    if (ok && pendingFile && noteTarget) await onUploadNote(noteTarget, pendingFile)
    if (ok) onClose()
  }

  const file = existing?.sickNote
    ? <SickNoteFile className="w-full" name={existing.sickNote.filename} meta={`Orvosi igazolás${existing.sickNote.filesize ? ` · ${Math.max(1, Math.round(existing.sickNote.filesize / 1024))} KB` : ''}`} href={`/api/shifts/${existing.id}/sick-note`} busy={noteBusy} onDelete={async () => { setNoteBusy(true); await onDeleteNote(existing.id); setNoteBusy(false) }} />
    : pendingFile
      ? <SickNoteFile className="w-full" name={pendingFile.name} meta="Mentéskor feltöltjük" onDelete={() => setPendingFile(null)} />
      : <SickNoteFile className="w-full" name={null} busy={noteBusy} onUpload={async (f) => {
          if (existing && type === 'sick') { setNoteBusy(true); await onUploadNote(existing.id, f); setNoteBusy(false) } else setPendingFile(f)
        }} />

  return (
    <Sheet onClose={onClose}>
      <DayEditor
        bare
        person={person ? { name: person.name, img: person.avatarUrl } : null}
        dateLabel={dayLabel(date)}
        people={initialStaff ? undefined : staff.map((s) => ({ id: s.id, name: s.name, img: s.avatarUrl, disabled: s.pending, title: s.pending ? 'Még nem fogadta el a meghívást — addig nem osztható be' : undefined }))}
        personId={staffId}
        onPerson={setStaffId}
        value={v}
        onChange={setV}
        shiftHint={`${fmtH(Math.max(0, hours - breakMin))}${bookings != null ? ` · ezen a napon ${bookings} foglalása van` : ''}`}
        leaveHint={leaveHint}
        warn={warn}
        file={file}
        dateInput={dateInput('w-[220px] max-w-full')}
        timeInput={timeInput}
        breaksInput={breaksInput}
        extra={<>
          {/* étteremnél a napi borravaló */}
          {isRestaurant && <FieldRow label="Napi borravaló (Ft)" hint="Az aznap dolgozó jogosultak közt oszlik el"><Input size="sm" type="number" min={0} value={tip} onChange={(e) => setTip(e.target.value)} className="w-[220px] max-w-full" /></FieldRow>}
        </>}
        onSave={save}
        onCancel={onClose}
        onDelete={existing ? () => setConfirmDelete(true) : undefined}
        busy={busy}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Bejegyzés törlése"
        description={existing && person ? `${person.name} · ${dayLabel(existing.date)}` : undefined}
        confirmLabel="Törlés"
        busy={busy}
        onConfirm={async () => { if (existing) await onDelete(existing); setConfirmDelete(false); onClose() }}
        onCancel={() => setConfirmDelete(false)}
        zIndexClass="z-[95]"
      />
    </Sheet>
  )
}

type Template = { id: string; name: string; start_time?: string | null; end_time?: string | null; breaks?: { start_time: string; end_time: string }[] | null; days?: number[] | null; people?: string[] | null }

/** „+ Beosztás” (design 11.6): több emberre, több napra; gyors indítás (előző hét másolása, mentett sablon); élő előnézet
 *  a hét első napjára; a meglévő szabadság / beteg nap kimarad. */
export function NewShiftModal({ date, prefillDay, prefillRange, templateId, staff, shifts, bizKey, bizId, isClosed = () => false, busy, onRange, onDelete, onClose }: {
  date: string
  /** egy nap szerkesztése: az aznap dolgozók kijelölve, az időszak az a nap, az idő / szünet az aznapi */
  prefillDay?: string
  /** egy ember több napos műszak-sávja (a hónap-nézetben rá kattintva): ő kijelölve, az időszak a sáv, az idő az övé */
  prefillRange?: { staffId: string; from: string; to: string }
  /** ezzel a mentett sablonnal kitöltve nyílik (a Naptár üres állapotából) */
  templateId?: string
  staff: StaffVM[]
  shifts: ShiftVM[]
  bizKey: 'salon' | 'restaurant'
  bizId?: string
  /** zárt nap (a nyitvatartásból): ide nem kerül műszak, az előnézetben csíkos */
  isClosed?: (d: string) => boolean
  busy: boolean
  onRange: SaveRange
  /** nap-szerkesztésnél: akinél leveszed a pipát, annak az aznapi műszakja törlődik */
  onDelete?: (s: ShiftVM) => Promise<void>
  onClose: () => void
}) {
  // alapból a következő hét hétfőjétől a hónap végéig, hétköznapokon
  const mon = (() => { const d = toDate(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7); return ymdOf(d) })()
  const monthEnd = (() => { const d = toDate(mon); return ymdOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)) })()
  const [v, setVRaw] = useState<NewShiftValue>(() => {
    if (prefillRange) {
      const own = shifts.filter((s) => s.staffId === prefillRange.staffId && s.type === 'shift' && s.date >= prefillRange.from && s.date <= prefillRange.to)
      const ref = own[0]
      const dows = new Set(own.map((s) => (toDate(s.date).getDay() + 6) % 7))
      return { people: [prefillRange.staffId], from: prefillRange.from, to: prefillRange.to, days: [0, 1, 2, 3, 4, 5, 6].map((i) => dows.has(i)), start: ref?.start_time ?? '09:00', end: ref?.end_time ?? '17:00', breaks: breaksText(ref?.breaks ?? []), template: false }
    }
    if (!prefillDay) return { people: [], from: mon, to: monthEnd, days: [true, true, true, true, true, false, false], start: '09:00', end: '17:00', breaks: '', template: false }
    const day = shifts.filter((s) => s.date === prefillDay && s.type === 'shift')
    // a leggyakoribb aznapi idő (ha mindenki 9–17, az)
    const top = [...day.reduce((m, s) => m.set(`${s.start_time}|${s.end_time}`, (m.get(`${s.start_time}|${s.end_time}`) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0]
    const ref = day.find((s) => `${s.start_time}|${s.end_time}` === top)
    const dow = (toDate(prefillDay).getDay() + 6) % 7
    return { people: day.map((s) => s.staffId), from: prefillDay, to: prefillDay, days: [0, 1, 2, 3, 4, 5, 6].map((i) => i === dow), start: ref?.start_time ?? '09:00', end: ref?.end_time ?? '17:00', breaks: breaksText(ref?.breaks ?? []), template: false }
  })
  const [copyWeek, setCopyWeek] = useState(false)
  // a bal oldali „Napok” az egész időszak szabálya; az előnézetben egy napra kattintva csak AZ AZ EGY DÁTUM vált annál az
  // embernél (`${sid}|${dátum}`): on = ott is legyen műszak, off = ott ne legyen (időszakon kívül: a meglévő törlődik)
  const [extra, setExtra] = useState<Record<string, 'on' | 'off'>>({})
  const inPeriod = (d: string) => !!v.from && !!v.to && d >= v.from && d <= v.to
  const hasShift = (sid: string, d: string) => shifts.find((s) => s.staffId === sid && s.date === d && s.type === 'shift')
  // az épp hozzáadott ember ütköző napjai megrezegnek (az előnézetben)
  const [shake, setShake] = useState<{ row: string; n: number } | null>(null)
  const setV = (next: NewShiftValue) => {
    const changed = next.days.map((x, i) => x !== v.days[i])
    // ha az előnézet épp az időszakon kívüli hetet mutatja (ott csak a meglévő beosztás látszik), az időszak első hetére ugrik
    if (changed.some(Boolean) && (week[6] < next.from || week[0] > next.to)) setWeekOffset(0)
    const added = next.people.find((p) => !v.people.includes(p))
    if (added) {
      setShake((cur) => ({ row: added, n: (cur?.n ?? 0) + 1 }))
      // az első ütköző nap hetére ugrik, hogy a rezgés látsszon
      const hit = datesOf(added).find((d) => absent(added, d))
      if (hit) setWeekOffset(Math.max(0, Math.round((toDate(mondayOf(hit)).getTime() - toDate(firstWeek).getTime()) / (7 * 86_400_000))))
    }
    setVRaw(next)
  }
  const [templates, setTemplates] = useState<Template[]>([])
  // kilépés módosítás után: megerősítés, mint a foglalás-szerkesztőben („Elveted a módosításokat?”)
  const baseline = useRef<string | null>(null)
  useEffect(() => { if (baseline.current === null) baseline.current = JSON.stringify(v) }, [v])
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const applyTemplate = (t: Template) => { setCopyWeek(false); setVRaw((cur) => ({ ...cur, start: t.start_time ?? cur.start, end: t.end_time ?? cur.end, breaks: breaksText(t.breaks ?? []), days: [1, 2, 3, 4, 5, 6, 0].map((d) => (t.days ?? []).includes(d)), people: (t.people ?? []).filter((id) => staff.some((s) => s.id === id)) })) }
  const [delTpl, setDelTpl] = useState<Template | null>(null)
  const [tplBusy, setTplBusy] = useState(false)
  const [stacked, setStacked] = useState(false)
  useEffect(() => { setStacked(window.matchMedia('(max-width: 1023px)').matches) }, [])
  useEffect(() => {
    if (!bizId) return
    fetch(`/api/shift-templates?${bizKey}=${bizId}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j?.templates) return
      setTemplates(j.templates)
      const t = templateId ? (j.templates as Template[]).find((x) => x.id === templateId) : null
      // a megnyitáskor betöltött sablon még nem „módosítás” — az alap ez lesz
      if (t) { baseline.current = null; applyTemplate(t) }
    }).catch(() => {})
  }, [bizKey, bizId])

  // a napok listája az időszakban: a kijelölt hét-napok (H = 0 … V = 6), plusz / mínusz az előnézetben egyenként
  // átkapcsolt dátumok
  const datesOf = (sid: string) => {
    const out: string[] = []
    if (!v.from || !v.to || v.to < v.from) return out
    for (let d = v.from; d <= v.to && out.length < 120; d = addDays(d, 1)) {
      const o = extra[`${sid}|${d}`]
      if (o === 'off' || isClosed(d)) continue
      if (o === 'on' || v.days[(toDate(d).getDay() + 6) % 7]) out.push(d)
    }
    return out
  }
  // van-e az embernek az időszakon belül egyenként átkapcsolt dátuma (akkor napról napra mentjük)
  const hasDateEdits = (sid: string) => Object.keys(extra).some((k) => { const [x, d] = k.split('|'); return x === sid && inPeriod(d) })
  // távollét: szabadság (leave), szabadnap (vacation) vagy beteg — ezekre a napokra nem kerül műszak; a szabadnap az
  // előnézetben „nem dolgozik” (csíkos), mint a Naptárban
  const absent = (sid: string, d: string) => shifts.find((s) => s.staffId === sid && s.date === d && (s.type === 'leave' || s.type === 'vacation' || s.type === 'sick'))
  // előző hét másolása: a kiválasztottak előző heti beosztása napra pontosan
  const prevWeek = (sid: string, d: string) => shifts.find((s) => s.staffId === sid && s.date === addDays(d, -7) && s.type === 'shift')
  const plan = v.people.flatMap((sid) => datesOf(sid).filter((d) => !absent(sid, d) && (!copyWeek || prevWeek(sid, d))).map((d) => ({ sid, d })))
  const perShift = (diffHours(v.start, v.end) ?? 0) - parseBreaks(v.breaks).reduce((a, b) => a + (diffHours(b.start_time, b.end_time) ?? 0), 0)
  const totalHours = copyWeek ? plan.reduce((a, x) => { const s = prevWeek(x.sid, x.d); return a + (s ? diffHours(s.start_time, s.end_time) ?? 0 : 0) }, 0) : plan.length * perShift
  // az előnézet a „tól” nap hetét mutatja, hétfőtől vasárnapig (a nap-fejléc oszlopaival egy vonalban)
  const firstWeek = (() => { const d = toDate(v.from || mon); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymdOf(d) })()
  // az előnézet hete szabadon lapozható; az időszakon kívül a meglévő beosztást mutatja
  const [weekOffset, setWeekOffset] = useState(0)
  useEffect(() => { setWeekOffset(0) }, [v.from])
  const weekStart = addDays(firstWeek, weekOffset * 7)
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const preview: ShiftPreviewRow[] = v.people.map((sid) => {
    const st = staff.find((s) => s.id === sid)
    const cell = (d: string) => {
      const ab = absent(sid, d)
      if (ab) return ab.type === 'sick' ? 'B' : ab.type === 'leave' ? 'S' : 'X'
      if (isClosed(d) && !(d < v.from || d > v.to)) return 'X'
      if (d < v.from || d > v.to) { const o = extra[`${sid}|${d}`]; return o === 'on' ? '' : o === 'off' ? 'X' : hasShift(sid, d) ? '' : 'X' }
      const o = extra[`${sid}|${d}`]
      if (o) return o === 'on' ? '' : 'X'
      return v.days[(toDate(d).getDay() + 6) % 7] && (!copyWeek || prevWeek(sid, d)) ? '' : 'X'
    }
    const label = (d: string, c: string) => `${MONTHS_SHORT[toDate(d).getMonth()]} ${toDate(d).getDate()}. · ${c === 'B' ? 'beteg — kimarad' : c === 'S' ? 'szabadság — kimarad' : absent(sid, d)?.type === 'vacation' ? 'szabadnap — kimarad' : c === 'X' ? (isClosed(d) ? 'zárva' : 'nem dolgozik') : 'műszak'}`
    return { id: sid, name: st?.name ?? '', img: st?.avatarUrl, d: week.map(cell), t: week.map((d) => label(d, cell(d))) }
  })
  // a hét meglévő beosztása (előzmény) azoknál, akik nincsenek a tervben, de a héten van műszakjuk / szabadságuk / betegségük
  const existingRows: ShiftPreviewRow[] = staff.filter((st) => !v.people.includes(st.id) && week.some((d) => shifts.some((s) => s.staffId === st.id && s.date === d))).map((st) => {
    const cell = (d: string) => { const s = shifts.find((x) => x.staffId === st.id && x.date === d); return !s ? 'X' : s.type === 'sick' ? 'B' : s.type === 'leave' ? 'S' : s.type === 'shift' ? '' : 'X' }
    const label = (d: string, c: string) => `${MONTHS_SHORT[toDate(d).getMonth()]} ${toDate(d).getDate()}. · meglévő: ${c === 'B' ? 'beteg' : c === 'S' ? 'szabadság' : shifts.some((x) => x.staffId === st.id && x.date === d && x.type === 'vacation') ? 'szabadnap' : c === 'X' ? 'nem dolgozik' : 'műszak'}`
    return { id: st.id, name: st.name, img: st.avatarUrl, d: week.map(cell), t: week.map((d) => label(d, cell(d))), existing: true }
  })
  // a sorok mindig a munkatársak sorrendjében (kijelöléskor nem ugrálnak); sok embernél lapozva
  const PREVIEW_PER = 8
  const order = new Map(staff.map((st, i) => [st.id, i]))
  const allRows = [...preview, ...existingRows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  const [previewPg, setPreviewPg] = useState(1)
  const previewPages = Math.max(1, Math.ceil(allRows.length / PREVIEW_PER))
  const pg = Math.min(previewPg, previewPages)
  const pageRows = allRows.slice((pg - 1) * PREVIEW_PER, pg * PREVIEW_PER)
  const conflicts = v.people.flatMap((sid) => datesOf(sid).filter((d) => absent(sid, d)).map((d) => ({ sid, d })))
  const warn = conflicts.length ? (() => {
    const by = new Map<string, string[]>()
    for (const c of conflicts) by.set(c.sid, [...(by.get(c.sid) ?? []), c.d])
    return <>{[...by.entries()].map(([sid, ds]) => `${staff.find((s) => s.id === sid)?.name ?? ''} ${ds.length === 1 ? `${MONTHS_SHORT[toDate(ds[0]).getMonth()]} ${toDate(ds[0]).getDate()}-én` : `${ds.length} napon`}`).join(', ')} szabadságon, szabadnapon vagy betegállományban van — ezeket a napokat kihagyjuk.</>
  })() : null
  const dirty = baseline.current !== null && (JSON.stringify(v) !== baseline.current || copyWeek || Object.keys(extra).length > 0)
  const requestClose = () => { if (dirty && !busy) setConfirmDiscard(true); else onClose() }
  const wk = (a: string) => `${MONTHS_SHORT[toDate(a).getMonth()]} ${toDate(a).getDate()}–${toDate(addDays(a, 6)).getDate()}.`

  // nap-szerkesztésnél akik aznap dolgoztak, de már nincsenek kijelölve — az ő műszakjuk törlődik
  // (a „Kiknek”-ből levéve, vagy az előnézetben az a nap kikapcsolva)
  // az időszakon KÍVÜLI egyenkénti napok (az időszakon belülieket a `datesOf` / terv kezeli)
  const extraKeys = Object.keys(extra).filter((k) => v.people.includes(k.split('|')[0]) && !inPeriod(k.split('|')[1]))
  const extraOn = extraKeys.filter((k) => extra[k] === 'on').map((k) => k.split('|') as [string, string])
  const extraOff = extraKeys.filter((k) => extra[k] === 'off').map((k) => { const [sid, d] = k.split('|'); return hasShift(sid, d) }).filter((x): x is ShiftVM => !!x)
  const removed = [
    ...(prefillDay ? shifts.filter((s) => s.date === prefillDay && s.type === 'shift' && (!v.people.includes(s.staffId) || !datesOf(s.staffId).includes(prefillDay))) : []),
    // sáv-szerkesztésnél: az ő műszakjai a sávban, amelyek már nincsenek a tervben
    ...(prefillRange ? shifts.filter((s) => s.staffId === prefillRange.staffId && s.type === 'shift' && s.date >= prefillRange.from && s.date <= prefillRange.to && !(v.people.includes(s.staffId) && datesOf(s.staffId).includes(s.date))) : []),
    ...extraOff,
  ]
  async function submit() {
    if (!v.people.length && !removed.length) { alert('Válaszd ki, kiknek szól a beosztás.'); return }
    const a = normTime(v.start), b = normTime(v.end)
    if ((plan.length || extraOn.length) && !copyWeek && (!a || !b || b <= a)) { alert('Adj meg érvényes kezdést és véget (pl. 09:00 és 17:00).'); return }
    if (a && b) { v.start = a; v.end = b }
    if (!plan.length && !extraOn.length && !removed.length) { alert('Az időszakban nincs kijelölt nap.'); return }
    if (removed.length && onDelete) for (const s of removed) await onDelete(s)
    const breaks = parseBreaks(v.breaks)
    // az előnézetben egyesével hozzáadott napok (az időszakon kívül)
    for (const [sid, d] of extraOn) await onRange(sid, { type: 'shift', start_time: v.start, end_time: v.end, breaks, note: '', left_early_at: null, left_early_reason: null }, d, d, { keepAbsences: true })
    if (!plan.length) { onClose(); return }
    const days = [1, 2, 3, 4, 5, 6, 0].filter((_, i) => v.days[i])
    for (const sid of v.people) {
      if (copyWeek) {
        // előző hét másolása: napról napra, az előző heti idővel
        for (const d of datesOf(sid)) {
          const s = prevWeek(sid, d)
          if (!s || absent(sid, d)) continue
          await onRange(sid, { type: 'shift', start_time: s.start_time ?? '', end_time: s.end_time ?? '', breaks: s.breaks, note: '', left_early_at: null, left_early_reason: null }, d, d, { keepAbsences: true })
        }
      } else {
        const p = { type: 'shift' as const, start_time: v.start, end_time: v.end, breaks, note: '', left_early_at: null, left_early_reason: null }
        // egyenként átkapcsolt dátumokkal napról napra (pontosan az előnézet szerint), különben egyben a hét-napokra
        if (hasDateEdits(sid)) { for (const d of datesOf(sid)) if (!absent(sid, d)) await onRange(sid, p, d, d, { keepAbsences: true }) }
        else await onRange(sid, p, v.from, v.to, { days, keepAbsences: true })
      }
    }
    if (v.template && bizId && !copyWeek) {
      const dayNames = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].filter((_, i) => v.days[i]).join(', ')
      await fetch('/api/shift-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ [bizKey]: bizId, name: `${v.start}–${v.end} · ${dayNames}`, start_time: v.start, end_time: v.end, breaks, days, people: v.people }) }).catch(() => {})
    }
    onClose()
  }

  return (
    <Sheet onClose={requestClose} wide>
      <NewShiftForm
        title={prefillDay ? `Beosztás szerkesztése · ${DAY_NAMES[toDate(prefillDay).getDay()]}, ${MONTHS_SHORT[toDate(prefillDay).getMonth()]} ${toDate(prefillDay).getDate()}.` : prefillRange ? `${staff.find((st) => st.id === prefillRange.staffId)?.name ?? 'Beosztás'} — szerkesztés` : 'Új beosztás'}
        stacked={stacked}
        framed={false}
        dateInput={dateInput('w-[105px]')}
        timeInput={timeInput}
        breaksInput={breaksInput}
        onPreviewCell={(sid, i) => {
          // meglévő beosztás sora (még nincs a „Kiknek” között): koppintásra bekerül a beosztásba, utána napra kapcsolható
          if (!v.people.includes(sid)) { setV({ ...v, people: [...v.people, sid] }); return }
          // csak az az egy dátum vált annál az embernél (a többi hét nem); távollét és zárt nap nem
          const d = week[i], k = `${sid}|${d}`
          if (absent(sid, d) || (isClosed(d) && !hasShift(sid, d))) return
          const planned = inPeriod(d) ? v.days[(toDate(d).getDay() + 6) % 7] && (!copyWeek || !!prevWeek(sid, d)) : !!hasShift(sid, d)
          setExtra((cur) => { const n = { ...cur }; if (n[k]) delete n[k]; else n[k] = planned ? 'off' : 'on'; return n })
        }}
        quick={[
          { label: 'Előző hét másolása', undo: true, on: copyWeek, onClick: () => setCopyWeek((c) => !c) },
          ...templates.map((t) => ({ label: `Sablon: ${t.name}`, onClick: () => applyTemplate(t), onDelete: () => setDelTpl(t) })),
        ]}
        people={staff.map((s) => ({ id: s.id, name: s.name, img: s.avatarUrl, disabled: s.pending, title: s.pending ? 'Még nem fogadta el a meghívást — addig nem osztható be' : undefined }))}
        value={v}
        onChange={setV}
        shake={shake}
        previewLabel={`Előnézet · ${wk(weekStart)}`}
        previewDays={week.map((d) => ({ d: ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][toDate(d).getDay()], n: toDate(d).getDate(), today: d === ymdOf(new Date()) }))}
        onPreviewStep={{ prev: () => setWeekOffset((o) => o - 1), next: () => setWeekOffset((o) => o + 1) }}
        previewStats={`${v.people.length} fő · ${plan.length + extraOn.length} műszak · ${Math.round(totalHours + extraOn.length * perShift)} óra`}
        preview={pageRows}
        previewPage={{ page: pg, pages: previewPages, onPage: setPreviewPg }}
        warn={removed.length ? <>{warn}{warn ? ' ' : ''}{removed.map((x) => `${staff.find((st) => st.id === x.staffId)?.name ?? ''} (${MONTHS_SHORT[toDate(x.date).getMonth()]} ${toDate(x.date).getDate()}.)`).join(', ')} műszakja törlődik.</> : warn}
        submitLabel={prefillDay || prefillRange ? 'Mentés' : `${plan.length} műszak létrehozása`}
        onSubmit={submit}
        onCancel={requestClose}
        busy={busy}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Elveted a módosításokat?"
        description="Van mentetlen változás. Ha bezárod, elvész."
        confirmLabel="Elvetem"
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
        onCancel={() => setConfirmDiscard(false)}
        zIndexClass="z-[100]"
      />
      <ConfirmDialog
        open={!!delTpl}
        title="Sablon törlése"
        description={delTpl ? `„${delTpl.name}” — a már létrehozott műszakok megmaradnak.` : undefined}
        confirmLabel="Törlés"
        busy={tplBusy}
        onConfirm={async () => {
          if (!delTpl) return
          setTplBusy(true)
          const r = await fetch(`/api/shift-templates?id=${delTpl.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
          setTplBusy(false)
          if (r?.ok) setTemplates((cur) => cur.filter((t) => t.id !== delTpl.id))
          setDelTpl(null)
        }}
        onCancel={() => setDelTpl(null)}
        zIndexClass="z-[95]"
      />
    </Sheet>
  )
}
