'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Users, ChevronDown, GripVertical, Trees, Home, Pencil } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type RoomItem = {
  id: number | string
  name: string
  sort_order: number
  is_outdoor: boolean
  seasonal?: boolean
  season_start?: string | null
  season_end?: string | null
}
type SeasonFields = { seasonal: boolean; season_start: string | null; season_end: string | null }

function inSeason(season: SeasonFields, date: string): boolean {
  if (!season.seasonal) return true
  const s = season.season_start ? season.season_start.slice(5) : null
  const e = season.season_end ? season.season_end.slice(5) : null
  if (!s && !e) return true
  const day = date.slice(5)
  if (s && e) return s <= e ? day >= s && day <= e : day >= s || day <= e
  if (s) return day >= s
  if (e) return day <= e
  return true
}

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
  const [editing, setEditing] = useState<TableItem | null>(null)
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    title: string
    description?: string
    onConfirm: () => void
  } | null>(null)

  // Lokális terem-sorrend state — ez frissül drag közben azonnal (optimistic UI)
  const [localRooms, setLocalRooms] = useState<RoomItem[]>(() =>
    [...initialRooms].sort((a, b) => a.sort_order - b.sort_order)
  )

  // Ha a szülő új initialRooms-t ad (pl. refresh után), szinkronizálunk
  useEffect(() => {
    setLocalRooms([...initialRooms].sort((a, b) => a.sort_order - b.sort_order))
  }, [initialRooms])

  const COLLAPSE_KEY = `tables-collapsed-${restaurantId}`
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]') as string[]
      setCollapsed(new Set(saved))
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleCollapsed = (roomId: number | string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      const key = String(roomId)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  // Asztal drag state
  const [dragId, setDragId] = useState<string | null>(null)

  // Terem drag state (külön az asztal-drag-től, hogy a kettő ne keveredjen)
  const [dragRoomId, setDragRoomId] = useState<string | null>(null)
  // Ref hogy az onDrop-ban mindig a friss localRooms-t lássuk
  const localRoomsRef = useRef(localRooms)
  useEffect(() => { localRoomsRef.current = localRooms }, [localRooms])

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
  const addRoom = async (name: string, isOutdoor: boolean, season: SeasonFields) => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await api('/api/rooms', 'POST', {
        restaurant: restaurantId,
        name: name.trim(),
        is_outdoor: isOutdoor,
        seasonal: season.seasonal,
        season_start: season.season_start,
        season_end: season.season_end,
        sort_order: initialRooms.length + 1,
      })
      setCreatingRoom(false)
      toast.success('Terem hozzáadva')
      refresh()
    } catch {
      toast.error('Nem sikerült a terem létrehozása')
    } finally {
      setBusy(false)
    }
  }

  const doSaveRoom = async (roomId: number | string, name: string, isOutdoor: boolean, season: SeasonFields) => {
    setBusy(true)
    try {
      await api(`/api/rooms/${roomId}`, 'PATCH', {
        name: name.trim(),
        is_outdoor: isOutdoor,
        seasonal: season.seasonal,
        season_start: season.season_start,
        season_end: season.season_end,
      })
      toast.success('Terem módosítva')
      setEditingRoom(null)
      refresh()
    } catch {
      toast.error('Nem sikerült a terem módosítása')
    } finally {
      setBusy(false)
    }
  }

  const saveRoom = async (roomId: number | string, name: string, isOutdoor: boolean, season: SeasonFields) => {
    if (season.seasonal) {
      const affected = await countAffectedReservations(roomId, season)
      if (affected > 0) {
        setConfirmState({
          title: 'Szezonon kívüli foglalások',
          description: `${affected} jövőbeli foglalás esik a megadott szezonon kívülre ebben a teremben. Ezek a foglalások megmaradnak — kérlek kezeld őket külön (pl. áthelyezés, értesítés). Folytatod a mentést?`,
          onConfirm: () => {
            setConfirmState(null)
            void doSaveRoom(roomId, name, isOutdoor, season)
          },
        })
        return
      }
    }
    void doSaveRoom(roomId, name, isOutdoor, season)
  }

  const countAffectedReservations = async (roomId: number | string, season: SeasonFields): Promise<number> => {
    const roomTableIds = new Set(
      initialTables.filter((t) => String(t.room) === String(roomId)).map((t) => String(t.id)),
    )
    if (roomTableIds.size === 0) return 0
    const today = new Date()
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    try {
      const res = await fetch(
        `/api/reservations?where[date][greater_than_equal]=${ymd}&where[status][in]=pending,confirmed,seated&limit=500&depth=0`,
        { credentials: 'include' },
      )
      if (!res.ok) return 0
      const data = await res.json()
      const docs: { date: string; tables?: (number | string | { id: number | string })[] }[] = data.docs ?? []
      return docs.filter((r) => {
        const onRoomTable = (r.tables ?? []).some((t) => roomTableIds.has(String(typeof t === 'object' && t ? t.id : t)))
        return onRoomTable && !inSeason(season, r.date)
      }).length
    } catch {
      return 0
    }
  }

  const deleteRoom = (roomId: number | string) => {
    setConfirmState({
      title: 'Terem törlése',
      description: 'Biztosan törlöd a termet és a benne lévő összes asztalt? Ez nem vonható vissza.',
      onConfirm: () => runDeleteRoom(roomId),
    })
  }

  const runDeleteRoom = async (roomId: number | string) => {
    setBusy(true)
    try {
      const roomTables = initialTables.filter((t) => String(t.room) === String(roomId))
      for (const t of roomTables) {
        await api(`/api/tables/${t.id}`, 'DELETE')
      }
      await api(`/api/rooms/${roomId}`, 'DELETE')
      toast.success('Terem törölve')
      setConfirmState(null)
      refresh()
    } catch {
      toast.error('Nem sikerült a törlés')
    } finally {
      setBusy(false)
    }
  }

  const runDeleteTable = async (tableId: number | string) => {
    setBusy(true)
    try {
      await api(`/api/tables/${tableId}`, 'DELETE')
      toast.success('Asztal törölve')
      setConfirmState(null)
      setEditing(null)
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

  // ---- Drag & drop asztaloknál (termen belül) ----
  const reorder = async (roomId: number | string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const list = initialTables
      .filter((t) => String(t.room) === String(roomId))
      .sort((a, b) => a.sort_order - b.sort_order)
    const from = list.findIndex((t) => String(t.id) === draggedId)
    const to = list.findIndex((t) => String(t.id) === targetId)
    if (from === -1 || to === -1) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setBusy(true)
    try {
      await Promise.all(
        next.map((t, i) =>
          t.sort_order === i + 1 ? null : api(`/api/tables/${t.id}`, 'PATCH', { sort_order: i + 1 }),
        ),
      )
      refresh()
    } catch {
      toast.error('Nem sikerült a sorrend mentése')
    } finally {
      setBusy(false)
    }
  }

  // ---- Drag & drop termeknél ----
  // onDragOver közben frissítjük a lokális sorrendet → azonnal látszik az új pozíció.
  const reorderRoomsLocal = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setLocalRooms((prev) => {
      const from = prev.findIndex((r) => String(r.id) === draggedId)
      const to = prev.findIndex((r) => String(r.id) === targetId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // onDrop után menti az új sorrendet az API-ba (a localRoomsRef aktuális értékével)
  const saveRoomOrder = async () => {
    const current = localRoomsRef.current
    try {
      await Promise.all(
        current.map((r, i) =>
          r.sort_order === i + 1 ? null : api(`/api/rooms/${r.id}`, 'PATCH', { sort_order: i + 1 }),
        ),
      )
      // Nincs router.refresh() — a lokális state már helyes, felesleges újrarenderelni
    } catch {
      toast.error('Nem sikerült a sorrend mentése')
      // Hiba esetén visszaállítjuk az eredeti sorrendet
      setLocalRooms([...initialRooms].sort((a, b) => a.sort_order - b.sort_order))
    }
  }

  const cardClass =
    'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => setCreatingRoom(true)}
          disabled={busy}
          className="h-11 px-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Terem
        </button>
      </div>

      {localRooms.map((room) => {
        const roomTables = initialTables
          .filter((t) => String(t.room) === String(room.id))
          .sort((a, b) => a.sort_order - b.sort_order)
        const seats = roomTables.reduce((s, t) => s + t.capacity, 0)
        const isCollapsed = collapsed.has(String(room.id))
        const isDraggingThis = dragRoomId === String(room.id)

        return (
          <div
            key={room.id}
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              setDragRoomId(String(room.id))
            }}
            onDragEnd={() => {
              setDragRoomId(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // Élőben frissítjük a sorrendet drag közben
              if (dragRoomId && dragRoomId !== String(room.id)) {
                reorderRoomsLocal(dragRoomId, String(room.id))
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragRoomId(null)
              // Csak terem drag esetén mentünk
              if (dragRoomId) {
                void saveRoomOrder()
              }
            }}
            className={`${cardClass} p-5 transition-opacity cursor-grab active:cursor-grabbing ${
              isDraggingThis ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <GripVertical
                className="h-4 w-4 shrink-0 text-zinc-300 dark:text-white/20"
                aria-label="Húzd át a terem áthelyezéséhez"
              />
              <button
                onClick={() => toggleCollapsed(room.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left group"
                title={isCollapsed ? 'Kibontás' : 'Összecsukás'}
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <h2 className="font-semibold text-zinc-900 dark:text-white truncate">{room.name}</h2>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        room.is_outdoor
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.08] dark:text-white/60'
                      }`}
                    >
                      {room.is_outdoor ? <Trees className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                      {room.is_outdoor ? 'Kültéri' : 'Beltéri'}
                    </span>
                  </span>
                  <span className="block text-xs text-zinc-400">
                    {roomTables.length} asztal · {seats} férőhely
                  </span>
                </span>
              </button>
              <div className="flex items-center shrink-0 gap-1">
                <GripVertical className="h-4 w-4 text-zinc-300 dark:text-white/20" />
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingRoom(room) }}
                  disabled={busy}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-2"
                  title="Terem szerkesztése"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRoom(room.id) }}
                  disabled={busy}
                  className="text-zinc-400 hover:text-red-500 transition-colors p-2"
                  title="Terem törlése"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {roomTables.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation()
                      setDragId(String(t.id))
                      setDragRoomId(null)
                    }}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (dragId) void reorder(room.id, dragId, String(t.id))
                      setDragId(null)
                    }}
                    className={`group relative text-left border rounded-xl p-3 transition-all cursor-grab active:cursor-grabbing ${
                      dragId === String(t.id)
                        ? 'border-zinc-400 dark:border-white/[0.3] opacity-50'
                        : 'border-zinc-200 dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-white/[0.2]'
                    }`}
                  >
                    <button onClick={() => setEditing(t)} className="block w-full text-left">
                      <p className="font-semibold text-zinc-900 dark:text-white text-sm truncate pr-4">{t.name}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <Users className="h-3 w-3" />
                        <span className="tabular-nums">{t.capacity} fő</span>
                      </div>
                    </button>
                    <GripVertical className="absolute right-1.5 top-1.5 h-4 w-4 text-zinc-300 dark:text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
                <button
                  onClick={() => addTable(room.id)}
                  disabled={busy}
                  className="border border-dashed border-zinc-300 dark:border-white/[0.12] rounded-xl p-3 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 transition-colors min-h-[68px]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      <TableEditSheet
        table={editing}
        allTables={initialTables}
        onClose={() => setEditing(null)}
        onSaved={refresh}
        onRequestDelete={(t) =>
          setConfirmState({
            title: 'Asztal törlése',
            description: `Biztosan törlöd a(z) „${t.name}" asztalt? Ez nem vonható vissza.`,
            onConfirm: () => runDeleteTable(t.id),
          })
        }
      />

      <RoomEditSheet
        room={editingRoom}
        creating={creatingRoom}
        busy={busy}
        onClose={() => { setEditingRoom(null); setCreatingRoom(false) }}
        onSave={(id, name, outdoor, season) => (id == null ? addRoom(name, outdoor, season) : saveRoom(id, name, outdoor, season))}
      />

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
        confirmLabel="Törlés"
        busy={busy}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}

function RoomEditSheet({
  room,
  creating,
  busy,
  onClose,
  onSave,
}: {
  room: RoomItem | null
  creating: boolean
  busy: boolean
  onClose: () => void
  onSave: (roomId: number | string | null, name: string, isOutdoor: boolean, season: SeasonFields) => void
}) {
  const open = !!room || creating
  const [name, setName] = useState('')
  const [outdoor, setOutdoor] = useState(false)
  const [seasonal, setSeasonal] = useState(false)
  const [seasonStart, setSeasonStart] = useState('')
  const [seasonEnd, setSeasonEnd] = useState('')

  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = room ? String(room.id) : creating ? 'new' : null
  if (open && key !== lastKey) {
    setLastKey(key)
    setName(room?.name ?? '')
    setOutdoor(room?.is_outdoor ?? false)
    setSeasonal(room?.seasonal ?? false)
    setSeasonStart(room?.season_start ?? '')
    setSeasonEnd(room?.season_end ?? '')
  }

  const inputClass =
    'h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white'
  const labelClass = 'text-sm font-medium text-zinc-600 dark:text-white/60'

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md bg-white dark:bg-zinc-950">
        <SheetHeader>
          <SheetTitle>{room ? 'Terem szerkesztése' : 'Új terem'}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className={labelClass}>Terem neve</Label>
            <Input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Terasz" />
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.1] p-4">
            <ToggleSwitch
              checked={outdoor}
              onChange={setOutdoor}
              label="Kültéri terem"
              description="Terasz, kert vagy egyéb kültéri rész. Alapból beltéri."
            />
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.1] p-4 space-y-4">
            <ToggleSwitch
              checked={seasonal}
              onChange={setSeasonal}
              label="Szezonális"
              description="Csak a megadott időszakban foglalható (pl. terasz nyáron). Az időszakon kívül kiesik a foglalható asztalok közül a foglaló oldalon is."
            />
            {seasonal && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Szezon kezdete</Label>
                  <Input className={inputClass} type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelClass}>Szezon vége</Label>
                  <Input className={inputClass} type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onSave(room?.id ?? null, name, outdoor, {
              seasonal,
              season_start: seasonal && seasonStart ? seasonStart : null,
              season_end: seasonal && seasonEnd ? seasonEnd : null,
            })}
            disabled={busy || !name.trim()}
            className="w-full h-12 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {busy ? 'Mentés…' : room ? 'Mentés' : 'Terem létrehozása'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TableEditSheet({
  table,
  allTables,
  onClose,
  onSaved,
  onRequestDelete,
}: {
  table: TableItem | null
  allTables: TableItem[]
  onClose: () => void
  onSaved: () => void
  onRequestDelete: (table: TableItem) => void
}) {
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(2)
  const [combinable, setCombinable] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [lastId, setLastId] = useState<string | null>(null)
  if (table && String(table.id) !== lastId) {
    setLastId(String(table.id))
    setName(table.name)
    setCapacity(table.capacity)
    setCombinable(table.combinable_with.map(String))
  }

  const toggleCombinable = (id: string) =>
    setCombinable((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

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
            <div className="flex h-11 items-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-white/[0.1] dark:bg-white/[0.06]">
              <button
                type="button"
                aria-label="Kevesebb fő"
                onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                disabled={capacity <= 1}
                className="flex h-full w-12 shrink-0 items-center justify-center text-xl font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:text-white/50 dark:hover:text-white transition-colors"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-base font-bold tabular-nums text-zinc-900 outline-none dark:text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Több fő"
                onClick={() => setCapacity((c) => Math.min(20, c + 1))}
                disabled={capacity >= 20}
                className="flex h-full w-12 shrink-0 items-center justify-center text-xl font-bold text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:text-white/50 dark:hover:text-white transition-colors"
              >
                +
              </button>
            </div>
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
            onClick={() => { if (table) { onClose(); onRequestDelete(table) } }}
            className="w-full h-11 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/[0.06] font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Asztal törlése
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}