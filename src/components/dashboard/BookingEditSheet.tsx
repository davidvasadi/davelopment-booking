'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { TimeSlotGrid } from '@/components/ui/TimeSlotGrid'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, AlertTriangle, X, CalendarClock, CalendarDays, UserRound, Scissors, Lock } from 'lucide-react'
import { hhmmToMinutes, minutesToHHMM, ymdLocal } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/salonBookingDrafts'
import { useOnline } from '@/lib/useOnline'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { EmailStatusBadge } from '@/components/shared/EmailStatusBadge'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'

const HU_MONTHS_SHORT = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']
function formatHuDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS_SHORT[m - 1]} ${d}.`
}

// ISO ország-kód → nemzetközi előhívó (a tárolt teljes szám összeállításához / felbontásához).
const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

// Az avatar-menü (UserMenu) „genie" belépője — DESKTOP-on (középre nyíló modal) PONTOSAN ezt
// használja (azonos érzés, mint az étteremnél): nagy scale-ugrás + overshoot = pulzáló pop.
const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
} as const
// Mobilon (alulról induló sheet) VALÓDI alulról-felcsúszás kell — a genie kicsinyítő-pop-ja itt
// épp azt az érzetet keltette, hogy nem "úszik fel" alulról, csak beugrik/felnő a helyén.
const SLIDE_UP = {
  hidden: { opacity: 0, y: '100%' },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, y: '100%', transition: { duration: 0.2, ease: 'easeIn' as const } },
} as const
const PANEL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
} as const

const EMAIL_RE = /^\S+@\S+\.\S+$/

const statusOptions: { value: Booking['status']; label: string }[] = [
  { value: 'pending', label: 'Megerősítésre vár' },
  { value: 'confirmed', label: 'Megerősítve' },
  { value: 'completed', label: 'Befejezett' },
  { value: 'cancelled', label: 'Lemondva' },
]
const statusLabelOf = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s
// A sidebar fejléc-badge színei — a foglalási nézet (SalonDailyView) palettájával egyezően.
const statusBadge: Record<string, string> = {
  pending: 'bg-amber-400 text-amber-950',
  confirmed: 'bg-ink-dark text-white',
  completed: 'bg-emerald-500 text-white',
  cancelled: 'bg-zinc-200 text-zinc-500 line-through',
}

/**
 * Új foglalás alap-státusza az időpont alapján (a tulaj felülírhatja):
 *  - már véget ért (múltbeli nap, vagy ma de a vége elmúlt) → utólagos rögzítés = Befejezett
 *  - egyébként → Megerősítve
 */
function computeDefaultStatus(date: string, startTime: string, durationMin: number): Booking['status'] {
  const now = new Date()
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = startTime ? hhmmToMinutes(startTime) : 0
  const endMin = startMin + (durationMin > 0 ? durationMin : 30)
  if (date < todayYmd) return 'completed'
  if (date === todayYmd && endMin <= nowMin) return 'completed'
  return 'confirmed'
}

/** A tárolt teljes telefonszámot (pl. „+36 30…") felbontja ISO ország-kódra + helyi részre. */
function splitLocalPhone(full: string | null | undefined, fallbackCountry: string): { country: string; phone: string } {
  const s = (full ?? '').trim()
  if (!s) return { country: fallbackCountry, phone: '' }
  const cur = DIAL_BY_CODE[fallbackCountry]
  if (cur && s.startsWith(cur)) return { country: fallbackCountry, phone: s.slice(cur.length).trim() }
  if (s.startsWith('+')) {
    const match = COUNTRIES.filter((c) => s.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0]
    if (match) return { country: match.code, phone: s.slice(match.dial.length).trim() }
  }
  return { country: fallbackCountry, phone: s }
}

/** A nézetekből érkező "ál-foglalás" lehet lokális vázlat (__draft jelölővel). */
type MaybeDraft = Booking & { __draft?: true; draftId?: string }
function draftIdOf(b: Booking | null): string | null {
  const d = b as MaybeDraft | null
  return d?.__draft ? (d.draftId ?? null) : null
}
const idOf = (v: unknown): string =>
  v && typeof v === 'object' ? String((v as { id: string | number }).id) : String(v ?? '')
const avatarUrlOf = (s: StaffMember | null): string | null => {
  const a = s?.avatar
  return a && typeof a === 'object' ? ((a as Media).url ?? null) : null
}

/** Kis avatar-kör a szakember-kártyához — profilkép, vagy sötét gradiens + UserRound fallback. */
function StaffAvatar({ staff: s, selected }: { staff: StaffMember; selected: boolean }) {
  const url = avatarUrlOf(s)
  if (url) return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover object-top" />
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-white/15' : 'bg-zinc-100'}`}>
      <UserRound className={`h-[55%] w-[55%] ${selected ? 'text-white/70' : 'text-zinc-400'}`} strokeWidth={1.4} />
    </span>
  )
}

