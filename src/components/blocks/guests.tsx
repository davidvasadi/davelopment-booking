import { AV } from './assets'
import { GuestTierPill } from './guest-tier'
import { Ban, CalendarDays, Clock, Download, FileText, Mail, MessageSquare, MoreHorizontal, Pencil, Phone, Star, Trash2, UserRound } from 'lucide-react'
import { Avatar, Button, Card, CardTitle, Checkbox, Field, FieldRow, IconButton, Input, ListRow, Meta, Modal, Note, OptionCard, Pagination, Panel, Pill, RowCheck, SearchField, Segmented, Select, StatusPill, Table, TaskRow, Td, Textarea, Th, Tr } from '@/components/ui-kit'
import GuestMapClient from '@/components/dashboard/GuestMapClient'
import type { CountryBucket, GuestTier } from '@/lib/guests'
import type { GuestVM } from '@/lib/guestsTypes'
import { DAY_NAMES, MONTHS_SHORT } from '@/lib/schedule'
import { Legend } from './charts'
import { RingCard } from './overview'
import { OccBadge } from './booking'
import { PeriodPicker } from './calendar'
import { MockSwitch } from './MockSwitch'
import { Switch } from '@/components/ui/toggle-switch'
import { OccasionBadge } from '@/components/shared/OccasionBadge'

/* Vendégek kártyái — a /design 7.1–7.8, az élő Vendégek oldal és a landing „Vendégek” funkció-oldala is ezeket
 * mutatja. Props nélkül a mintaadattal; élőben az adatokkal és a kezelőkkel. */

const TIER: Record<GuestTier, { label: string; tone: 'dark' | 'yellow' | 'cell' }> = { 3: { label: 'Törzsvendég', tone: 'dark' }, 2: { label: 'Visszatérő', tone: 'yellow' }, 1: { label: 'Új', tone: 'cell' } }
const thousands = (n: number) => Math.round(n).toLocaleString('hu-HU')
/** „Okt. 28.” */
export const dayShort = (ymd: string | null) => { if (!ymd) return '—'; const [, m, d] = ymd.slice(0, 10).split('-').map(Number); return `${MONTHS_SHORT[m - 1]} ${d}.` }
/** „Csütörtök, Nov. 6.” */
const dayLong = (ymd: string) => { const [y, m, d] = ymd.slice(0, 10).split('-').map(Number); return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]}, ${MONTHS_SHORT[m - 1]} ${d}.` }

/* ── 7.1: térkép, visszatérő arány, érkezések ── */

const SAMPLE_BUCKETS: CountryBucket[] = [
  { iso: 'HU', count: 1052, centroid: [47.5, 19.05], cities: [{ name: 'Budapest', count: 820 }, { name: 'Debrecen', count: 128 }, { name: 'Szeged', count: 64 }] },
  { iso: 'AT', count: 92, centroid: [48.2, 16.37], cities: [{ name: 'Wien', count: 70 }] },
  { iso: 'DE', count: 64, centroid: [52.52, 13.4] },
  { iso: 'GB', count: 41, centroid: [51.5, -0.12] },
  { iso: 'RO', count: 35, centroid: [46.77, 23.6] },
]

/** 7.1: vendégtérkép — a valódi térkép-komponens, országonként (nagyítva városonként). Élőben `buckets`, `focusIso`
 *  (az érkezésre kattintva oda nagyít), `label` (a bal felső pill). */
export function GuestMapCard({ buckets = SAMPLE_BUCKETS, focusIso = 'HU', label = '1 284 vendég · 5 ország', className = '' }: { buckets?: CountryBucket[]; focusIso?: string | null; label?: string; className?: string }) {
  return (
    <Card pad="none" className={`relative min-h-[420px] overflow-hidden ${className}`}>
      {/* a térkép a kártya teljes területét kitölti (a kártya magasságát a hívó adja, min. 420px) */}
      <div className="absolute inset-0"><GuestMapClient buckets={buckets} focusIso={focusIso} /></div>
      <Pill tone="white" className="absolute left-4 top-4 z-[500] shadow-ui-float">{label}</Pill>
    </Card>
  )
}

/** 7.1: visszatérő vendégek aránya (fánk: visszatérő sötét, új sárga). Élőben `pct`, `returning`, `fresh`. */
export function ReturningCard({ pct = 46, returning = 590, fresh = 694, className = '' }: { pct?: number; returning?: number; fresh?: number; className?: string }) {
  const C = 2 * Math.PI * 40
  const gap = pct > 0 && pct < 100 ? 8 : 0
  return (
    <Card className={`flex items-center gap-5 ${className}`}>
      <span className="relative h-[112px] w-[112px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {/* visszatérő (sötét) + új (sárga), kis réssel */}
          {pct < 100 && <circle cx="50" cy="50" r="40" fill="none" stroke="var(--ui-yellow)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0, ((100 - pct) / 100) * C - gap)} ${C}`} strokeDashoffset={`${-((pct / 100) * C + gap / 2)}`} />}
          {pct > 0 && <circle cx="50" cy="50" r="40" fill="none" stroke="var(--ui-dark)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0, (pct / 100) * C - gap)} ${C}`} strokeDashoffset={-gap / 2} />}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-ui-title font-light text-ui-text">{String(pct).replace('.', ',')}%</span><span className="text-ui-label text-ui-muted">visszatérő</span></span>
      </span>
      <span>
        <CardTitle>Visszatérő vendég</CardTitle>
        <span className="mt-2 block"><Legend items={[['bg-ui-dark', `${thousands(returning)} visszatérő`], ['bg-ui-yellow', `${thousands(fresh)} új`]]} /></span>
      </span>
    </Card>
  )
}

