'use client'

/**
 * BEOSZTÁS (globális) — a KÖZÉP naptár a CSAPAT beosztása: minden nap-cellában a beosztott
 * emberek avatar-chipjei; egy napra kattintva bárkit BE lehet pakolni (nap-szerkesztő:
 * személy + típus + idő). A bal lista a jobb HR-profilt és a fejléc-statot választja.
 * Referencia: Crextio „Salary" layout. CRUD: Payload REST `/api/shifts` (credentials:'include').
 */

import { useMemo, useState, useEffect, useRef, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Phone, Cake, Trash2, X, ArrowLeft, LogOut, User, CalendarClock, Coins, Search, SlidersHorizontal } from 'lucide-react'
import { StatusPills } from '@/components/dashboard/StatusPills'

export type ShiftType = 'shift' | 'leave' | 'sick' | 'vacation'

export interface ShiftVM {
  id: string
  staffId: string
  date: string // YYYY-MM-DD
  type: ShiftType
  start_time: string | null
  end_time: string | null
  hours: number | null
  note: string | null
  // Státuszváltás a napon belül: a műszak vége előtt hazament (pl. délben beteg lett). Nincs duplázás.
  left_early_at: string | null
  left_early_reason: 'sick' | 'personal' | null
}

export interface StaffVM {
  id: string
  name: string
  ini: string
  avatarUrl?: string | null // valós profilkép (media URL / Google avatar); null → monogram
  role: string
  birthday: string | null // YYYY-MM-DD
  join_date: string | null
  weekly_hours: number | null
  phone: string | null
  documents: { label: string; sizeLabel: string }[]
}

interface Props {
  variant?: 'salon' | 'restaurant'
  salonId?: string
  restaurantId?: string
  staff: StaffVM[]
  shifts: ShiftVM[]
  year: number
  month: number // 0-based
  dailyTips?: Record<string, number> // dátum → napi központi borravaló (Ft); csak étterem
}

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const WD = ['Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas']
const HATCH = 'repeating-linear-gradient(45deg,#E4DECC 0 6px,#F1ECDD 6px 12px)'

/**
 * Mappa-notch maszk (davelopment Naptar.dc.html): a folder-kártya tetejére középre vágott
 * „fül-rés". A maszk fix pixel-szélességű, ezért REszponzív: mobilon kisebb notch (media query),
 * különben keskeny kártyán túlnyúlik az ív.
 */
// A davelopment Naptar HANDOFF eredeti notch-a: FIX méretű, középre igazított kis ív a toolbarnak
// (desktop: 600×70 — 1:1 a handoff-fal; mobilon arányosan kisebb).
const NOTCH_SVG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='70'%3E%3Cpath d='M52 0Q64 0 64 24V38A26 26 0 0 0 90 64H510A26 26 0 0 0 536 38V24Q536 0 548 0Z' fill='white'/%3E%3C/svg%3E\")"
const NOTCH_CSS = `.sched-folder{
  -webkit-mask-image:${NOTCH_SVG},linear-gradient(#000,#000);
  -webkit-mask-repeat:no-repeat,no-repeat;-webkit-mask-position:center top,center;
  -webkit-mask-size:380px 66px,100% 100%;-webkit-mask-composite:xor;
  mask-image:${NOTCH_SVG},linear-gradient(#000,#000);
  mask-repeat:no-repeat,no-repeat;mask-position:center top,center;
  mask-size:380px 66px,100% 100%;mask-composite:exclude;
}
@media(min-width:640px){.sched-folder{-webkit-mask-size:600px 70px,100% 100%;mask-size:600px 70px,100% 100%;}}`

const TYPE_LABEL: Record<ShiftType, string> = { shift: 'Műszak', leave: 'Szabadság', sick: 'Betegszabadság', vacation: 'Fizetett szabadság' }

/** Chip-szín típusonként (avatar-chip a nap-cellában és a nap-szerkesztőben). */
function chipStyle(type: ShiftType): { bg: string; fg: string } {
  if (type === 'sick') return { bg: '#1D1C19', fg: '#fff' }
  if (type === 'leave' || type === 'vacation') return { bg: '#E4DECC', fg: '#5C5848' }
  return { bg: '#F1CE45', fg: '#1D1C19' } // shift
}

const LEFT_REASON: Record<'sick' | 'personal', string> = { sick: 'beteg lett', personal: 'hazament' }

/** Egy bejegyzés státusz-felirata: típus + idő; korai távozásnál a tényleges idő + ok. */
function statusLabel(s: ShiftVM): string {
  if (s.type !== 'shift') return TYPE_LABEL[s.type]
  if (!s.start_time) return 'Műszak'
  const end = s.left_early_at ?? s.end_time ?? ''
  const base = `${s.start_time}–${end}`
  return s.left_early_at ? `${base} · ${LEFT_REASON[s.left_early_reason ?? 'personal']}` : base
}

/** A nap-szerkesztő űrlap-értéke (hozzáadás/módosítás közös alakja). */
export type ShiftInput = {
  type: ShiftType
  start_time: string
  end_time: string
  note: string
  left_early_at: string | null
  left_early_reason: 'sick' | 'personal' | null
}

