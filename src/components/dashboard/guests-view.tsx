'use client'

/**
 * VENDÉGEK képernyő — interaktív rész (animált fejléc + térkép + érkezések + lista + profil).
 * A page (szerver-komponens) számolja ki a view-modelleket a valós foglalásokból.
 * A fejléc az Áttekintéssel egyező: StatusPills (megoszlás) + CountUpKpi (felszámoló számok).
 * A referencia: docs/design_handoff_davelopment/davelopment App.dc.html (Vendégek szekció).
 */

import { isTouchDevice } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { sheetSpring, SHEET_MOBILE } from '@/lib/motion'
import { Search, Phone, Mail, Star, ChevronDown, ChevronLeft, ChevronRight, CalendarDays, Cake, Ban, Pencil, ShieldCheck, Check, Trash2, AlertTriangle, UserPlus, UserRound, X, MoreHorizontal, StickyNote, History, SlidersHorizontal } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { TIER_LABEL, flagEmoji, countryName, type GuestTier, type CountryBucket } from '@/lib/guests'
import { StatusPills, type StatusSeg } from '@/components/dashboard/StatusPills'
import { CountUpKpi, type KpiIcon } from '@/components/dashboard/CountUpKpi'
import GuestMapClient from '@/components/dashboard/GuestMapClient'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { PhoneInput } from '@/components/booking/PhoneCountryInput'
import { SectionBar, FieldRow } from '@/components/shared/FormSheet'

/* A Statisztika kör-diagramjával egyező tooltip. */
function DonutTip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-1.5 text-[12px] font-semibold text-white shadow-dav-card ring-1 ring-white/15">
      {p.name}: {p.value}%
    </div>
  )
}

const DAY_MONTH_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
/** „2026. okt. 25.” — a kiválasztott nap felirata a hónap-léptetőben. */
function fmtDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${y}. ${DAY_MONTH_SHORT[m - 1]} ${d}.`
}

// Ugyanaz a „genie” belépő, mint az Új foglalás / PopupModal panelen: nagy scale-ugrás +
// rugós túllövés (pulzáló pop), kilépéskor gyors, finom zsugorodás.
const MODAL_GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
}

export interface GuestHistoryVM {
  d: string // rövid dátum (bal oszlop)
  w: string // leírás
  a: string // összeg / jobb oszlop
  // Kibontható részletek az adott nap foglalásáról (idő, asztal, létszám, státusz…) + jegyzet.
  details?: RowVM[]
  note?: string | null
}

export interface RowVM {
  label: string
  value: string
}

export interface GuestVM {
  key: string
  name: string
  ini: string
  av: string // avatar háttér
  avText: string // avatar szöveg
  avatarUrl: string | null // Gravatar (van fallback a monogramra)
  tier: GuestTier
  country: string | null // ISO2 (zászlóhoz a név mellé), vagy null
  phone: string | null
  email: string | null
  since: string // "vendég X óta"
  visits: number
  lastVisit: string | null // ISO (időszak-szűréshez)
  visitDates: string[] // YYYY-MM-DD — minden (nem lemondott) foglalás napja, a napi szűréshez
  fav: string
  loyalty: number // 0–100 (a lista alatti vékony sáv)
  rows: RowVM[] // profil-adatsorok
  blocked: boolean // tiltólistán van-e
  blockReason: string | null // tiltás indoka
  birthdayDate: string | null // szülinapos foglalás dátuma (ISO), ha van
  guestNote: string | null // vendég-megjegyzés a foglalásból
  internalNote: string | null // belső megjegyzés
  advice: string // tier-alapú tanács (fallback, ha nincs valós jegyzet)
  meta: string // lista-sor meta
  note: string
  history: GuestHistoryVM[]
}

export interface ArrivalVM {
  key: string
  guestKey: string
  name: string
  ini: string
  av: string
  avText: string
  avatarUrl: string | null
  time: string // HH:MM (idő szerinti szűréshez)
  when: string
  country: string | null
  iso: string | null
  city: string | null
}

/** Animált fejléc-szám (CountUpKpi-hoz). */
/** Egy lista-sor a szerverről (lib/guestsData GuestListItem) + egy oldal. */
export interface GuestListRow {
  key: string
  name: string
  country: string | null
  tier: GuestTier
  blocked: boolean
  visits: number
  lastVisit: string | null
}
export interface GuestListPage { total: number; page: number; pageCount: number; items: GuestListRow[] }

export interface MetricVM {
  icon: KpiIcon
  value: number
  label: string
  suffix?: string
  decimals?: number
}

interface Props {
  pills: StatusSeg[]
  metrics: MetricVM[]
  /** Az első oldal (20 könnyű sor) — a többit a lista görgetve kéri a /api/guests-től. */
  initialList: GuestListPage
  /** A legfrissebb vendég profilja előre betöltve — így a profil sosem üres. */
  initialProfile: GuestVM | null
  arrivals: ArrivalVM[] // az adott nap ÖSSZES valós foglalása, idő szerint növekvőben
  arrivalsDateLabel: string // pl. "Ma"
  returningPct: number
  returningNum: number
  newNum: number
  buckets: CountryBucket[]
  /** Ha false, a vendégadatok szerkesztése, tiltás és törlés rejtve. */
  canManage?: boolean
  mapLabel: string
  mapEmpty?: ReactNode // placeholder ha nincs bucket
  /** A naptár-választó napi forgalom-színezéséhez (szalon: /api/salon/day-load, étterem: /api/restaurant/day-load). */
  dayLoadEndpoint?: string
}

/* ── tier badge színek (Crextio: Új bézs · Visszatérő zöld · Törzsvendég ink/gold) ── */
const TIER_BG: Record<GuestTier, string> = { 1: '#F0EAD8', 2: '#E4F2E9', 3: '#1D1C19' }
const TIER_FG: Record<GuestTier, string> = { 1: '#86826F', 2: '#1D9D63', 3: '#F1CE45' }

/** Mobil szűrő-lap: egy csoport címmel és pill-gombokkal. */
function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${on ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink'}`}
    >
      {children}
    </button>
  )
}

/** Lapozó-oldalszámok: első, utolsó, az aktuális ±1, közöttük „…” (pl. 1 … 4 5 6 … 95). */
function pageList(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= total))
  const nums = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}
const FILTER_SELECT = 'h-9 cursor-pointer appearance-none rounded-[18px] bg-white pl-4 pr-8 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none'
const MONTH_FULL = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const MONTH_SHORT = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

