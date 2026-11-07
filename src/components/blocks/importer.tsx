import { ArrowRight, Check, CircleAlert, CircleCheck, CirclePlus, Download, FileSpreadsheet, FileText, RotateCcw, ShieldCheck, Upload, X } from 'lucide-react'
import { Button, Card, Checkbox, IconButton, IconCircle, Meta, Pill, Select, StatusPill, Table, Td, Th, Tr, UploadBox, MarqueeText } from '@/components/ui-kit'
import { Steps } from './steps'

/* Import (design 23.x) — Beállítások › Integrációk › „Adatok importálása” popup belseje, és ugyanezek a darabok a
 * regisztráció / új üzlet import-lépésében (rövid változat). A darabok csak megjelenítenek (minta-adattal a design
 * oldalon); élőben az ImportPanel / WizardImportStep adja az adatot és a kezelőket. */

export const IMPORT_STEPS = ['Fájl', 'Oszlopok', 'Párosítás', 'Kész']
export const IMPORT_SOURCES = ['Salonic', 'Fresha', 'SimplyBook', 'Excel / saját export']

/** 1. A fájl: ledobó (kattintható), alatta a támogatott rendszerek és a minta-fájl. */
export function ImportDrop({ onPick, sampleHref, dragging = false, compact = false, className = '' }: { onPick?: () => void; sampleHref?: string; dragging?: boolean; compact?: boolean; className?: string }) {
  const box = (
    <UploadBox className={`w-full ${compact ? 'h-[150px]' : 'h-[220px]'} ${dragging ? 'bg-ui-yellow text-ui-dark' : ''}`}>
      <span className="text-ui-row text-ui-text">{dragging ? 'Engedd el itt' : 'Húzd ide a fájlt, vagy kattints'}</span>
      <span>CSV vagy Excel (.xlsx, .xls) — több munkalap is lehet</span>
    </UploadBox>
  )
  return (
    <div className={className}>
      {onPick ? <button type="button" onClick={onPick} className="block w-full rounded-ui-inner text-left outline-none ui-press focus-visible:ring-2 focus-visible:ring-ui-dark/20">{box}</button> : box}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1">{IMPORT_SOURCES.map((s) => <Pill key={s} size="sm">{s}</Pill>)}</span>
          <Button variant="cell" size="sm" icon={Download} href={sampleHref} download={!!sampleHref}>Minta-fájl</Button>
        </div>
      )}
    </div>
  )
}

export type ImportTypeOption = { value: string; label: string }
export const SAMPLE_IMPORT_TYPES: ImportTypeOption[] = [
  { value: 'bookings', label: 'Foglalások' }, { value: 'customers', label: 'Vendégek' }, { value: 'services', label: 'Szolgáltatások' }, { value: 'staff', label: 'Munkatársak' },
]

/** A betöltött fájl sora: ikon, név, sorok száma, eltávolítás; alatta a felismert adattípus (átállítható) és hogy mi lesz
 *  belőle („248 sor → 248 foglalás”). `warn`: a választott típus nem illik a fájlhoz — narancs sor, megerősítéssel. */
