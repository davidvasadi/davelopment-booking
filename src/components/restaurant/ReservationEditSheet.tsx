'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2 } from 'lucide-react'
import type { Reservation } from '@/payload/payload-types'

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
  capacityMode: 'tables' | 'flat'
  target: EditTarget | null
}

export function ReservationEditSheet({ open, onClose, date, capacityMode, target }: Props) {
  const router = useRouter()
  const reservation = target?.reservation ?? null
  const isEdit = !!reservation

  const [startTime, setStartTime] = useState('')
  const [pax, setPax] = useState(2)
  const [tableId, setTableId] = useState<string>('') // '' = auto
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Reservation['status']>('confirmed')

  const [options, setOptions] = useState<MoveOption[]>([])
  const [suggestedCombo, setSuggestedCombo] = useState<ComboOption | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const save = async () => {
    if (!startTime) return toast.error('Adj meg időpontot')
    if (!isEdit && !name.trim()) return toast.error('Adj meg egy nevet')
    setSaving(true)
    try {
      const res = await fetch('/api/restaurant/manage-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reservationId: reservation?.id,
          date,
          start_time: startTime,
          pax,
          tableIds: capacityMode === 'tables' && tableId ? tableId.split(',') : null,
          customer_name: name,
          customer_phone: phone,
          customer_email: email,
          notes,
          status,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hiba')
      toast.success(isEdit ? 'Foglalás frissítve' : 'Foglalás rögzítve')
      onClose()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setSaving(false)
    }
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
          <SheetTitle>{isEdit ? 'Foglalás szerkesztése' : 'Új foglalás'}</SheetTitle>
          <SheetDescription>{date}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Vendég neve</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pl. Kovács Anna" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Időpont</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} step={900} />
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
          <Button onClick={save} disabled={saving} className="w-full rounded-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Mentés' : 'Foglalás rögzítése'}
          </Button>
          {isEdit && status !== 'cancelled' && (
            <Button
              onClick={cancelReservation}
              disabled={saving}
              variant="ghost"
              className="w-full text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Foglalás lemondása
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