export interface EditTarget {
  /** Meglévő foglalás szerkesztése, vagy null = új foglalás */
  booking: Booking | null
  /** Új foglaláshoz előtöltött kezdés (üres sávra kattintva) */
  presetStart?: string
  /** Új foglaláshoz előtöltött szakember (a sávra kattintva) */
  presetStaffId?: string | number | null
}

interface Props {
  open: boolean
  onClose: () => void
  date: string
  salonId: string
  target: EditTarget | null
  services: Service[]
  staff: StaffMember[]
  /** A nap nyitvatartása (perc) — a TimeSelect ezt a tartományt kínálja (kemény korlát). */
  openMin?: number
  closeMin?: number
  /** Azok az email-ek (kisbetűs), akiknek van függőben lévő meghívójuk — amíg nem fogadják el,
   *  nem oszthatók be foglalásra (lakat + UX infó a kártyájukon, lásd lent). */
  invitedEmails?: Set<string>
}

export function BookingEditSheet({ open, onClose, date, salonId, target, services, staff, openMin, closeMin, invitedEmails }: Props) {
  const router = useRouter()
  const online = useOnline()
  const booking = target?.booking ?? null
  const isEdit = !!booking
  const draftId = draftIdOf(booking)
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
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('HU')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Booking['status']>('confirmed')
  const [statusTouched, setStatusTouched] = useState(false)
  // Ha a tulaj MANUÁLISAN választott szakembert (kártyára kattintva), az időpont utólagos
  // váltása többé NEM írhatja felül csendben — csak addig ajánlunk fel automatikusan
  // elérhető szakembert, amíg ő maga nem nyúlt hozzá.
  const [staffTouched, setStaffTouched] = useState(false)

  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const initSigRef = useRef<string>('')

  // Szabad időpontok — a szolgáltatásra ENGEDÉLYEZETT ÖSSZES szakemberre összesítve (csak új
  // foglalásnál). A tulaj ELŐSZÖR időpontot választ, a rendszer utána automatikusan beajánlja
  // az adott időben elérhető szakembert (staffSlotMap: start → az ott elérhető staffId-k).
  const [fetchedSlots, setFetchedSlots] = useState<{ start: string; end: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [staffSlotMap, setStaffSlotMap] = useState<Record<string, string[]>>({})

  const activeServices = useMemo(() => services.filter((s) => s.is_active !== false), [services])
  const selectedService = useMemo(() => services.find((s) => String(s.id) === serviceId) ?? null, [services, serviceId])
  const duration = selectedService?.duration_minutes ?? 0

  // A választható szakemberek KIZÁRÓLAG a szolgáltatáshoz hozzárendelt (Service.staff) aktív
  // szakemberek — nincs "ha nincs kiválasztva, mindenki foglalható" fallback: valaki csak akkor
  // foglalható egy adott szolgáltatásra, ha explicit hozzá van rendelve. Szerkesztésnél a
  // jelenlegi szakember mindig maradjon opció (akkor is, ha időközben levették a listáról).
  const staffChoices = useMemo(() => {
    const active = staff.filter((s) => s.is_active !== false)
    const allowed = selectedService?.staff?.map(idOf) ?? []
    let list = active.filter((s) => allowed.includes(String(s.id)))
    const curId = booking ? idOf(booking.staff) : ''
    if (curId && !list.some((s) => String(s.id) === curId)) {
      const cur = staff.find((s) => String(s.id) === curId)
      if (cur) list = [cur, ...list]
    }
    return list
  }, [staff, selectedService, booking])

  // A vége-idő a szolgáltatás hosszából.
  const endTime = startTime && duration > 0 ? minutesToHHMM(hhmmToMinutes(startTime) + duration) : ''

  // Form inicializálás nyitáskor
  useEffect(() => {
    if (!open || !target) return
    const b = target.booking
    const initDate = b?.date ?? date

    const initServiceId = b ? idOf(b.service) : (activeServices[0] ? String(activeServices[0].id) : '')
    const svc = services.find((s) => String(s.id) === initServiceId) ?? null
    const initDuration = svc?.duration_minutes ?? 0
    // Szakember: meglévőnél a foglalásé; újnál a szolgáltatás első engedélyezettje / első aktív.
    const allowed = svc?.staff?.map(idOf) ?? []
    const activeStaff = staff.filter((s) => s.is_active !== false)
    const pool = allowed.length > 0 ? activeStaff.filter((s) => allowed.includes(String(s.id))) : activeStaff
    const initStaffId = b
      ? idOf(b.staff)
      : target.presetStaffId != null
        ? String(target.presetStaffId)
        : (pool[0] ? String(pool[0].id) : '')

    // Kézzel indított új foglalásnál (nincs preset időpont) NEM ajánlunk fel semmilyen
    // "aktuális idő" alapértéket — az kelt hamis ütközés-jelzést, mielőtt a tulaj egyáltalán
    // választott volna. Csak explicit forrásból (meglévő foglalás, vagy rácsra kattintás) jön idő.
    const initStart = b?.start_time ?? target.presetStart ?? ''
    const initCountry = 'HU'
    const parsedPhone = splitLocalPhone(b?.customer_phone, initCountry)
    const initStatus = b?.status ?? computeDefaultStatus(initDate, initStart, initDuration)

    setSelectedDate(initDate)
    setServiceId(initServiceId)
    setStaffId(initStaffId)
    setStartTime(initStart)
    setName(b?.customer_name ?? '')
    setCity(b?.customer_city ?? '')
    setCountry(parsedPhone.country)
    setPhone(parsedPhone.phone)
    setEmail(b?.customer_email ?? '')
    setNotes(b?.notes ?? '')
    setStatus(initStatus)
    setStatusTouched(false)
    // Szerkesztésnél és preset-szakemberrel induló új foglalásnál (rácsban egy adott
    // oszlopra/sávra kattintva) a szakember már EXPLICIT választás — ne írja felül az
    // automatikus időpont-alapú javaslat.
    setStaffTouched(!!b || target.presetStaffId != null)
    setConfirmDiscard(false)

    initSigRef.current = JSON.stringify([
      initDate, initServiceId, initStaffId, initStart, b?.customer_name ?? '', b?.customer_city ?? '',
      parsedPhone.phone, parsedPhone.country, b?.customer_email ?? '', b?.notes ?? '', initStatus,
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  // Szolgáltatás-váltáskor: ha a jelenlegi szakember nem engedélyezett az új szolgáltatásra,
  // az első engedélyezettre váltunk (érvénytelen párosítás ne menthető). FONTOS: az `open`
  // NINCS a függőségek közt — ha ott lenne, a sheet megnyitásakor (új foglalás kiválasztásakor)
  // ez az effekt UGYANABBAN a render-körben futott volna, mint a nyitó-effekt, és a MÉG RÉGI
  // (előző foglalásnál beállított) `staffId`-t látta volna — ha az véletlenül nem jogosult az
  // új foglalás szolgáltatására, az ELSŐ elérhető szakemberre váltott, felülírva a nyitó-effekt
  // helyes választását. Csak `serviceId`-re figyelve ez a check egy render-körrel KÉSŐBB fut,
  // amikorra a nyitó-effekt már beállította a helyes szakembert.
  useEffect(() => {
    if (!open) return
    if (!staffChoices.length) return
    if (!staffChoices.some((s) => String(s.id) === staffId)) {
      // A meghívóra váró (még nem elfogadott) szakembert sose válasszuk automatikusan — csak
      // ténylegesen elfogadott, beosztható szakemberre essen az alapértelmezett választás.
      const firstAvailable = staffChoices.find((s) => !invitedEmails?.has((s.email ?? '').toLowerCase())) ?? staffChoices[0]
      setStaffId(String(firstAvailable.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  // Stabil kulcs a staffChoices-hoz (a tömb-referencia rendernél újra létrejöhet;
  // az effektnek elég, ha a tényleges ID-halmaz változik).
  const staffIdsKey = useMemo(() => staffChoices.map((s) => String(s.id)).join(','), [staffChoices])

  // Szabad időpontok lekérése — a szolgáltatásra engedélyezett MINDEN szakemberre, párhuzamosan,
  // majd egyesítve (union). Így a tulaj időpontot választ, nem szakembert — a konkrét szakembert
  // a kiválasztás után automatikusan beajánljuk (ld. handleTimeSelect).
  useEffect(() => {
    if (isEdit || !open || !serviceId || !salonId || !staffIdsKey) {
      setFetchedSlots([])
      setStaffSlotMap({})
      setSlotsLoading(false)
      return
    }
    const ctrl = new AbortController()
    setSlotsLoading(true)
    setFetchedSlots([])
    setStaffSlotMap({})
    const ids = staffIdsKey.split(',')
    Promise.all(
      ids.map((sid) => {
        const params = new URLSearchParams({ salonId, staffId: sid, serviceId, date: selectedDate, includePast: '1' })
        return fetch(`/api/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
          .then((r) => r.json())
          .then((json: { slots?: { start: string; end: string }[] }) => ({ staffId: sid, slots: json.slots ?? [] }))
          .catch(() => ({ staffId: sid, slots: [] as { start: string; end: string }[] }))
      }),
    )
      .then((results) => {
        const map: Record<string, string[]> = {}
        const union = new Map<string, string>()
        for (const { staffId: sid, slots } of results) {
          for (const sl of slots) {
            ;(map[sl.start] ??= []).push(sid)
            if (!union.has(sl.start)) union.set(sl.start, sl.end)
          }
        }
        const merged = [...union.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([start, end]) => ({ start, end }))
        setFetchedSlots(merged)
        setStaffSlotMap(map)
        setSlotsLoading(false)
        if (merged.length === 0) setStartTime('')
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') setSlotsLoading(false) })
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, open, staffIdsKey, serviceId, salonId, selectedDate])

  // Időpont-választás: beállítja az időt, és ha a jelenlegi szakember nem elérhető akkor
  // automatikusan az adott időben elérhető (első) szakemberre vált — a tulaj felülbírálhatja.
  const handleTimeSelect = useCallback((start: string) => {
    setStartTime(start)
    // Csak addig ajánlunk fel automatikusan elérhető szakembert, amíg a tulaj maga nem
    // választott kifejezetten valakit — különben a kézi választását csendben felülírnánk
    // egy másik (véletlenül szabad) szakemberre.
    if (staffTouched) return
    const available = staffSlotMap[start] ?? []
    if (available.length > 0 && !available.includes(staffId)) {
      setStaffId(available[0])
    }
  }, [staffSlotMap, staffId, staffTouched])

  // Ha a tulaj MÁR kiválasztott egy konkrét szakembert (kártyára kattintva), a rácsban csak
  // az ő szabad időpontjai "világítsanak" — a többi látszik, de tompítva, hogy egyértelmű
  // legyen, melyik időpont jöhet szóba pont ehhez a szakemberhez.
  const staffAvailableStarts = useMemo(() => {
    if (!staffId) return null
    const set = new Set<string>()
    for (const [start, ids] of Object.entries(staffSlotMap)) {
      if (ids.includes(staffId)) set.add(start)
    }
    return set
  }, [staffSlotMap, staffId])

  // Nincs kliens-oldali ütközés-előzetes/blokkoló state (dayBookings/timeConflict) — pontosan
  // úgy, mint az étteremnél: a mentés simán elmegy a szerverhez, ami a friss, mérvadó adaton
  // validál (409-cel utasítja el, ha VALÓBAN ütközik). Korábban itt volt egy külön lekért
  // `dayBookings` állapot a kliens-oldali előrejelzéshez, de az önmagában egy render-környi
  // késéssel járó state-visszhang forrása volt — inkább nincs, mint hogy hamisan blokkoljon.

  // Új foglalásnál az időpont változása frissíti az alap-státuszt, amíg a tulaj kézzel nem választ.
  useEffect(() => {
    if (!open || isEdit || statusTouched || !startTime) return
    setStatus(computeDefaultStatus(selectedDate, startTime, duration))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, statusTouched, startTime, duration, selectedDate])

  // Az e-mail opcionális (telefonos foglalásnál gyakran nincs) — csak a formátumot ellenőrizzük.
  const emailErr = email.trim() && !EMAIL_RE.test(email.trim()) ? 'Érvénytelen e-mail cím' : null

  const draftFields = () => ({
    date: selectedDate,
    start_time: startTime,
    end_time: endTime,
    serviceId,
    staffId,
    serviceName: selectedService?.name,
    staffName: staffChoices.find((s) => String(s.id) === staffId)?.name,
    customer_name: name,
    customer_city: city,
    customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
    customer_email: email.trim(),
    notes,
    status,
  })

  const saveNewDraft = () => {
    addDraft(salonId, draftFields())
    toast.success('Offline — vázlatként elmentve', {
      description: 'A net visszatértekor véglegesítheted. Ellenőrizd, hogy szabad-e az időpont.',
    })
    onClose()
  }
  const saveDraftEdit = () => {
    if (!draftId) return
    updateDraft(salonId, draftId, draftFields())
    toast.success('Vázlat frissítve')
    onClose()
  }

  const save = async () => {
    if (!serviceId) return toast.error('Válassz szolgáltatást')
    if (!staffId) return toast.error('Válassz szakembert')
    if (!startTime) return toast.error('Adj meg időpontot')
    // Az ütközést a SZERVER dönti el (mint az étteremnél) — nincs kliens-oldali blokk.
    if (emailErr) return // inline hiba jelzi

    if (isDraft && !online) return saveDraftEdit()
    if (!isDraft && !online && !isEdit) return saveNewDraft()

    setSaving(true)
    try {
      const res = await fetch('/api/salon/manage-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId: isDraft ? undefined : booking?.id,
          serviceId,
          staffId,
          date: selectedDate,
          start_time: startTime,
          customer_name: name,
          customer_city: city.trim(),
          customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
          customer_email: email.trim(),
          notes,
          status,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hiba')
      if (isDraft && draftId) removeDraft(salonId, draftId)
      toast.success(isDraft ? 'Vázlat véglegesítve' : isEdit ? 'Foglalás frissítve' : 'Foglalás rögzítve')
      onClose()
      markLocalMutation()
      router.refresh()
    } catch (e) {
      if (e instanceof TypeError) {
        if (isDraft) return saveDraftEdit()
        if (!isEdit) return saveNewDraft()
      }
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  const discardDraft = () => {
    if (!draftId) return
    removeDraft(salonId, draftId)
    toast('Vázlat törölve')
    onClose()
  }

  // Végleges törlés — nem státuszváltás, a rekord ténylegesen kikerül az adatbázisból.
  const deleteBooking = async () => {
    if (!booking) return
    setSaving(true)
    try {
      const res = await fetch('/api/salon/delete-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookingId: booking.id }),
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

  const dirty = JSON.stringify([
    selectedDate, serviceId, staffId, startTime, name, city, phone, country, email, notes, status,
  ]) !== initSigRef.current

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }, [dirty, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, requestClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <div key="booking-sheet" className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
            <motion.div
              className="absolute inset-0 bg-black/[0.06] backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={requestClose}
            />
            <motion.div
              variants={isDesktop ? GENIE : SLIDE_UP}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ transformOrigin: 'center' }}
              className="relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_28px_80px_-24px_rgba(0,0,0,.55)] sm:max-h-[92vh] sm:max-w-[760px] sm:rounded-[26px]"
            >
              {/* Fejléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-zinc-900">
                    {isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {selectedDate}{isDraft && ' · még nem véglegesített offline vázlat'}
                  </p>
                  {isEdit && !isDraft && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        title={status === 'pending' ? 'Folyamatban — megerősítésre vár' : statusLabelOf(status)}
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          status === 'pending'
                            ? 'bg-amber-400 animate-soft-pulse'
                            : status === 'cancelled'
                              ? 'bg-zinc-300'
                              : 'bg-emerald-500'
                        }`}
                      />
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadge[status] ?? 'bg-zinc-200 text-zinc-600'}`}>
                        {statusLabelOf(status)}
                      </span>
                      {target?.booking?.payment_status === 'paid' && (
                        <span
                          title={target.booking.invoice_status === 'issued' ? `Számla: ${target.booking.invoice_number}` : 'Bizonylat még nincs kiállítva'}
                          className="inline-flex items-center gap-1 rounded-full bg-[#DCF3E2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1D7A3C]"
                        >
                          Előleg befizetve{target.booking.deposit_amount_huf ? ` · ${target.booking.deposit_amount_huf.toLocaleString('hu-HU')} Ft` : ''}
                        </span>
                      )}
                      {target?.booking?.payment_status === 'failed' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE1DE] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#B3261E]">
                          Sikertelen előleg-fizetés
                        </span>
                      )}
                      {target?.booking?.payment_status === 'refunded' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-600">
                          Előleg visszatérítve
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Bezárás"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>

              {/* Törzs (görgethető) */}
              <motion.div variants={PANEL_ITEM} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {/* ── Csoport: FOGLALÁS ── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} /> Foglalás
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Nap</Label>
                    <DatePickerPopover
                      value={selectedDate}
                      onChange={setSelectedDate}
                      loadEndpoint="/api/salon/day-load"
                      triggerClassName="flex h-10 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    >
                      {formatHuDate(selectedDate)}
                    </DatePickerPopover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5" /> Szolgáltatás</Label>
                    <select
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                    >
                      {activeServices.length === 0 && <option value="">Nincs aktív szolgáltatás</option>}
                      {activeServices.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name} · {s.duration_minutes} perc
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Időpont</Label>
                    {/* Új foglalásnál: szabad időpontok picker — a szolgáltatásra engedélyezett
                        ÖSSZES szakemberre összesítve, a konkrét szakembert a választás után
                        automatikusan beajánljuk (ld. handleTimeSelect). */}
                    {!isEdit && serviceId ? (
                      slotsLoading ? (
                        <div className="flex h-10 items-center gap-2 text-sm text-zinc-400">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Időpontok betöltése…
                        </div>
                      ) : fetchedSlots.length === 0 ? (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {selectedDate === ymdLocal(new Date()) && closeMin != null && new Date().getHours() * 60 + new Date().getMinutes() >= closeMin
                              ? 'Mára már zárva vagyunk — válassz másik napot, vagy vedd fel kézzel az időpontot (pl. telefonos/kivételes foglalásnál).'
                              : 'Ezen a napon nincs szabad időpont — de kézzel megadhatsz egyet (pl. telefonos/kivételes foglalásnál).'}
                          </div>
                          <TimeSelect
                            value={startTime}
                            onChange={setStartTime}
                            minTime={openMin != null ? minutesToHHMM(openMin) : undefined}
                            maxTime={closeMin != null ? minutesToHHMM(closeMin) : undefined}
                          />
                        </div>
                      ) : (
                        <TimeSlotGrid slots={fetchedSlots} value={startTime} onChange={handleTimeSelect} highlightStarts={staffAvailableStarts} />
                      )
                    ) : (
                      <TimeSelect
                        value={startTime}
                        onChange={setStartTime}
                        minTime={openMin != null ? minutesToHHMM(openMin) : undefined}
                        maxTime={closeMin != null ? minutesToHHMM(closeMin) : undefined}
                      />
                    )}
                    {endTime && (
                      <p className="text-[11px] text-zinc-400 tabular-nums">
                        Vége: {endTime} ({duration} perc)
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Szakember</Label>
                    {staffChoices.length === 0 ? (
                      <p className="text-sm text-zinc-400">Nincs szakember</p>
                    ) : (
                      <motion.div
                        key={staffIdsKey}
                        initial="hidden"
                        animate="show"
                        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                        className="flex gap-2 overflow-x-auto pb-1"
                      >
                        {staffChoices.map((s) => {
                          const sid = String(s.id)
                          const selected = sid === staffId
                          const slotList = staffSlotMap[startTime]
                          const known = !isEdit && !!startTime && !!slotList
                          const busy = known && !slotList.includes(sid)
                          const pending = !!invitedEmails?.has((s.email ?? '').toLowerCase())
                          return (
                            <motion.button
                              key={s.id}
                              type="button"
                              disabled={pending}
                              title={pending ? 'Még nem fogadta el a meghívást — addig nem osztható be' : undefined}
                              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } } }}
                              onClick={() => { if (pending) return; setStaffId(sid); setStaffTouched(true) }}
                              className={`relative flex h-[62px] w-[168px] shrink-0 items-center gap-2.5 rounded-[18px] border px-3 text-left shadow-dav-card transition-colors ${
                                pending
                                  ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400 opacity-70'
                                  : selected ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'
                              }`}
                            >
                              <StaffAvatar staff={s} selected={selected} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold leading-tight">{s.name}</span>
                                {pending ? (
                                  <span className="block truncate text-[11px] font-medium leading-tight text-amber-600">Meghívó függőben</span>
                                ) : known && (
                                  <span
                                    className={`block truncate text-[11px] font-medium leading-tight ${
                                      busy ? (selected ? 'text-red-300' : 'text-red-500') : selected ? 'text-white/60' : 'text-emerald-600'
                                    }`}
                                  >
                                    {busy ? 'Foglalt' : 'Szabad'}
                                  </span>
                                )}
                              </span>
                              {pending && <Lock className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />}
                            </motion.button>
                          )
                        })}
                      </motion.div>
                    )}
                    {!isEdit && !staffTouched && startTime && (staffSlotMap[startTime]?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-zinc-400">Automatikusan az elérhető szakembert ajánljuk fel — választhatsz mást.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Státusz</Label>
                    <select
                      value={status}
                      onChange={(e) => { setStatus(e.target.value as Booking['status']); setStatusTouched(true) }}
                      className="w-full h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
                    >
                      {statusOptions
                        .filter((s) => s.value !== 'pending' || status === 'pending')
                        .map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                    {!isEdit && !statusTouched && (
                      <p className="text-[11px] text-zinc-400">Automatikus alapérték — módosíthatod.</p>
                    )}
                  </div>
                </div>

                {/* ── Csoport: VENDÉG ── */}
                <div className="space-y-4 border-t border-zinc-100 pt-5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <UserRound className="h-3.5 w-3.5" strokeWidth={2} /> Vendég
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Vendég neve <span className="text-zinc-400 font-normal">(opcionális)</span></Label>
                      </div>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pl. Kovács Anna" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Város <span className="text-zinc-400 font-normal">(opcionális)</span></Label>
                      </div>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Pl. Budapest" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Telefon</Label>
                      </div>
                      <PhoneCountryInput
                        country={country}
                        phone={phone}
                        onCountryChange={setCountry}
                        onPhoneChange={setPhone}
                        inputClass="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Email <span className="font-normal text-zinc-400">(opcionális)</span></Label>
                        {isEdit && booking?.id && booking.customer_email && (
                          <EmailStatusBadge
                            endpoint={`/api/salon/booking-email-status?bookingId=${booking.id}`}
                            resendEndpoint="/api/salon/resend-booking-email"
                            resendBody={{ bookingId: booking.id }}
                          />
                        )}
                      </div>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vendeg@example.com"
                        aria-invalid={!!emailErr}
                        className={emailErr ? 'border-red-400 focus-visible:ring-red-400' : undefined}
                      />
                      {emailErr && <p className="text-[11px] font-medium text-red-600">{emailErr}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Megjegyzés</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. hosszú haj, festés előtt" />
                  </div>

                  {target?.booking?.custom_answers && Object.keys(target.booking.custom_answers).length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Egyedi kérdések válaszai</Label>
                      <div className="rounded-[12px] border border-zinc-200 divide-y divide-zinc-100">
                        {Object.values(target.booking.custom_answers).map((qa, i) => (
                          <div key={i} className="px-3.5 py-2.5">
                            <div className="text-[12px] text-zinc-500">{qa.question}</div>
                            <div className="text-sm text-zinc-900">{qa.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>{/* /Törzs */}

              {/* Lábléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 p-4 sm:px-6">
                <Button onClick={save} disabled={saving || (!online && isEdit && !isDraft)} className="w-full rounded-full bg-ink-dark text-white hover:bg-ink-dark/90">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isDraft
                    ? (online ? 'Vázlat véglegesítése' : 'Vázlat mentése (offline)')
                    : !online
                      ? (isEdit ? 'Offline — szerkesztés nem lehetséges' : 'Mentés vázlatként (offline)')
                      : (isEdit ? 'Mentés' : 'Foglalás rögzítése')}
                </Button>
                {isDraft ? (
                  <Button onClick={discardDraft} disabled={saving} variant="ghost" className="w-full text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" /> Vázlat törlése
                  </Button>
                ) : (
                  isEdit && (
                    <Button onClick={() => setConfirmCancel(true)} disabled={saving} variant="ghost" className="w-full text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4 mr-2" /> Törlés
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
          <div className="w-full max-w-md rounded-2xl bg-white border border-zinc-200 p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 mb-1">Biztosan törlöd a foglalást?</h3>
                <p className="text-sm text-zinc-500">Ez a művelet nem vonható vissza — a foglalás véglegesen törlődik a rendszerből.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmCancel(false)} disabled={saving}
                className="flex-1 h-11 rounded-full bg-zinc-100 text-zinc-700 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50">
                Mégse
              </button>
              <button type="button" onClick={deleteBooking} disabled={saving}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Törlés...' : 'Igen, törlöm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDiscard && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-zinc-200 p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 mb-1">Elveted a módosításokat?</h3>
                <p className="text-sm text-zinc-500">Van mentetlen változás. Ha bezárod, elvész.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDiscard(false)}
                className="flex-1 h-11 rounded-full bg-zinc-100 text-zinc-700 text-sm font-semibold hover:opacity-80 transition-opacity">
                Mégse
              </button>
              <button type="button" onClick={() => { setConfirmDiscard(false); onClose() }}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
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
