'use client'

import { SHEET_MOBILE } from '@/lib/motion'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { TimeSlotGrid } from '@/components/ui/TimeSlotGrid'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, AlertTriangle, X, CalendarClock, UserRound, Lock, ChevronRight, ChevronDown, Sparkles, Check } from 'lucide-react'
import { hhmmToMinutes, minutesToHHMM, ymdLocal } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/salonBookingDrafts'
import { useOnline } from '@/lib/useOnline'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { EmailStatusBadge } from '@/components/shared/EmailStatusBadge'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'
import { useGuestLookup, GuestSuggestList, type GuestSuggestion } from '@/components/shared/GuestLookup'
import { SectionBar, FieldRow, ROW_INPUT, pillSmCls } from '@/components/shared/FormSheet'

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
// használja (azonos érzés, mint az étteremnél): nagy scale-ugrás + overshoot = pulzáló pop.
const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
} as const
// Mobilon (alulról induló sheet) VALÓDI alulról-felcsúszás kell — a genie kicsinyítő-pop-ja itt
// épp azt az érzetet keltette, hogy nem "úszik fel" alulról, csak beugrik/felnő a helyén.
// közös mobilos lap-mozgás (lib/motion) — csak tolás, áttetszőség/skála nélkül (telefonon sima)
const SLIDE_UP = SHEET_MOBILE
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
  { value: 'no_show', label: 'Nem jött meg' },
]
// Státusz-pöttyök — ugyanazok a színek, mint a Foglalások táblázatos listájában.
const STATUS_DOT: Record<string, string> = {
  confirmed: 'bg-[#1D9D63]', pending: 'bg-[#E0B21C]', completed: 'bg-[#B9B4A6]', cancelled: 'bg-[#C0564A]', no_show: 'bg-[#E07B39]',
}
const statusLabelOf = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s
// A sidebar fejléc-badge színei — a foglalási nézet (SalonDailyView) palettájával egyezően.
const statusBadge: Record<string, string> = {
  pending: 'bg-amber-400 text-amber-950',
  confirmed: 'bg-ink-dark text-white',
  completed: 'bg-emerald-500 text-white',
  cancelled: 'bg-zinc-200 text-ink-soft line-through',
  no_show: 'bg-red-500 text-white',
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
    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-white/15' : 'bg-[#F4F4F4]'}`}>
      <UserRound className={`h-[55%] w-[55%] ${selected ? 'text-white/70' : 'text-ink-soft2'}`} strokeWidth={1.4} />
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
  // Visszatérő vendég automatikus kitöltése (csak új foglalásnál): a név/telefon/e-mail
  // gépelésére a korábbi vendégekből javaslatot kérünk, kattintásra kitöltjük az adatokat.
  const lookup = useGuestLookup(!isEdit)
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
    lookup.clear()
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
      setSlotsReady(true)
      return
    }
    const ctrl = new AbortController()
    setSlotsLoading(true)
    setSlotsReady(false)
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
        setSlotsReady(true)
        if (merged.length === 0) setStartTime('')
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') { setSlotsLoading(false); setSlotsReady(true) } })
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

  const save = async (opts?: { status?: Booking['status'] }) => {
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
          status: opts?.status ?? status,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hiba')
      if (isDraft && draftId) removeDraft(salonId, draftId)
      toast.success(opts?.status === 'confirmed' ? 'Elfogadva — a vendég megkapta a visszaigazolást' : isDraft ? 'Vázlat véglegesítve' : isEdit ? 'Foglalás frissítve' : 'Foglalás rögzítve')
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
              style={{ transformOrigin: isDesktop ? 'center' : 'bottom center' }}
              className="relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white will-change-transform sm:max-h-[92vh] sm:shadow-[0_28px_80px_-24px_rgba(0,0,0,.55)] sm:max-w-[760px] sm:rounded-[26px] lg:max-w-[1000px]"
            >
              {/* Mobilon fogantyú (koppintásra bezár) az X helyett — az alsó menü „…” lapjának mintája */}
              <button type="button" aria-label="Bezárás" onClick={requestClose} className="w-full shrink-0 py-3 sm:hidden"><span className="mx-auto block h-1 w-10 rounded-full bg-[#e0ddd6]" /></button>
              {/* Fejléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-0 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <h2 className="text-[20px] font-light tracking-[-0.02em] text-ink">
                    {isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    {formatLongHu(selectedDate)}{isDraft && ' · még nem véglegesített offline vázlat'}
                  </p>
                  {isEdit && !isDraft && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                          Előleg visszatérítve
                        </span>
                      )}
                      {/* Ajándékutalvánnyal (részben) kifizetett foglalás — a beváltott kód és a fedezett összeg. */}
                      {target?.booking?.voucher_code && (
                        <span
                          title={`Utalvány-kód: ${target.booking.voucher_code}`}
                          className="inline-flex items-center gap-1 rounded-full bg-[#FFF1C2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#7A5B00]"
                        >
                          Utalvánnyal fizetve{target.booking.voucher_discount_huf ? ` · ${target.booking.voucher_discount_huf.toLocaleString('hu-HU')} Ft` : ''} · {target.booking.voucher_code}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Bezárás"
                  className="hidden h-9 w-9 shrink-0 sm:flex items-center justify-center rounded-full bg-[#F4F4F4] text-ink-soft transition-colors hover:bg-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>

              {/* Törzs (görgethető) */}
              {/* „Adatlap” elrendezés — ugyanaz, mint az étterem foglaló panelén (közös elemek:
                  components/shared/FormSheet). Asztalon két oszlop, mobilon egy. */}
              <motion.div variants={PANEL_ITEM} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
                {/* ── FOGLALÁS ── */}
                <div>
                  <SectionBar icon={CalendarClock} label="Foglalás" />

                  <FieldRow label="Nap">
                    <DatePickerPopover
                      value={selectedDate}
                      onChange={setSelectedDate}
                      loadEndpoint="/api/salon/day-load"
                      triggerClassName="flex h-9 w-full items-center justify-between gap-2 text-left text-[14px] font-medium text-ink"
                    >
                      {formatHuDate(selectedDate)}
                      <ChevronRight className="h-4 w-4 text-ink-soft2" />
                    </DatePickerPopover>
                  </FieldRow>

                  <FieldRow label="Szolgáltatás">
                    <div className="relative">
                      <select
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        className="h-9 w-full appearance-none truncate border-0 bg-transparent pr-6 text-right text-[14px] font-medium text-ink outline-none"
                      >
                        {activeServices.length === 0 && <option value="">Nincs aktív szolgáltatás</option>}
                        {activeServices.map((sv) => (
                          <option key={sv.id} value={String(sv.id)}>
                            {sv.name} · {sv.duration_minutes} perc
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft2" />
                    </div>
                  </FieldRow>

                  <FieldRow label="Időpont" stacked hint={endTime ? `Vége: ${endTime} (${duration} perc)` : undefined}>
                    {/* Új foglalásnál: szabad időpontok — a szolgáltatásra engedélyezett ÖSSZES
                        szakemberre összesítve; a konkrét szakembert a választás után ajánljuk be. */}
                    {!isEdit && serviceId ? (
                      slotsLoading ? (
                        <div className="flex h-9 items-center gap-2 text-sm text-ink-soft2">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Időpontok betöltése…
                        </div>
                      ) : fetchedSlots.length === 0 ? (
                        <div className="space-y-2">
                          <p className="flex items-start gap-1 text-[10px] font-semibold leading-snug text-amber-600 sm:text-[11px]">
                            <AlertTriangle className="mt-[1px] h-3 w-3 shrink-0" strokeWidth={2.2} />
                            <span>
                              {selectedDate === ymdLocal(new Date()) && closeMin != null && new Date().getHours() * 60 + new Date().getMinutes() >= closeMin
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
                  </FieldRow>

                  <FieldRow
                    label="Szakember"
                    stacked
                    last
                    hint={!isEdit && !staffTouched && startTime && (staffSlotMap[startTime]?.length ?? 0) > 0 ? 'Automatikusan az elérhető szakembert ajánljuk fel — választhatsz mást.' : undefined}
                  >
                    {staffChoices.length === 0 ? (
                      <p className="text-[13px] text-ink-soft2">Nincs szakember</p>
                    ) : (
                      <motion.div
                        key={staffIdsKey}
                        initial="hidden"
                        animate="show"
                        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                        className="flex flex-wrap gap-2"
                      >
                        {staffChoices.map((st) => {
                          const sid = String(st.id)
                          const selected = sid === staffId
                          const slotList = staffSlotMap[startTime]
                          const known = !isEdit && !!startTime && !!slotList
                          const busy = known && !slotList.includes(sid)
                          const pending = !!invitedEmails?.has((st.email ?? '').toLowerCase())
                          return (
                            <motion.button
                              key={st.id}
                              type="button"
                              disabled={pending}
                              title={pending ? 'Még nem fogadta el a meghívást — addig nem osztható be' : busy ? 'Ebben az időpontban foglalt' : undefined}
                              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } } }}
                              onClick={() => { if (pending) return; setStaffId(sid); setStaffTouched(true) }}
                              className={`inline-flex h-11 max-w-full shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-4 text-left text-[13.5px] font-semibold transition-colors ${
                                pending
                                  ? 'cursor-not-allowed border-line bg-white text-ink-soft2 opacity-60'
                                  : selected ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong'
                              }`}
                            >
                              <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full [&>*]:h-9 [&>*]:w-9">
                                <StaffAvatar staff={st} selected={selected} />
                              </span>
                              {/* név + alatta kiírt állapot (pötty helyett — magyarázat nélkül is érthető) */}
                              <span className="min-w-0 leading-tight">
                                <span className="block truncate">{st.name}</span>
                                {pending ? (
                                  <span className="block truncate text-[10.5px] font-semibold text-amber-600">Meghívó függőben</span>
                                ) : known ? (
                                  <span className={`block truncate text-[10.5px] font-semibold ${
                                    busy ? (selected ? 'text-[#F2A79E]' : 'text-[#C0564A]') : selected ? 'text-[#8FD3B0]' : 'text-[#1D7A4C]'
                                  }`}>
                                    {busy ? 'Foglalt ekkor' : 'Szabad'}
                                  </span>
                                ) : null}
                              </span>
                              {pending && <Lock className="h-3 w-3 shrink-0 text-ink-soft2" strokeWidth={2} />}
                            </motion.button>
                          )
                        })}
                      </motion.div>
                    )}
                  </FieldRow>
                </div>

                {/* ── VENDÉG + RÉSZLETEK ── */}
                <div className="space-y-6">
                  <div>
                    <SectionBar icon={UserRound} label="Vendég" />
                    <FieldRow label="Név">
                      <Input className={ROW_INPUT} value={name} onChange={(e) => { setName(e.target.value); lookup.type('name', e.target.value) }} placeholder="opcionális" autoComplete="off" />
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
                      aside={isEdit && booking?.id && booking.customer_email ? (
                        <EmailStatusBadge
                          endpoint={`/api/salon/booking-email-status?bookingId=${booking.id}`}
                          resendEndpoint="/api/salon/resend-booking-email"
                          resendBody={{ bookingId: booking.id }}
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
                      <Input className={ROW_INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. hosszú haj, festés előtt" />
                    </FieldRow>

                    {target?.booking?.custom_answers && Object.keys(target.booking.custom_answers).length > 0 && (
                      <div className="mt-3 divide-y divide-line rounded-[12px] border border-line">
                        {Object.values(target.booking.custom_answers).map((qa, i) => (
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
                    <FieldRow label="Státusz" stacked last>
                      <div className="flex flex-wrap gap-1">
                        {statusOptions
                          .filter((so) => so.value !== 'pending' || status === 'pending')
                          .map((so) => (
                            <button key={so.value} type="button" onClick={() => { setStatus(so.value); setStatusTouched(true) }} className={pillSmCls(status === so.value)}>
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[so.value] ?? 'bg-zinc-300'}`} />
                              {so.label}
                            </button>
                          ))}
                      </div>
                    </FieldRow>
                  </div>
                </div>
              </motion.div>{/* /Törzs */}

              {/* Lábléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 flex-col gap-2 border-t border-line p-4 sm:px-6 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
                {/* Összegzés — avatar + mellette KÉT sor (1: szolgáltatás, 2: szakember · nap · idő · ár),
                    mobilon is teljes; szakember nélkül semleges ikon a helyén. Asztalon a gomb mellett. */}
                {selectedService && (() => {
                  const st = staffChoices.find((x) => String(x.id) === staffId)
                  const details = [
                    st?.name,
                    formatHuDate(selectedDate),
                    startTime ? `${startTime}${endTime ? `–${endTime}` : ''}` : null,
                    selectedService.price ? `${new Intl.NumberFormat('hu-HU').format(selectedService.price)} Ft` : null,
                  ].filter(Boolean).join(' · ')
                  return (
                    <div className="flex min-w-0 items-center gap-2.5 lg:flex-1">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F4] [&>*]:h-9 [&>*]:w-9">
                        {st ? <StaffAvatar staff={st} selected={false} /> : <UserRound className="!h-4 !w-4 text-ink-soft2" strokeWidth={1.8} />}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{selectedService.name}</span>
                        <span className="block truncate text-[12px] text-ink-soft">{details}</span>
                      </span>
                    </div>
                  )
                })()}
                {/* Jóváhagyásra váró foglalás: egy kattintással elfogadható (a módosításokkal együtt
                    ment, a vendég a `confirmOnApproval` hookon át megkapja a visszaigazolót). */}
                {isEdit && !isDraft && target?.booking?.status === 'pending' && (
                  <Button onClick={() => save({ status: 'confirmed' })} disabled={saving || !online} className="h-12 w-full rounded-full bg-[#74AA19] text-[15px] font-semibold text-ink-dark hover:bg-[#74AA19]/90 lg:w-auto lg:px-8">
                    <Check className="h-4 w-4 mr-2" strokeWidth={2.6} /> Elfogadás
                  </Button>
                )}
                <Button onClick={() => save()} disabled={saving || (!online && isEdit && !isDraft)} className="h-12 w-full rounded-full bg-ink-dark text-[15px] font-semibold text-white hover:bg-ink-dark/90 lg:w-auto lg:px-10">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isDraft
                    ? (online ? 'Vázlat véglegesítése' : 'Vázlat mentése (offline)')
                    : !online
                      ? (isEdit ? 'Offline — szerkesztés nem lehetséges' : 'Mentés vázlatként (offline)')
                      : (isEdit ? 'Mentés' : 'Foglalás rögzítése')}
                </Button>
                {isDraft ? (
                  <Button onClick={discardDraft} disabled={saving} variant="ghost" className="w-full text-red-600 hover:text-red-700 lg:order-first lg:w-auto">
                    <Trash2 className="h-4 w-4 mr-2" /> Vázlat törlése
                  </Button>
                ) : (
                  isEdit && (
                    <Button onClick={() => setConfirmCancel(true)} disabled={saving} variant="ghost" className="w-full text-red-600 hover:text-red-700 lg:order-first lg:w-auto">
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
          <div className="w-full max-w-md rounded-2xl bg-white border border-line p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink mb-1">Biztosan törlöd a foglalást?</h3>
                <p className="text-sm text-ink-soft">Ez a művelet nem vonható vissza — a foglalás véglegesen törlődik a rendszerből.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmCancel(false)} disabled={saving}
                className="flex-1 h-11 rounded-full bg-[#F4F4F4] text-ink text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50">
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
          <div className="w-full max-w-sm rounded-2xl bg-white border border-line p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-ink mb-1">Elveted a módosításokat?</h3>
                <p className="text-sm text-ink-soft">Van mentetlen változás. Ha bezárod, elvész.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDiscard(false)}
                className="flex-1 h-11 rounded-full bg-[#F4F4F4] text-ink text-sm font-semibold hover:opacity-80 transition-opacity">
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
