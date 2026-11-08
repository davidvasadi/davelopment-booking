'use client'

/**
 * Naptár (beosztás) — a /design 11.1–11.2.1 szerint, szalon és étterem közös: fejléc (Nap / Hét / Hónap,
 * Export, + Beosztás), alatta az eszköztár (kereső, pozíció-szűrő darabszámmal, további szűrők).
 * Hónap: bal a munkatársak óra-sávval, közép a hónap (csapat vagy egy ember), jobb a távollétek vagy a profil.
 * Hét: munkatárs × nap rács. Nap: a Foglalások idővonala műszakokkal.
 * A mentés / törlés a `/api/shifts` végpontokon (a nap-szerkesztő, átmenetileg a régi — a design 11.5 váltja).
 */

import { toast } from 'sonner'
import { readSavedView, writeSavedView } from '@/lib/savedView'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Download, Pencil, Plus, Undo2, X } from 'lucide-react'
import { Avatar, Button, EmptyState, IconButton, Meta, Menu, MenuItem, PageHead, Pill, SearchField, Segmented, SlideSwap } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { DayShiftList, DayStaffCard, MonthHours, Payroll, ShiftDetailCard, SickNoteFile, StaffHoursList, StaffProfile, TeamAbsences, TipSplit, WeekSchedule, type AbsenceRow, type HoursPerson, type MonthBar, type MonthRow } from '@/components/blocks/calendar'
import { ChipToolbar } from '@/components/blocks/toolbar'
import { ShiftDayGrid } from '@/components/dashboard/ShiftDayGrid'
import { NewShiftModal, ShiftEditor } from '@/components/dashboard/ShiftEditor'
import { DayStrip } from '@/components/shared/BookingsDateNav'
import { ScheduleExportDialog } from '@/components/shared/ScheduleExportDialog'
import { toCsv, downloadCsv } from '@/lib/csv'
import { DAY_NAMES, MONTHS, MONTHS_SHORT, TYPE_LABEL, addDays, effHours, fmtH, mondayOf, pad, posOf, rangeLabel, shiftHours, shiftLabel, toDate, ymd, ymdOf, type ShiftInput, type ShiftType, type ShiftVM, type StaffVM } from '@/lib/schedule'
import { markLocalMutation } from '@/lib/localMutationTracker'

/** mentő kérés: jelzi, hogy ez a SAJÁT módosításunk — az élő frissítés (LiveRefreshProvider) ennek a visszhangjára nem
 *  frissít még egyszer (különben a két frissítés versenyében a mentés „visszaugorhatna”) */
const mutate = (...a: Parameters<typeof fetch>) => { markLocalMutation(); return fetch(...a) }

const DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const thousands = (n: number) => Math.round(n).toLocaleString('hu-HU')
/** a nap-sor kiegészítői: a beírt megjegyzés és betegnél a táppénzes papír letöltése */
const rowExtra = (s?: ShiftVM) => ({ note: s?.note && s.note !== '__auto__' ? s.note : null, file: s?.type === 'sick' && s.sickNote ? `/api/shifts/${s.id}/sick-note` : null })

type View = 'day' | 'week' | 'month'
const VIEWS: View[] = ['day', 'week', 'month']

interface Props {
  variant?: 'salon' | 'restaurant'
  salonId?: string
  restaurantId?: string
  staff: StaffVM[]
  shifts: ShiftVM[]
  dailyTips?: Record<string, number>
  closedDates?: string[]
  closedWeekdays?: number[]
  canManage?: boolean
  myStaffId?: string
  staffPageHref?: string | null
  initialDate?: string
  /** a munkatársak bére a hónap bérköltségéhez: havi bér (szalon), napidíj vagy órabér (étterem) */
  pay?: Record<string, { type: 'monthly' | 'daily' | 'hourly'; rate: number }>
  /** a bér- és borravaló-összesítő (11.3) látszik-e — csak aki a csapat bérét láthatja */
  showPayroll?: boolean
}

