'use client'

/**
 * TourPreview — CSS-animációs miniatűr előnézetek az OnboardingTour lépéseihez.
 * Minden preview az élő designrendszer pontos színeit és stílusait tükrözi.
 *
 * Forrásul felhasznált komponensek:
 *  - SalonDailyView: statusBlock (#1D1C19 confirmed, #F1CE45 pending, #1D9D63 completed)
 *  - ServicesManager: CAT_TINTS (warm beige / lila / zöld / kék)
 *  - AppNavbar / AppShell: dav-container gradient, glass kártya stílus
 *  - BrandLogo: variant="light" = sötét szövegű logó világos háttérre
 */

import { motion, useReducedMotion } from 'framer-motion'
import { Lightbulb, TrendingUp, Minus, CalendarDays, Banknote, Users, Zap, Smartphone, type LucideIcon } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { TableGlyph } from '@/components/restaurant/TableGlyph'

export type PreviewKey =
  | 'welcome' | 'overview' | 'bookings' | 'schedule' | 'services'
  | 'staff' | 'hours' | 'analytics' | 'tips' | 'settings' | 'tables' | 'pwa' | 'done'

// ── Design rendszer konstansok (globals.css + komponens-forrásokból) ──────────
const INK = '#211F1A'
const MUTED = '#86826F'
const GOLD = '#F1CE45'
const LINE = 'rgba(120,110,70,.14)'
const GLASS = 'rgba(255,255,255,.62)'
const SHADOW = '0 2px 8px rgba(0,0,0,.04)'

// SalonDailyView statusBlock pontos színek
const S_CONFIRMED_BG = '#1D1C19'
const S_CONFIRMED_FG = '#ffffff'
const S_PENDING_BG = '#F1CE45'
const S_PENDING_FG = '#211F1A'
const S_COMPLETED_BG = '#1D9D63'
const S_COMPLETED_FG = '#ffffff'

// ServicesManager CAT_TINTS pontos értékek
const CAT = [
  { head: '#F0E4D4', grad: 'linear-gradient(135deg,#F3E7D6,#E7D2B6)' },
  { head: '#EFE2F0', grad: 'linear-gradient(135deg,#EFE2F0,#E0CBE5)' },
  { head: '#DDEBE5', grad: 'linear-gradient(135deg,#DDEBE5,#C7DCD1)' },
  { head: '#DCE6F0', grad: 'linear-gradient(135deg,#DCE6F0,#C3D5E8)' },
]

type PrevProps = { r: boolean; variant?: 'salon' | 'restaurant' }

function card(extra?: string) {
  return {
    style: { background: GLASS, border: `1px solid ${LINE}`, boxShadow: SHADOW } as React.CSSProperties,
    className: `rounded-[13px] backdrop-blur-sm ${extra ?? ''}`,
  }
}

// ── Welcome ───────────────────────────────────────────────────────────────────

