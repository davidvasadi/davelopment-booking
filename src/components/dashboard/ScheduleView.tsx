'use client'

/**
 * BEOSZTÁS (globális) — a KÖZÉP naptár a CSAPAT beosztása: minden nap-cellában a beosztott
 * emberek avatar-chipjei; egy napra kattintva bárkit BE lehet pakolni (nap-szerkesztő:
 * személy + típus + idő). A bal lista a jobb HR-profilt és a fejléc-statot választja.
 * Referencia: Crextio „Salary" layout. CRUD: Payload REST `/api/shifts` (credentials:'include').
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Phone, Cake, Trash2, X } from 'lucide-react'

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
}

export interface StaffVM {
  id: string
  name: string
  ini: string
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
}

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const WD = ['Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas']
const HATCH = 'repeating-linear-gradient(45deg,#E4DECC 0 6px,#F1ECDD 6px 12px)'

/**
 * Mappa-notch maszk (davelopment Naptar.dc.html): a folder-kártya tetejére középre vágott
 * „fül-rés". A maszk fix pixel-szélességű, ezért REszponzív: mobilon kisebb notch (media query),
 * különben keskeny kártyán túlnyúlik az ív.
 */
const NOTCH_SVG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='70'%3E%3Cpath d='M52 0Q64 0 64 24V38A26 26 0 0 0 90 64H510A26 26 0 0 0 536 38V24Q536 0 548 0Z' fill='white'/%3E%3C/svg%3E\")"
const NOTCH_CSS = `.sched-folder{
  -webkit-mask-image:${NOTCH_SVG},linear-gradient(#000,#000);
  -webkit-mask-repeat:no-repeat,no-repeat;-webkit-mask-position:center top,center;
  -webkit-mask-size:300px 58px,100% 100%;-webkit-mask-composite:xor;
  mask-image:${NOTCH_SVG},linear-gradient(#000,#000);
  mask-repeat:no-repeat,no-repeat;mask-position:center top,center;
  mask-size:300px 58px,100% 100%;mask-composite:exclude;
}
@media(min-width:640px){.sched-folder{-webkit-mask-size:560px 70px,100% 100%;mask-size:560px 70px,100% 100%;}}`

const TYPE_LABEL: Record<ShiftType, string> = { shift: 'Műszak', leave: 'Szabadság', sick: 'Betegszabadság', vacation: 'Fizetett szabadság' }