/** mobilon a nagy összeg rövidítve, hogy két sorban elférjen: 395 000 → „395 e Ft”, 1 486 000 → „1,49 M Ft” */
const shortFt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} M Ft` : n >= 100_000 ? `${Math.round(n / 1000)} e Ft` : `${thousands(n)} Ft`

export function CalendarView({ variant = 'salon', salonId, restaurantId, staff, shifts: initialShifts, dailyTips = {}, closedDates = [], closedWeekdays = [], canManage = true, myStaffId, staffPageHref = null, initialDate, pay = {}, showPayroll = false }: Props) {
  const isRestaurant = variant === 'restaurant'
  const router = useRouter()
  const today = ymdOf(new Date())
  const [shifts, setShifts] = useState<ShiftVM[]>(initialShifts)
  useEffect(() => { setShifts(initialShifts) }, [initialShifts])
  const [tips, setTips] = useState<Record<string, number>>(dailyTips)
  const [busy, setBusy] = useState(false)

  const [view, setView] = useState<View>('month')
  // telefonon alapból egy nap (design 11.7) — a heti / havi rács ott nem fér el
  // ha ezen az eszközön van mentett nézet (a „Nézet és szűrők” lap „Mentés” gombja), azzal indul
  useEffect(() => {
    const saved = readSavedView<{ view?: View; selected?: string | null; type?: 'all' | ShiftType }>('calendar')
    if (saved?.view) setView(saved.view)
    else if (window.matchMedia('(max-width: 1023px)').matches) setView('day')
    if (saved && canManage && saved.selected !== undefined && (saved.selected === null || staff.some((s) => s.id === saved.selected))) setSelected(saved.selected)
    if (saved?.type) setTypeFilter(saved.type)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [detail, setDetail] = useState<string | null>(null)
  // csapat-nézetben a kiválasztott nap (a jobb oszlop teteje az ő munkatársaival)
  const [selDay, setSelDay] = useState<string | null>(null)
  const [date, setDate] = useState(() => (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : today))
  // saját nézetben (csak a saját beosztását látja) mindig ő a kiválasztott
  const [selected, setSelected] = useState<string | null>(canManage ? null : myStaffId ?? staff[0]?.id ?? null)
  // havi nézet: munkatárs- vagy hónapváltáskor a jobb oszlop oldalra csúszik (SlideSwap, mint a jóváhagyó popup lapozása) —
  // lejjebb lévő munkatárs / későbbi hónap jobbról, feljebb / korábbi balról; középen a pillek és a sávok újra kirajzolódnak
  const slide = useRef<{ key: string; dir: number }>({ key: '', dir: 0 })
  // a heti nézet lapozásának iránya (a rács becsúszik)
  const weekDir = useRef(0)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState(0)
  const [typeFilter, setTypeFilter] = useState<'all' | ShiftType>('all')
  // nap-szerkesztő (11.5): melyik nap, kié (csapat-nézetből null — ott választható); „+ Beosztás” (11.6)
  const [editor, setEditor] = useState<{ date: string; staffId: string | null } | null>(null)
  // „+ Beosztás”: true = üres, string = egy nap szerkesztése (a jobb oldali nap-kártya ceruzája)
  // (objektum = egy ember több napos műszak-sávja a hónapban)
  const [newShift, setNewShift] = useState<boolean | string | { staffId: string; from: string; to: string } | { template: string }>(false)
  // az üres állapot (11.4) sablon-gombjához: a mentett sablonok
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [filling, setFilling] = useState(false)
  const noShifts = shifts.length === 0
  useEffect(() => {
    if (!noShifts || !canManage) return
    const q = isRestaurant ? `restaurant=${restaurantId}` : `salon=${salonId}`
    fetch(`/api/shift-templates?${q}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.templates) setTemplates(j.templates) }).catch(() => {})
  }, [noShifts, canManage, isRestaurant, restaurantId, salonId])
  async function fillFromDefaults() {
    setFilling(true)
    const r = await mutate('/api/shifts/autofill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ salon: salonId }) }).catch(() => null)
    setFilling(false)
    if (r?.ok) router.refresh()
    else alert('A kitöltés nem sikerült.')
  }

  // a mobil fejléc ikonjai (DashboardNav): „+” a nap-szerkesztő, a szűrő a szűrők lapja, a ceruza az épp nézett nap
  // szerkesztése (a nézet a renderben állítja be `editDayRef`-et)
  const [mobileFilters, setMobileFilters] = useState(false)
  // mobil: a fejléc kereső-ikonja nyitja a munkatárs-keresőt
  const [mobileSearch, setMobileSearch] = useState(false)
  const editDayRef = useRef<{ day: string; staffId: string | null } | null>(null)
  // a mobil havi nézet saját szerkesztés-művelete (a kiválasztott szakasz vagy nap) — ha be van állítva, a ceruza ezt futtatja
  const editActionRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const onAdd = () => setNewShift(true)
    const onFilter = () => setMobileFilters(true)
    const onEdit = () => { if (editActionRef.current) { editActionRef.current(); return } const t = editDayRef.current; if (!t) return; if (t.staffId) setEditor({ date: t.day, staffId: t.staffId }); else setNewShift(t.day) }
    window.addEventListener('davelopment:open-schedule-add', onAdd)
    window.addEventListener('davelopment:open-schedule-filter', onFilter)
    window.addEventListener('davelopment:open-schedule-edit', onEdit)
    const onSearch = () => setMobileSearch((v) => { if (v) setQuery(''); return !v })
    const onExport = () => exportRef.current()
    window.addEventListener('davelopment:export-schedule', onExport)
    window.addEventListener('davelopment:open-schedule-search', onSearch)
    return () => { window.removeEventListener('davelopment:open-schedule-add', onAdd); window.removeEventListener('davelopment:open-schedule-filter', onFilter); window.removeEventListener('davelopment:open-schedule-edit', onEdit); window.removeEventListener('davelopment:open-schedule-search', onSearch); window.removeEventListener('davelopment:export-schedule', onExport) }
  }, [date])

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])
  const positions = useMemo(() => {
    const m = new Map<string, number>()
    for (const st of staff) { const p = posOf(st); if (p) m.set(p, (m.get(p) ?? 0) + 1) }
    return [...m.entries()]
  }, [staff])
  const posName = pos > 0 ? positions[pos - 1]?.[0] : null
  const q = query.trim().toLowerCase()
  const visibleStaff = staff.filter((st) => (!posName || posOf(st) === posName) && (!q || st.name.toLowerCase().includes(q)))
  const sel = selected ? staffById.get(selected) ?? null : null
  const visible = (s: ShiftVM) => typeFilter === 'all' || s.type === typeFilter

  // ── a hónap ──
  const d0 = toDate(date)
  const y = d0.getFullYear(), m = d0.getMonth()
  {
    const key = `${selected ?? ''}|${y}-${m}`
    const prev = slide.current.key
    if (prev !== key) {
      let dir = 0
      if (prev) {
        const [ps, pm] = prev.split('|')
        const [py, pmm] = pm.split('-').map(Number)
        if (py * 12 + pmm !== y * 12 + m) dir = y * 12 + m > py * 12 + pmm ? 1 : -1
        else { const ix = (id: string) => (id ? staff.findIndex((x) => x.id === id) : -1); dir = ix(selected ?? '') >= ix(ps) ? 1 : -1 }
      }
      slide.current = { key, dir }
    }
  }
  const monthPrefix = `${y}-${pad(m + 1)}`
  const monthShifts = shifts.filter((s) => s.date.startsWith(monthPrefix) && visible(s))
  const isClosed = (day: string) => closedDates.includes(day) || closedWeekdays.includes(toDate(day).getDay())
  const hoursOf = (list: ShiftVM[], t: ShiftType) => list.filter((s) => s.type === t).reduce((a, s) => a + shiftHours(s), 0)

  // ── CRUD (a régi Naptár logikája) ──
  async function addShift(staffId: string, p: ShiftInput, day: string, paid?: boolean): Promise<string | null> {
    const existing = shifts.find((s) => s.date === day && s.staffId === staffId)
    if (existing && existing.note !== '__auto__') { alert('Ez a munkatárs már be van osztva erre a napra. Módosítsd a meglévő bejegyzést.'); return null }
    if (p.type === 'shift' && isClosed(day)) { alert('Ezen a napon zárva vagytok (a nyitvatartás szerint) — műszak nem adható.'); return null }
    setBusy(true)
    const isShift = p.type === 'shift'
    const left_early_at = isShift ? p.left_early_at || null : null
    const body = {
      ...(isRestaurant ? (staffId === 'owner' ? { owner_shift: true, restaurant: restaurantId } : { member: staffId, restaurant: restaurantId }) : { staff: staffId, salon: salonId }),
      date: day, type: p.type,
      start_time: isShift ? p.start_time || null : null, end_time: isShift ? p.end_time || null : null,
      hours: effHours(p), breaks: isShift ? p.breaks : [], note: p.note || null,
      left_early_at, left_early_reason: left_early_at ? p.left_early_reason ?? 'personal' : null,
      ...(paid !== undefined ? { paid } : {}),
    }
    try {
      const res = existing
        ? await mutate(`/api/shifts/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
        : await mutate('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const doc = json.doc ?? json
      const vm: ShiftVM = { id: existing ? existing.id : String(doc.id), staffId, date: day, type: p.type, start_time: body.start_time, end_time: body.end_time, hours: body.hours, breaks: body.breaks, note: body.note, left_early_at: body.left_early_at, left_early_reason: body.left_early_reason, paid: !!paid, sickNote: existing?.sickNote ?? null }
      setShifts((prev) => (existing ? prev.map((s) => (s.id === existing.id ? vm : s)) : [...prev, vm]))
      router.refresh()
      return vm.id
    } catch { alert('Nem sikerült beosztani.'); return null } finally { setBusy(false) }
  }
  /** Több nap egy művelettel (távollét tól–ig, ismétlődő műszak, „+ Beosztás”) — `days`: csak a hét ezen napjain
   *  (0 = Vasárnap), `keepAbsences`: műszaknál a meglévő szabadság / beteg nap kimarad. */
  async function addShiftRange(staffId: string, p: ShiftInput, startDate: string, endDate: string, opts: { days?: number[]; keepAbsences?: boolean; paid?: boolean } = {}): Promise<{ id: string; date: string }[] | null> {
    setBusy(true)
    const isShift = p.type === 'shift'
    const body = {
      ...(isRestaurant ? (staffId === 'owner' ? { owner_shift: true, restaurant: restaurantId } : { member: staffId, restaurant: restaurantId }) : { staff: staffId, salon: salonId }),
      start_date: startDate, end_date: endDate, type: p.type, note: p.note || null,
      ...(isShift ? { start_time: p.start_time || null, end_time: p.end_time || null, hours: effHours(p), breaks: p.breaks } : {}),
      ...(opts.paid !== undefined ? { paid: opts.paid } : {}),
      ...(opts.days ? { days: opts.days } : {}),
      ...(opts.keepAbsences ? { keep_absences: true } : {}),
      // műszak zárt napra nem kerül (a nyitvatartásból)
      ...(isShift ? { skip_dates: (() => { const out: string[] = []; for (let d = startDate; d <= endDate && out.length < 120; d = addDays(d, 1)) if (isClosed(d)) out.push(d); return out })() } : {}),
    }
    try {
      const res = await mutate('/api/shifts/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const json = await res.json() as { results: { id: string | number; date: string }[] }
      const results = json.results.map((r) => ({ id: String(r.id), date: r.date }))
      setShifts((prev) => {
        const rangeDates = new Set(results.map((r) => r.date))
        const kept = prev.filter((s) => !(s.staffId === staffId && rangeDates.has(s.date)))
        return [...kept, ...results.map((r) => ({ id: r.id, staffId, date: r.date, type: p.type, start_time: isShift ? p.start_time || null : null, end_time: isShift ? p.end_time || null : null, hours: isShift ? effHours(p) : null, breaks: isShift ? p.breaks : [], note: p.note || null, left_early_at: null, left_early_reason: null, paid: !!opts.paid, sickNote: null }))]
      })
      router.refresh()
      return results
    } catch { alert('Nem sikerült beosztani a tartományt.'); return null } finally { setBusy(false) }
  }
  /** Táppénzes papír feltöltése / törlése egy „Beteg” bejegyzéshez (nem nyilvános tároló). */
  async function uploadNote(shiftId: string, file: File): Promise<boolean> {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await mutate(`/api/shifts/${shiftId}/sick-note`, { method: 'POST', credentials: 'include', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'Nem sikerült feltölteni.')
      setShifts((prev) => prev.map((s) => (s.id === shiftId ? { ...s, sickNote: json.note } : s)))
      return true
    } catch (e) { alert(e instanceof Error ? e.message : 'Nem sikerült feltölteni.'); return false }
  }
  async function deleteNote(shiftId: string): Promise<boolean> {
    try {
      const res = await mutate(`/api/shifts/${shiftId}/sick-note`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setShifts((prev) => prev.map((s) => (s.id === shiftId ? { ...s, sickNote: null } : s)))
      return true
    } catch { alert('Nem sikerült törölni.'); return false }
  }
  async function editShift(id: string, p: ShiftInput, paid?: boolean): Promise<boolean> {
    setBusy(true)
    const isShift = p.type === 'shift'
    const left_early_at = isShift ? p.left_early_at || null : null
    const patch = {
      type: p.type, start_time: isShift ? p.start_time || null : null, end_time: isShift ? p.end_time || null : null,
      hours: effHours(p), breaks: isShift ? p.breaks : [], note: p.note || null,
      left_early_at, left_early_reason: left_early_at ? p.left_early_reason ?? 'personal' : null,
      ...(paid !== undefined ? { paid } : {}),
    }
    try {
      const res = await mutate(`/api/shifts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(patch) })
      if (!res.ok) throw new Error()
      setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      router.refresh()
      return true
    } catch { alert('Nem sikerült menteni a változást.'); return false } finally { setBusy(false) }
  }
  async function deleteShift(existing: ShiftVM) {
    setBusy(true)
    try {
      const res = await mutate(`/api/shifts/${existing.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setShifts((prev) => prev.filter((s) => s.id !== existing.id))
      router.refresh()
    } catch { alert('Nem sikerült törölni.') } finally { setBusy(false) }
  }
  async function saveTips(day: string, amount: number): Promise<boolean> {
    if (!isRestaurant || !restaurantId) return false
    setBusy(true)
    try {
      const res = await mutate('/api/daily-tips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ restaurant: restaurantId, date: day, amount }) })
      if (!res.ok) throw new Error()
      setTips((prev) => { const next = { ...prev }; if (amount > 0) next[day] = Math.round(amount); else delete next[day]; return next })
      router.refresh()
      return true
    } catch { alert('Nem sikerült menteni a borravalót.'); return false } finally { setBusy(false) }
  }
  const openDay = (day: string, staffId: string | null = null) => { if (canManage) setEditor({ date: day, staffId }) }

  // ── Export: a megjelenített hónap beosztása CSV-ben ──
  // a mobil fejléc export-ikonja (esemény) mindig a friss függvényt hívja
  const exportRef = useRef<() => void>(() => {})
  const [exportOpen, setExportOpen] = useState(false)
  exportRef.current = () => setExportOpen(true)


  // ── fejléc + eszköztár (design 11.1) ──
  const typeChips = (
    <>
      <Meta className="mt-4">Típus</Meta>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(['all', 'shift', 'leave', 'sick', 'vacation'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTypeFilter(t)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={typeFilter === t ? 'dark' : 'cell'}>{t === 'all' ? 'Mind' : TYPE_LABEL[t]}</Pill></button>
        ))}
      </div>
    </>
  )
  const head = (
    <PageHead
      title="Naptár"
      sub={<span className="lg:hidden">{['Nap', 'Hét', 'Hónap'][VIEWS.indexOf(view)]} · {sel ? sel.name : 'minden munkatárs'}</span>}
      // mobilon a nézet és az Export a szűrő-lapon, a „+ Beosztás” a fejléc ikonja (DashboardNav)
      actions={<span className="flex flex-wrap items-center gap-1.5 max-lg:hidden">
        <Segmented options={['Nap', 'Hét', 'Hónap']} active={VIEWS.indexOf(view)} onSelect={(i) => setView(VIEWS[i])} />
        <Button variant="glass" icon={Download} onClick={() => setExportOpen(true)}>Export</Button>
        {canManage && <Button variant="yellow" icon={Plus} onClick={() => setNewShift(true)}>Beosztás</Button>}
      </span>}
    />
  )
  const toolbar = canManage && (
    <ChipToolbar
      search="Munkatárs keresése"
      query={query}
      onQuery={setQuery}
      chips={[['Mind', staff.length], ...positions]}
      active={pos}
      onChip={(i) => { setPos(i); setSelected(null) }}
      dot={typeFilter !== 'all'}
      chipsInFilter
      chipsLabel="Pozíció"
      filters={<>
        <div className="flex items-center justify-between"><span className="text-ui-title font-light text-ui-text">Szűrők</span><Button variant="danger" size="sm" onClick={() => { setTypeFilter('all'); setPos(0); setSelected(null) }}>Törlés</Button></div>
        {typeChips}
      </>}
    />
  )
  // mobil „Nézet és szűrők” lap (design 11.7): időszak, munkatárs, típus — és az Export (Dave kérésére)
  const mobileSheet = (
    <PopupModal open={mobileFilters} onClose={() => setMobileFilters(false)} title="Nézet és szűrők" maxWidth="sm:max-w-[440px]" headerAction={<Button variant="ghost" size="sm" onClick={() => { setTypeFilter('all'); setPos(0); setQuery(''); setSelected(canManage ? null : selected); setView('day') }}>Alaphelyzet</Button>}>
      <Meta>Időszak</Meta>
      <Segmented className="mt-1.5" full tone="cell" options={['Nap', 'Hét', 'Hónap']} active={VIEWS.indexOf(view)} onSelect={(i) => setView(VIEWS[i])} />
      {canManage && (
        <>
          <Meta className="mt-4">Munkatárs</Meta>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setSelected(null)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={selected ? 'cell' : 'dark'}>Mind</Pill></button>
            {staff.map((st) => (
              <button key={st.id} type="button" title={st.name} aria-label={st.name} aria-pressed={selected === st.id} onClick={() => setSelected(st.id)} className={`rounded-full outline-none ${selected === st.id ? 'ring-2 ring-ui-dark ring-offset-2' : ''}`}><Avatar size="sm" src={st.avatarUrl ?? null} name={st.name} /></button>
            ))}
          </div>
        </>
      )}
      {typeChips}
      {/* a ritkán használt műveletek (Dave kérésére a fejlécből ide): a kiválasztott nap/szakasz szerkesztése és az export */}
      <div className="mt-4 flex gap-1.5">
        {canManage && <Button variant="cell" className="flex-1" icon={Pencil} onClick={() => { setMobileFilters(false); window.dispatchEvent(new Event('davelopment:open-schedule-edit')) }}>Szerkesztés</Button>}
        <Button variant="cell" className="flex-1" icon={Download} onClick={() => { setMobileFilters(false); exportRef.current() }}>Export</Button>
      </div>
      {/* „Mentés”: az időszak, a munkatárs és a típus ezen az eszközön megmarad — legközelebb ezzel nyílik */}
      <Button className="mt-2 w-full" onClick={() => { writeSavedView('calendar', { view, selected: canManage ? selected : undefined, type: typeFilter }); toast.success('Nézet elmentve ezen az eszközön'); setMobileFilters(false) }}>Mentés</Button>
    </PopupModal>
  )

  // a beosztás szerkesztése: a + Beosztás ablak az adott nap helyzetével, egy munkatársnál (`staffId`) az ő nap-szerkesztője;
  // desktopon felirattal, mobilon a fejléc ceruzája
  const editTarget = (day: string, staffId: string | null = null) => {
    editDayRef.current = canManage ? { day, staffId } : null
    editActionRef.current = null
    return canManage ? () => (staffId ? openDay(day, staffId) : setNewShift(day)) : undefined
  }
  const editBtn = (day: string, staffId: string | null = null) => {
    const on = editTarget(day, staffId)
    return on ? <Button variant="glass" size="sm" icon={Pencil} className="max-lg:hidden" onClick={on}>Szerkesztés</Button> : undefined
  }

  // ── HÓNAP (design 11.1 / 11.1.1) ──
  const monthView = () => {
    const team = !sel
    // a jobb oszlop napja: a kiválasztott, különben ma (ha ebben a hónapban), különben a hónap első napja
    const dayKey = selDay && selDay.startsWith(monthPrefix) ? selDay : today.startsWith(monthPrefix) ? today : `${monthPrefix}-01`
    const list = team ? monthShifts.filter((s) => visibleStaff.some((st) => st.id === s.staffId)) : monthShifts.filter((s) => s.staffId === sel.id)
    const work = hoursOf(list, 'shift'), sick = hoursOf(list, 'sick'), leave = hoursOf(list, 'leave')
    // a naptár csíkos szabadnapjai a hónapban: zárt nap, és egy munkatársnál a „szabadnap” bejegyzései (a felső sávban csíkozva)
    const monthDays = Array.from({ length: 31 }, (_, i) => `${monthPrefix}-${String(i + 1).padStart(2, '0')}`).filter((d) => !Number.isNaN(toDate(d).getTime()) && toDate(d).getMonth() === toDate(`${monthPrefix}-01`).getMonth())
    const freeDays = monthDays.filter((d) => isClosed(d) || (!!sel && list.some((x) => x.date === d && x.type === 'vacation'))).length
    // bérköltség (design 11.3): havi bér, vagy napidíj × műszaknap, vagy órabér × műszakóra; túlóra = a havi keret
    // (heti óra × 4,33) feletti óra ugyanazzal az órabérrel (havi bérnél bér / keret); étteremnél a napi borravaló
    // egyenlően a jogosult, aznap dolgozók közt
    const payOf = (st: StaffVM) => {
      const p = pay[st.id]
      const own = list.filter((s) => s.staffId === st.id && s.type === 'shift')
      const hrs = own.reduce((a, s) => a + shiftHours(s), 0)
      const target = st.weekly_hours ? st.weekly_hours * 4.33 : null
      const extraH = target ? Math.max(0, hrs - target) : 0
      const hTxt = String(Math.round(hrs * 10) / 10).replace('.', ',')
      if (!p) return { base: 0, over: 0, h: hrs ? `${hTxt} ó` : '—' }
      if (p.type === 'hourly') return { base: (hrs - extraH) * p.rate, over: extraH * p.rate, h: `${hTxt} × ${thousands(p.rate)}` }
      if (p.type === 'daily') return { base: own.length * p.rate, over: 0, h: `${own.length} nap × ${thousands(p.rate)}` }
      return { base: p.rate, over: target ? extraH * (p.rate / target) : 0, h: `${hTxt} ó · havi` }
    }
    const tipOf = new Map<string, number>()
    if (isRestaurant) {
      for (const [d, amount] of Object.entries(tips)) {
        if (!d.startsWith(monthPrefix) || !(amount > 0)) continue
        const who = staff.filter((st) => st.tipEligible && shifts.some((s) => s.staffId === st.id && s.date === d && s.type === 'shift'))
        for (const st of who) tipOf.set(st.id, (tipOf.get(st.id) ?? 0) + amount / who.length)
      }
    }
    // a tulajdonosnak (étterem) nincs bére / borravalója
    const payPeople = (team ? visibleStaff : [sel]).filter((st) => st.id !== 'owner')
    const payRows = payPeople.map((st) => { const p = payOf(st); const t = tipOf.get(st.id) ?? 0; return { st, ...p, t, sum: p.base + p.over + t } })
    const money = payRows.reduce((a, r) => a + r.base + r.over, 0)
    const sum = Math.max(1, work + sick + leave)
    // a hónap hetei (hétfőtől)
    const first = mondayOf(`${monthPrefix}-01`)
    const rows: MonthRow[] = []
    // a sávok kulcsa → kié, mettől meddig (rá kattintva műszaknál a nagy szerkesztő, távollétnél a nap-szerkesztő)
    const barRange = new Map<string, { staffId: string; from: string; to: string; type: ShiftVM['type'] }>()
    for (let w = 0, start = first; w < 6; w++, start = addDays(start, 7)) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
      if (w > 0 && !days.some((d) => d.startsWith(monthPrefix))) break
      const cells = days.map((d, i) => {
        const out = !d.startsWith(monthPrefix)
        const closed = !out && isClosed(d) ? 'Zárva' : undefined
        const count = team && !out && !closed ? new Set(list.filter((s) => s.date === d && s.type === 'shift').map((s) => s.staffId)).size : undefined
        return { key: d, n: toDate(d).getDate(), out, closed, weekend: i > 4, today: d === today, count: count || undefined, selected: team ? d === dayKey : !!selDay && d === selDay }
      })
      // több napos események: az egymást követő, azonos bejegyzések egy pillbe
      const bars: MonthBar[] = []
      const people = team ? visibleStaff : [sel]
      for (const st of people) {
        // az egymást követő, AZONOS TÍPUSÚ napok egy szakaszba (a műszakidő eltérhet); a felirat a műszakidővel, ha végig ugyanaz
        let run: { from: number; to: number; s: ShiftVM; label: string; mixed: boolean } | null = null
        const flush = () => {
          if (!run) return
          const { from, to, s } = run
          const label = run.mixed ? TYPE_LABEL[s.type] : run.label
          barRange.set(s.id, { staffId: st.id, from: days[from], to: days[to], type: s.type })
          bars.push({
            key: s.id, from, span: to - from + 1,
            tone: s.type === 'shift' ? 'yellow' : s.type === 'sick' ? 'dark' : 'white',
            label: team ? `${st.name} · ${TYPE_LABEL[s.type].toLowerCase()}` : label,
            range: rangeLabel(days[from], days[to]),
            on: !team && s.type === 'sick',
            who: team ? { src: st.avatarUrl, name: st.name } : undefined,
          })
          run = null
        }
        days.forEach((d, i) => {
          const s = list.find((x) => x.staffId === st.id && x.date === d)
          // csapat-nézetben csak a távollétek; egy embernél a műszak is (a szabadnap nem esemény)
          const show = s && s.type !== 'vacation' && (!team || s.type === 'sick' || s.type === 'leave')
          const label = s ? (s.type === 'shift' ? `Műszak · ${shiftLabel(s)}` : TYPE_LABEL[s.type]) : ''
          if (show && run && run.s.type === s!.type && run.to === i - 1) { run.to = i; if (run.label !== label) run.mixed = true; return }
          flush()
          if (show) run = { from: i, to: i, s: s!, label, mixed: false }
        })
        flush()
      }
      rows.push({ cells, bars })
    }
    // távollétek (csapat) — munkatársanként az egymást követő azonos napok egy sorba
    const absences: AbsenceRow[] = []
    for (const st of visibleStaff) {
      const own = list.filter((s) => s.staffId === st.id && (s.type === 'sick' || s.type === 'leave')).sort((a, b) => a.date.localeCompare(b.date))
      let cur: { a: ShiftVM; b: ShiftVM; n: number } | null = null
      const push = () => { if (cur) absences.push({ key: `${st.id}|${cur.a.date}`, name: st.name, img: st.avatarUrl, type: TYPE_LABEL[cur.a.type], range: `${rangeLabel(cur.a.date, cur.b.date)} · ${cur.n} nap`, tone: cur.a.type === 'sick' ? 'dark' : 'grey' }) }
      for (const s of own) {
        if (cur && cur.a.type === s.type && addDays(cur.b.date, 1) === s.date) { cur.b = s; cur.n++ } else { push(); cur = { a: s, b: s, n: 1 } }
      }
      push()
    }
    absences.sort((a, b) => a.key.split('|')[1].localeCompare(b.key.split('|')[1]))
    const holidays = closedDates.filter((d) => d.startsWith(monthPrefix)).sort()
    const people: HoursPerson[] = visibleStaff.map((st) => {
      const own = monthShifts.filter((s) => s.staffId === st.id)
      const target = Math.max(1, (st.weekly_hours ?? 40) * 4.33)
      return { id: st.id, name: st.name, role: st.role, img: st.avatarUrl, a: Math.min(100, (hoursOf(own, 'shift') / target) * 100), b: Math.min(100, ((hoursOf(own, 'sick') + hoursOf(own, 'leave')) / target) * 100) }
    })
    const monthMenu = <MonthMenu y={y} m={m} onPick={(yy, mm) => setDate(ymd(yy, mm, 1))} />
    const segs = [{ label: 'Munkanap', value: fmtH(work), weight: (work / sum) * 100, tone: 'yellow' as const }, { label: 'Beteg', value: fmtH(sick), weight: (sick / sum) * 100, tone: 'dark' as const }, { label: 'Szabadság', value: fmtH(leave), weight: (leave / sum) * 100, tone: 'white' as const }, ...(freeDays > 0 ? [{ label: 'Szabadnap', value: `${freeDays} nap`, weight: ((freeDays * 8) / (sum + freeDays * 8)) * 100, tone: 'hatch' as const }] : [])]
    // a kiválasztott nap munkatársai (desktopon a jobb oszlop, mobilon a hónap alatt)
    const dayCard = (() => {
      const dk = toDate(dayKey)
      const rowsOfDay = visibleStaff.map((st) => {
        const s = shifts.find((x) => x.staffId === st.id && x.date === dayKey)
        return { key: st.id, name: st.name, img: st.avatarUrl, role: posOf(st) || st.role, kind: !s ? 'none' as const : s.type === 'vacation' ? 'off' as const : s.type === 'sick' ? 'sick' as const : s.type === 'leave' ? 'leave' as const : 'shift' as const, time: s ? shiftLabel(s) : undefined, ...rowExtra(s) }
      }).sort((a, b) => ['shift', 'sick', 'leave', 'off', 'none'].indexOf(a.kind) - ['shift', 'sick', 'leave', 'off', 'none'].indexOf(b.kind))
      const working = rowsOfDay.filter((r) => r.kind === 'shift').length
      return (
        <DayStaffCard
          title={`${dayKey === today ? 'Ma, ' : ''}${DAY_NAMES[dk.getDay()]}, ${MONTHS_SHORT[dk.getMonth()]} ${dk.getDate()}.`}
          sub={isClosed(dayKey) ? (working ? `Zárva · mégis ${working} fő beosztva` : 'Zárva') : `${working} fő dolgozik`}
          rows={rowsOfDay}
          onPick={canManage ? (sid) => openDay(dayKey, sid) : undefined}
          action={editBtn(dayKey)}
        />
      )
    })()
    // bér és borravaló (design 11.3) — csak bér-jogosultnak (`showPayroll`); étteremnél mellette a kiválasztott nap borravalója
    const payroll = showPayroll ? (() => {
      const base = payRows.reduce((a, r) => a + r.base, 0), over = payRows.reduce((a, r) => a + r.over, 0), tipSum = payRows.reduce((a, r) => a + r.t, 0)
      const all = Math.max(1, base + over + tipSum)
      const segments = [
        { label: 'Bér', value: thousands(base), weight: (base / all) * 100, tone: 'dark' as const },
        ...(tipSum > 0 ? [{ label: 'Borravaló', value: thousands(tipSum), weight: (tipSum / all) * 100, tone: 'yellow' as const }] : []),
        ...(over > 0 ? [{ label: 'Túlóra', value: thousands(over), weight: (over / all) * 100, tone: 'grey' as const }] : []),
      ]
      const exportPay = () => downloadCsv(`berlista-${monthPrefix}.csv`, toCsv(['Munkatárs', 'Óra × díj', 'Bér', 'Túlóra', 'Borravaló', 'Összesen'], payRows.map((r) => [r.st.name, r.h, Math.round(r.base), Math.round(r.over), Math.round(r.t), Math.round(r.sum)])))
      const tipDay = tips[dayKey] ?? 0
      const working = staff.filter((st) => shifts.some((s) => s.staffId === st.id && s.date === dayKey && s.type === 'shift'))
      const eligible = working.filter((st) => st.tipEligible)
      const dk = toDate(dayKey)
      return (
        <div className={`mt-[5px] grid items-start gap-[5px] max-lg:hidden ${isRestaurant ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
          <Payroll month={MONTHS[m]} total={`${thousands(base + over + tipSum)} Ft`} segments={segments} onExport={exportPay}
            rows={payRows.map((r) => ({ id: r.st.id, name: r.st.name, img: r.st.avatarUrl, h: r.h, t: r.t > 0 ? thousands(r.t) : '—', s: r.sum > 0 ? thousands(r.sum) : '—' }))}
            empty={base + over + tipSum > 0 ? undefined : <>Még senkinek nincs megadva bér{isRestaurant ? ' (napidíj vagy órabér)' : ''} — a munkatárs adatlapján állíthatod be.{staffPageHref && <> <a href={staffPageHref} className="whitespace-nowrap underline underline-offset-4">Munkatársak</a></>}</>} />
          {/* jobbra (étterem, design 11.3): a kiválasztott nap borravalója */}
          {isRestaurant && (
            <TipSplit day={`${DAY_NAMES[dk.getDay()]}, ${MONTHS_SHORT[dk.getMonth()]} ${dk.getDate()}.`} total={`${thousands(tipDay)} Ft`}
              rows={working.filter((st) => st.id !== 'owner').map((st) => ({ id: st.id, name: st.name, img: st.avatarUrl, amount: st.tipEligible ? thousands(eligible.length ? tipDay / eligible.length : 0) : null }))} />
          )}
        </div>
      )
    })() : null
    // mobil (design 11.7): kompakt hónap, a kiválasztott esemény alatta sötét kártyán
    const ds = detail ? shifts.find((x) => x.id === detail) : null
    const dsBar = ds ? rows.flatMap((r) => r.bars).find((b) => b.key === ds.id) : null
    const dsDays = dsBar ? dsBar.span : 1
    // mobil: koppintás = kiválasztás (nap vagy szakasz, kerettel); a fejléc ceruzája a kiválasztottat szerkeszti — a
    // szakaszt teljes egészében (mettől meddig), a napot a nap-szerkesztőben
    const editBar = (id: string) => { const b = barRange.get(id); if (!b) return; if (b.type === 'shift') setNewShift({ staffId: b.staffId, from: b.from, to: b.to }); else openDay(b.from, b.staffId) }
    if (canManage) editActionRef.current = detail ? () => editBar(detail) : () => (sel ? openDay(dayKey, sel.id) : setNewShift(dayKey))
    const mobile = (
      <div className="lg:hidden">
        <MonthHours mobile team={team} total={<><span className="block">{thousands(work + sick + leave)} ó</span><span className="mt-1 block whitespace-nowrap">{shortFt(money)}</span></>} month={monthMenu} segments={segs}
          head={team ? <>Csapat · {visibleStaff.length} fő</> : <><Avatar size="xs" src={sel.avatarUrl ?? null} name={sel.name} className="h-5 w-5" />{sel.name}</>}
          rows={rows.map((r) => ({ ...r, cells: detail ? r.cells.map((c) => ({ ...c, selected: false })) : r.cells, bars: r.bars.map((b) => ({ ...b, on: b.key === detail })) }))}
          // csapat-nézetben a távollét-kártya a napjait takarja: rákoppintva a kártya kezdőnapja is kiválasztódik, és
          // alatta ugyanúgy látszik, ki dolgozik aznap
          onDay={(d) => { setSelDay(d); setDetail(null) }} onBar={(id) => { setDetail((cur) => (cur === id ? null : id)); if (team) { const b = barRange.get(id); if (b) setSelDay(b.from) } }} />
        {ds && dsBar && (
          <ShiftDetailCard className="mt-3" tone={ds.type === 'shift' ? 'yellow' : ds.type === 'sick' ? 'dark' : 'grey'} onEdit={canManage ? () => editBar(ds.id) : undefined} title={team ? `${staffById.get(ds.staffId)?.name ?? ''} · ${TYPE_LABEL[ds.type].toLowerCase()}` : TYPE_LABEL[ds.type]} note={ds.note && ds.note !== '__auto__' ? ds.note : null}
            hours={fmtH(ds.type === 'shift' ? shiftHours(ds) * dsDays : 8 * dsDays)}
            meta={[ds.type === 'shift' ? 'beosztás' : `${ds.type === 'sick' ? 'betegszabadság' : TYPE_LABEL[ds.type].toLowerCase()}${ds.paid ? ' · fizetett' : ''}`, dsBar.range]}
            file={ds.type === 'sick' && ds.sickNote ? <SickNoteFile onDark name={ds.sickNote.filename} meta={`Orvosi igazolás${ds.sickNote.filesize ? ` · ${Math.max(1, Math.round(ds.sickNote.filesize / 1024))} KB` : ''}`} href={`/api/shifts/${ds.id}/sick-note`} /> : null} />
        )}
        {/* csapat-nézet: a rács alatt a kiválasztott nap és a hónap távollétei (desktopon a jobb oszlop) */}
        {team && <div className={ds ? 'mt-[5px]' : 'mt-3'}>{dayCard}</div>}
        {team && (
          <TeamAbsences className="mt-[5px]" month={MONTHS[m]} rows={absences} holidays={holidays.length ? `Zárva: ${holidays.map((d) => `${MONTHS_SHORT[m]} ${toDate(d).getDate()}.`).join(', ')} (a nyitvatartásból)` : null} onPick={canManage ? (k) => { const [sid, d] = k.split('|'); openDay(d, sid) } : undefined} />
        )}
      </div>
    )
    return (
      <>
      {mobile}
      <div className="grid gap-[5px] overflow-x-clip max-lg:hidden xl:grid-cols-[minmax(0,1fr)_640px_minmax(0,1fr)]">
        <StaffHoursList title={posName ? `${posName}ok` : 'Munkatársak'} people={people} selected={selected} onPick={(id) => setSelected((cur) => (cur === id && canManage ? null : id))} />
        <MonthHours
          drawKey={slide.current.key}
          team={team}
          head={team ? <>Csapat · {visibleStaff.length} fő</> : <>{/* vissza a csapat-nézetbe (csak aki az egész csapatot láthatja) */}{canManage && <IconButton icon={ArrowLeft} label="Vissza a csapathoz" variant="cell" size="sm" className="-my-1.5 mr-0.5" onClick={() => setSelected(null)} />}<Avatar size="xs" src={sel.avatarUrl ?? null} name={sel.name} className="h-5 w-5" />{sel.name}</>}
          total={`${thousands(work + sick + leave)} ó / ${thousands(money)} Ft`}
          month={monthMenu}
          segments={segs}
          rows={rows}
          // csapat-nézetben a nap kiválasztása (jobbra a munkatársai), egy embernél a nap-szerkesztő
          onDay={team ? setSelDay : canManage ? (d) => openDay(d, sel?.id ?? null) : undefined}
          onBar={canManage ? (id) => { const b = barRange.get(id); if (!b) return; if (b.type === 'shift') setNewShift({ staffId: b.staffId, from: b.from, to: b.to }); else openDay(b.from, b.staffId) } : undefined}
        />
        <SlideSwap k={slide.current.key} dir={slide.current.dir} className="flex min-w-0 flex-col [&>*]:flex-1">
        {team ? (
          <div className="flex flex-col gap-[5px]">
          {dayCard}
          <TeamAbsences month={MONTHS[m]} rows={absences} holidays={holidays.length ? `Zárva: ${holidays.map((d) => `${MONTHS_SHORT[m]} ${toDate(d).getDate()}.`).join(', ')} (a nyitvatartásból)` : null} onPick={canManage ? (k) => { const [sid, d] = k.split('|'); openDay(d, sid) } : undefined} />
          </div>
        ) : (() => {
          const own = monthShifts.filter((s) => s.staffId === sel.id)
          const worked = own.filter((s) => s.type === 'shift' && s.date <= today).reduce((a, s) => a + shiftHours(s), 0)
          const target = Math.max(1, (sel.weekly_hours ?? 40) * 4.33)
          const sickDays = own.filter((s) => s.type === 'sick').length
          const leaveDays = own.filter((s) => s.type === 'leave').length
          const dim = new Date(y, m + 1, 0).getDate()
          return (
            <StaffProfile
              person={{ name: sel.name, role: sel.role, img: sel.avatarUrl }}
              rows={[['Belépés', sel.join_date ? `${toDate(sel.join_date).getFullYear()}. ${MONTHS_SHORT[toDate(sel.join_date).getMonth()]} ${toDate(sel.join_date).getDate()}.` : '—'], ['Telefon', sel.phone ?? '—'], ['Heti óra', sel.weekly_hours != null ? `${sel.weekly_hours} ó` : '—']]}
              stats={[['Ledolgozott', fmtH(worked), Math.min(100, (worked / target) * 100), 'yellow'], ['Beteg', `${sickDays} nap`, (sickDays / dim) * 100, 'dark'], ['Szabadság', `${leaveDays} nap`, (leaveDays / dim) * 100, 'grey']]}
              href={staffPageHref ? `${staffPageHref}?profil=${sel.id}` : undefined}
              phone={sel.phone}
              onEdit={editTarget(dayKey, sel.id)}
            />
          )
        })()}
        </SlideSwap>
      </div>
      {payroll}
      </>
    )
  }

  // ── HÉT (design 11.2) ──
  const weekView = () => {
    const mon = mondayOf(date)
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
    const rows = visibleStaff.filter((st) => !sel || st.id === sel.id).map((st) => {
      const own = shifts.filter((s) => s.staffId === st.id && days.includes(s.date) && visible(s))
      const h = hoursOf(own, 'shift')
      return {
        id: st.id, name: st.name, img: st.avatarUrl,
        d: days.map((d) => { const s = own.find((x) => x.date === d); return !s || s.type === 'vacation' ? 'X' : s.type === 'sick' ? 'B' : s.type === 'leave' ? 'S' : shiftLabel(s) }),
        h: st.weekly_hours ? `${thousands(h)} / ${st.weekly_hours}` : thousands(h),
      }
    })
    const total = shifts.filter((s) => days.includes(s.date) && s.type === 'shift' && visible(s) && rows.some((r) => r.id === s.staffId)).reduce((a, s) => a + shiftHours(s), 0)
    // üres állapot (design 11.4): még nincs beosztás — kitöltés az alap munkaidőből (szalon), sablonból vagy kézzel
    if (noShifts && canManage) return (
      <EmptyState icon={CalendarDays} title="Még nincs beosztás ezen a héten" action={
        <span className="flex flex-wrap justify-center gap-1.5">
          {!isRestaurant && <Button icon={Undo2} onClick={fillFromDefaults} disabled={filling}>{filling ? 'Kitöltés…' : 'Alap munkaidőből kitöltöm'}</Button>}
          {templates[0] && <Button variant="glass" onClick={() => setNewShift({ template: templates[0].id })}>Sablon: {templates[0].name}</Button>}
          <Button variant="glass" icon={Plus} onClick={() => setNewShift(true)}>Beosztás</Button>
        </span>
      }>
        {isRestaurant
          ? 'Mentett sablonból vagy kézzel (+ Beosztás) egy lépésben felveheted a hetet — utána napra pontosan átírhatod, és felveheted a szabadságot, betegséget.'
          : 'A munkatársak alap-munkaidejéből egy kattintással kitöltjük a hetet — utána napra pontosan átírhatod, és felveheted a szabadságot, betegséget.'}
      </EmptyState>
    )
    return (
      <WeekSchedule
        range={rangeLabel(days[0], days[6])}
        onStep={(dir) => { weekDir.current = dir; setDate(addDays(date, dir * 7)) }}
        slideDir={weekDir.current}
        total={fmtH(total)}
        days={days.map((d, i) => ({ d: DAYS[i], n: toDate(d).getDate(), today: d === today, closed: isClosed(d) }))}
        rows={rows}
        onCell={canManage ? (rowId, i) => openDay(days[i], rowId) : undefined}
        action={editBtn(days.includes(today) ? today : days[0], sel?.id ?? null)}
      />
    )
  }

  // ── NAP (design 11.2.1): a Foglalások idővonala, műszakokkal ──
  const dayView = () => {
    const own = shifts.filter((s) => s.date === date && visible(s))
    const people = visibleStaff.filter((st) => !sel || st.id === sel.id)
    const nowMin = date === today ? new Date().getHours() * 60 + new Date().getMinutes() : null
    const dd = toDate(date)
    // mobil (design 11.7): a nap-csík és a munkatársak listája — az idővonal keskeny képernyőn nem fér el
    const mobileRows = people.map((st) => {
      const s = own.find((x) => x.staffId === st.id)
      return { key: st.id, name: st.name, img: st.avatarUrl, role: posOf(st) || st.role, kind: !s || s.type === 'vacation' ? 'off' as const : s.type === 'sick' ? 'sick' as const : s.type === 'leave' ? 'leave' as const : 'shift' as const, time: s ? shiftLabel(s) : undefined, ...rowExtra(s) }
    })
    const workers = mobileRows.filter((r) => r.kind === 'shift').length
    const sickN = mobileRows.filter((r) => r.kind === 'sick').length, leaveN = mobileRows.filter((r) => r.kind === 'leave').length
    const dayHours = hoursOf(own.filter((s) => people.some((p) => p.id === s.staffId)), 'shift')
    const foot = [`${date === today ? 'Ma' : cap(DAY_NAMES[dd.getDay()])} ${fmtH(dayHours).replace(' ó', ' óra')}`, `${workers} fő dolgozik`, sickN ? `${sickN} beteg` : null, leaveN ? `${leaveN} szabadságon` : null].filter(Boolean).join(' · ')
    return (
      <>
        <div className="lg:hidden">
          <DayShiftList strip={<DayStrip date={date} onPick={setDate} />} rows={mobileRows} foot={foot} onPick={canManage ? (sid) => openDay(date, sid) : undefined} />
        </div>
        <div className="max-lg:hidden">
        <ShiftDayGrid staff={people} shifts={shifts.filter(visible)} date={date} restaurant={isRestaurant} nowMin={nowMin} closed={isClosed(date)}
          head={
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <IconButton icon={ArrowLeft} label="Előző nap" size="sm" onClick={() => setDate(addDays(date, -1))} />
                <span className="text-ui-title text-ui-text">{cap(DAY_NAMES[dd.getDay()])}, {MONTHS_SHORT[dd.getMonth()]} {dd.getDate()}.</span>
                <IconButton icon={ArrowRight} label="Következő nap" size="sm" onClick={() => setDate(addDays(date, 1))} />
              </span>
              <span className="flex items-center gap-1.5">
                {date !== today && <Button size="sm" onClick={() => setDate(today)}>Ma</Button>}
                {editBtn(date, sel?.id ?? null)}
              </span>
            </div>
          }
          onEdit={(s) => openDay(s.date, s.staffId)}
        />
        </div>
      </>
    )
  }

  return (
    <div className="p-4 lg:p-0">
      {head}
      <div className="max-lg:hidden">{toolbar}</div>
      {/* mobil: a fejléc kereső-ikonja nyitja (munkatárs neve), X-szel bezárható */}
      {mobileSearch && (
        <div className="ui-pop-in mb-3 flex items-center gap-1.5 lg:hidden">
          <SearchField autoFocus className="min-w-0 flex-1" value={query} onChange={setQuery}>Munkatárs keresése…</SearchField>
          <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={() => { setQuery(''); setMobileSearch(false) }} />
        </div>
      )}
      {mobileSheet}
      {exportOpen && <ScheduleExportDialog shifts={shifts} staff={staff} month={monthPrefix} selected={canManage ? selected : (myStaffId ?? null)} canManage={canManage} onClose={() => setExportOpen(false)} />}
      {view === 'month' ? monthView() : view === 'week' ? weekView() : dayView()}

      {editor && (
        <ShiftEditor
          key={`${editor.date}-${editor.staffId}`}
          date={editor.date}
          staffId={editor.staffId}
          staff={staff}
          shifts={shifts}
          isRestaurant={isRestaurant}
          closed={isClosed(editor.date)}
          busy={busy}
          dayTip={tips[editor.date] ?? 0}
          onSaveTips={(amount) => saveTips(editor.date, amount)}
          onAdd={addShift}
          onRange={addShiftRange}
          onEdit={editShift}
          onDelete={deleteShift}
          onUploadNote={uploadNote}
          onDeleteNote={deleteNote}
          onClose={() => setEditor(null)}
        />
      )}
      {newShift && (
        <NewShiftModal key={JSON.stringify(newShift)} date={date} prefillDay={typeof newShift === 'string' ? newShift : undefined} prefillRange={typeof newShift === 'object' && 'staffId' in newShift ? newShift : undefined} templateId={typeof newShift === 'object' && 'template' in newShift ? newShift.template : undefined} staff={staff} shifts={shifts} bizKey={isRestaurant ? 'restaurant' : 'salon'} bizId={isRestaurant ? restaurantId : salonId} isClosed={isClosed} busy={busy} onRange={addShiftRange} onDelete={deleteShift} onClose={() => setNewShift(false)} />
      )}
    </div>
  )
}

