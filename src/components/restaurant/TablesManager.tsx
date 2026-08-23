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
import { TableGlyph } from './TableGlyph'

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

const MONTHS_HU = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
function seasonLabel(room: RoomItem): string {
  if (!room.seasonal) return 'Egész évben nyitva'
  const fmt = (d?: string | null) => {
    if (!d) return null
    const [, m, day] = d.split('-')
    return `${MONTHS_HU[Number(m) - 1]} ${Number(day)}.`
  }
  const s = fmt(room.season_start)
  const e = fmt(room.season_end)
  if (s && e) return `Szezonális · ${s} – ${e}`
  if (s) return `Szezonális · ${s}-tól`
  if (e) return `Szezonális · ${e}-ig`
  return 'Szezonális'
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
  canManage = false,
}: {
  restaurantId: number | string
  initialRooms: RoomItem[]
  initialTables: TableItem[]
  canManage?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<TableItem | null>(null)
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [assigningOrphans, setAssigningOrphans] = useState(false)
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

  // Terem nélküli ("Egyéb") asztalok EGYBEN átsorolása egy valódi terembe — ez az "Egyéb"
  // csoport "szerkesztése" (nincs mögötte terem-rekord, aminek nevét/típusát írni lehetne,
  // úgyhogy itt a szerkesztés = kiválasztod, melyik terembe kerüljenek).
  const runAssignOrphansToRoom = async (ids: (number | string)[], roomId: number | string) => {
    setBusy(true)
    try {
      // A room relationship-mező numerikus ID-t vár — a <select> mindig stringet ad,
      // ami "The following field is invalid: Terem" 400-at dobott.
      const roomIdNum = Number.isNaN(Number(roomId)) ? roomId : Number(roomId)
      for (const id of ids) {
        await api(`/api/tables/${id}`, 'PATCH', { room: roomIdNum })
      }
      toast.success('Asztalok átsorolva')
      setAssigningOrphans(false)
      refresh()
    } catch {
      toast.error('Nem sikerült az átsorolás')
    } finally {
      setBusy(false)
    }
  }

  // Terem nélküli ("Egyéb") asztalok EGYBEN törlése — a terem-törléshez hasonlóan, csak itt
  // nincs mögötte valódi terem-rekord, amit is törölni kellene.
  const runDeleteOrphanTables = async (ids: (number | string)[]) => {
    setBusy(true)
    try {
      for (const id of ids) {
        await api(`/api/tables/${id}`, 'DELETE')
      }
      toast.success('Asztalok törölve')
      setConfirmState(null)
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

  // ---- Összesítő számok ----
  const totalSeats = initialTables.reduce((s, t) => s + t.capacity, 0)
  const combinableCount = initialTables.filter((t) => t.combinable_with.length > 0).length
  const nameById = new Map(initialTables.map((t) => [String(t.id), t.name]))

  return (
    <div className="space-y-4">
      {/* ── Akciók ── */}
      {canManage && (
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            onClick={() => setCreatingRoom(true)}
            disabled={busy}
            className="flex items-center gap-2 rounded-dav-pill border border-line bg-[var(--dav-glass)] px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-40"
          >
            <Home className="h-4 w-4" strokeWidth={1.7} />
            Új terem
          </button>
        </div>
      )}

      {/* ── Összesítő ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
        <SummaryCard label="Termek" value={String(localRooms.length)} />
        <SummaryCard label="Asztalok" value={String(initialTables.length)} />
        <div className="rounded-[20px] bg-ink-dark px-[18px] py-4 text-white">
          <div className="text-xs font-medium text-white/55">Összes férőhely</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[30px] font-light leading-none tracking-[-0.02em]">{totalSeats}</span>
            <span className="text-xs font-medium text-gold">fő</span>
          </div>
        </div>
        <SummaryCard label="Összevonható" value={String(combinableCount)} />
      </div>

      {/* ── Termek ── */}
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
            draggable={canManage}
            onDragStart={(e) => {
              e.stopPropagation()
              setDragRoomId(String(room.id))
            }}
            onDragEnd={() => {
              setDragRoomId(null)
            }}
            onDragOver={(e) => {
              if (!canManage) return
              e.preventDefault()
              e.stopPropagation()
              // Élőben frissítjük a sorrendet drag közben
              if (dragRoomId && dragRoomId !== String(room.id)) {
                reorderRoomsLocal(dragRoomId, String(room.id))
              }
            }}
            onDrop={(e) => {
              if (!canManage) return
              e.preventDefault()
              e.stopPropagation()
              setDragRoomId(null)
              // Csak terem drag esetén mentünk
              if (dragRoomId) {
                void saveRoomOrder()
              }
            }}
            className={`rounded-[26px] dav-card-glass p-4 sm:p-[22px] transition-opacity ${
              isDraggingThis ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {/* Terem fejléc */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="hidden shrink-0 cursor-grab active:cursor-grabbing sm:block"
                  draggable={false}
                  title="Húzd át a terem áthelyezéséhez"
                >
                  <GripVertical className="h-4 w-4 text-ink-soft2/50" />
                </span>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${
                    room.is_outdoor ? 'bg-[#EDE7D6]' : 'bg-ink-dark'
                  }`}
                >
                  {room.is_outdoor ? (
                    <Trees className="h-5 w-5 text-[#9A8B52]" strokeWidth={1.6} />
                  ) : (
                    <Home className="h-5 w-5 text-gold" strokeWidth={1.6} />
                  )}
                </div>
                <button
                  onClick={() => toggleCollapsed(room.id)}
                  className="flex min-w-0 items-center gap-2 text-left"
                  title={isCollapsed ? 'Kibontás' : 'Összecsukás'}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[18px] font-semibold text-ink">{room.name}</h2>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-[9px] px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                          room.is_outdoor ? 'bg-[#EDE7D6] text-[#9A8B52]' : 'bg-[#E7E1D0] text-ink-soft'
                        }`}
                      >
                        {room.is_outdoor ? 'KÜLTÉRI' : 'BELTÉRI'}
                      </span>
                      <span className="text-xs text-ink-soft">{seasonLabel(room)}</span>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[13px] font-medium text-ink-soft">
                  {roomTables.length} asztal · {seats} fő
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingRoom(room) }}
                      disabled={busy}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_6px_rgba(80,70,30,.07)] transition-colors hover:bg-paper disabled:opacity-40"
                      title="Terem szerkesztése"
                    >
                      <Pencil className="h-[15px] w-[15px]" strokeWidth={1.6} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id) }}
                      disabled={busy}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-[0_2px_6px_rgba(80,70,30,.07)] transition-colors hover:text-bad disabled:opacity-40"
                      title="Terem törlése"
                    >
                      <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.6} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Asztal rács */}
            {!isCollapsed && (
              <div
                className="mt-[18px] grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
              >
                {roomTables.map((t) => {
                  const combinedNames = t.combinable_with
                    .map((id) => nameById.get(String(id)))
                    .filter((n): n is string => !!n)
                  const isCombinable = combinedNames.length > 0
                  return (
                    <div
                      key={t.id}
                      draggable={canManage}
                      onDragStart={(e) => {
                        e.stopPropagation()
                        setDragId(String(t.id))
                        setDragRoomId(null)
                      }}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => { if (canManage) e.preventDefault() }}
                      onDrop={(e) => {
                        if (!canManage) return
                        e.preventDefault()
                        e.stopPropagation()
                        if (dragId) void reorder(room.id, dragId, String(t.id))
                        setDragId(null)
                      }}
                      className={`group relative rounded-[18px] border bg-white p-4 transition-all ${canManage ? 'cursor-grab active:cursor-grabbing' : ''} ${
                        dragId === String(t.id)
                          ? 'border-line-strong opacity-50'
                          : isCombinable
                            ? 'border-gold/50 hover:border-gold'
                            : 'border-line hover:border-line-strong'
                      }`}
                    >
                      <button onClick={() => canManage && setEditing(t)} className={`block w-full text-left ${canManage ? '' : 'cursor-default'}`}>
                        <div className="flex items-start justify-between">
                          <TableGlyph capacity={t.capacity} />
                          {isCombinable ? (
                            <span className="rounded-lg bg-gold/[0.22] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#9A8B52]">
                              ÖSSZEVONHATÓ
                            </span>
                          ) : (
                            <GripVertical className="h-4 w-4 text-line-strong opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </div>
                        <div className="mt-3.5 truncate text-[22px] font-semibold tracking-[-0.01em] text-ink">{t.name}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-soft">
                          <Users className="h-3 w-3" />
                          <span className="tabular-nums">{t.capacity} fő</span>
                          {combinedNames.length > 0 && (
                            <span className="truncate"> · {combinedNames.join(', ')}-tel</span>
                          )}
                        </div>
                      </button>
                    </div>
                  )
                })}
                {canManage && (
                  <button
                    onClick={() => addTable(room.id)}
                    disabled={busy}
                    className="flex min-h-[118px] flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong text-ink-soft transition-colors hover:border-ink-soft hover:text-ink disabled:opacity-40"
                  >
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/60">
                      <Plus className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <span className="text-xs font-medium">Asztal hozzáadása</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Terem nélküli ("Egyéb") asztalok ──
          Ha egy asztal room-ja valamiért null (pl. régi import, vagy egy korábban törölt
          terem maradványa), a fenti terem-listából LÁTHATATLAN és TÖRÖLHETETLEN volt — a
          foglaló nézet viszont "Egyéb" névvel megjelenítette és foglalhatóvá is tette
          (súlyos inkonzisztencia). Ez a szakasz ugyanazt az "Egyéb" bucket-et mutatja itt is,
          hogy szerkeszthető/törölhető legyen. */}
      {(() => {
        const orphanTables = initialTables
          .filter((t) => t.room == null)
          .sort((a, b) => a.sort_order - b.sort_order)
        if (orphanTables.length === 0) return null
        const seats = orphanTables.reduce((s, t) => s + t.capacity, 0)
        return (
          <div className="rounded-[26px] dav-card-glass p-4 sm:p-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#EDE7D6]">
                  <Home className="h-5 w-5 text-[#9A8B52]" strokeWidth={1.6} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[18px] font-semibold text-ink">Egyéb</h2>
                  <p className="mt-0.5 text-xs text-ink-soft">Terem nélküli asztalok — rendezd be egy terembe, vagy töröld.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[13px] font-medium text-ink-soft">
                  {orphanTables.length} asztal · {seats} fő
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => setAssigningOrphans(true)}
                      disabled={busy || localRooms.length === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_6px_rgba(80,70,30,.07)] transition-colors hover:bg-paper disabled:opacity-40"
                      title="Mind átsorolása egy terembe"
                    >
                      <Pencil className="h-[15px] w-[15px]" strokeWidth={1.6} />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmState({
                          title: 'Egyéb asztalok törlése',
                          description: `Biztosan törlöd mind a(z) ${orphanTables.length} terem nélküli asztalt? Ez nem vonható vissza.`,
                          onConfirm: () => runDeleteOrphanTables(orphanTables.map((t) => t.id)),
                        })
                      }
                      disabled={busy}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-[0_2px_6px_rgba(80,70,30,.07)] transition-colors hover:text-bad disabled:opacity-40"
                      title="Összes egyéb asztal törlése"
                    >
                      <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.6} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div
              className="mt-[18px] grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
            >
              {orphanTables.map((t) => {
                const combinedNames = t.combinable_with
                  .map((id) => nameById.get(String(id)))
                  .filter((n): n is string => !!n)
                const isCombinable = combinedNames.length > 0
                return (
                  <button
                    key={t.id}
                    onClick={() => canManage && setEditing(t)}
                    className={`group relative rounded-[18px] border bg-white p-4 text-left transition-all ${canManage ? '' : 'cursor-default'} ${
                      isCombinable ? 'border-gold/50 hover:border-gold' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <TableGlyph capacity={t.capacity} />
                      {isCombinable && (
                        <span className="rounded-lg bg-gold/[0.22] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#9A8B52]">
                          ÖSSZEVONHATÓ
                        </span>
                      )}
                    </div>
                    <div className="mt-3.5 truncate text-[22px] font-semibold tracking-[-0.01em] text-ink">{t.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-soft">
                      <Users className="h-3 w-3" />
                      <span className="tabular-nums">{t.capacity} fő</span>
                      {combinedNames.length > 0 && (
                        <span className="truncate"> · {combinedNames.join(', ')}-tel</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <OrphanAssignSheet
              open={assigningOrphans}
              tables={orphanTables}
              rooms={localRooms}
              busy={busy}
              onClose={() => setAssigningOrphans(false)}
              onAssign={(ids, roomId) => runAssignOrphansToRoom(ids, roomId)}
            />
          </div>
        )
      })()}

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

/** Az "Egyéb" (terem nélküli) asztalok átsorolása egy kiválasztott terembe — kijelölhető,
 *  melyik asztalok menjenek (nem kötelező mind egyszerre), ez a virtuális csoport
 *  "szerkesztése", mivel nincs mögötte saját terem-rekord. */
function OrphanAssignSheet({
  open,
  tables,
  rooms,
  busy,
  onClose,
  onAssign,
}: {
  open: boolean
  tables: TableItem[]
  rooms: RoomItem[]
  busy: boolean
  onClose: () => void
  onAssign: (ids: (number | string)[], roomId: number | string) => void
}) {
  const [roomId, setRoomId] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setRoomId(rooms[0] ? String(rooms[0].id) : '')
      setSelected(new Set(tables.map((t) => String(t.id))))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const allChecked = selected.size === tables.length && tables.length > 0

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md bg-white">
        <SheetHeader>
          <SheetTitle>Egyéb asztalok átsorolása</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-ink-soft">Melyik asztalok?</Label>
              <button
                type="button"
                onClick={() => setSelected(allChecked ? new Set() : new Set(tables.map((t) => String(t.id))))}
                className="text-xs font-semibold text-ink-soft hover:text-ink"
              >
                {allChecked ? 'Egyik sem' : 'Mind'}
              </button>
            </div>
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-paper p-2">
              {tables.map((t) => {
                const checked = selected.has(String(t.id))
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(String(t.id))}
                      className="h-4 w-4 shrink-0 accent-ink-dark"
                    />
                    <span className="text-sm font-medium text-ink">{t.name}</span>
                    <span className="text-xs text-ink-soft">{t.capacity} fő</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-ink-soft">Melyik terembe kerüljenek?</Label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink"
            >
              {rooms.map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => roomId && selected.size > 0 && onAssign([...selected], roomId)}
            disabled={busy || !roomId || selected.size === 0}
            className="w-full h-12 rounded-dav-pill bg-ink-dark text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {busy ? 'Mentés…' : `Átsorolás (${selected.size})`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-white px-[18px] py-4 shadow-dav-card">
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className="mt-1.5 text-[30px] font-light leading-none tracking-[-0.02em] text-ink">{value}</div>
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
    'h-11 rounded-xl bg-paper border-line text-ink'
  const labelClass = 'text-sm font-medium text-ink-soft'

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md bg-white">
        <SheetHeader>
          <SheetTitle>{room ? 'Terem szerkesztése' : 'Új terem'}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className={labelClass}>Terem neve</Label>
            <Input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Terasz" />
          </div>
          <div className="rounded-xl border border-line p-4">
            <ToggleSwitch
              checked={outdoor}
              onChange={setOutdoor}
              label="Kültéri terem"
              description="Terasz, kert vagy egyéb kültéri rész. Alapból beltéri."
            />
          </div>

          <div className="rounded-xl border border-line p-4 space-y-4">
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
            className="w-full h-12 rounded-dav-pill bg-ink-dark text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
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
    'h-11 rounded-xl bg-paper border-line text-ink'
  const labelClass = 'text-sm font-medium text-ink-soft'

  return (
    <Sheet open={!!table} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md bg-white">
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
            <div className="flex h-11 items-center rounded-xl border border-line bg-paper">
              <button
                type="button"
                aria-label="Kevesebb fő"
                onClick={() => setCapacity((c) => Math.max(1, c - 1))}
                disabled={capacity <= 1}
                className="flex h-full w-12 shrink-0 items-center justify-center text-xl font-bold text-ink-soft hover:text-ink disabled:opacity-30 transition-colors"
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
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-center text-base font-bold tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Több fő"
                onClick={() => setCapacity((c) => Math.min(20, c + 1))}
                disabled={capacity >= 20}
                className="flex h-full w-12 shrink-0 items-center justify-center text-xl font-bold text-ink-soft hover:text-ink disabled:opacity-30 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {others.length > 0 && (
            <div className="space-y-1.5">
              <Label className={labelClass}>Összevonható ezekkel</Label>
              <p className="text-xs text-ink-soft2">
                Jelöld be a fizikailag összetolható asztalokat. Nagyobb társaságnál ezeket a rendszer automatikusan
                összevonja.
              </p>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-line divide-y divide-line">
                {others.map((t) => {
                  const checked = combinable.includes(String(t.id))
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleCombinable(String(t.id))}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-paper transition-colors"
                    >
                      <span className="text-sm text-ink">
                        {t.name} <span className="text-ink-soft">· {t.capacity} fő</span>
                      </span>
                      <span
                        className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${
                          checked
                            ? 'bg-ink-dark border-ink-dark'
                            : 'border-line-strong'
                        }`}
                      >
                        {checked && <span className="text-white text-xs leading-none">✓</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              {combinable.length > 0 && (
                <p className="text-xs font-medium text-[#9A8B52]">
                  Összevonva max <strong>{comboCapacity} fő</strong> ülhet le.
                </p>
              )}
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="w-full h-12 rounded-dav-pill bg-ink-dark text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Mentés…' : 'Mentés'}
          </button>

          <button
            onClick={() => { if (table) { onClose(); onRequestDelete(table) } }}
            className="w-full h-11 rounded-dav-pill border border-red-500/30 text-bad hover:bg-red-500/[0.06] font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Asztal törlése
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
