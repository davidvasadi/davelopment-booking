'use client'

/**
 * VENDÉGEK képernyő — interaktív rész (animált fejléc + térkép + érkezések + lista + profil).
 * A page (szerver-komponens) számolja ki a view-modelleket a valós foglalásokból.
 * A fejléc az Áttekintéssel egyező: StatusPills (megoszlás) + CountUpKpi (felszámoló számok).
 * A referencia: docs/design_handoff_davelopment/davelopment App.dc.html (Vendégek szekció).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Phone, Mail, Star, ChevronDown, ChevronLeft, ChevronRight, Cake, Ban, Pencil, ShieldCheck, Check, Trash2, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { TIER_LABEL, flagEmoji, countryName, type GuestTier, type CountryBucket } from '@/lib/guests'
import { StatusPills, type StatusSeg } from '@/components/dashboard/StatusPills'
import { CountUpKpi, type KpiIcon } from '@/components/dashboard/CountUpKpi'
import GuestMapClient from '@/components/dashboard/GuestMapClient'

/**
 * Avatar: ha van Gravatar-kép, azt mutatja; 404/betöltési hibánál a monogramos
 * színes körre esik vissza. (A Google-profilkép csak OAuth-tal érhető el; e-mailből
 * a Gravatar a legjobb, amit publikusan le lehet kérni.)
 */
function Avatar({ url, ini, bg, fg, size, text }: { url: string | null; ini: string; bg: string; fg: string; size: number; text: number }) {
  const [ok, setOk] = useState(!!url)
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: text }}
    >
      {ok && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} className="h-full w-full object-cover" onError={() => setOk(false)} />
      ) : (
        ini
      )}
    </div>
  )
}

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
  guests: GuestVM[]
  arrivals: ArrivalVM[] // az adott nap ÖSSZES valós foglalása, idő szerint növekvőben
  arrivalsDateLabel: string // pl. "Ma"
  returningPct: number
  returningNum: number
  newNum: number
  buckets: CountryBucket[]
  mapLabel: string
  mapEmpty?: ReactNode // placeholder ha nincs bucket
}

/* ── tier badge színek (Crextio: Új bézs · Visszatérő zöld · Törzsvendég ink/gold) ── */
const TIER_BG: Record<GuestTier, string> = { 1: '#F0EAD8', 2: '#E4F2E9', 3: '#1D1C19' }
const TIER_FG: Record<GuestTier, string> = { 1: '#86826F', 2: '#1D9D63', 3: '#F1CE45' }

const MONTH_FULL = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const MONTH_SHORT = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

