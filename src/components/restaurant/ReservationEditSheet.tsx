'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, AlertTriangle, X, CalendarClock, UserRound, Sparkles } from 'lucide-react'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/offlineDrafts'
import { useOnline } from '@/lib/useOnline'
import { urgencyOf } from './DailyView'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import type { Reservation } from '@/payload/payload-types'

// ISO ország-kód → nemzetközi előhívó (a tárolt teljes szám összeállításához / felbontásához).
const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

// Az avatar-menü (UserMenu) „genie" belépője — a foglalás-panel PONTOSAN ezt használja
// (azonos érzés: nagy scale-ugrás + overshoot = pulzáló pop, a gyerekek staggerrel folynak be).
const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
} as const
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
}

export interface ComboOption {
  ids: (string | number)[]
  names: string[]
  totalCapacity: number
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
  confirmed: 'bg-amber-400 text-amber-950',
  seated: 'bg-indigo-500 text-white',
  completed: 'bg-emerald-500 text-white',
  no_show: 'bg-red-500 text-white',
  cancelled: 'bg-zinc-200 text-zinc-500 line-through',
}
const statusLabelOf = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s
const sourceLabelOf: Record<string, string> = { walk_in: 'Beeső', phone: 'Telefon', online: 'Online' }

const sourceOptions: { value: Reservation['source']; label: string }[] = [
  { value: 'walk_in', label: 'Beeső' },
  { value: 'phone', label: 'Telefon' },
  { value: 'online', label: 'Online' },
]

// Ülésidő gyorsválasztó. null = az étterem alap turnusa (általában 2 óra).
const durationOptions: { value: number | null; label: string }[] = [
  { value: 60, label: '1 óra' },
  { value: 90, label: '90 perc' },
  { value: 120, label: '2 óra' },
  { value: null, label: 'Alap' },
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
}

