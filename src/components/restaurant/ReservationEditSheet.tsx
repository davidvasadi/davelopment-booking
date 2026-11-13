'use client'


import { invoiceHref } from '@/lib/invoiceLinks'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, FIELD, Input, Meta, Pill, StatusPill } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { BookingSummary } from '@/components/shared/BookingSummary'
import { ChoicePills, PaxStep, SlotGrid, StepRow, StepTitle, TableStep, slotGridOf } from '@/components/blocks/booking'
import { DayPickerStrip } from '@/components/shared/BookingsDateNav'
import { statusOf } from '@/components/shared/BookingList'
import { Loader2, Trash2, Check } from 'lucide-react'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { hhmmToMinutes, minutesToHHMM, capsWords } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/offlineDrafts'
import { useOnline } from '@/lib/useOnline'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { urgencyOf } from './DailyView'
import { PhoneCountryInput } from '@/components/booking/PhoneInputs'
import { COUNTRIES } from '@/components/booking/phoneCountries'
import { EmailStatusBadge } from '@/components/shared/EmailStatusBadge'
import type { Reservation } from '@/payload/payload-types'
import { useGuestLookup, GuestSuggestList, type GuestSuggestion } from '@/components/shared/GuestLookup'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/** Ma (helyi idő) és a mostani óra:perc — az alap-kijelölés ma az első ez utáni szabad időpont. */
const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/** „2026. Október 26., hétfő” — a panel fejlécébe (a nyers ÉÉÉÉ-HH-NN helyett). */
function formatLongHu(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return capsWords(new Date(y, m - 1, d).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
}

// ISO ország-kód → nemzetközi előhívó (a tárolt teljes szám összeállításához / felbontásához).
const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

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

const statusOptions: { value: Reservation['status']; label: string }[] = [
  { value: 'pending', label: 'Függő' },
  { value: 'confirmed', label: 'Megerősítve' },
  { value: 'seated', label: 'Leültetve' },
  { value: 'completed', label: 'Befejezett' },
  { value: 'no_show', label: 'Nem jött meg' },
  { value: 'cancelled', label: 'Lemondva' },
]

const statusLabelOf = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s
const sourceLabelOf: Record<string, string> = { walk_in: 'Beeső', phone: 'Telefon', online: 'Online' }

const sourceOptions: { value: Reservation['source']; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'phone', label: 'Telefon' },
  { value: 'walk_in', label: 'Beeső' },
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
  const exclude: Record<string, string> = reservation?.id ? { excludeReservationId: String(reservation.id) } : {}
  const isEdit = !!reservation
  const draftId = draftIdOf(reservation)
  const isDraft = draftId != null


  // A foglalás napja — kezdetben a jelenleg megtekintett nap (a `date` prop), de a sheeten
  // belül átválasztható (ld. DatePickerPopover lent), hogy ne kelljen a nézetet elhagyni
  // egy másik napra foglaláshoz.
  const [selectedDate, setSelectedDate] = useState(date)
  const [startTime, setStartTime] = useState('')
  const [pax, setPax] = useState(2)
  const [tableId, setTableId] = useState<string>('') // '' = auto
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')
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
  // a nap összes kezdése (a rácson a nem szabad foglaltként látszik — design 6.18)
  const [allSlots, setAllSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // A ténylegesen beállított létszámra elférő időpontok halmaza — külön, lassabban
  // (debounce-olva) frissül, hogy a +/- pötyögtetése ne dobja újra az egész rácsot.
  const [paxAvailableStarts, setPaxAvailableStarts] = useState<Set<string> | null>(null)
  // az időpontot a rendszer választotta-e (nem a tulaj kattintott rá)
  const autoTimeRef = useRef(false)
  // Igaz, ha a nap TELJESEN zárva van (pl. heti pihenőnap) — a szerver mondja meg (getOpeningWindow),
  // nem a kliens tippeli a záróra alapján, mert az csak az "elmúlt mára" esetet fedi le.
  const [dayClosed, setDayClosed] = useState(false)
  const [options, setOptions] = useState<MoveOption[]>([])
  const [busyTables, setBusyTables] = useState<MoveOption[]>([])
  // az összevonás-javaslatot elutasította (design 6.18 „Nem kérem”)
  const [comboDismissed, setComboDismissed] = useState(false)
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
    setAddress(r?.customer_address ?? '')
    setZip(r?.customer_postal_code ?? '')
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
      r?.customer_city ?? '', r?.customer_address ?? '', r?.customer_postal_code ?? '',
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
    if (!open || !restaurantId) {
      setFetchedSlots([])
      setAllSlots([])
      setSlotsLoading(false)
      setDayClosed(false)
      setPaxAvailableStarts(null)
      return
    }
    const ctrl = new AbortController()
    setSlotsLoading(true)
    setFetchedSlots([])
    setDayClosed(false)
    setPaxAvailableStarts(null)
    // szerkesztésnél a saját foglalás nem foglalja a saját asztalát — utólag is a szabadok közül választható
    const params = new URLSearchParams({ restaurantId, date: selectedDate, pax: '1', includePast: '1', ...exclude })
    fetch(`/api/restaurant/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Slots API ${r.status}`)
        return r.json() as Promise<{ slots?: { start: string; end: string }[]; candidates?: string[]; closed?: boolean }>
      })
      .then((json) => {
        setFetchedSlots(json.slots ?? [])
        setAllSlots(json.candidates ?? [])
        setDayClosed(!!json.closed)
        setSlotsLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        console.error('[ReservationEditSheet] slots fetch failed', err)
        setSlotsLoading(false)
      })
    return () => ctrl.abort()
  }, [isEdit, open, restaurantId, selectedDate])

  // A választott asztal(ok) szabad kezdései — a rácson a többi áthúzva (mint a szalonnál a választott munkatársnál),
  // a múltban és most is: ami arra az asztalra már foglalt, az nem választható tisztán.
  const [tableFreeStarts, setTableFreeStarts] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!open || !restaurantId || !tableId) { setTableFreeStarts(null); return }
    const ctrl = new AbortController()
    const params = new URLSearchParams({ restaurantId, date: selectedDate, pax: String(pax || 1), includePast: '1', tableIds: tableId, duration: String(duration), ...exclude })
    fetch(`/api/restaurant/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { tableFree?: string[] } | null) => setTableFreeStarts(json?.tableFree ? new Set(json.tableFree) : null))
      .catch(() => {})
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, restaurantId, selectedDate, tableId, duration])

  // Új foglalásnál alapból az első szabad időpont (erre a létszámra) — ma a mostani idő utáni első (design 6.18)
  useEffect(() => {
    if (!open || isEdit || slotsLoading || startTime || fetchedSlots.length === 0) return
    const now = selectedDate === todayYmd() ? nowHM() : ''
    const first = fetchedSlots.map((x) => x.start).find((t) => t >= now && (!paxAvailableStarts || paxAvailableStarts.has(t)))
    if (first) { autoTimeRef.current = true; setStartTime(first) }
  }, [open, isEdit, slotsLoading, fetchedSlots, paxAvailableStarts, startTime, selectedDate])
  // a rendszer választotta időpont, ha a létszám / ülésidő változása után már nem fér el: újra a következő jót választja
  useEffect(() => {
    if (isEdit || !autoTimeRef.current || !startTime || !paxAvailableStarts || paxAvailableStarts.has(startTime)) return
    setStartTime('')
  }, [isEdit, paxAvailableStarts, startTime])

  // Az adott létszámra ténylegesen elférő időpontok. NINCS debounce — minden létszám-
  // változásra azonnal indul a kérés, az előzőt az AbortController szakítja félbe, így
  // mindig csak a LEGUTOLSÓ fut le. A régi halmazt megtartjuk amíg az új meg nem érkezik,
  // hogy a rács ne villanjon el/vissza minden kattintásnál (folyamatos, ugrás-mentes UX).
  useEffect(() => {
    if (!open || !restaurantId || !pax) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ restaurantId, date: selectedDate, pax: String(pax), duration: String(duration), includePast: '1', ...exclude })
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
  }, [isEdit, open, restaurantId, selectedDate, pax, duration])

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
    customer_address: address,
    customer_postal_code: zip,
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

  const save = async (opts?: { allowOverCapacity?: boolean; status?: Reservation['status'] }) => {
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
          customer_address: address.trim(),
          customer_postal_code: zip.trim(),
          // A helyi szám elé az ország-előhívó (a publikus foglaló formátumával egyezően).
          customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
          country,
          customer_email: email,
          notes,
          status: opts?.status ?? status,
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
      toast.success(opts?.status === 'confirmed' ? 'Elfogadva — a vendég megkapta a visszaigazolást' : isDraft ? 'Vázlat véglegesítve' : isEdit ? 'Foglalás frissítve' : 'Foglalás rögzítve')
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
    selectedDate, startTime, pax, tableId, name, city, address, zip, phone, country, email, notes, status, source, occasion, occasionIcon, duration,
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
  const endTime = startTime ? minutesToHHMM(hhmmToMinutes(startTime) + duration) : ''
  const saveLabel = isDraft
    ? (online ? 'Vázlat véglegesítése' : 'Vázlat mentése (offline)')
    : !online
      ? (isEdit ? 'Offline — szerkesztés nem lehetséges' : 'Mentés vázlatként (offline)')
      : (isEdit ? 'Mentés' : 'Foglalás mentése')

  if (typeof document === 'undefined') return null
  return (
    <>
      {/* Új / szerkesztett asztalfoglalás (a /design 6.18): balra a lépések, jobbra az élő összegzés a mentéssel */}
      <PopupModal
        open={open}
        onClose={requestClose}
        title={isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
        subtitle={isDraft ? 'még nem véglegesített offline vázlat' : undefined}
        headerExtra={(isEdit && !isDraft) || occasion ? <>{isEdit && !isDraft && (
                        <>
                          <StatusPill status={statusOf(status).tone}>{statusLabelOf(status)}</StatusPill>
                          {source && source !== 'online' && <Pill tone="cell" size="sm">{sourceLabelOf[source]}</Pill>}
                          {urgency && <StatusPill status={urgency.tone}>{urgency.label}</StatusPill>}
                          {reservation?.payment_status === 'paid' && (
                            reservation.invoice_status === 'issued' && reservation.invoice_number
                              // van számla: a pill a Számlák listára visz, és ott meg is nyitja
                              ? <a href={invoiceHref('restaurant', reservation.invoice_number)} title={`Számla: ${reservation.invoice_number} — megnyitás`} className="transition-opacity hover:opacity-80">
                                  <StatusPill status="ok">Előleg befizetve{reservation.deposit_amount_huf ? ` · ${reservation.deposit_amount_huf.toLocaleString('hu-HU')} Ft` : ''} · számla ↗</StatusPill>
                                </a>
                              : <span title="Bizonylat még nincs kiállítva"><StatusPill status="ok">Előleg befizetve{reservation.deposit_amount_huf ? ` · ${reservation.deposit_amount_huf.toLocaleString('hu-HU')} Ft` : ''}</StatusPill></span>
                          )}
                          {reservation?.payment_status === 'failed' && <StatusPill status="bad">Sikertelen előleg-fizetés</StatusPill>}
                          {reservation?.payment_status === 'refunded' && <StatusPill status="warn">Előleg visszatérítve</StatusPill>}
                        </>
                      )}
                      {/* Alkalom — a választott esemény-típus ikonjával és saját színével */}
                      {occasion && (() => {
                        const OccIcon = eventIconByKey(occasionIcon)
                        return (
                          <Pill tone="white" size="sm">
                            <OccIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} /> {occasion}
                          </Pill>
                        )
                      })()}</> : undefined}
        maxWidth="sm:max-w-[960px]"
        aside={
          <BookingSummary
            name={name.trim() || `${pax} fős asztalfoglalás`}
            sub={[phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : null, email.trim() || null].filter(Boolean).join(' · ') || undefined}
            day={formatLongHu(selectedDate)}
            time={startTime}
            until={endTime ? `– ${endTime} · ${duration} perc` : undefined}
            rows={[
              ['Létszám', `${pax} fő`],
              ['Asztal', tableId ? pickedNames : 'Automatikus'],
              ['Forrás', sourceOptions.find((o) => o.value === source)?.label ?? '—'],
              ...(occasion ? [['Alkalom', occasion] as [string, string]] : []),
              ...(notes.trim() ? [['Megjegyzés', notes.trim()] as [string, string]] : []),
            ]}
            confirmNote={!isEdit && email.trim() && !emailErr ? 'Visszaigazoló e-mail megy a vendégnek' : undefined}
            actions={<>
              {isEdit && !isDraft && target?.reservation?.status === 'pending' && (
                <Button size="lg" variant="yellow" icon={Check} onClick={() => save({ status: 'confirmed' })} disabled={saving || !online} className="w-full">Elfogadás</Button>
              )}
              <Button size="lg" onClick={() => save()} disabled={saving || (!online && isEdit && !isDraft)} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saveLabel}
              </Button>
              {isDraft
                ? <Button onClick={discardDraft} disabled={saving} variant="ghost" icon={Trash2} className="w-full text-ui-bad">Vázlat törlése</Button>
                : isEdit && <Button onClick={() => setConfirmCancel(true)} disabled={saving} variant="ghost" icon={Trash2} className="w-full text-ui-bad">Törlés</Button>}
            </>}
          />
        }
      >
        <StepTitle n={1} className="mt-0">Vendég</StepTitle>
        <Input className="mt-2" value={name} onChange={(e) => { setName(e.target.value); lookup.type('name', e.target.value) }} autoComplete="off" placeholder={source === 'walk_in' ? 'Vendég neve (üresen: „Beeső”)' : source === 'phone' ? 'Vendég neve (üresen: „Telefon”)' : 'Vendég neve'} />
        <GuestSuggestList show={!isEdit && lookup.field === 'name'} results={lookup.results} onPick={applySuggestion} />
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <PhoneCountryInput country={country} phone={phone} onCountryChange={setCountry} onPhoneChange={(v) => { setPhone(v); lookup.type('phone', v) }} inputClass={`${FIELD} h-11`} />
          <Input value={email} onChange={(e) => { setEmail(e.target.value); lookup.type('email', e.target.value) }} placeholder="E-mail (opcionális)" aria-invalid={!!emailErr} />
          {/* a cím egy sorban: keskeny irányítószám, város, utca + házszám */}
          <div className="grid gap-1.5 sm:col-span-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)]">
            <Input value={zip} onChange={(e) => setZip(e.target.value.slice(0, 10))} placeholder="Irsz." aria-label="Irányítószám" inputMode="numeric" />
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Város" aria-label="Város" />
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Utca, házszám" aria-label="Utca, házszám" />
          </div>
        </div>
        {emailErr && <p className="mt-1 text-ui-label text-ui-bad">{emailErr}</p>}
        {isEdit && reservation?.id && (
          <div className="mt-1.5"><EmailStatusBadge endpoint={`/api/restaurant/reservation-email-status?reservationId=${reservation.id}`} resendEndpoint="/api/restaurant/resend-reservation-email" resendBody={{ reservationId: reservation.id }} /></div>
        )}
        <GuestSuggestList show={!isEdit && (lookup.field === 'phone' || lookup.field === 'email')} results={lookup.results} onPick={applySuggestion} />
        <div className="mt-1.5">
          {target?.reservation?.custom_answers && Object.keys(target.reservation.custom_answers).length > 0 && (
                <div className="mt-3 divide-y divide-dashed divide-ui-divider rounded-ui-control bg-ui-cell">
                  {Object.values(target.reservation.custom_answers).map((qa, i) => (
                    <div key={i} className="px-3.5 py-2.5">
                      <div className="text-ui-meta text-ui-muted">{qa.question}</div>
                      <div className="text-ui-body text-ui-text">{qa.answer}</div>
                    </div>
                  ))}
                </div>
              )}
        </div>

        <PaxStep className="mt-5" pax={pax} paxMax={paxCap} onPax={setPax} hint={atPaxCap ? `Erre az időpontra max ${paxCap} fő fér el.` : undefined} />

        <StepTitle n={3}>Időpont</StepTitle>
        <div className="mt-2"><DayPickerStrip value={selectedDate} onPick={setSelectedDate} loadEndpoint="/api/restaurant/day-load" /></div>
        {/* design 6.18: mindig a rács — a foglalt (vagy erre a létszámra kevés) csíkos, áthúzott; kézzel az is választható */}
        {slotsLoading ? (
          <div className="mt-2 flex h-10 items-center gap-2 text-ui-body text-ui-muted"><Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Időpontok betöltése…</div>
        ) : (() => {
          const free = fetchedSlots.map((x) => x.start).filter((t) => (!paxAvailableStarts || paxAvailableStarts.has(t)) && (!tableFreeStarts || tableFreeStarts.has(t)))
          const grid = slotGridOf({ free, all: allSlots, on: startTime || undefined, fallback: [openMin ?? 11 * 60, closeMin ?? 22 * 60] })
          return (
            <>
              <SlotGrid className="mt-2 sm:grid-cols-6" slots={grid.slots} on={startTime} busy={grid.busy} onPick={(t) => { autoTimeRef.current = false; setStartTime(t) }} />
              {free.length === 0 && <Meta className="mt-2">{dayClosed || !allSlots.length ? 'Ezen a napon zárva vagytok' : `Erre a napra ${pax} főre nincs szabad asztal`} — a csíkos időpont is választható, ha mégis felveszed.</Meta>}
            </>
          )
        })()}

        {/* design 6.18: asztal (automatikus vagy választott), összevonás-javaslat, alkalom */}
        {(() => {
          const free = tableChoices.map((t) => ({ id: String(t.id), name: t.name, capacity: t.capacity, small: !t.fitsPax, title: !t.fitsPax ? 'Kicsi ehhez a létszámhoz' : t.freeForMin != null ? `Csak ${t.freeForMin} percig szabad — utána foglalás jön rá` : undefined }))
          const busy = busyTables.filter((b) => !tableChoices.some((f) => String(f.id) === String(b.id))).map((t) => ({ id: String(t.id), name: t.name, capacity: t.capacity, busy: true, busyMin: t.busyForMin, title: t.busyForMin != null ? `${t.busyForMin} perc múlva szabadul fel` : 'Ebben az idősávban foglalt' }))
          const hint = !startTime ? 'Előbb válassz időpontot — utána látod a szabad asztalokat.'
            : pickedBusy.length > 0 && !optionsLoading ? `${pickedNames} ekkor már foglalt — válassz másikat.`
            : pickedTooSmall && !optionsLoading ? `${pickedNames} (${pickedCapacity} fő) kicsi ${pax} főre — válassz nagyobbat.`
            : !optionsLoading && options.length === 0 && !suggestedCombo ? 'Nincs szabad asztal erre az időpontra/létszámra.'
            : undefined
          // a jelenlegi alkalom, ha nincs a listában (egyedi / régi), külön választhatóként
          const occOpts = [...eventTypes, ...(occasion && !eventTypes.some((e) => e.label === occasion) ? [{ icon: occasionIcon ?? 'party', label: occasion }] : [])]
          return (
            <TableStep
              n={4}
              className="mt-5"
              time={startTime || undefined}
              tables={startTime ? [...free, ...busy] : []}
              value={tableId}
              onPick={setTableId}
              autoHint={!startTime || optionsLoading ? undefined : suggestedCombo ? `${suggestedCombo.names.join(' + ')} összetolva · ${suggestedCombo.totalCapacity} hely` : (() => { const best = [...options].filter((o) => o.fitsPax).sort((a, b) => a.capacity - b.capacity)[0]; return best ? `${best.name} · ${best.capacity} fő` : 'nincs megfelelő szabad asztal' })()}
              hint={hint}
              combo={suggestedCombo && tableId === '' && !comboDismissed ? { label: `${suggestedCombo.names.join(' + ')} · ${suggestedCombo.totalCapacity} hely`, reason: `Egy szabad asztal sem elég ${pax} főre.` } : null}
              onCombo={(accept) => (accept && suggestedCombo ? setTableId(suggestedCombo.ids.map(String).join(',')) : setComboDismissed(true))}
              occasions={occOpts.map((e) => ({ value: e.label, label: e.label }))}
              occasion={occasion}
              onOccasion={(v) => { if (v === occasion) { setOccasion(null); setOccasionIcon(null) } else { setOccasion(v); setOccasionIcon(occOpts.find((e) => e.label === v)?.icon ?? null) } }}
            />
          )
        })()}

        <StepTitle n={5}>Egyéb</StepTitle>
        <StepRow label="Forrás" first>
          <ChoicePills options={sourceOptions.map((o) => ({ value: o.value ?? '', label: o.label }))} value={source ?? null} onPick={(v) => setSource(v as Reservation['source'])} />
        </StepRow>
        {/* az asztal mennyi időre foglalt — a kit választó pilljeivel (a csúszka helyett) */}
        <StepRow label="Ülésidő">
          <ChoicePills
            options={[...new Set([30, 60, 90, 120, 150, 180, duration])].sort((x, y) => x - y).map((m) => ({ value: String(m), label: m % 60 ? `${Math.floor(m / 60) ? `${Math.floor(m / 60)},5` : '0,5'} ó` : `${m / 60} ó` }))}
            value={String(duration)}
            onPick={(v) => setDuration(Number(v))}
          />
        </StepRow>
        {clip && <Meta className="text-ui-bad">Záráskor ({clip.actualEnd}) zártok — a foglalás {clip.actualEnd}-ig tart, nem {clip.wantedEnd}-ig.</Meta>}
        <StepRow label="Státusz">
          <ChoicePills options={statusOptions.map((o) => ({ value: o.value, label: o.label }))} value={status} onPick={(v) => { setStatus(v as Reservation['status']); setStatusTouched(true) }} />
        </StepRow>
        <StepRow label="Megjegyzés">
          <Input size="sm" hug className="min-w-[220px] max-w-[min(100%,520px)]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. ablak melletti asztal" />
        </StepRow>
      </PopupModal>

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

      <ConfirmDialog
        open={confirmCancel}
        title="Biztosan törlöd a foglalást?"
        description="Ez a művelet nem vonható vissza — a foglalás véglegesen törlődik a rendszerből."
        confirmLabel={saving ? 'Törlés…' : 'Igen, törlöm'}
        busy={saving}
        onConfirm={deleteReservation}
        onCancel={() => setConfirmCancel(false)}
        zIndexClass="z-[95]"
      />
      {/* Dirty-guard — mentetlen változásnál zárás előtt rákérdezünk. */}
      <ConfirmDialog
        open={confirmDiscard}
        title="Elveted a módosításokat?"
        description="Van mentetlen változás. Ha bezárod, elvész."
        confirmLabel="Elvetem"
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
        onCancel={() => setConfirmDiscard(false)}
        zIndexClass="z-[95]"
      />
    </>
  )
}