/** Szülinap-dátum → "júl. 4." (nap + hónap; az évet szándékosan elhagyjuk). */
function birthdayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}.`
}

/** Törzsvendég-küszöb szöveges magyarázata a profilba. */
function tierExplain(tier: GuestTier, visits: number): string {
  if (tier === 3) return `${visits} látogatás — Törzsvendég (4+ látogatástól)`
  if (tier === 2) return `${visits} látogatás — Visszatérő · ${4 - visits} látogatás a Törzsvendégig`
  return `${visits} látogatás — Új · 2 látogatástól Visszatérő`
}

export function GuestsView({
  pills,
  metrics,
  guests,
  arrivals,
  arrivalsDateLabel,
  returningPct,
  returningNum,
  newNum,
  buckets,
  mapLabel,
  mapEmpty,
}: Props) {
  const [query, setQuery] = useState('')
  // Hónap-léptető: az aktuális hónapról indul, nyilakkal előre/hátra.
  const [ym, setYm] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selKey, setSelKey] = useState(guests[0]?.key ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [openRow, setOpenRow] = useState<number | null>(null) // kibontott látogatás-sor indexe
  useEffect(() => { setOpenRow(null); setHistoryOpen(false) }, [selKey]) // vendégváltáskor zárjuk az előzményeket
  const [focusIso, setFocusIso] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' })
  const [blockTarget, setBlockTarget] = useState<GuestVM | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GuestVM | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const detailRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Vendég-rekord upsert (tiltás/feloldás vagy kézi szerkesztés), majd frissítés.
  async function saveCustomer(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      router.refresh()
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
    if (opts.scroll) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
  const stepMonth = (dir: -1 | 1) =>
    setYm(({ y, m }) => {
      const t = m + dir
      if (t < 0) return { y: y - 1, m: 11 }
      if (t > 11) return { y: y + 1, m: 0 }
      return { y, m: t }
    })

  const matchQuery = (g: GuestVM, q: string) =>
    g.name.toLowerCase().includes(q) || (g.email ?? '').toLowerCase().includes(q) || (g.phone ?? '').includes(q)

  const passStatus = (g: GuestVM) => (statusFilter === 'all' ? true : statusFilter === 'blocked' ? g.blocked : !g.blocked)

  // Keresés → MINDEN hónap. Tiltott szűrő → MINDEN hónap (a teljes tiltólista). Egyébként a hónap.
  const listFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) return guests.filter((g) => matchQuery(g, q)).filter(passStatus)
    if (statusFilter === 'blocked') return guests.filter((g) => g.blocked)
    return guests.filter((g) => (g.lastVisit ?? '').slice(0, 7) === monthKey).filter(passStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, query, monthKey, statusFilter])

  const sel = useMemo(() => guests.find((g) => g.key === selKey) ?? guests[0], [guests, selKey])

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
      <div>
        <h1 className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[43px]">Vendégek</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Törzsvendég-kezelés · CRM</p>
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
            {buckets.length > 0 ? <GuestMapClient buckets={buckets} focusIso={focusIso} /> : mapEmpty}
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
                <div className="text-[30px] font-light leading-none tracking-[-0.02em] text-ink">{returningPct}%</div>
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
                      <Avatar url={a.avatarUrl} ini={a.ini} bg={a.av} fg={a.avText} size={38} text={13} />
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
        <div className="relative z-10 flex w-full flex-wrap items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 py-2 backdrop-blur-[20px] sm:h-[52px] sm:flex-nowrap sm:py-0 sm:px-6">
          {/* Hónap-léptető */}
          <div className="flex w-full shrink-0 items-center gap-1 sm:w-auto sm:justify-start">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              aria-label="Előző hónap"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] transition-colors hover:bg-paper"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
            </button>
            <div className="flex-1 text-center text-[15px] font-semibold text-ink sm:min-w-[112px] sm:flex-none sm:text-[13px]">{MONTH_FULL[ym.m]} {ym.y}</div>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              aria-label="Következő hónap"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] transition-colors hover:bg-paper"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
          {/* Kereső (kompakt) */}
          <div className="flex min-w-[90px] flex-1 items-center gap-2.5 rounded-[18px] bg-white px-4 py-2 shadow-[0_1px_4px_rgba(70,60,20,.06)]">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
            />
          </div>
          {/* Státusz-szűrő: Mind / Aktív / Tiltott */}
          <div className="relative flex-shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'blocked')}
              className="cursor-pointer appearance-none rounded-[18px] bg-white py-[9px] pl-4 pr-8 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
            >
              <option value="all">Mind</option>
              <option value="active">Aktív</option>
              <option value="blocked">Tiltott</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
        </div>

        {/* TEST: lista + profil (azonos magasság) */}
        <div className="rounded-b-[28px] border border-white/40 bg-white/60 p-4 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[22px] sm:p-5">
          <div className="grid items-stretch gap-4 lg:grid-cols-[352px_1fr]">
            {/* LISTA */}
            <div className="flex flex-col rounded-[22px] border border-white/55 bg-[var(--dav-glass-strong)] backdrop-blur-[14px] p-2.5 lg:h-[560px]">
              <div className="mb-1 px-2 pt-1 text-[11.5px] font-medium text-ink-soft">
                {listFiltered.length} vendég{query.trim() ? ' · keresés' : ''}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto" data-lenis-prevent>
            {listFiltered.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-ink-soft">Ebben a hónapban nincs vendég.</div>
            ) : (
              listFiltered.map((g) => {
                const active = sel?.key === g.key
                return (
                  <button
                    type="button"
                    key={g.key}
                    onClick={() => setSelKey(g.key)}
                    className={`flex items-center gap-[13px] rounded-[20px] p-[13px] text-left transition-colors ${active ? 'bg-ink-dark' : 'hover:bg-white/60'}`}
                  >
                    <Avatar url={g.avatarUrl} ini={g.ini} bg={g.av} fg={g.avText} size={46} text={15} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[15px] font-semibold ${active ? 'text-white' : 'text-ink'}`}>{g.name}</span>
                        {g.country && (
                          <span title={countryName(g.country) ?? undefined} className="flex-shrink-0 text-[14px] leading-none">{flagEmoji(g.country)}</span>
                        )}
                        {g.blocked && (
                          <span title="Tiltólistán" className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded-full bg-[#FBE3E3] text-[#C0453F]">
                            <Ban className="h-3 w-3" strokeWidth={2.2} />
                          </span>
                        )}
                        <span
                          className="ml-0.5 rounded-[7px] px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.04em]"
                          style={{ background: TIER_BG[g.tier], color: TIER_FG[g.tier], boxShadow: active && g.tier === 3 ? 'inset 0 0 0 1px rgba(241,206,69,.4)' : undefined }}
                        >
                          {TIER_LABEL[g.tier]}
                        </span>
                      </div>
                      <div className={`mt-[3px] text-[12px] font-normal ${active ? 'text-white/55' : 'text-ink-soft'}`}>{g.meta}</div>
                      <div className={`mt-2 h-[5px] overflow-hidden rounded-[3px] ${active ? 'bg-white/15' : 'bg-black/[0.06]'}`}>
                        <div className="h-full rounded-[3px] bg-gold" style={{ width: `${Math.min(g.loyalty, 100)}%` }} />
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

            {/* PROFIL */}
            {sel ? (
              <div className="flex flex-col overflow-y-auto rounded-[22px] border border-white/55 bg-[var(--dav-glass-strong)] backdrop-blur-[14px] p-5 lg:h-[560px] lg:p-6" data-lenis-prevent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-[18px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-4 sm:gap-[18px]">
                  <Avatar url={sel.avatarUrl} ini={sel.ini} bg={sel.av} fg={sel.avText} size={74} text={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="text-[26px] font-normal tracking-[-0.01em] text-ink">{sel.name}</div>
                      {sel.country && (
                        <span className="inline-flex items-center gap-1.5 rounded-[9px] bg-white/55 px-[9px] py-1 text-[12px] font-semibold text-ink-soft backdrop-blur-[6px]">
                          <span className="text-[15px] leading-none">{flagEmoji(sel.country)}</span>
                          {countryName(sel.country)}
                        </span>
                      )}
                      <span className="rounded-[9px] px-[11px] py-1 text-[11px] font-semibold tracking-[0.04em]" style={{ background: TIER_BG[sel.tier], color: TIER_FG[sel.tier] }}>
                        {TIER_LABEL[sel.tier]}
                      </span>
                      {sel.birthdayDate && (
                        <span className="inline-flex items-center gap-1 rounded-[9px] bg-[#F7DEDE] px-[9px] py-1 text-[11px] font-semibold text-[#C2557A]">
                          <Cake className="h-3.5 w-3.5" strokeWidth={1.8} /> Szülinap · {birthdayLabel(sel.birthdayDate)}
                        </span>
                      )}
                      {sel.blocked && (
                        <span className="inline-flex items-center gap-1 rounded-[9px] bg-[#FBE3E3] px-[9px] py-1 text-[11px] font-semibold text-[#C0453F]">
                          <Ban className="h-3.5 w-3.5" strokeWidth={2} /> Tiltólistán
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-ink-soft">
                  {sel.phone && <span>{sel.phone}</span>}
                  {sel.phone && sel.email && <span className="text-ink-soft2">·</span>}
                  {sel.email && <span className="break-all">{sel.email}</span>}
                  {!sel.phone && !sel.email && <span>—</span>}
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">vendég {sel.since} óta</div>
                <div className="mt-1 text-[12px] font-medium text-ink-soft2">{tierExplain(sel.tier, sel.visits)}</div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                {sel.phone ? (
                  <a href={`tel:${sel.phone}`} title={`Hívás — ${sel.phone}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50 backdrop-blur text-ink transition-colors hover:bg-white/75">
                    <Phone className="h-4 w-4" strokeWidth={1.6} />
                  </a>
                ) : (
                  <span title="Nincs telefonszám" aria-disabled className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-white/30 text-ink-soft2 opacity-50">
                    <Phone className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                )}
                {sel.email ? (
                  <a href={`mailto:${sel.email}`} title={`E-mail — ${sel.email}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50 backdrop-blur text-ink transition-colors hover:bg-white/75">
                    <Mail className="h-4 w-4" strokeWidth={1.6} />
                  </a>
                ) : (
                  <span title="Nincs e-mail-cím" aria-disabled className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-white/30 text-ink-soft2 opacity-50">
                    <Mail className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                )}
                <button type="button" onClick={() => startEdit(sel)} title="Szerkesztés" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50 backdrop-blur text-ink transition-colors hover:bg-white/75">
                  <Pencil className="h-4 w-4" strokeWidth={1.7} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleBlock(sel)}
                  disabled={busy}
                  title={sel.blocked ? 'Tiltás feloldása' : 'Tiltólistára'}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${sel.blocked ? 'bg-[#E7F2EA] text-[#1D9D63] hover:bg-[#d7ebde]' : 'bg-[#FBE3E3] text-[#C0453F] hover:bg-[#f6d4d4]'}`}
                >
                  {sel.blocked ? <ShieldCheck className="h-4 w-4" strokeWidth={1.8} /> : <Ban className="h-4 w-4" strokeWidth={1.8} />}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(sel)}
                  disabled={busy}
                  title="Vendég törlése"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-ink-soft backdrop-blur transition-colors hover:bg-[#FBE3E3] hover:text-[#C0453F] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                </button>
              </div>
            </div>

            {/* Szerkesztő űrlap (kézi felülírás) */}
            {editing && (
              <div className="mt-4 rounded-[18px] border border-white/60 bg-white/55 p-4 backdrop-blur-[10px]">
                <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-ink-soft">Név</span>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Vendég neve" className="rounded-[12px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-ink-soft">Telefon</span>
                    <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+36 20 123 4567" className="rounded-[12px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11.5px] font-semibold text-ink-soft">E-mail</span>
                    <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vendeg@example.com" className="rounded-[12px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[11.5px] font-semibold text-ink-soft">Belső jegyzet</span>
                    <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Csak a személyzet látja" className="rounded-[12px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink focus:outline-none" />
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="rounded-[12px] bg-white/70 px-4 py-2 text-[13px] font-semibold text-ink-soft hover:text-ink">Mégse</button>
                  <button type="button" onClick={() => saveEdit(sel)} disabled={busy} className="rounded-[12px] bg-ink-dark px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">Mentés</button>
                </div>
              </div>
            )}

            {/* Tiltás-jelző + indok */}
            {sel.blocked && (
              <div className="mt-4 flex items-start gap-[11px] rounded-[16px] bg-[#FBE3E3] px-4 py-3">
                <Ban className="mt-px h-[17px] w-[17px] flex-shrink-0 text-[#C0453F]" strokeWidth={1.8} />
                <div className="text-[13.5px] font-medium leading-[1.5] text-[#9A3A35]">
                  Tiltólistán{sel.blockReason ? <> — {sel.blockReason}</> : ' (nincs megadva indok)'}
                </div>
              </div>
            )}

            {/* Adatsorok (Törzsvendég-pont gyűrű nélkül) */}
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {sel.rows.map((r) => (
                r.label === 'Megjegyzés' ? (
                  <div key={r.label} className="rounded-[16px] bg-white/45 backdrop-blur-[6px] px-4 py-3 sm:col-span-2">
                    <div className="mb-0.5 text-[13px] font-medium text-ink-soft">{r.label}</div>
                    <div className="text-[14px] font-medium leading-[1.5] text-ink">{r.value}</div>
                  </div>
                ) : (
                  <div key={r.label} className="flex items-center justify-between rounded-[16px] bg-white/45 backdrop-blur-[6px] px-4 py-3">
                    <span className="text-[13px] font-medium text-ink-soft">{r.label}</span>
                    <span className="text-[15px] font-semibold text-ink">{r.value}</span>
                  </div>
                )
              ))}
            </div>

            <div className="mb-2 mt-6 text-[13px] font-semibold text-ink">Látogatási előzmények</div>
            <div className="flex flex-col gap-0.5">
              {sel.history.length === 0 ? (
                <div className="py-3 text-[13px] text-ink-soft">
                  {sel.visits <= 1 ? 'Ez az első látogatása — még nincs korábbi.' : 'Nincs korábbi látogatás.'}
                </div>
              ) : (
                (historyOpen ? sel.history : sel.history.slice(0, 3)).map((h, i) => {
                  const expandable = (h.details && h.details.length > 0) || !!h.note
                  const isOpen = openRow === i
                  return (
                    <div key={i} className="border-b" style={{ borderColor: 'rgba(120,110,70,.1)' }}>
                      <button
                        type="button"
                        disabled={!expandable}
                        onClick={() => setOpenRow((o) => (o === i ? null : i))}
                        className={`flex w-full items-center gap-3.5 py-2.5 text-left transition-colors ${expandable ? 'cursor-pointer hover:bg-white/40' : 'cursor-default'}`}
                      >
                        <div className="w-14 flex-shrink-0 text-[12.5px] font-semibold text-ink-soft">{h.d}</div>
                        <div className="flex-1 text-[14px] font-medium text-ink">{h.w}</div>
                        {h.a && <div className="text-[14px] font-semibold text-ink">{h.a}</div>}
                        {expandable && (
                          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                        )}
                      </button>
                      {expandable && isOpen && (
                        <div className="mb-2.5 grid gap-x-4 gap-y-2 rounded-[14px] bg-white/55 px-3.5 py-3 backdrop-blur-[6px] sm:grid-cols-2">
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
              {sel.history.length > 3 ? (
                <button type="button" onClick={() => setHistoryOpen((o) => !o)} className="mt-1 flex items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-white/60">
                  {historyOpen ? 'Kevesebb' : `További ${sel.history.length - 3} látogatás`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                </button>
              ) : null}
            </div>

            {/* Megjegyzések a foglalásokból (vendég + belső), fallback: tier-tanács */}
            {sel.guestNote || sel.internalNote ? (
              <div className="mt-4 flex flex-col gap-2">
                {sel.guestNote && (
                  <div className="rounded-[16px] bg-white/45 backdrop-blur-[6px] px-4 py-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft2">Vendég megjegyzése</div>
                    <div className="text-[13.5px] font-medium leading-[1.5] text-ink">{sel.guestNote}</div>
                  </div>
                )}
                {sel.internalNote && (
                  <div className="rounded-[16px] bg-white/45 backdrop-blur-[6px] px-4 py-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#7C7B73]">Belső megjegyzés</div>
                    <div className="text-[13.5px] font-medium leading-[1.5] text-[#565550]">{sel.internalNote}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-gold/25 bg-gradient-to-br from-[#FBF4DE]/70 to-white/40 px-4 py-3.5 backdrop-blur-[6px]">
                <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-gold/15">
                  <Star className="h-[15px] w-[15px] text-gold" strokeWidth={2} fill="currentColor" />
                </span>
                <div>
                  <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#B99527]">Tipp</div>
                  <div className="text-[13.5px] font-medium leading-[1.5] text-[#4A4740]">{sel.advice}</div>
                </div>
              </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-[22px] border border-white/55 bg-[var(--dav-glass-strong)] backdrop-blur-[14px] p-7 text-[14px] text-ink-soft lg:h-[560px]">
                Még nincs vendég. Az első foglalás után itt jelennek meg.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tiltás-modal (Crextio) — indok bekérése */}
      {blockTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setBlockTarget(null)}>
          <div className="w-full max-w-[420px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_30px_70px_-20px_rgba(40,35,15,.5)]" onClick={(e) => e.stopPropagation()}>
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
              autoFocus
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
          </div>
        </div>
      )}

      {/* Vendég VÉGLEGES törlése — visszafordíthatatlan, ezért külön megerősítés. */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-[420px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[0_30px_70px_-20px_rgba(40,35,15,.5)]" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}
    </div>
  )
}
