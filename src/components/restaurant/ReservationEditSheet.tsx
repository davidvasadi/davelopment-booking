'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, AlertTriangle, Cake } from 'lucide-react'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/offlineDrafts'
import { useOnline } from '@/lib/useOnline'
import { urgencyOf } from './DailyView'
import type { Reservation } from '@/payload/payload-types'

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
  target: EditTarget | null
  /** A nap nyitvatartása (perc) — a TimeSelect ezt a tartományt kínálja (kemény korlát). */
  openMin?: number
  closeMin?: number
}

export function ReservationEditSheet({ open, onClose, date, restaurantId, target, openMin, closeMin }: Props) {
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
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Reservation['status']>('confirmed')
  const [source, setSource] = useState<Reservation['source']>('walk_in')
  const [isBirthday, setIsBirthday] = useState(false)
  // Ülésidő percben. null = az étterem alap turnusa (alapból 2 óra).
  const [duration, setDuration] = useState<number | null>(null)

  const [options, setOptions] = useState<MoveOption[]>([])
  const [suggestedCombo, setSuggestedCombo] = useState<ComboOption | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

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
    setPhone(r?.customer_phone ?? '')
    setEmail(r?.customer_email ?? '')
    setNotes(r?.notes ?? '')
    setStatus(r?.status ?? 'confirmed')
    setSource(r?.source ?? 'walk_in')
    setIsBirthday(r?.is_birthday ?? false)
    // Meglévő foglalásnál a tárolt hossz; újnál null (= étterem alap turnusa).
    setDuration(
      r?.start_time && r?.end_time
        ? Math.max(0, hhmmToMinutes(r.end_time) - hhmmToMinutes(r.start_time))
        : null,
    )
  }, [open, target])

  // Szabad asztalok lekérése idő/létszám változásra
  const loadOptions = useCallback(async () => {
    if (!startTime || !pax) {
      setOptions([])
      setSuggestedCombo(null)
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
    } catch {
      setOptions([])
      setSuggestedCombo(null)
    } finally {
      setOptionsLoading(false)
    }
  }, [startTime, pax, date, reservation])

  useEffect(() => {
    if (open) void loadOptions()
  }, [open, loadOptions])

  const selectedTableIds = tableId ? tableId.split(',') : null

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
      customer_phone: phone,
      customer_email: email,
      notes,
      status,
      is_birthday: isBirthday,
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
          customer_phone: phone,
          customer_email: email,
          notes,
          status,
          source,
          is_birthday: isBirthday,
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
      const res = await fetch(`/api/reservations/${reservation.id}`, {
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isDraft ? 'Vázlat szerkesztése' : isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}
          </SheetTitle>
          <SheetDescription>
            {date}
            {isDraft && ' · még nem véglegesített offline vázlat'}
          </SheetDescription>
          {isEdit && !isDraft && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
            </div>
          )}
        </SheetHeader>

        <div className="space-y-5 py-5">
          <div className="space-y-1.5">
            <Label>Vendég neve {source !== 'online' && <span className="text-zinc-400 font-normal">(opcionális)</span>}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={source === 'walk_in' ? 'Üresen: „Beeső"' : source === 'phone' ? 'Üresen: „Telefon"' : 'Pl. Kovács Anna'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  helyett — nagy +/− gombok, tableten kényelmes. 1–50 fő. */}
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
                  max={50}
                  value={pax}
                  onChange={(e) => setPax(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-bold tabular-nums text-zinc-900 outline-none dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Több fő"
                  onClick={() => setPax((p) => Math.min(50, p + 1))}
                  disabled={pax >= 50}
                  className="flex h-full w-10 shrink-0 items-center justify-center text-lg font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:text-white/50 dark:hover:text-white transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Forrás</Label>
            <div className="inline-flex w-full rounded-md bg-zinc-100 dark:bg-white/[0.06] p-1">
              {sourceOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSource(o.value)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition-colors ${
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
            <Label>Ülésidő</Label>
            <div className="inline-flex w-full rounded-md bg-zinc-100 dark:bg-white/[0.06] p-1">
              {durationOptions.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => setDuration(o.value)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition-colors ${
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

          {isEdit && (
            <div className="space-y-1.5">
              <Label>Státusz</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Reservation['status'])}
                className="w-full h-10 rounded-md border border-zinc-200 dark:border-white/[0.1] bg-transparent px-3 text-sm"
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+36…" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcionális" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Megjegyzés</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pl. ablak melletti asztal" />
          </div>

          <button
            type="button"
            onClick={() => setIsBirthday((b) => !b)}
            aria-pressed={isBirthday}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
              isBirthday
                ? 'border-pink-300 bg-pink-50 dark:border-pink-500/40 dark:bg-pink-500/10'
                : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:border-white/[0.2]'
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isBirthday ? 'bg-pink-500 text-white' : 'bg-zinc-200 text-zinc-500 dark:bg-white/[0.1] dark:text-white/50'}`}>
              <Cake className="h-4 w-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-white">Szülinapos foglalás</span>
              <span className="block text-xs text-zinc-500 dark:text-white/50">
                {isBirthday ? 'Megjelölve — a foglalási nézetben is látszik' : 'Kapcsold be, ha szülinapot ünnepelnek'}
              </span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isBirthday ? 'bg-pink-500' : 'bg-zinc-300 dark:bg-white/20'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isBirthday ? 'translate-x-[1.375rem]' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
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
        </SheetFooter>
      </SheetContent>

      {confirmCancel && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
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
        </div>,
        document.body,
      )}
    </Sheet>
  )
}