/** Szülinap-dátum → "júl. 4." (nap + hónap; az évet szándékosan elhagyjuk). */
function birthdayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}.`
}


export function GuestsView({
  pills,
  metrics,
  initialList,
  initialProfile,
  arrivals,
  arrivalsDateLabel,
  returningPct,
  returningNum,
  newNum,
  buckets,
  mapLabel,
  mapEmpty,
  canManage = false,
  dayLoadEndpoint,
}: Props) {
  const [query, setQuery] = useState('')
  // Kiválasztott NAP (a foglalás-oldalak naptár-választójával) — ha null, a teljes hónap látszik.
  const [day, setDay] = useState<string | null>(null)
  // Hónap-léptető: az aktuális hónapról indul, nyilakkal előre/hátra.
  const [ym, setYm] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selKey, setSelKey] = useState(initialProfile?.key ?? initialList.items[0]?.key ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [openRow, setOpenRow] = useState<number | null>(null) // kibontott látogatás-sor indexe
  useEffect(() => { setOpenRow(null); setHistoryOpen(false) }, [selKey]) // vendégváltáskor zárjuk az előzményeket
  const [focusIso, setFocusIso] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all')
  // Időszak: alapból MINDEN vendég (lapozva); választható az adott hónap vagy egy nap
  const [period, setPeriod] = useState<'all' | 'month' | 'day'>('all')
  const [tierFilter, setTierFilter] = useState<'all' | '1' | '2' | '3'>('all')
  const [sortBy, setSortBy] = useState<'last' | 'name' | 'visits' | 'spend'>('last')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' })
  const [blockTarget, setBlockTarget] = useState<GuestVM | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GuestVM | null>(null)
  const [blockReason, setBlockReason] = useState('')
  // Új vendég kézi felvétele (még foglalás nélkül) — a meglévő upsert-végponttal.
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', phone: '', email: '', note: '' })
  const [newError, setNewError] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  // mobil: a kiválasztott vendég profilja felugró lapban
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false)
  useEffect(() => setIsMounted(true), [])
  // Mobilon a fejléc "+" ikonja (DashboardNav) nyitja az Új vendég sheetet, nem a saját,
  // oldalon belüli gomb — ugyanaz a minta, mint a többi oldal fejléc-ikonjainál.
  useEffect(() => {
    if (!canManage) return
    const onOpen = () => { setNewError(null); setNewOpen(true) }
    window.addEventListener('davelopment:open-new-guest', onOpen)
    return () => window.removeEventListener('davelopment:open-new-guest', onOpen)
  }, [canManage])

  // Vendég-rekord upsert (tiltás/feloldás vagy kézi szerkesztés), majd frissítés.
  async function saveCustomer(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      router.refresh() // fejléc-számok, térkép, érkezések
      await refreshAfterChange(selKey)
    } finally {
      setBusy(false)
    }
  }

  async function createGuest() {
    const name = newForm.name.trim()
    const email = newForm.email.trim().toLowerCase()
    const phone = newForm.phone.trim()
    if (!name) return setNewError('A név megadása kötelező.')
    if (!email && !phone) return setNewError('Adj meg telefonszámot vagy e-mail címet.')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setNewError('Érvénytelen e-mail cím.')
    setBusy(true)
    setNewError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || null,
          phone: phone || null,
          name,
          newEmail: email || null,
          newPhone: phone || null,
          notes: newForm.note.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setNewError(err?.error ?? 'Nem sikerült menteni.')
        return
      }
      setNewOpen(false)
      setNewForm({ name: '', phone: '', email: '', note: '' })
      router.refresh()
      await refreshAfterChange(null)
    } finally {
      setBusy(false)
    }
  }

  function toggleBlock(g: GuestVM) {
    if (g.blocked) {
      // Feloldás közvetlenül (indok nem kell).
      saveCustomer({ email: g.email, phone: g.phone, blocked: false })
    } else {
      // Tiltáshoz Crextio-modal az indokért.
      setBlockReason('')
      setBlockTarget(g)
    }
  }

  async function confirmBlock() {
    if (!blockTarget) return
    await saveCustomer({ email: blockTarget.email, phone: blockTarget.phone, blocked: true, block_reason: blockReason.trim() || null })
    setBlockTarget(null)
  }

  // Vendég VÉGLEGES törlése: az összes foglalása + customer-rekord. Törlés után a listán
  // az első vendégre ugrunk (a törölt már nem lesz benne a friss adatban).
  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await fetch('/api/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteTarget.email, phone: deleteTarget.phone }),
      })
      setDeleteTarget(null)
      setSelKey('')
      router.refresh()
      await refreshAfterChange(null)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(g: GuestVM) {
    setForm({ name: g.name, phone: g.phone ?? '', email: g.email ?? '', note: g.internalNote ?? '' })
    setEditing(true)
  }

  async function saveEdit(g: GuestVM) {
    await saveCustomer({ email: g.email, phone: g.phone, name: form.name, newEmail: form.email, newPhone: form.phone, notes: form.note })
    setEditing(false)
  }

  function selectGuest(key: string, opts: { scroll?: boolean; iso?: string | null } = {}) {
    setSelKey(key)
    if (opts.iso !== undefined) setFocusIso(opts.iso)
    // Mobilon a profil NEM a lista alatt jelenik meg (görgetéssel), hanem alulról felugró lapban.
    if (opts.scroll) setMobileProfileOpen(true)
  }

  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
  // Nyilak: ha egy nap ki van választva, napot léptetnek; különben hónapot (mint a Foglalásoknál).
  const pickDay = (d: string) => {
    setDay(d)
    const [yy, mm] = d.split('-').map(Number)
    setYm({ y: yy, m: mm - 1 })
  }
  const step = (dir: -1 | 1) => {
    if (!day) return stepMonth(dir)
    const [yy, mm, dd] = day.split('-').map(Number)
    const t = new Date(yy, mm - 1, dd + dir)
    pickDay(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`)
  }
  const stepMonth = (dir: -1 | 1) =>
    setYm(({ y, m }) => {
      const t = m + dir
      if (t < 0) return { y: y - 1, m: 11 }
      if (t > 11) return { y: y + 1, m: 0 }
      return { y, m: t }
    })

  // ── LISTA: a szűrés, rendezés és lapozás a SZERVEREN fut (/api/guests) — a kliens csak a
  //    betöltött oldalakat tartja. Görgetés = lapozás: a lista aljára érve jön a következő 20,
  //    a lapozó mutatja, hányadik oldalnál jársz; távoli oldalszámra kattintva azt az oldalt tölti.
  // a mobil „Szűrők” gombon: hány szűrő tér el az alaptól
  const activeFilterCount = [period !== 'all', tierFilter !== 'all', statusFilter !== 'all', sortBy !== 'last'].filter(Boolean).length
  const PAGE_SIZE = 20
  const [rows, setRows] = useState<GuestListRow[]>(initialList.items)
  const [total, setTotal] = useState(initialList.total)
  const [pageCount, setPageCount] = useState(initialList.pageCount)
  const [range, setRange] = useState({ start: 1, end: 1 }) // a betöltött oldal-tartomány
  const [listLoading, setListLoading] = useState(false)
  const curPage = Math.min(Math.max(page, range.start), pageCount)
  const listBoxRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  const buildQs = (pg: number) => {
    const qs = new URLSearchParams({ page: String(pg), period, status: statusFilter, tier: tierFilter, sort: sortBy })
    if (query.trim()) qs.set('q', query.trim())
    if (period === 'month') qs.set('month', monthKey)
    if (period === 'day' && day) qs.set('day', day)
    return qs
  }
  const fetchPage = async (pg: number): Promise<GuestListPage | null> => {
    const res = await fetch(`/api/guests?${buildQs(pg)}`, { credentials: 'include' })
    return res.ok ? ((await res.json()) as GuestListPage) : null
  }
  // egy oldal betöltése: `mode` = csere (új szűrés / távoli oldal) vagy hozzáfűzés (görgetés)
  const loadPage = async (pg: number, mode: 'replace' | 'append') => {
    const id = ++reqId.current
    setListLoading(true)
    try {
      const data = await fetchPage(pg)
      if (!data || id !== reqId.current) return
      setTotal(data.total)
      setPageCount(data.pageCount)
      if (mode === 'append') {
        setRows((r) => [...r, ...data.items])
        setRange((rg) => ({ start: rg.start, end: data.page }))
      } else {
        setRows(data.items)
        setRange({ start: data.page, end: data.page })
        setPage(data.page)
        listBoxRef.current?.scrollTo({ top: 0 })
      }
    } finally {
      if (id === reqId.current) setListLoading(false)
    }
  }

  // szűrőváltás → 1. oldal (a keresés gépelés közben kicsit késleltetve); az első renderelésnél
  // a szerver már leküldte az 1. oldalt, nem kérjük le újra
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => { void loadPage(1, 'replace') }, query ? 250 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, period, monthKey, day, statusFilter, tierFilter, sortBy])

  // lista aljára érve → következő oldal
  useEffect(() => {
    const box = listBoxRef.current, el = sentinelRef.current
    if (!box || !el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !listLoading && range.end < pageCount) void loadPage(range.end + 1, 'append')
    }, { root: box, rootMargin: '0px 0px 120px 0px' })
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, pageCount, listLoading])

  // görgetés közben: melyik oldal sorai vannak a doboz tetején → az az aktuális oldal
  const onListScroll = () => {
    const box = listBoxRef.current
    if (!box) return
    let current = range.start
    box.querySelectorAll<HTMLElement>('[data-page-start]').forEach((m) => { if (m.offsetTop <= box.scrollTop + 8) current = Number(m.dataset.pageStart) })
    if (current !== page) setPage(current)
  }
  // oldalszámra kattintva: ha már betöltött, odagörget; ha nem, azt az oldalt tölti be
  const goToPage = (n: number) => {
    const target = Math.min(Math.max(1, n), pageCount)
    if (target >= range.start && target <= range.end) {
      setPage(target)
      const box = listBoxRef.current
      const mark = box?.querySelector<HTMLElement>(`[data-page-start="${target}"]`)
      if (box && mark) box.scrollTo({ top: mark.offsetTop, behavior: 'smooth' })
    } else if (target === range.end + 1) {
      void loadPage(target, 'append').then(() => requestAnimationFrame(() => goToPageScroll(target)))
    } else {
      void loadPage(target, 'replace')
    }
  }
  const goToPageScroll = (target: number) => {
    setPage(target)
    const box = listBoxRef.current
    const mark = box?.querySelector<HTMLElement>(`[data-page-start="${target}"]`)
    if (box && mark) box.scrollTo({ top: mark.offsetTop, behavior: 'smooth' })
  }
  const visibleGuests = rows

  // ── PROFIL: a legfrissebb előre betöltve; a többit kattintásra kéri (gyorsítótárral)
  const [profiles, setProfiles] = useState<Record<string, GuestVM>>(() => (initialProfile ? { [initialProfile.key]: initialProfile } : {}))
  const [profileLoading, setProfileLoading] = useState(false)
  const loadProfile = async (key: string, force = false) => {
    if (!key || (!force && profiles[key])) return
    setProfileLoading(true)
    try {
      const res = await fetch(`/api/guests?key=${encodeURIComponent(key)}`, { credentials: 'include' })
      if (res.ok) {
        const { profile } = (await res.json()) as { profile: GuestVM }
        setProfiles((p) => ({ ...p, [key]: profile }))
      }
    } finally {
      setProfileLoading(false)
    }
  }
  useEffect(() => { if (selKey) void loadProfile(selKey) }, [selKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // betöltés közben az ELŐZŐ profil marad látható (halványítva) — nem villan fel üres állapot
  const lastSelRef = useRef<GuestVM | undefined>(initialProfile ?? undefined)
  if (profiles[selKey]) lastSelRef.current = profiles[selKey]
  const sel: GuestVM | undefined = profiles[selKey] ?? (total > 0 ? lastSelRef.current : undefined)
  const profileStale = !!selKey && !profiles[selKey] && profileLoading

  // módosítás (tiltás, szerkesztés, új vendég, törlés) után: a betöltött lista és a profil frissítése
  const refreshAfterChange = async (keepKey: string | null) => {
    await loadPage(1, 'replace')
    setProfiles({})
    if (keepKey) { setSelKey(keepKey); void loadProfile(keepKey, true) }
  }

  // Élő „most" (HH:MM) — mount után áll be (nincs SSR-hydration ütközés), percenként frissül.
  const [nowHHMM, setNowHHMM] = useState('')
  useEffect(() => {
    const upd = () => {
      const d = new Date()
      setNowHHMM(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    }
    upd()
    const id = setInterval(upd, 60_000)
    return () => clearInterval(id)
  }, [])

  // Érkezések: a TELJES mai napot mutatjuk (görgethető). A KÖVETKEZŐ (upcoming) mindig elöl,
  // a már elmúltak alul (halványan + pipa). A számláló: hányadik foglalásnál tartunk.
  const isPassed = (a: ArrivalVM) => !!nowHHMM && !!a.time && a.time <= nowHHMM
  const arrivedSoFar = arrivals.filter(isPassed).length
  const orderedArrivals = useMemo(() => {
    return [...arrivals].sort((a, b) => {
      const pa = isPassed(a)
      const pb = isPassed(b)
      if (pa !== pb) return pa ? 1 : -1 // upcoming előre
      // upcoming: legközelebbi elöl (idő növekvő); passed: legutóbbi elöl (idő csökkenő)
      return pa ? b.time.localeCompare(a.time) : a.time.localeCompare(b.time)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivals, nowHHMM])

  // Visszatérő-donut (Statisztika-stílus).
  const newPct = Math.max(0, 100 - returningPct)
  const returningData = [
    { name: 'Visszatérő', pct: returningPct, color: '#F1CE45' },
    { name: 'Új', pct: newPct, color: '#33322e' },
  ]

  return (
    <div className="space-y-6 p-5 font-onest lg:p-0">
      {/* ── FEJLÉC A: cím ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[43px]">Vendégek</h1>
          <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Törzsvendég-kezelés · CRM</p>
        </div>
        {/* Mobilon (lg alatt) rejtve — a DashboardNav fejléc "+" ikonja nyitja helyette
            (`davelopment:open-new-guest`), hogy ne duplázódjon a gomb. */}
        {canManage && (
          <button
            type="button"
            onClick={() => { setNewError(null); setNewOpen(true) }}
            className="hidden shrink-0 items-center gap-2 rounded-full bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 lg:inline-flex"
          >
            <UserPlus className="h-[15px] w-[15px]" strokeWidth={1.8} />
            Új vendég
          </button>
        )}
      </div>

      {/* ── FEJLÉC B: animált megoszlás-pillek (bal) + felszámoló számok (jobb) ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills eager className="flex-1 lg:max-w-[620px]" segments={pills} />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          {metrics.map((m) => (
            <CountUpKpi key={m.label} icon={m.icon} value={m.value} label={m.label} suffix={m.suffix} decimals={m.decimals} />
          ))}
        </div>
      </div>

      {/* ── TÉRKÉP (bal, magas) + donut & érkezések (jobb, azonos magasság) ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* BAL: térkép */}
        <div className="relative isolate min-h-[420px] overflow-hidden rounded-[26px] border border-line shadow-dav-card lg:h-[640px] lg:min-h-0">
          <div className="absolute left-[18px] top-4 z-[500] rounded-[16px] bg-white/80 px-[15px] py-[7px] text-[17px] font-medium text-ink backdrop-blur">
            {mapLabel}
          </div>
          <div className="absolute inset-0 z-0">
            {/* A térkép maga üres `buckets`-szel is biztonságosan renderelődik (csak nincs pin
                rajta, alapnézeten marad) — ne a "hamarosan" szöveges placeholder legyen az
                alapállapot, induljon mindig a valódi térkép, foglalás nélkül is. */}
            <GuestMapClient buckets={buckets} focusIso={focusIso} />
          </div>
        </div>

        {/* JOBB: donut + érkezések */}
        <div className="flex flex-col gap-4 lg:h-[640px]">
          {/* Visszatérő vendég donut */}
          <div className="flex flex-col rounded-[26px] border border-line bg-[var(--dav-glass-strong)] backdrop-blur-lg p-5 shadow-[0_1px_2px_rgba(80,70,30,.05),0_18px_40px_-28px_rgba(80,70,30,.22)]">
            <div className="flex items-start justify-between">
              <div className="text-[15px] font-medium text-ink">Visszatérő vendég</div>
              <div className="text-right text-[11px] font-medium text-ink-soft">{returningNum + newNum} vendég</div>
            </div>
            <div className="relative mx-auto my-1 h-[130px] w-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={returningData} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={62} startAngle={90} endAngle={-270} cornerRadius={6} stroke="none" isAnimationActive animationDuration={800}>
                    {returningData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-[30px] font-light leading-none tracking-[-0.02em] text-ink">{returningPct.toLocaleString('hu-HU')}%</div>
                <div className="mt-0.5 text-[11px] font-medium text-ink-soft">visszatérő</div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                {returningNum} <span className="font-medium text-ink-soft">visszatérő</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#33322e' }} />
                {newNum} <span className="font-medium text-ink-soft">új</span>
              </span>
            </div>
          </div>

          {/* Érkezések — MAI nap, görgethető, kattintható */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] bg-[#1D1C19] p-5 px-[18px] text-white shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)]">
            <div className="flex items-start justify-between px-1">
              <div>
                <div className="text-[18px] font-medium">Érkezések</div>
                <div className="mt-0.5 text-[11.5px] font-medium text-white/45">{arrivalsDateLabel} · foglalás</div>
              </div>
              <div className="text-[22px] font-light leading-none" title="Hányadik foglalásnál tartunk / összes mai foglalás">
                {arrivedSoFar}
                <span className="text-white/40">/{arrivals.length}</span>
              </div>
            </div>
            <div data-lenis-prevent className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto">
              {arrivals.length === 0 ? (
                <div className="px-1 py-6 text-[13px] text-white/45">Mára nincs foglalás.</div>
              ) : (
                orderedArrivals.map((a, i) => {
                  const passed = isPassed(a)
                  return (
                    <button
                      type="button"
                      key={a.key}
                      onClick={() => a.guestKey && selectGuest(a.guestKey, { scroll: false, iso: a.iso })}
                      className={`flex items-center gap-[11px] rounded-[14px] px-1 py-[11px] text-left transition-colors ${a.guestKey ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'} ${passed ? 'opacity-45' : ''}`}
                      style={{ borderBottom: i < orderedArrivals.length - 1 ? '1px solid rgba(255,255,255,.07)' : 'none' }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[14px] font-semibold text-white">
                          <span className="truncate">{a.name}</span>
                          {passed && <Check className="h-3.5 w-3.5 flex-shrink-0 text-gold" strokeWidth={2.4} />}
                        </div>
                        <div className="text-[11.5px] text-white/45">{a.when}</div>
                      </div>
                      {(a.country || a.city) && (
                        <div className="text-right">
                          {a.country ? (
                            <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-white/70">
                              <span className="text-[14px] leading-none">{flagEmoji(a.country)}</span>
                              <span>{countryName(a.country)}</span>
                            </div>
                          ) : null}
                          {a.city ? <div className="mt-px text-[10.5px] font-medium text-white/45">{a.city}</div> : null}
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAPPA-FÜL konténer (mint a Munkatársak): fül = hónap-léptető + kereső + Új vendég ── */}
      <div ref={detailRef} className="relative scroll-mt-6">
        {/* FÜL */}
        <div className="relative z-10 flex w-full flex-wrap items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 py-2.5 backdrop-blur-[20px] sm:px-6">
          {/* SZŰRŐSÁV: Időszak · Keresés · Szint · Állapot · Rendezés — mobilon csak a kereső +
              „Szűrők” gomb, a többi alulról felcsúszó lapon (mint a többi aloldal) */}
          <div className="hidden flex-shrink-0 items-center gap-2 lg:flex">
          <div className="relative flex-shrink-0">
            <select
              value={period}
              onChange={(e) => { const v = e.target.value as 'all' | 'month' | 'day'; setPeriod(v); if (v !== 'day') setDay(null) }}
              aria-label="Időszak"
              className={FILTER_SELECT}
            >
              <option value="all">Minden vendég</option>
              <option value="month">Ebben a hónapban</option>
              <option value="day">Adott nap…</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          {/* hónap / nap választó csak akkor, ha az időszak nem „Minden vendég” */}
          {period !== 'all' && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button type="button" onClick={() => step(-1)} aria-label={period === 'day' ? 'Előző nap' : 'Előző hónap'} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] hover:bg-paper">
                <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <DatePickerPopover
                value={day ?? `${monthKey}-01`}
                onChange={(d) => { pickDay(d); setPeriod('day') }}
                loadEndpoint={dayLoadEndpoint}
                triggerClassName="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-semibold text-ink hover:bg-white"
              >
                <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
                {period === 'day' && day ? fmtDayLabel(day) : `${MONTH_FULL[ym.m]} ${ym.y}`}
              </DatePickerPopover>
              <button type="button" onClick={() => step(1)} aria-label={period === 'day' ? 'Következő nap' : 'Következő hónap'} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] hover:bg-paper">
                <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          )}
          </div>
          {/* Kereső — minden vendégben keres */}
          <div className="flex min-w-[140px] flex-1 items-center gap-2.5 rounded-[18px] bg-white px-4 py-2 shadow-[0_1px_4px_rgba(70,60,20,.06)]">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés név, telefon, email"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
            />
          </div>
          {/* mobil: szűrő-lap nyitó */}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative flex h-9 flex-shrink-0 items-center gap-1.5 rounded-[18px] bg-white px-3.5 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} /> Szűrők
            {activeFilterCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink-dark px-1 text-[10.5px] font-bold text-gold">{activeFilterCount}</span>
            )}
          </button>
          <div className="hidden flex-shrink-0 items-center gap-2 lg:flex">
          <div className="relative flex-shrink-0">
            <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as 'all' | '1' | '2' | '3')} aria-label="Szint" className={FILTER_SELECT}>
              <option value="all">Minden szint</option>
              <option value="1">Új</option>
              <option value="2">Visszatérő</option>
              <option value="3">Törzsvendég</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          <div className="relative flex-shrink-0">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'blocked')} aria-label="Állapot" className={FILTER_SELECT}>
              <option value="all">Minden állapot</option>
              <option value="active">Aktív</option>
              <option value="blocked">Tiltott</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          <div className="relative flex-shrink-0">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'last' | 'name' | 'visits' | 'spend')} aria-label="Rendezés" className={FILTER_SELECT}>
              <option value="last">Utolsó látogatás</option>
              <option value="name">Név (A–Z)</option>
              <option value="visits">Látogatásszám</option>
              <option value="spend">Költés</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          </div>
        </div>

        {/* MOBIL szűrő-lap — alulról felcsúszik (ugyanaz a nyelv, mint a többi aloldal lapjai) */}
        {isMounted && createPortal(
          <AnimatePresence>
            {filtersOpen && (
              <div className="fixed inset-0 z-[92] font-onest lg:hidden">
                <motion.div className="absolute inset-0 bg-black/[0.15] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setFiltersOpen(false)} />
                <motion.div
                  className="fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(0,0,0,.3)]"
                  variants={SHEET_MOBILE}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  data-lenis-prevent
                >
                  <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-zinc-200" />
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">Szűrők</h3>
                    <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Bezárás" className="hidden h-8 w-8 sm:flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <FilterGroup title="Időszak">
                    {([['all', 'Minden vendég'], ['month', 'Ebben a hónapban'], ['day', 'Adott nap']] as const).map(([v, l]) => (
                      <FilterPill key={v} on={period === v} onClick={() => { setPeriod(v); if (v !== 'day') setDay(null); if (v === 'day' && !day) pickDay(new Date().toLocaleDateString('sv-SE')) }}>{l}</FilterPill>
                    ))}
                  </FilterGroup>
                  {period !== 'all' && (
                    <div className="mb-4 flex items-center justify-between rounded-2xl border border-line px-2 py-1.5">
                      <button type="button" onClick={() => step(-1)} aria-label="Előző" className="flex h-9 w-9 items-center justify-center rounded-full text-ink"><ChevronLeft className="h-4 w-4" strokeWidth={2.2} /></button>
                      <DatePickerPopover
                        value={day ?? `${monthKey}-01`}
                        onChange={(d) => { pickDay(d); setPeriod('day') }}
                        loadEndpoint={dayLoadEndpoint}
                        triggerClassName="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold text-ink"
                      >
                        <CalendarDays className="h-4 w-4 text-ink-soft" />
                        {period === 'day' && day ? fmtDayLabel(day) : `${MONTH_FULL[ym.m]} ${ym.y}`}
                      </DatePickerPopover>
                      <button type="button" onClick={() => step(1)} aria-label="Következő" className="flex h-9 w-9 items-center justify-center rounded-full text-ink"><ChevronRight className="h-4 w-4" strokeWidth={2.2} /></button>
                    </div>
                  )}
                  <FilterGroup title="Szint">
                    {([['all', 'Mind'], ['1', 'Új'], ['2', 'Visszatérő'], ['3', 'Törzsvendég']] as const).map(([v, l]) => (
                      <FilterPill key={v} on={tierFilter === v} onClick={() => setTierFilter(v)}>{l}</FilterPill>
                    ))}
                  </FilterGroup>
                  <FilterGroup title="Állapot">
                    {([['all', 'Mind'], ['active', 'Aktív'], ['blocked', 'Tiltott']] as const).map(([v, l]) => (
                      <FilterPill key={v} on={statusFilter === v} onClick={() => setStatusFilter(v)}>{l}</FilterPill>
                    ))}
                  </FilterGroup>
                  <FilterGroup title="Rendezés">
                    {([['last', 'Utolsó látogatás'], ['name', 'Név (A–Z)'], ['visits', 'Látogatásszám'], ['spend', 'Költés']] as const).map(([v, l]) => (
                      <FilterPill key={v} on={sortBy === v} onClick={() => setSortBy(v)}>{l}</FilterPill>
                    ))}
                  </FilterGroup>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setPeriod('all'); setDay(null); setTierFilter('all'); setStatusFilter('all'); setSortBy('last') }}
                      className="h-12 flex-1 rounded-full border border-line bg-white text-[14px] font-semibold text-ink-soft"
                    >
                      Alaphelyzet
                    </button>
                    <button type="button" onClick={() => setFiltersOpen(false)} className="h-12 flex-[2] rounded-full bg-ink-dark text-[14px] font-semibold text-white">
                      {total} vendég mutatása
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}

        {/* TEST: lista + profil (azonos magasság) */}
        <div className="rounded-b-[28px] border border-white/40 bg-white/60 p-4 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[22px] sm:p-5">
          <div className="grid items-stretch gap-4 lg:grid-cols-[420px_1fr]">
            {/* LISTA — mobilon (egy-oszlopos nézet) NINCS saját kártya-keret/háttér/padding, mert
                az már duplázná a befoglaló konténerét (lásd fent, "TEST: lista + profil") —
                ez volt a "dupla konténer" vizuális hiba. A keret csak lg+ -on (2-oszlopos
                nézet) jelenik meg, ahol a lista és a profil valódi, egymás melletti kártya. */}
            <div className="flex h-[460px] flex-col lg:rounded-[22px] lg:border lg:border-white/55 lg:bg-[var(--dav-glass-strong)] lg:backdrop-blur-[14px] lg:p-2.5 lg:h-[560px]">
              {/* fejléc-sáv, mint a foglalási táblázatban */}
              <div className="grid grid-cols-[1fr_52px_74px] items-center gap-2 border-b border-line px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-widest text-ink">
                <span>{total} vendég{query.trim() ? ' · keresés' : ''}</span>
                <span className="text-right">Látog.</span>
                <span className="text-right">Utolsó</span>
              </div>
              <div ref={listBoxRef} onScroll={onListScroll} className="relative mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto" data-lenis-prevent>
                {rows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-ink-soft">{listLoading ? 'Betöltés…' : 'Nincs a szűrésnek megfelelő vendég.'}</div>
                ) : (
                  visibleGuests.map((g, i) => {
                    const active = selKey === g.key
                    return (
                      <button
                        type="button"
                        key={g.key}
                        // minden oldal első sora jelölő — ebből tudjuk görgetéskor, hányadik oldalnál jársz
                        data-page-start={i % PAGE_SIZE === 0 ? range.start + i / PAGE_SIZE : undefined}
                        onClick={() => selectGuest(g.key, { scroll: isMobile })}
                        className={`grid grid-cols-[1fr_52px_74px] items-center gap-2 rounded-[12px] px-3 py-2.5 text-left transition-colors ${
                          active ? 'bg-ink-dark' : 'hover:bg-black/[0.025]'
                        } ${!active && i > 0 && selKey !== visibleGuests[i - 1]?.key ? 'border-t border-line/70' : ''}`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`truncate text-[14px] font-semibold ${active ? 'text-white' : 'text-ink'}`}>{g.name}</span>
                          {g.country && <span title={countryName(g.country) ?? undefined} className="flex-shrink-0 text-[13px] leading-none">{flagEmoji(g.country)}</span>}
                          {g.blocked && <Ban className="h-3.5 w-3.5 flex-shrink-0 text-[#C0453F]" strokeWidth={2.2} aria-label="Tiltólistán" />}
                          <span className="flex-shrink-0 rounded-full px-2 py-px text-[10px] font-semibold" style={{ background: TIER_BG[g.tier], color: TIER_FG[g.tier] }}>{TIER_LABEL[g.tier]}</span>
                        </span>
                        <span className={`text-right text-[13px] font-semibold tabular-nums ${active ? 'text-white' : 'text-ink'}`}>{g.visits}</span>
                        <span className={`text-right text-[12px] tabular-nums ${active ? 'text-white/65' : 'text-ink-soft'}`}>
                          {g.lastVisit ? new Date(g.lastVisit).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) : '—'}
                        </span>
                      </button>
                    )
                  })
                )}
                {range.end < pageCount && (
                  <div ref={sentinelRef} className="flex items-center justify-center py-3 text-[12px] text-ink-soft2">Továbbiak betöltése…</div>
                )}
              </div>
              {/* Lapozó — ugyanaz a stílus, mint a Munkatársak listáján; sok oldalnál „…”-tal rövidítve */}
              {pageCount > 1 && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <button type="button" onClick={() => goToPage(curPage - 1)} disabled={curPage === 1} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-line-strong disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  {pageList(curPage, pageCount).map((n, i) =>
                    n === '…' ? (
                      <span key={`gap-${i}`} className="w-5 text-center text-[13px] text-ink-soft2">…</span>
                    ) : (
                      <button key={n} type="button" onClick={() => goToPage(n)} className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${curPage === n ? 'bg-ink-dark text-white' : 'border border-line bg-white text-ink-soft hover:border-line-strong'}`}>{n}</button>
                    ),
                  )}
                  <button type="button" onClick={() => goToPage(curPage + 1)} disabled={curPage === pageCount} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-line-strong disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>

            {/* PROFIL — asztalon a lista mellett; mobilon (lg alatt) alulról felugró lapban, a lista
                kiválasztására — így nem kell lefelé görgetni, és a lista megkapja a teljes helyet. */}
            {(() => {
              const profileEl = sel ? (
              <div ref={profileRef} className={`flex flex-col overflow-y-auto transition-opacity lg:rounded-[22px] lg:border lg:border-white/55 lg:bg-[var(--dav-glass-strong)] lg:backdrop-blur-[14px] lg:p-6 lg:h-[560px] scroll-mt-6 ${profileStale ? 'opacity-50' : ''}`} data-lenis-prevent>
            {(() => {
              // ── Profil: fejléc (név, zászló, szint) · 4 kulcsszám · Profil / Megjegyzések /
              //    Előzmények adatlap-sorokban — ugyanaz a stílus, mint az új foglalás-ablakban.
              const KPI_LABELS = ['Látogatás', 'Összes költés eddig', 'Összes létszám', 'Közelgő foglalás']
              const rowByLabel = (l: string) => sel.rows.find((r) => r.label === l)
              const kpis = [
                { label: 'Látogatás', value: String(sel.visits) },
                ...(rowByLabel('Összes költés eddig') ? [{ label: 'Költés eddig', value: String(rowByLabel('Összes költés eddig')!.value) }] : []),
                ...(rowByLabel('Összes létszám') ? [{ label: 'Össz. létszám', value: String(rowByLabel('Összes létszám')!.value) }] : []),
                { label: 'Utolsó látogatás', value: sel.lastVisit ? new Date(sel.lastVisit).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) : '—' },
                { label: 'Közelgő', value: String(rowByLabel('Közelgő foglalás')?.value ?? '—') },
              ].slice(0, 4)
              // a megjegyzés külön szekcióban, egyszer — a sorok közül kivesszük
              const profileRows = sel.rows.filter((r) => !KPI_LABELS.includes(r.label) && r.label !== 'Megjegyzés')
              const nextTier = sel.tier === 1 ? { need: 2, label: 'Visszatérő' } : sel.tier === 2 ? { need: 4, label: 'Törzsvendég' } : null
              const progress = nextTier ? Math.min(100, Math.round((sel.visits / nextTier.need) * 100)) : 100
              return (
                <>
                  {/* FEJLÉC */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-[26px] font-light tracking-[-0.02em] text-ink">{sel.name}</h2>
                        {sel.country && <span title={countryName(sel.country) ?? undefined} className="text-[17px] leading-none">{flagEmoji(sel.country)}</span>}
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: TIER_BG[sel.tier], color: TIER_FG[sel.tier] }}>{TIER_LABEL[sel.tier]}</span>
                        {sel.birthdayDate && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F7DEDE] px-2.5 py-0.5 text-[11px] font-semibold text-[#C2557A]">
                            <Cake className="h-3 w-3" strokeWidth={1.8} /> {birthdayLabel(sel.birthdayDate)}
                          </span>
                        )}
                        {sel.blocked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE3E3] px-2.5 py-0.5 text-[11px] font-semibold text-[#C0453F]">
                            <Ban className="h-3 w-3" strokeWidth={2} /> Tiltólistán
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-ink-soft">
                        {sel.phone && <a href={`tel:${sel.phone.replace(/\s+/g, '')}`} className="hover:text-ink hover:underline">{sel.phone}</a>}
                        {sel.phone && sel.email && <span className="text-ink-soft2">·</span>}
                        {sel.email && <a href={`mailto:${sel.email}`} className="break-all hover:text-ink hover:underline">{sel.email}</a>}
                        {!sel.phone && !sel.email && <span>Nincs elérhetőség</span>}
                        <span className="text-ink-soft2">· vendég {sel.since} óta</span>
                      </div>
                      {/* hűség — szövegesen, mennyi kell a következő szintig */}
                      <div className="mt-2.5 flex items-center gap-2.5">
                        <div className="h-[5px] w-28 overflow-hidden rounded-full bg-black/[0.06]">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[12px] text-ink-soft">
                          {nextTier ? `${sel.visits} / ${nextTier.need} látogatás a „${nextTier.label}” szintig` : 'Törzsvendég'}
                        </span>
                      </div>
                    </div>

                    {/* AKCIÓK — feliratos fő gombok, a ritka/veszélyes műveletek a ⋯ menüben */}
                    {canManage && (
                      <div className="relative flex flex-shrink-0 items-center gap-1.5">
                        {sel.phone && (
                          <a href={`tel:${sel.phone.replace(/\s+/g, '')}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-line-strong">
                            <Phone className="h-3.5 w-3.5" strokeWidth={1.8} /> Hívás
                          </a>
                        )}
                        {sel.email && (
                          <a href={`mailto:${sel.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-line-strong">
                            <Mail className="h-3.5 w-3.5" strokeWidth={1.8} /> Email
                          </a>
                        )}
                        <button type="button" onClick={() => startEdit(sel)} title="Szerkesztés" className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong">
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                        <button type="button" onClick={() => setMoreOpen((o) => !o)} title="Továbbiak" aria-expanded={moreOpen} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong">
                          <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                        <AnimatePresence>
                          {moreOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 480, damping: 30 } }}
                                exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12 } }}
                                style={{ transformOrigin: 'top right' }}
                                className="absolute right-0 top-11 z-20 w-48 rounded-[16px] border border-line bg-white p-1.5 shadow-dav-container"
                              >
                                <button type="button" disabled={busy} onClick={() => { setMoreOpen(false); toggleBlock(sel) }} className="flex w-full items-center gap-2 rounded-[11px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-[#F4F4F4] disabled:opacity-50">
                                  {sel.blocked ? <ShieldCheck className="h-4 w-4 text-[#1D9D63]" strokeWidth={1.8} /> : <Ban className="h-4 w-4 text-[#C0453F]" strokeWidth={1.8} />}
                                  {sel.blocked ? 'Tiltás feloldása' : 'Tiltólistára'}
                                </button>
                                <button type="button" disabled={busy} onClick={() => { setMoreOpen(false); setDeleteTarget(sel) }} className="flex w-full items-center gap-2 rounded-[11px] px-3 py-2 text-left text-[13px] font-medium text-[#C0453F] transition-colors hover:bg-[#FBE3E3] disabled:opacity-50">
                                  <Trash2 className="h-4 w-4" strokeWidth={1.8} /> Vendég törlése
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* Szerkesztő űrlap (kézi felülírás) */}
                  {editing && canManage && (
                    <div className="mt-4 rounded-[16px] border border-line bg-white p-4">
                      <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11.5px] font-semibold text-ink-soft">Név</span>
                          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Vendég neve" className="h-10 rounded-[12px] border border-line bg-white px-3 text-[13.5px] text-ink focus:outline-none" />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11.5px] font-semibold text-ink-soft">Telefon</span>
                          <PhoneInput value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} inputClass="h-10 rounded-[12px] border border-line bg-white px-3 text-[13.5px] text-ink" />
                        </label>
                        <label className="flex flex-col gap-1 sm:col-span-2">
                          <span className="text-[11.5px] font-semibold text-ink-soft">E-mail</span>
                          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vendeg@example.com" className="h-10 rounded-[12px] border border-line bg-white px-3 text-[13.5px] text-ink focus:outline-none" />
                        </label>
                        <label className="flex flex-col gap-1 sm:col-span-2">
                          <span className="text-[11.5px] font-semibold text-ink-soft">Belső jegyzet</span>
                          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Csak a személyzet látja" className="h-10 rounded-[12px] border border-line bg-white px-3 text-[13.5px] text-ink focus:outline-none" />
                        </label>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-full border border-line bg-white px-4 text-[13px] font-semibold text-ink-soft hover:text-ink">Mégse</button>
                        <button type="button" onClick={() => saveEdit(sel)} disabled={busy} className="h-10 rounded-full bg-ink-dark px-5 text-[13px] font-semibold text-white disabled:opacity-50">Mentés</button>
                      </div>
                    </div>
                  )}

                  {/* Tiltás-jelző + indok */}
                  {sel.blocked && (
                    <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-[#C0453F]">
                      <Ban className="mt-[1px] h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                      Tiltólistán{sel.blockReason ? ` — ${sel.blockReason}` : ' (nincs megadva indok)'}
                    </p>
                  )}

                  {/* 4 KULCSSZÁM */}
                  <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[16px] border border-line bg-white sm:grid-cols-4">
                    {kpis.map((k, i) => (
                      <div key={k.label} className={`px-4 py-3 ${i > 0 ? 'border-line sm:border-l' : ''} ${i >= 2 ? 'border-t border-line sm:border-t-0' : ''} ${i === 1 ? 'border-l' : ''}`}>
                        <div className="text-[11.5px] text-ink-soft">{k.label}</div>
                        <div className="mt-0.5 truncate text-[18px] font-light tracking-[-0.01em] text-ink">{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* PROFIL */}
                  {profileRows.length > 0 && (
                    <div className="mt-6">
                      <SectionBar icon={UserRound} label="Profil" />
                      {profileRows.map((r, i) => {
                        const starMatch = r.label === 'Értékelés' ? /^([★☆]+)(.*)$/.exec(String(r.value)) : null
                        const long = String(r.value).length > 34
                        return (
                          <FieldRow key={r.label} label={r.label} stacked={long} last={i === profileRows.length - 1}>
                            <div className={`text-[14px] font-medium text-ink ${long ? '' : 'text-right'}`}>
                              {starMatch ? <><span className="text-gold">{starMatch[1]}</span>{starMatch[2]}</> : r.value}
                            </div>
                          </FieldRow>
                        )
                      })}
                    </div>
                  )}

                  {/* MEGJEGYZÉSEK — egyszer, a vendégé és a belső külön */}
                  <div className="mt-6">
                    <SectionBar icon={StickyNote} label="Megjegyzések" />
                    {sel.guestNote || sel.internalNote ? (
                      <>
                        {sel.guestNote && (
                          <FieldRow label="Vendégtől" stacked last={!sel.internalNote}>
                            <div className="text-[14px] font-medium leading-[1.5] text-ink">„{sel.guestNote}”</div>
                          </FieldRow>
                        )}
                        {sel.internalNote && (
                          <FieldRow label="Belső (csak a személyzet)" stacked last>
                            <div className="text-[14px] font-medium leading-[1.5] text-ink">{sel.internalNote}</div>
                          </FieldRow>
                        )}
                      </>
                    ) : (
                      <FieldRow label="Tipp" stacked last>
                        <div className="flex items-start gap-1.5 text-[13.5px] leading-[1.5] text-ink-soft">
                          <Star className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 text-gold" strokeWidth={2} fill="currentColor" />
                          {sel.advice}
                        </div>
                      </FieldRow>
                    )}
                  </div>

                  {/* ELŐZMÉNYEK — táblázatos sorok, mint a foglalási listában */}
                  <div className="mt-6">
                    <SectionBar icon={History} label="Előzmények" />
                    {sel.history.length === 0 ? (
                      <p className="px-3 py-3 text-[13px] text-ink-soft">
                        {sel.visits <= 1 ? 'Ez az első látogatása — még nincs korábbi.' : 'Nincs korábbi látogatás a rendszerben.'}
                      </p>
                    ) : (
                      (historyOpen ? sel.history : sel.history.slice(0, 3)).map((h, i, arr) => {
                        const expandable = (h.details && h.details.length > 0) || !!h.note
                        const isOpen = openRow === i
                        return (
                          <div key={i} className={i < arr.length - 1 ? 'border-b border-line' : ''}>
                            <button
                              type="button"
                              disabled={!expandable}
                              onClick={() => setOpenRow((o) => (o === i ? null : i))}
                              className={`flex w-full items-center gap-3.5 rounded-[12px] px-3 py-2.5 text-left transition-colors ${expandable ? 'cursor-pointer hover:bg-black/[0.025]' : 'cursor-default'}`}
                            >
                              {/* dátum balra egy sorban, a tétel (pl. „4 fő foglalás”) jobbra */}
                              <div className="flex-shrink-0 whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-ink-soft">{h.d}</div>
                              <div className="min-w-0 flex-1 truncate text-right text-[14px] font-medium text-ink">{h.w}</div>
                              {h.a && <div className="text-[14px] font-semibold tabular-nums text-ink">{h.a}</div>}
                              {expandable && <ChevronDown className={`h-4 w-4 flex-shrink-0 text-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2} />}
                            </button>
                            {expandable && isOpen && (
                              <div className="mb-2.5 grid gap-x-4 gap-y-2 rounded-[12px] bg-[#F4F4F4] px-3.5 py-3 sm:grid-cols-2">
                                {h.details?.map((d) => (
                                  <div key={d.label} className="flex items-center justify-between gap-3">
                                    <span className="text-[12px] font-medium text-ink-soft">{d.label}</span>
                                    <span className="text-right text-[13px] font-semibold text-ink">{d.value}</span>
                                  </div>
                                ))}
                                {h.note && (
                                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                                    <span className="flex-shrink-0 text-[12px] font-medium text-ink-soft">Megjegyzés</span>
                                    <span className="text-right text-[13px] font-medium text-ink">{h.note}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                    {sel.history.length > 3 && (
                      <button type="button" onClick={() => setHistoryOpen((o) => !o)} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-black/[0.025]">
                        {historyOpen ? 'Kevesebb' : `További ${sel.history.length - 3} látogatás`}
                        <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </>
              )
            })()}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-[22px] border border-white/55 bg-[var(--dav-glass-strong)] backdrop-blur-[14px] p-7 text-[14px] text-ink-soft lg:h-[560px]">
                Még nincs vendég. Az első foglalás után itt jelennek meg.
              </div>
            )
              if (!isMobile) return profileEl
              return isMounted && createPortal(
                <AnimatePresence>
                  {mobileProfileOpen && sel && (
                    <div className="fixed inset-0 z-[92] font-onest lg:hidden">
                      <motion.div className="absolute inset-0 bg-black/[0.15] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setMobileProfileOpen(false)} />
                      <motion.div
                        variants={SHEET_MOBILE}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        style={{ transformOrigin: 'bottom center' }}
                        className="fixed inset-x-0 bottom-0 z-10 flex max-h-[85dvh] flex-col rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] will-change-transform"
                        data-lenis-prevent
                      >
                        <button type="button" aria-label="Bezárás" onClick={() => setMobileProfileOpen(false)} className="w-full shrink-0 py-3"><span className="mx-auto block h-1 w-10 rounded-full bg-[#e0ddd6]" /></button>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{profileEl}</div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>,
                document.body,
              )
            })()}
          </div>
        </div>
      </div>

      {/* Új vendég — a mezők közös tartalma (desktop modal ÉS mobil sheet is ugyanezt rendereli). */}
      {(() => {
        const formFields = (
          <>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11.5px] font-semibold text-ink-soft">Név</span>
                <input autoFocus={!isMobile} value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} placeholder="Vendég neve" className="rounded-[12px] border border-line bg-[#FCFCFB] px-3 py-2 text-[16px] text-ink placeholder:text-ink-soft2 focus:outline-none lg:text-[13.5px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-ink-soft">Telefon</span>
                <PhoneInput value={newForm.phone} onChange={(v) => setNewForm((f) => ({ ...f, phone: v }))} inputClass="h-[42px] rounded-[12px] border border-line bg-[#FCFCFB] px-3 text-[16px] text-ink placeholder:text-ink-soft2 lg:text-[13.5px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-ink-soft">E-mail</span>
                <input type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} placeholder="vendeg@example.com" className="rounded-[12px] border border-line bg-[#FCFCFB] px-3 py-2 text-[16px] text-ink placeholder:text-ink-soft2 focus:outline-none lg:text-[13.5px]" />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-[11.5px] font-semibold text-ink-soft">Belső jegyzet (opcionális)</span>
                <input value={newForm.note} onChange={(e) => setNewForm((f) => ({ ...f, note: e.target.value }))} placeholder="Csak a személyzet látja" className="rounded-[12px] border border-line bg-[#FCFCFB] px-3 py-2 text-[16px] text-ink placeholder:text-ink-soft2 focus:outline-none lg:text-[13.5px]" />
              </label>
            </div>
            {newError && <p className="mt-3 text-[12.5px] font-medium text-[#C0453F]">{newError}</p>}
          </>
        )
        return (
          <>
            {/* Desktop — középre nyíló modal. A body-ra portálozva: a szülő konténer (backdrop-blur /
                transform) különben a fixed hátteret a saját területére szorította → felül kimaradt egy csík. */}
            {isMounted && createPortal(
              <AnimatePresence>
              {newOpen && (
              <div className="fixed inset-0 z-[1000] hidden lg:flex items-center justify-center p-4 font-onest">
                <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} onClick={() => setNewOpen(false)} />
                <motion.div variants={MODAL_GENIE} initial="hidden" animate="show" exit="exit" style={{ transformOrigin: 'center' }} className="relative z-10 w-full max-w-[460px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_30px_70px_-20px_rgba(40,35,15,.5)]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 text-ink">
                      <UserPlus className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div>
                      <div className="text-[16px] font-semibold text-ink">Új vendég</div>
                      <div className="text-[12.5px] text-ink-soft">Telefonszám vagy e-mail cím szükséges</div>
                    </div>
                  </div>
                  <div className="mt-4">{formFields}</div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setNewOpen(false)} className="rounded-[13px] bg-[#F1F1EF] px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink">Mégse</button>
                    <button type="button" onClick={createGuest} disabled={busy} className="rounded-[13px] bg-ink-dark px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">Mentés</button>
                  </div>
                </motion.div>
              </div>
              )}
              </AnimatePresence>,
              document.body,
            )}
            {/* Mobil — alulról felcsúszó sheet, mint a többi oldal (pl. Beállítások) menüje/
                sheetjei: backdrop-blur, fogantyú, kattintás a hátterén zár. */}
            {isMounted && createPortal(
              <AnimatePresence>
                {newOpen && (
                  <div className="fixed inset-0 z-[1000] font-onest lg:hidden">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="absolute inset-0 bg-ink-dark/40 backdrop-blur-sm"
                      onClick={() => setNewOpen(false)}
                    />
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={sheetSpring.transition}
                      data-lenis-prevent
                      className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))]"
                    >
                      <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-ink">
                              <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.8} />
                            </div>
                            <div>
                              <div className="text-[15px] font-semibold text-ink">Új vendég</div>
                              <div className="text-[12px] text-ink-soft">Telefonszám vagy e-mail cím szükséges</div>
                            </div>
                          </div>
                          <button type="button" onClick={() => setNewOpen(false)} aria-label="Bezárás" className="hidden h-8 w-8 sm:flex shrink-0 items-center justify-center rounded-full bg-[#F4F2EC] text-ink-soft transition-opacity hover:opacity-70">
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <div className="px-4 pb-4 pt-1">
                        {formFields}
                        <div className="mt-5 flex gap-2.5">
                          <button type="button" onClick={() => setNewOpen(false)} className="h-11 flex-1 rounded-[14px] bg-[#F1F1EF] text-[13.5px] font-semibold text-ink-soft transition-colors hover:text-ink">Mégse</button>
                          <button type="button" onClick={createGuest} disabled={busy} className="h-11 flex-1 rounded-[14px] bg-ink-dark text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">Mentés</button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>,
              document.body,
            )}
          </>
        )
      })()}

      {/* Tiltás-modal (Crextio) — indok bekérése */}
      {isMounted && createPortal(
        <AnimatePresence>
        {blockTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 font-onest">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} onClick={() => setBlockTarget(null)} />
          <motion.div variants={MODAL_GENIE} initial="hidden" animate="show" exit="exit" style={{ transformOrigin: 'center' }} className="relative z-10 w-full max-w-[420px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_30px_70px_-20px_rgba(40,35,15,.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBE3E3] text-[#C0453F]">
                <Ban className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-ink">Vendég tiltása</div>
                <div className="text-[12.5px] text-ink-soft">{blockTarget.name}</div>
              </div>
            </div>
            <label className="mt-4 block text-[12.5px] font-medium text-ink-soft">Tiltás indoka (opcionális)</label>
            <textarea
              autoFocus={!isTouchDevice()}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              rows={3}
              placeholder="Pl. ismételt no-show, agresszív viselkedés…"
              className="mt-1.5 w-full resize-none rounded-[14px] border border-line bg-[#FCFCFB] px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:outline-none"
            />
            <p className="mt-2 text-[11.5px] leading-[1.5] text-ink-soft2">
              A tiltott vendég a publikus foglalón semleges hibaüzenetet kap (nem tudja meg, hogy tiltva van).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setBlockTarget(null)} className="rounded-[13px] bg-[#F1F1EF] px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink">Mégse</button>
              <button type="button" onClick={confirmBlock} disabled={busy} className="rounded-[13px] bg-[#C0453F] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">Tiltás</button>
            </div>
          </motion.div>
        </div>
        )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Vendég VÉGLEGES törlése — visszafordíthatatlan, ezért külön megerősítés. */}
      {isMounted && createPortal(
        <AnimatePresence>
        {deleteTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 font-onest">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} onClick={() => setDeleteTarget(null)} />
          <motion.div variants={MODAL_GENIE} initial="hidden" animate="show" exit="exit" style={{ transformOrigin: 'center' }} className="relative z-10 w-full max-w-[420px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_30px_70px_-20px_rgba(40,35,15,.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBE3E3] text-[#C0453F]">
                <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-ink">Vendég törlése</div>
                <div className="text-[12.5px] text-ink-soft">{deleteTarget.name}</div>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-[1.6] text-ink-soft">
              Ez véglegesen törli <span className="font-semibold text-ink">{deleteTarget.name}</span> összes foglalását és vendégadatát.
              A művelet <span className="font-semibold text-[#C0453F]">nem visszavonható</span>, és a statisztikákból is eltűnik.
            </p>
            <p className="mt-2 text-[11.5px] leading-[1.5] text-ink-soft2">
              Ha csak a listáról szeretnéd elrejteni, inkább tiltsd le a vendéget — úgy az adatok megmaradnak.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-[13px] bg-[#F1F1EF] px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink">Mégse</button>
              <button type="button" onClick={confirmDelete} disabled={busy} className="rounded-[13px] bg-[#C0453F] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">Végleges törlés</button>
            </div>
          </motion.div>
        </div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
