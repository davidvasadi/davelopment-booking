'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, AlertTriangle, X, CalendarClock, UserRound, Scissors } from 'lucide-react'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/salonBookingDrafts'
import { useOnline } from '@/lib/useOnline'
import { PhoneCountryInput, COUNTRIES } from '@/components/booking/PhoneCountryInput'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'

// ISO ország-kód → nemzetközi előhívó (a tárolt teljes szám összeállításához / felbontásához).
const DIAL_BY_CODE: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.dial]))

// Az avatar-menü (UserMenu) „genie" belépője — a foglalás-panel PONTOSAN ezt használja
// (azonos érzés, mint az étteremnél): nagy scale-ugrás + overshoot = pulzáló pop.
const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
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
  confirmed: 'bg-amber-400 text-amber-950',
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
}

export function BookingEditSheet({ open, onClose, date, salonId, target, services, staff, openMin, closeMin }: Props) {
  const router = useRouter()
  const online = useOnline()
  const booking = target?.booking ?? null
  const isEdit = !!booking
  const draftId = draftIdOf(booking)
  const isDraft = draftId != null

  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('HU')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Booking['status']>('confirmed')
  const [statusTouched, setStatusTouched] = useState(false)

  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const initSigRef = useRef<string>('')

  // Szabad időpontok az aktuális szakember/szolgáltatás/dátum kombinációra (csak új foglalásnál).
  const [fetchedSlots, setFetchedSlots] = useState<{ start: string; end: string }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  const activeServices = useMemo(() => services.filter((s) => s.is_active !== false), [services])
  const selectedService = useMemo(() => services.find((s) => String(s.id) === serviceId) ?? null, [services, serviceId])
  const duration = selectedService?.duration_minutes ?? 0

  // A választható szakemberek: ha a szolgáltatásnál van megkötés (Service.staff), csak azok;
  // egyébként minden aktív szakember. Szerkesztésnél a jelenlegi szakember mindig maradjon opció.
  const staffChoices = useMemo(() => {
    const active = staff.filter((s) => s.is_active !== false)
    const allowed = selectedService?.staff?.map(idOf) ?? []
    let list = allowed.length > 0 ? active.filter((s) => allowed.includes(String(s.id))) : active
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
    const nowStart = (() => {
      const now = new Date()
      const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      if (ymd !== date) return ''
      let mins = now.getHours() * 60
      if (openMin != null) mins = Math.max(mins, openMin)
      if (closeMin != null) mins = Math.min(mins, closeMin)
      return minutesToHHMM(mins)
    })()

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

    const initStart = b?.start_time ?? target.presetStart ?? nowStart
    const initCountry = 'HU'
    const parsedPhone = splitLocalPhone(b?.customer_phone, initCountry)
    const initStatus = b?.status ?? computeDefaultStatus(date, initStart, initDuration)

    setServiceId(initServiceId)
    setStaffId(initStaffId)
    setStartTime(initStart)
    setName(b?.customer_name ?? '')
    setCountry(parsedPhone.country)
    setPhone(parsedPhone.phone)
    setEmail(b?.customer_email ?? '')
    setNotes(b?.notes ?? '')
    setStatus(initStatus)
    setStatusTouched(false)
    setConfirmDiscard(false)

    initSigRef.current = JSON.stringify([
      initServiceId, initStaffId, initStart, b?.customer_name ?? '',
      parsedPhone.phone, parsedPhone.country, b?.customer_email ?? '', b?.notes ?? '', initStatus,
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  // Szolgáltatás-váltáskor: ha a jelenlegi szakember nem engedélyezett az új szolgáltatásra,
  // az első engedélyezettre váltunk (érvénytelen párosítás ne menthető).
  useEffect(() => {
    if (!open) return
    if (!staffChoices.length) return
    if (!staffChoices.some((s) => String(s.id) === staffId)) {
      setStaffId(String(staffChoices[0].id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, open])

  // Szabad időpontok lekérése az aktuális staffId+serviceId+date kombinációra (csak új foglalásnál).
  useEffect(() => {
    if (isEdit || !open || !staffId || !serviceId || !salonId) {
      setFetchedSlots([])
      setSlotsLoading(false)
      return
    }
    const ctrl = new AbortController()
    setSlotsLoading(true)
    setFetchedSlots([])
    const params = new URLSearchParams({ salonId, staffId, serviceId, date })
    fetch(`/api/slots?${params}`, { credentials: 'include', signal: ctrl.signal })
      .then(r => r.json())
      .then((json: { slots?: { start: string; end: string }[] }) => {
        const slots = json.slots ?? []
        setFetchedSlots(slots)
        setSlotsLoading(false)
        // Ha nincs szabad slot, az előzetesen beállított időpontot töröljük (ne lehessen menteni).
        if (slots.length === 0) setStartTime('')
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') setSlotsLoading(false) })
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, open, staffId, serviceId, salonId, date])

  // Új foglalásnál az időpont változása frissíti az alap-státuszt, amíg a tulaj kézzel nem választ.
  useEffect(() => {
    if (!open || isEdit || statusTouched) return
    setStatus(computeDefaultStatus(date, startTime, duration))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, statusTouched, startTime, duration, date])

  const emailErr = !email.trim()
    ? 'Az e-mail cím kötelező'
    : !EMAIL_RE.test(email.trim())
      ? 'Érvénytelen e-mail cím'
      : null

  const draftFields = () => ({
    date,
    start_time: startTime,
    end_time: endTime,
    serviceId,
    staffId,
    serviceName: selectedService?.name,
    staffName: staffChoices.find((s) => String(s.id) === staffId)?.name,
    customer_name: name,
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
          date,
          start_time: startTime,
          customer_name: name,
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

  const cancelBooking = async () => {
    if (!booking) return
    setSaving(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cancelled' }),
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

  const dirty = JSON.stringify([
    serviceId, staffId, startTime, name, phone, country, email, notes, status,
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
              variants={GENIE}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ transformOrigin: 'center' }}
              className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_28px_80px_-24px_rgba(0,0,0,.55)] sm:max-h-[92vh] sm:max-w-[720px] sm:rounded-[26px]"
            >
              {/* Fejléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-zinc-900">
                    {isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {date}{isDraft && ' · még nem véglegesített offline vázlat'}
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
                    <Label className="flex items-center gap-2"><Scissors className="h-3.5 w-3.5" /> Szolgáltatás</Label>
                    <select
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      className="w-full h-10 rounded-md border border-zinc-200 bg-transparent px-3 text-sm"
                    >
                      {activeServices.length === 0 && <option value="">Nincs aktív szolgáltatás</option>}
                      {activeServices.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name} · {s.duration_minutes} perc
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Időpont</Label>
                      {/* Új foglalásnál: szabad időpontok picker (elérhető slotok a staffId+serviceId alapján) */}
                      {!isEdit && staffId && serviceId ? (
                        slotsLoading ? (
                          <div className="flex h-10 items-center gap-2 text-sm text-zinc-400">
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Időpontok betöltése…
                          </div>
                        ) : fetchedSlots.length === 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            Ezen a napon nincs szabad időpont ehhez a szakemberhez.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {fetchedSlots.map(sl => (
                              <button
                                key={sl.start}
                                type="button"
                                onClick={() => setStartTime(sl.start)}
                                className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium tabular-nums transition-colors ${
                                  startTime === sl.start
                                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
                                }`}
                              >
                                {sl.start}
                              </button>
                            ))}
                          </div>
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
                      <select
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        className="w-full h-10 rounded-md border border-zinc-200 bg-transparent px-3 text-sm"
                      >
                        {staffChoices.length === 0 && <option value="">Nincs szakember</option>}
                        {staffChoices.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.name}{s.role_title ? ` · ${s.role_title}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Státusz</Label>
                    <select
                      value={status}
                      onChange={(e) => { setStatus(e.target.value as Booking['status']); setStatusTouched(true) }}
                      className="w-full h-10 rounded-md border border-zinc-200 bg-transparent px-3 text-sm"
                    >
                      {statusOptions.map((s) => (
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

                  <div className="space-y-1.5">
                    <Label>Vendég neve <span className="text-zinc-400 font-normal">(opcionális)</span></Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pl. Kovács Anna" />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Telefon</Label>
                      <PhoneCountryInput
                        country={country}
                        phone={phone}
                        onCountryChange={setCountry}
                        onPhoneChange={setPhone}
                        inputClass="h-10 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
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
                </div>
              </motion.div>{/* /Törzs */}

              {/* Lábléc (fix) */}
              <motion.div variants={PANEL_ITEM} className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 p-4 sm:px-6">
                <Button onClick={save} disabled={saving || (!online && isEdit && !isDraft)} className="w-full rounded-full">
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
                  isEdit && status !== 'cancelled' && (
                    <Button onClick={() => setConfirmCancel(true)} disabled={saving} variant="ghost" className="w-full text-red-600 hover:text-red-700">
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
          <div className="w-full max-w-md rounded-2xl bg-white border border-zinc-200 p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 mb-1">Biztosan lemondod a foglalást?</h3>
                <p className="text-sm text-zinc-500">Ez a művelet a foglalást lemondottra állítja. A vendég értesülhet róla.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmCancel(false)} disabled={saving}
                className="flex-1 h-11 rounded-full bg-zinc-100 text-zinc-700 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50">
                Mégse
              </button>
              <button type="button" onClick={cancelBooking} disabled={saving}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Lemondás...' : 'Igen, lemondom'}
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
