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
import { Lightbulb, TrendingUp, Minus, CalendarDays, Banknote, Users, type LucideIcon } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'

export type PreviewKey =
  | 'welcome' | 'overview' | 'bookings' | 'schedule' | 'services'
  | 'staff' | 'hours' | 'analytics' | 'tips' | 'settings' | 'tables' | 'done'

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

function card(extra?: string) {
  return {
    style: { background: GLASS, border: `1px solid ${LINE}`, boxShadow: SHADOW } as React.CSSProperties,
    className: `rounded-[13px] backdrop-blur-sm ${extra ?? ''}`,
  }
}

// ── Welcome ───────────────────────────────────────────────────────────────────

function WelcomePreview({ r }: { r: boolean }) {
  const dots = [
    { top: '16%', left: '12%', delay: 0, size: 5 },
    { top: '10%', right: '14%', delay: 0.7, size: 4 },
    { bottom: '20%', left: '10%', delay: 1.3, size: 4 },
    { bottom: '14%', right: '12%', delay: 0.4, size: 5 },
    { top: '52%', left: '7%', delay: 1.0, size: 3 },
    { top: '48%', right: '7%', delay: 0.2, size: 3 },
  ]
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-2.5">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(80% 80% at 80% 20%, rgba(241,206,69,.32) 0%, transparent 58%)' }} />
      <motion.div
        className="relative z-10"
        animate={r ? {} : { opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* variant="light" = _light.svg = sötét (#3B3B3B) szöveg, látható krém háttéren */}
        <BrandLogo variant="light" className="h-7 w-auto" />
      </motion.div>
      <p className="relative z-10 text-[10px] font-medium" style={{ color: MUTED }}>foglalási rendszer</p>
      {!r && dots.map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ ...(d as object), width: d.size, height: d.size, background: GOLD } as React.CSSProperties}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 0.4] }}
          transition={{ duration: 2, delay: d.delay as number, repeat: Infinity, repeatDelay: 0.6 }}
        />
      ))}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

type KPI = { label: string; value: string; icon: LucideIcon; trend: 'up' | 'flat' }
function OverviewPreview({ r }: { r: boolean }) {
  const kpis: KPI[] = [
    { label: 'Ma', value: '12', icon: CalendarDays, trend: 'up' },
    { label: 'Bevétel', value: '84e', icon: Banknote, trend: 'up' },
    { label: 'Vendég', value: '27', icon: Users, trend: 'flat' },
  ]
  const bars = [4, 7, 5, 9, 8, 6, 7]
  return (
    <div className="flex h-full w-full flex-col gap-2 px-3 py-3">
      <div className="flex gap-1.5">
        {kpis.map(({ label, value, icon: Icon, trend }, i) => (
          <motion.div
            key={i}
            {...card('flex-1 px-2.5 py-2')}
            animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [8, 0, 0, 8] }}
            transition={{ duration: 3.5, delay: i * 0.16, repeat: Infinity, repeatDelay: 1, times: [0, 0.2, 0.8, 1] }}
          >
            <div className="mb-0.5 flex items-center gap-1">
              <Icon className="h-3 w-3 shrink-0" style={{ color: MUTED }} strokeWidth={1.8} />
              <span className="text-[8px] font-medium" style={{ color: MUTED }}>{label}</span>
            </div>
            <div className="text-[20px] font-light leading-none" style={{ color: INK }}>{value}</div>
            <div className="mt-1">
              {trend === 'up'
                ? <TrendingUp className="h-2.5 w-2.5" style={{ color: S_COMPLETED_BG }} strokeWidth={2.5} />
                : <Minus className="h-2.5 w-2.5" style={{ color: MUTED }} strokeWidth={2.5} />
              }
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        {...card('flex-1 flex items-end px-2.5 pb-2 pt-1.5 gap-1')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.5, delay: 0.5, repeat: Infinity, repeatDelay: 1, times: [0, 0.25, 0.8, 1] }}
      >
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-[3px]"
            style={{ background: GOLD }}
            animate={r ? { height: h * 7 } : { height: [0, h * 7, h * 7, 0] }}
            transition={{ duration: 3.5, delay: 0.5 + i * 0.08, repeat: Infinity, repeatDelay: 1, times: [0, 0.28, 0.78, 1], ease: 'easeOut' }}
          />
        ))}
      </motion.div>
    </div>
  )
}

// ── Bookings — SalonDailyView statusBlock pontos színeivel ────────────────────