export function ImportFileBar({ name = 'salonic-export-2026.xlsx', rows = 248, type = 'bookings', types = SAMPLE_IMPORT_TYPES, onType, onRemove, willCreate = '248 sor → 248 foglalás', warn, className = '' }: {
  name?: string; rows?: number | null; type?: string; types?: ImportTypeOption[]; onType?: (v: string) => void; onRemove?: () => void
  /** mi lesz belőle — pl. „20 sor → 20 vendég” (több munkalapnál nincs) */
  willCreate?: string | null
  /** eltérő típus: a szöveg, és a két gomb (megerősítés / vissza a felismertre); `confirmed` után csak egy halvány sor */
  warn?: { text: string; detectedLabel: string; confirmed?: boolean; onConfirm?: () => void; onRevert?: () => void } | null
  className?: string
}) {
  return (
    <div className={`rounded-ui-inner bg-ui-cell p-3 ${className}`}>
      <div className="flex items-center gap-3">
        <IconCircle tone="white" size="lg" icon={name.endsWith('.csv') ? FileText : FileSpreadsheet} />
        <span className="min-w-0 flex-1"><MarqueeText className="text-ui-row text-ui-text">{name}</MarqueeText>{rows != null && <Meta>{rows.toLocaleString('hu-HU')} sor</Meta>}</span>
        <IconButton icon={X} label="Fájl eltávolítása" variant="ghost" size="sm" onClick={onRemove} />
      </div>
      {types.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-ui-divider pt-3">
          <Meta className="mr-1">Egy sor:</Meta>
          {types.map((t) => {
            const p = <Pill size="sm" tone={t.value === type ? 'dark' : 'white'}>{t.value === type && <Check className="h-3 w-3" />}{t.label}</Pill>
            return onType ? <button key={t.value} type="button" onClick={() => onType(t.value)} className="rounded-full outline-none ui-press focus-visible:ring-2 focus-visible:ring-ui-dark/20">{p}</button> : <span key={t.value}>{p}</span>
          })}
        </div>
      )}
      {willCreate && <div className="mt-2.5 flex items-center gap-1.5 text-ui-meta text-ui-text"><ArrowRight className="h-3.5 w-3.5 text-ui-muted" />{willCreate}</div>}
      {warn && !warn.confirmed && (
        <div role="alert" className="mt-3 rounded-ui-inner bg-ui-warn-bg px-3 py-2.5">
          <div className="flex items-start gap-2 text-ui-meta text-ui-text"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ui-warn" />{warn.text}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
            <Button size="sm" variant="cell" onClick={warn.onRevert}>Legyen {warn.detectedLabel.toLowerCase()}</Button>
            <Button size="sm" onClick={warn.onConfirm}>Igen, így olvasd be</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export type SheetRow = { name: string; type: string; rows: number; done?: number | null }
const SAMPLE_SHEETS: SheetRow[] = [
  { name: 'Ügyfelek', type: 'Vendégek', rows: 812 }, { name: 'Foglalások', type: 'Foglalások', rows: 248 },
  { name: 'Szolgáltatások', type: 'Szolgáltatások', rows: 24 }, { name: 'Munkatársak', type: 'Munkatársak', rows: 6 },
]

/** Több munkalapos Excel: a lapok listája (felismert típus, sorok), egy gomb mindet egyszerre; vagy laponként. Import
 *  után a sorokon a létrehozott darabszám. */
export function ImportSheets({ sheets = SAMPLE_SHEETS, active, onSheet, onAll, allLabel, busy = false, pickHint = true, className = '' }: {
  sheets?: SheetRow[]; active?: string | null; onSheet?: (name: string) => void; onAll?: () => void
  /** a fő gomb felirata (alap: „Mind a N munkalap importálása”) */
  allLabel?: string; busy?: boolean
  /** „vagy válassz egy lapot…” — csak ahol a lap átnézhető */
  pickHint?: boolean; className?: string
}) {
  const done = sheets.every((s) => s.done != null)
  return (
    <div className={className}>
      <div className="space-y-1">
        {sheets.map((s) => {
          const row = (
            <div className={`flex items-center gap-3 rounded-ui-inner px-3 py-2.5 ${active === s.name ? 'bg-white ring-2 ring-ui-dark' : 'bg-ui-cell'}`}>
              <span className="min-w-0 flex-1"><MarqueeText className="text-ui-row text-ui-text">{s.name}</MarqueeText><Meta>{s.rows.toLocaleString('hu-HU')} sor</Meta></span>
              <Pill size="sm" tone="white">{s.type}</Pill>
              {s.done != null ? <StatusPill status="ok">{s.done} db</StatusPill> : null}
            </div>
          )
          return onSheet && !done ? <button key={s.name} type="button" onClick={() => onSheet(s.name)} className="block w-full rounded-ui-inner text-left outline-none ui-press">{row}</button> : <div key={s.name}>{row}</div>
        })}
      </div>
      {!done && <Button className="mt-4 w-full" icon={Upload} loading={busy} onClick={onAll}>{allLabel ?? `Mind a ${sheets.length} munkalap importálása`}</Button>}
      {!done && pickHint && <Meta className="mt-2 text-center">vagy válassz egy lapot, és nézd át az oszlopait</Meta>}
    </div>
  )
}

export type MapRow = { key?: string | number; header: string; field: string; sample?: string }
export type FieldOption = { value: string; label: string }
const SAMPLE_FIELDS: FieldOption[] = [
  { value: '', label: '— kihagyom —' }, { value: 'customer_name', label: 'Vendég neve' }, { value: 'customer_email', label: 'E-mail' },
  { value: 'customer_phone', label: 'Telefon' }, { value: 'date', label: 'Dátum' }, { value: 'start_time', label: 'Kezdés' },
  { value: 'service', label: 'Szolgáltatás' }, { value: 'staff', label: 'Munkatárs' }, { value: 'price', label: 'Ár' }, { value: 'notes', label: 'Megjegyzés' },
]
const SAMPLE_MAP: MapRow[] = [
  { header: 'Ügyfél neve', field: 'customer_name', sample: 'Kovács Anna' }, { header: 'E-mail cím', field: 'customer_email', sample: 'anna@pelda.hu' },
  { header: 'Mobil', field: 'customer_phone', sample: '+36 30 123 4567' }, { header: 'Időpont', field: 'date', sample: '2026.11.12.' },
  { header: 'Kezdés', field: 'start_time', sample: '10:30' }, { header: 'Szolgáltatás', field: 'service', sample: 'Női hajvágás' },
  { header: 'Fodrász', field: 'staff', sample: 'Viktória' }, { header: 'Belső azonosító', field: '', sample: 'SL-29381' },
]

/** 2. Oszlopok: a fájl oszlopai bal oldalt (minta-értékkel), jobbra mihez kerül — a felismertek előre kitöltve, a
 *  kihagyott sor csíkos. `onField(key, field)` — a kulcs az oszlop sorszáma (két azonos nevű oszlop is lehet). */
export function ImportMapping({ rows = SAMPLE_MAP, fields = SAMPLE_FIELDS, onField, className = '' }: { rows?: MapRow[]; fields?: FieldOption[]; onField?: (key: string | number, field: string) => void; className?: string }) {
  return (
    <div className={className}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
        <Meta>A fájlban</Meta><span /><Meta>Nálunk</Meta>
        {rows.map((r, i) => (
          <div key={r.key ?? i} className="contents">
            <span className={`min-w-0 rounded-ui-control px-3 py-2 ${r.field ? 'bg-ui-cell' : 'ui-hatch-cell'}`}>
              <span title={r.header}><MarqueeText className="text-ui-body text-ui-text">{r.header}</MarqueeText></span>
              {r.sample && <MarqueeText className="text-ui-label text-ui-muted">{r.sample}</MarqueeText>}
            </span>
            <ArrowRight className={`h-4 w-4 ${r.field ? 'text-ui-text' : 'text-ui-muted'}`} />
            <Select value={onField ? r.field : undefined} defaultValue={onField ? undefined : r.field} onChange={onField ? (e) => onField(r.key ?? i, e.target.value) : undefined}>
              {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Előnézet: az első néhány sor a párosítás szerinti oszlopcímekkel. */
export function ImportPreview({ head = ['Vendég neve', 'E-mail', 'Dátum', 'Kezdés', 'Szolgáltatás', 'Munkatárs'], rows = [
  ['Kovács Anna', 'anna@pelda.hu', '2026.11.12.', '10:30', 'Női hajvágás', 'Viktória'],
  ['Szabó Noémi', 'noemi@pelda.hu', '2026.11.12.', '11:00', 'Festés', 'Csaba'],
  ['Tóth Bence', '—', '2026.11.13.', '09:00', 'Férfi hajvágás', 'Dave'],
], total = 248, className = '' }: { head?: string[]; rows?: string[][]; total?: number; className?: string }) {
  return (
    <div className={className}>
      <Meta className="mb-1">Előnézet — az első {rows.length} sor a {total.toLocaleString('hu-HU')}-ból</Meta>
      <Table minWidth={Math.max(560, head.length * 140)}>
        <thead><tr>{head.map((h, i) => <Th key={i}>{h}</Th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <Tr key={i}>{r.map((c, j) => <Td key={j} className={`max-w-[220px] truncate ${c === '—' || !c ? 'text-ui-muted' : ''}`}>{c || '—'}</Td>)}</Tr>)}</tbody>
      </Table>
    </div>
  )
}

export type MatchStatus = 'exact' | 'probable' | 'none'
export type MatchItem = { value: string; sub: string; status: MatchStatus; choice: string; options: FieldOption[] }
export type MatchGroup = { key?: string; title: string; items: MatchItem[] }
const sampleOpts = (names: string[], one: string, value: string): FieldOption[] => [...names.map((n) => ({ value: n, label: n })), { value: '', label: `+ Új ${one}: ${value}` }, { value: '__skip', label: '— kihagyom —' }]
const SAMPLE_MATCH: MatchGroup[] = [
  { title: 'Szolgáltatások', items: [
    { value: 'Női hajvágás', sub: '96 foglalás · Egyezik', status: 'exact', choice: 'Női hajvágás', options: sampleOpts(['Női hajvágás', 'Festés', 'Férfi hajvágás', 'Melír'], 'szolgáltatás', 'Női hajvágás') },
    { value: 'Hajfestés', sub: '41 foglalás · Javaslat — nézd meg', status: 'probable', choice: 'Festés', options: sampleOpts(['Női hajvágás', 'Festés', 'Férfi hajvágás', 'Melír'], 'szolgáltatás', 'Hajfestés') },
    { value: 'Keratinos kezelés', sub: '7 foglalás · Nincs ilyen — újként jön létre', status: 'none', choice: '', options: sampleOpts(['Női hajvágás', 'Festés', 'Férfi hajvágás', 'Melír'], 'szolgáltatás', 'Keratinos kezelés') },
  ] },
  { title: 'Munkatársak', items: [
    { value: 'Viktória', sub: '120 foglalás · Egyezik', status: 'exact', choice: 'Viktória', options: sampleOpts(['Viktória', 'Csaba', 'Dave', 'Andrea'], 'munkatárs', 'Viktória') },
    { value: 'Kis Bence', sub: '18 foglalás · Nincs ilyen — újként jön létre', status: 'none', choice: '', options: sampleOpts(['Viktória', 'Csaba', 'Dave', 'Andrea'], 'munkatárs', 'Kis Bence') },
  ] },
]
const MATCH_ICON: Record<MatchStatus, { icon: typeof CircleCheck; tone: 'ok' | 'warn' | 'white' }> = {
  exact: { icon: CircleCheck, tone: 'ok' }, probable: { icon: CircleAlert, tone: 'warn' }, none: { icon: CirclePlus, tone: 'white' },
}

/** 3. Párosítás: a fájlban talált nevek (szolgáltatás, munkatárs, kategória, asztal, terem) a meglévőkhöz — MIELŐTT
 *  bármi létrejönne. Egyezik → kész; javaslat → ellenőrizd; nincs → új lesz, vagy kihagyható. Fent az összesítő.
 *  `onChoice(groupKey, value, choice)`; a választó opcióit és a sor alatti szöveget a hívó adja. */
export function ImportMatch({ groups = SAMPLE_MATCH, onChoice, note = 'Amit újként hozunk létre, az inaktív marad, amíg be nem kapcsolod — a foglalóoldalon nem jelenik meg.', className = '' }: {
  groups?: MatchGroup[]; onChoice?: (group: string, value: string, choice: string) => void; note?: string | null; className?: string
}) {
  const all = groups.flatMap((g) => g.items)
  const n = (s: MatchStatus) => all.filter((x) => x.status === s).length
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {n('exact') > 0 && <StatusPill status="ok">{n('exact')} egyezik</StatusPill>}
        {n('probable') > 0 && <StatusPill status="warn">{n('probable')} javaslat</StatusPill>}
        {n('none') > 0 && <StatusPill status="ok">{n('none')} új</StatusPill>}
      </div>
      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <div key={g.key ?? g.title}>
            <div className="mb-1.5 text-ui-row text-ui-text">{g.title}</div>
            <div className="space-y-1">
              {g.items.map((it) => {
                const m = MATCH_ICON[it.status]
                return (
                  <div key={it.value} className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-ui-inner px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] ${it.status === 'probable' ? 'bg-ui-warn-bg' : 'bg-ui-cell'}`}>
                    <IconCircle tone={m.tone} size="sm" icon={m.icon} />
                    <span className="min-w-0"><span title={it.value}><MarqueeText className="text-ui-body text-ui-text">{it.value}</MarqueeText></span><MarqueeText className="text-ui-label text-ui-muted">{it.sub}</MarqueeText></span>
                    <Select className="col-span-2 sm:col-span-1" value={onChoice ? it.choice : undefined} defaultValue={onChoice ? undefined : it.choice} onChange={onChoice ? (e) => onChoice(g.key ?? g.title, it.value, e.target.value) : undefined}>
                      {it.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {note && <Meta className="mt-4 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />{note}</Meta>}
    </div>
  )
}

export type ResultStat = { label: string; value: number }
/** 4. Kész: mi jött létre (darabszámok), mi frissült, mi volt már meg; alatta a megjegyzések (újonnan létrehozott elemek,
 *  kimaradt sorok); egy gomb az újhoz és egy oda, ahol látszik. */
export function ImportResult({ stats = [{ label: 'Foglalás', value: 231 }, { label: 'Új vendég', value: 164 }, { label: 'Frissített vendég', value: 52 }, { label: 'Már megvolt', value: 17 }], errors = [], children, href, hrefLabel = 'Megnézem', onAgain, className = '' }: {
  stats?: ResultStat[]; errors?: string[]; children?: React.ReactNode; href?: string; hrefLabel?: string; onAgain?: () => void; className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <IconCircle tone="yellow" size="lg" icon={Check} />
        <span><span className="block text-ui-title text-ui-text">Az import kész</span><Meta>{errors.length ? `${errors.length} sort nem tudtunk beolvasni — ezek kimaradtak` : 'Minden sor rendben beolvasva'} · a vendégek nem kapnak értesítést</Meta></span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stats.map((s) => <div key={s.label} className="rounded-ui-inner bg-ui-cell p-3"><div className="text-ui-num font-light leading-none text-ui-text">{s.value.toLocaleString('hu-HU')}</div><Meta className="mt-1.5">{s.label}</Meta></div>)}
      </div>
      {children}
      {errors.length > 0 && (
        <div className="mt-3 rounded-ui-inner bg-ui-warn-bg px-3 py-2.5">
          <div className="text-ui-meta text-ui-text">Kimaradt sorok ({errors.length})</div>
          {errors.slice(0, 6).map((e, i) => <Meta key={i} className="mt-1">{e}</Meta>)}
          {errors.length > 6 && <Meta className="mt-1">+ {errors.length - 6} további…</Meta>}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-1.5">
        <Button variant="cell" icon={RotateCcw} onClick={onAgain}>Új import</Button>
        {href && <Button href={href}>{hrefLabel}<ArrowRight className="h-4 w-4" /></Button>}
      </div>
    </div>
  )
}

/** A popup lépés-sávja (Fájl → Oszlopok → Párosítás → Kész). */
export function ImportSteps({ active, className = 'mb-5' }: { active: number; className?: string }) {
  return <Steps active={active} labels={IMPORT_STEPS} className={className} />
}

/* ── Helyszíni nyilatkozat (design 23.6) — tableten, a vendég kezében ─────────────────────────────── */

const SAMPLE_CONSENT = `Alulírott hozzájárulok, hogy a kezelés előtt a szakember az egészségi állapotomra vonatkozó kérdéseket tegyen fel, és a válaszaimat a kezelés idejéig megőrizze.

Tudomásul veszem, hogy a festés / vegyszeres kezelés előtt bőrpróbát javasolnak, és ha ezt nem kérem, a kezelést a saját felelősségemre vállalom.

Allergiáról, terhességről, bőrbetegségről a kezelés előtt tájékoztatom a szakembert.`

/** A tableten: fent az üzlet és a foglalás (ki, mikor, mi), középen a szöveg (görgethető), alul a pipa és a nagy gomb.
 *  A személyzet a saját belépésével nyitja meg a foglalásból, a vendég elfogadja, a gép visszaadja a foglaláshoz. */
export function ConsentKiosk({ business = 'Anna Fodrászat', guest = 'Kovács Anna', when = 'Csütörtök, Nov. 6. · 10:30', what = 'Festés · Viktória', title = 'Beleegyező nyilatkozat', text = SAMPLE_CONSENT, accepted = false, onAccepted, onSubmit, busy = false, cancelHref, className = '' }: {
  business?: string; guest?: string; when?: string; what?: string; title?: string; text?: string
  accepted?: boolean; onAccepted?: (v: boolean) => void; onSubmit?: () => void; busy?: boolean; cancelHref?: string; className?: string
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <Meta>{business}</Meta>
        <Pill size="sm" tone="white">{when}</Pill>
      </div>
      <div className="mt-6 text-ui-num font-light leading-tight text-ui-text">{title}</div>
      <div className="mt-2 text-ui-title text-ui-text">{guest}<span className="text-ui-muted"> · {what}</span></div>
      <Card tone="white" className="mt-5 max-h-[46vh] min-h-[160px] overflow-y-auto" >
        {text.trim()
          ? <div className="whitespace-pre-wrap text-ui-body leading-relaxed text-ui-text">{text}</div>
          : <Meta>A szolgáltató még nem adta meg a nyilatkozat szövegét.</Meta>}
      </Card>
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-ui-inner bg-white px-4 py-4">
        <Checkbox checked={onAccepted ? accepted : undefined} defaultChecked={onAccepted ? undefined : accepted} onChange={onAccepted ? (e: React.ChangeEvent<HTMLInputElement>) => onAccepted(e.target.checked) : undefined} label={<span className="text-ui-row">Elolvastam, és elfogadom a fenti nyilatkozatot</span>} />
      </label>
      <Button size="lg" className="mt-3 w-full" loading={busy} disabled={!!onAccepted && !accepted} onClick={onSubmit}>Elfogadom</Button>
      <Button variant="ghost" className="mt-1 w-full" href={cancelHref}>Mégse</Button>
    </div>
  )
}

/** Kész: nagy pipa, köszönet, „add vissza a tabletet”; a személyzetnek egy gomb vissza a foglaláshoz. */
export function ConsentDone({ guest = 'Kovács Anna', at = '10:24', backHref, className = '' }: { guest?: string; /** az elfogadás ideje (ha korábban fogadta el: nincs) */ at?: string; backHref?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <IconCircle tone="yellow" size="lg" icon={Check} className="h-20 w-20 [&>svg]:h-9 [&>svg]:w-9" />
      <div className="mt-6 text-ui-num font-light text-ui-text">{at ? `Köszönjük, ${guest.trim().split(/\s+/).slice(-1)[0]}!` : 'Már elfogadva'}</div>
      <Meta className="mt-2">{at ? `A nyilatkozat elfogadva · ${at}. Most visszaadhatod a tabletet.` : 'Ez a vendég már elfogadta a nyilatkozatot.'}</Meta>
      <Button variant="cell" className="mt-8" href={backHref}>Vissza a foglaláshoz</Button>
    </div>
  )
}