function WelcomePreview({ r }: PrevProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3">
      {/* Arany folt — alul, ne takarja a logót */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-20 w-40 rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(241,206,69,.18) 0%, transparent 70%)', filter: 'blur(14px)' }} />
      <motion.div
        className="relative z-10"
        animate={r ? { opacity: 1 } : { opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandLogo variant="light" className="h-9 w-auto" />
      </motion.div>
      <p className="relative z-10 text-[10.5px] font-medium" style={{ color: MUTED }}>foglalási rendszer</p>
    </div>
  )
}

// ── Overview — StatusPills.tsx PONTOS layout: 3 külön pillér felirattal fölötte + scaleX animáció
// + HeroKpi standalone számok (nincs card) + sötét profilkártya + idővonal
// Forrás: StatusPills.tsx — flex items-end gap-2.5, label mb-2, h-11 rounded-[21px] px-5
//         dashboard/page.tsx — HeroKpi, CARD dark profil, OverviewTimeline

function OverviewPreview({ r, variant }: PrevProps) {
  const isRest = variant === 'restaurant'

  // StatusPills szegmensek — pontosan a dashboard/page.tsx segments tömbje
  const segs = [
    { label: 'Megerősített', pct: 57, bg: INK, fg: '#fff' },
    { label: 'Függő', pct: 29, bg: GOLD, fg: INK },
    { label: 'Lemondva', pct: 14, bg: 'repeating-linear-gradient(115deg,rgba(255,255,255,.5) 0px,rgba(255,255,255,.5) 7px,rgba(190,180,140,.24) 7px,rgba(190,180,140,.24) 14px)', fg: MUTED, border: '1px solid rgba(120,110,70,.22)' },
  ]
  const total = segs.reduce((a, s) => a + s.pct, 0)

  const kpis = isRest
    ? [{ icon: CalendarDays, value: '18', label: 'Foglalás ma' }, { icon: Users, value: '42', label: 'Vendég' }, { icon: TrendingUp, value: '76%', label: 'Kihasználtság' }]
    : [{ icon: CalendarDays, value: '12', label: 'Foglalás ma' }, { icon: Banknote, value: '48e', label: 'Bevétel' }, { icon: TrendingUp, value: '91%', label: 'Teljesítés' }]

  const D = 4.2  // teljes ciklus
  const T: [number, number, number, number] = [0, 0.18, 0.78, 1]  // be / kint / ki

  return (
    <div className="flex h-full w-full flex-col px-3 py-3 gap-2">

      {/* StatusPills — 3 pillér felirattal fölötte, scaleX balról */}
      <div className="flex items-end gap-1.5">
        {segs.map((s, i) => (
          <div key={i} style={{ flexGrow: s.pct / total, flexShrink: 1, minWidth: 0 }}>
            <motion.p
              className="mb-1 truncate text-[6.5px] font-medium"
              style={{ color: MUTED }}
              animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
              transition={{ duration: D, delay: i * 0.08, repeat: Infinity, repeatDelay: 0.8, times: T }}
            >
              {s.label}
            </motion.p>
            <div className="overflow-hidden rounded-[14px]" style={{ height: 28 }}>
              <motion.div
                className="h-full flex items-center px-2 text-[7px] font-semibold whitespace-nowrap"
                style={{ background: s.bg, color: s.fg, border: s.border, originX: 0, width: '100%' }}
                animate={r ? { scaleX: 1, opacity: 1 } : { scaleX: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
                transition={{ duration: D, delay: i * 0.1, repeat: Infinity, repeatDelay: 0.8, times: T, ease: [0.22, 1, 0.36, 1] }}
              >
                {s.pct}%
              </motion.div>
            </div>
          </div>
        ))}
      </div>

      {/* HeroKpi — standalone számok, jobbra igazítva */}
      <div className="flex items-start justify-end gap-4">
        {kpis.map(({ icon: Icon, value, label }, i) => (
          <motion.div
            key={i}
            animate={r ? { opacity: 1, y: 0 } : { opacity: [0, 1, 1, 0], y: [5, 0, 0, 5] }}
            transition={{ duration: D, delay: 0.25 + i * 0.1, repeat: Infinity, repeatDelay: 0.8, times: T, ease: [0.22, 1, 0.36, 1] }}
          >
            <Icon className="h-3 w-3" style={{ color: MUTED }} strokeWidth={1.6} />
            <div className="mt-0.5 text-[22px] font-light leading-none tracking-[-0.02em]" style={{ color: INK }}>{value}</div>
            <div className="mt-0.5 text-[7px] font-medium" style={{ color: MUTED }}>{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Bento: sötét profilkártya + idővonal */}
      <div className="flex flex-1 gap-2 min-h-0">
        <motion.div
          className="relative shrink-0 overflow-hidden rounded-[13px]"
          style={{ width: 60, background: '#1D1C19' }}
          animate={r ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0], scale: [0.94, 1, 1, 0.96] }}
          transition={{ duration: D, delay: 0.38, repeat: Infinity, repeatDelay: 0.8, times: T, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg,rgba(255,255,255,0.07) 0%,transparent 55%)' }} />
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: 26 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.38)', fontWeight: 600 }}>KA</span>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-2 py-[6px]" style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)' }}>
            <div className="truncate text-[6.5px] font-semibold leading-tight text-white">Kovács Anna</div>
            <div className="text-[5.5px] text-white/55">Tulajdonos</div>
          </div>
          <div className="absolute right-1.5 top-1.5 rounded-[5px] px-1 py-0.5 text-[5.5px] font-semibold text-white" style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.17)', backdropFilter: 'blur(6px)' }}>
            12 ma
          </div>
        </motion.div>

        <motion.div
          {...card('flex-1 min-w-0 px-2 py-1.5')}
          animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
          transition={{ duration: D, delay: 0.44, repeat: Infinity, repeatDelay: 0.8, times: T }}
        >
          <div className="mb-1.5 text-[7px] font-medium" style={{ color: MUTED }}>Napi idővonal</div>
          {[
            { l: 8, w: 30, bg: S_CONFIRMED_BG },
            { l: 44, w: 22, bg: S_PENDING_BG },
            { l: 6, w: 42, bg: S_COMPLETED_BG },
          ].map((b, i) => (
            <div key={i} className="relative mb-[5px] rounded-[3px]" style={{ height: 9, background: 'rgba(120,110,70,.09)' }}>
              <motion.div
                className="absolute top-0 bottom-0 rounded-[3px]"
                style={{ left: `${b.l}%`, background: b.bg }}
                animate={r ? { width: `${b.w}%` } : { width: ['0%', `${b.w}%`, `${b.w}%`, '0%'] }}
                transition={{ duration: D, delay: 0.5 + i * 0.08, repeat: Infinity, repeatDelay: 0.8, times: T, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ── Bookings — SalonDailyView lista: rounded-[26px] dav-card-glass + divide-y sorok
// Forrás: SalonDailyView.tsx — idő (tabular) | név + szolgáltatás | status dot + label

function BookingsPreview({ r, variant }: PrevProps) {
  const isRest = variant === 'restaurant'
  const items = isRest ? [
    { time: '18:00', end: '20:00', name: 'Nagy Péter', svc: '4 fő · A2', dot: MUTED },
    { time: '19:30', end: '21:00', name: 'Kovács Éva', svc: '2 fő · B1', dot: GOLD },
    { time: '20:00', end: '22:00', name: 'Tóth János', svc: '6 fő · A3', dot: S_COMPLETED_BG },
  ] : [
    { time: '09:00', end: '10:30', name: 'Kovács Anna', svc: 'Hajvágás · Zsófi', dot: INK },
    { time: '10:30', end: '12:00', name: 'Nagy Béla', svc: 'Tónusozás · Anna', dot: GOLD },
    { time: '12:00', end: '13:30', name: 'Tóth Csilla', svc: 'Hajfestés · Zsófi', dot: S_COMPLETED_BG },
  ]
  const dotLabel: Record<string, string> = {
    [INK]: 'Megerősített', [GOLD]: 'Függő', [S_COMPLETED_BG]: 'Teljesített', [MUTED]: 'Lemondva',
  }
  return (
    <div className="flex h-full w-full flex-col px-3 py-3">
      {/* SalonDailyView fejléc: big font-light dátum + pill-badge */}
      <motion.div
        className="mb-2.5 flex items-baseline justify-between"
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.14, 0.86, 1] }}
      >
        <span className="text-[22px] font-light leading-none tracking-[-0.02em]" style={{ color: INK }}>Ma</span>
        <span className="rounded-full px-2 py-0.5 text-[8px] font-semibold" style={{ background: GOLD, color: INK }}>3 foglalás</span>
      </motion.div>

      {/* Lista kártya: rounded-[26px] dav-card-glass + divide-y (SalonDailyView card stílus) */}
      <div className="flex-1 overflow-hidden rounded-[16px]" style={{ background: GLASS, border: `1px solid ${LINE}` }}>
        {items.map((it, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{ borderTop: i > 0 ? `1px solid ${LINE}` : 'none' }}
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], x: [8, 0, 0, 8] }}
            transition={{ duration: 4, delay: i * 0.15, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.82, 1], ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Idő oszlop (tabular, font-semibold) */}
            <div className="shrink-0 w-9">
              <div className="text-[10px] font-semibold tabular-nums leading-tight" style={{ color: INK }}>{it.time}</div>
              <div className="text-[8px] tabular-nums" style={{ color: MUTED }}>{it.end}</div>
            </div>
            {/* Vendég + szolgáltatás */}
            <div className="flex-1 min-w-0">
              <div className="truncate text-[10px] font-medium" style={{ color: INK }}>{it.name}</div>
              <div className="truncate text-[8px]" style={{ color: MUTED }}>{it.svc}</div>
            </div>
            {/* Status dot + label */}
            <div className="flex shrink-0 items-center gap-1">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: it.dot }} />
              <span className="text-[7px]" style={{ color: MUTED }}>{dotLabel[it.dot]}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Schedule — havi beosztás-naptár: nap-cellák stacked avatar-chipekkel ──────
// Forrás: ScheduleView — chipStyle(shift)=gold, sick=sötét, leave=bézs;
// minden cellában kis körök egymásra csúszva (fehér elválasztó gyűrűvel).

function SchedulePreview({ r }: PrevProps) {
  const WD = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']
  const CHIP_SHIFT = '#F1CE45'   // chipStyle('shift').bg
  const CHIP_SICK  = '#1D1C19'   // chipStyle('sick').bg
  const CHIP_LEAVE = '#E4DECC'   // chipStyle('leave').bg

  // 3 hét × 7 nap; minden elem az aznap dolgozó / szabadságon lévő chipszínei
  const S = CHIP_SHIFT, K = CHIP_SICK, L = CHIP_LEAVE
  const weeks: string[][][] = [
    [[S, S], [S],    [K, S], [S, S], [S, L], [S],    []   ],
    [[S],    [S, S], [],     [L, S], [S, S, S], [],   []   ],
    [[S, S], [],     [S, K], [S],    [S],    [S],     []   ],
  ]
  // „Ma" = 1. hét, Csütörtök (index 3) → arany háttér
  const todayW = 0, todayD = 3

  return (
    <div className="flex h-full w-full flex-col px-2.5 pb-2 pt-2.5">
      {/* Nap-fejlécek */}
      <div className="mb-1.5 flex gap-0.5">
        {WD.map((d, i) => (
          <div key={i} className="flex-1 text-center" style={{ fontSize: 7, fontWeight: 600, color: i >= 5 ? '#C98A2E' : MUTED }}>{d}</div>
        ))}
      </div>

      {/* Hetek */}
      <div className="flex flex-1 flex-col gap-0.5">
        {weeks.map((week, ri) => (
          <div key={ri} className="flex flex-1 gap-0.5">
            {week.map((chips, di) => {
              const isToday = ri === todayW && di === todayD
              const num = 4 + ri * 7 + di
              return (
                <motion.div
                  key={di}
                  className="flex flex-1 flex-col overflow-hidden rounded-[5px] p-[3px]"
                  style={{
                    background: isToday ? 'rgba(241,206,69,.22)' : 'rgba(255,255,255,.6)',
                    border: `1px solid ${isToday ? '#E0B325' : 'rgba(120,110,70,.10)'}`,
                  }}
                  animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 3.5, delay: (ri * 7 + di) * 0.045, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.8, 1] }}
                >
                  <span style={{ fontSize: 6, fontWeight: 600, color: isToday ? INK : MUTED, lineHeight: 1.2 }}>{num}</span>
                  {/* Avatar-chip stack */}
                  <div className="mt-auto flex" style={{ height: 10 }}>
                    {chips.slice(0, 3).map((color, ci) => (
                      <span
                        key={ci}
                        style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: color,
                          marginLeft: ci > 0 ? -3 : 0,
                          border: '1px solid rgba(255,255,255,.85)',
                          display: 'inline-block',
                          flexShrink: 0,
                          position: 'relative',
                          zIndex: chips.length - ci,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Services — ServicesManager CAT_TINTS-szel ─────────────────────────────────

function ServicesPreview({ r }: PrevProps) {
  const cats = [
    { name: 'Hajápolás', count: 6, rev: '2,4 M Ft', tint: CAT[0] },
    { name: 'Manikűr', count: 4, rev: '840 e Ft', tint: CAT[1] },
    { name: 'Arctisztítás', count: 3, rev: '610 e Ft', tint: CAT[2] },
  ]
  return (
    <div className="flex h-full w-full flex-col px-3 py-3 gap-2">
      <motion.div
        {...card('flex items-center gap-4 px-3 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.15, 0.85, 1] }}
      >
        <div>
          <div className="text-[22px] font-light leading-none" style={{ color: INK }}>13</div>
          <div className="text-[8.5px] font-medium" style={{ color: MUTED }}>aktív szolgáltatás</div>
        </div>
        <div className="h-8 w-px" style={{ background: LINE }} />
        <div>
          <div className="text-[22px] font-light leading-none" style={{ color: INK }}>3,8 M</div>
          <div className="text-[8.5px] font-medium" style={{ color: MUTED }}>idei bevétel (Ft)</div>
        </div>
      </motion.div>
      {cats.map((c, i) => (
        <motion.div
          key={i}
          className="flex overflow-hidden rounded-[10px]"
          style={{ background: c.tint.grad }}
          animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [5, 0, 0, 5] }}
          transition={{ duration: 3.8, delay: i * 0.25, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.18, 0.82, 1] }}
        >
          <div className="w-2 shrink-0" style={{ background: c.tint.head }} />
          <div className="flex flex-1 items-center justify-between px-2 py-1.5">
            <span className="text-[10px] font-semibold" style={{ color: INK }}>{c.name}</span>
            <span className="text-[9px]" style={{ color: MUTED }}>{c.count} svc · {c.rev}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Staff — StaffManager: filter toolbar + bg-white/90 lista konténer + avatar + stats
// Forrás: StaffManager.tsx — rounded-t-[24px] glass toolbar, rounded-b-[28px] white lista,
// minden sor: gradient avatar kör + név + role_title + foglalásszám

function StaffPreview({ r }: PrevProps) {
  const members = [
    { init: 'KA', name: 'Kovács Anna', role: 'Fodrász', n: 42, grad: CAT[0].grad },
    { init: 'NB', name: 'Nagy Béla', role: 'Manikűr', n: 28, grad: CAT[1].grad },
    { init: 'TC', name: 'Tóth Csilla', role: 'Fodrász', n: 35, grad: CAT[2].grad },
  ]
  return (
    <div className="flex h-full w-full flex-col px-3 py-3 gap-1.5">
      {/* Filter toolbar — glass pill (StaffManager rounded-t-[24px] glass toolbar) */}
      <motion.div
        className="flex items-center gap-1.5 rounded-[18px] px-2.5 py-2"
        style={{ background: 'rgba(255,255,255,.62)', border: `1px solid ${LINE}` }}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.14, 0.86, 1] }}
      >
        {['Részleg ▾', 'Pozíció ▾'].map((label, i) => (
          <div key={i} className="flex items-center rounded-[10px] px-2 py-[4px]" style={{ background: 'white', border: `1px solid ${LINE}` }}>
            <span className="text-[7.5px] font-semibold" style={{ color: INK }}>{label}</span>
          </div>
        ))}
        <div className="flex flex-1 items-center gap-1 rounded-[10px] px-2 py-[4px]" style={{ background: 'white', border: `1px solid ${LINE}` }}>
          <span className="text-[8px]" style={{ color: MUTED }}>⌕</span>
          <span className="text-[7.5px]" style={{ color: MUTED }}>Keresés</span>
        </div>
      </motion.div>

      {/* Lista konténer — rounded-b-[28px] bg-white/90 (StaffManager lista area stílus) */}
      <div className="flex-1 overflow-hidden rounded-[18px]" style={{ background: 'rgba(255,255,255,.88)', border: `1px solid ${LINE}` }}>
        {members.map((m, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{ borderTop: i > 0 ? `1px solid ${LINE}` : 'none' }}
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], x: [-8, 0, 0, -8] }}
            transition={{ duration: 4, delay: i * 0.16, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.82, 1], ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Gradient avatar kör (StaffManager avatarUrl/monogram) */}
            <div style={{ width: 32, height: 32, borderRadius: 10, background: m.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: INK, flexShrink: 0 }}>
              {m.init}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[10px] font-semibold" style={{ color: INK }}>{m.name}</div>
              <div className="text-[8px]" style={{ color: MUTED }}>{m.role}</div>
            </div>
            {/* Foglalásszám + felirat */}
            <div className="shrink-0 text-right">
              <div className="text-[13px] font-light leading-tight" style={{ color: INK }}>{m.n}</div>
              <div className="text-[7px]" style={{ color: MUTED }}>foglalás</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Hours — vízszintes 8→24 idővonal, nap-sorok dark barral ────────────────────
// Forrás: SalonAvailabilityView.tsx — blockGeo, 8–24 skála, mai sor kiemelve

function HoursPreview({ r }: PrevProps) {
  // 16 órás span: 8→24; pozíció = (h-8)/16 * 100%
  const toL = (h: number) => ((h - 8) / 16) * 100
  const toW = (from: number, to: number) => ((to - from) / 16) * 100
  const days = [
    { label: 'Hét', open: true, from: 9, to: 18 },
    { label: 'Kedd', open: true, from: 9, to: 18 },
    { label: 'Sze', open: true, from: 9, to: 17 },
    { label: 'Csüt', open: true, from: 9, to: 18, today: true },
    { label: 'Pén', open: true, from: 9, to: 20 },
    { label: 'Szo', open: true, from: 10, to: 16 },
    { label: 'Vas', open: false, from: 0, to: 0 },
  ]
  return (
    <div className="flex h-full w-full flex-col px-3 pt-2.5 pb-2">
      {/* Óra-skála */}
      <div className="flex items-end mb-2" style={{ paddingLeft: 30 }}>
        <div className="relative flex-1 h-4">
          {['8', '12', '16', '20', '24'].map((h, i) => (
            <span key={h} className="absolute text-[7px] font-medium" style={{
              color: MUTED,
              left: `${i * 25}%`,
              transform: i > 0 && i < 4 ? 'translateX(-50%)' : i === 4 ? 'translateX(-100%)' : 'none',
              bottom: 0,
            }}>{h}</span>
          ))}
        </div>
      </div>
      {/* Nap-sorok */}
      <div className="flex flex-1 flex-col gap-[5px]">
        {days.map((d, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 flex-1"
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
            transition={{ duration: 3.8, delay: i * 0.07, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.18, 0.82, 1] }}
          >
            <span className="shrink-0 text-[7px] font-medium" style={{ width: 26, color: d.today ? INK : MUTED, fontWeight: d.today ? 700 : 500 }}>
              {d.label}
            </span>
            <div className="relative flex-1 rounded-[3px]" style={{ height: 11, background: 'rgba(120,110,70,.10)' }}>
              {d.open && (
                <motion.div
                  className="absolute top-0 bottom-0 rounded-[3px]"
                  style={{ left: `${toL(d.from)}%`, background: d.today ? GOLD : '#26231F' }}
                  animate={r
                    ? { width: `${toW(d.from, d.to)}%` }
                    : { width: ['0%', `${toW(d.from, d.to)}%`, `${toW(d.from, d.to)}%`, '0%'] }
                  }
                  transition={{ duration: 3.8, delay: 0.4 + i * 0.07, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.28, 0.78, 1], ease: 'easeOut' }}
                />
              )}
            </div>
            <span className="shrink-0 text-[6px]" style={{ color: MUTED, width: 22, textAlign: 'right' }}>
              {d.open ? `${d.from}–${d.to}` : 'zárva'}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Analytics — vonaldiagram: arany folyamatos + sötét pontozott (AnalyticsOverview.tsx) ───
// Forrás: AnalyticsOverview.tsx HiringChart — gold #F1CE45 LineChart + ink #1D1C19 dotted

function AnalyticsPreview({ r }: PrevProps) {
  const vals = [48, 55, 42, 72, 65, 58, 76, 62, 80, 68, 74, 88]
  const prev = vals.map(v => Math.round(v * 0.82))
  const W = 100, H = 48, max = 92
  const toX = (i: number) => (i / (vals.length - 1)) * W
  const toY = (v: number) => H - (v / max) * H
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const areaPath = `${line(vals)} L${W},${H} L0,${H} Z`

  return (
    <div className="flex h-full w-full flex-col px-3 py-2.5 gap-2">
      {/* KPI + change */}
      <motion.div
        {...card('flex items-center justify-between px-2.5 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.8, 1] }}
      >
        <div>
          <div className="text-[7.5px]" style={{ color: MUTED }}>Foglalás (30 nap)</div>
          <div className="text-[18px] font-light leading-tight" style={{ color: INK }}>114</div>
        </div>
        <span className="text-[11px] font-semibold" style={{ color: '#1D9D63' }}>+18%</span>
      </motion.div>

      {/* Vonaldiagram SVG */}
      <motion.div
        {...card('flex-1 px-2 py-1.5 overflow-hidden')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.8, delay: 0.3, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.22, 0.8, 1] }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" style={{ display: 'block' }}>
          {/* Vízszintes segédvonalak */}
          {[0.25, 0.5, 0.75].map((f, i) => (
            <line key={i} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#efebdf" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          ))}
          {/* Területkitöltés az arany vonal alatt */}
          <path d={areaPath} fill={GOLD} fillOpacity={0.12} />
          {/* Előző időszak — sötét pontozott (ink, strokeDasharray) */}
          <path d={line(prev)} fill="none" stroke="#8a8880" strokeWidth="1.6" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          {/* Aktuális időszak — arany folyamatos */}
          <motion.path
            d={line(vals)}
            fill="none"
            stroke={GOLD}
            strokeWidth="2.2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
            transition={{ duration: 3.8, delay: 0.55, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.32, 0.8, 1] }}
          />
        </svg>
      </motion.div>

      {/* Jelmagyarázat */}
      <div className="flex items-center gap-3 px-0.5">
        <span className="flex items-center gap-1 text-[6.5px]" style={{ color: MUTED }}>
          <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: GOLD }} />
          Aktuális
        </span>
        <span className="flex items-center gap-1 text-[6.5px]" style={{ color: MUTED }}>
          <svg width="16" height="2"><line x1="0" y1="1" x2="16" y2="1" stroke="#8a8880" strokeWidth="1.5" strokeDasharray="2 3" /></svg>
          Előző
        </span>
      </div>
    </div>
  )
}

// ── Tips — sötét „E heti tipp" kártya + egészség-score kördiagram ─────────────
// Forrás: TipsAdvisorView — bg-ink-dark + Zap ghost; health score = SVG kör arany stroke-kal.

function TipsPreview({ r, variant }: PrevProps) {
  const healthLabel = variant === 'restaurant' ? 'Étterem-egészség' : 'Szalon-egészség'
  const score = 72
  const R = 18
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex h-full w-full flex-col gap-1.5 px-3 py-2.5">
      {/* E heti tipp — sötét kártya (TipsAdvisorView bg-ink-dark p-7) */}
      <motion.div
        className="relative flex-1 overflow-hidden rounded-[13px] p-3"
        style={{ background: INK, boxShadow: '0 4px 16px rgba(20,16,6,.30)' }}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.18, 0.82, 1] }}
      >
        {/* Zap ghost — pontosan mint az élő nézetben */}
        <Zap className="pointer-events-none absolute -bottom-4 -right-3 h-16 w-16 opacity-[0.07]" style={{ color: GOLD }} fill={GOLD} strokeWidth={0} />
        <span className="relative inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide" style={{ background: 'rgba(241,206,69,.16)', color: GOLD }}>
          <Zap className="h-2 w-2" fill={GOLD} strokeWidth={0} /> E heti tipp
        </span>
        <p className="relative mt-1.5 text-[9px] font-light leading-snug text-white/90">
          Töltsd fel a borítóképet — a vendégek 3× többet foglalnak.
        </p>
        <div className="relative mt-2">
          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: GOLD, color: INK }}>
            Alkalmaz
          </span>
        </div>
      </motion.div>

      {/* Egészség-score — SVG kör arany stroke (TipsAdvisorView) */}
      <motion.div
        {...card('flex items-center gap-2.5 px-2.5 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.8, delay: 0.3, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.8, 1] }}
      >
        <div className="relative flex shrink-0 items-center justify-center">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={R} fill="none" stroke="#EFEAD8" strokeWidth="5" />
            <motion.circle
              cx="22" cy="22" r={R} fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={r
                ? { strokeDashoffset: offset }
                : { strokeDashoffset: [circ, offset, offset, circ] }
              }
              transition={{ duration: 3.8, delay: 0.5, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.32, 0.82, 1] }}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="absolute text-[11px] font-light" style={{ color: INK }}>{score}</span>
        </div>
        <div>
          <div className="text-[8px] font-medium" style={{ color: MUTED }}>{healthLabel}</div>
          <div className="text-[14px] font-light leading-tight" style={{ color: INK }}>
            {score}<span className="text-[9px]" style={{ color: MUTED }}>/100</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Settings — SettingsHub 2-oszlopos layout: bal rail (7 fül) + jobb panel tartalommal ──
// Forrás: SettingsHub.tsx — RailId fülsor + Csapat & jogok panel + cross-section snippetek

function SettingsPreview({ r, variant }: PrevProps) {
  // Pontosan a SettingsHub RAIL sorrendje (owner nézet)
  const rail = [
    'Üzlet profil',
    'Foglalási szabályok',
    'Email sablonok',
    'Értesítések',
    'Csapat & jogok',
    'Számlázás',
    'Audit-napló',
  ]
  const activeIdx = 4 // 'Csapat & jogok' aktív

  const team = [
    { init: 'KA', name: 'Kovács Anna', role: 'Tulajdonos', grad: CAT[0].grad },
    { init: 'NB', name: 'Nagy Béla', role: 'Munkatárs', grad: CAT[1].grad },
    { init: 'TC', name: 'Tóth Cs.', role: 'Munkatárs', grad: CAT[2].grad },
  ]

  return (
    <div className="flex h-full w-full gap-1.5 px-2 py-2.5">
      {/* Bal rail — SettingsHub NavButton-ok */}
      <div className="flex shrink-0 flex-col gap-[3px]" style={{ width: 82 }}>
        {rail.map((label, i) => (
          <motion.div
            key={i}
            className="rounded-[8px] px-2 py-[5px]"
            style={{
              background: i === activeIdx ? 'rgba(241,206,69,.16)' : 'rgba(255,255,255,.38)',
              border: `1px solid ${i === activeIdx ? 'rgba(241,206,69,.38)' : 'rgba(120,110,70,.08)'}`,
            }}
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
            transition={{ duration: 4, delay: i * 0.06, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.16, 0.84, 1] }}
          >
            <span className="block text-[6.8px] leading-tight" style={{ fontWeight: i === activeIdx ? 700 : 500, color: i === activeIdx ? INK : MUTED }}>
              {label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Jobb panel — Csapat & jogok + kereszt-szekciós snippetek */}
      <div className="flex flex-1 min-w-0 flex-col gap-1.5">
        <div className="text-[8px] font-bold leading-none mb-0.5" style={{ color: INK }}>Csapat & jogok</div>

        {/* Team tag-kártyák */}
        {team.map((m, i) => (
          <motion.div
            key={i}
            {...card('flex items-center gap-1.5 px-2 py-1.5')}
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], x: [6, 0, 0, 6] }}
            transition={{ duration: 4, delay: 0.28 + i * 0.13, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.2, 0.82, 1], ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 7, background: m.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: INK, flexShrink: 0 }}>
              {m.init}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="truncate text-[8.5px] font-semibold leading-tight" style={{ color: INK }}>{m.name}</div>
              <div className="text-[6.8px]" style={{ color: MUTED }}>{m.role}</div>
            </div>
          </motion.div>
        ))}

        {/* Értesítés toggle snippet */}
        <motion.div
          {...card('flex items-center justify-between px-2 py-[5px]')}
          animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
          transition={{ duration: 4, delay: 0.7, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.22, 0.82, 1] }}
        >
          <span className="text-[7px] font-medium" style={{ color: MUTED }}>Email értesítő</span>
          <div className="relative h-[14px] w-[24px] rounded-full" style={{ background: S_COMPLETED_BG }}>
            <div style={{ position: 'absolute', right: 2, top: 2, width: 10, height: 10, borderRadius: '50%', background: 'white' }} />
          </div>
        </motion.div>

        {/* Számlázás csomag-badge snippet */}
        <motion.div
          {...card('flex items-center justify-between px-2 py-[5px]')}
          animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
          transition={{ duration: 4, delay: 0.86, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.22, 0.82, 1] }}
        >
          <span className="text-[7px] font-medium" style={{ color: MUTED }}>Csomag</span>
          <span className="rounded-full px-1.5 py-[2px] text-[6.5px] font-bold" style={{ background: GOLD, color: INK }}>
            {variant === 'restaurant' ? 'Étterem Pro' : 'Szalon Pro'}
          </span>
        </motion.div>
      </div>
    </div>
  )
}

// ── Tables — PONTOSAN a TablesManager kártya: rounded-[18px] border bg-white p-4
// + TableGlyph SVG (sötét rect asztal + bézs körök székek) + big name + Users ikon + fő

function TablesPreview({ r }: PrevProps) {
  const tables = [
    { name: 'A1', capacity: 4 }, { name: 'A2', capacity: 2 },
    { name: 'A3', capacity: 6 }, { name: 'B1', capacity: 4 },
    { name: 'B2', capacity: 8 },
  ]
  return (
    <div className="flex h-full w-full flex-col px-3 py-3">
      {/* Összesítő dark stat kártya (TablesManager: rounded-[20px] bg-ink-dark) */}
      <motion.div
        className="mb-2 flex items-baseline gap-1.5 rounded-[12px] px-2.5 py-2"
        style={{ background: INK }}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.14, 0.86, 1] }}
      >
        <span className="text-[22px] font-light leading-none tracking-[-0.02em] text-white">24</span>
        <span className="text-[9px] font-medium" style={{ color: GOLD }}>fő összes férőhely</span>
      </motion.div>

      {/* Asztal-kártyák rácsa — rounded-[18px] border bg-white p-4 (TablesManager table card) */}
      <div className="grid flex-1 grid-cols-3 gap-1.5 content-start">
        {tables.map((t, i) => (
          <motion.div
            key={i}
            className="rounded-[13px] border p-2"
            style={{ background: '#fff', borderColor: LINE }}
            animate={r ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0], scale: [0.82, 1, 1, 0.88] }}
            transition={{ duration: 4, delay: 0.18 + i * 0.1, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.22, 0.8, 1], ease: [0.22, 1, 0.36, 1] }}
          >
            {/* TableGlyph — pontosan a valódi komponens (sötét asztal + bézs székek) */}
            <TableGlyph capacity={t.capacity} size={24} />
            <div className="mt-1 truncate text-[14px] font-semibold leading-none tracking-[-0.01em]" style={{ color: INK }}>{t.name}</div>
            <div className="mt-0.5 flex items-center gap-0.5" style={{ color: MUTED }}>
              <Users className="h-[9px] w-[9px] shrink-0" strokeWidth={1.8} />
              <span className="tabular-nums text-[7.5px]">{t.capacity} fő</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── PWA — PwaInstallCard pontos kinézete: fejléc chip + előnylista + telepítés ─
// Forrás: PwaInstallCard.tsx — ink bg chip, BENEFITS bullets, StepList

function PwaPreview({ r }: PrevProps) {
  const benefits = [
    'Ikon kerül a telefon főképernyőjére',
    'Teljes képernyős, böngésző-sáv nélkül',
    'Push értesítések bekapcsolhatók',
  ]
  const steps = ['Megosztás (□↑) gomb Safari alján', 'Főképernyőhöz adás', 'Hozzáadás (jobb felül)']
  return (
    <div className="flex h-full w-full flex-col px-3 py-3 gap-2">
      {/* Fejléc — PwaInstallCard header: ink chip + "Telepítve" badge */}
      <motion.div
        {...card('flex items-center gap-2 px-2.5 py-2.5')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [6, 0, 0, 6] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.14, 0.86, 1] }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 11, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Smartphone style={{ width: 17, height: 17, color: GOLD }} strokeWidth={1.7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-[10px] font-semibold leading-tight" style={{ color: INK }}>Alkalmazásként telepíthető</div>
          <div className="text-[8px] mt-0.5" style={{ color: MUTED }}>App Store nélkül, böngészőből</div>
        </div>
        <motion.span
          className="shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[7px] font-semibold"
          style={{ background: 'rgba(29,157,99,.12)', color: '#1D9D63' }}
          animate={r ? { opacity: 1 } : { opacity: [0, 0, 1, 0] }}
          transition={{ duration: 4, delay: 2, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.48, 0.88, 1] }}
        >
          ✓ Telepítve
        </motion.span>
      </motion.div>

      {/* "Mit kapsz vele" — BENEFITS lista, aranypont */}
      <motion.div
        {...card('flex-1 px-2.5 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, delay: 0.25, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.16, 0.84, 1] }}
      >
        <div className="text-[7px] font-bold uppercase tracking-[0.09em] mb-1.5" style={{ color: MUTED }}>Mit kapsz vele</div>
        {benefits.map((b, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-1.5 mb-[5px]"
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], x: [-5, 0, 0, -5] }}
            transition={{ duration: 4, delay: 0.35 + i * 0.12, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.2, 0.82, 1], ease: [0.22, 1, 0.36, 1] }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, marginTop: 3, flexShrink: 0 }} />
            <span className="text-[8px] leading-snug" style={{ color: MUTED }}>{b}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* StepList — iOS telepítési lépések (számozott körök, mint StepList) */}
      <motion.div
        {...card('px-2.5 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, delay: 0.55, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.2, 0.82, 1] }}
      >
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1 text-center">
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: INK, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </span>
              <span className="text-[6.5px] leading-snug" style={{ color: MUTED }}>{s}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ── Done ──────────────────────────────────────────────────────────────────────

function DonePreview({ r }: PrevProps) {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * 36 * Math.PI) / 180
    return { x: Math.round(Math.cos(angle) * 56), y: Math.round(Math.sin(angle) * 56), color: i % 2 === 0 ? GOLD : INK, delay: i * 0.08 }
  })
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <motion.div
        className="relative z-10 flex h-[64px] w-[64px] items-center justify-center rounded-full"
        style={{ background: INK, boxShadow: '0 12px 32px rgba(25,19,20,0.22)' }}
        animate={r ? { scale: 1 } : { scale: [0.6, 1, 1, 0.94, 1] }}
        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, times: [0, 0.3, 0.65, 0.82, 1] }}
      >
        <motion.svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <motion.path
            d="M8 16L13 21L24 11"
            stroke={GOLD}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={r ? { pathLength: 1 } : { pathLength: [0, 1, 1, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5, times: [0, 0.35, 0.65, 1] }}
          />
        </motion.svg>
      </motion.div>
      {!r && dots.map((d, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{ background: d.color }}
          animate={{ x: [0, d.x, d.x * 1.4], y: [0, d.y, d.y + 28], opacity: [0, 1, 0], scale: [0, 1.3, 0] }}
          transition={{ duration: 1.8, delay: d.delay + 0.5, repeat: Infinity, repeatDelay: 2, times: [0, 0.45, 1], ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ── Registry + export ─────────────────────────────────────────────────────────

type PC = React.ComponentType<PrevProps>
const MAP: Record<PreviewKey, PC> = {
  welcome: WelcomePreview, overview: OverviewPreview, bookings: BookingsPreview,
  schedule: SchedulePreview, services: ServicesPreview, staff: StaffPreview,
  hours: HoursPreview, analytics: AnalyticsPreview, tips: TipsPreview,
  settings: SettingsPreview, tables: TablesPreview, pwa: PwaPreview, done: DonePreview,
}

export function TourPreview({ stepKey, variant = 'salon' }: { stepKey: PreviewKey; variant?: 'salon' | 'restaurant' }) {
  const reduced = useReducedMotion() ?? false
  const Preview = MAP[stepKey]
  return (
    <div
      className="relative h-[190px] sm:h-[240px] w-full overflow-hidden rounded-[22px]"
      style={{ background: 'var(--dav-container-gradient)', boxShadow: '0 6px 28px rgba(80,70,30,0.10)' }}
    >
      <Preview r={reduced} variant={variant} />
    </div>
  )
}
