import { Bell, Briefcase, ChevronLeft, ChevronRight, Wallet, Cake, CalendarDays, Check, Heart, Link2, Mail, Minus, MoreHorizontal, Plus, UserRound, WifiOff, Wine, X } from 'lucide-react'
import { Avatar, Button, Card, FieldRow, IconButton, IconCircle, Input, ListRow, Meta, Note, OptionCard, Panel, Pill, Segmented, StatusPill, Toast, blockTone, MarqueeText } from '@/components/ui-kit'

/* Összetett, „élő kinézetű” foglalás-darabok a kit elemeiből — EGY helyen. A /design oldal és a landing
 * (funkció-oldalak képei helyett) is ezeket mutatja, így a kettő nem tud eltérni. Csak megjelenítés, adat nélkül. */

/** Étterem: a foglalás alkalma — ikon a blokkon, a lista-soron és a jelmagyarázatban. */
export const OCC = { szulinap: { icon: Cake, l: 'Születésnap' }, evfordulo: { icon: Heart, l: 'Évforduló' }, ceges: { icon: Briefcase, l: 'Céges' }, randi: { icon: Wine, l: 'Randi' } } as const
export type Occ = keyof typeof OCC
export const OccBadge = ({ occ }: { occ: Occ }) => <span title={OCC[occ].l}><IconCircle tone="white" size="xs" icon={OCC[occ].icon} /></span>

/** Egy foglalás adatai (megnyitott foglalás 6.7, popup 6.8 desktop és mobil): szolgáltatás-sor avatarral és árral,
 *  alatta címke–érték sorok. `ok`: zöld érték (pl. fizetett előleg). */
export function BookingFacts({ service, detail, price, who = 'viktoria', img, name, rows, ok = [], compact = false, className = '' }: { service: string; detail: string; price: string; who?: string; /** élő adat: a munkatárs képe és neve (a monogramhoz) — a `who` mintafotó helyett */ img?: string | null; name?: string; rows: [string, string][]; ok?: string[]; compact?: boolean; className?: string }) {
  const src = img !== undefined ? img : `/landing/funkciok/csapat/avatar/${who}.webp`
  return (
    <div className={className}>
      <ListRow filled className="bg-ui-cell" leading={<Avatar size={compact ? 'sm' : 'md'} src={src} name={name} />} title={service} meta={detail} trailing={<span className={`${compact ? 'text-ui-body' : 'text-ui-title'} font-light text-ui-text`}>{price}</span>} />
      <div className="mt-1">
        {rows.map(([k, v]) => (
          <ListRow key={k} className="px-0" title={<span className="text-ui-muted">{k}</span>} trailing={<MarqueeText className={`max-w-[220px] text-ui-body ${ok.includes(k) ? 'text-ui-ok' : 'text-ui-text'}`}>{v}</MarqueeText>} />
        ))}
      </div>
    </div>
  )
}

/** Blokk az idővonalon — foglalás (munkatárs- vagy asztal-sor) és műszak is ez: két sor (név / idő, alatta
 *  szolgáltatás / létszám / típus), az állapot színével, a sáv teljes magasságában (h-14 sávban 48px). */
export function TimelineBlock({ left, width, t, d, st, occ, children }: { left: number; width: number; t: string; d: string; st: string; occ?: Occ; children?: React.ReactNode }) {
  return (
    <span className={`absolute inset-y-1 flex items-center justify-between gap-2 overflow-hidden rounded-ui-control px-2.5 ${blockTone(st)}`} style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}>
      <span className="min-w-0"><MarqueeText className="text-ui-meta font-medium">{t}</MarqueeText><MarqueeText className="text-ui-label opacity-60">{d}</MarqueeText></span>
      {occ && <OccBadge occ={occ} />}
      {children}
    </span>
  )
}

export type GridBlock = { s: number; e: number; t: string; d: string; st: string; extra?: React.ReactNode }
/** Egy nap idővonala (desktop): fent az órák, soronként címke + csíkos sáv a blokkokkal, pontozott óra-vonalak,
 *  sárga „most” vonal időpill-lel, alul jelmagyarázat. A Foglalások (6.1) és a Naptár napi nézete (11.2.1) is ez.
 *  `overlay`: a sávra rajzolt plusz elem (pl. áthúzás), megkapja az óra → % függvényt. */
export function DayGrid({ h0, h1, now, nowLabel, rows, legend, className = '' }: { h0: number; h1: number; now?: number; nowLabel?: string; rows: { key: string; label: React.ReactNode; blocks: GridBlock[]; overlay?: (pct: (h: number) => number) => React.ReactNode }[]; legend: React.ReactNode; className?: string }) {
  const pct = (h: number) => ((h - h0) / (h1 - h0)) * 100
  return (
    <Card className={`overflow-x-auto ${className}`}>
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[150px_1fr] text-ui-label text-ui-muted">
          <span />
          <div className="relative h-6">{Array.from({ length: h1 - h0 + 1 }, (_, i) => <span key={i} className="absolute -translate-x-1/2" style={{ left: `${pct(h0 + i)}%` }}>{String((h0 + i) % 24).padStart(2, '0')}:00</span>)}</div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-[150px] right-0">
            {Array.from({ length: h1 - h0 + 1 }, (_, i) => <span key={i} className="absolute inset-y-0 border-l border-dotted border-ui-divider" style={{ left: `${pct(h0 + i)}%` }} />)}
            {now !== undefined && <span className="absolute inset-y-0 z-20 border-l-2 border-ui-yellow" style={{ left: `${pct(now)}%` }}><span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-ui-yellow" />{nowLabel && <Pill tone="yellow" size="sm" className="absolute -top-6 -translate-x-1/2">{nowLabel}</Pill>}</span>}
          </div>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[150px_1fr] items-center border-t border-dotted border-ui-divider py-2">
              {r.label}
              <div className="relative h-14 rounded-ui-inner ui-hatch">
                {r.blocks.map((b) => <TimelineBlock key={`${b.s}-${b.t}`} left={pct(b.s)} width={pct(b.e) - pct(b.s)} t={b.t} d={b.d} st={b.st}>{b.extra}</TimelineBlock>)}
                {r.overlay?.(pct)}
              </div>
            </div>
          ))}
        </div>
        {legend}
      </div>
    </Card>
  )
}

