import { CalendarDays, Check, ChevronDown, GripVertical, Minus, PanelsTopLeft, Pencil, Plus, Sparkles, TriangleAlert } from 'lucide-react'
import { Card, CardTitle, Field, FieldRow, IconButton, IconCircle, Input, Meta, OptionCard, Pill, Select } from '@/components/ui-kit'
import { Ring } from './charts'
import { Switch } from '@/components/ui/toggle-switch'
import { TableGlyph } from '@/components/restaurant/TableGlyph'
import { MockSwitch as DesignSwitch } from './MockSwitch'

/* Asztalok — a /design 9.1, 9.2, 9.4, 9.5 és az élő Asztalok oldal is ezeket mutatja. Props nélkül a
 * mintaadattal; élőben az adatokkal és a kezelőkkel. */

/** Egy asztal csempén: a valódi asztal-piktogram (annyi szék, ahány fő), név, férőhely, összevonható pár. Élőben
 *  `onClick` (a szerkesztő); `dragging`: épp húzzák (kiemelve). */
export function TableTile({ n, c, comb, sel = false, off = false, warn, onClick, dragging = false }: {
  n: string
  c: number
  comb?: string
  sel?: boolean
  /** inaktív (nem kínáljuk foglaláskor) — halványan */
  off?: boolean
  /** figyelmeztetés (pl. „Nincs teremben”) — felkiáltójel a sarokban, a felirat a tooltipben */
  warn?: string
  onClick?: () => void
  dragging?: boolean
}) {
  const body = (
    <>
      {/* figyelmeztetés: felkiáltójel a sarokban, rámutatva sötét felirat a csempe fölött */}
      {warn && <span aria-label={warn} className="absolute right-1.5 top-1.5"><IconCircle tone="warn" size="xs" icon={TriangleAlert} /></span>}
      {warn && <span className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full opacity-0 transition-opacity group-hover:opacity-100"><Pill tone="dark" size="sm" className="whitespace-nowrap shadow-ui-float">{warn}</Pill></span>}
      <TableGlyph capacity={c} size={44} />
      <span className="mt-2 text-ui-body text-ui-text">{n}</span>
      <Meta className="text-ui-label">{c} fő{comb ? ` · + ${comb}` : ''}</Meta>
    </>
  )
  const cls = `group relative flex flex-col items-center rounded-ui-inner px-2 py-3 ${sel ? 'bg-ui-yellow' : 'bg-white/70'} ${off ? 'opacity-55' : ''} ${dragging ? 'z-10 scale-105 bg-white shadow-ui-float ring-2 ring-ui-yellow' : ''}`
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} w-full outline-none transition-[background-color,transform,box-shadow] hover:bg-white focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{body}</button>
    : <div className={cls}>{body}</div>
}

/** 9.1: a három szám, az eredeti alacsony szám-kártyákon — jobbra egy kis diagrammal: termek (mini-fánk: beltéri
 *  sötét, kültéri sárga), asztalok (mini-oszlopok férőhely szerint: 2 / 4 / 6 / 8+ fő), összes férőhely (sötét kártyán
 *  mini-gyűrű: a férőhelyek hány %-a van aktív asztalon). */
