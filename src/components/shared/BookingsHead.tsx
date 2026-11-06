'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, CalendarDays, GitCommitVertical, LayoutGrid, Link2, List, Plus, Search, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'
import { Avatar, Button, IconButton, IconCircle, Input, ListRow, Meta, OptionCard, PageHead, Panel, Pill, SegmentBar, Segmented, type Segment } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { MonthPicker } from './DatePickerPopover'
import type { BookingsRange } from './BookingsDateNav'

/** Szűrő-állapot: munkatárs (szalon) vagy terem (étterem) id-k, státusz, forrás, keresés (vendég neve / telefon). */
export type BookingFilter = { who: string[]; status: string | null; source: string | null; q: string }
export const EMPTY_FILTER: BookingFilter = { who: [], status: null, source: null, q: '' }

export const STATUS_FILTERS = [
  { key: 'pending', label: 'Függő' },
  { key: 'late', label: 'Késik' },
  { key: 'completed', label: 'Befejezett' },
  { key: 'cancelled', label: 'Lemondva' },
] as const
export const SOURCE_FILTERS = [
  { key: 'online', label: 'Online' },
  { key: 'phone', label: 'Telefon' },
  { key: 'walk_in', label: 'Beeső' },
] as const

type Filterable = { status: string; source?: string | null; customer_name?: string | null; customer_phone?: string | null; start_time?: string | null }

/** A szűrő alkalmazása egy foglalás-listára. `whoOf`: a foglalás munkatársa / terme(i); `late`: késik-e (a hívó tudja,
 *  mi számít késésnek — megerősített, a kezdés elmúlt, még nincs lezárva). */
export function applyBookingFilter<T extends Filterable>(list: T[], f: BookingFilter, whoOf: (b: T) => string[], late: (b: T) => boolean): T[] {
  const q = f.q.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  return list.filter((b) => {
    if (f.who.length && !whoOf(b).some((id) => f.who.includes(id))) return false
    if (f.status && (f.status === 'late' ? !late(b) : b.status !== f.status)) return false
    if (f.source && b.source !== f.source) return false
    if (q && !(b.customer_name ?? '').toLowerCase().includes(q) && !(qDigits.length >= 3 && (b.customer_phone ?? '').replace(/\D/g, '').includes(qDigits))) return false
    return true
  })
}

export const filterCount = (f: BookingFilter) => (f.who.length ? 1 : 0) + (f.status ? 1 : 0) + (f.source ? 1 : 0)

/**
 * A Foglalások fejléce (a /design 6.1 / 6.13): cím, jobbra a kezelők — dátum (← dátum → Ma, Nap/Hét/Hónap),
 * nézet (Idővonal / Lista [/ Terem]), keresés (ikon → mező), Szűrők (panel: munkatárs vagy terem, státusz, forrás;
 * aktív szűrőnél szám), letöltés (CSV), + Új foglalás. Alatta a nap csíkja és a nagy számok. Mobilon csak a dátum
 * marad a fejlécben (a nézet és a szűrők a „Nézet” lapon, az új foglalás a felső + gombon).
 */