/** Az érkezések egy sora: név, „11:00 · Géllakk · Szabina”, megjött-e, ő-e a következő; étteremnél az ország zászlója
 *  (az óra-ikon helyén). */
export type ArrivalRow = { key: string; name: string; meta: string; done: boolean; next: boolean; flag?: string | null; country?: string | null }
const SAMPLE_ARRIVALS: ArrivalRow[] = ([['Kiss Réka', '11:00 · Géllakk · Szabina', false, true], ['Juhász Hanna', '13:30 · Balayage · Viktória', false, false], ['Tóth Bence', '14:00 · Férfi vágás · Csaba', false, false], ['Gál Zsófia', '09:30 · Hajvágás · Viktória', true, false]] as const).map(([name, meta, done, next]) => ({ key: name, name, meta, done, next }))

/** 7.1: a mai érkezések sötét listája — hányadiknál tartunk / összes, a következő elöl, a megjöttek alul (pipával).
 *  Élőben `rows`, `done`, `total`, `onPick` (a vendég adatlapja és a térkép-fókusz). */
export function ArrivalsCard({ rows = SAMPLE_ARRIVALS, done = 4, total = 12, onPick, className = '' }: { rows?: ArrivalRow[]; done?: number; total?: number; onPick?: (key: string) => void; className?: string }) {
  return (
    <Card tone="dark" className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between">
        <div><div className="text-ui-title">Érkezések</div><Meta dark className="mt-0.5">Ma · foglalás</Meta></div>
        <span className="text-ui-sub font-light">{done}<span className="text-white/40">/{total}</span></span>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto" data-stagger data-lenis-prevent>
        {rows.length === 0 && <Meta dark className="py-6">Mára nincs foglalás.</Meta>}
        {rows.map((r) => {
          const row = <TaskRow icon={Clock} lead={r.flag ? <span title={r.country ?? undefined} className="text-ui-title leading-none">{r.flag}</span> : undefined} title={r.name} meta={r.meta} done={r.done} trailing={r.next ? <Pill tone="yellow" size="sm">Következő</Pill> : undefined} />
          return onPick
            ? <button key={r.key} type="button" onClick={() => onPick(r.key)} className="block w-full rounded-ui-inner text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/20">{row}</button>
            : <div key={r.key}>{row}</div>
        })}
      </div>
    </Card>
  )
}

/** 7.2: a lista fölötti négy adat diagramként, egy sorban — vendég (fánk: belföldi sárga, külföldi sötét, középen az összes),
 *  visszatérő arány, törzsvendég (az összesből) és a ma érkezők (megérkezett / összes, sötét kártyán) gyűrűn. */
