'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, CalendarDays, GitCommitVertical, LayoutGrid, Link2, List, Plus, Search, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'
import { Avatar, Button, IconButton, IconCircle, Input, ListRow, Marquee, Meta, OptionCard, SearchField, PageHead, Panel, Pill, SegmentBar, Segmented, type Segment } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { MonthPicker } from './DatePickerPopover'
import { readSavedView, writeSavedView } from '@/lib/savedView'
import type { BookingSearchHit } from '@/app/api/bookings/search/route'
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
  // „Egyedi” időszak: csak ekkor nyílik ki a naptár a lapon (egy napot választ)
  const [custom, setCustom] = useState(false)
  const closeSheet = () => { setSheetOpen(false); setCustom(false) }
  // teljes keresés: a vendég neve / telefonja az üzlet ÖSSZES foglalásában (nem csak a betöltött napon) — a mező alatt
  // a találatok; rákoppintva a napjára ugrik és megnyílik
  const router = useRouter()
  const [hits, setHits] = useState<BookingSearchHit[] | null>(null)
  useEffect(() => {
    const q = filter.q.trim()
    if (!searchOpen || q.length < 2) { setHits(null); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/bookings/search?q=${encodeURIComponent(q)}`, { credentials: 'include', signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null)).then((j) => setHits(j?.results ?? [])).catch(() => {})
    }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [filter.q, searchOpen])
  const openHit = (h: BookingSearchHit) => {
    const base = window.location.pathname.startsWith('/restaurant') ? '/restaurant' : '/dashboard'
    const param = base === '/restaurant' ? 'reservation' : 'booking'
    onFilter({ ...filter, q: '' }); setSearchOpen(false); setHits(null)
    router.push(`${base}/bookings?date=${h.date}&range=day&${param}=${h.id}`)
  }
  const hitList = hits && filter.q.trim().length >= 2 ? (
    hits.length === 0
      ? <Meta className="px-3 py-3">Nincs ilyen foglalás.</Meta>
      : <div className="max-h-[60vh] space-y-1 overflow-y-auto" data-lenis-prevent>
          {hits.map((h) => {
            const d = new Date(`${h.date}T00:00:00`)
            return (
              <button key={h.id} type="button" onClick={() => openHit(h)} className="block w-full rounded-ui-inner text-left outline-none transition-colors hover:bg-ui-cell focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                <ListRow title={h.name} meta={`${HIT_DAY[d.getDay()]}, ${HIT_MONTH[d.getMonth()]} ${d.getDate()}. · ${h.start}${h.end ? `–${h.end}` : ''}${h.who ? ` · ${h.who}` : ''}`}
                  trailing={<Pill size="sm" tone={h.status === 'cancelled' || h.status === 'no_show' ? 'cell' : h.status === 'pending' ? 'yellow' : 'dark'}>{HIT_STATUS[h.status] ?? h.status}</Pill>} />
              </button>
            )
          })}
        </div>
  ) : null
  // a mentett nézet (a lap „Mentés” gombja): megjelenés, időszak, szűrők — erre az eszközre, szalon / étterem szerint
  type Saved = { view?: string; range?: BookingsRange; filter?: Omit<BookingFilter, 'q'> }
  const viewKey = () => `bookings:${window.location.pathname.split('/')[1] || 'dashboard'}`
  const saveView = () => {
    writeSavedView(viewKey(), { view: views && view != null ? views[view] : undefined, range, filter: { who: filter.who, status: filter.status, source: filter.source } } satisfies Saved)
    toast.success('Nézet elmentve ezen az eszközön')
    closeSheet()
  }
  // betöltéskor egyszer: ha a címben nincs kifejezett időszak, a mentett nézettel indul
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const saved = readSavedView<Saved>(viewKey())
    if (!saved) return
    if (saved.filter && filterCount(filter) === 0) onFilter({ ...filter, ...saved.filter })
    if (saved.view && views && onView) { const i = views.indexOf(saved.view); if (i >= 0 && i !== view) onView(i) }
    const hasRange = new URLSearchParams(window.location.search).has('range')
    if (!hasRange && saved.range && range && onRange && saved.range !== range) onRange(saved.range)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const count = filterCount(filter)

  // a felső sáv ikonja (mobil) is ezt a lapot nyitja
  useEffect(() => {
    const open = () => setSheetOpen(true)
    const search = () => setSearchOpen(true)
    window.addEventListener('davelopment:open-bookings-view', open)
    window.addEventListener('davelopment:open-bookings-search', search)
    return () => { window.removeEventListener('davelopment:open-bookings-view', open); window.removeEventListener('davelopment:open-bookings-search', search) }
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
                {hitList && <Panel className="ui-pop-in absolute right-0 top-full z-50 mt-2 w-[360px]">{hitList}</Panel>}
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
      {/* mobil: a fejléc kereső-ikonja nyitja (vendég neve vagy telefon), X-szel bezárható */}
      {searchOpen && (
        <div className="mb-3 flex items-center gap-1.5 lg:hidden">
          <SearchField autoFocus className="min-w-0 flex-1" value={filter.q} onChange={(v) => onFilter({ ...filter, q: v })}>Vendég neve vagy telefon…</SearchField>
          <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={() => { onFilter({ ...filter, q: '' }); setSearchOpen(false) }} />
        </div>
      )}
      {searchOpen && hitList && <Panel className="mb-3 lg:hidden">{hitList}</Panel>}

      {/* mobil „Nézet és szűrők” lap (design 6.11): megjelenés, időszak, keresés, munkatárs / terem, státusz, forrás */}
      <PopupModal open={sheetOpen} onClose={closeSheet} title="Nézet és szűrők" maxWidth="sm:max-w-[440px]" headerAction={<Button variant="ghost" size="sm" onClick={() => onFilter(EMPTY_FILTER)}>Alaphelyzet</Button>}>
        {views && onView && (
          <>
            <Meta>Megjelenés</Meta>
            <div className={`mt-1.5 grid gap-1.5 ${views.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {views.map((v, i) => (
                <button key={v} type="button" onClick={() => { onView(i); closeSheet() }} className="rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                  <OptionCard icon={VIEW_ICON[v] ?? List} title={v} selected={view === i} />
                </button>
              ))}
            </div>
          </>
        )}
        {range && onRange && (
          <>
            <Meta className="mt-4">Időszak</Meta>
            {/* Nap / Hét / Hónap: választásra a lap bezárul; „Egyedi”: kinyílik a naptár, egy nap választható */}
            <Segmented options={date && onDate ? ['Nap', 'Hét', 'Hónap', 'Egyedi'] : ['Nap', 'Hét', 'Hónap']} active={custom ? 3 : RANGES.indexOf(range)}
              onSelect={(i) => { if (i === 3) { setCustom(true); return } onRange(RANGES[i]); closeSheet() }} className="mt-1.5" />
          </>
        )}
        {custom && date && onDate && (
          <div className="mt-3"><MonthPicker value={date} onPick={(d) => { onRange?.('day'); onDate(d); closeSheet() }} loadEndpoint={loadEndpoint} /></div>
        )}
        <FilterFields filter={filter} onFilter={onFilter} who={who} whoLabel={whoLabel} gap="mt-4" />
        {/* „Mentés”: a beállított nézet és szűrők ezen az eszközön megmaradnak — legközelebb ezzel nyílik */}
        <Button className="mt-5 w-full" onClick={saveView}>Mentés · {matchCount} foglalás</Button>
      </PopupModal>
    </>
  )
}

const RANGES: BookingsRange[] = ['day', 'week', 'month']
const HIT_DAY = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const HIT_MONTH = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const HIT_STATUS: Record<string, string> = { pending: 'Függő', confirmed: 'Megerősített', completed: 'Befejezett', cancelled: 'Lemondva', no_show: 'Nem jött el', checked_in: 'Bent', seated: 'Leültetve' }
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
      // ha nem fér ki (mobilon a gombok mellett), a cím és az alcím elúszik — mint a nyitvatartás kivételeinél
      title={<Marquee>Ezen a napon nincs foglalás</Marquee>}
      meta={<Marquee>{next && d ? `Következő: ${HU_DAY[d.getDay()]} ${next.time} · ${next.title}` : 'Még nincs következő foglalás'}</Marquee>}
      trailing={
        <span className="flex shrink-0 gap-1.5">
          {publicUrl && <Button variant="glass" size="sm" icon={Link2} onClick={share}>Foglalóoldal megosztása</Button>}
          {next && d && <Button size="sm" icon={ArrowRight} onClick={() => router.push(`${base}/bookings?date=${next.date}&range=day`)}>Ugrás {HU_DAY_TO[d.getDay()]}</Button>}
        </span>
      }
    />
  )
}
