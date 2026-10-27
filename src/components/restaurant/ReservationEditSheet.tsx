'use client'

import { SHEET_MOBILE } from '@/lib/motion'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { TimeSlotGrid } from '@/components/ui/TimeSlotGrid'
import { DurationSlider } from '@/components/ui/DurationSlider'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, AlertTriangle, X, ChevronDown, ChevronRight, CalendarClock, UserRound, Sparkles } from 'lucide-react'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { hhmmToMinutes, minutesToHHMM, ymdLocal } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/offlineDrafts'
import { useOnline } from '@/lib/useOnline'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { urgencyOf } from './DailyView'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { EmailStatusBadge } from '@/components/shared/EmailStatusBadge'
import type { Reservation } from '@/payload/payload-types'
import { useGuestLookup, GuestSuggestList, type GuestSuggestion } from '@/components/shared/GuestLookup'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SectionBar, FieldRow, ROW_INPUT, STEP_BTN, pillSmCls } from '@/components/shared/FormSheet'

const HU_MONTHS_SHORT = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']
/** „2026. október 26., hétfő” — a panel fejlécébe (a nyers ÉÉÉÉ-HH-NN helyett). */
function formatLongHu(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

function formatHuDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS_SHORT[m - 1]} ${d}.`
}

// ISO ország-kód → nemzetközi előhívó (a tárolt teljes szám összeállításához / felbontásához).
const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

// Az avatar-menü (UserMenu) „genie" belépője — DESKTOP-on (középre nyíló modal) PONTOSAN ezt
// használja (azonos érzés: nagy scale-ugrás + overshoot = pulzáló pop, a gyerekek staggerrel folynak be).
const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
} as const
// Mobilon (alulról induló sheet) VALÓDI alulról-felcsúszás kell — a genie kicsinyítő-pop-ja itt
// épp azt az érzetet keltette, hogy nem "úszik fel" alulról, csak beugrik/felnő a helyén.
// közös mobilos lap-mozgás (lib/motion) — csak tolás, áttetszőség/skála nélkül (telefonon sima)
const SLIDE_UP = SHEET_MOBILE
// A panel régiói (fejléc/törzs/lábléc) „folyami" belépője a genie-stagger alá.
const PANEL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
} as const

/**
 * Új foglalás alap-státusza a forrás + időpont alapján (a host felülírhatja):
 *  - már véget ért (múltbeli nap, vagy ma de a vége elmúlt) → utólagos rögzítés = Befejezett
 *  - beeső, ami épp zajlik / most kezdődik → Leültetve
 *  - egyébként → Megerősítve
 */
function computeDefaultStatus(
  source: Reservation['source'],
  date: string,
  startTime: string,
  durationMin: number | null,
): Reservation['status'] {
  const now = new Date()
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = startTime ? hhmmToMinutes(startTime) : 0
  const endMin = startMin + (durationMin && durationMin > 0 ? durationMin : 120)

  if (date < todayYmd) return 'completed'
  if (date === todayYmd && endMin <= nowMin) return 'completed'
  if (source === 'walk_in' && date === todayYmd && startMin <= nowMin) return 'seated'
  return 'confirmed'
}

/** A tárolt teljes telefonszámot (pl. „+36 30…") felbontja ISO ország-kódra + helyi részre. */
function splitLocalPhone(full: string | null | undefined, fallbackCountry: string): { country: string; phone: string } {
  const s = (full ?? '').trim()
  if (!s) return { country: fallbackCountry, phone: '' }
  const cur = DIAL_BY_CODE[fallbackCountry]
  if (cur && s.startsWith(cur)) return { country: fallbackCountry, phone: s.slice(cur.length).trim() }
  if (s.startsWith('+')) {
    // A leghosszabb illeszkedő előhívót választjuk (pl. +1 vs +1XXX kétértelműség ellen).
    const match = COUNTRIES.filter((c) => s.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0]
    if (match) return { country: match.code, phone: s.slice(match.dial.length).trim() }
  }
  return { country: fallbackCountry, phone: s }
}

/** A nézetekből érkező "ál-foglalás" lehet lokális vázlat (__draft jelölővel). */
type MaybeDraft = Reservation & { __draft?: true; draftId?: string }
function draftIdOf(r: Reservation | null): string | null {
  const d = r as MaybeDraft | null
  return d?.__draft ? (d.draftId ?? null) : null
}

export interface MoveOption {
  id: string | number
  name: string
  room: string | null
  capacity: number
  fitsPax: boolean
  /** foglalt asztal: ennyi perc múlva szabadul (a kért kezdéshez képest) */
  busyForMin?: number
  /** szabad asztal, de ennyi perc múlva jön rá a következő foglalás */
  freeForMin?: number
}

export interface ComboOption {
  ids: (string | number)[]
  names: string[]
  totalCapacity: number
}

// Státusz-pöttyök — ugyanazok a színek, mint a Foglalások táblázatos listájában.
const STATUS_DOT: Record<string, string> = {
  confirmed: 'bg-[#1D9D63]', seated: 'bg-[#2F6FD0]', pending: 'bg-[#E0B21C]', completed: 'bg-[#B9B4A6]', cancelled: 'bg-[#C0564A]', no_show: 'bg-[#E07B39]',
}
const statusOptions: { value: Reservation['status']; label: string }[] = [
  { value: 'pending', label: 'Megerősítésre vár' },
  { value: 'confirmed', label: 'Megerősítve' },
  { value: 'seated', label: 'Leültetve' },
  { value: 'completed', label: 'Befejezett' },
  { value: 'no_show', label: 'Nem jött meg' },
  { value: 'cancelled', label: 'Lemondva' },
]

// A sidebar fejléc-badge színei — egyezzenek a foglalási nézet (DailyView) palettájával.
const statusBadge: Record<string, string> = {
  pending: 'bg-amber-400 text-amber-950',
  confirmed: 'bg-ink-dark text-white',
  seated: 'bg-indigo-500 text-white',
  completed: 'bg-emerald-500 text-white',
  no_show: 'bg-red-500 text-white',
  cancelled: 'bg-zinc-200 text-ink-soft line-through',
}
const statusLabelOf = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s
const sourceLabelOf: Record<string, string> = { walk_in: 'Beeső', phone: 'Telefon', online: 'Online' }

const sourceOptions: { value: Reservation['source']; label: string }[] = [
  { value: 'walk_in', label: 'Beeső' },
  { value: 'phone', label: 'Telefon' },
  { value: 'online', label: 'Online' },
]

export interface EditTarget {
  /** Meglévő foglalás szerkesztése, vagy null = új foglalás */
  reservation: Reservation | null
  /** Új foglaláshoz előtöltött kezdés (üres sávra kattintva) */
  presetStart?: string
  /** Új foglaláshoz előtöltött asztal */
  presetTableId?: string | number | null
}

interface Props {
  open: boolean
  onClose: () => void
  date: string
  restaurantId: string
  /** Választható esemény-típusok (alkalmak) — a tulaj a foglaláshoz alkalmat rendelhet. */
  eventTypes?: { icon: string; label: string }[]
  target: EditTarget | null
  /** A nap nyitvatartása (perc) — a TimeSelect ezt a tartományt kínálja (kemény korlát). */
  openMin?: number
  closeMin?: number
  /** Az étterem alap turnusa (perc) — az ülésidő-csúszka kezdőértéke új foglalásnál. */
  turnMinutes?: number
}

export function ReservationEditSheet({ open, onClose, date, restaurantId, eventTypes = [], target, openMin, closeMin, turnMinutes = 120 }: Props) {
  const router = useRouter()
  const online = useOnline()
  const reservation = target?.reservation ?? null
  const isEdit = !!reservation
  const draftId = draftIdOf(reservation)
  const isDraft = draftId != null

  // Mobilon (alulról induló sheet) valódi felcsúszás, desktopon (középre nyíló modal) a genie-pop
  // — a Tailwind `sm:` töréspontnak megfelelő 640px-es media query-vel váltva.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // A foglalás napja — kezdetben a jelenleg megtekintett nap (a `date` prop), de a sheeten
  // belül átválasztható (ld. DatePickerPopover lent), hogy ne kelljen a nézetet elhagyni
  // egy másik napra foglaláshoz.
  const [selectedDate, setSelectedDate] = useState(date)
  const [startTime, setStartTime] = useState('')
  const [pax, setPax] = useState(2)
  const [tableId, setTableId] = useState<string>('') // '' = auto
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('HU')
  const [email, setEmail] = useState('')
  // Visszatérő vendég felismerése (csak új foglalásnál) — ugyanaz, mint a szalon foglaló paneljén
  const lookup = useGuestLookup(!isEdit)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Reservation['status']>('confirmed')
  // A host kézzel váltott-e státuszt: ha igen, az alap-státusz újraszámítás nem írja felül.
  const [statusTouched, setStatusTouched] = useState(false)
  const [source, setSource] = useState<Reservation['source']>('walk_in')
  // Kiválasztott alkalom (occasion) — a megnevezés + ikon-kulcs, vagy null (nincs külön alkalom).
  const [occasion, setOccasion] = useState<string | null>(null)
  const [occasionIcon, setOccasionIcon] = useState<string | null>(null)
  // Az adott időpontra még leültethető legnagyobb létszám (a számláló felső korlátja). 0 = ismeretlen.
  const [maxPax, setMaxPax] = useState(0)
  // Ülésidő percben — egyedi csúszkán megadva (30-120 perc), kezdőértéke az étterem turnusa.
  const [duration, setDuration] = useState<number>(turnMinutes)

  // Az adott nap TELJES időrácsa (1 fős referenciával lekérve — ez a legenyhébb kapacitás-
  // igény, tehát a legszélesebb halmaz). A rács maga EZT mutatja fixen — a létszám váltása
  // nem csereéli le/tölti újra, csak azt jelzi (ld. lejjebb), melyik időpont fér el rá.
  const [fetchedSlots, setFetchedSlots] = useState<{ start: string; end: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  // a szabad-időpont lekérés lezárult-e (az alap-időpont csak UTÁNA állhat be, különben egy még
  // betöltés előtti, nem-szabad időpontot jelölne ki)
  const [slotsReady, setSlotsReady] = useState(false)

  // Kézi időpontnál (nincs szabad sáv / szerkesztés nélküli üres idő) ne 00:00 legyen az alap:
  // ma az aktuális idő 15 percre felfelé kerekítve, más napon a nyitás — a nyitvatartásba szorítva
  // (a görgős választó úgyis csak azon belül enged választani).
  useEffect(() => {
    if (!open || isEdit || !slotsReady || slotsLoading || startTime || fetchedSlots.length > 0) return
    const now = new Date()
    let m = selectedDate === ymdLocal(now) ? Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15 : (openMin ?? 9 * 60)
    if (openMin != null) m = Math.max(m, openMin)
    if (closeMin != null) m = Math.min(m, closeMin - 15)
    m = Math.min(Math.max(m, 0), 23 * 60 + 45)
    setStartTime(minutesToHHMM(m))
  }, [open, isEdit, slotsReady, slotsLoading, startTime, fetchedSlots.length, selectedDate, openMin, closeMin])
  // A ténylegesen beállított létszámra elférő időpontok halmaza — külön, lassabban
  // (debounce-olva) frissül, hogy a +/- pötyögtetése ne dobja újra az egész rácsot.
  const [paxAvailableStarts, setPaxAvailableStarts] = useState<Set<string> | null>(null)
  // Igaz, ha a nap TELJESEN zárva van (pl. heti pihenőnap) — a szerver mondja meg (getOpeningWindow),
  // nem a kliens tippeli a záróra alapján, mert az csak az "elmúlt mára" esetet fedi le.
  const [dayClosed, setDayClosed] = useState(false)
  const [options, setOptions] = useState<MoveOption[]>([])
  const [busyTables, setBusyTables] = useState<MoveOption[]>([])
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const tablePickerRef = useRef<HTMLDivElement>(null)
  const tableRowRef = useRef<HTMLDivElement>(null)
  const [confirmSmallTable, setConfirmSmallTable] = useState(false)
  const [suggestedCombo, setSuggestedCombo] = useState<ComboOption | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Dirty-guard: záráskor rákérdezünk, ha van mentetlen változás.
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const initSigRef = useRef<string>('')

  // Sürgősség-badge (késik / túlfut / mindjárt lejár) — csak meglévő foglalásnál és
  // ha a nézett nap MA van. A foglalási nézet ugyanezt a logikát használja (urgencyOf).
  // A státusz a (szerkeszthető) state-ből jön, hogy státuszváltáskor azonnal frissüljön.
  const nowMin = (() => {
    const now = new Date()
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return ymd === selectedDate ? now.getHours() * 60 + now.getMinutes() : null
  })()
  const urgency = reservation && !isDraft ? urgencyOf({ ...reservation, status }, nowMin) : null

  // A kiválasztott ülésidő záráshoz vágása. Ha a turnus túllógna a záráson, a foglalás
  // valójában csak zárásig tart — ezt a hostnak jelezzük (nem néma vágás). A „null"
  // ülésidő az étterem alap turnusa; itt a kijelzéshez 120 percet feltételezünk.
  const startMin = startTime ? hhmmToMinutes(startTime) : null
  const wantedDuration = duration
  const clip =
    startMin != null && closeMin != null && startMin + wantedDuration > closeMin
      ? { actualEnd: minutesToHHMM(closeMin), wantedEnd: minutesToHHMM(startMin + wantedDuration) }
      : null

  // Form inicializálás nyitáskor
  useEffect(() => {
    if (!open || !target) return
    const r = target.reservation
    const initDate = r?.date ?? date
    setSelectedDate(initDate)
    // Kézzel indított új foglalásnál (nincs preset időpont) NEM ajánlunk fel semmilyen
    // "aktuális idő" alapértéket — az hamis ütközés-/kapacitás-jelzést kelt, mielőtt a host
    // egyáltalán választott volna. Csak explicit forrásból (meglévő foglalás, vagy rácsra
    // kattintás) jön idő.
    setStartTime(r?.start_time ?? target.presetStart ?? '')
    setPax(r?.pax ?? 2)
    const currentTables = r?.tables?.length
      ? r.tables.map((t) => (typeof t === 'object' && t ? t.id : t))
      : target.presetTableId != null
        ? [target.presetTableId]
        : []
    setTableId(currentTables.length ? currentTables.map(String).join(',') : '')
    setName(r?.customer_name ?? '')
    setCity(r?.customer_city ?? '')
    // A tárolt teljes szám (pl. „+36 30…") vissza ország-kódra + helyi részre a mezőhöz.
    const initCountry = r?.country ?? 'HU'
    const parsedPhone = splitLocalPhone(r?.customer_phone, initCountry)
    setCountry(parsedPhone.country)
    setPhone(parsedPhone.phone)
    setEmail(r?.customer_email ?? '')
    lookup.clear()
    setNotes(r?.notes ?? '')
    const initSource = r?.source ?? 'walk_in'
    setSource(initSource)
    setOccasion(r?.occasion ?? null)
    setOccasionIcon(r?.occasion_icon ?? null)
    // Meglévő foglalásnál a tárolt hossz; újnál az étterem alap turnusa. A csúszka 30-120
    // perc közé korlátoz — egy ennél hosszabb/rövidebb tárolt érték a szélére tapad.
    const rawInitDuration = r?.start_time && r?.end_time
      ? Math.max(0, hhmmToMinutes(r.end_time) - hhmmToMinutes(r.start_time))
      : turnMinutes
    const initDuration = Math.min(120, Math.max(30, rawInitDuration))
    setDuration(initDuration)
    // Új foglalás alap-státusza a forrás + időpont alapján (módosítható); meglévőnél a tárolt.
    const initStart = r?.start_time ?? target.presetStart ?? ''
    const initStatus = r?.status ?? computeDefaultStatus(initSource, initDate, initStart, initDuration)
    setStatus(initStatus)
    setStatusTouched(false)
    setConfirmDiscard(false)
    // A nyitáskori állapot aláírása — ehhez hasonlítjuk a dirty-guardhoz (mentetlen változás).
    initSigRef.current = JSON.stringify([
      initDate,
      r?.start_time ?? target.presetStart ?? '',
      r?.pax ?? 2,
      currentTables.length ? currentTables.map(String).join(',') : '',
      r?.customer_name ?? '',
      r?.customer_city ?? '',
      parsedPhone.phone,
      parsedPhone.country,
      r?.customer_email ?? '',
      r?.notes ?? '',
      initStatus,
      initSource,
      r?.occasion ?? null,
      r?.occasion_icon ?? null,
      initDuration,
    ])
  }, [open, target])

  // Új foglalásnál a forrás/időpont változása frissíti az alap-státuszt, amíg a host kézzel
  // nem választott mást (statusTouched). Meglévő foglalás státuszát nem érinti.
  useEffect(() => {
    if (!open || isEdit || statusTouched || !startTime) return
    setStatus(computeDefaultStatus(source, selectedDate, startTime, duration))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, statusTouched, source, startTime, duration, selectedDate])

  // A nap teljes időrácsa — 1 fős referencia-létszámmal lekérve, ez a lehető legenyhébb
  // kapacitás-igény, tehát minden nagyobb létszámra érvényes időpont is ebben benne van.
  // Csak dátum/étterem váltásra fut újra, LÉTSZÁMRA NEM — ez adja a rács stabil "csontvázát".
  // Hibát (nem-2xx választ) explicit ELDOBUNK, nem hallgatjuk el — a korábbi némán-üres
  // fallback (json.slots ?? []) egy szerver-hibát is "nincs szabad időpont"-ként mutatott.
  useEffect(() => {
    if (isEdit || !open || !restaurantId) {
      setFetchedSlots([])
      setSlotsLoading(false)
      setSlotsReady(true)
      setDayClosed(false)
      setPaxAvailableStarts(null)
      return
    }
    const ctrl = new AbortController()
    setSlotsLoading(true)
    setSlotsReady(false)
    setFetchedSlots([])
    setDayClosed(false)
    setPaxAvailableStarts(null)
    const params = new URLSearchParams({ restaurantId, date: selectedDate, pax: '1', includePast: '1' })
    fetch(`/api/restaurant/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Slots API ${r.status}`)
        return r.json() as Promise<{ slots?: { start: string; end: string }[]; closed?: boolean }>
      })
      .then((json) => {
        setFetchedSlots(json.slots ?? [])
        setDayClosed(!!json.closed)
        setSlotsLoading(false)
        setSlotsReady(true)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        console.error('[ReservationEditSheet] slots fetch failed', err)
        setSlotsLoading(false)
        setSlotsReady(true)
      })
    return () => ctrl.abort()
  }, [isEdit, open, restaurantId, selectedDate])

  // Az adott létszámra ténylegesen elférő időpontok. NINCS debounce — minden létszám-
  // változásra azonnal indul a kérés, az előzőt az AbortController szakítja félbe, így
  // mindig csak a LEGUTOLSÓ fut le. A régi halmazt megtartjuk amíg az új meg nem érkezik,
  // hogy a rács ne villanjon el/vissza minden kattintásnál (folyamatos, ugrás-mentes UX).
  useEffect(() => {
    if (isEdit || !open || !restaurantId || !pax) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ restaurantId, date: selectedDate, pax: String(pax), includePast: '1' })
    fetch(`/api/restaurant/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Slots API ${r.status}`)
        return r.json() as Promise<{ slots?: { start: string; end: string }[] }>
      })
      .then((json) => {
        setPaxAvailableStarts(new Set((json.slots ?? []).map((s) => s.start)))
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        console.error('[ReservationEditSheet] pax-availability fetch failed', err)
      })
    return () => ctrl.abort()
  }, [isEdit, open, restaurantId, selectedDate, pax])

  // Szabad asztalok lekérése idő/létszám változásra
  const loadOptions = useCallback(async () => {
    if (!startTime || !pax) {
      setOptions([])
      setSuggestedCombo(null)
      setMaxPax(0)
      return
    }
    setOptionsLoading(true)
    try {
      const qs = new URLSearchParams({ date: selectedDate, start_time: startTime, pax: String(pax) })
      if (reservation) qs.set('excludeReservationId', String(reservation.id))
      const res = await fetch(`/api/restaurant/move-options?${qs}`, { credentials: 'include' })
      const json = await res.json()
      setOptions(json.tables ?? [])
      setSuggestedCombo(json.suggestedCombo ?? null)
      setBusyTables(json.busy ?? [])
      setMaxPax(typeof json.maxPax === 'number' ? json.maxPax : 0)
    } catch {
      setOptions([])
      setSuggestedCombo(null)
      setMaxPax(0)
    } finally {
      setOptionsLoading(false)
    }
  }, [startTime, pax, selectedDate, reservation])

  useEffect(() => {
    if (open) void loadOptions()
  }, [open, loadOptions])

  const selectedTableIds = tableId ? tableId.split(',') : null

  // A számláló felső korlátja: az adott időpontra még leültethető létszám. 0 (ismeretlen,
  // pl. betöltés közben vagy nincs szabad asztal) → visszaesünk a 50-es kemény korlátra.
  const paxCap = maxPax > 0 ? maxPax : 50
  const atPaxCap = maxPax > 0 && pax >= paxCap

  const draftFields = () => {
    const tableNames = (selectedTableIds ?? [])
      .map((id) => tableChoices.find((c) => String(c.id) === String(id))?.name ?? id)
      .map(String)
    return {
      date: selectedDate,
      start_time: startTime,
      pax,
      tableIds: selectedTableIds,
      customer_name: name,
      customer_city: city,
      customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
      // a telefonszámból felismert ország → a nemzetiség-statisztika szerkesztéskor is frissüljön
      ...(phone.trim() ? { country } : {}),
      customer_email: email,
      notes,
      status,
      occasion,
      occasion_icon: occasionIcon,
      tableNames,
    }
  }

  /** Új foglalás offline (vagy hálózati hiba esetén) lokális vázlatként mentődik. */
  const saveNewDraft = () => {
    addDraft(restaurantId, draftFields())
    toast.success('Offline — vázlatként elmentve', {
      description: 'A net visszatértekor véglegesítheted. Ellenőrizd, hogy szabad-e az időpont.',
    })
    onClose()
  }

  /** Offline vázlat lokális módosítása (szerver nélkül). */
  const saveDraftEdit = () => {
    if (!draftId) return
    updateDraft(restaurantId, draftId, draftFields())
    toast.success('Vázlat frissítve')
    onClose()
  }

  const save = async (opts?: { allowOverCapacity?: boolean }) => {
    if (!startTime) return toast.error('Adj meg időpontot')
    // Kisebb asztalra ültetés csak tudatos megerősítés után (a szerver alapból elutasítaná).
    if (pickedTooSmall && !opts?.allowOverCapacity) { setConfirmSmallTable(true); return }
    // Érvénytelen e-mail: a mező alatt inline piros hiba jelzi (nem toast) → nem küldünk.
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return
    // Beeső/telefonos foglalásnál a név opcionális (alapnév kerül be: „Beeső" / „Telefon").
    // Online foglaláshoz továbbra is kell név.
    if (!isEdit && source === 'online' && !name.trim()) return toast.error('Online foglaláshoz adj meg nevet')

    // Vázlat offline: csak lokálisan frissíthető (a szerver nem érhető el).
    if (isDraft && !online) return saveDraftEdit()
    // Új foglalás offline → lokális vázlat. (Valódi foglalás szerkesztéséhez szerver kell.)
    if (!isDraft && !online && !isEdit) return saveNewDraft()

    setSaving(true)
    try {
      const res = await fetch('/api/restaurant/manage-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // Vázlat véglegesítésekor nincs szerveroldali id — ez új foglalásként megy be.
          reservationId: isDraft ? undefined : reservation?.id,
          date: selectedDate,
          start_time: startTime,
          pax,
          tableIds: selectedTableIds,
          customer_name: name,
          customer_city: city.trim(),
          // A helyi szám elé az ország-előhívó (a publikus foglaló formátumával egyezően).
          customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
          country,
          customer_email: email,
          notes,
          status,
          source,
          occasion,
          occasion_icon: occasionIcon,
          duration_minutes: duration,
          allowOverCapacity: !!opts?.allowOverCapacity,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hiba')
      // Sikeres véglegesítés után a lokális vázlat törölhető (különben duplán látszana).
      if (isDraft && draftId) removeDraft(restaurantId, draftId)
      toast.success(isDraft ? 'Vázlat véglegesítve' : isEdit ? 'Foglalás frissítve' : 'Foglalás rögzítve')
      onClose()
      markLocalMutation()
      router.refresh()
    } catch (e) {
      // Hálózati hiba: a navigator néha téveszt → essünk vissza lokális vázlatra.
      if (e instanceof TypeError) {
        if (isDraft) return saveDraftEdit()
        if (!isEdit) return saveNewDraft()
      }
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  /** Vázlat törlése (csak lokális, szerver nélkül). */
  const discardDraft = () => {
    if (!draftId) return
    removeDraft(restaurantId, draftId)
    toast('Vázlat törölve')
    onClose()
  }

  // Végleges törlés — nem státuszváltás, a rekord ténylegesen kikerül az adatbázisból.
  const deleteReservation = async () => {
    if (!reservation) return
    setSaving(true)
    try {
      const res = await fetch('/api/restaurant/delete-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reservationId: reservation.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Foglalás törölve')
      setConfirmCancel(false)
      onClose()
      markLocalMutation()
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  // Dirty-guard: a jelenlegi állapot aláírása vs. a nyitáskori. Ha eltér → mentetlen változás.
  const dirty = JSON.stringify([
    selectedDate, startTime, pax, tableId, name, city, phone, country, email, notes, status, source, occasion, occasionIcon, duration,
  ]) !== initSigRef.current

  // Záráskor rákérdezünk, ha van mentetlen változás (X, háttér-kattintás, Esc).
  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  // Inline (mező alatti) hiba az e-mailre — csak ha kitöltötték és formátum-hibás.
  const applySuggestion = (g: GuestSuggestion) => {
    setName(g.name)
    if (g.email) setEmail(g.email)
    if (g.city) setCity(g.city)
    if (g.phone) {
      const p = splitLocalPhone(g.phone, country)
      setCountry(p.country)
      setPhone(p.phone)
    }
    lookup.clear()
  }

  const emailErr = email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Érvénytelen e-mail cím' : null

  // Esc-re zárás — a saját portál-panelhez (a Radix Sheet beépített kezelése helyett).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, requestClose])

  // A jelenlegi (esetleg összevont) asztalok nincsenek a szabad listában (mert önmagukat
  // foglalják) — adjuk hozzá őket a választhatók közé.
  const currentTables = (reservation?.tables ?? [])
    .map((t) => (typeof t === 'object' && t ? t : null))
    .filter((t): t is NonNullable<typeof t> => !!t)
  const tableChoices = [...options]
  // A KÉZZEL választott asztal még jó-e: a létszám vagy az időpont utólagos módosítása után
  // kicsi lehet, vagy közben foglalt lett — ezt a sorban azonnal jelezzük.
  const pickedIds = tableId ? tableId.split(',') : []
  const pickedBusy = pickedIds.filter((id) => busyTables.some((b) => String(b.id) === id) && !options.some((o) => String(o.id) === id))
  const pickedCapacity = pickedIds.reduce((sum, id) => sum + (options.find((o) => String(o.id) === id)?.capacity ?? busyTables.find((b) => String(b.id) === id)?.capacity ?? 0), 0)
  const pickedTooSmall = pickedIds.length > 0 && pickedCapacity > 0 && pickedCapacity < pax
  const pickedNames = pickedIds.map((id) => options.find((o) => String(o.id) === id)?.name ?? busyTables.find((b) => String(b.id) === id)?.name ?? id).join(' + ')
  for (const ct of currentTables) {
    if (!tableChoices.some((o) => String(o.id) === String(ct.id))) {
      tableChoices.unshift({ id: ct.id, name: ct.name, room: null, capacity: ct.capacity, fitsPax: true })
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <div key="res-sheet" className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
            {/* Finom, elmosott háttér — 1:1 az avatar-menü érzésével (enyhe dim + 2px blur). */}
            <motion.div
              className="absolute inset-0 bg-black/[0.06] backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={requestClose}
            />
            {/* Középre úszó panel — az avatar „genie" springje (pulzáló pop); mobilon alsó lap. */}
            <motion.div
              variants={isDesktop ? GENIE : SLIDE_UP}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ transformOrigin: 'center' }}
              className="relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white will-change-transform sm:max-h-[92vh] sm:shadow-[0_28px_80px_-24px_rgba(0,0,0,.55)] sm:max-w-[840px] sm:rounded-[26px] lg:max-w-[1120px]"
            >
              {/* Fejléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-[20px] font-light tracking-[-0.02em] text-ink">
                    {isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    {formatLongHu(selectedDate)}{isDraft && ' · még nem véglegesített offline vázlat'}
                  </p>
                  {((isEdit && !isDraft) || occasion) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isEdit && !isDraft && (
                        <>
                          {/* Státusz-pont: pulzál, ha folyamatban (megerősítésre vár); egyébként statikus. */}
                          <span
                            title={status === 'pending' ? 'Folyamatban — megerősítésre vár' : statusLabelOf(status)}
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              status === 'pending'
                                ? 'bg-amber-400 animate-soft-pulse'
                                : status === 'cancelled' || status === 'no_show'
                                  ? 'bg-zinc-300'
                                  : 'bg-emerald-500'
                            }`}
                          />
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadge[status] ?? 'bg-zinc-200 text-ink-soft'}`}>
                            {statusLabelOf(status)}
                          </span>
                          {source && source !== 'online' && (
                            <span className="rounded-full bg-[#F4F4F4] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                              {sourceLabelOf[source]}
                            </span>
                          )}
                          {urgency && (
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${urgency.cls} ${urgency.pulse ? 'animate-soft-pulse' : ''}`}>
                              {urgency.label}
                            </span>
                          )}
                          {reservation?.payment_status === 'paid' && (
                            <span
                              title={reservation.invoice_status === 'issued' ? `Számla: ${reservation.invoice_number}` : 'Bizonylat még nincs kiállítva'}
                              className="inline-flex items-center gap-1 rounded-full bg-[#DCF3E2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1D7A3C]"
                            >
                              Előleg befizetve{reservation.deposit_amount_huf ? ` · ${reservation.deposit_amount_huf.toLocaleString('hu-HU')} Ft` : ''}
                            </span>
                          )}
                          {reservation?.payment_status === 'failed' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE1DE] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#B3261E]">
                              Sikertelen előleg-fizetés
                            </span>
                          )}
                          {reservation?.payment_status === 'refunded' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                              Előleg visszatérítve
                            </span>
                          )}
                        </>
                      )}
                      {/* Alkalom (occasion) — feltűnő jelvény fent, ahogy korábban a szülinapnál volt. */}
                      {occasion && (() => {
                        const OccIcon = eventIconByKey(occasionIcon)
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-dark shadow-[0_1px_4px_rgba(120,90,10,.28)]">
                            <OccIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} /> {occasion}
                          </span>
                        )
                      })()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Bezárás"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4] text-ink-soft transition-colors hover:bg-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>

              {/* Törzs (görgethető) */}
              {/* „Adatlap” elrendezés (mint egy letisztult táblázat): szürke fejléc-sáv szekciónként,
                  egyforma sorok vékony elválasztóval, bal oldalt címke, jobb oldalt keret nélküli
                  érték. Lekerekítés: minden választható elem kerek pill. Asztalon két oszlop. */}
              <motion.div variants={PANEL_ITEM} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
          {/* ── FOGLALÁS ── */}
          <div>
            <SectionBar icon={CalendarClock} label="Foglalás" />

            <FieldRow label="Nap">
              <DatePickerPopover
                value={selectedDate}
                onChange={setSelectedDate}
                loadEndpoint="/api/restaurant/day-load"
                triggerClassName="flex h-9 w-full items-center justify-between gap-2 text-left text-[14px] font-medium text-ink"
              >
                {formatHuDate(selectedDate)}
                <ChevronRight className="h-4 w-4 text-ink-soft2" />
              </DatePickerPopover>
            </FieldRow>

            <FieldRow label="Létszám" hint={atPaxCap ? `Erre az időpontra max ${paxCap} fő fér el.` : undefined}>
              {/* Érintőbarát stepper — kerek +/− gombok; a felső korlát az adott időpontra még
                  leültethető létszám (paxCap), nem a kemény 50. */}
              <div className="flex items-center justify-end gap-3">
                <button type="button" aria-label="Kevesebb fő" onClick={() => setPax((p) => Math.max(1, p - 1))} disabled={pax <= 1} className={STEP_BTN}>−</button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={paxCap}
                  value={pax}
                  onChange={(e) => setPax(Math.min(paxCap, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-10 border-0 bg-transparent text-center text-[15px] font-semibold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button type="button" aria-label="Több fő" onClick={() => setPax((p) => Math.min(paxCap, p + 1))} disabled={pax >= paxCap} className={STEP_BTN}>+</button>
              </div>
            </FieldRow>

            <FieldRow label="Időpont" stacked>
              {/* Új foglalásnál: szabad időpontok — ugyanaz a komponens/UX mint a szalonnál. */}
              {!isEdit ? (
                slotsLoading ? (
                  <div className="flex h-9 items-center gap-2 text-sm text-ink-soft2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Időpontok betöltése…
                  </div>
                ) : fetchedSlots.length === 0 ? (
                  <div className="space-y-2">
                    <p className="flex items-start gap-1 text-[10px] font-semibold leading-snug text-amber-600 sm:text-[11px]">
                      <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                      <span>
                        {dayClosed
                          ? 'Ezen a napon zárva vagyunk — válassz másik napot, vagy add meg kézzel.'
                          : selectedDate === ymdLocal(new Date()) && closeMin != null && new Date().getHours() * 60 + new Date().getMinutes() >= closeMin
                            ? 'Mára már zárva vagyunk — válassz másik napot, vagy add meg kézzel.'
                            : 'Nincs szabad időpont ezen a napon — add meg kézzel.'}
                      </span>
                    </p>
                    <TimeSelect
                      value={startTime}
                      onChange={setStartTime}
                      minTime={openMin != null ? minutesToHHMM(openMin) : undefined}
                      maxTime={closeMin != null ? minutesToHHMM(closeMin) : undefined}
                    />
                  </div>
                ) : (
                  <>
                    <TimeSlotGrid slots={fetchedSlots} value={startTime} onChange={setStartTime} highlightStarts={paxAvailableStarts} />
                    {paxAvailableStarts && paxAvailableStarts.size === 0 && (
                      <p className="text-[11px] font-medium text-amber-600">
                        Erre a létszámra jelenleg egyik időpont sem elég — a halvány időpontok is választhatók, csak kézi asztal-egyeztetést igényelnek.
                      </p>
                    )}
                  </>
                )
              ) : (
                <TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  minTime={openMin != null ? minutesToHHMM(openMin) : undefined}
                  maxTime={closeMin != null ? minutesToHHMM(closeMin) : undefined}
                />
              )}
            </FieldRow>

            <div ref={tableRowRef} className="scroll-mt-2" />
            <FieldRow
              label={<span className="inline-flex items-center gap-1.5">Asztal {optionsLoading && <Loader2 className="h-3 w-3 animate-spin" />}</span>}
            >
              {/* Figyelmeztetés / tájékoztatás a SORON BELÜL, a címke és az asztalnév között (nem alatta) */}
              {(() => {
                // az asztalok szabadsága az idősávtól függ → időpont nélkül nincs mit felkínálni
                const tableHint: string | undefined = !startTime
                  ? 'Előbb válassz időpontot — utána látod a szabad asztalokat.'
                  : pickedBusy.length > 0 && !optionsLoading
                    ? `${pickedNames} ekkor már foglalt — válassz másikat.`
                  : pickedTooSmall && !optionsLoading
                    ? `${pickedNames} (${pickedCapacity} fő) kicsi ${pax} főre — válassz nagyobbat.`
                  : tableId.includes(',')
                  ? `Összevont asztalok: ${tableId.split(',').map((id) => tableChoices.find((c) => String(c.id) === id)?.name ?? id).join(' + ')}`
                  : suggestedCombo && tableId === ''
                    ? `Egy asztal sem elég, automatikusan összevonva: ${suggestedCombo.names.join(' + ')} (${suggestedCombo.totalCapacity} fő)`
                    : !optionsLoading && startTime && options.length === 0 && !suggestedCombo
                      ? 'Nincs szabad asztal erre az időpontra/létszámra.'
                      : undefined
                const tone: string = !startTime ? 'muted' : (pickedBusy.length > 0 || pickedTooSmall) && !optionsLoading ? 'warn' : !optionsLoading && options.length === 0 && !suggestedCombo && !tableId.includes(',') ? 'warn' : 'ok'
                const cls = tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-[#1D7A4C]' : 'text-ink-soft2'
                return (
                  <div className="flex min-w-0 items-center justify-end gap-3">
                    {tableHint && (
                      <span title={tableHint} className={`flex min-w-0 flex-1 items-center justify-end gap-1 text-right text-[11px] font-medium leading-tight ${cls}`}>
                        {tone === 'warn' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />}
                        <span className="truncate">{tableHint}</span>
                      </span>
                    )}
                  {/* A sor csak összegzés + nyitó; maga a választó alatta nyílik le (nem natív legördülő) */}
                  <button
                    type="button"
                    disabled={!startTime}
                    onClick={() => {
                      const next = !tablePickerOpen
                      setTablePickerOpen(next)
                      // RÖGTÖN görgessen (nem a lenyílás végén): az Asztal sor a nézet tetejére
                      // kerül, a választó így a látható részbe nyílik le
                      if (next) requestAnimationFrame(() => tableRowRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
                    }}
                    aria-expanded={tablePickerOpen}
                    className="flex h-9 shrink-0 items-center justify-end gap-1.5 text-right text-[14px] font-medium text-ink disabled:text-ink-soft2"
                  >
                    <span className="truncate">
                      {tableId
                        ? tableId.split(',').map((id) => tableChoices.find((c) => String(c.id) === id)?.name ?? id).join(' + ')
                        : !startTime ? 'Automatikus' : `Automatikus · ${tableChoices.filter((t) => t.fitsPax).length} szabad`}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft2 transition-transform ${tablePickerOpen ? 'rotate-180' : ''}`} />
                  </button>
                  </div>
                )
              })()}
            </FieldRow>
            <AnimatePresence initial={false}>
              {tablePickerOpen && startTime && (
                <motion.div
                  key="table-picker"
                  ref={tablePickerRef}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1, transition: { type: 'spring', stiffness: 420, damping: 36 } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
                  className="overflow-hidden border-b border-line"
                >
                  <TablePicker
                    free={tableChoices}
                    busy={busyTables}
                    value={tableId}
                    combo={suggestedCombo}
                    onPick={(id) => { setTableId(id); setTablePickerOpen(false) }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <FieldRow label="Ülésidő" stacked last>
              <DurationSlider value={duration} onChange={setDuration} min={30} max={120} step={15} />
              {clip && (
                <p className="mt-2 flex items-start gap-1 text-[11px] font-semibold leading-snug text-[#C0453F]">
                  <AlertTriangle className="mt-[1px] h-3 w-3 shrink-0" strokeWidth={2.2} />
                  <span>Záráskor ({clip.actualEnd}) zártok — a foglalás {clip.actualEnd}-ig tart, nem {clip.wantedEnd}-ig.</span>
                </p>
              )}
            </FieldRow>
          </div>

          {/* ── VENDÉG + RÉSZLETEK ── */}
          <div className="space-y-6">
            <div>
              <SectionBar icon={UserRound} label="Vendég" />
              <FieldRow label="Név">
                <Input
                  className={ROW_INPUT}
                  value={name}
                  onChange={(e) => { setName(e.target.value); lookup.type('name', e.target.value) }}
                  autoComplete="off"
                  placeholder={source === 'walk_in' ? 'Üresen: „Beeső”' : source === 'phone' ? 'Üresen: „Telefon”' : 'Pl. Kovács Anna'}
                />
              </FieldRow>
              <GuestSuggestList show={!isEdit && lookup.field === 'name'} results={lookup.results} onPick={applySuggestion} />
              <FieldRow label="Telefon">
                <PhoneCountryInput
                  country={country}
                  phone={phone}
                  onCountryChange={setCountry}
                  onPhoneChange={(v) => { setPhone(v); lookup.type('phone', v) }}
                  inputClass="h-9 text-[14px] text-ink"
                />
              </FieldRow>
              <FieldRow
                label="Email"
                hint={emailErr ?? undefined}
                hintTone="bad"
                aside={isEdit && reservation?.id ? (
                  <EmailStatusBadge
                    endpoint={`/api/restaurant/reservation-email-status?reservationId=${reservation.id}`}
                    resendEndpoint="/api/restaurant/resend-reservation-email"
                    resendBody={{ reservationId: reservation.id }}
                  />
                ) : undefined}
              >
                <Input
                  className={ROW_INPUT}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); lookup.type('email', e.target.value) }}
                  placeholder="opcionális"
                  aria-invalid={!!emailErr}
                />
              </FieldRow>
              <GuestSuggestList show={!isEdit && (lookup.field === 'phone' || lookup.field === 'email')} results={lookup.results} onPick={applySuggestion} />
              <FieldRow label="Város">
                <Input className={ROW_INPUT} value={city} onChange={(e) => setCity(e.target.value)} placeholder="opcionális" />
              </FieldRow>
              <FieldRow label="Megjegyzés" last>
                <Input className={ROW_INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. ablak melletti asztal" />
              </FieldRow>

              {target?.reservation?.custom_answers && Object.keys(target.reservation.custom_answers).length > 0 && (
                <div className="mt-3 divide-y divide-line rounded-[12px] border border-line">
                  {Object.values(target.reservation.custom_answers).map((qa, i) => (
                    <div key={i} className="px-3.5 py-2.5">
                      <div className="text-[12px] text-ink-soft">{qa.question}</div>
                      <div className="text-sm text-ink">{qa.answer}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionBar icon={Sparkles} label="Részletek" />
              <FieldRow label="Forrás" stacked>
                <div className="flex flex-wrap gap-1">
                  {sourceOptions.map((o) => (
                    <button key={o.value} type="button" onClick={() => setSource(o.value)} className={pillSmCls(source === o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </FieldRow>
              <FieldRow label="Státusz" stacked>
                <div className="flex flex-wrap gap-1">
                  {statusOptions
                    // "Megerősítésre vár" csak akkor választható, ha a foglalás MÁR most is az
                    .filter((st) => st.value !== 'pending' || status === 'pending')
                    .map((st) => (
                      <button key={st.value} type="button" onClick={() => { setStatus(st.value); setStatusTouched(true) }} className={pillSmCls(status === st.value)}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st.value] ?? 'bg-zinc-300'}`} />
                        {st.label}
                      </button>
                    ))}
                </div>
              </FieldRow>
              {(() => {
                // Ha a jelenlegi alkalom nincs a listában (egyedi/régi), külön kiválasztott pillként mutatjuk.
                const extra = occasion && !eventTypes.some((e) => e.label === occasion)
                  ? [{ icon: occasionIcon ?? 'party', label: occasion }]
                  : []
                const opts = [...eventTypes, ...extra]
                if (opts.length === 0) return null
                return (
                  <FieldRow label="Alkalom" stacked last>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => { setOccasion(null); setOccasionIcon(null) }} className={pillSmCls(occasion == null)}>Nincs</button>
                      {opts.map((et, i) => {
                        const Icon = eventIconByKey(et.icon)
                        const active = occasion === et.label
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => active ? (setOccasion(null), setOccasionIcon(null)) : (setOccasion(et.label), setOccasionIcon(et.icon))}
                            className={pillSmCls(active)}
                          >
                            <Icon className={`h-3 w-3 ${active ? 'text-gold' : 'text-ink-soft2'}`} strokeWidth={1.8} />
                            {et.label}
                          </button>
                        )
                      })}
                    </div>
                  </FieldRow>
                )
              })()}
            </div>
          </div>
              </motion.div>{/* /Törzs */}

              {/* Lábléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 flex-col gap-2 border-t border-line p-4 sm:px-6 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
                {/* Összegzés — mint a szalonnál: kör (a létszámmal) + mellette KÉT sor
                    (1: név / létszám, 2: nap · idő · asztal · forrás). Asztalon a gomb mellett. */}
                <div className="flex min-w-0 items-center gap-2.5 lg:flex-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[13px] font-semibold tabular-nums text-white">{pax}</span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{name.trim() || `${pax} fős asztalfoglalás`}</span>
                    <span className="block truncate text-[12px] text-ink-soft">
                      {[
                        name.trim() ? `${pax} fő` : null,
                        formatHuDate(selectedDate),
                        startTime || null,
                        tableId ? pickedNames : null,
                        sourceOptions.find((o) => o.value === source)?.label,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </div>
                {/* A vázlat lokális → online/offline is menthető. Valódi foglalás szerkesztéséhez szerver kell. */}
                <Button onClick={() => save()} disabled={saving || (!online && isEdit && !isDraft)} className="h-12 w-full rounded-full bg-ink-dark text-[15px] font-semibold text-white hover:bg-ink-dark/90 lg:w-auto lg:px-10">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isDraft
                    ? (online ? 'Vázlat véglegesítése' : 'Vázlat mentése (offline)')
                    : !online
                      ? (isEdit ? 'Offline — szerkesztés nem lehetséges' : 'Mentés vázlatként (offline)')
                      : (isEdit ? 'Mentés' : 'Foglalás rögzítése')}
                </Button>
                {isDraft ? (
                  <Button
                    onClick={discardDraft}
                    disabled={saving}
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-700 lg:order-first lg:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Vázlat törlése
                  </Button>
                ) : (
                  isEdit && (
                    <Button
                      onClick={() => setConfirmCancel(true)}
                      disabled={saving}
                      variant="ghost"
                      className="w-full text-red-600 hover:text-red-700 lg:order-first lg:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Törlés
                    </Button>
                  )
                )}
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Kisebb asztalra ültetés — tudatos megerősítés után mehet (a szerver is csak így engedi) */}
      <ConfirmDialog
        open={confirmSmallTable}
        title={`Biztosan a kisebb asztalra ülteted a ${pax} főt?`}
        description={`${pickedNames} csak ${pickedCapacity} fős. Ha mégis így rögzíted, a foglalás erre az asztalra kerül.`}
        confirmLabel="Igen, így rögzítem"
        cancelLabel="Mégse, választok mást"
        destructive={false}
        busy={saving}
        zIndexClass="z-[1300]"
        onCancel={() => setConfirmSmallTable(false)}
        onConfirm={() => { setConfirmSmallTable(false); void save({ allowOverCapacity: true }) }}
      />

      {confirmCancel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
          <div className="w-full max-w-md rounded-2xl bg-white border border-line p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink mb-1">Biztosan törlöd a foglalást?</h3>
                <p className="text-sm text-ink-soft">
                  Ez a művelet nem vonható vissza — a foglalás véglegesen törlődik a rendszerből.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={saving}
                className="flex-1 h-11 rounded-full bg-[#F4F4F4] text-ink text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={deleteReservation}
                disabled={saving}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Törlés...' : 'Igen, törlöm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dirty-guard — mentetlen változásnál zárás előtt rákérdezünk. */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-line p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink mb-1">Elveted a módosításokat?</h3>
                <p className="text-sm text-ink-soft">
                  Van mentetlen változás. Ha bezárod, elvész.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 h-11 rounded-full bg-[#F4F4F4] text-ink text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={() => { setConfirmDiscard(false); onClose() }}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Elvetem
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}


/** Csoportosított asztal-választó: „Automatikus” (ajánlással) felül, alatta teremenként pill-gombok.
 *  Szabad = kattintható; kicsi = halvány; foglalt (ebben az idősávban) = áthúzott, nem kattintható. */
function TablePicker({
  free, busy, value, combo, onPick,
}: {
  free: MoveOption[]
  busy: MoveOption[]
  value: string
  combo: ComboOption | null
  onPick: (id: string) => void
}) {
  type Item = MoveOption & { state: 'free' | 'small' | 'busy' }
  const items: Item[] = [
    ...free.map((t) => ({ ...t, state: (t.fitsPax ? 'free' : 'small') as Item['state'] })),
    ...busy.filter((b) => !free.some((f) => String(f.id) === String(b.id))).map((t) => ({ ...t, state: 'busy' as const })),
  ]
  const rooms = new Map<string, Item[]>()
  for (const it of items) {
    const key = it.room ?? 'Terem nélkül'
    if (!rooms.has(key)) rooms.set(key, [])
    rooms.get(key)!.push(it)
  }
  for (const list of rooms.values()) list.sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name, 'hu'))
  const best = free.find((t) => t.fitsPax)
  const autoHint = combo ? `${combo.names.join(' + ')} · ${combo.totalCapacity} fő (összevonva)` : best ? `${best.name} · ${best.capacity} fő` : 'nincs megfelelő szabad asztal'
  const selected = new Set(value ? value.split(',') : [])

  return (
    <div className="space-y-3 px-3 pb-3 pt-1">
      <button
        type="button"
        onClick={() => onPick('')}
        className={`flex w-full items-center justify-between gap-3 rounded-[14px] border px-3.5 py-2.5 text-left transition-colors ${
          !value ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong'
        }`}
      >
        <span>
          <span className="block text-[13px] font-semibold">Automatikus</span>
          <span className={`block text-[11.5px] ${!value ? 'text-white/65' : 'text-ink-soft2'}`}>A rendszer ezt adná: {autoHint}</span>
        </span>
        {!value && <span className="text-[12px] font-semibold text-gold">✓</span>}
      </button>

      {[...rooms.entries()].map(([room, list]) => (
        <div key={room}>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-ink-soft2">{room}</p>
          <div className="flex flex-wrap gap-1.5">
            {list.map((t) => {
              const on = selected.has(String(t.id))
              const busyT = t.state === 'busy'
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busyT && !on}
                  onClick={() => onPick(String(t.id))}
                  title={busyT ? 'Ebben az idősávban foglalt' : t.state === 'small' ? 'Kicsi ehhez a létszámhoz' : undefined}
                  className={`relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                    on
                      ? 'border-ink-dark bg-ink-dark text-white'
                      : busyT
                        ? 'cursor-not-allowed border-dashed border-line bg-transparent text-ink-soft2/60 line-through'
                        : t.state === 'small'
                          ? 'border-line bg-white text-ink-soft2 hover:border-line-strong'
                          : 'border-line bg-white text-ink hover:border-line-strong'
                  }`}
                >
                  {/* ugyanaz a jel, mint a jelmagyarázatban */}
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    busyT ? 'border border-dashed border-ink-soft2 bg-transparent' : t.state === 'small' ? 'bg-[#D9D4C5]' : 'bg-[#1D9D63]'
                  }`} />
                  {t.name}
                  <span className={`text-[11.5px] font-medium ${on ? 'text-white/65' : 'text-ink-soft2'}`}>{t.capacity} fő</span>
                  {on && t.state !== 'free' && <span className="text-[11px] font-semibold text-gold">{busyT ? 'foglalt!' : 'kicsi!'}</span>}
                  {/* percjelző a jobb felső sarokban: foglaltnál ennyi múlva szabadul, szabadnál ennyi ideig szabad */}
                  {(t.busyForMin != null || t.freeForMin != null) && (
                    <span
                      title={t.busyForMin != null ? `${t.busyForMin} perc múlva szabadul fel` : `Csak ${t.freeForMin} percig szabad — utána foglalás jön rá`}
                      className="absolute -right-1 -top-1.5 rounded-full bg-amber-500 px-1.5 py-px text-[9.5px] font-bold leading-tight text-white no-underline shadow-sm"
                    >
                      {t.busyForMin ?? t.freeForMin}'
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[11px] text-ink-soft2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#1D9D63]" />szabad</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#D9D4C5]" />kicsi a társaságnak</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-dashed border-ink-soft2" />foglalt ebben az időben</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-tight text-white">15'</span>foglaltnál: ennyi múlva szabadul · szabadnál: ennyi ideig szabad</span>
      </div>
    </div>
  )
}
