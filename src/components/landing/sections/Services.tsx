'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarPlus, CalendarX, UserPlus, CreditCard, Settings, Monitor, Sun, Moon, LogOut, Plus, X,
  LayoutGrid, BarChart3, CalendarDays, Armchair, Clock, List, Map as MapIcon, ArrowUpRight, Users, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'
import { SectionLabel } from '@/components/landing/SectionLabel'

const NAV = [
  { label: 'Áttekintés', Icon: LayoutGrid },
  { label: 'Statisztikák', Icon: BarChart3 },
  { label: 'Foglalások', Icon: CalendarDays },
  { label: 'Asztalok', Icon: Armchair },
  { label: 'Nyitvatartás', Icon: Clock },
]

/**
 * Közös admin-keret HTML-ben (böngészőkeret + sidebar), a valódi dashboard layoutja.
 * `dark`: sötét téma (Áttekintés), különben világos (Statisztikák/Foglalások/Asztalok).
 */
function AdminShell({ activeNav, dark, fill, children }: { activeNav: number; dark?: boolean; fill?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex text-left', fill ? 'h-full w-full' : 'aspect-[480/340]', dark ? 'bg-[#0a0a0a]' : 'bg-white')}>
      {/* sidebar */}
      <div className={cn('w-[88px] shrink-0 flex flex-col py-3 px-2 border-r', dark ? 'border-white/[0.08]' : 'border-zinc-100')}>
        {/* store-switcher fej */}
        <div className={cn('flex items-center gap-1.5 rounded-lg p-1 mb-3', dark ? 'bg-white/[0.05]' : 'bg-zinc-50')}>
          <span className={cn('h-5 w-5 shrink-0 rounded-md', dark ? 'bg-white' : 'bg-zinc-900')} />
          <span className="flex-1 space-y-0.5">
            <span className={cn('block h-1 w-8 rounded-full', dark ? 'bg-white/30' : 'bg-zinc-300')} />
            <span className={cn('block h-1 w-5 rounded-full', dark ? 'bg-white/15' : 'bg-zinc-200')} />
          </span>
        </div>
        {/* nav */}
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ label, Icon }, i) => {
            const on = i === activeNav
            return (
              <span
                key={label}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[8px] font-medium',
                  on
                    ? dark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
                    : dark ? 'text-white/40' : 'text-zinc-400',
                )}
              >
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            )
          })}
        </nav>
      </div>
      {/* content */}
      <div className="flex-1 min-w-0 p-3 overflow-hidden">{children}</div>
    </div>
  )
}

/** 001 — Foglalások idővonal (világos): asztal-sorok színes foglalás-blokkokkal. */
const TIMELINE_ROWS: { t: string; blocks: [number, number, string][] }[] = [
  // [bal% , szélesség%, szín]  — confirmed=sárga, completed=zöld, seated=indigó
  { t: 'S1', blocks: [[0, 28, 'bg-amber-400'], [32, 20, 'bg-emerald-500'], [74, 22, 'bg-amber-400']] },
  { t: 'S2', blocks: [[0, 26, 'bg-emerald-500'], [60, 24, 'bg-amber-400']] },
  { t: 'M2', blocks: [[0, 32, 'bg-emerald-500'], [40, 18, 'bg-amber-400'], [72, 24, 'bg-amber-400']] },
  { t: 'M3', blocks: [[14, 24, 'bg-indigo-500'], [70, 22, 'bg-amber-400']] },
  { t: 'T1', blocks: [[0, 20, 'bg-emerald-500'], [54, 28, 'bg-indigo-500']] },
]

