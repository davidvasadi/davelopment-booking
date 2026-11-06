'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Download, Globe as Globe2, Home, Link2, MoreHorizontal, Pencil, ShieldCheck, Trash2, Upload, Users } from 'lucide-react'
import { Button, EmptyState, FIELD, IconButton, Kpi, Menu, MenuItem, Meta, PageHead, Pagination, Panel, SegmentBar } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { Popup } from '@/components/shared/Popup'
import { ArrivalsCard, BlockGuestModal, DeleteGuestModal, GuestEditModal, GuestCharts, GuestMapCard, GuestProfilePanel, GuestTable, GuestToolbar, MobileGuestList, ReturningCard, dayShort, type GuestEditValue, type GuestFilters, type GuestSortKey, type GuestTableRow } from '@/components/blocks/guests'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { ExportDialog } from '@/components/shared/ExportDialog'
import { PeriodPicker } from '@/components/blocks/calendar'
import { countryName, flagEmoji, type CountryBucket } from '@/lib/guests'
import { MONTHS_SHORT } from '@/lib/schedule'
import { ymdLocal } from '@/lib/utils'
import type { ArrivalVM, GuestListPage, GuestListRow, GuestVM } from '@/lib/guestsTypes'

const thousands = (n: number) => Math.round(n).toLocaleString('hu-HU')

interface Props {
  restaurant?: boolean
  /** a szint szerinti megoszlás (a fejléc csíkja) */
  counts: { regular: number; returning: number; fresh: number; blocked: number }
  total: number
  domestic: number
  foreign: number
  returningPct: number
  returningNum: number
  newNum: number
  buckets: CountryBucket[]
  arrivals: ArrivalVM[]
  initialList: GuestListPage
  initialProfile: GuestVM | null
  canManage?: boolean
  /** „/dashboard” vagy „/restaurant” — a foglalás megnyitásához és a beállításokhoz */
  base: string
  /** a nyilvános foglalóoldal címe (az üres állapot megosztás-gombja) */
  bookingUrl: string
}