export function GuestCharts({ total = 1284, domestic = 82, foreign = 18, returning = 590, returningPct = 46, regular = 118, arrived = 4, arrivals = 12, className = '' }: { total?: number; /** belföldi / külföldi arány (%) — ha még nincs ország-adat, mindkettő 0 */ domestic?: number; foreign?: number; returning?: number; returningPct?: number; regular?: number; arrived?: number; arrivals?: number; className?: string }) {
  const none = <span />
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const C = 2 * Math.PI * 40
  // a Statisztikák vendég-fánkja: belföldi sárga, külföldi sötét (ha még nincs ország-adat, üres sárga gyűrű)
  const share = foreign / 100
  return (
    <div className={`grid grid-cols-2 gap-[5px] lg:grid-cols-4 ${className}`}>
      <Card className="flex flex-col">
        <span className="text-ui-title text-ui-text">Vendég</span>
        <div className="relative mx-auto mt-2 h-[120px] w-[120px]">
          <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
            {share < 1 && <circle cx="48" cy="48" r="40" fill="none" stroke="var(--ui-yellow)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(0, (1 - share) * C - 5)} ${C}`} strokeDashoffset={`${-share * C}`} />}
            {share > 0 && <circle cx="48" cy="48" r="40" fill="none" stroke="var(--ui-dark)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(0, share * C - 5)} ${C}`} />}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-ui-sub font-light leading-none text-ui-text">{thousands(total)}</span><span className="text-ui-label text-ui-muted">vendég</span></div>
        </div>
        <div className="mt-auto flex justify-center border-t border-dashed border-ui-divider pt-3"><Legend items={[['bg-ui-yellow', `Belföldi ${domestic}%`], ['bg-ui-dark', `Külföldi ${foreign}%`]]} /></div>
      </Card>
      <RingCard title="Visszatérő" sub="legalább 2 látogatás" pct={Math.round(returningPct)} foot={['vendégből', `${thousands(returning)}`]} action={none} />
      <RingCard title="Törzsvendég" sub="legalább 4 látogatás" pct={pct(regular, total)} foot={['vendégből', `${thousands(regular)}`]} action={none} />
      <RingCard dark title="Ma érkezik" sub="megérkezett" pct={pct(arrived, arrivals)} foot={['foglalásból', `${arrived} / ${arrivals}`]} action={none} />
    </div>
  )
}

/* ── 7.2: lista ── */

/** Egy sor a vendégtáblában: szint, látogatás, utolsó, költés (étteremnél átl. létszám), közelgő. */
export type GuestTableRow = { key: string; name: string; img?: string | null; tier: GuestTier; blocked?: boolean; visits: number; last: string; spend: string; next?: string | null }
const SAMPLE_GUESTS: GuestTableRow[] = [
  { key: 'h', name: 'Juhász Hanna', img: `${AV}/viktoria.webp`, tier: 3, visits: 14, last: 'Okt. 28.', spend: '312 000 Ft', next: 'Nov. 6.' },
  { key: 'a', name: 'Kovács Anna', tier: 2, visits: 4, last: 'Okt. 21.', spend: '58 400 Ft' },
  { key: 'b', name: 'Tóth Bence', img: `${AV}/csaba.webp`, tier: 2, visits: 3, last: 'Okt. 12.', spend: '19 500 Ft', next: 'Nov. 9.' },
  { key: 'z', name: 'Gál Zsófia', tier: 1, visits: 1, last: 'Okt. 30.', spend: '11 900 Ft' },
  { key: 'p', name: 'Nagy Péter', img: `${AV}/dave.webp`, tier: 2, visits: 2, last: 'Szept. 3.', spend: '13 000 Ft', blocked: true },
]

/** A lista eszköztára (7.2): időszak, keresés, szint, állapot, rendezés, export. Élőben az értékek és a kezelők. */
export type GuestFilters = { period: number; query: string; tier: string; status: string; sort: string; /** az oszlopcímre kattintva */ dir?: 'asc' | 'desc' }
export type GuestSortKey = 'name' | 'visits' | 'last' | 'spend' | 'tier' | 'pax'
export function GuestToolbar({ value, onChange, periodLabel, onExport }: { value?: GuestFilters; onChange?: (v: GuestFilters) => void; /** az „Adott nap” gomb felirata, ha ki van választva egy nap */ periodLabel?: string; onExport?: () => void }) {
  const v = value ?? { period: 0, query: '', tier: 'all', status: 'all', sort: 'last' }
  const set = (p: Partial<GuestFilters>) => onChange?.({ ...v, ...p })
  const live = !!onChange
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
      <Segmented options={['Mind', 'Ebben a hónapban', periodLabel ?? 'Adott nap']} active={v.period} onSelect={live ? (i) => set({ period: i }) : undefined} />
      {live ? <SearchField className="w-[220px]" value={v.query} onChange={(q) => set({ query: q })}>Név, telefon, e-mail, ország</SearchField> : <SearchField className="w-[220px]">Név, telefon, e-mail, ország</SearchField>}
      <Select toolbar value={live ? v.tier : undefined} defaultValue={live ? undefined : v.tier} onChange={live ? (e) => set({ tier: e.target.value }) : undefined} className="w-[160px]" aria-label="Szint">
        <option value="all">Minden szint</option><option value="3">Törzsvendég</option><option value="2">Visszatérő</option><option value="1">Új</option>
      </Select>
      <Select toolbar value={live ? v.status : undefined} defaultValue={live ? undefined : v.status} onChange={live ? (e) => set({ status: e.target.value }) : undefined} className="w-[160px]" aria-label="Állapot">
        <option value="all">Minden állapot</option><option value="active">Aktív</option><option value="blocked">Tiltott</option>
      </Select>
      <Select toolbar value={live ? v.sort : undefined} defaultValue={live ? undefined : v.sort} onChange={live ? (e) => set({ sort: e.target.value }) : undefined} className="w-[190px]" aria-label="Rendezés">
        <option value="last">Utolsó látogatás</option><option value="name">Név (A–Z)</option><option value="visits">Látogatásszám</option><option value="spend">Költés</option>
      </Select>
      <IconButton icon={Download} label="Export (CSV)" className="ml-auto" onClick={onExport} />
    </div>
  )
}

/** 7.2: a vendégtábla — szint pill (törzsvendég sötét, visszatérő sárga, új szürke), a tiltott halványan, piros jelzéssel;
 *  a megnyitott sor sárga, a kijelölt fehér; alul lapozó. Étteremnél a Költés helyett az átlagos létszám (7.8). */
export function GuestTable({ rows = SAMPLE_GUESTS, toolbar, restaurant = false, openKey = 'h', selected = ['a'], onOpen, onToggle, onToggleAll, page = 1, pages = 129, label = '1–10 / 1 284', onPage, empty, fill = false, th, className = '' }: {
  rows?: GuestTableRow[]
  toolbar?: React.ReactNode
  /** rendezés az oszlopcímre kattintva (a szerver rendez, `/api/guests` `sort` + `dir`) */
  th?: (key: GuestSortKey) => { sort: 'asc' | 'desc' | null; onSort: () => void }
  restaurant?: boolean
  openKey?: string | null
  selected?: string[]
  onOpen?: (key: string) => void
  onToggle?: (key: string) => void
  onToggleAll?: () => void
  page?: number
  pages?: number
  label?: string
  onPage?: (p: number) => void
  empty?: React.ReactNode
  /** a befoglaló magasságát tölti ki (élőben a mellette lévő adatlap magassága): a sorok benne görgetnek */
  fill?: boolean
  className?: string
}) {
  const all = rows.length > 0 && rows.every((r) => selected.includes(r.key))
  return (
    <Card pad="sm" className={`flex flex-col ${fill ? 'h-full' : ''} ${className}`}>
      {toolbar ?? <GuestToolbar />}
      {rows.length === 0 && empty ? empty : (
        <Table minWidth={680} className={fill ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
          <thead><tr><Th className="w-10"><RowCheck checked={all} onToggle={onToggleAll} label="Mind kijelölése" /></Th><Th {...th?.('name')}>Vendég</Th><Th {...th?.('tier')}>Szint</Th><Th {...th?.('visits')}>Látog.</Th><Th {...th?.('last')}>Utolsó</Th>{restaurant ? <Th {...th?.('pax')}>Átl. létszám</Th> : <Th {...th?.('spend')}>Költés</Th>}<Th>Közelgő</Th></tr></thead>
          <tbody>
            {rows.map((g) => {
              const open = g.key === openKey
              return (
                <Tr key={g.key} state={open ? 'open' : selected.includes(g.key) ? 'selected' : g.blocked ? 'muted' : 'default'} onClick={onOpen ? () => onOpen(g.key) : undefined}>
                  <Td><RowCheck checked={selected.includes(g.key)} onToggle={onToggle ? () => onToggle(g.key) : undefined} /></Td>
                  <Td><span className="flex items-center gap-2.5">{g.name}{g.blocked && <StatusPill status="bad">Tiltott</StatusPill>}</span></Td>
                  <Td><GuestTierPill tier={g.tier} /></Td>
                  <Td>{g.visits}</Td><Td>{g.last}</Td><Td>{g.spend}</Td>
                  <Td>{g.next ? <Pill size="sm" tone={open ? 'white' : 'cell'} icon={CalendarDays}>{g.next}</Pill> : <span className="text-ui-muted">—</span>}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      )}
      {pages > 1 && <Pagination page={page} pages={pages} label={label} onPage={onPage} className="mt-auto px-2 pt-2" />}
    </Card>
  )
}

/* ── 7.2 / 7.8: adatlap ── */

const SAMPLE_GUEST: GuestVM = {
  key: 'h', name: 'Juhász Hanna', avatarUrl: `${AV}/viktoria.webp`, tier: 3, country: 'HU', phone: '+36 20 555 1234', email: 'hanna.juhasz@gmail.com', since: '2023',
  visits: 14, lastVisit: '2026-10-28', spend: '312 000 Ft', noShow: 0, cancels: 1, avgPax: null,
  next: { date: '2026-11-06', time: '13:30', what: 'Balayage', occasion: null, occasionIcon: null, note: null }, answers: [],
  guestNote: 'Hosszú, vastag haj — kérlek, legyen több idő.', internalNote: 'Festék 7.1 + 20 vol, Viktóriát kéri.',
  history: [{ date: '2026-10-28', what: 'Balayage + vágás · Viktória', amount: '48 000 Ft' }, { date: '2026-09-30', what: 'Női hajvágás · Viktória', amount: '11 900 Ft' }, { date: '2026-09-02', what: 'Festés (tő) · Szabina', amount: '12 000 Ft' }],
  rating: { average: 5, count: 3, comment: 'Mint mindig, tökéletes!' }, blocked: false, blockReason: null, favTable: null, occasions: [],
  record: { birthday: '1992-03-14', gender: 'female', tag: 'VIP', billing: null, newsletter: { on: true, since: '2025-03-02' }, imported: { visits: 11, cancels: 1, revenue: 268000 } },
}
const SAMPLE_REST_GUEST: GuestVM = {
  ...SAMPLE_GUEST, key: 'v', name: 'Varga Péter', avatarUrl: `${AV}/csaba.webp`, phone: '+36 30 777 4120', email: 'peter.varga@gmail.com', visits: 11, spend: null, avgPax: '4,2 fő',
  next: { date: '2026-11-08', time: '19:00', what: 'T5 · 4 fő', occasion: 'Évforduló', occasionIcon: 'evfordulo', note: 'Ablak mellé, ha lehet.' }, guestNote: null, internalNote: null,
  history: [{ date: '2026-10-11', what: 'T5 · 4 fő · vacsora', amount: '38 400 Ft' }, { date: '2026-09-06', what: 'T3 · 2 fő · ebéd', amount: '14 200 Ft' }],
  rating: null, favTable: 'T5 · terasz, ablak mellett', occasions: [{ label: 'Évforduló', date: '2026-11-08', icon: 'evfordulo' }, { label: 'Szülinap', date: '2026-03-02', icon: null }],
}

/** 7.2: a vendég adatlapja — elérhetőség, számok (látogatás, költés / átl. létszám, nem jött), a közelgő foglalás sötét
 *  kártyán, megjegyzések (a vendégtől sötét, a belső jegyzet), előzmények, értékelés. Étteremnél (7.8) a számoknál az
 *  átlagos létszám, a közelgő foglalás asztallal és alkalom-ikonnal, kedvenc asztal, alkalmak. Élőben `guest`, `actions`
 *  (a ceruza és a „…” menü), `onOpenNext` (a közelgő foglalás megnyitása). */
export function GuestProfilePanel({ guest, restaurant = false, bare = false, actions, onOpenNext, className = '' }: { guest?: GuestVM; restaurant?: boolean; bare?: boolean; actions?: React.ReactNode; onOpenNext?: () => void; className?: string }) {
  const g = guest ?? (restaurant ? SAMPLE_REST_GUEST : SAMPLE_GUEST)
  const Box = bare ? 'div' : Panel
  const stats: [string, string][] = [[String(g.visits), 'látogatás'], restaurant ? [g.avgPax ?? '—', 'átl. létszám'] : [g.spend ? g.spend.replace(/ 000 Ft$/, ' e') : '—', 'költés eddig'], [String(g.noShow), 'nem jött']]
  return (
    <Box className={className}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0"><CardTitle className="truncate">{g.name}</CardTitle><span className="mt-1 flex flex-wrap gap-1"><GuestTierPill tier={g.tier} />{g.blocked && <StatusPill status="bad">Tiltott</StatusPill>}</span></span>
        {actions ?? <span className="flex gap-1"><IconButton icon={Pencil} label="Szerkesztés" variant="ghost" size="sm" /><IconButton icon={MoreHorizontal} label="Továbbiak" variant="ghost" size="sm" /></span>}
      </div>
      {g.blocked && <Note warn className="mt-3">Tiltólistán{g.blockReason ? ` — ${g.blockReason}` : ''}. Nem tud online foglalni.</Note>}
      <div className="mt-4 space-y-1.5 text-ui-body text-ui-text">
        {g.phone && <a href={`tel:${g.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4 text-ui-muted" />{g.phone}</a>}
        {g.email && <a href={`mailto:${g.email}`} className="flex items-center gap-2 break-all hover:underline"><Mail className="h-4 w-4 text-ui-muted" />{g.email}</a>}
        {!g.phone && !g.email && <Meta>Nincs elérhetőség</Meta>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {stats.map(([v, t]) => <Card key={t} tone="cell" inner pad="sm"><div className="truncate text-ui-title font-light text-ui-text">{v}</div><Meta className="text-ui-label">{t}</Meta></Card>)}
      </div>
      {g.next && (
        <Card tone="dark" inner pad="sm" className="mt-1.5 flex items-center justify-between gap-2">
          <span className="min-w-0"><Meta dark className="text-ui-label">Közelgő foglalás</Meta><span className="block truncate text-ui-body">{[dayLong(g.next.date), g.next.time, g.next.what].filter(Boolean).join(' · ')}</span>{g.next.note && <span className="mt-1 block text-ui-meta text-white/70">„{g.next.note}”</span>}</span>
          {restaurant && g.next.occasion
            ? (guest ? <OccasionBadge occasion={g.next.occasion} icon={g.next.occasionIcon} /> : <OccBadge occ="evfordulo" />)
            : <IconButton icon={CalendarDays} label="Megnyitás" variant="onDark" size="sm" onClick={onOpenNext} />}
        </Card>
      )}
      {(g.guestNote || g.internalNote) && (
        <div className="mt-4 space-y-1.5">
          {g.guestNote && <Card tone="dark" inner pad="sm"><Meta dark className="flex items-center gap-1.5 text-ui-label"><MessageSquare className="h-3.5 w-3.5" />A vendégtől</Meta><div className="mt-1 text-ui-body">„{g.guestNote}”</div></Card>}
          {g.internalNote && <Note strong>Belső: {g.internalNote}</Note>}
        </div>
      )}
      {g.answers.length > 0 && (
        <div className="mt-2">{g.answers.map((a) => <FieldRow key={a.label} label={a.label}><span className="text-right text-ui-body text-ui-text">{a.value}</span></FieldRow>)}</div>
      )}
      {restaurant && (g.favTable || g.occasions.length > 0) && (
        <div className="mt-2">
          {g.favTable && <FieldRow label="Kedvenc asztal"><span className="text-ui-body text-ui-text">{g.favTable}</span></FieldRow>}
          {g.occasions.length > 0 && <FieldRow label="Alkalmak"><span className="flex flex-wrap justify-end gap-1">{g.occasions.map((o, i) => <Pill key={o.label} size="sm" tone={i === 0 ? 'yellow' : 'cell'}>{o.label} · {dayShort(o.date)}</Pill>)}</span></FieldRow>}
        </div>
      )}
      <Meta className="mt-4">Előzmények</Meta>
      {g.history.length === 0 && <Meta className="py-2">{g.visits <= 1 ? 'Ez az első látogatása — még nincs korábbi.' : 'Nincs korábbi látogatás a rendszerben.'}</Meta>}
      {g.history.map((h) => (
        <ListRow key={h.date + h.what} title={h.what} meta={dayShort(h.date)} trailing={h.amount ? <span className="text-ui-body text-ui-text">{h.amount}</span> : undefined} />
      ))}
      {g.rating && <div className="mt-2 flex items-center gap-1.5 text-ui-meta text-ui-muted"><Star className="h-3.5 w-3.5 text-ui-yellow" />Értékelés: {String(Math.round(g.rating.average * 10) / 10).replace('.', ',')} / 5{g.rating.comment ? ` · „${g.rating.comment}”` : ''}</div>}
    </Box>
  )
}

/* ── 7.4: szerkesztés ── */

/** A szerkesztő mezői. */
export type GuestEditValue = { name: string; phone: string; email: string; birthday: string; tag: string; gender: 'female' | 'male' | 'other' | null; note: string; billing: { name: string; taxNumber: string; email: string; postalCode: string; city: string; street: string } | null }
const GENDERS = ['female', 'male', 'other'] as const

/** 7.4: vendég szerkesztése — balra az űrlap (a számlázási profil csak „Megadás”-ra nyílik ki), jobbra a vendég kártyái:
 *  szint, számok és a közelgő foglalás, a hírlevél-hozzájárulás (csak a vendég adhatja meg — itt csak látszik) és az
 *  importált adatok. `stacked`: egy hasábban. Élőben `guest`, `value`, `onChange`, `dateInput` (a születésnap a kit
 *  felugró naptárával), `onSave`, `onCancel`, `busy`. */
export function GuestEditModal({ stacked = false, guest, value, onChange, dateInput, onSave, onCancel, busy = false, className = '' }: {
  stacked?: boolean
  guest?: GuestVM
  value?: GuestEditValue
  onChange?: (v: GuestEditValue) => void
  dateInput?: (value: string, set: (v: string) => void) => React.ReactNode
  onSave?: () => void
  onCancel?: () => void
  busy?: boolean
  className?: string
}) {
  const g = guest ?? SAMPLE_GUEST
  const v: GuestEditValue = value ?? { name: g.name, phone: g.phone ?? '', email: g.email ?? '', birthday: '1992. 03. 14.', tag: g.record.tag ?? '', gender: g.record.gender, note: g.internalNote ?? '', billing: null }
  const live = !!onChange
  const set = (p: Partial<GuestEditValue>) => onChange?.({ ...v, ...p })
  const text = (k: 'name' | 'phone' | 'email' | 'tag', ph?: string) => <Input value={live ? v[k] : undefined} defaultValue={live ? undefined : v[k]} readOnly={!live} placeholder={ph} onChange={live ? (e) => set({ [k]: e.target.value }) : undefined} />
  const bill = (k: keyof NonNullable<GuestEditValue['billing']>, label: string) => (
    <Field label={label}><Input value={v.billing?.[k] ?? ''} onChange={(e) => set({ billing: { ...(v.billing ?? { name: '', taxNumber: '', email: '', postalCode: '', city: '', street: '' }), [k]: e.target.value } })} /></Field>
  )
  const nl = g.record.newsletter
  const imp = g.record.imported
  return (
    <Modal size={stacked ? 'md' : 'lg'} title={g.name} subtitle={`Vendég ${g.since} óta · ${g.visits} látogatás`} onClose={onCancel} className={className}
      footer={<><Button variant="cell" onClick={onCancel}>Mégse</Button><Button onClick={onSave} loading={busy}>Mentés</Button></>}>
      <div className={`grid gap-6 ${stacked ? '' : 'lg:grid-cols-[minmax(0,1fr)_280px]'}`}>
        <div className="space-y-4">
          <Field label="Név">{text('name')}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon">{text('phone', '+36 …')}</Field>
            <Field label="E-mail">{text('email', 'vendeg@example.com')}</Field>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
            <Field label="Születésnap">{dateInput ? dateInput(v.birthday, (b) => set({ birthday: b })) : <Input defaultValue={v.birthday} readOnly />}</Field>
            <Field label="Címke">{text('tag', 'pl. VIP')}</Field>
            <Field label="Nem"><Segmented tone="cell" options={['Nő', 'Férfi', 'Egyéb']} active={v.gender ? GENDERS.indexOf(v.gender) : -1} onSelect={live ? (i) => set({ gender: v.gender === GENDERS[i] ? null : GENDERS[i] }) : undefined} /></Field>
          </div>
          <Field label="Belső jegyzet" hint="Csak a személyzet látja."><Textarea value={live ? v.note : undefined} defaultValue={live ? undefined : v.note} readOnly={!live} onChange={live ? (e) => set({ note: e.target.value }) : undefined} className="min-h-[72px]" /></Field>
          {live && v.billing ? (
            <div className="space-y-3 rounded-ui-inner bg-ui-cell p-4">
              <div className="flex items-center justify-between"><span className="text-ui-row text-ui-text">Számlázási profil</span><Button variant="ghost" size="sm" onClick={() => set({ billing: null })}>Törlés</Button></div>
              <div className="grid grid-cols-2 gap-3">{bill('name', 'Számlázási név')}{bill('taxNumber', 'Adószám')}</div>
              {bill('email', 'Számlaküldési e-mail')}
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">{bill('postalCode', 'Irányítószám')}{bill('city', 'Település')}</div>
              {bill('street', 'Utca, házszám')}
            </div>
          ) : (
            <FieldRow boxed label="Számlázási profil" hint="Cégnek adószámmal — nincs megadva"><Button variant="glass" size="sm" onClick={live ? () => set({ billing: { name: '', taxNumber: '', email: '', postalCode: '', city: '', street: '' } }) : undefined}>Megadás</Button></FieldRow>
          )}
        </div>
        <div className="space-y-[5px]">
          <Meta className="mb-1">A vendég</Meta>
          <Card tone="cell" inner className="flex items-center gap-3">
            <Avatar size="lg" src={g.avatarUrl} name={g.name} />
            <span className="min-w-0"><span className="block truncate text-ui-row text-ui-text">{g.name}</span><GuestTierPill tier={g.tier} className="mt-1" /></span>
          </Card>
          <Card tone="dark" inner>
            <div className="grid grid-cols-3 gap-2">
              {([[String(g.visits), 'látogatás'], [g.spend ? g.spend.replace(/ 000 Ft$/, ' e') : g.avgPax ?? '—', g.spend ? 'költés' : 'átl. létszám'], [String(g.noShow), 'nem jött']] as const).map(([val, t]) => (
                <div key={t}><div className="truncate text-ui-title font-light">{val}</div><Meta dark className="text-ui-label">{t}</Meta></div>
              ))}
            </div>
            {g.next && <div className="mt-3 border-t border-white/10 pt-3 text-ui-meta text-white/70">Közelgő: {[dayLong(g.next.date), g.next.time].filter(Boolean).join(' · ')}</div>}
          </Card>
          {/* keskeny oszlop: egymás alatt (címke + magyarázat, alatta az érték), hogy ne törjön szét */}
          <FieldRow boxed stacked label="Hírlevél" hint={nl.on ? `${nl.since ? `${nl.since.slice(0, 4)}. ${dayShort(nl.since)} óta` : 'Feliratkozott'} — a vendég adta meg` : 'Csak a vendég iratkozhat fel (a foglaláskor)'}><StatusPill status={nl.on ? 'ok' : 'neutral'}>{nl.on ? 'Feliratkozott' : 'Nem iratkozott fel'}</StatusPill></FieldRow>
          {imp && <FieldRow boxed stacked label="Importból (más rendszerből)" hint={[imp.visits != null ? `${imp.visits} látogatás` : null, imp.cancels ? `${imp.cancels} lemondás` : null, imp.revenue ? `${thousands(imp.revenue)} Ft` : null].filter(Boolean).join(' · ')}><StatusPill status="neutral">Átvéve</StatusPill></FieldRow>}
        </div>
      </div>
    </Modal>
  )
}

/* ── 7.5: tiltás és törlés ── */

/** 7.5: vendég tiltása — indok (opcionális), figyelmeztetés (általános hibaüzenetet kap). Élőben `name`, `reason`,
 *  `onReason`, `onConfirm`, `onCancel`, `busy`. */
export function BlockGuestModal({ name = 'Nagy Péter', reason, onReason, onConfirm, onCancel, busy = false, className = '' }: { name?: string; reason?: string; onReason?: (v: string) => void; onConfirm?: () => void; onCancel?: () => void; busy?: boolean; className?: string }) {
  return (
    <Modal size="sm" title="Vendég tiltása" subtitle={name} onClose={onCancel} className={className} footer={<><Button variant="cell" onClick={onCancel}>Mégse</Button><Button variant="danger" icon={Ban} onClick={onConfirm} loading={busy}>Tiltás</Button></>}>
      <Field label="Tiltás indoka (opcionális)"><Textarea value={onReason ? reason ?? '' : undefined} onChange={onReason ? (e) => onReason(e.target.value) : undefined} placeholder="Pl. ismételt no-show, agresszív viselkedés…" className="min-h-[72px]" /></Field>
      <Note warn className="mt-3">A tiltott vendég (e-mail vagy telefon alapján) nem tud online foglalni — általános hibaüzenetet kap, nem tudja meg, hogy tiltva van. A tiltás bármikor feloldható.</Note>
    </Modal>
  )
}

/** 7.5: vendég végleges törlése — figyelmeztetés, és helyette felkínált tiltás. Élőben `name`, `visits`, `blockInstead`,
 *  `onBlockInstead`, `onConfirm` (a kapcsolótól függően tilt vagy töröl), `onCancel`, `busy`. */
export function DeleteGuestModal({ name = 'Nagy Péter', visits = 2, blockInstead, onBlockInstead, onConfirm, onCancel, busy = false, className = '' }: { name?: string; visits?: number; blockInstead?: boolean; onBlockInstead?: (on: boolean) => void; onConfirm?: () => void; onCancel?: () => void; busy?: boolean; className?: string }) {
  return (
    <Modal size="sm" title="Vendég törlése" subtitle={`${name} · ${visits} látogatás`} onClose={onCancel} className={className}
      footer={<><Button variant="cell" onClick={onCancel}>Mégse</Button>{blockInstead ? <Button variant="danger" icon={Ban} onClick={onConfirm} loading={busy}>Tiltás</Button> : <Button variant="danger" icon={Trash2} onClick={onConfirm} loading={busy}>Végleges törlés</Button>}</>}>
      <Note warn>Nem visszavonható: a vendég adatlapja és az ÖSSZES foglalása törlődik ennél az üzletnél.</Note>
      <FieldRow boxed label="Inkább csak tiltom" hint="Megmarad az adatlap, de nem tud foglalni" className="mt-3">{onBlockInstead ? <SwitchLive on={!!blockInstead} onChange={onBlockInstead} /> : <MockSwitch defaultOn={false} />}</FieldRow>
    </Modal>
  )
}

/* ── 7.6: export ── */

/** Az export-ablak állapota: mit, időszak (gyors-gomb + nap), mezők. */
export type ExportValue = { what: 'guests' | 'bookings'; preset: number; from: string; to: string; fields: string[] }
export const EXPORT_FIELDS: [string, string][] = [['name', 'Név'], ['phone', 'Telefon'], ['email', 'E-mail'], ['visits', 'Látogatások'], ['last', 'Utolsó látogatás'], ['note', 'Megjegyzés'], ['newsletter', 'Hírlevél-feliratkozás'], ['tag', 'Címkék']]
/** A foglalás-export mezői (a „mi” oszlop szalonnál szolgáltatás · munkatárs, étteremnél asztal · létszám). */
export const EXPORT_BOOKING_FIELDS: [string, string][] = [['date', 'Dátum'], ['time', 'Idő'], ['name', 'Vendég'], ['phone', 'Telefon'], ['email', 'E-mail'], ['what', 'Szolgáltatás / asztal'], ['status', 'Állapot'], ['note', 'Megjegyzés']]
/** Alapból kijelölt mezők (a megjegyzés és a címke nem). */
export const exportDefaultFields = (what: 'guests' | 'bookings') => (what === 'guests' ? EXPORT_FIELDS.map(([k]) => k).filter((k) => k !== 'note' && k !== 'tag') : EXPORT_BOOKING_FIELDS.map(([k]) => k).filter((k) => k !== 'note'))

/** 7.6: export — mit (vendégek vagy foglalások), milyen időszakra, mely mezőkkel; CSV, ami Excelben és Google
 *  Táblázatban is megnyílik. Élőben `value`, `onChange`, `onPick` (a naptár napja), `counts`, `rows` (a letöltendő sorok),
 *  `selected` (kijelölt vendégek száma), `onDownload`, `busy`, `onClose`. */
export function ExportModal({ value, onChange, onPick, counts = { guests: '345 vendég', bookings: '412 · 30 nap' }, rows = 128, selected = 0, onDownload, busy = false, onClose, className = '' }: {
  value?: ExportValue
  onChange?: (v: ExportValue) => void
  /** a naptárban választott nap (az időszak eleje, majd vége) */
  onPick?: (d: string) => void
  counts?: { guests: string; bookings: string }
  rows?: number | null
  selected?: number
  /** élőben a letöltés (telefonon a megosztás-lappal) */
  onDownload?: () => void
  busy?: boolean
  onClose?: () => void
  className?: string
}) {
  const v = value
  const live = !!(v && onChange)
  const set = (p: Partial<ExportValue>) => v && onChange?.({ ...v, ...p })
  const card = (what: 'guests' | 'bookings', icon: typeof UserRound, title: string, sub: string) => {
    const c = <OptionCard icon={icon} title={title} selected={(v?.what ?? 'guests') === what}>{sub}</OptionCard>
    return live ? <button key={what} type="button" onClick={() => set({ what, fields: what === v?.what ? v.fields : exportDefaultFields(what) })} className="block rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{c}</button> : <div key={what}>{c}</div>
  }
  return (
    <Modal size="sm" title="Export" subtitle="CSV — Excelben, Google Táblázatban megnyitható" onClose={onClose} className={className}>
      <Meta>Mit</Meta>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">{card('guests', UserRound, 'Vendégek', counts.guests)}{card('bookings', CalendarDays, 'Foglalások', counts.bookings)}</div>
      {selected > 0 && <Note className="mt-2">Csak a kijelölt {selected} vendég.</Note>}
      <Meta className="mt-3">Időszak</Meta>
      {live && v
        ? <PeriodPicker presets={['30 nap', 'Év', 'Minden', 'Egyedi']} active={v.preset} live={{ from: v.from, to: v.to, onPick: (d) => onPick?.(d), onPreset: (i) => set({ preset: i }) }} className="mt-1.5" />
        : <PeriodPicker presets={['30 nap', 'Év', 'Minden', 'Egyedi']} from={1} to={30} className="mt-1.5" />}
      <Meta className="mt-2">Mezők</Meta>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2">
        {((v?.what ?? 'guests') === 'guests' ? EXPORT_FIELDS : EXPORT_BOOKING_FIELDS).map(([k, l]) => live && v
            ? <Checkbox key={k} label={l} checked={v.fields.includes(k)} onChange={() => set({ fields: v.fields.includes(k) ? v.fields.filter((x) => x !== k) : [...v.fields, k] })} />
            : <Checkbox key={k} label={l} defaultChecked={!['note', 'tag'].includes(k)} />)}
      </div>
      <Note tip className="mt-3">A tiltott vendégek is benne vannak, „tiltva” jelöléssel.</Note>
      <Button className="mt-4 w-full" icon={FileText} onClick={onDownload} loading={busy}>{rows == null ? 'CSV letöltése' : `CSV letöltése · ${thousands(rows)} sor`}</Button>
    </Modal>
  )
}

/* ── 7.7: mobil ── */

/** Mobil: a vendéglista — kereső, szint-szűrő, soronként avatar, név, látogatás + utolsó, és a szint (a tiltott
 *  pirosan). Élőben `meta`, `query`, `onQuery`, `filter`, `onFilter`, `rows`, `onOpen`, `foot` (lapozó). */
export function MobileGuestList({ meta = '1 284 vendég · 46% visszatérő', query, onQuery, filter = 0, onFilter, rows, onOpen, foot }: { meta?: string; query?: string; onQuery?: (q: string) => void; filter?: number; onFilter?: (i: number) => void; rows?: GuestTableRow[]; onOpen?: (key: string) => void; foot?: React.ReactNode }) {
  const list = rows ?? SAMPLE_GUESTS
  return (
    <>
      <div className="mt-5 text-ui-num font-light leading-none text-ui-text">Vendégek</div>
      <Meta className="mt-1">{meta}</Meta>
      {onQuery ? <SearchField className="mt-4 w-full" value={query ?? ''} onChange={onQuery}>Név, telefon, e-mail</SearchField> : <SearchField className="mt-4 w-full">Név, telefon, e-mail</SearchField>}
      <Segmented full className="mt-2" options={['Mind', 'Törzsvendég', 'Új', 'Tiltott']} active={filter} onSelect={onFilter} />
      <Card className="mt-3" pad="xs">
        {list.length === 0 && <Meta className="px-3 py-4">Nincs a szűrésnek megfelelő vendég.</Meta>}
        {list.map((g) => {
          const row = <ListRow title={g.name} meta={g.blocked ? 'tiltva' : `${g.visits} látogatás · ${g.last}`} trailing={g.blocked ? <StatusPill status="bad">Tiltott</StatusPill> : <GuestTierPill tier={g.tier} />} />
          return onOpen
            ? <button key={g.key} type="button" onClick={() => onOpen(g.key)} className="block w-full text-left outline-none">{row}</button>
            : <div key={g.key}>{row}</div>
        })}
        {foot}
      </Card>
    </>
  )
}

/** Kapcsoló élőben (a törlés-ablakban) — a kit kapcsolója kliens-oldali, ezért külön, csak élő módban töltődik. */
function SwitchLive({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return <Switch checked={on} onChange={onChange} ariaLabel="Inkább csak tiltom" />
}
