'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Users } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type RoomItem = { id: number | string; name: string; sort_order: number }
type TableItem = {
  id: number | string
  name: string
  capacity: number
  room: number | string | null
  sort_order: number
  combinable_with: (number | string)[]
}

export function TablesManager({
  restaurantId,
  initialRooms,
  initialTables,
}: {
  restaurantId: number | string
  initialRooms: RoomItem[]
  initialTables: TableItem[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [editing, setEditing] = useState<TableItem | null>(null)

  const refresh = () => router.refresh()

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  // ---- Terem műveletek ----
  const addRoom = async () => {
    const name = newRoomName.trim()
    if (!name) return
    setBusy(true)
    try {
      await api('/api/rooms', 'POST', {
        restaurant: restaurantId,
        name,
        sort_order: initialRooms.length + 1,
      })
      setNewRoomName('')
      toast.success('Terem hozzáadva')
      refresh()
    } catch {
      toast.error('Nem sikerült a terem létrehozása')
    } finally {
      setBusy(false)
    }
  }

  const deleteRoom = async (roomId: number | string) => {
    if (!confirm('Biztosan törlöd a termet és a benne lévő asztalokat?')) return
    setBusy(true)
    try {
      const roomTables = initialTables.filter((t) => String(t.room) === String(roomId))
      for (const t of roomTables) {
        await api(`/api/tables/${t.id}`, 'DELETE')
      }
      await api(`/api/rooms/${roomId}`, 'DELETE')
      toast.success('Terem törölve')
      refresh()
    } catch {
      toast.error('Nem sikerült a törlés')
    } finally {
      setBusy(false)
    }
  }

  // ---- Asztal műveletek ----
  const addTable = async (roomId: number | string) => {
    setBusy(true)
    try {
      const roomTables = initialTables.filter((t) => String(t.room) === String(roomId))
      await api('/api/tables', 'POST', {
        restaurant: restaurantId,
        room: roomId,
        name: String(roomTables.length + 1),
        capacity: 2,
        sort_order: roomTables.length + 1,
      })
      toast.success('Asztal hozzáadva')
      refresh()
    } catch {
      toast.error('Nem sikerült az asztal létrehozása')
    } finally {
      setBusy(false)
    }
  }

  const cardClass =
    'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

  return (
    <div className="space-y-5">
      {initialRooms.map((room) => {
        const roomTables = initialTables
          .filter((t) => String(t.room) === String(room.id))
          .sort((a, b) => a.sort_order - b.sort_order)
        const seats = roomTables.reduce((s, t) => s + t.capacity, 0)
        return (
          <div key={room.id} className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-white">{room.name}</h2>
                <p className="text-xs text-zinc-400">
                  {roomTables.length} asztal · {seats} férőhely
                </p>
              </div>
              <button
                onClick={() => deleteRoom(room.id)}
                disabled={busy}
                className="text-zinc-400 hover:text-red-500 transition-colors p-2"
                title="Terem törlése"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {roomTables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditing(t)}
                  className="text-left border border-zinc-200 dark:border-white/[0.08] rounded-xl p-3 hover:border-zinc-400 dark:hover:border-white/[0.2] transition-colors"
                >
                  <p className="font-semibold text-zinc-900 dark:text-white text-sm truncate">{t.name}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{t.capacity} fő</span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => addTable(room.id)}
                disabled={busy}
                className="border border-dashed border-zinc-300 dark:border-white/[0.12] rounded-xl p-3 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 transition-colors min-h-[68px]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )
      })}

      {/* Új terem */}
      <div className={`${cardClass} p-5`}>
        <div className="flex items-center gap-3">
          <input
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRoom()}
            placeholder="Új terem neve (pl. Terasz)"
            className="flex-1 h-11 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] px-4 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
          />
          <button
            onClick={addRoom}
            disabled={busy || !newRoomName.trim()}
            className="h-11 px-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Terem
          </button>
        </div>
      </div>

      <TableEditSheet
        table={editing}
        allTables={initialTables}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  )
}

function TableEditSheet({
  table,
  allTables,
  onClose,
  onSaved,
}: {
  table: TableItem | null
  allTables: TableItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(2)
  const [combinable, setCombinable] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync local state when a new table is opened
  const [lastId, setLastId] = useState<string | null>(null)
  if (table && String(table.id) !== lastId) {
    setLastId(String(table.id))
    setName(table.name)
    setCapacity(table.capacity)
    setCombinable(table.combinable_with.map(String))
  }

  const toggleCombinable = (id: string) =>
    setCombinable((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // A többi asztal, amivel ez összevonható lehet
  const others = table ? allTables.filter((t) => String(t.id) !== String(table.id)) : []
  const comboCapacity = capacity + others.filter((t) => combinable.includes(String(t.id))).reduce((s, t) => s + t.capacity, 0)

  const save = async () => {
    if (!table) return
    setSaving(true)
    const toId = (id: string | number) => (Number.isNaN(Number(id)) ? id : Number(id))
    const patch = (id: string | number, body: unknown) =>
      fetch(`/api/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
    try {
      const res = await patch(table.id, {
        name: name.trim() || table.name,
        capacity,
        combinable_with: combinable.map(toId),
      })
      if (!res.ok) throw new Error()

      // Szimmetria: a kapcsolatot a másik asztal rekordjába is bele- ill. kivesszük,
      // hogy mindkét oldalon látszódjon a pipa és az adat konzisztens maradjon.
      const before = new Set(table.combinable_with.map(String))
      const after = new Set(combinable)
      const added = others.filter((t) => after.has(String(t.id)) && !before.has(String(t.id)))
      const removed = others.filter((t) => before.has(String(t.id)) && !after.has(String(t.id)))

      await Promise.all([
        ...added.map((t) => {
          const next = Array.from(new Set([...t.combinable_with.map(String), String(table.id)]))
          return patch(t.id, { combinable_with: next.map(toId) })
        }),
        ...removed.map((t) => {
          const next = t.combinable_with.map(String).filter((x) => x !== String(table.id))
          return patch(t.id, { combinable_with: next.map(toId) })
        }),
      ])

      toast.success('Asztal mentve')
      onSaved()
      onClose()
    } catch {
      toast.error('Nem sikerült a mentés')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!table) return
    if (!confirm(`Biztosan törlöd a(z) „${table.name}" asztalt?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tables/${table.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      toast.success('Asztal törölve')
      onSaved()
      onClose()
    } catch {
      toast.error('Nem sikerült a törlés')
    } finally {
      setDeleting(false)
    }
  }

  const inputClass =
    'h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white'
  const labelClass = 'text-sm font-medium text-zinc-600 dark:text-white/60'

  return (
    <Sheet open={!!table} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md bg-white dark:bg-zinc-950">
        <SheetHeader>
          <SheetTitle>Asztal szerkesztése</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className={labelClass}>Asztal neve</Label>
            <Input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. 1 vagy Ablak melletti" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Hány fős</Label>
            <Input
              className={inputClass}
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          {others.length > 0 && (
            <div className="space-y-1.5">
              <Label className={labelClass}>Összevonható ezekkel</Label>
              <p className="text-xs text-zinc-400 dark:text-white/30">
                Jelöld be a fizikailag összetolható asztalokat. Nagyobb társaságnál ezeket a rendszer automatikusan
                összevonja.
              </p>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-white/[0.1] divide-y divide-zinc-100 dark:divide-white/[0.06]">
                {others.map((t) => {
                  const checked = combinable.includes(String(t.id))
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleCombinable(String(t.id))}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-sm text-zinc-700 dark:text-white/80">
                        {t.name} <span className="text-zinc-400">· {t.capacity} fő</span>
                      </span>
                      <span
                        className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${
                          checked
                            ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white'
                            : 'border-zinc-300 dark:border-white/20'
                        }`}
                      >
                        {checked && <span className="text-white dark:text-black text-xs leading-none">✓</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              {combinable.length > 0 && (
                <p className="text-xs text-emerald-600">
                  Összevonva max <strong>{comboCapacity} fő</strong> ülhet le.
                </p>
              )}
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Mentés…' : 'Mentés'}
          </button>

          <button
            onClick={remove}
            disabled={deleting}
            className="w-full h-11 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/[0.06] font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Törlés…' : 'Asztal törlése'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