export function BookingsHead({ dateNav, views, view, onView, range, onRange, date, onDate, loadEndpoint, filter, onFilter, who, whoLabel = 'Munkatárs', matchCount, exportButton, onCreate, bar, kpis }: {
  dateNav: React.ReactNode
  views?: string[]
  view?: number
  onView?: (i: number) => void
  /** Nap / Hét / Hónap — a mobil „Nézet és szűrők” lapon (desktopon a dátum mellett) */
  range?: BookingsRange
  onRange?: (r: BookingsRange) => void
  /** a mobil lap „Nap” naptárához: a megjelenített nap, a váltás, és a napok terheltsége */
  date?: string
  onDate?: (d: string) => void
  loadEndpoint?: string
  filter: BookingFilter
  onFilter: (f: BookingFilter) => void
  /** a munkatárs- (szalon) vagy terem- (étterem) választó elemei */
  who?: { id: string; label: string; img?: string | null }[]
  whoLabel?: string
  /** a szűrésnek megfelelő foglalások száma (a panel gombján) */
  matchCount: number
  exportButton?: React.ReactNode
  onCreate?: () => void
  /** nélkülük csak a cím-sor (pl. az étterem fókusz-módjában) */
  bar?: Segment[]
  kpis?: React.ReactNode
}) {
  const [searchOpen, setSearchOpen] = useState(!!filter.q)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const count = filterCount(filter)

  // a felső sáv ikonja (mobil) is ezt a lapot nyitja
  useEffect(() => {
    const open = () => setSheetOpen(true)
    window.addEventListener('davelopment:open-bookings-view', open)
    return () => window.removeEventListener('davelopment:open-bookings-view', open)
  }, [])

  return (
    <>
      <PageHead
        title="Foglalások"
        actions={<>
          {/* mobilon napi nézetben a dátum a napcsíkon van; hét / hónap nézetben itt marad */}
          <span className={`flex flex-wrap items-center gap-1.5 ${range === 'day' ? 'max-lg:hidden' : ''}`}>{dateNav}</span>
          {views && onView && <Segmented options={views} active={view ?? 0} onSelect={onView} className="hidden lg:inline-flex" />}
          <span className="ml-1.5 hidden items-center gap-1.5 lg:flex">
            {searchOpen ? (
              <span className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted" />
                <Input autoFocus value={filter.q} onChange={(e) => onFilter({ ...filter, q: e.target.value })} placeholder="Vendég neve vagy telefon…" className="w-60 bg-white/70 pl-10 pr-10" />
                <button type="button" aria-label="Keresés bezárása" onClick={() => { onFilter({ ...filter, q: '' }); setSearchOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted hover:text-ui-text"><X className="h-4 w-4" /></button>
              </span>
            ) : <IconButton icon={Search} label="Keresés (vendég, telefon)" onClick={() => setSearchOpen(true)} />}

            <span className="relative">
              <Button variant="glass" icon={SlidersHorizontal} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
                Szűrők{count > 0 && <IconCircle size="xs" className="ml-0.5">{count}</IconCircle>}
              </Button>
              {filtersOpen && (
                <>
                  <span className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} aria-hidden />
                  <Panel className="ui-pop-in absolute right-0 top-full z-50 mt-2 w-[340px]">
                    <div className="flex items-center justify-between"><span className="text-ui-title font-light text-ui-text">Szűrők</span><Button variant="ghost" size="sm" onClick={() => onFilter({ ...filter, who: [], status: null, source: null })}>Törlés</Button></div>
                    <FilterFields filter={filter} onFilter={onFilter} who={who} whoLabel={whoLabel} />
                    <Button className="mt-4 w-full" onClick={() => setFiltersOpen(false)}>Mutasd · {matchCount} foglalás</Button>
                  </Panel>
                </>
              )}
            </span>
            {exportButton}
            {onCreate && <Button variant="yellow" icon={Plus} onClick={onCreate}>Új foglalás</Button>}
          </span>
        </>}
        bar={bar && <SegmentBar segments={bar} size="lg" />}
        kpis={kpis && <span className="hidden lg:contents">{kpis}</span>}
      />

      {/* mobil „Nézet és szűrők” lap (design 6.11): megjelenés, időszak, keresés, munkatárs / terem, státusz, forrás */}
      <PopupModal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Nézet és szűrők" maxWidth="sm:max-w-[440px]" headerAction={<Button variant="ghost" size="sm" onClick={() => onFilter(EMPTY_FILTER)}>Alaphelyzet</Button>}>
        {views && onView && (
          <>
            <Meta>Megjelenés</Meta>
            <div className={`mt-1.5 grid gap-1.5 ${views.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {views.map((v, i) => (
                <button key={v} type="button" onClick={() => onView(i)} className="rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                  <OptionCard icon={VIEW_ICON[v] ?? List} title={v} selected={view === i} />
                </button>
              ))}
            </div>
          </>
        )}
        {range && onRange && (
          <>
            <Meta className="mt-4">Időszak</Meta>
            <Segmented options={['Nap', 'Hét', 'Hónap']} active={RANGES.indexOf(range)} onSelect={(i) => onRange(RANGES[i])} className="mt-1.5" />
          </>
        )}
        {date && onDate && (
          <>
            <Meta className="mt-4">Nap</Meta>
            <div className="mt-1.5"><MonthPicker value={date} onPick={(d) => { onDate(d); setSheetOpen(false) }} loadEndpoint={loadEndpoint} /></div>
          </>
        )}
        <FilterFields filter={filter} onFilter={onFilter} who={who} whoLabel={whoLabel} gap="mt-4" />
        <Meta className="mt-4">Keresés</Meta>
        <span className="relative mt-1.5 block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted" />
          <Input value={filter.q} onChange={(e) => onFilter({ ...filter, q: e.target.value })} placeholder="Vendég neve vagy telefon…" className="pl-10" />
        </span>
        <Button className="mt-5 w-full" onClick={() => setSheetOpen(false)}>Mutasd · {matchCount} foglalás</Button>
      </PopupModal>
    </>
  )
}

const RANGES: BookingsRange[] = ['day', 'week', 'month']
const VIEW_ICON: Record<string, LucideIcon> = { Idővonal: GitCommitVertical, Lista: List, Terem: LayoutGrid }

/** A szűrő mezői (desktop panel és mobil lap közös): munkatárs vagy terem, státusz, forrás. */
function FilterFields({ filter, onFilter, who, whoLabel, gap = 'mt-3' }: { filter: BookingFilter; onFilter: (f: BookingFilter) => void; who?: { id: string; label: string; img?: string | null }[]; whoLabel: string; /** a csoportok közti távolság (panel: mt-3, mobil lap: mt-4) */ gap?: string }) {
  const set = (patch: Partial<BookingFilter>) => onFilter({ ...filter, ...patch })
  const chip = (on: boolean, label: React.ReactNode, onClick: () => void) => (
    <button key={String(label)} type="button" onClick={onClick} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={on ? 'dark' : 'cell'}>{label}</Pill></button>
  )
  return (
    <>
      {who && who.length > 1 && (
        <>
          <Meta className={gap}>{whoLabel}</Meta>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chip(filter.who.length === 0, 'Mind', () => set({ who: [] }))}
            {who.map((w) => {
              const on = filter.who.includes(w.id)
              const toggle = () => set({ who: on ? filter.who.filter((x) => x !== w.id) : [...filter.who, w.id] })
              return w.img !== undefined
                ? <button key={w.id} type="button" title={w.label} aria-label={w.label} aria-pressed={on} onClick={toggle} className={`rounded-full outline-none ${on ? 'ring-2 ring-ui-dark ring-offset-2' : ''}`}><Avatar size="sm" src={w.img} name={w.label} /></button>
                : chip(on, w.label, toggle)
            })}
          </div>
        </>
      )}
      <Meta className={gap}>Státusz</Meta>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chip(!filter.status, 'Mind', () => set({ status: null }))}
        {STATUS_FILTERS.map((s) => chip(filter.status === s.key, s.label, () => set({ status: filter.status === s.key ? null : s.key })))}
      </div>
      <Meta className={gap}>Forrás</Meta>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chip(!filter.source, 'Mind', () => set({ source: null }))}
        {SOURCE_FILTERS.map((s) => chip(filter.source === s.key, s.label, () => set({ source: filter.source === s.key ? null : s.key })))}
      </div>
    </>
  )
}

export type NextBooking = { date: string; time: string; title: string } | null
const HU_DAY = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const HU_DAY_TO = ['vasárnapra', 'hétfőre', 'keddre', 'szerdára', 'csütörtökre', 'péntekre', 'szombatra']

/** Üres nap (a /design 6.3): az idővonal fölött egy sor — mikor a következő foglalás (egy kattintással odaugrik),
 *  és a foglalóoldal megosztása (a link a vágólapra kerül). Nincs külön üres doboz: az idővonal alatta ugyanúgy látszik. */
export function EmptyDayBar({ next, base, publicUrl }: { next: NextBooking; base: string; publicUrl?: string | null }) {
  const router = useRouter()
  const d = next ? new Date(`${next.date}T00:00:00`) : null
  const share = async () => {
    if (!publicUrl) return
    try { await navigator.clipboard.writeText(publicUrl); toast.success('A foglalóoldal linkje a vágólapon') } catch { toast.error('Nem sikerült másolni') }
  }
  return (
    <ListRow
      filled
      leading={<IconCircle tone="cell" size="md" icon={CalendarDays} />}
      title="Ezen a napon nincs foglalás"
      meta={next && d ? `Következő: ${HU_DAY[d.getDay()]} ${next.time} · ${next.title}` : 'Még nincs következő foglalás'}
      trailing={
        <span className="flex shrink-0 gap-1.5">
          {publicUrl && <Button variant="glass" size="sm" icon={Link2} onClick={share}>Foglalóoldal megosztása</Button>}
          {next && d && <Button size="sm" icon={ArrowRight} onClick={() => router.push(`${base}/bookings?date=${next.date}&range=day`)}>Ugrás {HU_DAY_TO[d.getDay()]}</Button>}
        </span>
      }
    />
  )
}
