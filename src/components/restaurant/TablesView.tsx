'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PanelsTopLeft, Plus, Undo2 } from 'lucide-react'
import { Button, EmptyState, FIELD, Meta, Note, OptionCard, PageHead, Select } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { MobileTablesList, RoomCard, RoomEditForm, TableCharts, TableEditForm, TableTile, TablesCapacityCard, type RoomFormValue, type TableFormValue } from '@/components/blocks/tables'
import { MONTHS_SHORT } from '@/lib/schedule'
import { useSortable } from '@/lib/useSortable'
import { motion } from 'framer-motion'

export interface RoomVM { id: string; name: string; outdoor: boolean; seasonal: boolean; start: string | null; end: string | null; sort: number; /** online foglalható (Beállítások-módban a kapcsolóhoz) */ online?: boolean }
export interface TableVM { id: string; name: string; capacity: number; roomId: string | null; combinable: string[]; active: boolean; sort: number }

interface Props {
  restaurantId: string
  rooms: RoomVM[]
  tables: TableVM[]
  /** az étterem-sablonok (az üres állapothoz): id, név, terem-szám, asztal-idő */
  templates: { id: string; label: string; rooms: number; turn: number }[]
  canManage?: boolean
  /** Beállítások › Asztalok & termek (design 16.22): a témába ágyazva — saját cím-sor, mellette az online kapacitás
   *  (`pct`, mentés az `apiBase`-re), a termeken az online kapcsoló. Nélküle a régi önálló oldal. */
  capacity?: { pct: number; apiBase: string }
}


/** Egy terem asztal-csempéi áthúzható sorrendben: a húzott kiemelve, a többi animálva csúszik a helyére. */
function SortableTiles({ tables, render, onCommit }: { tables: TableVM[]; render: (t: TableVM, dragging: boolean) => React.ReactNode; onCommit: (ids: string[]) => void }) {
  const { order, dragging, bind } = useSortable(tables.map((t) => t.id), onCommit)
  return <>{order.map((id) => tables.find((t) => t.id === id)).filter((t): t is TableVM => !!t).map((t) => (
    <motion.div key={t.id} layout transition={{ type: 'spring', stiffness: 500, damping: 40 }} {...bind(t.id)}>{render(t, dragging === t.id)}</motion.div>
  ))}</>
}