function BookingsPreview({ r }: { r: boolean }) {
  const items = [
    { name: 'Kovács Anna', time: '09:00', svc: 'Hajvágás', bg: S_CONFIRMED_BG, fg: S_CONFIRMED_FG },
    { name: 'Nagy Béla', time: '10:30', svc: 'Tónusozás', bg: S_PENDING_BG, fg: S_PENDING_FG },
    { name: 'Tóth Csilla', time: '12:00', svc: 'Hajfestés', bg: S_COMPLETED_BG, fg: S_COMPLETED_FG },
  ]
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1.5 px-3">
      <motion.div
        {...card('flex items-center justify-between px-2.5 py-1.5 mb-0.5')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.12, 0.88, 1] }}
      >
        <span className="text-[9px] font-semibold" style={{ color: INK }}>Ma, jún. 23.</span>
        <span className="rounded-full px-2 py-0.5 text-[8px] font-semibold" style={{ background: GOLD, color: INK }}>3 foglalás</span>
      </motion.div>
      {items.map((it, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2 overflow-hidden rounded-[10px] px-2.5 py-2"
          style={{ background: it.bg }}
          animate={r ? { opacity: 1 } : { x: [16, 0, 0, 16], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 4, delay: i * 0.18, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.14, 0.86, 1], ease: 'easeOut' }}
        >
          <span className="text-[10px] font-semibold" style={{ color: it.fg }}>{it.time}</span>
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold" style={{ color: it.fg }}>{it.name}</span>
          <span className="shrink-0 text-[9px] opacity-75" style={{ color: it.fg }}>{it.svc}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ── Schedule — heti naptár SalonDailyView-stílusú blokkokkal ─────────────────

function SchedulePreview({ r }: { r: boolean }) {
  const days = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V']
  type Ev = { day: number; row: number; bg: string; fg: string; label: string }
  const events: Ev[] = [
    { day: 0, row: 0, bg: S_CONFIRMED_BG, fg: S_CONFIRMED_FG, label: 'Kovács A.' },
    { day: 0, row: 1, bg: S_PENDING_BG, fg: S_PENDING_FG, label: 'Nagy B.' },
    { day: 1, row: 0, bg: S_COMPLETED_BG, fg: S_COMPLETED_FG, label: 'Tóth C.' },
    { day: 2, row: 1, bg: S_CONFIRMED_BG, fg: S_CONFIRMED_FG, label: 'Kiss P.' },
    { day: 3, row: 0, bg: S_PENDING_BG, fg: S_PENDING_FG, label: 'Varga M.' },
    { day: 4, row: 0, bg: S_COMPLETED_BG, fg: S_COMPLETED_FG, label: 'Szabó J.' },
    { day: 4, row: 2, bg: S_CONFIRMED_BG, fg: S_CONFIRMED_FG, label: 'Horváth K.' },
  ]
  const EMPTY = { background: 'rgba(120,110,70,.07)', border: '1px solid rgba(120,110,70,.10)' }
  return (
    <div className="flex h-full w-full flex-col px-3 pt-2.5">
      <div className="mb-1.5 flex gap-0.5">
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[7.5px] font-semibold" style={{ color: i === 0 ? INK : MUTED }}>{d}</div>
        ))}
      </div>
      {[0, 1, 2].map((row) => (
        <div key={row} className="mb-1 flex gap-0.5">
          {days.map((_, di) => {
            const ev = events.find((e) => e.day === di && e.row === row)
            if (!ev) return <div key={di} className="h-[26px] flex-1 rounded-[5px]" style={EMPTY} />
            return (
              <motion.div
                key={di}
                className="h-[26px] flex-1 overflow-hidden rounded-[5px] px-1 flex items-center"
                style={{ background: ev.bg }}
                animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], scaleY: [0.5, 1, 1, 0.5] }}
                transition={{ duration: 3.5, delay: di * 0.09 + row * 0.2, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.8, 1] }}
              >
                <span className="truncate text-[7px] font-semibold leading-none" style={{ color: ev.fg }}>{ev.label}</span>
              </motion.div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Services — ServicesManager CAT_TINTS-szel ─────────────────────────────────

function ServicesPreview({ r }: { r: boolean }) {
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

// ── Staff ─────────────────────────────────────────────────────────────────────

function StaffPreview({ r }: { r: boolean }) {
  const members = [
    { init: 'KA', name: 'Kovács Anna', role: 'Fodrász', n: 42, grad: CAT[0].grad },
    { init: 'NB', name: 'Nagy Béla', role: 'Manikűr', n: 28, grad: CAT[1].grad },
    { init: 'TC', name: 'Tóth Csilla', role: 'Fodrász', n: 35, grad: CAT[2].grad },
  ]
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1.5 px-3">
      {members.map((m, i) => (
        <motion.div
          key={i}
          {...card('flex items-center gap-2.5 px-2.5 py-2')}
          animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], x: [-10, 0, 0, -10] }}
          transition={{ duration: 3.5, delay: i * 0.2, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.8, 1], ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold" style={{ background: m.grad, color: INK }}>
            {m.init}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold" style={{ color: INK }}>{m.name}</div>
            <div className="text-[9px]" style={{ color: MUTED }}>{m.role}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] font-light" style={{ color: INK }}>{m.n}</div>
            <div className="text-[8px]" style={{ color: MUTED }}>foglalás</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Hours ─────────────────────────────────────────────────────────────────────

function HoursPreview({ r }: { r: boolean }) {
  const days = [
    { label: 'H', h: 62, open: true },
    { label: 'K', h: 62, open: true },
    { label: 'Sz', h: 52, open: true },
    { label: 'Cs', h: 62, open: true },
    { label: 'P', h: 62, open: true },
    { label: 'Szo', h: 36, open: true },
    { label: 'V', h: 0, open: false },
  ]
  return (
    <div className="flex h-full w-full items-end justify-center gap-1.5 px-3 pb-4 pt-3">
      {days.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <motion.div
            className="w-full rounded-t-[4px]"
            style={{ background: d.open ? S_COMPLETED_BG : 'rgba(120,110,70,.15)' }}
            animate={r
              ? { height: d.h > 0 ? d.h : 8 }
              : { height: [0, d.h > 0 ? d.h : 8, d.h > 0 ? d.h : 8, 0], opacity: [0, 1, 1, 0] }
            }
            transition={{ duration: 3.5, delay: i * 0.1, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.25, 0.75, 1], ease: 'easeOut' }}
          />
          <span className="text-[7px] font-medium" style={{ color: MUTED }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function AnalyticsPreview({ r }: { r: boolean }) {
  const bars = [48, 72, 56, 88, 64, 52, 76]
  const days = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V']
  return (
    <div className="flex h-full w-full flex-col px-3 py-2.5">
      <motion.div
        {...card('flex items-center justify-between gap-3 px-2.5 py-1.5 mb-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.2, 0.8, 1] }}
      >
        <div>
          <div className="text-[8px]" style={{ color: MUTED }}>Heti foglalás</div>
          <div className="text-[16px] font-light leading-tight" style={{ color: INK }}>114</div>
        </div>
        <div>
          <div className="text-[8px]" style={{ color: MUTED }}>Lemondás</div>
          <div className="text-[16px] font-light leading-tight" style={{ color: INK }}>4</div>
        </div>
        <div>
          <div className="text-[8px]" style={{ color: MUTED }}>Kihasználtság</div>
          <div className="text-[16px] font-light leading-tight" style={{ color: INK }}>78%</div>
        </div>
      </motion.div>
      <div className="flex flex-1 items-end gap-1">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t-[4px]"
              style={{ background: GOLD }}
              animate={r ? { height: h } : { height: [0, h, h, 0], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 3.5, delay: i * 0.09, repeat: Infinity, repeatDelay: 0.8, times: [0, 0.25, 0.75, 1], ease: 'easeOut' }}
            />
            <span className="text-[7.5px]" style={{ color: MUTED }}>{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tips ──────────────────────────────────────────────────────────────────────

function TipsPreview({ r }: { r: boolean }) {
  const tips = [
    { text: 'Kedd a leglassabb nap — érdemes akciót hirdetni', badgeBg: S_COMPLETED_BG, badgeFg: '#fff', badge: '+23%' },
    { text: 'Küldj emlékeztetőt 24 órával a foglalás előtt', badgeBg: GOLD, badgeFg: INK, badge: '↓ 18%' },
  ]
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 px-3">
      {tips.map((t, i) => (
        <motion.div
          key={i}
          {...card('flex items-start gap-2 px-2.5 py-2')}
          animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [6, 0, 0, 6] }}
          transition={{ duration: 4, delay: i * 0.5, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.15, 0.85, 1], ease: 'easeOut' }}
        >
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]" style={{ background: GOLD }}>
            <Lightbulb className="h-3 w-3" style={{ color: INK }} strokeWidth={2} />
          </div>
          <p className="min-w-0 flex-1 text-[9.5px] leading-tight" style={{ color: INK }}>{t.text}</p>
          <span className="ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: t.badgeBg, color: t.badgeFg }}>{t.badge}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsPreview({ r }: { r: boolean }) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 px-3">
      <motion.div
        {...card('flex items-center justify-between px-2.5 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.18, 0.82, 1] }}
      >
        <span className="text-[11px] font-medium" style={{ color: INK }}>Email értesítők</span>
        <motion.div
          className="relative h-5 w-9 rounded-full"
          animate={r ? { backgroundColor: S_COMPLETED_BG } : { backgroundColor: ['rgba(120,110,70,.2)', S_COMPLETED_BG, S_COMPLETED_BG, 'rgba(120,110,70,.2)'] }}
          transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.35, 0.82, 1] }}
        >
          <motion.div
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
            animate={r ? { left: '18px' } : { left: ['2px', '18px', '18px', '2px'] }}
            transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.35, 0.82, 1] }}
          />
        </motion.div>
      </motion.div>
      <motion.div
        className="rounded-[13px] backdrop-blur-sm px-2.5 py-2"
        style={{ background: GLASS, boxShadow: SHADOW, borderWidth: '1.5px', borderStyle: 'solid' }}
        animate={r
          ? { borderColor: LINE, opacity: 1 }
          : { borderColor: [LINE, GOLD, GOLD, LINE], opacity: [0, 1, 1, 0] }
        }
        transition={{ duration: 3.8, delay: 0.3, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.18, 0.82, 1] }}
      >
        <div className="text-[8.5px] font-medium mb-0.5" style={{ color: MUTED }}>Számlázási email</div>
        <span className="text-[11px]" style={{ color: MUTED }}>uzlet@email.hu</span>
      </motion.div>
      <motion.div
        {...card('flex items-center justify-between px-2.5 py-2')}
        animate={r ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: [4, 0, 0, 4] }}
        transition={{ duration: 3.8, delay: 0.5, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.18, 0.82, 1] }}
      >
        <div><div className="text-[8px]" style={{ color: MUTED }}>Cégnév</div><div className="text-[11px] font-medium" style={{ color: INK }}>Példa Kft.</div></div>
        <div><div className="text-[8px]" style={{ color: MUTED }}>Adószám</div><div className="text-[11px] font-medium" style={{ color: INK }}>12345678-1-42</div></div>
      </motion.div>
    </div>
  )
}

// ── Tables ────────────────────────────────────────────────────────────────────

function TablesPreview({ r }: { r: boolean }) {
  type St = 'free' | 'occupied' | 'reserved'
  const grid: { n: number; s: St; seats: number }[][] = [
    [{ n: 1, s: 'free', seats: 4 }, { n: 2, s: 'occupied', seats: 2 }, { n: 3, s: 'free', seats: 4 }],
    [{ n: 4, s: 'reserved', seats: 6 }, { n: 5, s: 'free', seats: 4 }, { n: 6, s: 'occupied', seats: 2 }],
    [{ n: 7, s: 'free', seats: 4 }, { n: 8, s: 'free', seats: 8 }, { n: 9, s: 'reserved', seats: 2 }],
  ]
  const bg: Record<St, string> = { free: S_COMPLETED_BG, occupied: S_CONFIRMED_BG, reserved: S_PENDING_BG }
  const fg: Record<St, string> = { free: S_COMPLETED_FG, occupied: S_CONFIRMED_FG, reserved: S_PENDING_FG }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3">
      {grid.map((row, ri) => (
        <div key={ri} className="flex w-full gap-1.5">
          {row.map((t, ci) => (
            <motion.div
              key={ci}
              className="flex flex-1 flex-col items-center justify-center rounded-[10px] py-2"
              style={{ background: bg[t.s], color: fg[t.s] }}
              animate={r ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.85] }}
              transition={{ duration: 3.8, delay: (ri * 3 + ci) * 0.1, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.2, 0.8, 1], ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="text-[12px] font-bold">{t.n}</span>
              <span className="text-[7px] font-medium">{t.seats} fő</span>
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Done ──────────────────────────────────────────────────────────────────────

function DonePreview({ r }: { r: boolean }) {
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

type PC = React.ComponentType<{ r: boolean }>
const MAP: Record<PreviewKey, PC> = {
  welcome: WelcomePreview, overview: OverviewPreview, bookings: BookingsPreview,
  schedule: SchedulePreview, services: ServicesPreview, staff: StaffPreview,
  hours: HoursPreview, analytics: AnalyticsPreview, tips: TipsPreview,
  settings: SettingsPreview, tables: TablesPreview, done: DonePreview,
}

export function TourPreview({ stepKey }: { stepKey: PreviewKey }) {
  const reduced = useReducedMotion() ?? false
  const Preview = MAP[stepKey]
  return (
    <div
      className="relative h-[190px] w-full overflow-hidden rounded-[22px]"
      style={{ background: 'var(--dav-container-gradient)', boxShadow: '0 6px 28px rgba(80,70,30,0.10)' }}
    >
      <Preview r={reduced} />
    </div>
  )
}