/** Idővonal-sor címkéje: avatar, név, alatta egy adat (heti óra, pozíció). */
export const GridPerson = ({ img, n, sub }: { img: string; n: string; sub: string }) => (
  <span className="flex items-center gap-2.5"><Avatar size="sm" src={`/landing/funkciok/csapat/avatar/${img}.webp`} /><span className="min-w-0"><span className="block text-ui-body text-ui-text">{n}</span><MarqueeText className="text-ui-label text-ui-muted">{sub}</MarqueeText></span></span>
)

/** Idővonal-jelmagyarázat: blokk-színek (állapot) és pöttyök (riasztás). Szalon (6.1) és étterem (6.13); `items`
 *  saját színekkel (pl. a Naptár napi nézete, 11.2.1: műszak / beteg / szabadság). */
export function BlockLegend({ alerts = true, merged = false, occasions = false, items }: { alerts?: boolean; merged?: boolean; occasions?: boolean; items?: string[][] }) {
  const sw = items ?? [['bg-ui-dark', 'Megerősített'], ['bg-ui-yellow', 'Függő'], ['bg-ui-grey', 'Befejezett'], ['border-[1.5px] border-ui-dark', 'Hamarosan'], ['ui-hatch', 'Szabad']]
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-ui-divider pt-3 text-ui-label text-ui-muted">
      {sw.map(([c, l, d]) => <span key={l} className="flex items-center gap-1.5"><span className={`relative h-3 w-5 rounded-ui-control ${c}`}>{d && <span className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${d}`} />}</span>{l}</span>)}
      {merged && <span className="flex items-center gap-1.5"><span className="flex h-3 w-5 items-center justify-center rounded-ui-control border border-ui-dark/25 bg-white"><Link2 className="h-2.5 w-2.5" /></span>Összevont asztalok</span>}
      {occasions && <>
        <span className="mx-1 h-3 w-px bg-ui-dark/20" />
        {(Object.keys(OCC) as Occ[]).map((k) => <span key={k} className="flex items-center gap-1.5"><IconCircle tone="cell" size="xs" icon={OCC[k].icon} />{OCC[k].l}</span>)}
      </>}
      {alerts && <>
        <span className="mx-1 h-3 w-px bg-ui-dark/20" />
        {[['bg-ui-ok-dot', 'Bent'], ['bg-ui-warn-dot', 'Mindjárt végez'], ['bg-ui-bad-dot', 'Késik']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${c}`} />{l}</span>)}
      </>}
    </div>
  )
}

export type FloorTable = { id: string; n: string; x: number; y: number; w: number; h: number; round?: boolean; st: 'busy' | 'free' | 'pending' | 'soon' | 'late'; left?: number; sub?: string; sel?: boolean; title?: string }
const SAMPLE_FLOOR: FloorTable[] = [
  { id: 'T1', n: 'T1', x: 6, y: 10, w: 64, h: 64, round: true, st: 'busy', left: 40 },
  { id: 'T2', n: 'T2', x: 22, y: 10, w: 64, h: 64, round: true, st: 'free' },
  { id: 'T3', n: 'T3', x: 38, y: 8, w: 92, h: 64, st: 'pending' },
  { id: 'T4', n: 'T4', x: 6, y: 46, w: 92, h: 64, st: 'busy', left: 90 },
  { id: 'T5', n: 'T5', x: 25, y: 46, w: 92, h: 64, st: 'busy', left: 90, sel: true },
  { id: 'T6', n: 'T6', x: 45, y: 46, w: 64, h: 64, round: true, st: 'soon', sub: '19:45' },
  { id: 'T7', n: 'T7', x: 62, y: 46, w: 64, h: 64, round: true, st: 'free' },
  { id: 'T8', n: 'T8', x: 10, y: 78, w: 120, h: 52, st: 'free' },
  { id: 'T9', n: 'T9', x: 60, y: 76, w: 120, h: 56, st: 'busy', left: 15 },
]
const FLOOR_TONE: Record<FloorTable['st'], string> = { busy: 'bg-ui-dark text-white', pending: 'bg-ui-yellow text-ui-dark', soon: 'border-[1.5px] border-ui-dark bg-white/70 text-ui-dark', late: 'bg-ui-bad-bg text-ui-bad', free: 'ui-hatch text-ui-text' }

/** Az asztal alakja a létszámából, amíg nincs terem-rajz (9.6): 2 fő kerek, 6-ig téglalap, felette hosszú. */
export const tableShape = (capacity: number) => (capacity <= 2 ? { w: 64, h: 64, round: true } : capacity <= 6 ? { w: 92, h: 64 } : { w: 120, h: 56 })