/** Tényleges ledolgozott óra: műszaknál start→(korai távozás ?? vége); egyébként null. */
function effHours(p: ShiftInput): number | null {
  if (p.type !== 'shift') return null
  return diffHours(p.start_time || null, p.left_early_at || p.end_time || null)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
function diffHours(s: string | null, e: string | null): number | null {
  if (!s || !e) return null
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}
function fmtHu(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}.`
}

const WEEK_MINI = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const MONTH_SHORT = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szep', 'okt', 'nov', 'dec']
/** Rövid dátum a jobb-profil „következő műszak"-jához: „jún 12." (YYYY-MM-DD alapból). */
function fmtShort(d: string): string {
  const [, mm, dd] = d.split('-').map(Number)
  return `${MONTH_SHORT[(mm || 1) - 1]} ${dd}.`
}

/** Avatar: profilkép ha van (object-cover kör), különben monogram. A `style` viszi a hátteret/gyűrűt. */
function Ava({ url, ini, className, style }: { url?: string | null; ini: string; className: string; style?: CSSProperties }) {
  if (url) return <img src={url} alt="" className={`${className} object-cover object-top`} style={style} />
  return <span className={className} style={style}>{ini}</span>
}

/**
 * Apple-szerű SZEGMENTÁLT szűrő: a kijelölt szegmens alá egy sötét kiemelés CSÚSZIK (framer `layoutId`,
 * megosztott-elem animáció). A szöveg a kijelöltnél arany, egyébként halvány. A `id` egyedivé teszi a
 * layoutId-t (több szegmens-csoport egy oldalon). Referencia: Crextio „Salary" szűrő-pillek.
 */
function SegFilter<T extends string>({ id, options, value, onChange }: { id: string; options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center rounded-full bg-[#EDEBE4] p-1 shadow-[inset_0_1px_2px_rgba(70,60,20,.06)]">
      {options.map((o) => {
        const active = o.v === value
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} className="relative rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors" style={{ color: active ? '#fff' : '#57564f' }}>
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-[#1D1C19]" transition={{ type: 'spring', stiffness: 480, damping: 40 }} />}
            <span className="relative z-[1] whitespace-nowrap">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ScheduleView({ variant = 'salon', salonId, restaurantId, staff, shifts: initialShifts, year, month, dailyTips = {} }: Props) {
  const isRestaurant = variant === 'restaurant'
  const router = useRouter()
  const [shifts, setShifts] = useState<ShiftVM[]>(initialShifts)
  const [tips, setTips] = useState<Record<string, number>>(dailyTips)
  const [y, setY] = useState(year)
  const [m, setM] = useState(month)
  const [selStaff, setSelStaff] = useState<string>(staff[0]?.id ?? '')
  const [selectedDay, setSelectedDay] = useState<string | null>(null) // kijelölt nap → a bal panel „Aznap" módja
  const [dayEditor, setDayEditor] = useState<string | null>(null) // nap-szerkesztő modal (hozzáadás/módosítás)
  const [busy, setBusy] = useState(false)
  const [focusPerson, setFocusPerson] = useState(false) // személy-fókusz: csak a kijelölt dolgozó műszakai kiemelve
  const [navDir, setNavDir] = useState(0) // hónapváltás iránya (-1 vissza / +1 előre / 0 ugrás) az animációhoz
  const [typeFilter, setTypeFilter] = useState<'all' | ShiftType>('all') // beosztás-típus szűrő (hatékonyabb áttekintés)
  const [posFilter, setPosFilter] = useState<string>('all') // pozíció-szűrő (csak az adott munkakör)
  const [coverWeekends, setCoverWeekends] = useState(false) // hétvégét is figyeljük a fedettségnél (ha hétvégén is nyitva)
  const [onlyUncovered, setOnlyUncovered] = useState(false) // csak a fedetlen napok kiemelése (a többi halványul)
  const [query, setQuery] = useState('') // munkatárs-kereső (név szerint)
  // Fül-toolbar EGY-aktív eszköze: a Kereső az ALAP; váltáskor átanimálódik (az nyílik ki, a másik összemegy).
  const [activeTool, setActiveTool] = useState<'search' | 'filter'>('search')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const folderRef = useRef<HTMLDivElement>(null)
  const [addHover, setAddHover] = useState(false) // +Új gomb: hoverre kiírja a nevét

  // Félrekattintásra a toolbar VISSZAÁLL a keresőre (Apple-szerű alap-állapot).
  useEffect(() => {
    if (activeTool === 'search') return
    const onDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setActiveTool('search')
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [activeTool])

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])
  const sel = useMemo(() => staff.find((s) => s.id === selStaff) ?? staff[0], [staff, selStaff])

  const monthPrefix = `${y}-${pad(m + 1)}`
  const monthShifts = useMemo(() => shifts.filter((s) => s.date.startsWith(monthPrefix)), [shifts, monthPrefix])

  // Nap → az aznapi beosztások (globális, minden dolgozó).
  const byDate = useMemo(() => {
    const map = new Map<string, ShiftVM[]>()
    for (const s of monthShifts) {
      const arr = map.get(s.date) ?? []
      arr.push(s)
      map.set(s.date, arr)
    }
    return map
  }, [monthShifts])

  // Fejléc-stat a KIVÁLASZTOTT dolgozóra (Crextio: Ledolgozott/Hiányzás/Szabadság).
  const staffMonthShifts = useMemo(() => monthShifts.filter((s) => sel && s.staffId === sel.id), [monthShifts, sel])
  const worked = staffMonthShifts.filter((s) => s.type === 'shift').reduce((a, s) => a + (s.hours ?? diffHours(s.start_time, s.end_time) ?? 0), 0)
  const sick = staffMonthShifts.filter((s) => s.type === 'sick').reduce((a, s) => a + (s.hours ?? 8), 0)
  const vacation = staffMonthShifts.filter((s) => s.type === 'leave' || s.type === 'vacation').reduce((a, s) => a + (s.hours ?? 8), 0)
  const totalWorked = worked + sick + vacation
  // Szabadság/hiányzás NAPban mérjük (nem órában) — a pillek nap-alapúak, egységesen.
  const daysWorked = staffMonthShifts.filter((s) => s.type === 'shift').length
  const sickDays = staffMonthShifts.filter((s) => s.type === 'sick').length
  const vacationDays = staffMonthShifts.filter((s) => s.type === 'leave' || s.type === 'vacation').length

  function utilization(st: StaffVM): number {
    const w = monthShifts.filter((s) => s.staffId === st.id && s.type === 'shift').reduce((a, s) => a + (s.hours ?? diffHours(s.start_time, s.end_time) ?? 0), 0)
    const target = (st.weekly_hours ?? 40) * 4
    return target > 0 ? Math.min(100, Math.round((w / target) * 100)) : 0
  }

  // Naptár-rács (hétfő-kezdet).
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: { day: number; inMonth: boolean; date: string | null }[] = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: 0, inMonth: false, date: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true, date: ymd(y, m, d) })
  while (cells.length % 7 !== 0) cells.push({ day: 0, inMonth: false, date: null })

  const today = new Date()
  const todayStr = ymd(today.getFullYear(), today.getMonth(), today.getDate())
  const birthdaysOn = (date: string) => staff.filter((st) => st.birthday && st.birthday.slice(5) === date.slice(5))

  // ── Jobb-profil: a kiválasztott dolgozó KÖVETKEZŐ műszaka + e HETI beosztása (valós hét, H–V). ──
  const selAll = useMemo(() => shifts.filter((s) => sel && s.staffId === sel.id), [shifts, sel])
  const nextShift = selAll.filter((s) => s.type === 'shift' && s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  const weekDates = (() => {
    const dw = (today.getDay() + 6) % 7 // 0 = hétfő
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dw)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)
      return ymd(d.getFullYear(), d.getMonth(), d.getDate())
    })
  })()
  const weekShift = (d: string) => selAll.find((s) => s.date === d) ?? null
  // Óra-mérő: a MEGJELENÍTETT hónap ledolgozott órája (mindig betölt, ha van műszak a hónapban).
  // Keret: a heti-óra szerződésből havi célt számolunk (~4.33 hét); ha nincs megadva, csak a szám.
  const monthWorked = Math.round(worked)
  const monthTarget = sel?.weekly_hours && sel.weekly_hours > 0 ? Math.round(sel.weekly_hours * 4.33) : null

  // Fedettség-mérő: hány mai/jövőbeli figyelt nap fedetlen (0 beosztás) ebben a hónapban.
  // Alapból csak hétköznap (H–P); a `coverWeekends` bekapcsolva a hétvégét is beleszámítja.
  const isWatchedDow = (dow: number) => coverWeekends || (dow >= 1 && dow <= 5)
  const uncoveredCount = cells.filter((c) => {
    if (!c.inMonth || !c.date) return false
    const dow = new Date(y, m, c.day).getDay()
    return c.date >= todayStr && isWatchedDow(dow) && (byDate.get(c.date)?.length ?? 0) === 0
  }).length

  // ── Szűrők: KERESŐ (név) + TÍPUS + POZÍCIÓ (a „központi beosztás" hatékonyságához). A pozíció a role első fele. ──
  const q = query.trim().toLowerCase()
  const posOf = (staffId: string) => (staffById.get(staffId)?.role ?? '').split(' ·')[0].trim()
  const nameMatches = (staffId: string) => q === '' || (staffById.get(staffId)?.name ?? '').toLowerCase().includes(q)
  const passesFilter = (s: ShiftVM) => nameMatches(s.staffId) && (typeFilter === 'all' || s.type === typeFilter) && (posFilter === 'all' || posOf(s.staffId) === posFilter)
  const positionOptions = Array.from(new Set(staff.map((st) => (st.role ?? '').split(' ·')[0].trim()).filter(Boolean)))
  const filtersActive = typeFilter !== 'all' || posFilter !== 'all' || q !== ''
  // A bal (csapat) lista is keresésre szűkül.
  const rosterStaff = q === '' ? staff : staff.filter((st) => st.name.toLowerCase().includes(q))
  // Mérő: hány KÜLÖNBÖZŐ ember van beosztva e hónapban (bármely típus).
  const peopleScheduled = new Set(monthShifts.map((s) => s.staffId)).size

  // Kijelölt nap: a beosztottak POZÍCIÓ (role) szerint csoportosítva — vezető/supervisor elöl (szűrve).
  const selectedDayShifts = selectedDay ? (byDate.get(selectedDay) ?? []).filter(passesFilter) : []
  const isLeadRole = (r: string) => /vezet|superv|manager|menedzs|főnök|head/i.test(r)
  const dayGroups = (() => {
    const map = new Map<string, ShiftVM[]>()
    for (const s of selectedDayShifts) {
      const r = staffById.get(s.staffId)?.role?.trim() || 'Egyéb'
      const arr = map.get(r) ?? []
      arr.push(s)
      map.set(r, arr)
    }
    return Array.from(map.entries()).sort((a, b) => (isLeadRole(a[0]) ? 0 : 1) - (isLeadRole(b[0]) ? 0 : 1) || a[0].localeCompare(b[0], 'hu'))
  })()

  function prevMonth() {
    setSelectedDay(null); setNavDir(-1) // más hónapra lépve ne maradjon kijelölve egy nem látszó nap
    if (m === 0) { setM(11); setY(y - 1) } else setM(m - 1)
  }
  function nextMonth() {
    setSelectedDay(null); setNavDir(1)
    if (m === 11) { setM(0); setY(y + 1) } else setM(m + 1)
  }
  function goToday() {
    setSelectedDay(null)
    setNavDir(today.getFullYear() * 12 + today.getMonth() >= y * 12 + m ? 1 : -1)
    setY(today.getFullYear())
    setM(today.getMonth())
  }
  const onCurrentMonth = y === today.getFullYear() && m === today.getMonth()

  // ── CRUD ──
  async function addShift(staffId: string, p: ShiftInput, date: string): Promise<boolean> {
    const st = staffById.get(staffId)
    if (!st) return false
    // #2 — egy munkatárs / nap CSAK egyszer. (A nap-szerkesztő a listából is kihagyja a beosztottakat.)
    if (shifts.some((s) => s.date === date && s.staffId === staffId)) {
      alert('Ez a munkatárs már be van osztva erre a napra. Módosítsd a meglévő bejegyzést.')
      return false
    }
    setBusy(true)
    const isShift = p.type === 'shift'
    const left_early_at = isShift ? p.left_early_at || null : null
    const body = {
      // A tulaj (id='owner') beosztása: `owner_shift` jelzővel megy, member nélkül — csak fedettség.
      ...(isRestaurant
        ? (staffId === 'owner' ? { owner_shift: true, restaurant: restaurantId } : { member: staffId, restaurant: restaurantId })
        : { staff: staffId, salon: salonId }),
      date,
      type: p.type,
      start_time: isShift ? p.start_time || null : null,
      end_time: isShift ? p.end_time || null : null,
      hours: effHours(p),
      note: p.note || null,
      left_early_at,
      left_early_reason: left_early_at ? p.left_early_reason ?? 'personal' : null,
    }
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const doc = json.doc ?? json
      const vm: ShiftVM = { id: String(doc.id), staffId, date, type: p.type, start_time: body.start_time, end_time: body.end_time, hours: body.hours, note: body.note, left_early_at: body.left_early_at, left_early_reason: body.left_early_reason }
      setShifts((prev) => [...prev, vm])
      router.refresh()
      return true
    } catch {
      alert('Nem sikerült beosztani.')
      return false
    } finally {
      setBusy(false)
    }
  }

  /** #3 — meglévő bejegyzés MÓDOSÍTÁSA (típus/idő/korai távozás). Egy soron marad, nincs duplázás. */
  async function editShift(id: string, p: ShiftInput): Promise<boolean> {
    setBusy(true)
    const isShift = p.type === 'shift'
    const left_early_at = isShift ? p.left_early_at || null : null
    const patch = {
      type: p.type,
      start_time: isShift ? p.start_time || null : null,
      end_time: isShift ? p.end_time || null : null,
      hours: effHours(p),
      note: p.note || null,
      left_early_at,
      left_early_reason: left_early_at ? p.left_early_reason ?? 'personal' : null,
    }
    try {
      const res = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      router.refresh()
      return true
    } catch {
      alert('Nem sikerült menteni a változást.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteShift(existing: ShiftVM) {
    setBusy(true)
    try {
      const res = await fetch(`/api/shifts/${existing.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setShifts((prev) => prev.filter((s) => s.id !== existing.id))
      router.refresh()
    } catch {
      alert('Nem sikerült törölni.')
    } finally {
      setBusy(false)
    }
  }

  /** Napi KÖZPONTI borravaló mentése egy napra (Restaurant.daily_tips). amount<=0 → törli. Csak étterem. */
  async function saveTips(date: string, amount: number): Promise<boolean> {
    if (!isRestaurant || !restaurantId) return false
    setBusy(true)
    try {
      const res = await fetch('/api/daily-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurant: restaurantId, date, amount }),
      })
      if (!res.ok) throw new Error()
      setTips((prev) => {
        const next = { ...prev }
        if (amount > 0) next[date] = Math.round(amount)
        else delete next[date]
        return next
      })
      router.refresh()
      return true
    } catch {
      alert('Nem sikerült menteni a borravalót.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 font-onest lg:p-0">
      {/* ── MAPPA-konténer: notch/fül a tetején, benne a szűrő-toolbar ── */}
      <style>{NOTCH_CSS}</style>
      <div className="relative">
        {/* ── FÜL-toolbar (ÜVEGES): EGY-aktív — a Kereső az alap, váltáskor átanimálódik (az nyílik ki, a másik összemegy); active = FEKETE-FEHÉR ── */}
        <div className="pointer-events-none absolute inset-x-0 top-1.5 z-30 flex justify-center px-4">
          <motion.div layout transition={{ type: 'spring', stiffness: 420, damping: 40 }} ref={toolbarRef} className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/50 bg-white/40 p-1.5 shadow-dav-card backdrop-blur-md">
            {/* Kereső — EGY elem, layout animálja a méretet (aktív: széles sötét mező; inaktív: ikon) */}
            <motion.div layout transition={{ type: 'spring', stiffness: 420, damping: 40 }} onClick={() => activeTool !== 'search' && setActiveTool('search')} className={`flex h-10 items-center gap-2 overflow-hidden rounded-full ${activeTool === 'search' ? 'w-[150px] bg-white px-3.5 shadow-sm sm:w-[216px]' : 'w-10 flex-shrink-0 cursor-pointer justify-center hover:bg-white/70'}`}>
              <Search className="h-[18px] w-[18px] flex-shrink-0 text-ink-soft" strokeWidth={2} />
              {activeTool === 'search' && (
                <>
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Munkatárs keresése" className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none" />
                  {query && <button type="button" onClick={() => setQuery('')} aria-label="Törlés" className="flex-shrink-0 text-ink-soft2 transition-colors hover:text-ink"><X className="h-4 w-4" strokeWidth={2} /></button>}
                </>
              )}
            </motion.div>
            {/* Szűrők — aktív: fekete-fehér + label + panel; inaktív: ikon (aktív szűrőnél apró jelző) */}
            <div className="relative">
              <motion.button layout transition={{ type: 'spring', stiffness: 420, damping: 40 }} type="button" onClick={() => setActiveTool('filter')} title="Szűrők" className={`relative flex h-10 items-center justify-center gap-1.5 rounded-full ${activeTool === 'filter' ? 'bg-[#1D1C19] px-3.5 text-white' : 'w-10 flex-shrink-0 text-ink-soft hover:bg-white/70'}`}>
                <SlidersHorizontal className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                {activeTool === 'filter' && <span className="whitespace-nowrap text-[13px] font-semibold">Szűrők</span>}
                {filtersActive && activeTool !== 'filter' && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#E8A23D]" />}
              </motion.button>
              <AnimatePresence>
                {activeTool === 'filter' && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -6 }} transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }} style={{ transformOrigin: 'top left' }} className="absolute left-0 top-full z-50 mt-2 w-[300px] rounded-[18px] border border-line bg-white p-3.5 shadow-dav-container">
                    <div className="mb-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft2">Típus</div>
                      <SegFilter id="type" value={typeFilter} onChange={(v) => setTypeFilter(v)} options={[{ v: 'all', label: 'Mind' }, { v: 'shift', label: 'Műszak' }, { v: 'leave', label: 'Szab' }, { v: 'vacation', label: 'Fiz' }, { v: 'sick', label: 'Beteg' }]} />
                    </div>
                    {positionOptions.length > 0 && (
                      <div className="relative mb-2.5">
                        <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="h-9 w-full cursor-pointer appearance-none truncate rounded-full border border-line bg-white pl-4 pr-9 text-[12.5px] font-semibold text-ink focus:outline-none" style={posFilter !== 'all' ? { background: '#1D1C19', color: '#fff', borderColor: '#1D1C19' } : undefined}>
                          <option value="all">Minden pozíció</option>
                          {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${posFilter !== 'all' ? 'text-white' : 'text-ink-soft'}`} strokeWidth={1.8} />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setOnlyUncovered((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors" style={onlyUncovered ? { background: '#1D1C19', color: '#fff', borderColor: '#1D1C19' } : { background: '#fff', color: '#5C5848', borderColor: 'var(--dav-line)' }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: '#E8A23D' }} /> Csak fedetlen
                      </button>
                      <button type="button" onClick={() => setCoverWeekends((v) => !v)} className="flex h-9 items-center rounded-full border px-3.5 text-[12px] font-semibold transition-colors" style={coverWeekends ? { background: '#1D1C19', color: '#fff', borderColor: '#1D1C19' } : { background: '#fff', color: '#5C5848', borderColor: 'var(--dav-line)' }}>Hétvége is</button>
                    </div>
                    {filtersActive && (
                      <button type="button" onClick={() => { setTypeFilter('all'); setPosFilter('all'); setQuery('') }} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-paper py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink">Szűrők törlése <X className="h-3.5 w-3.5" strokeWidth={2} /></button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Kiemelés — toggle; bekapcsolva kiírja a nevét (fekete-fehér active) */}
            {sel && (
              <motion.button layout transition={{ type: 'spring', stiffness: 420, damping: 40 }} type="button" onClick={() => setFocusPerson((v) => !v)} title={focusPerson ? `Csak ${sel.name.split(' ')[0]} kiemelve` : 'Kijelölt dolgozó kiemelése'} className={`flex h-10 items-center justify-center gap-1.5 rounded-full transition-colors ${focusPerson ? 'bg-[#1D1C19] px-3.5 text-white' : 'w-10 flex-shrink-0 text-ink-soft hover:bg-white/70'}`}>
                <User className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                {focusPerson && <span className="whitespace-nowrap text-[13px] font-semibold">Kiemelés</span>}
              </motion.button>
            )}
            {/* + Új műszak — hoverre kiírja a nevét */}
            <motion.button layout transition={{ type: 'spring', stiffness: 420, damping: 40 }} type="button" onClick={() => setDayEditor(selectedDay ?? todayStr)} onHoverStart={() => setAddHover(true)} onHoverEnd={() => setAddHover(false)} title="Új műszak felvétele" className={`flex h-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#1D1C19] text-white transition-colors hover:bg-ink ${addHover ? 'px-3.5' : 'w-10'}`}>
              <Plus className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2.2} />
              {addHover && <span className="whitespace-nowrap text-[13px] font-semibold">Új műszak</span>}
            </motion.button>
          </motion.div>
        </div>

        <div ref={folderRef} className="sched-folder rounded-[34px] bg-[rgba(255,255,255,.55)] p-4 pt-[64px] shadow-[0_24px_60px_-34px_rgba(70,60,20,.4)] backdrop-blur-[18px] sm:p-5 sm:pt-[68px]">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.9fr_0.95fr] lg:items-start">
        {/* ── BAL: csapat-lista VAGY (nap kijelölésekor) az aznap dolgozók ── */}
        <div className="rounded-[26px] dav-card-glass p-3.5">
          <AnimatePresence mode="wait" initial={false}>
            {selectedDay ? (
              <motion.div key="day" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                <div className="mb-3 flex items-center gap-2">
                  <button type="button" onClick={() => setSelectedDay(null)} title="Vissza a csapathoz" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-paper text-ink-soft transition-colors hover:text-ink">
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-ink">{Number(selectedDay.slice(8))}. {MONTHS[m]}</div>
                    <div className="text-[11.5px] font-medium text-ink-soft">{selectedDayShifts.length} fő beosztva</div>
                  </div>
                </div>
                {birthdaysOn(selectedDay).length > 0 && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-[12px] bg-[#FBEFF3] px-2.5 py-1.5 text-[11.5px] font-medium text-[#C2557A]">
                    <Cake className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.9} /> <span className="truncate">{birthdaysOn(selectedDay).map((b) => b.name.split(' ')[0]).join(', ')}</span>
                  </div>
                )}
                {selectedDayShifts.length === 0 ? (
                  <div className="rounded-[16px] bg-[#FBF9F2] px-3 py-8 text-center text-[12.5px] text-ink-soft">Erre a napra még senki sincs beosztva.</div>
                ) : (
                  <div className="space-y-3">
                    {dayGroups.map(([role, list]) => (
                      <div key={role}>
                        <div className="mb-1.5 flex items-center gap-1.5 px-1">
                          <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-soft2">{role}</span>
                          <span className="rounded-full bg-[#F0EAD8] px-1.5 py-0.5 text-[9px] font-bold text-ink-soft">{list.length}</span>
                          {isLeadRole(role) && <span className="rounded-full bg-ink-dark px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-gold">Vezető</span>}
                        </div>
                        {list.map((s) => {
                          const st = staffById.get(s.staffId)
                          const cs = chipStyle(s.type)
                          const active = st?.id === sel?.id
                          return (
                            <button type="button" key={s.id} onClick={() => st && setSelStaff(st.id)} className="mb-1 flex w-full items-center gap-2.5 rounded-[14px] p-2 text-left transition-colors hover:bg-paper" style={active ? { background: '#FBF7EC' } : undefined}>
                              <Ava url={st?.avatarUrl} ini={st?.ini ?? '?'} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: cs.bg, color: cs.fg, boxShadow: st?.avatarUrl ? `0 0 0 2px ${cs.bg}` : undefined }} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-semibold text-ink">{st?.name ?? 'Ismeretlen'}</div>
                                <div className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                                  {s.left_early_at && <LogOut className="h-3 w-3 flex-shrink-0 text-[#C0392B]" strokeWidth={2} />}
                                  <span className="truncate">{statusLabel(s)}</span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setDayEditor(selectedDay)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink-dark py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-ink">
                  <Plus className="h-4 w-4 text-gold" strokeWidth={2.2} /> Nap szerkesztése
                </button>
              </motion.div>
            ) : (
              <motion.div key="team" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                {staff.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[13px] text-ink-soft">Még nincs munkatárs. A Munkatársak oldalon vehetsz fel.</div>
                ) : rosterStaff.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[13px] text-ink-soft">Nincs találat a keresésre.</div>
                ) : (
                  rosterStaff.map((st) => {
                    const active = st.id === sel?.id
                    const util = utilization(st)
                    return (
                      <button
                        type="button"
                        key={st.id}
                        onClick={() => setSelStaff(st.id)}
                        className="mb-1.5 flex w-full items-center gap-3 rounded-[18px] p-3 text-left transition-colors"
                        style={active ? { background: '#FBF7EC' } : undefined}
                      >
                        <Ava
                          url={st.avatarUrl}
                          ini={st.ini}
                          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
                          style={active ? { background: '#F1CE45', color: '#1D1C19' } : { background: '#EDE7D7', color: '#86826F' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold text-ink">{st.name}</div>
                          <div className="truncate text-[12px] font-medium text-ink-soft">{st.role || 'Munkatárs'}</div>
                          <div className="mt-2 h-[6px] overflow-hidden rounded-[3px] bg-[#EAE5D6]">
                            <div className="h-full rounded-[3px]" style={{ width: `${util}%`, background: util >= 55 ? '#F1CE45' : '#1D1C19' }} />
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── KÖZÉP: fejléc + globális naptár ── */}
        <div className="rounded-[26px]">
          <div className="flex items-start justify-between gap-3">
            <div className="text-[28px] font-light tracking-[-0.02em] text-ink lg:text-[32px]">
              {Math.round(totalWorked)} óra <span className="text-[16px] text-ink-soft lg:text-[18px]">· {sel?.name ?? '—'}</span>
            </div>
            <div className="mt-1 flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
              {/* Hónapléptető a közép-tartalomban (Crextio-módra): ‹ Hónap Év ▾ › + választó popover */}
              {!onCurrentMonth && (
                <button type="button" onClick={goToday} title="Vissza a mai hónapra" className="rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft shadow-dav-card transition-colors hover:text-ink">Ma</button>
              )}
              <div className="flex items-center gap-0.5 rounded-full border border-line bg-white p-1 shadow-dav-card">
                <button type="button" onClick={prevMonth} aria-label="Előző hónap" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper"><ChevronLeft className="h-4 w-4" strokeWidth={2} /></button>
                <span className="min-w-[62px] px-1.5 text-center text-[13px] font-semibold text-ink">{MONTHS[m]}</span>
                <button type="button" onClick={nextMonth} aria-label="Következő hónap" className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"><ChevronRight className="h-4 w-4" strokeWidth={2} /></button>
              </div>
            </div>
          </div>

          {/* összesítő PILLEK (kiválasztott dolgozó hónapja) — betöltéskor animálnak, mint az Áttekintésen:
              arányos szélesség + felszámoló szám. A key=sel.id → személyváltáskor újra lejátszódik. */}
          {(() => {
            const tot = Math.max(1, daysWorked + sickDays + vacationDays)
            const pctOf = (x: number) => Math.round((x / tot) * 100)
            return (
              <StatusPills
                key={sel?.id ?? 'none'}
                eager
                className="mt-4"
                segments={[
                  { label: 'Ledolgozott', pct: pctOf(daysWorked), value: daysWorked, suffix: ' nap', background: '#F1CE45', color: '#1D1C19' },
                  { label: 'Hiányzás', pct: pctOf(sickDays), value: sickDays, suffix: ' nap', background: '#1D1C19', color: '#fff' },
                  { label: 'Szabadság', pct: pctOf(vacationDays), value: vacationDays, suffix: ' nap', background: HATCH, color: '#5C5848', border: '1px solid var(--dav-line-strong)', align: 'end' },
                ]}
              />
            )
          })()}

          {/* naptár fejléc */}
          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
            {WD.map((w, i) => (
              <div key={w} className="pl-1 text-[11px] font-medium" style={{ color: i >= 5 ? '#C98A2E' : '#A8A496' }}>{w}</div>
            ))}
          </div>
          {/* naptár — MINDIG látszik; napra kattintva kijelölöd (bal panel „Aznap"), a „+" a nap szerkesztője */}
          <div className="mt-2 overflow-hidden">
            <AnimatePresence mode="wait" custom={navDir} initial={false}>
              <motion.div
                key={monthPrefix}
                custom={navDir}
                variants={{
                  enter: (d: number) => ({ opacity: 0, x: d * 26 }),
                  center: { opacity: 1, x: 0 },
                  exit: (d: number) => ({ opacity: 0, x: d * -26 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                className="grid grid-cols-7 gap-1.5 sm:gap-2"
              >
            {cells.map((c, i) => {
              if (!c.inMonth) return <div key={i} className="min-h-[62px] rounded-[10px] sm:min-h-[84px] sm:rounded-[14px]" style={{ background: 'rgba(255,255,255,.25)' }} />
              const dayAll = c.date ? byDate.get(c.date) ?? [] : [] // TELJES nap (fedettséghez)
              const dayShifts = filtersActive ? dayAll.filter(passesFilter) : dayAll // szűrt (chipekhez)
              const isToday = c.date === todayStr
              const isSelDay = c.date === selectedDay
              const bdays = c.date ? birthdaysOn(c.date) : []
              // Fedettség: fedetlen = mai/jövőbeli HÉTKÖZNAP (H–P) 0 beosztással (a TELJES napból) → halvány figyelmeztetés.
              const dow = new Date(y, m, c.day).getDay() // 0=vas … 6=szo
              const isUncovered = !isSelDay && c.date != null && c.date >= todayStr && isWatchedDow(dow) && dayAll.length === 0
              return (
                <div key={i} className="group relative">
                  <button
                    type="button"
                    onClick={() => c.date && setSelectedDay(c.date)}
                    className="flex min-h-[62px] w-full flex-col rounded-[10px] border p-1.5 text-left transition-all sm:min-h-[84px] sm:rounded-[14px] sm:p-2"
                    style={{
                      background: isSelDay ? 'rgba(241,206,69,.24)' : isToday ? 'rgba(241,206,69,.1)' : 'rgba(255,255,255,.6)',
                      borderColor: isSelDay ? '#E0B325' : isUncovered ? 'rgba(232,162,61,.65)' : isToday ? 'rgba(241,206,69,.5)' : 'rgba(120,110,70,.1)',
                      borderStyle: isUncovered ? 'dashed' : 'solid',
                      boxShadow: isSelDay ? '0 0 0 1.5px rgba(224,179,37,.55)' : undefined,
                      // „Csak fedetlen": a nem-fedetlen napok elhalványulnak, hogy a lyukak kiugorjanak.
                      opacity: onlyUncovered && !isUncovered && !isSelDay ? 0.35 : 1,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`text-[12px] font-semibold sm:text-[13px] ${isToday || isSelDay ? 'text-ink' : 'text-ink-soft'}`}>{c.day}</span>
                      {bdays.length > 0 && <Cake className="h-3 w-3 text-[#C2557A] sm:h-3.5 sm:w-3.5" strokeWidth={1.9} />}
                      {c.date && (tips[c.date] ?? 0) > 0 && <Coins className="h-3 w-3 text-[#C9A227] sm:h-3.5 sm:w-3.5" strokeWidth={2} aria-label="Van napi borravaló" />}
                      <span className="ml-auto flex items-center">
                        {dayShifts.length > 0 ? (
                          <span className="rounded-full bg-[#F0EAD8] px-1.5 text-[8.5px] font-bold text-ink-soft sm:text-[9px]">{dayShifts.length}</span>
                        ) : isUncovered ? (
                          <span className="h-[7px] w-[7px] rounded-full" style={{ background: '#E8A23D' }} title="Fedetlen nap" />
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-[3px]">
                      {(() => {
                        // Kiemeléskor a fókuszált dolgozó chipje ELŐRE kerül, hogy a 4 látható közt mindig ott legyen.
                        const ordered = focusPerson && sel ? [...dayShifts].sort((a, b) => Number(b.staffId === sel.id) - Number(a.staffId === sel.id)) : dayShifts
                        return (
                          <>
                            {ordered.slice(0, 4).map((s) => {
                              const st = staffById.get(s.staffId)
                              const cs = chipStyle(s.type)
                              const isSelSt = st?.id === sel?.id
                              const dim = focusPerson && !selectedDay && !isSelSt // személy-fókusz: a többi halványul
                              return <span key={s.id} title={`${st?.name ?? ''} · ${statusLabel(s)}`} className="flex h-[19px] w-[19px] items-center justify-center rounded-full text-[8.5px] font-bold transition-opacity sm:h-[22px] sm:w-[22px] sm:text-[9.5px]" style={{ background: cs.bg, color: cs.fg, boxShadow: isSelSt ? '0 0 0 1.5px #1D1C19' : undefined, opacity: dim ? 0.2 : 1 }}>{st?.ini ?? '?'}</span>
                            })}
                            {ordered.length > 4 && <span className="flex h-[19px] items-center rounded-full bg-[#EDE7D7] px-1.5 text-[8.5px] font-bold text-ink-soft sm:h-[22px] sm:text-[9.5px]">+{ordered.length - 4}</span>}
                          </>
                        )
                      })()}
                    </div>
                  </button>
                  {/* + : NAP SZERKESZTÉSE (nem ceruza) — hoveren, a kijelölt napon mindig látszik */}
                  {c.date && (
                    <button
                      type="button"
                      onClick={() => { setSelectedDay(c.date); setDayEditor(c.date) }}
                      title="Nap szerkesztése"
                      className={`absolute right-1 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-ink-dark text-gold shadow-[0_2px_6px_rgba(40,35,15,.35)] transition-opacity sm:right-1.5 sm:top-1.5 ${isSelDay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              )
            })}
              </motion.div>
            </AnimatePresence>
          </div>
          {shifts.length === 0 && (
            <div className="mt-3 flex items-center gap-2.5 rounded-[14px] border border-dashed border-line-strong bg-[#FBF9F2] px-4 py-3 text-[12.5px] text-ink-soft">
              <CalendarClock className="h-4 w-4 flex-shrink-0 text-gold" strokeWidth={1.9} />
              <span>Még nincs egy beosztás sem. Vidd az egeret egy napra, és a <b className="font-semibold text-ink">+</b> gombbal vedd fel az elsőt.</span>
            </div>
          )}
          {/* Fedettség-mérő: a hónap hátralévő hétköznapjainak lefedettsége — beosztás-írás hatékonyságához */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold" style={uncoveredCount > 0 ? { background: '#FBEEDD', color: '#B26B18' } : { background: '#E7F1E9', color: '#3B6B4B' }}>
              <span className="h-2 w-2 rounded-full" style={{ background: uncoveredCount > 0 ? '#E8A23D' : '#4F9E6A' }} />
              {uncoveredCount > 0 ? `${uncoveredCount} fedetlen ${coverWeekends ? 'nap' : 'hétköznap'}` : `Minden ${coverWeekends ? 'nap' : 'hétköznap'} lefedve`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F1EA] px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft">
              <User className="h-3 w-3" strokeWidth={2} /> {peopleScheduled} fő beosztva
            </span>
            {filtersActive && (
              <button type="button" onClick={() => { setTypeFilter('all'); setPosFilter('all'); setQuery('') }} className="inline-flex items-center gap-1.5 rounded-full bg-ink-dark px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-ink">
                Szűrő törlése <X className="h-3 w-3" strokeWidth={2.4} />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-ink-soft">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-gold" />Műszak</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-ink-dark" />Betegszabadság</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: '#E4DECC' }} />Szabadság</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed" style={{ borderColor: '#E8A23D' }} />Fedetlen nap</span>
            <span className="inline-flex items-center gap-1.5"><LogOut className="h-3 w-3 text-[#C0392B]" strokeWidth={2} />Korai távozás</span>
          </div>
        </div>

        {/* ── JOBB: profil (KOMPAKT fejléc — nincs borítókép-banner, hogy ne legyen magasabb a bal oldalnál) ── */}
        {sel ? (
          <div className="overflow-hidden rounded-[26px] dav-card-glass">
            <div className="flex items-center gap-3 px-6 pb-4 pt-6">
              <Ava url={sel.avatarUrl} ini={sel.ini} className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold" style={{ background: '#F1CE45', color: '#1D1C19' }} />
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold text-ink">{sel.name}</div>
                <div className="truncate text-[13px] font-medium text-ink-soft">{sel.role || 'Munkatárs'}</div>
              </div>
            </div>

            <div className="px-6 pb-2">
              <div className="mb-3 text-[14px] font-semibold text-ink">Alapadatok</div>
              {([
                ['Születésnap', fmtHu(sel.birthday)],
                ['Belépés', fmtHu(sel.join_date)],
                ['Telefon', sel.phone ?? '—'],
                ['Heti óraszám', sel.weekly_hours != null ? `${sel.weekly_hours} óra` : '—'],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-dashed py-2.5" style={{ borderColor: 'rgba(120,110,70,.18)' }}>
                  <span className="text-[12.5px] font-medium text-ink-soft">{k}</span>
                  <span className="text-[12.5px] font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>

            {/* Beosztás: következő műszak + e heti (H–V) mini-csík a valós hétből */}
            <div className="px-6 pb-2 pt-4">
              <div className="mb-3 text-[14px] font-semibold text-ink">Beosztás</div>
              <div className="mb-3 flex items-center justify-between rounded-[14px] bg-[#FBF9F2] px-3.5 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft"><CalendarClock className="h-3.5 w-3.5" strokeWidth={1.8} /> Következő műszak</span>
                <span className="text-[12.5px] font-semibold text-ink">{nextShift ? `${fmtShort(nextShift.date)}${nextShift.start_time ? ` · ${nextShift.start_time}` : ''}` : 'Nincs'}</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDates.map((d, i) => {
                  const sh = weekShift(d)
                  const cs = sh ? chipStyle(sh.type) : null
                  const isTd = d === todayStr
                  return (
                    <div key={d} className="flex flex-col items-center gap-1">
                      <span className="text-[9.5px] font-semibold" style={{ color: isTd ? '#1D1C19' : '#A8A496' }}>{WEEK_MINI[i]}</span>
                      <span
                        className="flex h-7 w-full items-center justify-center rounded-[8px] text-[9px] font-bold"
                        title={sh ? statusLabel(sh) : 'Nincs beosztva'}
                        style={{ ...(sh ? { background: cs!.bg, color: cs!.fg } : { background: '#F3F1EA', color: '#C5C0B0' }), boxShadow: isTd ? '0 0 0 1.5px #E0B325' : undefined }}
                      >
                        {sh ? (sh.type === 'shift' && sh.start_time ? sh.start_time.slice(0, 2) : '•') : '–'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Ledolgozott óra (e hó) — TISZTA sor (nincs teljes-szélességű sáv-sín, ami „kihúzottnak" tűnt) */}
              <div className="mt-3 flex items-center justify-between rounded-[14px] bg-[#FBF9F2] px-3.5 py-2.5">
                <span className="text-[12px] font-medium text-ink-soft">Ledolgozott óra — e hó</span>
                <span className="text-[12.5px] font-semibold text-ink">
                  {monthWorked} ó{monthTarget ? ` / ${monthTarget} ó` : ''}
                  {monthTarget && monthWorked > monthTarget ? <span className="ml-1 text-[#C0453F]">(+{monthWorked - monthTarget})</span> : null}
                </span>
              </div>
            </div>

            <div className="px-6 pb-7 pt-4">
              <div className="mb-3.5 text-[14px] font-semibold text-ink">Statisztika (hó)</div>
              {([
                ['Betegszabadság', `${Math.round(sick / 8)} nap`, Math.min(100, (sick / 40) * 100), '#1D1C19'],
                ['Szabadság', `${vacationDays} nap`, Math.min(100, (vacationDays / 22) * 100), '#E4DECC'],
              ] as const).map(([l, v, w, c]) => (
                <div key={l} className="mb-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-ink-soft">{l}</span>
                    <span className="text-[12.5px] font-semibold text-ink">{v}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-[#EAE5D6]">
                    <div className="h-full rounded-[3px]" style={{ width: `${w}%`, background: c }} />
                  </div>
                </div>
              ))}
              {sel.phone && (
                <a href={`tel:${sel.phone}`} className="mt-2 flex items-center justify-center gap-2 rounded-[16px] bg-[#F6F2E4] py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-[#EFE9D6]">
                  <Phone className="h-4 w-4" strokeWidth={1.7} /> Hívás
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] dav-card-glass p-6 text-center text-[13px] text-ink-soft">Válassz munkatársat.</div>
        )}
          </div>
        </div>
      </div>

      {dayEditor && (
        <DayEditor
          key={dayEditor}
          date={dayEditor}
          staff={staff}
          staffById={staffById}
          dayShifts={byDate.get(dayEditor) ?? []}
          busy={busy}
          isRestaurant={isRestaurant}
          dayTip={tips[dayEditor] ?? 0}
          onSaveTips={(amount) => saveTips(dayEditor, amount)}
          onAdd={(staffId, p) => addShift(staffId, p, dayEditor)}
          onEdit={(id, p) => editShift(id, p)}
          onDelete={deleteShift}
          onClose={() => setDayEditor(null)}
        />
      )}
    </div>
  )
}

/* ── Nap-szerkesztő: az aznapi bejegyzések (MÓDOSÍTHATÓ + törölhető) + ember hozzáadása
 *   (a már beosztottak KIHAGYVA), plusz státuszváltás (korai távozás — beteg lett / hazament). ── */
function DayEditor({
  date, staff, staffById, dayShifts, busy, isRestaurant, dayTip, onSaveTips, onAdd, onEdit, onDelete, onClose,
}: {
  date: string
  staff: StaffVM[]
  staffById: Map<string, StaffVM>
  dayShifts: ShiftVM[]
  busy: boolean
  isRestaurant: boolean
  dayTip: number
  onSaveTips: (amount: number) => Promise<boolean>
  onAdd: (staffId: string, p: ShiftInput) => Promise<boolean>
  onEdit: (id: string, p: ShiftInput) => Promise<boolean>
  onDelete: (s: ShiftVM) => void
  onClose: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState('')
  const [type, setType] = useState<ShiftType>('shift')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [note, setNote] = useState('')
  const [leftEarly, setLeftEarly] = useState(false)
  const [leftAt, setLeftAt] = useState('12:00')
  const [leftReason, setLeftReason] = useState<'sick' | 'personal'>('sick')
  const [tipInput, setTipInput] = useState(dayTip > 0 ? String(dayTip) : '')

  // #2 — a hozzáadásnál CSAK a még be nem osztott munkatársak választhatók.
  const scheduledIds = new Set(dayShifts.map((s) => s.staffId))
  const available = staff.filter((st) => !scheduledIds.has(st.id))
  const effStaffId = editingId ? staffId : available.some((s) => s.id === staffId) ? staffId : available[0]?.id ?? ''
  const editingStaff = editingId ? staffById.get(staffId) : null

  const resetForm = () => {
    setEditingId(null); setType('shift'); setStart('09:00'); setEnd('17:00'); setNote('')
    setLeftEarly(false); setLeftAt('12:00'); setLeftReason('sick')
  }
  const startEdit = (s: ShiftVM) => {
    setEditingId(s.id); setStaffId(s.staffId); setType(s.type)
    setStart(s.start_time ?? '09:00'); setEnd(s.end_time ?? '17:00'); setNote(s.note ?? '')
    setLeftEarly(!!s.left_early_at); setLeftAt(s.left_early_at ?? '12:00'); setLeftReason(s.left_early_reason ?? 'sick')
  }
  const submit = async () => {
    const p: ShiftInput = {
      type, start_time: start, end_time: end, note,
      left_early_at: type === 'shift' && leftEarly ? leftAt : null,
      left_early_reason: type === 'shift' && leftEarly ? leftReason : null,
    }
    const ok = editingId ? await onEdit(editingId, p) : effStaffId ? await onAdd(effStaffId, p) : false
    if (ok) resetForm()
  }

  const inp = 'w-full rounded-[13px] border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink focus:outline-none'

  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-t-[26px] bg-white p-5 shadow-dav-card sm:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[17px] font-semibold text-ink">Nap szerkesztése</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-ink-soft">{fmtHu(date)} · {dayShifts.length} fő</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F2E4] text-ink">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Napi KÖZPONTI borravaló (étterem) — az aznap dolgozó jogosultak közt oszlik el */}
        {isRestaurant && (
          <div className="mb-4 rounded-[16px] border border-line bg-[#FCFBF7] p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink"><Coins className="h-4 w-4 text-[#C9A227]" strokeWidth={2} /> Napi borravaló</div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input type="number" inputMode="numeric" min={0} value={tipInput} onChange={(e) => setTipInput(e.target.value)} placeholder="0" className="w-full rounded-[13px] border border-line bg-white px-3 py-2.5 pr-9 text-[14px] font-semibold text-ink focus:outline-none" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-ink-soft2">Ft</span>
              </div>
              <button
                type="button"
                disabled={busy || (tipInput === '' ? dayTip === 0 : Math.round(Number(tipInput)) === dayTip)}
                onClick={() => onSaveTips(tipInput === '' ? 0 : Number(tipInput))}
                className="flex-shrink-0 rounded-[13px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-ink disabled:opacity-50"
              >
                Mentés
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-soft2">Az aznap dolgozó, borravalóra jogosult munkatársak közt oszlik el; a profil havi szinten összegzi.</p>
          </div>
        )}

        {/* aznapi bejegyzések — módosítható / törölhető */}
        <div className="mb-4 flex flex-col gap-2 overflow-y-auto" data-lenis-prevent>
          {dayShifts.length === 0 ? (
            <div className="rounded-[14px] bg-[#FBF9F2] px-4 py-3 text-center text-[12.5px] text-ink-soft">Erre a napra még senki sincs beosztva.</div>
          ) : (
            dayShifts.map((s) => {
              const st = staffById.get(s.staffId)
              const cs = chipStyle(s.type)
              const isEditing = editingId === s.id
              return (
                <div key={s.id} className="flex items-center gap-2.5 rounded-[14px] p-2.5" style={{ background: isEditing ? '#FBF7EC' : '#FBF9F2', boxShadow: isEditing ? 'inset 0 0 0 1.5px rgba(224,179,37,.6)' : undefined }}>
                  <Ava url={st?.avatarUrl} ini={st?.ini ?? '?'} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: cs.bg, color: cs.fg, boxShadow: st?.avatarUrl ? `0 0 0 2px ${cs.bg}` : undefined }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{st?.name ?? 'Ismeretlen'}</div>
                    <div className="flex items-center gap-1 text-[11.5px] font-medium text-ink-soft">
                      {s.left_early_at && <LogOut className="h-3 w-3 flex-shrink-0 text-[#C0392B]" strokeWidth={2} />}
                      <span className="truncate">{statusLabel(s)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => startEdit(s)} className="flex-shrink-0 rounded-full bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-ink shadow-[0_1px_3px_rgba(70,60,20,.1)] transition-colors hover:bg-paper">Módosít</button>
                  <button type="button" disabled={busy} onClick={() => { if (editingId === s.id) resetForm(); onDelete(s) }} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FBECEC] text-[#C0392B] disabled:opacity-60">
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* hozzáadás VAGY módosítás */}
        <div className="rounded-[18px] border border-line bg-[#FCFBF7] p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="truncate text-[12.5px] font-semibold text-ink">{editingId ? `Módosítás — ${editingStaff?.name ?? ''}` : 'Ember hozzáadása'}</span>
            {editingId && <button type="button" onClick={resetForm} className="flex-shrink-0 text-[11.5px] font-medium text-ink-soft transition-colors hover:text-ink">Mégse</button>}
          </div>

          {!editingId && available.length === 0 ? (
            <div className="rounded-[12px] bg-white px-3 py-2.5 text-center text-[12px] text-ink-soft">{staff.length === 0 ? 'Nincs munkatárs.' : 'Mindenki be van osztva erre a napra.'}</div>
          ) : (
            <>
              {!editingId && (
                <div className="relative mb-2.5">
                  <select value={effStaffId} onChange={(e) => setStaffId(e.target.value)} className="w-full cursor-pointer appearance-none rounded-[13px] border border-line bg-white px-3 py-2.5 pr-9 text-[13.5px] font-medium text-ink focus:outline-none">
                    {available.map((st) => (<option key={st.id} value={st.id}>{st.name}</option>))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft2" strokeWidth={1.8} />
                </div>
              )}
              <div className="mb-2.5 grid grid-cols-2 gap-2">
                {(['shift', 'vacation', 'sick', 'leave'] as ShiftType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)} className="rounded-[13px] px-3 py-2 text-[12px] font-semibold transition-colors" style={type === t ? { background: '#1D1C19', color: '#fff' } : { background: '#fff', color: '#5C5848', border: '1px solid var(--dav-line)' }}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              {type === 'shift' && (
                <>
                  <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">Kezdés</span>
                      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inp} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">Vége</span>
                      <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inp} />
                    </label>
                  </div>
                  {/* Státuszváltás: korai távozás (pl. délben beteg lett / hazament) — egy soron marad, nincs duplázás */}
                  <div className="mb-2.5 rounded-[13px] border border-line bg-white p-2.5">
                    <button type="button" onClick={() => setLeftEarly((v) => !v)} className="flex w-full items-center gap-2.5">
                      <span className={`flex h-[22px] w-[38px] flex-shrink-0 items-center rounded-full px-0.5 transition-colors ${leftEarly ? 'justify-end bg-ink-dark' : 'justify-start bg-line-strong'}`}>
                        <span className="h-[18px] w-[18px] rounded-full bg-white" />
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><LogOut className="h-3.5 w-3.5 text-ink-soft" strokeWidth={1.9} /> Korai távozás</span>
                    </button>
                    {leftEarly && (
                      <div className="mt-2.5 grid grid-cols-[1fr_auto] items-end gap-2.5">
                        <label className="block">
                          <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">Mikor ment el</span>
                          <input type="time" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} className={inp} />
                        </label>
                        <div className="flex gap-1.5">
                          {(['sick', 'personal'] as const).map((r) => (
                            <button key={r} type="button" onClick={() => setLeftReason(r)} className="rounded-[11px] px-2.5 py-2 text-[11.5px] font-semibold transition-colors" style={leftReason === r ? { background: r === 'sick' ? '#1D1C19' : '#E4DECC', color: r === 'sick' ? '#fff' : '#5C5848' } : { background: '#fff', color: '#8A8779', border: '1px solid var(--dav-line)' }}>
                              {r === 'sick' ? 'Beteg lett' : 'Hazament'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Megjegyzés (opcionális)" className={`mb-3 ${inp} placeholder:text-ink-soft2`} />
              <button type="button" disabled={busy || (!editingId && !effStaffId)} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink-dark py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60">
                <Plus className="h-4 w-4 text-gold" strokeWidth={2.2} /> {editingId ? 'Változás mentése' : 'Beosztom erre a napra'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