const dayLabel = (d: string | null) => { if (!d) return '—'; const [, m, dd] = d.split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${dd}.` }
const seasonOf = (r: RoomVM) => (r.seasonal && r.start && r.end ? `${dayLabel(r.start)} – ${dayLabel(r.end)}` : null)
const num = (id: string) => (/^\d+$/.test(id) ? Number(id) : id)

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/**
 * Asztalok (design 9.1–9.5, étterem): a számok (termek, asztalok, férőhely), termenként egy kártya (beltéri / kültéri,
 * szezon, kinyitva az asztal-csempék), a terem nélküli asztalok figyelmeztetése és átsorolása, asztal- és terem-szerkesztő,
 * üres állapot az étterem-sablonokkal; mobilon termenként a csempék, koppintásra alulról a szerkesztő.
 */
export function TablesView({ restaurantId, rooms: initialRooms, tables, templates, canManage = false, capacity }: Props) {
  const router = useRouter()
  const refresh = () => router.refresh()
  const [rooms, setRooms] = useState(() => [...initialRooms].sort((a, b) => a.sort - b.sort))
  useEffect(() => { setRooms([...initialRooms].sort((a, b) => a.sort - b.sort)) }, [initialRooms])
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const upd = () => setDesktop(mq.matches)
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])

  // a termek nyitott / csukott állapota (böngészőnként megjegyezve)
  const KEY = `tables-collapsed-${restaurantId}`
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  useEffect(() => { try { setCollapsed(new Set(JSON.parse(localStorage.getItem(KEY) || '[]') as string[])) } catch { /* nincs tárhely */ } }, [KEY])
  const toggle = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    try { localStorage.setItem(KEY, JSON.stringify([...next])) } catch { /* nincs tárhely */ }
    return next
  })

  const byRoom = (roomId: string | null) => tables.filter((t) => t.roomId === roomId).sort((a, b) => a.sort - b.sort)
  const orphans = tables.filter((t) => !t.roomId || !rooms.some((r) => r.id === t.roomId))
  const nameOf = (id: string) => tables.find((t) => t.id === id)?.name ?? ''
  const seats = tables.reduce((a, t) => a + t.capacity, 0)

  // ── online kapacitás (Beállítások-mód): termenként online foglalható-e, és hány %-ot adunk ki — azonnal ment ──
  const [pct, setPct] = useState(capacity?.pct ?? 100)
  useEffect(() => { if (capacity) setPct(capacity.pct) }, [capacity?.pct]) // eslint-disable-line react-hooks/exhaustive-deps
  const setRoomOnline = async (id: string, on: boolean) => {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, online: on } : r)))
    try { await api(`/api/rooms/${id}`, 'PATCH', { online_bookable: on }); toast.success(on ? 'Online foglalható' : 'Csak telefonon foglalható') } catch {
      setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, online: !on } : r))); toast.error('Nem sikerült menteni')
    }
  }
  const savePct = async (p: number) => {
    if (!capacity) return
    const prev = pct
    setPct(p)
    try { await api(capacity.apiBase, 'PATCH', { online_capacity_pct: p }); toast.success(p === 100 ? 'Online: a teljes kapacitás' : `Online: a kapacitás ${p}%-a`) } catch { setPct(prev); toast.error('Nem sikerült menteni') }
  }
  const onlineSeats = Math.floor((tables.filter((t) => t.active && (!t.roomId || rooms.find((r) => r.id === t.roomId)?.online !== false)).reduce((a, t) => a + t.capacity, 0) * pct) / 100)
  const capacityCard = capacity ? (
    <TablesCapacityCard seats={seats} meta={`${tables.length} asztal · ${rooms.length} terem`} onlineSeats={onlineSeats} pct={pct} onPct={canManage ? (p) => void savePct(p) : undefined} />
  ) : null

  // ── sorrend (áthúzás, desktopon): elengedéskor menti ──
  const commitTables = async (ids: string[]) => {
    try { await Promise.all(ids.map((id, i) => (tables.find((t) => t.id === id)?.sort === i + 1 ? null : api(`/api/tables/${id}`, 'PATCH', { sort_order: i + 1 })))); refresh() } catch { toast.error('A sorrend mentése nem sikerült') }
  }
  const commitRooms = async (ids: string[]) => {
    setRooms(ids.map((id) => rooms.find((r) => r.id === id)!).filter(Boolean))
    try { await Promise.all(ids.map((id, i) => (rooms.find((r) => r.id === id)?.sort === i + 1 ? null : api(`/api/rooms/${id}`, 'PATCH', { sort_order: i + 1 })))); refresh() } catch { toast.error('A sorrend mentése nem sikerült') }
  }
  const roomSort = useSortable(rooms.map((r) => r.id), (ids) => void commitRooms(ids))

  // ── asztal szerkesztése (9.4) ──
  const [tEdit, setTEdit] = useState<{ id: string | null; v: TableFormValue } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)
  const openTable = (t: TableVM) => setTEdit({ id: t.id, v: { name: t.name, capacity: t.capacity, roomId: t.roomId ?? rooms[0]?.id ?? '', combinable: [...new Set(t.combinable)], active: t.active } })
  const newTable = (roomId?: string) => {
    const rid = roomId ?? rooms[0]?.id ?? ''
    setTEdit({ id: null, v: { name: String(byRoom(rid).length + 1), capacity: 2, roomId: rid, combinable: [], active: true } })
  }
  useEffect(() => {
    const on = () => newTable()
    window.addEventListener('davelopment:open-tables-add', on)
    return () => window.removeEventListener('davelopment:open-tables-add', on)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const saveTable = async () => {
    if (!tEdit) return
    if (!tEdit.v.name.trim()) { toast.error('Add meg az asztal nevét'); return }
    setBusy(true)
    try {
      const body = { name: tEdit.v.name.trim(), capacity: tEdit.v.capacity, room: tEdit.v.roomId ? num(tEdit.v.roomId) : null, combinable_with: tEdit.v.combinable.map(num), is_active: tEdit.v.active }
      const id = tEdit.id ?? String((await api('/api/tables', 'POST', { ...body, restaurant: num(restaurantId), sort_order: byRoom(tEdit.v.roomId).length + 1 })).doc.id)
      if (tEdit.id) await api(`/api/tables/${id}`, 'PATCH', body)
      // az összevonás kölcsönös: a másik asztalon is be- / kikerül
      const before = new Set(tables.find((t) => t.id === tEdit.id)?.combinable ?? [])
      const after = new Set(tEdit.v.combinable)
      await Promise.all([
        ...[...after].filter((x) => !before.has(x)).map((x) => { const o = tables.find((t) => t.id === x); return o ? api(`/api/tables/${x}`, 'PATCH', { combinable_with: [...new Set([...o.combinable, id])].map(num) }) : null }),
        ...[...before].filter((x) => !after.has(x)).map((x) => { const o = tables.find((t) => t.id === x); return o ? api(`/api/tables/${x}`, 'PATCH', { combinable_with: o.combinable.filter((c) => c !== id).map(num) }) : null }),
      ])
      toast.success(tEdit.id ? 'Asztal mentve' : 'Asztal hozzáadva')
      setTEdit(null)
      refresh()
    } catch { toast.error('Nem sikerült menteni') }
    setBusy(false)
  }
  const deleteTable = (id: string) => setConfirm({
    title: 'Asztal törlése', description: `${nameOf(id)} — ez nem vonható vissza.`,
    onConfirm: async () => {
      setBusy(true)
      try { await api(`/api/tables/${id}`, 'DELETE'); toast.success('Asztal törölve'); setTEdit(null); refresh() } catch { toast.error('Nem sikerült törölni') }
      setBusy(false); setConfirm(null)
    },
  })

  // ── terem szerkesztése (9.4) ──
  const [rEdit, setREdit] = useState<{ id: string | null; v: RoomFormValue } | null>(null)
  const openRoom = (r: RoomVM) => setREdit({ id: r.id, v: { name: r.name, outdoor: r.outdoor, seasonal: r.seasonal, start: r.start ?? '', end: r.end ?? '' } })
  const newRoom = () => setREdit({ id: null, v: { name: '', outdoor: false, seasonal: false, start: '', end: '' } })
  const doSaveRoom = async () => {
    if (!rEdit) return
    setBusy(true)
    try {
      const body = { name: rEdit.v.name.trim(), is_outdoor: rEdit.v.outdoor, seasonal: rEdit.v.seasonal, season_start: rEdit.v.seasonal ? rEdit.v.start || null : null, season_end: rEdit.v.seasonal ? rEdit.v.end || null : null }
      if (rEdit.id) await api(`/api/rooms/${rEdit.id}`, 'PATCH', body)
      else await api('/api/rooms', 'POST', { ...body, restaurant: num(restaurantId), sort_order: rooms.length + 1 })
      toast.success(rEdit.id ? 'Terem mentve' : 'Terem hozzáadva')
      setREdit(null)
      refresh()
    } catch { toast.error('Nem sikerült menteni') }
    setBusy(false)
  }
  // szezonális teremnél: a jövőbeli foglalások közül hány esik az időszakon kívülre (azok megmaradnak — szólunk)
  const saveRoom = async () => {
    if (!rEdit) return
    if (!rEdit.v.name.trim()) { toast.error('Add meg a terem nevét'); return }
    if (rEdit.id && rEdit.v.seasonal && rEdit.v.start && rEdit.v.end) {
      const ids = new Set(byRoom(rEdit.id).map((t) => t.id))
      const today = new Date().toISOString().slice(0, 10)
      const res = ids.size ? await fetch(`/api/reservations?where[date][greater_than_equal]=${today}&where[status][in]=pending,confirmed,seated&limit=500&depth=0`, { credentials: 'include' }).catch(() => null) : null
      const docs: { date: string; tables?: (string | number | { id: string | number })[] }[] = res?.ok ? (await res.json()).docs ?? [] : []
      const md = (d: string) => d.slice(5, 10)
      const s = md(rEdit.v.start), e = md(rEdit.v.end)
      const inSeason = (d: string) => (s <= e ? md(d) >= s && md(d) <= e : md(d) >= s || md(d) <= e)
      const n = docs.filter((r) => (r.tables ?? []).some((t) => ids.has(String(typeof t === 'object' ? t.id : t))) && !inSeason(r.date)).length
      if (n > 0) {
        setConfirm({ title: 'Szezonon kívüli foglalások', description: `${n} jövőbeli foglalás esik a megadott szezonon kívülre ebben a teremben. Ezek megmaradnak — kezeld őket külön (áthelyezés, értesítés). Folytatod a mentést?`, onConfirm: () => { setConfirm(null); void doSaveRoom() } })
        return
      }
    }
    void doSaveRoom()
  }
  const deleteRoom = (id: string) => setConfirm({
    title: 'Terem törlése', description: `A terem és a(z) ${byRoom(id).length} asztala is törlődik — ez nem vonható vissza.`,
    onConfirm: async () => {
      setBusy(true)
      try { for (const t of byRoom(id)) await api(`/api/tables/${t.id}`, 'DELETE'); await api(`/api/rooms/${id}`, 'DELETE'); toast.success('Terem törölve'); setREdit(null); refresh() } catch { toast.error('Nem sikerült törölni') }
      setBusy(false); setConfirm(null)
    },
  })

  // ── terem nélküli asztalok átsorolása ──
  const [orphanOpen, setOrphanOpen] = useState(false)
  const [orphanRoom, setOrphanRoom] = useState('')
  const assignOrphans = async () => {
    if (!orphanRoom) return
    setBusy(true)
    try { for (const t of orphans) await api(`/api/tables/${t.id}`, 'PATCH', { room: num(orphanRoom) }); toast.success('Átsorolva'); setOrphanOpen(false); refresh() } catch { toast.error('Nem sikerült') }
    setBusy(false)
  }
  const deleteOrphans = () => setConfirm({
    title: 'Asztalok törlése', description: `${orphans.length} terem nélküli asztal törlődik — ez nem vonható vissza.`,
    onConfirm: async () => {
      setBusy(true)
      try { for (const t of orphans) await api(`/api/tables/${t.id}`, 'DELETE'); toast.success('Törölve'); setOrphanOpen(false); refresh() } catch { toast.error('Nem sikerült') }
      setBusy(false); setConfirm(null)
    },
  })

  // ── üres állapot (9.2): étterem-sablon ──
  const [tpl, setTpl] = useState(templates[0]?.id ?? '')
  const [seeding, setSeeding] = useState(false)
  const seed = async () => {
    setSeeding(true)
    try { await api('/api/restaurant/seed-template', 'POST', { restaurantId: num(restaurantId), templateId: tpl }); toast.success('Betöltve — írd át nyugodtan'); refresh() } catch { toast.error('Nem sikerült betölteni') }
    setSeeding(false)
  }

  const tile = (t: TableVM, dragging = false) => (
    <TableTile key={t.id} n={t.name} c={t.capacity} comb={[...new Set(t.combinable.filter((c) => c !== t.id).map(nameOf).filter(Boolean))].join(', ') || undefined} off={!t.active} dragging={dragging}
      warn={orphans.includes(t) ? 'Nincs teremben — kattints, és válassz neki termet' : undefined} onClick={() => openTable(t)} />
  )
  const actions = canManage ? <span className="flex gap-1.5"><Button variant="glass" icon={Plus} onClick={newRoom}>Terem</Button>{rooms.length > 0 && <Button variant="yellow" icon={Plus} onClick={() => newTable()}>Asztal</Button>}</span> : undefined
  const head = capacity
    // Beállítások-mód: a téma cím-sora (mint a többi témáé), a gombok mellette
    ? <div className="mb-[5px] flex flex-wrap items-center justify-between gap-2 px-1 pt-1"><span className="text-ui-sub font-light text-ui-text max-lg:hidden">Asztalok & termek</span>{actions}</div>
    : <PageHead title="Asztalok" actions={actions && <span className="max-lg:hidden">{actions}</span>} />
  const dateInput = (v: string, set: (d: string) => void) => (
    <DatePickerPopover value={v || new Date().toISOString().slice(0, 10)} onChange={set} triggerClassName={`${FIELD} h-11 w-full text-left`}>{v ? dayLabel(v) : <span className="text-ui-muted">—</span>}</DatePickerPopover>
  )

  // a szerkesztő: az egységes ablak (desktopon középen, mobilon alulról), alul a gombok
  const editor = (title: string, subtitle: string | undefined, body: React.ReactNode, onSave: () => void, onClose: () => void, del?: { label: string; onClick: () => void }) => (
    <PopupModal open onClose={onClose} title={title} subtitle={subtitle}
      footer={<>{canManage && del && <Button variant="bad" className="mr-auto" onClick={del.onClick}>{del.label}</Button>}<Button variant="cell" onClick={onClose}>Mégse</Button>{canManage && <Button onClick={onSave} loading={busy}>Mentés</Button>}</>}>
      {body}
    </PopupModal>
  )

  return (
    <div className={capacity ? '' : 'p-4 lg:p-0'}>
      {rooms.length === 0 && tables.length === 0 ? (
        <>
          {head}
          <EmptyState icon={PanelsTopLeft} title="Még nincs asztalod" action={canManage ? (
            <span className="flex flex-col items-center gap-3">
              <span className="grid w-full max-w-[560px] grid-cols-2 gap-1.5">
                {templates.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTpl(t.id)} className="block rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                    <OptionCard radio title={t.label} selected={tpl === t.id}>{t.rooms ? `${t.rooms} terem` : 'egy főszám'} · {t.turn} perces asztal-idő</OptionCard>
                  </button>
                ))}
              </span>
              <span className="flex gap-1.5"><Button icon={Undo2} onClick={seed} loading={seeding}>Sablon betöltése</Button><Button variant="glass" icon={Plus} onClick={newRoom}>Új terem</Button></span>
            </span>
          ) : undefined}>
            Válassz egy kiosztást — a termeket és az asztalokat létrehozzuk, utána bármit átírhatsz. A foglaló ezekből választ asztalt.
          </EmptyState>
        </>
      ) : (
        <>
          <div className="max-lg:hidden">
            {head}
            {/* Beállítások-módban a harmadik kártya a férőhely + online kapacitás (nem kétszer ugyanaz a szám) */}
            <TableCharts indoor={rooms.filter((r) => !r.outdoor).length} outdoor={rooms.filter((r) => r.outdoor).length} seats={seats} seatsCard={capacityCard ?? undefined}
              activeSeats={tables.filter((t) => t.active).reduce((x, t) => x + t.capacity, 0)}
              sizes={[tables.filter((t) => t.capacity <= 2).length, tables.filter((t) => t.capacity > 2 && t.capacity <= 4).length, tables.filter((t) => t.capacity > 4 && t.capacity <= 6).length, tables.filter((t) => t.capacity > 6).length]} />
            <div className="mt-[5px] space-y-[5px]">
              {roomSort.order.map((id) => rooms.find((r) => r.id === id)).filter((r): r is RoomVM => !!r).map((r) => {
                const ts = byRoom(r.id)
                return (
                  // a terem a fejlécéről húzható (az asztalok saját magukban); a sorrend-felismeréshez az egész kártya jelölve
                  <motion.div key={r.id} layout transition={{ type: 'spring', stiffness: 500, damping: 40 }} data-sort-id={r.id}>
                    <RoomCard name={r.name} outdoor={r.outdoor} season={seasonOf(r)} tables={ts.length} seats={ts.reduce((a, t) => a + t.capacity, 0)}
                      open={!collapsed.has(r.id)} onToggle={() => toggle(r.id)} onEdit={canManage ? () => openRoom(r) : undefined} onAddTable={canManage ? () => newTable(r.id) : undefined}
                      handle={canManage ? (({ onPointerDown, onClickCapture }) => ({ onPointerDown, onClickCapture }))(roomSort.bind(r.id)) : undefined} dragging={roomSort.dragging === r.id}
                      online={capacity ? r.online !== false : undefined} onOnline={capacity && canManage ? (on) => void setRoomOnline(r.id, on) : undefined}>
                      {canManage ? <SortableTiles tables={ts} render={tile} onCommit={(ids) => void commitTables(ids)} /> : ts.map((t) => tile(t))}
                    </RoomCard>
                  </motion.div>
                )
              })}
              {/* a terem nélküli asztalok: felkiáltójellel, kattintásra a szerkesztő (ott választható terem) */}
              {orphans.length > 0 && (
                <RoomCard name="Egyéb" tables={orphans.length} seats={orphans.reduce((x, t) => x + t.capacity, 0)} open={!collapsed.has('__orphans__')} onToggle={() => toggle('__orphans__')}>
                  {orphans.map((t) => tile(t))}
                </RoomCard>
              )}
              {orphans.length > 0 && (
                <Note warn>{orphans.length} asztal nincs teremben (Egyéb) — rendezd be egy terembe, vagy töröld. {canManage && rooms.length > 0 && <button type="button" onClick={() => { setOrphanRoom(rooms[0].id); setOrphanOpen(true) }} className="underline underline-offset-4">Átsorolás</button>}</Note>
              )}
            </div>
          </div>
          <div className="lg:hidden">
            {/* mobilon is: új terem / új asztal (a régi oldal mobil-fejlécének „Új asztal” gombja helyett) */}
            {actions && <div className="mb-3 flex justify-end">{actions}</div>}
            {capacityCard && <div className="mb-3">{capacityCard}</div>}
            <MobileTablesList meta={`${rooms.length} terem · ${tables.length} asztal · ${seats} hely`} title={capacity ? null : 'Asztalok'}
              rooms={[...rooms.map((r) => ({ key: r.id, name: r.name, tables: byRoom(r.id).map((t) => tile(t)), onAddTable: canManage ? () => newTable(r.id) : undefined,
                // Beállítások-mód: a terem online kapcsolója mobilon is (mint desktopon a kártya fejlécében)
                ...(capacity ? { online: r.online !== false, onOnline: canManage ? (on: boolean) => void setRoomOnline(r.id, on) : undefined } : {}) })),
                ...(orphans.length ? [{ key: '__orphans__', name: 'Egyéb', tables: orphans.map((t) => tile(t)) }] : [])]} />
            {orphans.length > 0 && <Note warn className="mt-3">{orphans.length} asztal nincs teremben (Egyéb).</Note>}
          </div>
        </>
      )}

      {tEdit && editor(
        tEdit.v.name ? `${tEdit.v.name} asztal` : 'Új asztal', rooms.find((r) => r.id === tEdit.v.roomId)?.name,
        <TableEditForm stacked={!desktop} value={tEdit.v} onChange={(v) => setTEdit({ ...tEdit, v })} rooms={rooms.map((r) => [r.id, r.name])}
          others={byRoom(tEdit.v.roomId).filter((t) => t.id !== tEdit.id).map((t) => [t.id, t.name, t.capacity])} />,
        saveTable, () => setTEdit(null), tEdit.id ? { label: 'Törlés', onClick: () => deleteTable(tEdit.id!) } : undefined,
      )}
      {rEdit && editor(
        rEdit.v.name || 'Új terem', rEdit.id ? `${byRoom(rEdit.id).length} asztal · ${byRoom(rEdit.id).reduce((a, t) => a + t.capacity, 0)} fő` : undefined,
        <RoomEditForm value={rEdit.v} onChange={(v) => setREdit({ ...rEdit, v })} dateInput={dateInput} />,
        saveRoom, () => setREdit(null), rEdit.id ? { label: 'Terem törlése', onClick: () => deleteRoom(rEdit.id!) } : undefined,
      )}
      {orphanOpen && editor(
        'Átsorolás', `${orphans.length} terem nélküli asztal`,
        <div className="space-y-3">
          <Meta>{orphans.map((t) => t.name).join(', ')}</Meta>
          <Select value={orphanRoom} onChange={(e) => setOrphanRoom(e.target.value)} aria-label="Terem">{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        </div>,
        assignOrphans, () => setOrphanOpen(false), { label: 'Törlés', onClick: deleteOrphans },
      )}
      <ConfirmDialog open={!!confirm} title={confirm?.title ?? ''} description={confirm?.description} confirmLabel="Igen" busy={busy} onConfirm={() => confirm?.onConfirm()} onCancel={() => setConfirm(null)} zIndexClass="z-[100]" />
    </div>
  )
}