/** Étterem terem-nézet (felülnézet): asztal = alak, szín = állapot a kiválasztott időpontban; a foglalt asztal sarkában a
 *  hátralévő perc; lent idő-csúszka; alatta jelmagyarázat. A Foglalások étterem (6.15), az Asztalok (9.3) és a landing is
 *  ezt mutatja — props nélkül a mintaadattal; élőben (`tables`, `onPick`, `time`…) a valódi teremmel. */
export function FloorPlan({ className = '', compact = false, rooms = ['Terem', 'Terasz', 'Különterem'], room = 0, onRoom, meta = <>9 asztal · 34 hely · <span className="text-ui-text">72% telt</span></>, tables = SAMPLE_FLOOR, onPick, bar = true, time = { min: 17 * 60, max: 23 * 60, value: 19 * 60 + 30 }, onTime, timeExtra, legend }: {
  className?: string
  compact?: boolean
  rooms?: string[]
  room?: number
  onRoom?: (i: number) => void
  meta?: React.ReactNode
  tables?: FloorTable[]
  onPick?: (id: string) => void
  /** pult és bejárat a rajzon (a minta-teremben) */
  bar?: boolean
  time?: { min: number; max: number; value: number }
  onTime?: (min: number) => void
  /** a csúszka előtt (élőben: „Élő” gomb) */
  timeExtra?: React.ReactNode
  legend?: React.ReactNode
}) {
  const k = compact ? 0.56 : 1
  const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const tpct = ((time.value - time.min) / Math.max(1, time.max - time.min)) * 100
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented size={compact ? 'sm' : 'md'} options={rooms} active={room} onSelect={onRoom} />
        {!compact && meta && <Meta>{meta}</Meta>}
      </div>
      <div className={`relative mt-4 overflow-hidden rounded-ui-inner bg-white/50 ${compact ? 'h-[230px]' : 'h-[320px]'}`}>
        {bar && <>
          {/* pult és bejárat */}
          <div className={`absolute right-3 top-3 flex items-center justify-center rounded-ui-inner text-ui-label text-ui-muted ui-hatch-cell ${compact ? 'h-[36px] w-[64px]' : 'h-[64px] w-[120px]'}`}>Pult</div>
          <div className="absolute bottom-0 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-t-full bg-ui-dark/30" />
        </>}
        {tables.map((t) => {
          const cls = `absolute flex flex-col items-center justify-center text-ui-meta ${t.round ? 'rounded-full' : 'rounded-ui-inner'} ${FLOOR_TONE[t.st]} ${t.sel ? 'ring-[3px] ring-ui-yellow ring-offset-2 ring-offset-ui-cell' : ''}`
          const style = { left: `${t.x}%`, top: `${t.y}%`, width: t.w * k, height: t.h * k }
          const inner = (
            <>
              <span className="font-medium">{t.n}</span>
              {t.sub && !compact && <span className="text-ui-label opacity-70">{t.sub}</span>}
              {t.left != null && <span className="absolute -right-2 -top-2" title={`foglalt, még ${t.left} perc`}><StatusPill status={t.st === 'late' ? 'bad' : 'warn'}>{t.left}&apos;</StatusPill></span>}
            </>
          )
          return onPick
            ? <button key={t.id} type="button" title={t.title} onClick={() => onPick(t.id)} className={`${cls} outline-none transition-[filter] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ui-dark/30`} style={style}>{inner}</button>
            : <div key={t.id} title={t.title} className={cls} style={style}>{inner}</div>
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {timeExtra}
        <span className="text-ui-meta text-ui-muted">{hm(time.min)}</span>
        <div className="relative h-2 flex-1 rounded-full bg-white/70">
          <span className="absolute inset-y-0 left-0 rounded-full bg-ui-dark" style={{ width: `${tpct}%` }} />
          <span className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${tpct}%` }}><Pill tone="yellow" className="shadow-ui-float">{hm(time.value)}</Pill></span>
          {onTime && <input type="range" min={time.min} max={time.max} step={5} value={time.value} onChange={(e) => onTime(Number(e.target.value))} aria-label="Időpont a napon belül" className="absolute -inset-y-3 inset-x-0 h-8 w-full cursor-pointer opacity-0" />}
        </div>
        <span className="text-ui-meta text-ui-muted">{hm(time.max)}</span>
      </div>
      {!compact && (legend ?? <BlockLegend alerts={false} />)}
    </Card>
  )
}

/** A kijelölt asztal lapja (terem-nézet mellett, 6.15 / 9.3): ki ül ott, mióta és meddig, ki jön utána, összetolhatóság,
 *  és a gombok. Props nélkül a mintaadattal. */
export function TablePanel({ name = 'T5', sub = 'Terem · 6 fő', status = { tone: 'ok', label: 'Leültetve' }, current = { title: 'Varga Péter · 5 fő', meta: '19:00–21:00 · Születésnap', occ: <OccBadge occ="szulinap" />, pct: 25, since: '30 perce ülnek', left: 'még 90 perc' }, next = [['21:30', 'Kiss Réka · 4 fő'], ['22:00', 'Tóth család · 6 fő']], note = <><span className="font-medium">Összetolható:</span> T4 + T5 — 10 fő 21:00-tól.</>, onOpenCurrent, onFree, freeLabel = 'Asztal felszabadul', busy = false, onAdd, className = '' }: {
  name?: string
  sub?: string
  status?: { tone: 'ok' | 'warn' | 'bad' | 'pending' | 'neutral' | 'confirmed'; label: string }
  current?: { title: string; meta: string; occ?: React.ReactNode; pct: number; since: string; left: string } | null
  next?: [string, string][]
  note?: React.ReactNode
  onOpenCurrent?: () => void
  onFree?: () => void
  freeLabel?: string
  /** a felszabadítás folyamatban (forgó jel a gombon) */
  busy?: boolean
  onAdd?: () => void
  className?: string
}) {
  const cur = current && (
    <Card tone="dark" inner pad="sm" className="mt-4">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0"><MarqueeText className="text-ui-body font-medium">{current.title}</MarqueeText><MarqueeText className="text-ui-label text-white/55">{current.meta}</MarqueeText></span>
        {current.occ}
      </div>
      <div className="mt-3 flex h-[6px] overflow-hidden rounded-full bg-white/15"><span className="h-full rounded-full bg-ui-yellow" style={{ width: `${current.pct}%` }} /></div>
      <div className="mt-1.5 flex justify-between text-ui-label text-white/55"><span>{current.since}</span><span>{current.left}</span></div>
    </Card>
  )
  return (
    <Card tone="white" className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between">
        <div><Meta className="text-ui-label">{sub}</Meta><div className="text-ui-num font-light leading-none text-ui-text">{name}</div></div>
        <StatusPill status={status.tone}>{status.label}</StatusPill>
      </div>
      {cur && (onOpenCurrent ? <button type="button" onClick={onOpenCurrent} className="block w-full text-left outline-none">{cur}</button> : cur)}
      <Meta className="mt-4">Utána</Meta>
      <div>
        {next.length ? next.map(([t, n]) => (
          <ListRow key={t + n} className="px-0" title={n} trailing={<span className="text-ui-body text-ui-muted">{t}</span>} />
        )) : <ListRow className="px-0" title={<span className="text-ui-muted">Nincs több foglalás mára</span>} />}
      </div>
      {note && <Note strong className="mt-3">{note}</Note>}
      {/* a gombok a lap alján */}
      <div className="mt-auto flex gap-1.5 pt-3">
        <Button className="flex-1" onClick={onFree} loading={busy} disabled={!!onAdd && !onFree}>{freeLabel}</Button>
        <IconButton icon={Plus} label="Foglalás hozzáadása" variant="cell" onClick={onAdd} />
      </div>
    </Card>
  )
}

/** Függő foglalás jóváhagyása (design 6.8, landing „Automatikus vagy kézi jóváhagyás”): állapot, vendég, időpont,
 *  a foglalás adatai, Jóváhagyom / Elutasítom. Kézi jóváhagyás mellett nincs előleg (a beállítás és a szerver is
 *  kizárja) — fizetett foglalást nem hagyunk függőben, így elutasításkor nincs mit visszautalni. */
export function PendingApproval({ className = '', arrived, queue, data, onApprove, onDecline, onClose, busy = false, wrap }: {
  className?: string
  /** magától nyílt (beérkezéskor): „Épp most érkezett” */ arrived?: string
  /** több vár egyszerre: hányadik / hány, lapozóval */ queue?: { i: number; n: number; onPrev?: () => void; onNext?: () => void }
  /** élőben a foglalás; nélküle a minta */
  data?: { name: string; when: string; service: string; detail: string; price: string; img?: string | null; staffName?: string; rows: [string, string][] }
  onApprove?: () => void; onDecline?: () => void; onClose?: () => void; busy?: boolean
  /** a tartalom (név, időpont, adatok) burka — élőben a lapozás csúszó animációja; a keret és a gombok állnak */
  wrap?: (body: React.ReactNode) => React.ReactNode
}) {
  const d = data ?? { name: 'Juhász Hanna', when: 'Csütörtök, Nov. 6. · 13:30–16:00', service: 'Balayage + vágás', detail: '150 perc · Viktória', price: '48 000 Ft', img: undefined, staffName: undefined, rows: [['Telefon', '+36 20 555 1234'], ['Forrás', 'Online · foglalóoldal'], ['Megjegyzés', 'Hosszú, vastag haj']] as [string, string][] }
  return (
    <Panel pad="lg" size="sm" className={className}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <StatusPill status="pending">Függő</StatusPill>
          {arrived && <Meta className="truncate text-ui-label">{arrived}</Meta>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {queue && queue.n > 1 && <>
            <IconButton icon={ChevronLeft} label="Előző" variant="cell" size="sm" onClick={queue.onPrev} disabled={queue.i <= 1} />
            <span className="text-ui-label text-ui-muted">{queue.i} / {queue.n}</span>
            <IconButton icon={ChevronRight} label="Következő" variant="cell" size="sm" onClick={queue.onNext} disabled={queue.i >= queue.n} />
          </>}
          <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onClose} className="max-sm:hidden" />
        </span>
      </div>
      {(() => {
        const body = (
          <div>
            <div className="mt-5 text-ui-num font-light leading-tight text-ui-text">{d.name}</div>
            <div className="mt-1 text-ui-body text-ui-muted">{d.when}</div>
            <BookingFacts className="mt-4" service={d.service} detail={d.detail} price={d.price} img={data ? d.img ?? null : undefined} name={d.staffName} rows={d.rows} />
          </div>
        )
        return wrap ? <div className="overflow-hidden">{wrap(body)}</div> : body
      })()}
      <div className="mt-4 flex gap-1.5">
        <Button className="flex-1" icon={Check} onClick={onApprove} loading={busy}>Jóváhagyom</Button>
        <Button variant="cell" onClick={onDecline} disabled={busy}>Elutasítom</Button>
        {!data && <IconButton icon={MoreHorizontal} label="Több" variant="ghost" />}
      </div>
    </Panel>
  )
}

/** A kijelölt asztal egy sorban (mobil terem-nézet, landing): asztal, vendég, létszám, hátralévő perc, ki jön utána. */
export function SelectedTableStrip({ className = '' }: { className?: string }) {
  return (
    <Card tone="white" pad="sm" className={className}>
      <div className="flex items-center justify-between"><span className="text-ui-body text-ui-text">T5 · Varga Péter · 5 fő</span><StatusPill status="warn">90&apos;</StatusPill></div>
      <Meta className="text-ui-label">19:00–21:00 · Születésnap · utána 21:30 Kiss Réka</Meta>
    </Card>
  )
}

/** Számozott lépés-cím a foglalás-popupban (6.9, 6.13). */
export function StepTitle({ n, children, className = 'mt-5' }: { n: number; children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 text-ui-meta font-medium text-ui-muted ${className}`}><IconCircle size="xs">{n}</IconCircle>{children}</div>
}

/** Új foglalás, vendég-lépés: beírod a név elejét, a korábbi vendégek közül egy kattintással kitölti (6.9 és landing). */
export function GuestSuggest() {
  return (
    <>
      <Input defaultValue="Kov" className="mt-2" />
      <Card tone="cell" inner pad="xs" className="mt-1.5">
        <Meta className="px-3 pt-1 text-ui-label">Korábbi vendég — kattints a kitöltéshez</Meta>
        {[['Kovács Anna', '+36 30 412 7781 · 9 alkalom'], ['Kovács Bence', '+36 20 164 4860 · 2 alkalom']].map(([n, d], i) => (
          <ListRow key={n} filled={i === 0} className={i === 0 ? 'bg-white' : ''} leading={<UserRound className="h-4 w-4 text-ui-muted" />} title={n} meta={d} />
        ))}
      </Card>
    </>
  )
}

/** Landing „Korábbi vendég kitöltése”: az új foglalás vendég-lépése (6.9). */
export function GuestLookupDemo() {
  return (
    <Panel size="sm">
      <div className="text-ui-sub font-light text-ui-text">Új foglalás</div>
      <StepTitle n={1} className="mt-3">Vendég</StepTitle>
      <GuestSuggest />
    </Panel>
  )
}

/** Net nélkül (új, a design 2.13-ban is): a módosítások a telefonon várnak, és magától elmennek, amint van net. */
export function OfflineQueue() {
  return (
    <Card tone="white" className="w-full max-w-[400px]">
      <Note warn icon={WifiOff}>Nincs internet — a módosítások a telefonodon várnak, és magától elküldjük őket, amint visszajön a net.</Note>
      <Meta className="mt-4">Elküldésre vár · 3</Meta>
      <div className="mt-1.5 space-y-1">
        {([[Check, 'Kiss Réka megérkezett', 'ma 11:04 · Géllakk'], [Plus, 'Új foglalás · Tóth Bence', 'ma 15:30 · Férfi vágás'], [X, 'Lemondás · Nagy Dóra', 'holnap 10:00 · Hajvágás']] as const).map(([I, t, d]) => (
          <ListRow key={t} filled leading={<IconCircle tone="cell" size="sm" icon={I} />} title={t} meta={d} trailing={<StatusPill status="warn">vár</StatusPill>} />
        ))}
      </div>
      <Toast className="mt-4" title="Újra van net">3 módosítás elküldve</Toast>
    </Card>
  )
}



export type PickDay = { key: string; d: string; n: number; on?: boolean; off?: boolean; today?: boolean; title?: string }
const SAMPLE_DAYS: PickDay[] = ([['P', 7], ['Szo', 8], ['V', 9], ['H', 10], ['K', 11], ['Sze', 12]] as const).map(([d, n], i) => ({ key: String(n), d, n, on: i === 3, off: d === 'V' }))

/** Nap-választó sáv (új foglalás 6.9 / 6.12 / 6.18, és a publikus foglaló 21.x): hat nap, a kiválasztott sötét, a zárt
 *  csíkos; a szélén a naptár-ikon a távolabbi napokhoz. `cell` / `onClass` / `offClass`: a sima, a kiválasztott és a
 *  zárt nap — a vendég-oldal sötét kártyáján a kártya színeivel (21.x). Élőben (`days`, `onPick`, `calendar`) a valódi
 *  napokkal; a `calendar` a felugró naptár (nélküle csak az ikon). `scroll`: a vendég foglalóján (21.x) az összes
 *  foglalható nap egy vízszintesen görgethető sávban, naptár nélkül; a mai nap keretezve (`todayClass`). */
export function DayPicker({ className = '', cell = 'bg-ui-cell text-ui-text', onClass = 'bg-ui-dark text-white', offClass = 'ui-hatch-cell text-ui-muted', todayClass = 'ring-1 ring-inset ring-ui-dark', days = SAMPLE_DAYS, onPick, calendar, scroll = false }: { className?: string; cell?: string; onClass?: string; offClass?: string; todayClass?: string; days?: PickDay[]; onPick?: (key: string) => void; calendar?: React.ReactNode; scroll?: boolean }) {
  return (
    <div className={`flex items-stretch gap-1 ${scroll ? 'snap-x overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''} ${className}`}>
      {days.map((x) => {
        const cls = `flex ${scroll ? 'w-14 shrink-0 snap-start' : 'flex-1'} flex-col items-center rounded-ui-control py-1.5 ${x.on ? onClass : x.off ? offClass : cell} ${x.today && !x.on ? todayClass : ''}`
        const inner = <><MarqueeText className={`text-ui-label opacity-60 ${scroll ? 'max-w-full px-0.5' : ''}`}>{x.d}</MarqueeText><span className="text-ui-row font-light">{x.n}</span></>
        return onPick
          ? <button key={x.key} type="button" onClick={() => onPick(x.key)} aria-pressed={!!x.on} title={x.title} className={`${cls} outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{inner}</button>
          : <span key={x.key} className={cls}>{inner}</span>
      })}
      {scroll ? null : calendar ?? <span className={`flex w-12 shrink-0 items-center justify-center rounded-ui-control ${cell}`} title="Naptár"><CalendarDays className="h-4 w-4" strokeWidth={1.8} /></span>}
    </div>
  )
}

/** Szabad időpontok rácsa: a választott sárga, a foglalt csíkos és áthúzott (új foglalás 6.9, mobil, és a publikus foglaló 21.x).
 *  `onPick`: élő szerkesztőben kattintható (a foglalt is választható marad — pl. másik munkatárshoz). */
export function SlotGrid({ className = '', slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '15:30', '16:00', '16:30', '17:00'], on = '13:30', busy = ['10:00', '10:30', '14:00'], onClass = 'bg-ui-yellow text-ui-dark', cell = 'bg-ui-cell text-ui-text', busyClass = 'ui-hatch-cell text-ui-muted line-through', onPick }: { className?: string; slots?: string[]; on?: string; busy?: string[]; onClass?: string; cell?: string; busyClass?: string; onPick?: (t: string) => void }) {
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`}>
      {slots.map((t) => {
        const isBusy = busy.includes(t)
        const isOn = t === on
        const cls = `flex h-10 items-center justify-center rounded-ui-control text-ui-meta ${isOn ? onClass : isBusy ? busyClass : cell}`
        return onPick
          ? <button key={t} type="button" onClick={() => onPick(t)} aria-pressed={isOn} className={`${cls} outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{t}</button>
          : <span key={t} className={cls}>{t}</span>
      })}
    </div>
  )
}

/** A szerkesztő időpont-rácsa (6.9 / 6.18): a nap összes kezdése, ami nem szabad, az foglalt (csíkos, áthúzott). Ha a
 *  napra nincs egy jelölt sem (zárva, távollét), a nyitvatartásból (`fallback`) csupa foglalt rács — kézzel így is
 *  választható. A kiválasztott, rácson kívüli idő (pl. 10:10) is bekerül, hogy látsszon. */
export function slotGridOf({ free, all, on, fallback, step = 30 }: { free: string[]; all: string[]; on?: string; fallback?: [number, number]; step?: number }): { slots: string[]; busy: string[] } {
  const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  let base = all.length ? all : free
  if (!base.length && fallback) { base = []; for (let m = fallback[0]; m < fallback[1]; m += step) base.push(hm(m)) }
  const slots = [...new Set([...base, ...free, ...(on ? [on] : [])])].sort()
  const f = new Set(free)
  return { slots, busy: slots.filter((t) => !f.has(t)) }
}

/** Egy sor a foglalás-popup „Egyéb” lépésében (6.9): balra a címke, jobbra a mező; a sorok között szaggatott vonal. */
export function StepRow({ label, first = false, children }: { label: string; first?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-h-[48px] items-center justify-between gap-2 ${first ? 'mt-1' : 'border-t border-dashed border-ui-divider'}`}>
      <span className="shrink-0 text-ui-body text-ui-muted">{label}</span>
      {children}
    </div>
  )
}

/** Választó pillek (forrás, státusz, alkalom — 6.9 / 6.18): a kiválasztott sötét (vagy `onTone`), a többi cella.
 *  `onPick`: élő szerkesztőben kattintható. */
export function ChoicePills({ options, value, onPick, onTone = 'dark', className = '' }: { options: { value: string; label: React.ReactNode }[]; value: string | null; onPick?: (v: string) => void; onTone?: 'dark' | 'yellow'; className?: string }) {
  return (
    <span className={`flex flex-wrap justify-end gap-1 ${className}`}>
      {options.map((o) => {
        const pill = <Pill tone={o.value === value ? onTone : 'cell'}>{o.label}</Pill>
        return onPick
          ? <button key={o.value} type="button" onClick={() => onPick(o.value)} aria-pressed={o.value === value} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button>
          : <span key={o.value}>{pill}</span>
      })}
    </span>
  )
}

/** Munkatárs-választó (6.9): „Bárki”, majd a munkatársak avatarral; a kiválasztott sötét. `onPick(null)`: bárki. */
export function StaffPills({ staff, value, onPick, className = 'mt-2' }: { staff: { id: string; name: string; img?: string | null; off?: boolean; title?: string }[]; value: string | null; onPick?: (id: string | null) => void; className?: string }) {
  const wrap = (key: string, node: React.ReactNode, id: string | null, disabled = false, title?: string) => onPick
    ? <button key={key} type="button" disabled={disabled} title={title} onClick={() => onPick(id)} aria-pressed={value === id} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-not-allowed">{node}</button>
    : <span key={key} title={title}>{node}</span>
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {wrap('any', <Pill tone={value == null ? 'dark' : 'cell'}>Bárki</Pill>, null)}
      {staff.map((p) => wrap(p.id, <Pill tone={value === p.id ? 'dark' : 'cell'} className={`pl-1 ${p.off ? 'opacity-50' : ''}`}><Avatar size="xs" src={p.img ?? null} name={p.name} />{p.name}</Pill>, p.id, false, p.title))}
    </div>
  )
}

/** Étterem: az új foglalás „Létszám” lépése (6.18) — elsőként, mert az időpont és az asztal is ettől függ. */
export function PaxStep({ n = 2, pax, paxMax = 50, onPax, hint, className = '' }: { n?: number; pax: number; paxMax?: number; onPax?: (pax: number) => void; /** pl. „erre az időpontra max 12 fő” */ hint?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <StepTitle n={n} className="">Létszám</StepTitle>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Meta>{hint}</Meta>
        <span className="flex items-center gap-1.5">
          <IconButton icon={Minus} label="Csökkentés" variant="cell" onClick={onPax && (() => onPax(Math.max(1, pax - 1)))} disabled={!!onPax && pax <= 1} />
          <span className="w-16 text-center text-ui-sub font-light text-ui-text">{pax} fő</span>
          <IconButton icon={Plus} label="Hozzáadás" variant="cell" onClick={onPax && (() => onPax(Math.min(paxMax, pax + 1)))} disabled={!!onPax && pax >= paxMax} />
        </span>
      </div>
    </div>
  )
}

export type TableChoice = { id: string; name: string; capacity: number; /** foglalt: ennyi perc múlva szabadul */ busyMin?: number; busy?: boolean; small?: boolean; title?: string }
/** Étterem: az új foglalás „Asztal” lépése (6.18, mobilon 6.19) — asztal (automatikus vagy választott;
 *  a foglalt csíkos, sarkában a hátralévő perc), összevonás-javaslat, alkalom. A `on…` függvényekkel élő szerkesztőben
 *  kattintható; nélkülük (design oldal) csak megjelenítés. */
export function TableStep({ n = 4, time, tables, value, onPick, autoHint, combo, onCombo, occasions, occasion, onOccasion, hint, className = '' }: {
  n?: number
  /** a lépés címében („Asztal · 19:00”) */
  time?: string
  tables: TableChoice[]
  /** a kiválasztott asztal(ok) id-je vesszővel; üres = automatikus */
  value: string
  onPick?: (id: string) => void
  /** az „Automatikus” alatt: melyik asztalt adná a rendszer (vagy melyeket tolná össze) */
  autoHint?: string
  combo?: { label: string; reason: string } | null
  onCombo?: (accept: boolean) => void
  occasions?: { value: string; label: string }[]
  occasion?: string | null
  onOccasion?: (v: string) => void
  /** figyelmeztetés az asztal-rács alatt (pl. foglalt / kicsi a választott) */
  hint?: React.ReactNode
  className?: string
}) {
  const picked = new Set(value ? value.split(',') : [])
  const card = (key: string, node: React.ReactNode, id: string, extra = '', disabled = false, title?: string) => onPick
    ? <button key={key} type="button" disabled={disabled} title={title} onClick={() => onPick(id)} className={`relative rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-not-allowed ${extra}`}>{node}</button>
    : <div key={key} title={title} className={`relative ${extra}`}>{node}</div>
  return (
    <div className={className}>
      <StepTitle n={n} className="">Asztal{time ? ` · ${time}` : ''}</StepTitle>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {/* egy sorban: mit adna a rendszer (vagy mit tolna össze) */}
        {card('auto', <OptionCard title={<>Automatikus{autoHint && <span className="opacity-60"> · {autoHint}</span>}</>} selected={!value} />, '', 'col-span-4')}
        {tables.map((t) => {
          const on = picked.has(t.id)
          return card(t.id, (
            <>
              <OptionCard title={t.name} selected={on} className={!on && t.busy ? 'ui-hatch-cell text-ui-muted' : !on && t.small ? 'text-ui-muted' : ''}>{t.busy ? 'foglalt' : `${t.capacity} fő`}</OptionCard>
              {t.busy && t.busyMin != null && <span className="absolute right-2.5 top-2.5" title={`foglalt, még ${t.busyMin} perc`}><StatusPill status="warn">{t.busyMin}&apos;</StatusPill></span>}
            </>
          ), t.id, '', !!t.busy && !on, t.title)
        })}
      </div>
      {hint && <Meta className="mt-2">{hint}</Meta>}
      {combo && (
        <Card tone="cell" inner pad="sm" className="mt-3">
          <div className="flex items-center gap-2 text-ui-body text-ui-text"><Link2 className="h-4 w-4" />Összevonás javasolt</div>
          <Meta className="mt-1">{combo.reason}</Meta>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-ui-title font-light text-ui-text">{combo.label}</span>
            <span className="flex gap-1.5"><Button variant="glass" size="sm" onClick={onCombo && (() => onCombo(false))}>Nem kérem</Button><Button size="sm" onClick={onCombo && (() => onCombo(true))}>Elfogadom</Button></span>
          </div>
        </Card>
      )}
      {occasions && occasions.length > 0 && (
        <>
          <div className="mt-5 text-ui-body text-ui-muted">Alkalom</div>
          <ChoicePills className="mt-2 !justify-start" options={occasions} value={occasion ?? null} onPick={onOccasion} onTone="yellow" />
        </>
      )}
    </div>
  )
}


/* ── Ami figyelmet kér (design 6.8.1) — egy rendszer három fokozattal ─────────────────────────────── */

/** Mire figyelmeztet a sáv: új függő foglalás (jóváhagyásra vár) vagy lejárt, de le nem zárt foglalás (fizetésre vár). */
export type AttentionKind = 'pending' | 'payment' | 'trial'

/**
 * 6.8.1 — a 2. fokozat: kis sötét sáv alul középen (mobilon az alsó menü fölött), nem takar el semmit. Egy dolognál a
 * vendég és az időpont, többnél összevonva („3 foglalás vár jóváhagyásra”). A „Megnézem” nyitja ugyanazt, amit a
 * blokkra kattintva is: függőnél a jóváhagyó popupot (6.8, több esetén lapozóval), fizetésnél a fizetés ablakát (6.7.1).
 * Az X csak elrejti — a foglalás jele (1. fokozat) és a csengő értesítése megmarad.
 */
export function AttentionBar({ kind = 'pending', count = 1, who = 'Juhász Hanna', when = 'Csüt., Nov. 6. · 13:30', img, onOpen, href, onDismiss, className = '' }: {
  kind?: AttentionKind; count?: number; who?: string; when?: string; img?: string | null
  /** a gomb linkként (pl. a próbaidőnél az Előfizetés lap) */ href?: string
  onOpen?: () => void; onDismiss?: () => void; className?: string
}) {
  const one = count <= 1
  const title = kind === 'trial' ? (count <= 0 ? 'Ma lejár a próbaidőd' : `Még ${count} nap a próbaidőből`)
    : kind === 'pending'
    ? (one ? 'Új foglalás vár jóváhagyásra' : `${count} foglalás vár jóváhagyásra`)
    : (one ? 'Fizetésre vár' : `${count} foglalás fizetésre vár`)
  return (
    <div role="status" className={`inline-flex max-w-full items-center gap-3 rounded-full bg-ui-dark py-2 pl-2 pr-2 text-white shadow-ui-float ${className}`}>
      {kind !== 'trial' && one && img ? <Avatar src={img} name={who} size="sm" /> : <IconCircle tone="yellow" icon={kind === 'pending' ? Bell : kind === 'trial' ? CalendarDays : Wallet} />}
      <span className="min-w-0">
        <MarqueeText className="text-ui-body">{title}</MarqueeText>
        <MarqueeText className="text-ui-label text-white/55">{kind === 'trial' ? when : one ? `${who} · ${when}` : 'a legrégebbi elöl'}</MarqueeText>
      </span>
      <Button variant="yellow" size="sm" onClick={onOpen} href={href}>{kind === 'pending' ? 'Megnézem' : kind === 'trial' ? 'Beállítom' : 'Lezárom'}</Button>
      <IconButton icon={X} label="Elrejtés" variant="onDark" size="sm" onClick={onDismiss} />
    </div>
  )
}

/** 6.8.1 — az 1. fokozat: a foglalás blokkján / során a jel („Fizetésre vár”), csendesen, amíg el nem intézik. */
export function AttentionPill({ kind = 'payment', className = '' }: { kind?: AttentionKind; className?: string }) {
  return <Pill tone="yellow" size="sm" icon={kind === 'pending' ? Bell : Wallet} className={className}>{kind === 'pending' ? 'Jóváhagyásra vár' : 'Fizetésre vár'}</Pill>
}

/** Mennyire kérjen figyelmet az új függő foglalás (a 3. fokozat ki/be) — a felhasználó saját beállítása (Értesítések). */
export type PendingAlertMode = 'bar' | 'popup'
/**
 * 6.8.1 — a saját beállítás (Beállítások › Értesítések): új függő foglalásnál sáv vagy azonnal a teljes popup, és a
 * „Fizetésre vár” jelzés be/ki. Élőben `value` + `onChange`; nélküle a minta.
 */
export function AttentionSettings({ value, onChange, payment = true, className = '' }: {
  value?: { pending: PendingAlertMode; payment: boolean }; onChange?: (v: { pending: PendingAlertMode; payment: boolean }) => void
  /** szalon (van fizetés-lezárás); étteremnél a fizetés sora nincs */
  payment?: boolean; className?: string
}) {
  const v = value ?? { pending: 'bar' as PendingAlertMode, payment: false }
  return (
    <Card tone="white" className={className}>
      <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><Bell className="h-4 w-4" />Ami figyelmet kér</div>
      <FieldRow label="Új függő foglalás" hint={v.pending === 'bar' ? 'kis sáv alul — nem takar el semmit' : 'azonnal felugrik a jóváhagyó ablak'}>
        <Segmented tone="cell" size="sm" options={['Sáv', 'Popup']} active={v.pending === 'popup' ? 1 : 0} onSelect={onChange ? (i) => onChange({ ...v, pending: i ? 'popup' : 'bar' }) : undefined} />
      </FieldRow>
      {payment && (
        <FieldRow label="Lezáratlan fizetés" hint={v.payment ? 'véget ért, de még nem fizetett foglalás: jelölve a naptárban, és alul egy sáv is szól' : 'véget ért, de még nem fizetett foglalás: csak a naptárban jelöljük'}>
          <Segmented tone="cell" size="sm" options={['Jelölés + sáv', 'Csak jelölés']} active={v.payment ? 0 : 1} onSelect={onChange ? (i) => onChange({ ...v, payment: !i }) : undefined} />
        </FieldRow>
      )}
    </Card>
  )
}