export function TableCharts({ indoor = 1, outdoor = 1, sizes = [3, 4, 1, 1], seats = 36, activeSeats = 32, seatsCard, className = '' }: { indoor?: number; outdoor?: number; /** asztalok száma: 2 / 4 / 6 / 8+ fős (a 3, 5, 7 a felette lévőhöz) */ sizes?: number[]; seats?: number; activeSeats?: number
  /** a harmadik („Összes férőhely”) kártya helyett — a Beállításokban a férőhely + online kapacitás kártya (16.22) */
  seatsCard?: React.ReactNode; className?: string }) {
  const rooms = indoor + outdoor
  const C = 2 * Math.PI * 16
  const share = rooms ? outdoor / rooms : 0
  const pct = seats ? Math.round((activeSeats / seats) * 100) : 0
  const max = Math.max(1, ...sizes)
  // a Beállításokban a sor magasabb (a kapacitás-kártya miatt) — ott nagyobb grafikonok, hogy kitöltsék a kártyát
  const big = seatsCard ? 'h-24 w-24' : 'h-12 w-12'
  const bigH = seatsCard ? 'h-24' : 'h-12'
  // a Beállításokban (seatsCard) nagyobb fokozatok: cím 15, szám 42, leírás 13 px, tágabb közök — mint a kapacitás-kártya
  const card = (label: string, value: React.ReactNode, sub: string, chart: React.ReactNode, dark = false) => (
    seatsCard
      // a Beállításokban egymás alatt: cím + szám, alatta a grafikon a kártya teljes szélességében (feliratokkal),
      // legalul a leírás — mint a kapacitás-kártyán
      ? <Card tone={dark ? 'dark' : 'glass'} pad="lg" className="flex flex-col">
          <Meta dark={dark} className="text-ui-row">{label}</Meta>
          <span className="mt-3 block text-ui-page font-light leading-none">{value}</span>
          <div className="mt-6">{chart}</div>
          <Meta dark={dark} className="mt-auto pt-5 text-ui-body">{sub}</Meta>
        </Card>
      : <Card tone={dark ? 'dark' : 'glass'} className="flex items-center justify-between gap-3">
          <span className="min-w-0"><Meta dark={dark}>{label}</Meta><span className="mt-1 block text-ui-num font-light leading-none">{value}</span><Meta dark={dark} className="mt-1 text-ui-label">{sub}</Meta></span>
          {chart}
        </Card>
  )
  return (
    <div className={`grid gap-[5px] sm:grid-cols-3 ${className}`}>
      {card('Termek', rooms, seatsCard ? 'beltéri és kültéri termek' : `${indoor} beltéri · ${outdoor} kültéri`, seatsCard ? (
        // a Beállításokban a kit kör-mérője (Statisztikák): a sárga ív a kültéri termek aránya, középen a kültéri darab;
        // mellette a jelmagyarázat
        <div className="flex items-center gap-6">
          <Ring pct={rooms ? Math.round((outdoor / rooms) * 100) : 0} size={120}>
            <span className="text-ui-sub font-light leading-none text-ui-text">{outdoor}</span>
            <span className="mt-1 text-ui-label text-ui-muted">kültéri</span>
          </Ring>
          <span className="space-y-2.5 text-ui-body text-ui-text">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-ui-grey" />Beltéri <span className="text-ui-muted">{indoor}</span></span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-ui-yellow" />Kültéri <span className="text-ui-muted">{outdoor}</span></span>
          </span>
        </div>
      ) : (
        <svg viewBox="0 0 40 40" className={`${big} shrink-0 -rotate-90`}>
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ui-dark)" strokeWidth="6" strokeDasharray={`${(1 - share) * C} ${C}`} />
          {share > 0 && <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ui-yellow)" strokeWidth="6" strokeDasharray={`${share * C} ${C}`} strokeDashoffset={`${-(1 - share) * C}`} />}
        </svg>
      ))}
      {card('Asztalok', sizes.reduce((a, b) => a + b, 0), seatsCard ? 'asztalok férőhely szerint' : '2 · 4 · 6 · 8+ fős', seatsCard ? (
        // a Beállításokban feliratozva: az oszlop fölött hány asztal, alatta hány fős
        <span className="grid w-full grid-cols-4 items-end gap-3" aria-label={`2 fős: ${sizes[0]}, 4 fős: ${sizes[1]}, 6 fős: ${sizes[2]}, 8+ fős: ${sizes[3]}`}>
          {sizes.map((v, i) => (
            <span key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-ui-body text-ui-text">{v}</span>
              <span className="flex h-20 w-full items-end"><span className={`w-full rounded-ui-control ${v === max && v > 0 ? 'bg-ui-yellow' : 'bg-ui-dark'}`} style={{ height: `${v ? Math.max(12, (v / max) * 100) : 6}%` }} /></span>
              <span className="whitespace-nowrap text-ui-label text-ui-muted">{['2', '4', '6', '8+'][i]} fős</span>
            </span>
          ))}
        </span>
      ) : (
        <span className={`flex ${bigH} shrink-0 items-end ${seatsCard ? 'gap-1.5' : 'gap-1'}`} aria-label={`2 fős: ${sizes[0]}, 4 fős: ${sizes[1]}, 6 fős: ${sizes[2]}, 8+ fős: ${sizes[3]}`}>
          {sizes.map((v, i) => <span key={i} title={`${['2', '4', '6', '8+'][i]} fős: ${v}`} className={`${seatsCard ? 'w-3.5' : 'w-2.5'} rounded-full ${v === max ? 'bg-ui-yellow' : 'bg-ui-dark'}`} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />)}
        </span>
      ))}
      {seatsCard ?? card('Összes férőhely', seats, `${activeSeats} aktív asztalon`, (
        <span className={`relative ${big} shrink-0`}>
          <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" className="stroke-white/15" strokeWidth="5" />
            {pct > 0 && <circle cx="20" cy="20" r="16" fill="none" stroke="var(--ui-yellow)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-ui-label">{pct}%</span>
        </span>
      ), true)}
    </div>
  )
}