/** A hónap-választó (design 11.1 „November ⌄”): üveg gomb, alatta a kit menüje — év-léptető és a hónapok. */
function MonthMenu({ y, m, onPick }: { y: number; m: number; onPick: (y: number, m: number) => void }) {
  const [open, setOpen] = useState(false)
  const [yy, setYy] = useState(y)
  return (
    <span className="relative">
      <Button variant="glass" onClick={() => { setYy(y); setOpen((v) => !v) }} aria-expanded={open}>{cap(MONTHS[m])}{y !== new Date().getFullYear() ? ` ${y}` : ''} <ChevronDown className="h-4 w-4 text-ui-muted" /></Button>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <Menu className="absolute right-0 top-full z-50 mt-2">
            <div className="flex items-center justify-between px-2 pb-1 pt-1">
              <IconButton icon={ArrowLeft} label="Előző év" size="sm" variant="cell" onClick={() => setYy(yy - 1)} />
              <span className="text-ui-body text-ui-text">{yy}</span>
              <IconButton icon={ArrowRight} label="Következő év" size="sm" variant="cell" onClick={() => setYy(yy + 1)} />
            </div>
            <div className="grid grid-cols-3">
              {MONTHS.map((name, i) => <MenuItem key={name} active={yy === y && i === m} onClick={() => { onPick(yy, i); setOpen(false) }}>{cap(name).slice(0, 3)}</MenuItem>)}
            </div>
          </Menu>
        </>
      )}
    </span>
  )
}

