'use client'


import { invoiceHref } from '@/lib/invoiceLinks'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui-kit'
import { Button, FIELD, Meta, OptionCard, Pill, StatusPill } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { BookingSummary } from '@/components/shared/BookingSummary'
import { ChoicePills, SlotGrid, StaffPills, StepRow, StepTitle, slotGridOf } from '@/components/blocks/booking'
import { DayPickerStrip } from '@/components/shared/BookingsDateNav'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { statusOf } from '@/components/shared/BookingList'
import { Loader2, Trash2, Check } from 'lucide-react'
import { hhmmToMinutes, minutesToHHMM, capsWords } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/salonBookingDrafts'
import { useOnline } from '@/lib/useOnline'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { PhoneCountryInput } from '@/components/booking/PhoneInputs'
import { COUNTRIES } from '@/components/booking/phoneCountries'
import { EmailStatusBadge } from '@/components/shared/EmailStatusBadge'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'
import { paidMethod } from '@/lib/paidLabel'
import { useGuestLookup, GuestSuggestList, type GuestSuggestion } from '@/components/shared/GuestLookup'

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

const EMAIL_RE = /^\S+@\S+\.\S+$/

const statusOptions: { value: Booking['status']; label: string }[] = [
  { value: 'pending', label: 'Függő' },
  { value: 'confirmed', label: 'Megerősítve' },
  { value: 'completed', label: 'Befejezett' },
  { value: 'cancelled', label: 'Lemondva' },
  { value: 'no_show', label: 'Nem jött meg' },
]
const statusLabelOf = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s
// Forrás — ugyanaz, mint az éttermi szerkesztőben (ReservationEditSheet).
const sourceLabelOf: Record<string, string> = { walk_in: 'Beeső', phone: 'Telefon', online: 'Online' }
const sourceOptions: { value: Booking['source']; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'phone', label: 'Telefon' },
  { value: 'walk_in', label: 'Beeső' },
]

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
// a lezárt fizetés javítható módjai (a fizetési link online, utólag nem állítható be kézzel)
const PAY_FIX_OPTIONS = [{ value: 'cash', label: 'Készpénz' }, { value: 'card', label: 'Bankkártya' }, { value: 'transfer', label: 'Átutalás' }]
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


  // A foglalás napja — kezdetben a jelenleg megtekintett nap (a `date` prop), de a sheeten
  // belül átválasztható (ld. DatePickerPopover lent), hogy ne kelljen a nézetet elhagyni
  // egy másik napra foglaláshoz.
  const [selectedDate, setSelectedDate] = useState(date)
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('HU')
  const [email, setEmail] = useState('')
  // Visszatérő vendég automatikus kitöltése (csak új foglalásnál): a név/telefon/e-mail
  // gépelésére a korábbi vendégekből javaslatot kérünk, kattintásra kitöltjük az adatokat.
  const lookup = useGuestLookup(!isEdit)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Booking['status']>('confirmed')
  const [statusTouched, setStatusTouched] = useState(false)
  const [source, setSource] = useState<Booking['source']>('phone')
  // Ha a tulaj MANUÁLISAN választott szakembert (kártyára kattintva), az időpont utólagos
  // váltása többé NEM írhatja felül csendben — csak addig ajánlunk fel automatikusan
  // elérhető szakembert, amíg ő maga nem nyúlt hozzá.
  const [staffTouched, setStaffTouched] = useState(false)

  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // a lezárt fizetés módjának javítása (ha rossz módot nyomtak) — PATCH /api/salon/booking-checkout
  const [payFix, setPayFix] = useState<{ method: string | null; paid: boolean } | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const initSigRef = useRef<string>('')

  // Szabad időpontok — a szolgáltatásra ENGEDÉLYEZETT ÖSSZES szakemberre összesítve (csak új
  // foglalásnál). A tulaj ELŐSZÖR időpontot választ, a rendszer utána automatikusan beajánlja
  // az adott időben elérhető szakembert (staffSlotMap: start → az ott elérhető staffId-k).
  const [fetchedSlots, setFetchedSlots] = useState<{ start: string; end: string }[]>([])
  // a nap összes kezdése (a rácson a nem szabad foglaltként látszik — design 6.9)
  const [allSlots, setAllSlots] = useState<string[]>([])
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
    setAddress(b?.customer_address ?? '')
    setZip(b?.customer_postal_code ?? '')
    setCountry(parsedPhone.country)
    setPhone(parsedPhone.phone)
    setEmail(b?.customer_email ?? '')
    lookup.clear()
    setNotes(b?.notes ?? '')
    setStatus(initStatus)
    setStatusTouched(false)
    setPayFix(null)
    setSource(b?.source ?? 'phone')
    // Szerkesztésnél és preset-szakemberrel induló új foglalásnál (rácsban egy adott
    // oszlopra/sávra kattintva) a szakember már EXPLICIT választás — ne írja felül az
    // automatikus időpont-alapú javaslat.
    setStaffTouched(!!b || target.presetStaffId != null)
    setConfirmDiscard(false)

    initSigRef.current = JSON.stringify([
      initDate, initServiceId, initStaffId, initStart, b?.customer_name ?? '', b?.customer_city ?? '', b?.customer_address ?? '', b?.customer_postal_code ?? '',
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
    if (!open || !serviceId || !salonId || !staffIdsKey) {
      setFetchedSlots([])
      setAllSlots([])
      setStaffSlotMap({})
      setSlotsLoading(false)
      return
    }
    const ctrl = new AbortController()
    setSlotsLoading(true)
    setFetchedSlots([])
    setAllSlots([])
    setStaffSlotMap({})
    const ids = staffIdsKey.split(',')
    // szerkesztésnél a saját foglalás nem foglalja a saját idejét — utólag is a szabadok közül választható
    Promise.all(
      ids.map((sid) => {
        const params = new URLSearchParams({ salonId, staffId: sid, serviceId, date: selectedDate, includePast: '1', ...(isEdit && booking?.id ? { excludeBookingId: String(booking.id) } : {}) })
        return fetch(`/api/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
          .then((r) => r.json())
          .then((json: { slots?: { start: string; end: string }[]; candidates?: string[] }) => ({ staffId: sid, slots: json.slots ?? [], candidates: json.candidates ?? [] }))
          .catch(() => ({ staffId: sid, slots: [] as { start: string; end: string }[], candidates: [] as string[] }))
      }),
    )
      .then((results) => {
        const map: Record<string, string[]> = {}
        const union = new Map<string, string>()
        setAllSlots([...new Set(results.flatMap((x) => x.candidates))].sort())
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
        if (merged.length === 0 && !isEdit) setStartTime('')
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') { setSlotsLoading(false) } })
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

  // Új foglalásnál alapból az első szabad időpont — ma a mostani idő utáni első (design 6.9: egy időpont mindig kijelölt)
  useEffect(() => {
    if (!open || isEdit || slotsLoading || startTime || fetchedSlots.length === 0) return
    const now = selectedDate === todayYmd() ? nowHM() : ''
    const first = fetchedSlots.map((x) => x.start).find((t) => t >= now)
    if (first) handleTimeSelect(first)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, slotsLoading, fetchedSlots, startTime, selectedDate])

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
    customer_address: address,
    customer_postal_code: zip,
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
          customer_address: address.trim(),
          customer_postal_code: zip.trim(),
          customer_phone: phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : '',
          customer_email: email.trim(),
          notes,
          status: opts?.status ?? status,
          source,
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
  // az összegzés „Fizetés” sora — a szerkesztőben javított mód azonnal látszik
  const summaryPay = payFix ? (payFix.paid ? paidMethod({ paid_at: 'javítva', pay_method: payFix.method }) : null) : paidMethod(target?.booking)

  const fixPayment = async (method: string) => {
    const id = target?.booking?.id
    if (!id || payBusy) return
    if (method === (payFix?.method ?? target?.booking?.pay_method)) return
    setPayBusy(true)
    try {
      const res = await fetch('/api/salon/booking-checkout', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ bookingId: id, method }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setPayFix({ method, paid: true })
      toast.success('Fizetési mód javítva')
      markLocalMutation()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült')
    } finally {
      setPayBusy(false)
    }
  }

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
    selectedDate, serviceId, staffId, startTime, name, city, address, zip, phone, country, email, notes, status,
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
  const st = staffChoices.find((x) => String(x.id) === staffId)
  const price = selectedService?.price ? `${new Intl.NumberFormat('hu-HU').format(selectedService.price)} Ft` : undefined
  const saveLabel = isDraft
    ? (online ? 'Vázlat véglegesítése' : 'Vázlat mentése (offline)')
    : !online
      ? (isEdit ? 'Offline — szerkesztés nem lehetséges' : 'Mentés vázlatként (offline)')
      : (isEdit ? 'Mentés' : 'Foglalás mentése')

  if (typeof document === 'undefined') return null
  return (
    <>
      {/* Új / szerkesztett foglalás (a /design 6.9): balra a lépések, jobbra az élő összegzés a mentéssel */}
      <PopupModal
        open={open}
        onClose={requestClose}
        title={isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
        subtitle={isDraft ? 'még nem véglegesített offline vázlat' : undefined}
        headerExtra={isEdit && !isDraft ? <><StatusPill status={statusOf(status).tone}>{statusLabelOf(status)}</StatusPill>
                      {source && source !== 'online' && <Pill tone="cell" size="sm">{sourceLabelOf[source]}</Pill>}
                      {target?.booking?.payment_status === 'paid' && (
                        target.booking.invoice_status === 'issued' && target.booking.invoice_number
                          // van számla: a pill a Számlák listára visz, és ott meg is nyitja
                          ? <a href={invoiceHref('salon', target.booking.invoice_number)} title={`Számla: ${target.booking.invoice_number} — megnyitás`} className="transition-opacity hover:opacity-80">
                              <StatusPill status="ok">Előleg befizetve{target.booking.deposit_amount_huf ? ` · ${target.booking.deposit_amount_huf.toLocaleString('hu-HU')} Ft` : ''} · számla ↗</StatusPill>
                            </a>
                          : <span title="Bizonylat még nincs kiállítva"><StatusPill status="ok">Előleg befizetve{target.booking.deposit_amount_huf ? ` · ${target.booking.deposit_amount_huf.toLocaleString('hu-HU')} Ft` : ''}</StatusPill></span>
                      )}
                      {target?.booking?.payment_status === 'failed' && <StatusPill status="bad">Sikertelen előleg-fizetés</StatusPill>}
                      {target?.booking?.payment_status === 'refunded' && <StatusPill status="warn">Előleg visszatérítve</StatusPill>}
                      {/* Ajándékutalvánnyal (részben) kifizetett foglalás — a beváltott kód és a fedezett összeg. */}
                      {target?.booking?.voucher_code && (
                        <span title={`Utalvány-kód: ${target.booking.voucher_code}`}>
                          <StatusPill status="pending">Utalvánnyal fizetve{target.booking.voucher_discount_huf ? ` · ${target.booking.voucher_discount_huf.toLocaleString('hu-HU')} Ft` : ''} · {target.booking.voucher_code}</StatusPill>
                        </span>
                      )}</> : undefined}
        maxWidth="sm:max-w-[920px]"
        aside={
          <BookingSummary
            name={name.trim() || 'Új vendég'}
            sub={[phone.trim() ? `${DIAL_BY_CODE[country] ?? ''} ${phone.trim()}`.trim() : null, email.trim() || null].filter(Boolean).join(' · ') || undefined}
            day={formatLongHu(selectedDate)}
            time={startTime}
            until={endTime ? `– ${endTime} · ${duration} perc` : undefined}
            rows={[
              ['Szolgáltatás', selectedService?.name ?? '—'],
              ['Munkatárs', st?.name ?? '—'],
              ['Forrás', sourceLabelOf[source ?? ''] ?? '—'],
              ...(summaryPay ? [['Fizetés', summaryPay] as [string, string]] : []),
              ...(notes.trim() ? [['Megjegyzés', notes.trim()] as [string, string]] : []),
            ]}
            total={price}
            confirmNote={!isEdit && email.trim() && !emailErr ? 'Visszaigazoló e-mail megy a vendégnek' : undefined}
            actions={<>
              {isEdit && !isDraft && target?.booking?.status === 'pending' && (
                <Button size="lg" variant="yellow" icon={Check} onClick={() => save({ status: 'confirmed' })} disabled={saving || !online} className="w-full">Elfogadás</Button>
              )}
              <Button size="lg" onClick={() => save()} disabled={saving || (!online && isEdit && !isDraft)} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saveLabel}{!isEdit && price ? ` · ${price}` : ''}
              </Button>
              {isDraft
                ? <Button onClick={discardDraft} disabled={saving} variant="ghost" icon={Trash2} className="w-full text-ui-bad">Vázlat törlése</Button>
                : isEdit && <Button onClick={() => setConfirmCancel(true)} disabled={saving} variant="ghost" icon={Trash2} className="w-full text-ui-bad">Törlés</Button>}
            </>}
          />
        }
      >
        <StepTitle n={1} className="mt-0">Vendég</StepTitle>
        {/* design 6.9: a név elejére a korábbi vendégek közül egy kattintással kitölt */}
        <Input className="mt-2" value={name} onChange={(e) => { setName(e.target.value); lookup.type('name', e.target.value) }} placeholder="Vendég neve" autoComplete="off" />
        <GuestSuggestList show={!isEdit && lookup.field === 'name'} results={lookup.results} onPick={applySuggestion} />
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <PhoneCountryInput
            country={country}
            phone={phone}
            onCountryChange={setCountry}
            onPhoneChange={(v) => { setPhone(v); lookup.type('phone', v) }}
            inputClass={`${FIELD} h-11`}
          />
          <Input value={email} onChange={(e) => { setEmail(e.target.value); lookup.type('email', e.target.value) }} placeholder="E-mail (opcionális)" aria-invalid={!!emailErr} />
          {/* a cím egy sorban: keskeny irányítószám, város, utca + házszám */}
          <div className="grid gap-1.5 sm:col-span-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)]">
            <Input value={zip} onChange={(e) => setZip(e.target.value.slice(0, 10))} placeholder="Irsz." aria-label="Irányítószám" inputMode="numeric" />
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Város" aria-label="Város" />
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Utca, házszám" aria-label="Utca, házszám" />
          </div>
        </div>
        {emailErr && <p className="mt-1 text-ui-label text-ui-bad">{emailErr}</p>}
        {isEdit && booking?.id && booking.customer_email && (
          <div className="mt-1.5"><EmailStatusBadge endpoint={`/api/salon/booking-email-status?bookingId=${booking.id}`} resendEndpoint="/api/salon/resend-booking-email" resendBody={{ bookingId: booking.id }} /></div>
        )}
        <GuestSuggestList show={!isEdit && (lookup.field === 'phone' || lookup.field === 'email')} results={lookup.results} onPick={applySuggestion} />
        <div className="mt-1.5">
          {target?.booking?.custom_answers && Object.keys(target.booking.custom_answers).length > 0 && (
                      <div className="mt-3 divide-y divide-dashed divide-ui-divider rounded-ui-control bg-ui-cell">
                        {Object.values(target.booking.custom_answers).map((qa, i) => (
                          <div key={i} className="px-3.5 py-2.5">
                            <div className="text-ui-meta text-ui-muted">{qa.question}</div>
                            <div className="text-ui-body text-ui-text">{qa.answer}</div>
                          </div>
                        ))}
                      </div>
                    )}
        </div>

        <StepTitle n={2}>Szolgáltatás és munkatárs</StepTitle>
        {activeServices.length === 0 ? <p className="mt-2 text-ui-meta text-ui-muted">Nincs aktív szolgáltatás.</p> : (
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {activeServices.map((sv) => (
              <button key={sv.id} type="button" onClick={() => setServiceId(String(sv.id))} className="rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                <OptionCard title={sv.name} selected={String(sv.id) === serviceId}>{sv.duration_minutes} p{sv.price ? ` · ${new Intl.NumberFormat('hu-HU').format(sv.price)}` : ''}</OptionCard>
              </button>
            ))}
          </div>
        )}
        {/* design 6.9: Bárki (az időponthoz elérhetőt ajánljuk) vagy egy munkatárs */}
        {staffChoices.length === 0 ? <p className="mt-2 text-ui-meta text-ui-muted">Nincs szakember</p> : (
          <StaffPills
            value={staffTouched ? staffId : null}
            onPick={(id) => {
              if (id == null) {
                setStaffTouched(false)
                const available = startTime ? staffSlotMap[startTime] ?? [] : []
                if (available.length > 0 && !available.includes(staffId)) setStaffId(available[0])
                return
              }
              if (invitedEmails?.has((staffChoices.find((x) => String(x.id) === id)?.email ?? '').toLowerCase())) return
              setStaffId(id)
              setStaffTouched(true)
            }}
            staff={staffChoices.map((st) => {
              const sid = String(st.id)
              const slotList = staffSlotMap[startTime]
              const busy = !isEdit && !!startTime && !!slotList && !slotList.includes(sid)
              const pending = !!invitedEmails?.has((st.email ?? '').toLowerCase())
              return { id: sid, name: st.name, img: avatarUrlOf(st), off: busy || pending, title: pending ? 'Még nem fogadta el a meghívást — addig nem osztható be' : busy ? 'Ebben az időpontban foglalt' : undefined }
            })}
          />
        )}

        <StepTitle n={3}>Időpont</StepTitle>
        <div className="mt-2"><DayPickerStrip value={selectedDate} onPick={setSelectedDate} loadEndpoint="/api/salon/day-load" /></div>
        {/* design 6.9: mindig a rács — a foglalt csíkos, áthúzott (kézzel az is választható) */}
        {slotsLoading ? (
          <div className="mt-2 flex h-10 items-center gap-2 text-ui-body text-ui-muted"><Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Időpontok betöltése…</div>
        ) : !serviceId ? (
          <Meta className="mt-2">Előbb válassz szolgáltatást — utána látod a szabad időpontokat.</Meta>
        ) : (() => {
          // munkatárs nélkül (a szolgáltatáshoz még senki nincs rendelve) nincs mit lekérdezni: a nyitvatartás rácsa, szabadon
          if (staffChoices.length === 0) {
            const grid = slotGridOf({ free: [], all: [], on: startTime || undefined, fallback: [openMin ?? 9 * 60, closeMin ?? 18 * 60] })
            return (
              <>
                <SlotGrid className="mt-2 sm:grid-cols-6" slots={grid.slots} on={startTime} busy={grid.busy} onPick={handleTimeSelect} />
                <Meta className="mt-2">Ehhez a szolgáltatáshoz még nincs munkatárs rendelve (Szolgáltatások), így a szabad időpontokat nem látjuk — az időt kézzel választod.</Meta>
              </>
            )
          }
          const free = staffTouched && staffAvailableStarts ? [...staffAvailableStarts] : fetchedSlots.map((x) => x.start)
          const grid = slotGridOf({ free, all: allSlots, on: startTime || undefined, fallback: [openMin ?? 9 * 60, closeMin ?? 18 * 60] })
          return (
            <>
              <SlotGrid className="mt-2 sm:grid-cols-6" slots={grid.slots} on={startTime} busy={grid.busy} onPick={handleTimeSelect} />
              {free.length === 0 && <Meta className="mt-2">{allSlots.length ? 'Ezen a napon nincs szabad időpont' : staffTouched ? 'Ezen a napon nem dolgozik (vagy zárva vagytok)' : 'Ezen a napon zárva vagytok'} — a csíkos időpont is választható, ha mégis felveszed.</Meta>}
            </>
          )
        })()}

        <StepTitle n={4}>Egyéb</StepTitle>
        <StepRow label="Forrás" first>
          <ChoicePills options={sourceOptions.map((o) => ({ value: o.value ?? '', label: o.label }))} value={source ?? null} onPick={(v) => setSource(v as Booking['source'])} />
        </StepRow>
        <StepRow label="Megjegyzés">
          <Input size="sm" hug className="min-w-[220px] max-w-[min(100%,520px)]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. hosszú haj" />
        </StepRow>
        <StepRow label="Státusz">
          <ChoicePills options={statusOptions.map((o) => ({ value: o.value, label: o.label }))} value={status} onPick={(v) => { setStatus(v as Booking['status']); setStatusTouched(true) }} />
        </StepRow>
        {isEdit && (payFix ? payFix.paid : !!target?.booking?.paid_at) && (
          <StepRow label="Fizetés">
            {target?.booking?.pay_receipt === 'invoice' ? (
              <Meta>Számlával zárva — a javításhoz a számlát a Számlák között sztornózd.</Meta>
            ) : (
              <ChoicePills options={PAY_FIX_OPTIONS} value={payFix?.method ?? target?.booking?.pay_method ?? null} onPick={(v) => void fixPayment(v)} />
            )}
          </StepRow>
        )}
      </PopupModal>

      <ConfirmDialog
        open={confirmCancel}
        title="Biztosan törlöd a foglalást?"
        description="Ez a művelet nem vonható vissza — a foglalás véglegesen törlődik a rendszerből."
        confirmLabel={saving ? 'Törlés…' : 'Igen, törlöm'}
        busy={saving}
        onConfirm={deleteBooking}
        onCancel={() => setConfirmCancel(false)}
        zIndexClass="z-[95]"
      />
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
