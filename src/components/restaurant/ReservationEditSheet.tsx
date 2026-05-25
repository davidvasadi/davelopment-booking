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
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { hhmmToMinutes } from '@/lib/utils'
import { addDraft, updateDraft, removeDraft } from '@/lib/offlineDrafts'
import { useOnline } from '@/lib/useOnline'
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
  capacityMode: 'tables' | 'flat'
  target: EditTarget | null
}

export function ReservationEditSheet({ open, onClose, date, restaurantId, capacityMode, target }: Props) {
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
  // Ülésidő percben. null = az étterem alap turnusa (alapból 2 óra).
  const [duration, setDuration] = useState<number | null>(null)

  const [options, setOptions] = useState<MoveOption[]>([])
  const [suggestedCombo, setSuggestedCombo] = useState<ComboOption | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Form inicializálás nyitáskor
  useEffect(() => {
    if (!open || !target) return
    const r = target.reservation
    setStartTime(r?.start_time ?? target.presetStart ?? '')
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
    // Meglévő foglalásnál a tárolt hossz; újnál null (= étterem alap turnusa).
    setDuration(
      r?.start_time && r?.end_time
        ? Math.max(0, hhmmToMinutes(r.end_time) - hhmmToMinutes(r.start_time))
        : null,
    )
  }, [open, target])

  // Szabad asztalok lekérése (tables módban) idő/létszám változásra
  const loadOptions = useCallback(async () => {
    if (capacityMode !== 'tables' || !startTime || !pax) {
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
  }, [capacityMode, startTime, pax, date, reservation])

  useEffect(() => {
    if (open) void loadOptions()
  }, [open, loadOptions])

  const selectedTableIds = capacityMode === 'tables' && tableId ? tableId.split(',') : null

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
              <TimeSelect value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-1.5">
              <Label>Létszám</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={pax}
                onChange={(e) => setPax(Math.max(1, Number(e.target.value)))}
              />
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
          </div>

          {capacityMode === 'tables' && (
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
          )}

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