/** 9.1: egy terem kártyája — név, beltéri / kültéri, szezonális időszak, asztal- és férőhely-szám, szerkesztés, kinyitva
 *  az asztal-csempék és az új asztal csempéje. Élőben `onToggle`, `onEdit`, `onAddTable`, `drag` (a termek sorrendje). */
export function RoomCard({ name, outdoor = false, season, tables, seats, open = false, onToggle, onEdit, onAddTable, handle, dragging = false, online, onOnline, children }: {
  name: string
  outdoor?: boolean
  season?: string | null
  tables: number
  seats: number
  open?: boolean
  onToggle?: () => void
  onEdit?: () => void
  onAddTable?: () => void
  /** élőben: a fogantyú (a termek sorrendje) — a fejlécre kerül */
  handle?: React.HTMLAttributes<HTMLDivElement>
  /** épp húzzák (kiemelve) */
  dragging?: boolean
  /** online foglalható-e a terem (Beállítások › Asztalok & termek, 16.22) — `onOnline` nélkül minta-kapcsoló; `online`
   *  nélkül nincs kapcsoló */
  online?: boolean
  onOnline?: (on: boolean) => void
  children?: React.ReactNode
}) {
  const add = <><Plus className="h-4 w-4" />Asztal</>
  const addCls = 'flex flex-col items-center justify-center rounded-ui-inner border-2 border-dashed border-ui-dark/15 py-3 text-ui-meta text-ui-muted'
  return (
    <Card pad="sm" className={dragging ? 'shadow-ui-float ring-2 ring-ui-yellow' : undefined}>
      <div className={`flex flex-wrap items-center gap-2 px-2 py-1 ${handle ? 'cursor-grab active:cursor-grabbing' : ''}`} {...handle}>
        <GripVertical className="h-4 w-4 text-ui-muted" />
        <CardTitle>{name}</CardTitle>
        <Pill size="sm" tone={outdoor ? 'yellow' : 'cell'}>{outdoor ? 'Kültéri' : 'Beltéri'}</Pill>
        {season && <Pill size="sm" tone="white" icon={CalendarDays}>Szezonális · {season}</Pill>}
        <Meta className="ml-auto">{tables} asztal · {seats} fő</Meta>
        {online !== undefined && (
          // a kapcsoló ne nyissa / húzza a kártyát
          <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1" {...(onOnline ? { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClickCapture: (e: React.MouseEvent) => e.stopPropagation() } : {})}>
            <Meta className="text-ui-label">{online ? 'online foglalható' : 'csak telefonon'}</Meta>
            {onOnline ? <Switch checked={online} onChange={onOnline} ariaLabel={`${name}: online foglalható`} /> : <DesignSwitch defaultOn={online} />}
          </span>
        )}
        {onEdit !== undefined || !onToggle ? <IconButton icon={Pencil} label="Terem szerkesztése" size="sm" onClick={onEdit} /> : null}
        <IconButton icon={ChevronDown} label={open ? 'Összecsukás' : 'Kibontás'} size="sm" className={open ? 'rotate-180' : ''} onClick={onToggle} />
      </div>
      {open && (
        <div className="mt-2 grid gap-1 px-1 pb-1 sm:grid-cols-3 lg:grid-cols-6">
          {children}
          {onAddTable
            ? <button type="button" onClick={onAddTable} className={`${addCls} outline-none transition-colors hover:bg-white/40 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{add}</button>
            : onToggle ? null : <div className={addCls}>{add}</div>}
        </div>
      )}
    </Card>
  )
}

/* ── 9.4: asztal és terem szerkesztése ── */

export type TableFormValue = { name: string; capacity: number; roomId: string; combinable: string[]; active: boolean }
const SAMPLE_TABLE: TableFormValue = { name: 'T3', capacity: 4, roomId: 'b', combinable: ['T4'], active: true }

/** Asztal szerkesztése: fent a piktogram a férőhellyel (és az összevonással) együtt változik; név, terem, férőhely
 *  (−/+ léptető, 1–20 fő), összevonható asztalok (a terem asztalai chipen), aktív.
 *  `stacked`: egy hasábban (mobil). Élőben `value`, `onChange`, `rooms`, `others` (a terem többi asztala: id, név, fő). */
export function TableEditForm({ stacked = false, value, onChange, rooms = [['b', 'Belső terem'], ['t', 'Terasz']], others = [['T1', 'T1', 2], ['T2', 'T2', 2], ['T4', 'T4', 4], ['T5', 'T5', 6], ['T6', 'T6', 8]], className = '' }: {
  stacked?: boolean
  value?: TableFormValue
  onChange?: (v: TableFormValue) => void
  rooms?: [string, string][]
  others?: [string, string, number][]
  className?: string
}) {
  const v = value ?? SAMPLE_TABLE
  const live = !!onChange
  const set = (p: Partial<TableFormValue>) => onChange?.({ ...v, ...p })
  const combo = others.filter(([id]) => v.combinable.includes(id))
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-4 rounded-ui-inner bg-ui-cell p-4">
        <TableGlyph capacity={v.capacity} size={64} />
        <div><div className="text-ui-sub font-light text-ui-text">{v.name || 'Új asztal'}</div><Meta>{v.capacity} fő{combo.length ? ` · összevonva ${combo.map(([, n]) => n).join(', ')}-vel ${v.capacity + combo.reduce((a, [, , c]) => a + c, 0)} fő` : ''}</Meta></div>
      </div>
      <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
        <Field label="Név / szám"><Input value={live ? v.name : undefined} defaultValue={live ? undefined : v.name} placeholder="pl. T1 vagy Ablak melletti" onChange={live ? (e) => set({ name: e.target.value }) : undefined} /></Field>
        <Field label="Terem">
          <Select value={live ? v.roomId : undefined} defaultValue={live ? undefined : v.roomId} onChange={live ? (e) => set({ roomId: e.target.value, combinable: [] }) : undefined}>
            {rooms.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Férőhely">
        {/* bármennyi fő (5 személyes asztal is) — a Létszám-léptető mintája */}
        <span className="flex h-11 items-center gap-1.5">
          <IconButton icon={Minus} label="Kevesebb fő" variant="cell" onClick={live ? () => set({ capacity: Math.max(1, v.capacity - 1) }) : undefined} disabled={live && v.capacity <= 1} />
          <span className="w-16 text-center text-ui-sub font-light text-ui-text">{v.capacity} fő</span>
          <IconButton icon={Plus} label="Több fő" variant="cell" onClick={live ? () => set({ capacity: Math.min(20, v.capacity + 1) }) : undefined} disabled={live && v.capacity >= 20} />
        </span>
      </Field>
      <Field label="Összevonható ezekkel">
        <div className="flex flex-wrap gap-1.5">
          {others.length === 0 && <Meta>Ebben a teremben nincs más asztal.</Meta>}
          {others.map(([id, n]) => {
            const on = v.combinable.includes(id)
            const pill = <Pill tone={on ? 'dark' : 'cell'}>{n}{on && <Check className="h-3.5 w-3.5" />}</Pill>
            return live
              ? <button key={id} type="button" onClick={() => set({ combinable: on ? v.combinable.filter((x) => x !== id) : [...v.combinable, id] })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button>
              : <span key={id}>{pill}</span>
          })}
        </div>
      </Field>
      <FieldRow boxed label="Aktív" hint="Kikapcsolva nem kínáljuk foglaláskor.">{live ? <Switch checked={v.active} onChange={(on) => set({ active: on })} ariaLabel="Aktív" /> : <DesignSwitch />}</FieldRow>
    </div>
  )
}

export type RoomFormValue = { name: string; outdoor: boolean; seasonal: boolean; start: string; end: string }

/** Terem szerkesztése: név, beltéri / kültéri, szezonális (időszakkal — azon kívül nem foglalható). A törlés
 *  figyelmeztetése (hány asztala törlődik) csak a törlés gombra jön fel. Élőben `value`, `onChange`, `dateInput`. */
export function RoomEditForm({ value, onChange, dateInput, className = '' }: { value?: RoomFormValue; onChange?: (v: RoomFormValue) => void; dateInput?: (v: string, set: (d: string) => void) => React.ReactNode; className?: string }) {
  const v = value ?? { name: 'Terasz', outdoor: true, seasonal: true, start: '05. 01.', end: '09. 30.' }
  const live = !!onChange
  const set = (p: Partial<RoomFormValue>) => onChange?.({ ...v, ...p })
  const kind = (outdoor: boolean, icon: typeof Sparkles, title: string, sub?: string) => {
    // egyforma magas kártyák (a felirat nélküli is kitölti a sort)
    const c = <OptionCard stacked icon={icon} title={title} selected={v.outdoor === outdoor} className="h-full">{sub}</OptionCard>
    return live ? <button key={title} type="button" onClick={() => set({ outdoor })} className="block h-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{c}</button> : <div key={title} className="h-full">{c}</div>
  }
  return (
    <div className={`space-y-4 ${className}`}>
      <Field label="Terem neve"><Input value={live ? v.name : undefined} defaultValue={live ? undefined : v.name} placeholder="pl. Terasz" onChange={live ? (e) => set({ name: e.target.value }) : undefined} /></Field>
      <div className="grid grid-cols-2 gap-1.5">{kind(false, PanelsTopLeft, 'Beltéri')}{kind(true, Sparkles, 'Kültéri', 'terasz, kert')}</div>
      <FieldRow boxed label="Szezonális" hint="Csak az időszakban foglalható.">{live ? <Switch checked={v.seasonal} onChange={(on) => set({ seasonal: on })} ariaLabel="Szezonális" /> : <DesignSwitch />}</FieldRow>
      {v.seasonal && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kezdete">{dateInput ? dateInput(v.start, (d) => set({ start: d })) : <Input defaultValue={v.start} />}</Field>
          <Field label="Vége">{dateInput ? dateInput(v.end, (d) => set({ end: d })) : <Input defaultValue={v.end} />}</Field>
        </div>
      )}
    </div>
  )
}

/* ── 9.5: mobil ── */

/** Mobil: termenként az asztal-csempék három oszlopban. Élőben `meta`, `rooms` (név + csempék). */
export function MobileTablesList({ meta = '2 terem · 9 asztal · 36 hely', rooms, title = 'Asztalok' }: {
  meta?: string
  /** `online` + `onOnline`: a terem online foglalható-e (Beállítások › Asztalok & termek, 16.22) — `online` nélkül nincs kapcsoló */
  rooms?: { key: string; name: string; tables: React.ReactNode[]; online?: boolean; onOnline?: (on: boolean) => void; onAddTable?: () => void }[]
  /** a nagy cím (a Beállításokban a lap fejléce adja: null) */
  title?: string | null
}) {
  const sample: [string, [string, number, string?][]][] = [['Belső terem', [['T1', 2], ['T2', 2], ['T3', 4, 'T4'], ['T4', 4, 'T3'], ['T5', 6], ['T6', 8]]], ['Terasz', [['K1', 4], ['K2', 2], ['K3', 4]]]]
  type Row = { key: string; name: string; tables: React.ReactNode[]; online?: boolean; onOnline?: (on: boolean) => void; onAddTable?: () => void }
  const list: Row[] = rooms ?? sample.map(([r, ts]) => ({ key: r, name: r, tables: ts.map(([n, c, comb]) => <TableTile key={n} n={n} c={c} comb={comb} sel={n === 'T3'} />) }))
  return (
    <>
      {title && <div className="mt-5 text-ui-num font-light leading-none text-ui-text">{title}</div>}
      <Meta className={title ? 'mt-1' : ''}>{meta}</Meta>
      {list.map((r) => (
        <Card key={r.key} pad="sm" className="mt-3">
          <div className="flex items-center justify-between px-1 pb-2"><span className="text-ui-row text-ui-text">{r.name}</span><Meta>{r.tables.length} asztal</Meta></div>
          {r.online !== undefined && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-ui-inner bg-white px-3 py-2">
              <Meta className="text-ui-body">{r.online ? 'Online foglalható' : 'Csak telefonon'}</Meta>
              {r.onOnline ? <Switch checked={r.online} onChange={r.onOnline} ariaLabel={`${r.name}: online foglalható`} /> : <DesignSwitch defaultOn={r.online} />}
            </div>
          )}
          <div className="grid grid-cols-3 gap-1">
            {r.tables}
            {/* új asztal ebbe a terembe — mint desktopon a terem-kártya utolsó csempéje */}
            {r.onAddTable && <button type="button" onClick={r.onAddTable} className="flex flex-col items-center justify-center rounded-ui-inner border-2 border-dashed border-ui-dark/15 py-3 text-ui-meta text-ui-muted outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Plus className="h-4 w-4" />Asztal</button>}
          </div>
        </Card>
      ))}
    </>
  )
}

/* ── 16.22: Beállítások › Asztalok & termek (étterem) — a szerkesztő és az online kapacitás egy helyen ── */

const PCTS = [100, 80, 60]

/** Az összevont téma fejléce: balra a számok (termek, asztalok, férőhely-méretek), jobbra a sötét kártya — férőhely
 *  összesen, ebből ma online, és hogy mennyit adunk ki online (a többit a beesőknek tartjuk). Élőben `pct` + `onPct`. */
export function TablesCapacityCard({ seats = 58, meta = '14 asztal · 3 terem', onlineSeats = 46, pct = 80, onPct, className = '' }: {
  seats?: number; meta?: string; onlineSeats?: number; pct?: number; onPct?: (pct: number) => void; className?: string
}) {
  const opts = PCTS.includes(pct) ? PCTS : [...PCTS, pct].sort((a, b) => b - a)
  return (
    <Card tone="dark" pad="lg" className={`flex flex-col ${className}`}>
      <Meta dark className="text-ui-row">Férőhely összesen</Meta>
      <div className="mt-3 text-ui-page font-light leading-none">{seats} fő</div>
      <Meta dark className="mt-3 text-ui-body">{meta} · online most {onlineSeats} fő</Meta>
      <div className="mt-auto pt-6">
        <Meta dark className="mb-2.5 text-ui-body">Online kiadható</Meta>
        <div className="flex flex-wrap gap-1">
          {opts.map((p) => {
            const pill = <Pill size="sm" tone={p === pct ? 'yellow' : 'onDark'}>{p === 100 ? 'Mind' : `${p}%`}</Pill>
            return onPct ? <button key={p} type="button" onClick={() => onPct(p)} className="rounded-full outline-none ui-press focus-visible:ring-2 focus-visible:ring-white/40">{pill}</button> : <span key={p}>{pill}</span>
          })}
        </div>
      </div>
    </Card>
  )
}