export function ReservationEditSheet({ open, onClose, date, restaurantId, eventTypes = [], target, openMin, closeMin }: Props) {
  const router = useRouter()
  const online = useOnline()
  const reservation = target?.reservation ?? null
  const isEdit = !!reservation
  const draftId = draftIdOf(reservation)
  const isDraft = draftId != null

  const [startTime, setStartTime] = useState('')
  const [pax, setPax] = useState(2)
  const [tableId, setTableId] = useState<string>('') // '' = auto
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('HU')
  const [email, setEmail] = useState('')
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
  // Ülésidő percben. null = az étterem alap turnusa (alapból 2 óra).
  const [duration, setDuration] = useState<number | null>(null)

  const [options, setOptions] = useState<MoveOption[]>([])
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
    return ymd === date ? now.getHours() * 60 + now.getMinutes() : null
  })()
  const urgency = reservation && !isDraft ? urgencyOf({ ...reservation, status }, nowMin) : null

  // A kiválasztott ülésidő záráshoz vágása. Ha a turnus túllógna a záráson, a foglalás
  // valójában csak zárásig tart — ezt a hostnak jelezzük (nem néma vágás). A „null"
  // ülésidő az étterem alap turnusa; itt a kijelzéshez 120 percet feltételezünk.
  const startMin = startTime ? hhmmToMinutes(startTime) : null
  const wantedDuration = duration ?? 120
  const clip =
    startMin != null && closeMin != null && startMin + wantedDuration > closeMin
      ? { actualEnd: minutesToHHMM(closeMin), wantedEnd: minutesToHHMM(startMin + wantedDuration) }
      : null

  // Form inicializálás nyitáskor
  useEffect(() => {
    if (!open || !target) return
    const r = target.reservation
    // Új foglalásnál (nincs meglévő idő és nincs preset) a jelenlegi órára állunk,
    // de csak ha a megtekintett nap MA van — így nem kell sokat görgetni a wheel-ben.
    // A perc nem számít (00), csak az óra adjon kapaszkodót.
    const nowStart = (() => {
      const now = new Date()
      const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      if (ymd !== date) return ''
      // Az aktuális (egész) órát a nyitvatartásra szorítjuk (kemény korlát), perc nélkül.
      let mins = now.getHours() * 60
      if (openMin != null) mins = Math.max(mins, openMin)
      if (closeMin != null) mins = Math.min(mins, closeMin)
      return minutesToHHMM(mins)
    })()
    setStartTime(r?.start_time ?? target.presetStart ?? nowStart)
    setPax(r?.pax ?? 2)
    const currentTables = r?.tables?.length
      ? r.tables.map((t) => (typeof t === 'object' && t ? t.id : t))
      : target.presetTableId != null
        ? [target.presetTableId]
        : []
    setTableId(currentTables.length ? currentTables.map(String).join(',') : '')
    setName(r?.customer_name ?? '')
    // A tárolt teljes szám (pl. „+36 30…") vissza ország-kódra + helyi részre a mezőhöz.
    const initCountry = r?.country ?? 'HU'
    const parsedPhone = splitLocalPhone(r?.customer_phone, initCountry)
    setCountry(parsedPhone.country)
    setPhone(parsedPhone.phone)
    setEmail(r?.customer_email ?? '')
    setNotes(r?.notes ?? '')
    const initSource = r?.source ?? 'walk_in'
    setSource(initSource)
    setOccasion(r?.occasion ?? null)
    setOccasionIcon(r?.occasion_icon ?? null)
    // Meglévő foglalásnál a tárolt hossz; újnál null (= étterem alap turnusa).
    const initDuration =
      r?.start_time && r?.end_time
        ? Math.max(0, hhmmToMinutes(r.end_time) - hhmmToMinutes(r.start_time))
        : null
    setDuration(initDuration)
    // Új foglalás alap-státusza a forrás + időpont alapján (módosítható); meglévőnél a tárolt.
    const initStart = r?.start_time ?? target.presetStart ?? nowStart
    const initStatus = r?.status ?? computeDefaultStatus(initSource, date, initStart, initDuration)
    setStatus(initStatus)
    setStatusTouched(false)
    setConfirmDiscard(false)
    // A nyitáskori állapot aláírása — ehhez hasonlítjuk a dirty-guardhoz (mentetlen változás).
    initSigRef.current = JSON.stringify([
      r?.start_time ?? target.presetStart ?? nowStart,
      r?.pax ?? 2,
      currentTables.length ? currentTables.map(String).join(',') : '',
      r?.customer_name ?? '',
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
    if (!open || isEdit || statusTouched) return
    setStatus(computeDefaultStatus(source, date, startTime, duration))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, statusTouched, source, startTime, duration, date])

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
      const qs = new URLSearchParams({ date, start_time: startTime, pax: String(pax) })
      if (reservation) qs.set('excludeReservationId', String(reservation.id))
      const res = await fetch(`/api/restaurant/move-options?${qs}`, { credentials: 'include' })
      const json = await res.json()
      setOptions(json.tables ?? [])
      setSuggestedCombo(json.suggestedCombo ?? null)
      setMaxPax(typeof json.maxPax === 'number' ? json.maxPax : 0)
    } catch {
      setOptions([])
      setSuggestedCombo(null)
      setMaxPax(0)
    } finally {
      setOptionsLoading(false)
    }
  }, [startTime, pax, date, reservation])

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
      date,
      start_time: startTime,
      pax,
      tableIds: selectedTableIds,
      customer_name: name,
      customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
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

  const save = async () => {
    if (!startTime) return toast.error('Adj meg időpontot')
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
          date,
          start_time: startTime,
          pax,
          tableIds: selectedTableIds,
          customer_name: name,
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
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hiba')
      // Sikeres véglegesítés után a lokális vázlat törölhető (különben duplán látszana).
      if (isDraft && draftId) removeDraft(restaurantId, draftId)
      toast.success(isDraft ? 'Vázlat véglegesítve' : isEdit ? 'Foglalás frissítve' : 'Foglalás rögzítve')
      onClose()
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

  const cancelReservation = async () => {
    if (!reservation) return
    setSaving(true)
    try {
      // App-auth + capability-vezérelt route (nem a nyers, owner-only Payload REST).
      const res = await fetch('/api/restaurant/reservation-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reservationId: reservation.id, status: 'cancelled' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Foglalás lemondva')
      setConfirmCancel(false)
      onClose()
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  // Dirty-guard: a jelenlegi állapot aláírása vs. a nyitáskori. Ha eltér → mentetlen változás.
  const dirty = JSON.stringify([
    startTime, pax, tableId, name, phone, country, email, notes, status, source, occasion, occasionIcon, duration,
  ]) !== initSigRef.current

  // Záráskor rákérdezünk, ha van mentetlen változás (X, háttér-kattintás, Esc).
  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  // Inline (mező alatti) hiba az e-mailre — csak ha kitöltötték és formátum-hibás.
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
              variants={GENIE}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ transformOrigin: 'center' }}
              className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_28px_80px_-24px_rgba(0,0,0,.55)] dark:bg-zinc-900 sm:max-h-[92vh] sm:max-w-[840px] sm:rounded-[26px]"
            >
              {/* Fejléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-white/[0.06] sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    {isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-white/50">
                    {date}{isDraft && ' · még nem véglegesített offline vázlat'}
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
                                  ? 'bg-zinc-300 dark:bg-white/25'
                                  : 'bg-emerald-500'
                            }`}
                          />
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadge[status] ?? 'bg-zinc-200 text-zinc-600'}`}>
                            {statusLabelOf(status)}
                          </span>
                          {source && source !== 'online' && (
                            <span className="rounded-full bg-zinc-100 dark:bg-white/[0.08] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-600 dark:text-white/60">
                              {sourceLabelOf[source]}
                            </span>
                          )}
                          {urgency && (
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${urgency.cls} ${urgency.pulse ? 'animate-soft-pulse' : ''}`}>
                              {urgency.label}
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.12]"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>

              {/* Törzs (görgethető) */}
              <motion.div variants={PANEL_ITEM} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {/* ── Csoport: FOGLALÁS ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} /> Foglalás
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Időpont</Label>
                <TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  minTime={openMin != null ? minutesToHHMM(openMin) : undefined}
                  maxTime={closeMin != null ? minutesToHHMM(closeMin) : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Létszám</Label>
                {/* Érintőbarát stepper a natív number-input (egymásba csúszó fel/le nyilak)
                    helyett — nagy +/− gombok, tableten kényelmes. A felső korlát az adott
                    időpontra még leültethető létszám (paxCap), nem a kemény 50. */}
                <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-white/[0.1] dark:bg-white/[0.06]">
                  <button
                    type="button"
                    aria-label="Kevesebb fő"
                    onClick={() => setPax((p) => Math.max(1, p - 1))}
                    disabled={pax <= 1}
                    className="flex h-full w-10 shrink-0 items-center justify-center text-lg font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:text-white/50 dark:hover:text-white transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={paxCap}
                    value={pax}
                    onChange={(e) => setPax(Math.min(paxCap, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-bold tabular-nums text-zinc-900 outline-none dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label="Több fő"
                    onClick={() => setPax((p) => Math.min(paxCap, p + 1))}
                    disabled={pax >= paxCap}
                    className="flex h-full w-10 shrink-0 items-center justify-center text-lg font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:text-white/50 dark:hover:text-white transition-colors"
                  >
                    +
                  </button>
                </div>
                {atPaxCap && (
                  <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    Erre az időpontra max {paxCap} fő fér el.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Asztal {optionsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <select
                value={tableId.includes(',') ? '' : tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full h-10 rounded-md border border-zinc-200 dark:border-white/[0.1] bg-transparent px-3 text-sm"
              >
                <option value="">
                  {suggestedCombo ? 'Automatikus (összevonással)' : 'Automatikus (legkisebb szabad)'}
                </option>
                {tableChoices.map((t) => (
                  <option key={t.id} value={String(t.id)} disabled={!t.fitsPax}>
                    {t.name}
                    {t.room ? ` (${t.room})` : ''} · {t.capacity} fő{!t.fitsPax ? ' — kicsi' : ''}
                  </option>
                ))}
              </select>
              {tableId.includes(',') && (
                <p className="text-xs text-emerald-600">
                  Összevont asztalok: {tableId.split(',').map((id) => tableChoices.find((c) => String(c.id) === id)?.name ?? id).join(' + ')}
                </p>
              )}
              {suggestedCombo && tableId === '' && (
                <p className="text-xs text-emerald-600">
                  Ekkora társasághoz egyetlen asztal sem elég, ezért a rendszer automatikusan összevonja ezeket:{' '}
                  <strong>{suggestedCombo.names.join(' + ')}</strong> ({suggestedCombo.totalCapacity} fő).
                </p>
              )}
              {!optionsLoading && options.length === 0 && !suggestedCombo && (
                <p className="text-xs text-amber-600">Nincs szabad asztal erre az időpontra/létszámra.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Forrás</Label>
                <div className="flex h-10 w-full items-center rounded-md bg-zinc-100 dark:bg-white/[0.06] p-1">
                  {sourceOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSource(o.value)}
                      className={`flex h-full flex-1 items-center justify-center rounded px-2 text-xs font-semibold transition-colors ${
                        source === o.value
                          ? 'bg-white dark:bg-white/[0.14] text-zinc-900 dark:text-white shadow-sm'
                          : 'text-zinc-500 dark:text-white/40'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Státusz</Label>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as Reservation['status']); setStatusTouched(true) }}
                  className="w-full h-10 rounded-md border border-zinc-200 dark:border-white/[0.1] bg-transparent px-3 text-sm"
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {!isEdit && !statusTouched && (
                  <p className="text-[11px] text-zinc-400">
                    Automatikus alapérték — módosíthatod.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ülésidő</Label>
              <div className="flex h-10 w-full items-center rounded-md bg-zinc-100 dark:bg-white/[0.06] p-1">
                {durationOptions.map((o) => (
                  <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => setDuration(o.value)}
                    className={`flex h-full flex-1 items-center justify-center rounded px-2 text-xs font-semibold transition-colors ${
                      duration === o.value
                        ? 'bg-white dark:bg-white/[0.14] text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 dark:text-white/40'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400">Ha üresen hagyod, az étterem alapja (általában 2 óra) érvényes.</p>
              {clip && (
                <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">!</span>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Ennyi időre nem fér bele — záráskor ({clip.actualEnd}) zártok.
                    A foglalás <strong>{clip.actualEnd}</strong>-ig tart (nem {clip.wantedEnd}-ig).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Csoport: VENDÉG ── */}
          <div className="space-y-4 border-t border-zinc-100 pt-5 dark:border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40">
              <UserRound className="h-3.5 w-3.5" strokeWidth={2} /> Vendég
            </div>

            <div className="space-y-1.5">
              <Label>Vendég neve {source !== 'online' && <span className="text-zinc-400 font-normal">(opcionális)</span>}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={source === 'walk_in' ? 'Üresen: „Beeső"' : source === 'phone' ? 'Üresen: „Telefon"' : 'Pl. Kovács Anna'}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <PhoneCountryInput
                  country={country}
                  phone={phone}
                  onCountryChange={setCountry}
                  onPhoneChange={setPhone}
                  inputClass="h-10 rounded-lg border border-zinc-200 dark:border-white/[0.1] dark:bg-transparent px-3 text-sm text-zinc-900 dark:text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="opcionális"
                  aria-invalid={!!emailErr}
                  className={emailErr ? 'border-red-400 focus-visible:ring-red-400 dark:border-red-500/60' : undefined}
                />
                {emailErr && <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{emailErr}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Megjegyzés</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. ablak melletti asztal" />
            </div>
          </div>

          {/* ── Csoport: ALKALOM (occasion) — a tulaj esemény-típusaiból; a foglalási nézetben látszik. ── */}
          {(() => {
            // Ha a jelenlegi alkalom nincs a listában (egyedi/régi), külön kiválasztott pillként mutatjuk.
            const extra = occasion && !eventTypes.some((e) => e.label === occasion)
              ? [{ icon: occasionIcon ?? 'party', label: occasion }]
              : []
            const options = [...eventTypes, ...extra]
            if (options.length === 0) return null
            return (
              <div className="space-y-3 border-t border-zinc-100 pt-5 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> Alkalom
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setOccasion(null); setOccasionIcon(null) }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                      occasion == null
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70'
                    }`}
                  >
                    Nincs
                  </button>
                  {options.map((et, i) => {
                    const Icon = eventIconByKey(et.icon)
                    const active = occasion === et.label
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => active ? (setOccasion(null), setOccasionIcon(null)) : (setOccasion(et.label), setOccasionIcon(et.icon))}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/70'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-gold' : 'text-zinc-400 dark:text-white/40'}`} strokeWidth={1.8} />
                        {et.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}
              </motion.div>{/* /Törzs */}

              {/* Lábléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 p-4 dark:border-white/[0.06] sm:px-6">
                {/* A vázlat lokális → online/offline is menthető. Valódi foglalás szerkesztéséhez szerver kell. */}
                <Button onClick={save} disabled={saving || (!online && isEdit && !isDraft)} className="w-full rounded-full">
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
                    className="w-full text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Vázlat törlése
                  </Button>
                ) : (
                  isEdit && status !== 'cancelled' && (
                    <Button
                      onClick={() => setConfirmCancel(true)}
                      disabled={saving}
                      variant="ghost"
                      className="w-full text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Foglalás lemondása
                    </Button>
                  )
                )}
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmCancel && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Biztosan lemondod a foglalást?</h3>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Ez a művelet a foglalást lemondottra állítja. A vendég értesülhet róla.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={saving}
                className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/80 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={cancelReservation}
                disabled={saving}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Lemondás...' : 'Igen, lemondom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dirty-guard — mentetlen változásnál zárás előtt rákérdezünk. */}
      {confirmDiscard && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Elveted a módosításokat?</h3>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Van mentetlen változás. Ha bezárod, elvész.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/80 text-sm font-semibold hover:opacity-80 transition-opacity"
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