/** „1992. Márc. 14.” */
const birthdayLabel = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${y}. ${MONTHS_SHORT[m - 1]} ${dd}.` }

/** A lista egy sora a táblázatnak / a mobil listának. */
const toRow = (g: GuestListRow, restaurant: boolean): GuestTableRow => ({
  key: g.key, name: g.name, img: g.avatarUrl, tier: g.tier, blocked: g.blocked, visits: g.visits, last: dayShort(g.lastVisit),
  spend: restaurant ? (g.avgPax != null ? `${String(g.avgPax).replace('.', ',')} fő` : '—') : g.spend ? `${thousands(g.spend)} Ft` : '—',
  next: g.next ? dayShort(g.next) : null,
})

/**
 * Vendégek (design 7.1–7.8): fejléc a szint-csíkkal és a nagy számokkal, térkép, visszatérő arány, a mai érkezések,
 * a négy szám, a lista (szerveroldali szűrés, rendezés, lapozás — /api/guests) és mellette a kiválasztott vendég
 * adatlapja; szerkesztés, tiltás, törlés, export. Mobilon a lista, koppintásra alulról az adatlap (7.7). Szalon és
 * étterem közös (étteremnél a 7.8 eltérései).
 */
export function GuestsView({ restaurant = false, counts, total, domestic, foreign, returningPct, returningNum, newNum, buckets, arrivals, initialList, initialProfile, canManage = false, base, bookingUrl }: Props) {
  const router = useRouter()

  // ── lista: szűrők → /api/guests ──
  const [filters, setFilters] = useState<GuestFilters>({ period: 0, query: '', tier: 'all', status: 'all', sort: 'last' })
  const [day, setDay] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [list, setList] = useState<GuestListPage>(initialList)
  const reqId = useRef(0)
  const monthKey = ymdLocal(new Date()).slice(0, 7)
  const qs = (f: GuestFilters, pg: number, d: string | null) => {
    const p = new URLSearchParams({ page: String(pg), period: ['all', 'month', 'day'][f.period], status: f.status, tier: f.tier, sort: f.sort, ...(f.dir ? { dir: f.dir } : {}) })
    if (f.query.trim()) p.set('q', f.query.trim())
    if (f.period === 1) p.set('month', monthKey)
    if (f.period === 2 && d) p.set('day', d)
    return p
  }
  const load = async (f: GuestFilters, pg: number, d: string | null) => {
    const id = ++reqId.current
    const res = await fetch(`/api/guests?${qs(f, pg, d)}`, { credentials: 'include' }).catch(() => null)
    if (!res?.ok || id !== reqId.current) return
    const data = (await res.json()) as GuestListPage
    setList(data)
    setPage(data.page)
  }
  // oszlopcím-rendezés: ugyanaz a kulcs → fordít; új kulcs → a természetes iránya (név A–Z, a többi csökkenő)
  const guestTh = (key: GuestSortKey) => {
    const natural = key === 'name' ? 'asc' : 'desc'
    const on = filters.sort === key
    return { sort: on ? filters.dir ?? natural : null, onSort: () => setFilters((f) => ({ ...f, sort: key, dir: f.sort === key ? ((f.dir ?? natural) === 'asc' ? 'desc' : 'asc') : natural })) } as const
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => { void load(filters, 1, day) }, filters.query ? 250 : 0)
    return () => clearTimeout(t)
  }, [filters, day]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── adatlap: a kiválasztott vendég (gyorsítótárral) ──
  const [selKey, setSelKey] = useState(initialProfile?.key ?? initialList.items[0]?.key ?? '')
  const [profiles, setProfiles] = useState<Record<string, GuestVM>>(() => (initialProfile ? { [initialProfile.key]: initialProfile } : {}))
  const loadProfile = async (key: string, force = false) => {
    if (!key || (!force && profiles[key])) return
    const res = await fetch(`/api/guests?key=${encodeURIComponent(key)}`, { credentials: 'include' }).catch(() => null)
    if (res?.ok) { const { profile } = (await res.json()) as { profile: GuestVM }; setProfiles((p) => ({ ...p, [key]: profile })) }
  }
  useEffect(() => { if (selKey) void loadProfile(selKey) }, [selKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const sel = profiles[selKey] ?? null
  const [focusIso, setFocusIso] = useState<string | null>(null)
  // a térkép (Leaflet) egyszerre csak egyszer legyen az oldalon: desktopon fent, mobilon a lista alatt — a rejtett,
  // nulla méretű példány a nagyításnál hibát dobna
  const [desktop, setDesktop] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const upd = () => setDesktop(mq.matches)
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])
  const [mobileOpen, setMobileOpen] = useState(false)
  const open = (key: string, mobile = false) => { setSelKey(key); if (mobile) setMobileOpen(true) }
  const [selected, setSelected] = useState<string[]>([])
  const refresh = async () => { router.refresh(); await load(filters, page, day); if (selKey) await loadProfile(selKey, true) }

  // ── érkezések: a következő elöl, a megjöttek alul ──
  const [now, setNow] = useState('')
  useEffect(() => {
    const upd = () => { const d = new Date(); setNow(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`) }
    upd()
    const id = setInterval(upd, 60_000)
    return () => clearInterval(id)
  }, [])
  const arrivalRows = useMemo(() => {
    const passed = (a: ArrivalVM) => !!now && !!a.time && a.time <= now
    const up = arrivals.filter((a) => !passed(a)), done = arrivals.filter(passed).reverse()
    return [...up, ...done].map((a, i) => ({
      key: a.key, name: a.name, meta: [a.time, a.what].filter(Boolean).join(' · '), done: passed(a), next: i === 0 && !passed(a),
      // étteremnél az óra-ikon helyén az ország zászlója
      ...(restaurant && a.iso ? { flag: flagEmoji(a.iso), country: countryName(a.iso) } : {}),
    }))
  }, [arrivals, now, restaurant])
  const arrivedN = arrivalRows.filter((r) => r.done).length

  // ── műveletek ──
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const [edit, setEdit] = useState<GuestEditValue | null>(null)
  const [block, setBlock] = useState<string | null>(null)
  const [del, setDel] = useState<{ blockInstead: boolean } | null>(null)
  const save = async (body: Record<string, unknown>) => {
    if (!sel) return false
    setBusy(true)
    const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: sel.email, phone: sel.phone, ...body }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { toast.error('Nem sikerült menteni.'); return false }
    await refresh()
    return true
  }
  const startEdit = () => sel && setEdit({ name: sel.name, phone: sel.phone ?? '', email: sel.email ?? '', birthday: sel.record.birthday ?? '', tag: sel.record.tag ?? '', gender: sel.record.gender, note: sel.internalNote ?? '', billing: sel.record.billing })
  const saveEdit = async () => {
    if (!edit) return
    const ok = await save({ name: edit.name, newEmail: edit.email, newPhone: edit.phone, notes: edit.note, birthday: edit.birthday || null, gender: edit.gender, group_tag: edit.tag, billing: edit.billing })
    if (ok) { setEdit(null); toast.success('Mentve') }
  }
  const confirmBlock = async () => { if (await save({ blocked: true, block_reason: block?.trim() || null })) { setBlock(null); toast.success('Tiltólistára került') } }
  const confirmDelete = async () => {
    if (!sel || !del) return
    if (del.blockInstead) { if (await save({ blocked: true })) setDel(null); return }
    setBusy(true)
    const res = await fetch('/api/customers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: sel.email, phone: sel.phone }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { toast.error('Nem sikerült törölni.'); return }
    setDel(null); setSelKey(''); setMobileOpen(false)
    toast.success('A vendég törölve')
    router.refresh()
    await load(filters, 1, day)
  }

  // ── „Adott nap” panel (7.2.1): egy nap a naptárban, „Mutasd · N vendég” ──
  const [dayPanel, setDayPanel] = useState<string | null>(null)
  const [dayCount, setDayCount] = useState<number | null>(null)
  useEffect(() => {
    if (!dayPanel) return
    setDayCount(null)
    fetch(`/api/guests?${qs({ ...filters, period: 2 }, 1, dayPanel)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j) => setDayCount(j?.total ?? null)).catch(() => {})
  }, [dayPanel]) // eslint-disable-line react-hooks/exhaustive-deps
  const onFilters = (f: GuestFilters) => {
    if (f.period === 2 && filters.period !== 2) { setDayPanel(day ?? ymdLocal(new Date())); return }
    if (f.period !== 2) setDay(null)
    setFilters(f)
  }

  // ── export (7.6): a közös export-ablak; a mobil fejléc letöltés-ikonja (DashboardNav) is ezt nyitja ──
  const [exportOpen, setExportOpen] = useState(false)
  const openExport = () => setExportOpen(true)
  useEffect(() => {
    const on = () => setExportOpen(true)
    window.addEventListener('davelopment:open-guests-export', on)
    return () => window.removeEventListener('davelopment:open-guests-export', on)
  }, [])

  // ── fejléc ──
  const seg = (n: number) => (total ? (n / total) * 100 : 25)
  const head = (
    <PageHead
      title="Vendégek"
      sub="Törzsvendég-kezelés · CRM"
      actions={canManage ? <Button variant="glass" icon={Download} onClick={openExport} className="max-lg:hidden">Export</Button> : undefined}
      bar={<SegmentBar segments={[
        { label: 'Törzsvendég', value: thousands(counts.regular), weight: seg(counts.regular), tone: 'dark' },
        { label: 'Visszatérő', value: thousands(counts.returning), weight: seg(counts.returning), tone: 'yellow' },
        { label: 'Új', value: thousands(counts.fresh), weight: seg(counts.fresh), tone: 'hatch' },
        { label: 'Tiltott', value: thousands(counts.blocked), weight: seg(counts.blocked) || 4, tone: 'outline' },
      ]} />}
      kpis={<><Kpi icon={Users} value={thousands(total)} label="Összes vendég" /><Kpi icon={Home} value={total ? `${domestic}%` : '—'} label="Belföldi" /><Kpi icon={Globe2} value={total ? `${foreign}%` : '—'} label="Külföldi" /></>}
    />
  )
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ url: bookingUrl })
      else { await navigator.clipboard.writeText(bookingUrl); toast.success('A foglalóoldal címe a vágólapon') }
    } catch { /* a megosztás megszakítva */ }
  }

  // ── üres állapot (7.3): még nincs vendég ──
  if (total === 0) {
    return (
      <div className="p-4 lg:p-0">
        {head}
        <EmptyState icon={Users} title="Itt gyűlnek a vendégeid" action={<span className="flex flex-wrap justify-center gap-1.5"><Button icon={Upload} href={`${base}/settings?tab=integrations`}>Vendéglista importálása</Button><Button variant="glass" icon={Link2} onClick={share}>Foglalóoldal megosztása</Button></span>}>
          Minden foglalásból magától létrejön a vendégkártya — előzményekkel, megjegyzésekkel. Ha más rendszerből jössz, hozd át a régi listádat (CSV vagy Excel).
        </EmptyState>
      </div>
    )
  }

  const rows = list.items.map((g) => toRow(g, restaurant))
  const from = (list.page - 1) * 10 + 1
  const label = list.total ? `${thousands(from)}–${thousands(Math.min(list.total, from + list.items.length - 1))} / ${thousands(list.total)}` : '0'
  const countries = buckets.length
  const actions = canManage && sel ? (
    <span className="relative flex gap-1">
      <IconButton icon={Pencil} label="Szerkesztés" variant="ghost" size="sm" onClick={startEdit} />
      <IconButton icon={MoreHorizontal} label="Továbbiak" variant="ghost" size="sm" onClick={() => setMenu((m) => !m)} />
      {menu && <>
        <span className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
        <Menu className="absolute right-0 top-10 z-20">
          {sel.blocked
            ? <MenuItem icon={ShieldCheck} onClick={() => { setMenu(false); void save({ blocked: false }) }}>Tiltás feloldása</MenuItem>
            : <MenuItem icon={Ban} onClick={() => { setMenu(false); setBlock('') }}>Tiltólistára</MenuItem>}
          <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); setDel({ blockInstead: false }) }}>Vendég törlése</MenuItem>
        </Menu>
      </>}
    </span>
  ) : undefined
  const profile = sel
    ? <GuestProfilePanel guest={sel} restaurant={restaurant} actions={actions} onOpenNext={sel.next ? () => router.push(`${base}/bookings?date=${sel.next!.date}`) : undefined} />
    : <Panel><Meta>Válassz egy vendéget a listából.</Meta></Panel>
  const mobileFilter = filters.status === 'blocked' ? 3 : filters.tier === '3' ? 1 : filters.tier === '1' ? 2 : 0

  return (
    <div className="p-4 lg:p-0">
      {/* ── desktop ── */}
      <div className="max-lg:hidden">
        {head}
        <div className="grid gap-[5px] lg:h-[560px] lg:grid-cols-[minmax(0,1fr)_340px]">
          {desktop ? <GuestMapCard buckets={buckets} focusIso={focusIso} label={`${thousands(total)} vendég${countries ? ` · ${countries} ország` : ''}`} className="h-full" /> : <Panel className="h-full" />}
          <div className="flex min-h-0 flex-col gap-[5px]">
            <ReturningCard pct={returningPct} returning={returningNum} fresh={newNum} />
            <ArrivalsCard rows={arrivalRows} done={arrivedN} total={arrivals.length} className="min-h-0 flex-1"
              onPick={(k) => { const a = arrivals.find((x) => x.key === k); if (a?.guestKey) { open(a.guestKey); setFocusIso(a.iso) } }} />
          </div>
        </div>
        <GuestCharts className="mt-[5px]" total={total} domestic={domestic} foreign={foreign} returning={returningNum} returningPct={returningPct} regular={counts.regular} arrived={arrivedN} arrivals={arrivals.length} />
        <div className="mt-[5px] grid gap-[5px] lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* a lista az adatlap magasságáig ér (kompakt, egységes); a sorok benne görgetnek */}
          <div className="relative min-h-[480px]"><div className="absolute inset-0"><GuestTable th={guestTh}
            fill
            rows={rows}
            restaurant={restaurant}
            toolbar={<GuestToolbar value={filters} onChange={onFilters} periodLabel={day ? `Adott nap · ${dayShort(day)}` : undefined} onExport={canManage ? openExport : undefined} />}
            openKey={selKey}
            selected={selected}
            onOpen={(k) => open(k)}
            onToggle={(k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
            onToggleAll={() => setSelected((s) => (rows.every((r) => s.includes(r.key)) ? s.filter((k) => !rows.some((r) => r.key === k)) : [...new Set([...s, ...rows.map((r) => r.key)])]))}
            page={list.page}
            pages={list.pageCount}
            label={label}
            onPage={(p) => void load(filters, p, day)}
            empty={<Meta className="px-3 py-10 text-center">Nincs a szűrésnek megfelelő vendég.</Meta>}
          /></div></div>
          {profile}
        </div>
      </div>

      {/* ── mobil (7.7): elöl a térkép és a visszatérő arány, alatta a lista; koppintásra alulról az adatlap ── */}
      <div className="lg:hidden">
        {desktop === false && <GuestMapCard buckets={buckets} focusIso={focusIso} label={`${thousands(total)} vendég${countries ? ` · ${countries} ország` : ''}`} className="min-h-[320px]" />}
        <ReturningCard pct={returningPct} returning={returningNum} fresh={newNum} className="mt-[5px]" />
        <MobileGuestList
          meta={`${thousands(total)} vendég · ${String(returningPct).replace('.', ',')}% visszatérő`}
          query={filters.query}
          onQuery={(q) => setFilters((f) => ({ ...f, query: q }))}
          filter={mobileFilter}
          onFilter={(i) => setFilters((f) => ({ ...f, tier: i === 1 ? '3' : i === 2 ? '1' : 'all', status: i === 3 ? 'blocked' : 'all' }))}
          rows={rows}
          onOpen={(k) => open(k, true)}
          foot={list.pageCount > 1 ? <Pagination page={list.page} pages={list.pageCount} label={label} onPage={(p) => void load(filters, p, day)} className="px-2 pb-1 pt-2" /> : undefined}
        />
      </div>
      <PopupModal open={mobileOpen && !!sel} onClose={() => setMobileOpen(false)} title={sel?.name ?? ''} subtitle={sel?.country ? countryName(sel.country) ?? undefined : undefined}>
        {sel && <GuestProfilePanel bare guest={sel} restaurant={restaurant} actions={actions} onOpenNext={sel.next ? () => router.push(`${base}/bookings?date=${sel.next!.date}`) : undefined} />}
      </PopupModal>

      {/* ── ablakok ── */}
      {edit && sel && (
        <Popup onClose={() => setEdit(null)}>
          <GuestEditModal guest={sel} value={edit} onChange={setEdit} onSave={saveEdit} onCancel={() => setEdit(null)} busy={busy}
            dateInput={(v, set) => (
              <DatePickerPopover value={v || '1990-01-01'} onChange={set} yearRange={[1930, new Date().getFullYear()]} onClear={v ? () => set('') : undefined} triggerClassName={`${FIELD} h-11 w-full text-left`}>
                {v ? birthdayLabel(v) : <span className="text-ui-muted">Nincs megadva</span>}
              </DatePickerPopover>
            )} />
        </Popup>
      )}
      {block !== null && sel && (
        <Popup onClose={() => setBlock(null)}>
          <BlockGuestModal name={sel.name} reason={block} onReason={setBlock} onConfirm={confirmBlock} onCancel={() => setBlock(null)} busy={busy} />
        </Popup>
      )}
      {del && sel && (
        <Popup onClose={() => setDel(null)}>
          <DeleteGuestModal name={sel.name} visits={sel.visits} blockInstead={del.blockInstead} onBlockInstead={(on) => setDel({ blockInstead: on })} onConfirm={confirmDelete} onCancel={() => setDel(null)} busy={busy} />
        </Popup>
      )}
      {dayPanel && (
        <Popup onClose={() => setDayPanel(null)}>
          <Panel pad="lg" size="sm">
            <div className="text-ui-title font-light text-ui-text">Adott nap</div>
            <PeriodPicker single live={{ from: dayPanel, onPick: setDayPanel }} className="mt-1" />
            <Button className="mt-4 w-full" onClick={() => { setDay(dayPanel); setFilters((f) => ({ ...f, period: 2 })); setDayPanel(null) }}>
              {dayCount == null ? 'Mutasd' : `Mutasd · ${thousands(dayCount)} vendég`}
            </Button>
          </Panel>
        </Popup>
      )}
      {exportOpen && <ExportDialog keys={selected} guestsTotal={total} onClose={() => setExportOpen(false)} />}
    </div>
  )
}