/** Chip-szín típusonként (avatar-chip a nap-cellában és a nap-szerkesztőben). */
function chipStyle(type: ShiftType): { bg: string; fg: string } {
  if (type === 'sick') return { bg: '#1D1C19', fg: '#fff' }
  if (type === 'leave' || type === 'vacation') return { bg: '#E4DECC', fg: '#5C5848' }
  return { bg: '#F1CE45', fg: '#1D1C19' } // shift
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

export function ScheduleView({ variant = 'salon', salonId, restaurantId, staff, shifts: initialShifts, year, month }: Props) {
  const isRestaurant = variant === 'restaurant'
  const router = useRouter()
  const [shifts, setShifts] = useState<ShiftVM[]>(initialShifts)
  const [y, setY] = useState(year)
  const [m, setM] = useState(month)
  const [selStaff, setSelStaff] = useState<string>(staff[0]?.id ?? '')
  const [expandedDate, setExpandedDate] = useState<string | null>(null) // kinyitott nap (scale-kártya a konténerben)
  const [dayEditor, setDayEditor] = useState<string | null>(null) // „ember bepakolása" modal
  const [busy, setBusy] = useState(false)

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

  // Kinyitott nap: a beosztottak POZÍCIÓ (role) szerint csoportosítva — vezető/supervisor elöl.
  const expShifts = expandedDate ? byDate.get(expandedDate) ?? [] : []
  const isLeadRole = (r: string) => /vezet|superv|manager|menedzs|főnök|head/i.test(r)
  const dayGroups = (() => {
    const map = new Map<string, ShiftVM[]>()
    for (const s of expShifts) {
      const r = staffById.get(s.staffId)?.role?.trim() || 'Egyéb'
      const arr = map.get(r) ?? []
      arr.push(s)
      map.set(r, arr)
    }
    return Array.from(map.entries()).sort((a, b) => (isLeadRole(a[0]) ? 0 : 1) - (isLeadRole(b[0]) ? 0 : 1) || a[0].localeCompare(b[0], 'hu'))
  })()

  function prevMonth() {
    if (m === 0) { setM(11); setY(y - 1) } else setM(m - 1)
  }
  function nextMonth() {
    if (m === 11) { setM(0); setY(y + 1) } else setM(m + 1)
  }

  // ── CRUD ──
  async function addShift(staffId: string, payload: { type: ShiftType; start_time: string; end_time: string; note: string }, date: string) {
    const st = staffById.get(staffId)
    if (!st) return
    setBusy(true)
    const hours = payload.type === 'shift' ? diffHours(payload.start_time || null, payload.end_time || null) : null
    const body = {
      ...(isRestaurant ? { member: staffId, restaurant: restaurantId } : { staff: staffId, salon: salonId }),
      date,
      type: payload.type,
      start_time: payload.type === 'shift' ? payload.start_time || null : null,
      end_time: payload.type === 'shift' ? payload.end_time || null : null,
      hours,
      note: payload.note || null,
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
      const vm: ShiftVM = { id: String(doc.id), staffId, date, type: payload.type, start_time: body.start_time, end_time: body.end_time, hours, note: body.note }
      setShifts((prev) => [...prev, vm])
      router.refresh()
    } catch {
      alert('Nem sikerült beosztani.')
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

  return (
    <div className="p-4 font-onest lg:p-0">
      {/* ── MAPPA-konténer: az egész tartalom egy folder-kártyában, tetején notch + lebegő hónap-kapszula ── */}
      <style>{NOTCH_CSS}</style>
      <div className="relative">
        {/* lebegő hónap-kapszula a notch-ban */}
        <div className="absolute left-1/2 top-1 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-white/85 px-2 py-1.5 shadow-dav-card backdrop-blur">
          <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper">
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="min-w-[118px] text-center text-[13px] font-semibold text-ink">{MONTHS[m]} {y}</div>
          <button type="button" onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper">
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="sched-folder rounded-[34px] bg-[rgba(255,255,255,.55)] p-4 pt-16 shadow-[0_24px_60px_-34px_rgba(70,60,20,.4)] backdrop-blur-[18px] sm:p-5 sm:pt-20">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.9fr_0.95fr] lg:items-start">
        {/* ── BAL: staff-lista ── */}
        <div className="rounded-[26px] border border-line bg-white p-3.5 shadow-dav-card">
          {staff.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-ink-soft">Még nincs munkatárs. A Munkatársak oldalon vehetsz fel.</div>
          ) : (
            staff.map((st) => {
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
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
                    style={active ? { background: '#F1CE45', color: '#1D1C19' } : { background: '#EDE7D7', color: '#86826F' }}
                  >
                    {st.ini}
                  </div>
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
        </div>

        {/* ── KÖZÉP: fejléc + globális naptár ── */}
        <div className="rounded-[26px]">
          <div className="text-[28px] font-light tracking-[-0.02em] text-ink lg:text-[32px]">
            {Math.round(totalWorked)} óra <span className="text-[16px] text-ink-soft lg:text-[18px]">· {sel?.name ?? '—'}</span>
          </div>

          {/* összesítő sávok (kiválasztott dolgozó hónapja) */}
          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ink-soft">Ledolgozott</div>
              <div className="flex h-[42px] items-center rounded-[21px] bg-gold px-3 text-[14px] font-semibold text-ink-dark sm:px-[18px]">{Math.round(worked)} ó</div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ink-soft">Hiányzás</div>
              <div className="flex h-[42px] items-center rounded-[21px] bg-ink-dark px-3 text-[14px] font-semibold text-white sm:px-[18px]">{Math.round(sick)} ó</div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ink-soft">Szabadság</div>
              <div className="flex h-[42px] items-center rounded-[21px] px-3 text-[14px] font-semibold text-[#5C5848] sm:px-[18px]" style={{ background: HATCH }}>{Math.round(vacation)} ó</div>
            </div>
          </div>

          {/* naptár fejléc */}
          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
            {WD.map((w, i) => (
              <div key={w} className="pl-1 text-[11px] font-medium" style={{ color: i >= 5 ? '#C98A2E' : '#A8A496' }}>{w}</div>
            ))}
          </div>
          {/* naptár — a rács a helyén; napra kattintva a nap scale-lel akkorára nő, mint a naptár, a többi lecsúszik alá */}
          <div className="relative mt-2" style={{ minHeight: (cells.length / 7) * 92 }}>
            <motion.div
              className="grid grid-cols-7 gap-1.5 sm:gap-2"
              animate={{ y: expandedDate ? 48 : 0, opacity: expandedDate ? 0 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            >
              {cells.map((c, i) => {
                if (!c.inMonth) return <div key={i} className="min-h-[62px] rounded-[10px] sm:min-h-[84px] sm:rounded-[14px]" style={{ background: 'rgba(255,255,255,.25)' }} />
                const dayShifts = c.date ? byDate.get(c.date) ?? [] : []
                const isToday = c.date === todayStr
                const bdays = c.date ? birthdaysOn(c.date) : []
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => c.date && setExpandedDate(c.date)}
                    className="group relative flex min-h-[62px] flex-col rounded-[10px] border p-1.5 text-left sm:min-h-[84px] sm:rounded-[14px] sm:p-2"
                    style={{ background: isToday ? 'rgba(241,206,69,.16)' : 'rgba(255,255,255,.6)', borderColor: isToday ? 'rgba(241,206,69,.6)' : 'rgba(120,110,70,.1)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[12px] font-semibold sm:text-[13px] ${isToday ? 'text-ink' : 'text-ink-soft'}`}>{c.day}</span>
                      {bdays.length > 0 && <Cake className="h-3 w-3 text-[#C2557A] sm:h-3.5 sm:w-3.5" strokeWidth={1.9} />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-[3px]">
                      {dayShifts.slice(0, 4).map((s) => {
                        const st = staffById.get(s.staffId)
                        const cs = chipStyle(s.type)
                        const isSelSt = st?.id === sel?.id
                        return <span key={s.id} title={`${st?.name ?? ''} · ${TYPE_LABEL[s.type]}`} className="flex h-[19px] w-[19px] items-center justify-center rounded-full text-[8.5px] font-bold sm:h-[22px] sm:w-[22px] sm:text-[9.5px]" style={{ background: cs.bg, color: cs.fg, boxShadow: isSelSt ? '0 0 0 1.5px #1D1C19' : undefined }}>{st?.ini ?? '?'}</span>
                      })}
                      {dayShifts.length > 4 && <span className="flex h-[19px] items-center rounded-full bg-[#EDE7D7] px-1.5 text-[8.5px] font-bold text-ink-soft sm:h-[22px] sm:text-[9.5px]">+{dayShifts.length - 4}</span>}
                      {dayShifts.length === 0 && <span className="opacity-0 transition-opacity group-hover:opacity-100"><Plus className="h-3.5 w-3.5 text-ink-soft2" strokeWidth={2} /></span>}
                    </div>
                  </button>
                )
              })}
            </motion.div>

            {/* KINYITOTT nap — a konténerben, scale-animációval, naptár-méretű */}
            <AnimatePresence>
              {expandedDate && (
                <motion.div
                  key="sched-expand"
                  className="absolute inset-0 flex flex-col overflow-hidden rounded-[18px] border bg-white shadow-[0_30px_70px_-30px_rgba(40,35,15,.4)]"
                  style={{ borderColor: 'rgba(241,206,69,.6)' }}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                >
                  <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <div className="truncate text-[19px] font-semibold tracking-[-0.01em] text-ink">{Number(expandedDate.slice(8))}. {MONTHS[m]} · {expShifts.length} fő</div>
                      {birthdaysOn(expandedDate).length > 0 && <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-[#C2557A]"><Cake className="h-3.5 w-3.5" strokeWidth={1.9} />{birthdaysOn(expandedDate).map((b) => b.name.split(' ')[0]).join(', ')}</div>}
                    </div>
                    <button type="button" onClick={() => setExpandedDate(null)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F1EF] text-ink-soft hover:text-ink">
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5" data-lenis-prevent>
                    {expShifts.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-[16px] bg-[#FBF9F2] text-[13px] text-ink-soft">Erre a napra még senki sincs beosztva.</div>
                    ) : (
                      dayGroups.map(([role, list]) => (
                        <div key={role}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">{role}</span>
                            <span className="rounded-full bg-[#F0EAD8] px-2 py-0.5 text-[10px] font-bold text-ink-soft">{list.length}</span>
                            {isLeadRole(role) && <span className="rounded-full bg-[#1D1C19] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-gold">Vezető</span>}
                            <div className="ml-1 h-px flex-1 bg-[rgba(120,110,70,.14)]" />
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {list.map((s) => {
                              const st = staffById.get(s.staffId)
                              const cs = chipStyle(s.type)
                              const isSelSt = st?.id === sel?.id
                              return (
                                <div key={s.id} className="flex items-center gap-2.5 rounded-[14px] border border-line px-2.5 py-2 transition-colors hover:bg-[#FBF7EC]" style={isSelSt ? { background: '#FBF7EC', borderColor: 'rgba(241,206,69,.55)' } : undefined}>
                                  <button type="button" onClick={() => st && setSelStaff(st.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: cs.bg, color: cs.fg, boxShadow: isSelSt ? '0 0 0 1.5px #1D1C19' : undefined }}>{st?.ini ?? '?'}</span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-[13.5px] font-semibold text-ink">{st?.name ?? 'Ismeretlen'}</span>
                                      <span className="block truncate text-[11px] font-medium text-ink-soft">{TYPE_LABEL[s.type]}{s.type === 'shift' && s.start_time ? ` · ${s.start_time}–${s.end_time ?? ''}` : ''}</span>
                                    </span>
                                  </button>
                                  <button type="button" disabled={busy} onClick={() => deleteShift(s)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FBECEC] text-[#C0392B] disabled:opacity-60">
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-line p-3">
                    <button type="button" onClick={() => setDayEditor(expandedDate)} className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink-dark py-2.5 text-[13px] font-semibold text-white">
                      <Plus className="h-4 w-4 text-gold" strokeWidth={2.2} /> Ember bepakolása erre a napra
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-ink-soft">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-gold" />Műszak</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-ink-dark" />Betegszabadság</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: '#E4DECC' }} />Szabadság</span>
          </div>
        </div>

        {/* ── JOBB: profil ── */}
        {sel ? (
          <div className="overflow-hidden rounded-[26px] border border-line bg-white shadow-dav-card">
            <div className="relative h-[120px]" style={{ background: 'linear-gradient(120deg,#3a2f12,#9A7B1E 55%,#F1CE45)' }}>
              <div className="absolute bottom-[-34px] left-1/2 flex h-[74px] w-[74px] -translate-x-1/2 items-center justify-center rounded-full border-4 text-[22px] font-bold text-ink-dark" style={{ background: '#F1CE45', borderColor: '#FCFAF1' }}>
                {sel.ini}
              </div>
            </div>
            <div className="px-6 pb-4 pt-[46px] text-center">
              <div className="text-[19px] font-semibold text-ink">{sel.name}</div>
              <div className="mt-0.5 text-[13px] font-medium text-ink-soft">{sel.role || 'Munkatárs'}</div>
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

            <div className="px-6 pb-2 pt-4">
              <div className="mb-3 text-[14px] font-semibold text-ink">Dokumentumok</div>
              {sel.documents.length === 0 ? (
                <div className="text-[12px] text-ink-soft">Nincs feltöltött dokumentum.</div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {sel.documents.map((d, i) => (
                    <div key={i} className="flex flex-1 items-center gap-2.5 rounded-[14px] bg-[#FBF9F2] p-3">
                      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[#2A6FDB] text-[10px] font-bold text-white">{(d.label[0] || 'D').toUpperCase()}</div>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-ink">{d.label}</div>
                        <div className="text-[10px] font-medium text-ink-soft">{d.sizeLabel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 pb-7 pt-4">
              <div className="mb-3.5 text-[14px] font-semibold text-ink">Statisztika (hó)</div>
              {([
                ['Ledolgozott óra', `${Math.round(worked)} óra`, Math.min(100, ((sel.weekly_hours ?? 40) * 4) > 0 ? (worked / ((sel.weekly_hours ?? 40) * 4)) * 100 : 0), '#F1CE45'],
                ['Betegszabadság', `${Math.round(sick / 8)} nap`, Math.min(100, (sick / 40) * 100), '#1D1C19'],
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
          <div className="rounded-[26px] border border-line bg-white p-6 text-center text-[13px] text-ink-soft shadow-dav-card">Válassz munkatársat.</div>
        )}
          </div>
        </div>
      </div>

      {dayEditor && (
        <DayEditor
          date={dayEditor}
          staff={staff}
          staffById={staffById}
          dayShifts={byDate.get(dayEditor) ?? []}
          busy={busy}
          onAdd={(staffId, p) => addShift(staffId, p, dayEditor)}
          onDelete={deleteShift}
          onClose={() => setDayEditor(null)}
        />
      )}
    </div>
  )
}

/* ── Napra kattintva: a nap beosztásai + „ember bepakolása" ── */
function DayEditor({
  date, staff, staffById, dayShifts, busy, onAdd, onDelete, onClose,
}: {
  date: string
  staff: StaffVM[]
  staffById: Map<string, StaffVM>
  dayShifts: ShiftVM[]
  busy: boolean
  onAdd: (staffId: string, p: { type: ShiftType; start_time: string; end_time: string; note: string }) => void
  onDelete: (s: ShiftVM) => void
  onClose: () => void
}) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '')
  const [type, setType] = useState<ShiftType>('shift')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-t-[26px] bg-white p-5 shadow-dav-card sm:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[17px] font-semibold text-ink">Beosztás</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-ink-soft">{fmtHu(date)}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F2E4] text-ink">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* aznapi beosztások */}
        <div className="mb-4 flex flex-col gap-2 overflow-y-auto" data-lenis-prevent>
          {dayShifts.length === 0 ? (
            <div className="rounded-[14px] bg-[#FBF9F2] px-4 py-3 text-center text-[12.5px] text-ink-soft">Erre a napra még senki sincs beosztva.</div>
          ) : (
            dayShifts.map((s) => {
              const st = staffById.get(s.staffId)
              const cs = chipStyle(s.type)
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-[14px] bg-[#FBF9F2] p-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: cs.bg, color: cs.fg }}>{st?.ini ?? '?'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{st?.name ?? 'Ismeretlen'}</div>
                    <div className="text-[11.5px] font-medium text-ink-soft">
                      {TYPE_LABEL[s.type]}{s.type === 'shift' && s.start_time ? ` · ${s.start_time}–${s.end_time ?? ''}` : ''}
                    </div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => onDelete(s)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FBECEC] text-[#C0392B] disabled:opacity-60">
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* ember bepakolása */}
        <div className="rounded-[18px] border border-line bg-[#FCFBF7] p-3.5">
          <div className="mb-2.5 text-[12.5px] font-semibold text-ink">Ember bepakolása</div>
          {staff.length === 0 ? (
            <div className="text-[12px] text-ink-soft">Nincs munkatárs.</div>
          ) : (
            <>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="mb-2.5 w-full rounded-[13px] border border-line bg-white px-3 py-2.5 text-[13.5px] font-medium text-ink focus:outline-none"
              >
                {staff.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
              <div className="mb-2.5 grid grid-cols-2 gap-2">
                {(['shift', 'vacation', 'sick', 'leave'] as ShiftType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="rounded-[13px] px-3 py-2 text-[12px] font-semibold transition-colors"
                    style={type === t ? { background: '#1D1C19', color: '#fff' } : { background: '#fff', color: '#5C5848', border: '1px solid var(--dav-line)' }}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              {type === 'shift' && (
                <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">Kezdés</span>
                    <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-[13px] border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] font-medium text-ink-soft">Vége</span>
                    <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-[13px] border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink focus:outline-none" />
                  </label>
                </div>
              )}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Megjegyzés (opcionális)"
                className="mb-3 w-full rounded-[13px] border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || !staffId}
                onClick={() => onAdd(staffId, { type, start_time: start, end_time: end, note })}
                className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink-dark py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4 text-gold" strokeWidth={2.2} /> Beosztom erre a napra
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