function BookingSVG({ fill }: { fill?: boolean }) {
  return (
    <AdminShell activeNav={2} fill={fill}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[7px] font-semibold uppercase tracking-widest text-zinc-400">0 foglalás · 0 fő</p>
          <h3 className="text-[14px] font-black tracking-tight text-zinc-900">Foglalások</h3>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[8px] font-semibold text-white">
          <Plus className="h-2.5 w-2.5" /> Új foglalás
        </span>
      </div>
      {/* nézet-tabok */}
      <div className="mt-2 flex gap-1">
        {[['Lista', List, false], ['Idővonal', LayoutGrid, true], ['Terem', MapIcon, false]].map(([l, Ic, on], i) => {
          const Icon = Ic as typeof List
          return (
            <span key={i} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-[7.5px] font-medium', on ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500')}>
              <Icon className="h-2.5 w-2.5" /> {l as string}
            </span>
          )
        })}
      </div>
      {/* idő fejléc */}
      <div className="mt-2.5 flex pl-6 border-b border-zinc-100 pb-1">
        {['10', '12', '14', '16', '18', '20'].map((h) => (
          <span key={h} className="flex-1 text-[6.5px] text-zinc-300">{h}:00</span>
        ))}
      </div>
      {/* asztal-sorok */}
      <div className="mt-1 space-y-1">
        {TIMELINE_ROWS.map((row) => (
          <div key={row.t} className="flex items-center gap-1.5 h-[18px]">
            <span className="w-4 shrink-0 text-[8px] font-bold text-zinc-500">{row.t}</span>
            <div className="relative flex-1 h-full">
              {row.blocks.map(([left, w, c], j) => (
                <span key={j} className={cn('absolute top-1/2 -translate-y-1/2 h-3.5 rounded-[3px]', c)} style={{ left: `${left}%`, width: `${w}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}

/** 002 — Értesítések: a valódi fiók-popover (UserMenu) HTML-másolata, igazi lucide ikonokkal. */
const NOTIFS = [
  { Icon: CalendarPlus, color: 'text-green-600', title: 'Új foglalás', body: 'Kovács Anna · 10:30 · Hajvágás', time: 'most', unread: true },
  { Icon: CalendarX, color: 'text-red-500', title: 'Lemondás', body: 'Tóth Péter · 14:00 időpont', time: '4 perce', unread: true },
  { Icon: UserPlus, color: 'text-violet-500', title: 'Új regisztráció', body: 'Nagy Éva csatlakozott', time: '1 órája', unread: false },
]
const THEMES = [
  { Icon: Monitor, active: false },
  { Icon: Sun, active: true },
  { Icon: Moon, active: false },
]

function NotificationsSVG() {
  return (
    <div className="bg-zinc-100 p-5 aspect-[480/360] flex items-end">
      {/* A valódi fiók-popover (w-72 a UserMenu-ben) */}
      <div className="w-full max-w-[260px] rounded-xl border border-zinc-100 bg-white shadow-lg overflow-hidden text-left">
        {/* Profil-sor */}
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="relative shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-[13px] font-bold text-white">D</span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white ring-2 ring-white">
              <Plus className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900">Dave</span>
            <span className="block truncate text-[11px] leading-tight text-zinc-400">your-email@example.com</span>
          </span>
        </div>
        <div className="border-t border-zinc-100" />

        {/* Értesítések fejléc */}
        <div className="flex items-center justify-between px-3.5 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Értesítések (3)</p>
          <span className="text-[11px] font-medium text-zinc-400">Összes törlése</span>
        </div>
        {/* Sorok */}
        <div className="px-2 pb-1">
          {NOTIFS.map((n, i) => (
            <div key={i} className={cn('group relative flex gap-2.5 rounded-xl px-3 py-2', n.unread && 'bg-zinc-50')}>
              <n.Icon className={cn('h-4 w-4 mt-0.5 shrink-0', n.color)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-zinc-900 pr-5">{n.title}</p>
                <p className="truncate text-[11px] text-zinc-500">{n.body}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{n.time}</p>
              </div>
              <X className="absolute right-2 top-2 h-3.5 w-3.5 text-zinc-300" />
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-100" />

        {/* Gyorslinkek */}
        <div className="py-1">
          <div className="flex items-center gap-3 px-3.5 py-2 text-[13px] font-medium text-zinc-600">
            <CreditCard className="h-4 w-4 shrink-0" /> Előfizetés
          </div>
          <div className="flex items-center gap-3 px-3.5 py-2 text-[13px] font-medium text-zinc-600">
            <Settings className="h-4 w-4 shrink-0" /> Beállítások
          </div>
        </div>
        <div className="border-t border-zinc-100" />

        {/* Téma-váltó */}
        <div className="px-3 py-2">
          <div className="flex gap-0.5">
            {THEMES.map(({ Icon, active }, i) => (
              <span key={i} className={cn('relative flex-1 flex items-center justify-center h-8 rounded-md', active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400')}>
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-zinc-100" />

        {/* Kijelentkezés */}
        <div className="flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium text-zinc-600">
          <LogOut className="h-4 w-4 shrink-0" /> Kijelentkezés
        </div>
      </div>
    </div>
  )
}

/** Kis kártya-fejléc (eyebrow + cím + jobb oldali részletek-link) — a valódi grafikon-kártyák feje. */
function ChartHead({ eyebrow, title, dark }: { eyebrow: string; title: string; dark?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <p className={cn('text-[6.5px] font-semibold uppercase tracking-widest mb-0.5', dark ? 'text-white/30' : 'text-zinc-400')}>{eyebrow}</p>
        <h4 className={cn('text-[11px] font-black tracking-tight', dark ? 'text-white' : 'text-zinc-900')}>{title}</h4>
      </div>
      <span className={cn('flex items-center gap-0.5 text-[6.5px] font-semibold', dark ? 'text-white/30' : 'text-zinc-400')}>
        Részletek <ArrowUpRight className="h-2.5 w-2.5" />
      </span>
    </div>
  )
}

/** 003 — Statisztikák (világos): kék terület-vonal + lila óránkénti oszlopok. */
function StatsSVG() {
  const bars = [40, 18, 30, 26, 44, 28, 12, 22, 16]
  const max = Math.max(...bars)
  return (
    <AdminShell activeNav={1}>
      <div className="rounded-xl border border-zinc-100 bg-white shadow-sm p-2.5 mb-2">
        <ChartHead eyebrow="Elmúlt 30 nap" title="Foglalások" />
        <svg viewBox="0 0 320 70" className="w-full h-[58px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="svc-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0099ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0099ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points="0,56 40,40 80,46 120,24 160,32 200,12 240,22 280,8 320,14 320,70 0,70" fill="url(#svc-grad)" stroke="none" />
          <polyline points="0,56 40,40 80,46 120,24 160,32 200,12 240,22 280,8 320,14" fill="none" stroke="#0099ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="rounded-xl border border-zinc-100 bg-white shadow-sm p-2.5">
        <ChartHead eyebrow="Elmúlt 30 nap" title="Óránkénti forgalom" />
        <div className="flex items-end gap-1.5 h-[60px]">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-violet-500/85" style={{ height: `${(h / max) * 100}%` }} />
          ))}
        </div>
      </div>
    </AdminShell>
  )
}

/** 004 — Áttekintés (sötét): KPI-k + kék trend-vonal. */
function DashboardSVG() {
  const KPIS = [
    { l: 'Ma', v: '0', s: 'foglalás' },
    { l: 'Ma', v: '0 fő', s: 'vendég összesen' },
    { l: 'Mai kihasználtság', v: '0%', s: 'kapacitáshoz mérten' },
    { l: '30 nap', v: '32', s: '+23%', up: true },
  ]
  return (
    <AdminShell activeNav={0} dark>
      <p className="text-[6.5px] font-semibold uppercase tracking-widest text-white/30 mb-0.5">2026. Június 24.</p>
      <h3 className="text-[15px] font-black tracking-tight text-white mb-2">Jó napot!</h3>
      {/* insight bar */}
      <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 mb-2">
        <Zap className="h-2.5 w-2.5 text-amber-400 shrink-0" />
        <p className="text-[7px] text-white/50"><span className="font-bold text-white">Péntek</span> a legerősebb napja. Csúcsidő: <span className="font-bold text-white">10:00</span>.</p>
      </div>
      {/* KPI-k */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {KPIS.map((k, i) => (
          <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-1.5">
            <div className="flex items-start justify-between">
              <p className="text-[5.5px] font-semibold uppercase tracking-wide text-white/30 leading-tight">{k.l}</p>
              <ArrowUpRight className="h-2 w-2 text-white/25 shrink-0" />
            </div>
            <p className="text-[14px] font-black text-white leading-none mt-1">{k.v}</p>
            <p className={cn('text-[5.5px] mt-0.5', k.up ? 'text-emerald-400' : 'text-white/30')}>{k.s}</p>
          </div>
        ))}
      </div>
      {/* trend kártya */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <p className="text-[6px] font-semibold uppercase tracking-widest text-white/30">Elmúlt 30 nap</p>
            <h4 className="text-[10px] font-black text-white">Foglalások</h4>
          </div>
          <div className="flex gap-0.5 rounded-md bg-white/[0.06] p-0.5">
            <span className="rounded bg-white px-1.5 py-0.5 text-[6px] font-semibold text-zinc-900">Foglalás</span>
            <span className="px-1.5 py-0.5 text-[6px] font-medium text-white/40">Vendég</span>
          </div>
        </div>
        <svg viewBox="0 0 320 66" className="w-full h-[54px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="svc-dark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0099ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0099ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points="0,60 36,58 60,20 78,4 100,58 150,64 200,50 250,34 300,60 320,62 320,66 0,66" fill="url(#svc-dark-grad)" stroke="none" />
          <polyline points="0,60 36,58 60,20 78,4 100,58 150,64 200,50 250,34 300,60 320,62" fill="none" stroke="#0099ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </AdminShell>
  )
}

/** 005 — Asztalok / terem-nézet (világos): körök + négyzet-asztalok a teremben. */
function TablesSVG() {
  const round: [number, number][] = [[22, 30], [44, 22], [64, 36], [82, 24], [34, 60], [56, 72], [78, 64]]
  const square: [number, number][] = [[14, 18], [70, 16], [40, 82], [86, 80]]
  return (
    <AdminShell activeNav={3}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[7px] font-semibold uppercase tracking-widest text-zinc-400">Terem</p>
          <h3 className="text-[14px] font-black tracking-tight text-zinc-900">Asztaltérkép</h3>
        </div>
        <span className="flex items-center gap-1 text-[7px] text-zinc-400"><Users className="h-2.5 w-2.5" /> 88 fő</span>
      </div>
      <div className="relative rounded-xl border border-zinc-100 bg-zinc-50 h-[200px] overflow-hidden">
        {round.map(([x, y], i) => (
          <span key={`r${i}`} className={cn('absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full', i % 3 === 0 ? 'bg-emerald-500/80' : 'bg-zinc-200')} style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
        {square.map(([x, y], i) => (
          <span key={`s${i}`} className={cn('absolute h-6 w-8 -translate-x-1/2 -translate-y-1/2 rounded-md', i === 1 ? 'bg-indigo-500/80' : 'bg-zinc-200')} style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </div>
    </AdminShell>
  )
}

function MobileAccordionRow({
  s,
  open,
  onToggle,
}: {
  s: typeof SERVICES[0]
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-zinc-100">
      {/* Fejléc: cím flip — zárva normál, nyitva kicsúszik le és helyére jön az aktív cím */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 text-left" style={{ height: 72 }}>
        <span className="text-xs font-medium tabular-nums tracking-[-0.02em] text-zinc-300 shrink-0 self-center">
          ({s.n})
        </span>

        {/* Text-roll: két példány egymás alatt, spring-gel csúszik */}
        <div className="flex-1 overflow-hidden" style={{ height: 72 }}>
          <motion.div
            className="flex flex-col"
            animate={{ y: open ? '-50%' : '0%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div
              className={cn('flex items-center font-semibold tracking-[-0.05em] leading-[0.95] transition-colors duration-200', open ? 'text-brand-ink' : 'text-zinc-400')}
              style={{ fontSize: 'clamp(1.6rem, 7vw, 2.25rem)', height: 72 }}
            >
              {s.title}
            </div>
            <div
              className="flex items-center font-semibold tracking-[-0.05em] leading-[0.95] text-brand-ink"
              style={{ fontSize: 'clamp(1.6rem, 7vw, 2.25rem)', height: 72 }}
            >
              {s.title}
            </div>
          </motion.div>
        </div>

        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className={cn(
            'shrink-0 h-9 w-9 rounded-full flex items-center justify-center',
            open ? 'bg-brand-accent text-brand-ink' : 'bg-brand-ink text-white',
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </motion.span>
      </button>

      {/* Tartalom — rugósan nyílik/zárul */}
      <motion.div
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        initial={false}
        transition={{
          height: { type: 'spring', stiffness: 280, damping: 26 },
          opacity: { duration: 0.2 },
        }}
        className="overflow-hidden"
      >
        <motion.div
          animate={{ y: open ? 0 : -20 }}
          initial={false}
          transition={{ type: 'spring', stiffness: 280, damping: 26, delay: open ? 0.05 : 0 }}
          className="pb-6 flex flex-col gap-4"
        >
          <div className="rounded-[1.25rem] overflow-hidden shadow-xl shadow-black/10 ring-1 ring-black/5">
            <s.Visual />
          </div>
          <p className="text-[15px] leading-[1.5] text-brand-ink/60">{s.body}</p>
        </motion.div>
      </motion.div>
    </div>
  )
}

const SERVICES = [
  {
    n: '001',
    title: 'Mindig nyitva',
    body: 'Saját foglalóoldal egyedi linken — az ügyfél akkor foglal, amikor neki jó, telefonálás nélkül. Te alszol, a naptár közben megtelik.',
    Visual: BookingSVG,
  },
  {
    n: '002',
    title: 'Értesítések',
    body: 'Automatikus visszaigazolás és emlékeztető minden foglaláshoz. Kevesebb elfelejtett időpont, kevesebb kiesett bevétel — magától.',
    Visual: NotificationsSVG,
  },
  {
    n: '003',
    title: 'Több bevétel',
    body: 'Valós idejű bevétel, kihasználtság és csúcsidők egy képernyőn. Tudd meg, mikor keresel a legtöbbet — és tölts be minden üres slotot.',
    Visual: StatsSVG,
  },
  {
    n: '004',
    title: 'Teljes kontroll',
    body: 'Foglalások, munkatársak, szolgáltatások, nyitvatartás — nincs több szétszórt Excel és papír. Az egész vállalkozásod egy fülön.',
    Visual: DashboardSVG,
  },
  {
    n: '005',
    title: 'Telt ház',
    body: 'Éttermeknek: a teljes terem egy képernyőn, valós idejű foglaltsággal. Optimalizáld az ültetést, és ne hagyj üres asztalt csúcsidőben.',
    Visual: TablesSVG,
  },
]

export function Services() {
  const [active, setActive] = useState<number>(0)
  const [mobileActive, setMobileActive] = useState<number>(0)
  // minden cím-blokk referenciája — a középvonalhoz legközelebbi lesz az aktív
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const onItemInView = (idx: number) =>
    setActive((prev) => (prev === idx ? prev : idx))

  const service = SERVICES[active] ?? SERVICES[0]

  return (
    <section id="szolgaltatasok" className="mx-auto px-4 lg:px-5 py-20 lg:py-28">
      {/* Fejléc */}
      <div className="flex items-start justify-between gap-4 mb-12 lg:mb-16">
        <SectionLabel>(Szolgáltatások)</SectionLabel>
      </div>

      {/* Két oszlop: bal címek folyamatosan görögnek, jobb mockup sticky — CSAK DESKTOP */}
      <div className="hidden lg:grid grid-cols-2 gap-16 items-start">
        {/* Bal: cím-lista */}
        <div className="flex flex-col">
          {SERVICES.map((s, i) => (
            <motion.button
              key={s.n}
              ref={(el) => {
                itemRefs.current[i] = el as HTMLDivElement | null
              }}
              onClick={() => setActive(i)}
              onViewportEnter={() => onItemInView(i)}
              viewport={{ margin: '-45% 0px -45% 0px', amount: 0.1 }}
              className="group flex w-full items-start gap-3 text-left py-4 lg:py-6"
            >
              <span
                className={cn(
                  'text-xs font-medium tabular-nums tracking-[-0.02em] pt-2 transition-colors duration-300',
                  active === i ? 'text-brand-ink' : 'text-zinc-300',
                )}
              >
                ({s.n})
              </span>
              <span
                className={cn(
                  'font-semibold tracking-[-0.055em] leading-[0.95] whitespace-nowrap transition-colors duration-300',
                  active === i ? 'text-brand-ink' : 'text-zinc-300',
                )}
                style={{ fontSize: 'clamp(2.25rem, 5.2vw, 5.5rem)' }}
              >
                {s.title}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Jobb: sticky mockup + leírás */}
        <div className="hidden lg:flex flex-col gap-5 max-w-[460px] w-full lg:ml-auto sticky top-[22vh]">
          <div className="rounded-[1.25rem] overflow-hidden shadow-2xl shadow-black/15 ring-1 ring-black/5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <service.Visual />
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-[16px] leading-[1.5] text-brand-ink/60"
            >
              {service.body}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobil: accordion — egyszerre csak egy nyitva, alapból az első */}
      <div className="lg:hidden flex flex-col mt-4 border-t border-zinc-100">
        {SERVICES.map((s, i) => (
          <MobileAccordionRow
            key={s.n}
            s={s}
            open={mobileActive === i}
            onToggle={() => setMobileActive(mobileActive === i ? -1 : i)}
          />
        ))}
      </div>
    </section>
  )
}
