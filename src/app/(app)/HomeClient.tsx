
'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
  type MotionValue,
} from 'framer-motion'
import {
  ArrowUpRight,
  ArrowDown,
  Plus,
  Minus,
  CalendarCheck,
  Bell,
  BarChart3,
  LayoutDashboard,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import { LandingButton } from '@/components/landing/LandingButton'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'

/* ─────────────────────────  Types / helpers  ───────────────────────── */

export type LandingPricing = {
  salon_pro_huf: number
  restaurant_pro_huf: number
  trial_days: number
}

const ftFmt = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

function float(amplitude = 10, duration = 6, delay = 0) {
  return {
    animate: { y: [0, -amplitude, 0] },
    transition: { duration, delay, ease: 'easeInOut' as const, repeat: Infinity },
  }
}

/* ─────────────────────────  Buttons  ───────────────────────── */

function SplitRegisterButton({ href, label }: { href: string; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="inline-flex items-center"
      style={{ gap: 5 }}
      animate={{ gap: hover ? 0 : 5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <Link
        href={href}
        className="inline-flex h-14 items-center rounded-[30px] bg-brand-accent px-7 text-[22px] font-medium text-brand-ink overflow-hidden"
      >
        <motion.span
          animate={{ rotate: hover ? 360 : 0 }}
          transition={{ type: 'tween', duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {label}
        </motion.span>
      </Link>
      <Link
        href={href}
        aria-label={label}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-brand-ink"
      >
        <motion.span
          animate={{ rotate: hover ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        >
          <ArrowUpRight className="h-6 w-6" />
        </motion.span>
      </Link>
    </motion.div>
  )
}

function SpinButton({
  href,
  label,
  variant,
}: {
  href: string
  label: string
  variant: 'dark' | 'light'
}) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'inline-flex h-14 items-center gap-3 rounded-[30px] px-6 text-[22px] font-medium overflow-hidden',
        variant === 'dark'
          ? 'bg-brand-ink text-brand-bg'
          : 'bg-white text-brand-ink'
      )}
    >
      <motion.span
        animate={{ x: hover ? -6 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
      >
        {label}
      </motion.span>
      <motion.span
        animate={{ rotate: hover ? 45 : 0, x: hover ? 6 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
      >
        <ArrowUpRight className="h-6 w-6" />
      </motion.span>
    </Link>
  )
}

/* ─────────────────────────  Animation helpers  ───────────────────────── */

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function RevealWord({
  word,
  progress,
  index,
  total,
}: {
  word: string
  progress: MotionValue<number>
  index: number
  total: number
}) {
  const opacity = useTransform(
    progress,
    [index / total, Math.min((index + 1.5) / total, 1)],
    [0.12, 1]
  )
  return (
    <motion.span style={{ opacity }} className="inline-block mr-[0.28em]">
      {word}
    </motion.span>
  )
}

function TextReveal({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'end 0.4'],
  })
  const words = text.split(' ')
  return (
    <div ref={ref} className={className}>
      {words.map((word, i) => (
        <RevealWord
          key={i}
          word={word}
          progress={scrollYProgress}
          index={i}
          total={words.length}
        />
      ))}
    </div>
  )
}

function CountUp({
  to,
  suffix = '',
  prefix = '',
  duration = 1500,
}: {
  to: number
  suffix?: string
  prefix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref as React.RefObject<Element>, {
    once: true,
    margin: '-40px',
  })
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView) return
    let start: number | null = null
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(eased * to))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, to, duration])
  const fmt =
    count >= 1000
      ? count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
      : count.toString()
  return (
    <span ref={ref}>
      {prefix}
      {fmt}
      {suffix}
    </span>
  )
}

/* ─────────────────────────  ScrollCue notch  ───────────────────────── */

function ScrollCue() {
  const text = '✳ GÖRGESS LEJJEBB '.repeat(2)
  return (
    <div className="relative w-[216px] h-[128px] select-none pointer-events-none">
      <svg
        viewBox="0 0 288 171.119"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMin meet"
      >
        <path
          fill="#ffffff"
          d="M43.5757 74.4283C43.5757 57.8597 57.0071 44.4283 73.5757 44.4283H106.005C118.338 44.4283 128.396 34.5451 128.611 22.2142L128.823 10.1092C128.921 4.49766 133.498 0 139.111 0C144.635 0 149.173 4.36189 149.392 9.88151L149.881 22.2142C150.373 34.6226 160.575 44.4283 172.993 44.4283H208.414C224.982 44.4283 238.414 57.8598 238.414 74.4283V141.116C238.414 158.769 253.581 172.606 271.16 170.99L288 169.442H0L10.4548 170.536C28.1613 172.388 43.5757 158.502 43.5757 140.698V74.4283Z"
        />
      </svg>
      <div className="absolute left-1/2 top-[40px] -translate-x-1/2 h-[72px] w-[72px]">
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 16, ease: 'linear', repeat: Infinity }}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              <path
                id="cue-circle"
                d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
              />
            </defs>
            <text
              className="fill-brand-ink/70 text-[9px] font-medium uppercase"
              style={{ letterSpacing: '0.18em' }}
            >
              <textPath href="#cue-circle" startOffset="0">
                {text}
              </textPath>
            </text>
          </svg>
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          >
            <ArrowDown className="h-6 w-6 text-brand-ink" />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Marquee  ───────────────────────── */

const MARQUEE_ITEMS = [
  'ÉTTEREM',
  'CSONTKOVÁCS',
  'FODRÁSZAT',
  'SZEMÉLYI EDZŐ',
  'JÓGA',
  'KOZMETIKA',
  'MASSZŐR',
  'KÖRÖMSZALON',
]

function MarqueeRow({
  reverse = false,
  duration = 18,
  scroll,
}: {
  reverse?: boolean
  duration?: number
  scroll: MotionValue<number>
}) {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  const scrollX = useTransform(
    scroll,
    [0, 1],
    reverse ? ['0%', '20%'] : ['0%', '-20%']
  )
  return (
    <div className="overflow-hidden">
      <motion.div style={{ x: scrollX }}>
        <motion.div
          className="flex whitespace-nowrap"
          animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
          transition={{ duration, ease: 'linear', repeat: Infinity }}
        >
          {row.map((item, i) => (
            <span
              key={i}
              className="flex items-center font-bold text-3xl lg:text-5xl tracking-tight uppercase px-5 py-2 lg:py-5"
            >
              {item}
              <span className="mx-5">✳</span>
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

function Marquee() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  return (
    <div
      ref={ref}
      className="bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-5 space-y-1"
    >
      <MarqueeRow duration={16} scroll={scrollYProgress} />
      <MarqueeRow reverse duration={20} scroll={scrollYProgress} />
      <MarqueeRow duration={14} scroll={scrollYProgress} />
    </div>
  )
}

/* ─────────────────────────  SVG: Dashboard mockup  ───────────────────────── */

function DashboardSVG() {
  return (
    <svg
      viewBox="0 0 480 520"
      className="w-full h-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Browser chrome */}
      <rect x="0" y="0" width="480" height="520" rx="14" fill="#1a1a1a" />
      {/* Titlebar */}
      <rect x="0" y="0" width="480" height="36" rx="14" fill="#242424" />
      <rect x="0" y="20" width="480" height="16" fill="#242424" />
      <circle cx="18" cy="18" r="5" fill="#ff5f57" />
      <circle cx="36" cy="18" r="5" fill="#febc2e" />
      <circle cx="54" cy="18" r="5" fill="#28c840" />
      <rect x="140" y="10" width="200" height="16" rx="8" fill="#333" />
      <text x="240" y="22" textAnchor="middle" fill="#888" fontSize="9" fontFamily="monospace">
        app.schedulio.hu/dashboard
      </text>

      {/* Sidebar */}
      <rect x="0" y="36" width="110" height="484" fill="#141414" />

      {/* Logo in sidebar */}
      <text x="14" y="62" fill="#ecf95a" fontSize="11" fontWeight="700" fontFamily="sans-serif">
        schedulio
      </text>

      {/* Sidebar nav items */}
      {[
        { label: 'Áttekintés', y: 88, active: true },
        { label: 'Statisztikák', y: 112 },
        { label: 'Foglalások', y: 136 },
        { label: 'Asztalok', y: 160 },
        { label: 'Nyitvatartás', y: 184 },
        { label: 'Tippek', y: 208 },
        { label: 'Beállítások', y: 232 },
        { label: 'Nyilv. oldal', y: 256 },
      ].map(({ label, y, active }) => (
        <g key={label}>
          {active && (
            <rect x="4" y={y - 12} width="102" height="20" rx="6" fill="#ecf95a22" />
          )}
          <text
            x="14"
            y={y}
            fill={active ? '#ecf95a' : '#666'}
            fontSize="9"
            fontFamily="sans-serif"
          >
            {label}
          </text>
        </g>
      ))}

      {/* Sidebar bottom: profile */}
      <rect x="4" y="460" width="102" height="50" rx="8" fill="#1e1e1e" />
      <circle cx="20" cy="480" r="8" fill="#ecf95a33" />
      <text x="20" y="484" textAnchor="middle" fill="#ecf95a" fontSize="7" fontWeight="700">
        D
      </text>
      <text x="33" y="477" fill="#ccc" fontSize="7" fontFamily="sans-serif">
        Dave
      </text>
      <text x="33" y="488" fill="#555" fontSize="6" fontFamily="sans-serif">
        schedulio × [davelopment]®
      </text>

      {/* Main content area */}
      <rect x="110" y="36" width="370" height="484" fill="#191314" />

      {/* Main header */}
      <text x="124" y="62" fill="#f4f4f4" fontSize="11" fontWeight="700" fontFamily="sans-serif">
        Áttekintés
      </text>
      <rect x="370" y="50" width="96" height="18" rx="9" fill="#ecf95a" />
      <text x="418" y="63" textAnchor="middle" fill="#191314" fontSize="8" fontWeight="700" fontFamily="sans-serif">
        + Új foglalás
      </text>

      {/* KPI cards */}
      {[
        { label: 'Foglalások ma', value: '12', x: 124 },
        { label: 'Bevétel (hó)', value: '348 E', x: 230 },
        { label: 'Kihasználtság', value: '87%', x: 336 },
      ].map(({ label, value, x }) => (
        <g key={label}>
          <rect x={x} y="74" width="96" height="44" rx="8" fill="#242424" />
          <text x={x + 8} y="90" fill="#888" fontSize="7" fontFamily="sans-serif">
            {label}
          </text>
          <text x={x + 8} y="107" fill="#f4f4f4" fontSize="13" fontWeight="700" fontFamily="sans-serif">
            {value}
          </text>
        </g>
      ))}

      {/* Line chart card */}
      <rect x="124" y="128" width="220" height="120" rx="10" fill="#242424" />
      <text x="136" y="146" fill="#f4f4f4" fontSize="8" fontWeight="600" fontFamily="sans-serif">
        Foglalások — Elmúlt 30 nap
      </text>

      {/* Line chart paths */}
      <polyline
        points="136,220 155,208 174,215 193,195 212,200 231,182 250,188 269,170 288,175 307,155 326,162"
        fill="none"
        stroke="#ecf95a"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Chart area fill */}
      <polygon
        points="136,220 155,208 174,215 193,195 212,200 231,182 250,188 269,170 288,175 307,155 326,162 326,230 136,230"
        fill="#ecf95a"
        fillOpacity="0.08"
      />
      {/* Chart dots */}
      {[
        [136, 220], [193, 195], [250, 188], [307, 155], [326, 162],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#ecf95a" />
      ))}
      {/* X axis labels */}
      {['1.', '8.', '15.', '22.', '30.'].map((label, i) => (
        <text key={label} x={136 + i * 47.5} y="242" fill="#555" fontSize="6" fontFamily="sans-serif">
          {label}
        </text>
      ))}

      {/* Bar chart card */}
      <rect x="124" y="258" width="220" height="120" rx="10" fill="#242424" />
      <text x="136" y="275" fill="#f4f4f4" fontSize="8" fontWeight="600" fontFamily="sans-serif">
        Óránkénti forgalom
      </text>

      {/* Bar chart */}
      {[
        { h: 20, x: 140 },
        { h: 35, x: 158 },
        { h: 55, x: 176 },
        { h: 70, x: 194 },
        { h: 80, x: 212 },
        { h: 60, x: 230 },
        { h: 45, x: 248 },
        { h: 72, x: 266 },
        { h: 85, x: 284 },
        { h: 65, x: 302 },
        { h: 40, x: 320 },
      ].map(({ h, x }, i) => (
        <rect
          key={i}
          x={x}
          y={368 - h}
          width="12"
          height={h}
          rx="3"
          fill={i === 8 ? '#ecf95a' : '#ecf95a44'}
        />
      ))}
      {/* Bar x-axis */}
      {['9h', '11h', '13h', '15h', '17h'].map((label, i) => (
        <text key={label} x={140 + i * 47} y="378" fill="#555" fontSize="6" fontFamily="sans-serif">
          {label}
        </text>
      ))}

      {/* Upcoming bookings panel */}
      <rect x="354" y="128" width="116" height="250" rx="10" fill="#242424" />
      <text x="366" y="146" fill="#f4f4f4" fontSize="8" fontWeight="600" fontFamily="sans-serif">
        Közelgő
      </text>

      {[
        { name: 'Kovács Anna', time: '10:30', svc: 'Hajvágás', color: '#ecf95a' },
        { name: 'Tóth Péter', time: '11:00', svc: 'Beard trim', color: '#4ade80' },
        { name: 'Nagy Éva', time: '12:15', svc: 'Festés', color: '#60a5fa' },
        { name: 'Szabó Gábor', time: '14:00', svc: 'Hajvágás', color: '#f472b6' },
        { name: 'Molnár Réka', time: '15:30', svc: 'Kezelés', color: '#fb923c' },
      ].map(({ name, time, svc, color }, i) => (
        <g key={name}>
          <rect x="362" y={158 + i * 42} width="100" height="36" rx="6" fill="#2a2a2a" />
          <rect x="362" y={158 + i * 42} width="3" height="36" rx="1.5" fill={color} />
          <text x="372" y={172 + i * 42} fill="#ccc" fontSize="7" fontWeight="600" fontFamily="sans-serif">
            {name}
          </text>
          <text x="372" y={183 + i * 42} fill="#555" fontSize="6" fontFamily="sans-serif">
            {time} · {svc}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* ─────────────────────────  SVG: Phone mockup with app screen  ───────────────────────── */

function PhoneMockupSVG({ className }: { className?: string }) {
  return (
    <div className={cn('relative select-none', className)}>
      <svg viewBox="0 0 280 560" className="w-full h-auto drop-shadow-2xl">
        {/* Phone body */}
        <rect x="4" y="4" width="272" height="552" rx="40" fill="#0a0a0a" />
        <rect x="8" y="8" width="264" height="544" rx="37" fill="#141414" stroke="#2a2a2a" strokeWidth="1" />

        {/* Dynamic island */}
        <rect x="96" y="20" width="88" height="28" rx="14" fill="#0a0a0a" />

        {/* Screen content */}
        <rect x="16" y="56" width="248" height="480" rx="28" fill="#191314" />

        {/* App header */}
        <rect x="16" y="56" width="248" height="50" rx="28" fill="#1e1a1b" />
        <rect x="16" y="82" width="248" height="24" fill="#1e1a1b" />
        <text x="36" y="82" fill="#f4f4f4" fontSize="11" fontWeight="700" fontFamily="sans-serif">
          Foglalásaim
        </text>
        <rect x="228" y="68" width="28" height="28" rx="14" fill="#ecf95a22" />
        <text x="242" y="87" textAnchor="middle" fill="#ecf95a" fontSize="14" fontFamily="sans-serif">+</text>

        {/* Date pills */}
        {[
          { label: 'Ma', x: 28, active: true },
          { label: 'Hét', x: 72 },
          { label: 'Hó', x: 108 },
        ].map(({ label, x, active }) => (
          <g key={label}>
            <rect x={x} y="114" width={active ? 36 : 30} height="18" rx="9" fill={active ? '#ecf95a' : '#2a2a2a'} />
            <text x={x + (active ? 18 : 15)} y="127" textAnchor="middle" fill={active ? '#191314' : '#888'} fontSize="8" fontWeight={active ? '700' : '400'} fontFamily="sans-serif">
              {label}
            </text>
          </g>
        ))}

        {/* Booking cards */}
        {[
          { name: 'Kovács Anna', time: '10:30', svc: 'Hajvágás + Festés', dur: '90 perc', color: '#ecf95a', y: 142 },
          { name: 'Tóth Béla', time: '12:30', svc: 'Szakáll igazítás', dur: '30 perc', color: '#4ade80', y: 216 },
          { name: 'Nagy Éva', time: '14:00', svc: 'Kezelés + Masszázs', dur: '60 perc', color: '#60a5fa', y: 290 },
          { name: 'Szabo Réka', time: '15:30', svc: 'Hajvágás', dur: '45 perc', color: '#f472b6', y: 364 },
        ].map(({ name, time, svc, dur, color, y }) => (
          <g key={name}>
            <rect x="24" y={y} width="232" height="66" rx="12" fill="#242424" />
            <rect x="24" y={y} width="4" height="66" rx="2" fill={color} />
            <text x="38" y={y + 20} fill="#f4f4f4" fontSize="9" fontWeight="700" fontFamily="sans-serif">
              {name}
            </text>
            <text x="38" y={y + 35} fill="#888" fontSize="8" fontFamily="sans-serif">
              {svc}
            </text>
            <rect x="38" y={y + 44} width="50" height="12" rx="6" fill="#2e2e2e" />
            <text x="63" y={y + 54} textAnchor="middle" fill="#666" fontSize="6" fontFamily="sans-serif">
              {time}
            </text>
            <rect x="96" y={y + 44} width="50" height="12" rx="6" fill="#2e2e2e" />
            <text x="121" y={y + 54} textAnchor="middle" fill="#666" fontSize="6" fontFamily="sans-serif">
              {dur}
            </text>
            <circle cx="236" cy={y + 33} r="12" fill={`${color}22`} />
            <text x="236" y={y + 37} textAnchor="middle" fill={color} fontSize="12" fontFamily="sans-serif">
              ✓
            </text>
          </g>
        ))}

        {/* Bottom nav */}
        <rect x="16" y="496" width="248" height="40" rx="20" fill="#1e1a1b" />
        {[
          { icon: '◫', label: 'Naptár', x: 60, active: true },
          { icon: '⊕', label: 'Új', x: 140 },
          { icon: '◉', label: 'Profil', x: 220 },
        ].map(({ icon, label, x, active }) => (
          <g key={label}>
            <text x={x} y="515" textAnchor="middle" fill={active ? '#ecf95a' : '#555'} fontSize="12" fontFamily="sans-serif">
              {icon}
            </text>
            <text x={x} y="528" textAnchor="middle" fill={active ? '#ecf95a' : '#555'} fontSize="6" fontFamily="sans-serif">
              {label}
            </text>
          </g>
        ))}

        {/* Phone button details */}
        <rect x="0" y="140" width="4" height="40" rx="2" fill="#2a2a2a" />
        <rect x="0" y="190" width="4" height="40" rx="2" fill="#2a2a2a" />
        <rect x="276" y="155" width="4" height="60" rx="2" fill="#2a2a2a" />
      </svg>
    </div>
  )
}

/* ─────────────────────────  SVG: Tablet booking grid  ───────────────────────── */

function TabletMockupSVG() {
  const colors: Record<string, string> = {
    S1: '#ecf95a', S2: '#4ade80', M2: '#60a5fa',
    M3: '#f472b6', M4: '#fb923c', T1: '#a78bfa',
    T2: '#34d399', T3: '#f87171', T4: '#fbbf24',
  }

  const bookings = [
    { table: 'S1', start: 1, span: 2, name: 'Kiss Fam.' },
    { table: 'S2', start: 2, span: 3, name: 'Tóth, 4 fő' },
    { table: 'M2', start: 0, span: 2, name: 'Nagy Anna' },
    { table: 'M3', start: 3, span: 2, name: 'Kovács Bt.' },
    { table: 'M4', start: 1, span: 4, name: 'Születésnap' },
    { table: 'T1', start: 2, span: 2, name: 'Eskövő VIP' },
    { table: 'T3', start: 0, span: 3, name: 'Cég ebéd' },
    { table: 'T4', start: 4, span: 2, name: 'Vacsora' },
  ]

  const tables = ['S1', 'S2', 'M2', 'M3', 'M4', 'T1', 'T2', 'T3', 'T4']
  const hours = ['10h', '11h', '12h', '13h', '14h', '15h', '16h']
  const COL_W = 54
  const ROW_H = 32
  const LEFT = 48
  const TOP = 90

  return (
    <svg viewBox="0 0 580 440" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      {/* Tablet body */}
      <rect x="0" y="0" width="580" height="440" rx="20" fill="#1a1a1a" />
      <rect x="6" y="6" width="568" height="428" rx="16" fill="#141414" stroke="#2a2a2a" strokeWidth="1" />

      {/* Screen */}
      <rect x="12" y="12" width="556" height="416" rx="12" fill="#191314" />

      {/* Topbar */}
      <rect x="12" y="12" width="556" height="44" rx="12" fill="#1e1a1b" />
      <rect x="12" y="42" width="556" height="14" fill="#1e1a1b" />

      {/* View toggle */}
      <rect x="24" y="20" width="140" height="28" rx="14" fill="#2a2a2a" />
      {[
        { label: 'Lista', x: 44 },
        { label: 'Időszal', x: 88, active: true },
        { label: 'Terem', x: 140 },
      ].map(({ label, x, active }) => (
        <g key={label}>
          {active && <rect x={x - 20} y="22" width="48" height="24" rx="12" fill="#ecf95a" />}
          <text
            x={x + 4}
            y="38"
            textAnchor="middle"
            fill={active ? '#191314' : '#888'}
            fontSize="8"
            fontWeight={active ? '700' : '400'}
            fontFamily="sans-serif"
          >
            {label}
          </text>
        </g>
      ))}

      <text x="290" y="36" textAnchor="middle" fill="#f4f4f4" fontSize="10" fontWeight="700" fontFamily="sans-serif">
        Asztalfoglalás — Ma
      </text>

      {/* Hour headers */}
      {hours.map((h, i) => (
        <text
          key={h}
          x={LEFT + i * COL_W + COL_W / 2}
          y={TOP - 8}
          textAnchor="middle"
          fill="#555"
          fontSize="8"
          fontFamily="sans-serif"
        >
          {h}
        </text>
      ))}

      {/* Grid lines */}
      {hours.map((_, i) => (
        <line
          key={i}
          x1={LEFT + i * COL_W}
          y1={TOP}
          x2={LEFT + i * COL_W}
          y2={TOP + tables.length * ROW_H}
          stroke="#2a2a2a"
          strokeWidth="0.5"
        />
      ))}

      {/* Table rows */}
      {tables.map((table, ti) => {
        const y = TOP + ti * ROW_H
        return (
          <g key={table}>
            {/* Row bg alternating */}
            <rect x={LEFT} y={y} width={hours.length * COL_W} height={ROW_H} fill={ti % 2 === 0 ? '#1e1a1b' : '#191314'} />
            {/* Table label */}
            <text x={LEFT - 8} y={y + ROW_H / 2 + 4} textAnchor="end" fill="#666" fontSize="8" fontFamily="sans-serif">
              {table}
            </text>
          </g>
        )
      })}

      {/* Booking blocks */}
      {bookings.map(({ table, start, span, name }) => {
        const ti = tables.indexOf(table)
        const color = colors[table] ?? '#ecf95a'
        const x = LEFT + start * COL_W + 2
        const y = TOP + ti * ROW_H + 3
        const w = span * COL_W - 4
        const h = ROW_H - 6
        return (
          <g key={`${table}-${start}`}>
            <rect x={x} y={y} width={w} height={h} rx="6" fill={`${color}28`} stroke={color} strokeWidth="1" />
            <text x={x + 6} y={y + h / 2 + 3} fill={color} fontSize="7" fontWeight="600" fontFamily="sans-serif">
              {name}
            </text>
          </g>
        )
      })}

      {/* Home indicator */}
      <rect x="258" y="428" width="64" height="4" rx="2" fill="#333" />
    </svg>
  )
}

/* ─────────────────────────  SVG: Zig-zag chart with callouts  ───────────────────────── */

function ZigZagChartSVG() {
  return (
    <svg viewBox="0 0 320 200" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      {/* Background grid */}
      {[40, 80, 120, 160].map(y => (
        <line key={y} x1="20" y1={y} x2="300" y2={y} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}

      {/* Zero line */}
      <line x1="20" y1="100" x2="300" y2="100" stroke="#d1d5db" strokeWidth="1" />

      {/* Chart line */}
      <polyline
        points="30,130 75,90 115,110 155,70 200,85 245,115 285,75"
        fill="none"
        stroke="#191314"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Area fill */}
      <polygon
        points="30,130 75,90 115,110 155,70 200,85 245,115 285,75 285,160 30,160"
        fill="#191314"
        fillOpacity="0.06"
      />

      {/* Callout: +2.6% */}
      <circle cx="155" cy="70" r="5" fill="#191314" />
      <rect x="120" y="42" width="56" height="20" rx="10" fill="#191314" />
      <text x="148" y="56" textAnchor="middle" fill="#ecf95a" fontSize="9" fontWeight="700" fontFamily="sans-serif">
        +2,6%
      </text>
      <line x1="148" y1="62" x2="155" y2="70" stroke="#191314" strokeWidth="1" />

      {/* Callout: -2.6% */}
      <circle cx="245" cy="115" r="5" fill="#6b7280" />
      <rect x="210" y="126" width="56" height="20" rx="10" fill="#6b7280" />
      <text x="238" y="140" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="sans-serif">
        -2,6%
      </text>
      <line x1="238" y1="126" x2="245" y2="120" stroke="#6b7280" strokeWidth="1" />

      {/* Callout: peak */}
      <circle cx="285" cy="75" r="5" fill="#10b981" />
      <rect x="250" y="52" width="56" height="20" rx="10" fill="#10b981" />
      <text x="278" y="66" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="sans-serif">
        +4,6%
      </text>
      <line x1="278" y1="72" x2="285" y2="75" stroke="#10b981" strokeWidth="1" />

      {/* X axis labels */}
      {['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl'].map((label, i) => (
        <text key={label} x={30 + i * 42} y="175" textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="sans-serif">
          {label}
        </text>
      ))}
    </svg>
  )
}

/* ─────────────────────────  Demo szekció  ───────────────────────── */

function DemoSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [30, -30])

  return (
    <section ref={ref} className="mx-auto px-4 lg:px-5 py-20 lg:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Dashboard SVG card */}
        <FadeUp>
          <div className="rounded-[2rem] bg-[#111] p-4 shadow-2xl shadow-black/30 overflow-hidden">
            <DashboardSVG />
          </div>
        </FadeUp>

        {/* Right: copy */}
        <div className="lg:pl-6">
          <FadeUp>
            <span className="inline-block rounded-full bg-brand-surface px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-6">
              Dashboard
            </span>
          </FadeUp>
          <TextReveal
            text="Minden adat egy helyen. Azonnal."
            className="text-3xl lg:text-5xl font-black tracking-tighter leading-[1]"
          />
          <FadeUp delay={0.15}>
            <p className="mt-6 text-zinc-500 leading-relaxed">
              A Schedulio dashboard-on egyetlen pillantással látod a napi foglalásokat,
              a havi bevételt és a kihasználtságot. Nincs több szétszórt Excel-táblázat,
              telefon-egyeztetés vagy elveszett papír.
            </p>
            <p className="mt-4 text-zinc-500 leading-relaxed">
              Beállítod, és megy magától — te csak a munkádra figyelj.
            </p>
            <div className="mt-8">
              <SpinButton href="/davelopment" label="Megnyitom a demót" variant="dark" />
            </div>
          </FadeUp>
        </div>
      </div>

      {/* Phone mockup below — yellow card */}
      <FadeUp className="mt-16" delay={0.1}>
        <div className="rounded-[2rem] bg-brand-accent overflow-hidden p-8 lg:p-14 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 order-2 lg:order-1">
            <span className="inline-block rounded-full bg-brand-ink/10 px-3 py-1 text-[11px] font-semibold text-brand-ink mb-5">
              Mobilalkalmazás
            </span>
            <h3 className="text-3xl lg:text-4xl font-black tracking-tighter text-brand-ink leading-tight">
              Foglaláslista a zsebedben.
            </h3>
            <p className="mt-4 text-brand-ink/70 leading-relaxed max-w-sm">
              Az ügyfeled telefonról foglal — te telefonon látod. Bármikor, bárhol.
              Az értesítések azonnal megérkeznek, a módosításokat valós időben követheted.
            </p>
          </div>
          <div className="flex-shrink-0 order-1 lg:order-2 w-[200px] lg:w-[240px]">
            <motion.div style={{ y }}>
              <PhoneMockupSVG />
            </motion.div>
          </div>
        </div>
      </FadeUp>

      {/* Tablet mockup */}
      <FadeUp className="mt-8" delay={0.05}>
        <div className="rounded-[2rem] bg-brand-surface overflow-hidden p-6 lg:p-10">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-3">
              Asztalfoglalás
            </span>
            <h3 className="text-2xl lg:text-3xl font-black tracking-tighter text-brand-ink">
              Éttermeknek: vizuális asztaltérkép.
            </h3>
            <p className="mt-2 text-zinc-500 text-sm max-w-lg">
              Lista, időszalagos vagy teremnézet — ahogy neked kényelmes. Minden asztal,
              minden időpont egy képernyőn.
            </p>
          </div>
          <TabletMockupSVG />
        </div>
      </FadeUp>
    </section>
  )
}

/* ─────────────────────────  Vision manifesto (dark, cinematic)  ───────────────────────── */

const MANIFESTO_LINES = [
  'Nem véletlenül.',
  'Tervezve gondosan.',
  'Kódolva szenvedéllyel.',
  'Alkotva vízióval.',
  'Mindig előre.',
]

function VisionManifesto() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.2'],
  })

  return (
    <section
      ref={ref}
      className="mx-auto px-4 lg:px-5 pb-8"
    >
      <div className="rounded-[2rem] bg-brand-ink text-white overflow-hidden px-8 py-20 lg:px-20 lg:py-28">
        <div className="max-w-4xl">
          {MANIFESTO_LINES.map((line, i) => {
            const start = i / MANIFESTO_LINES.length
            const end = Math.min((i + 1.8) / MANIFESTO_LINES.length, 1)
            const opacity = useTransform(scrollYProgress, [start, end], [0.1, 1])
            const x = useTransform(scrollYProgress, [start, end], [-20, 0])
            return (
              <motion.p
                key={line}
                style={{ opacity, x }}
                className="text-4xl lg:text-6xl xl:text-7xl font-black tracking-tighter leading-[1.05] py-2"
              >
                {line}
              </motion.p>
            )
          })}
        </div>
        <FadeUp delay={0.1} className="mt-16">
          <p className="text-white/30 text-sm font-medium tracking-widest uppercase">
            (Görgess tovább)
          </p>
        </FadeUp>
      </div>
    </section>
  )
}

/* ─────────────────────────  Services  ───────────────────────── */

const SERVICES = [
  {
    n: '001',
    title: 'Saját foglalási oldal',
    icon: CalendarCheck,
    body: 'Egyedi linken osztható, mobilbarát foglalóoldal — az ügyfél pár kattintással foglal, te pedig azonnal értesülsz.',
    screenshotLabel: 'Foglalási folyamat az ügyfél szemszögéből',
  },
  {
    n: '002',
    title: 'Azonnali értesítések',
    icon: Bell,
    body: 'Új foglalásról és lemondásról azonnal értesülsz a dashboardon és emailben. Semmi sem csúszik el.',
    screenshotLabel: 'Értesítési center valós időben',
  },
  {
    n: '003',
    title: 'Bevétel & statisztikák',
    icon: BarChart3,
    body: 'Kövesd a kihasználtságot, a bevételt és a trendeket napra pontosan. Exportálható CSV formátumban.',
    screenshotLabel: 'Bevétel és forgalmi riportok',
  },
  {
    n: '004',
    title: 'Teljes dashboard',
    icon: LayoutDashboard,
    body: 'Foglalások, szolgáltatások, munkatársak, nyitvatartás — minden egy helyen, mobilon és asztalon.',
    screenshotLabel: 'Főképernyő: nap áttekintése',
  },
]

function ServiceScreenshotCard({ service }: { service: (typeof SERVICES)[0] }) {
  const Icon = service.icon
  return (
    <motion.div
      key={service.n}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl bg-brand-ink overflow-hidden"
    >
      {/* Fake dark browser / app frame */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[#111]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 bg-[#2a2a2a] rounded-full h-5 flex items-center px-3">
          <span className="text-[10px] text-zinc-500 font-mono">app.schedulio.hu</span>
        </div>
      </div>
      {/* Content area */}
      <div className="p-8 lg:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent">
          <Icon className="h-6 w-6 text-brand-ink" />
        </span>
        <h3 className="mt-5 text-xl font-black tracking-tight text-white">
          {service.title}
        </h3>
        <p className="mt-3 text-zinc-400 leading-relaxed text-sm">{service.body}</p>
        <p className="mt-6 text-xs text-zinc-600 font-medium uppercase tracking-wider">
          {service.screenshotLabel}
        </p>
        {/* Mini fake screenshot */}
        <div className="mt-3 rounded-xl bg-[#111] p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className={cn('h-8 rounded-md bg-[#1e1e1e]', i === 1 ? 'w-24' : 'w-16')} />
              <div className={cn('h-8 rounded-md flex-1 bg-[#1e1e1e]')} />
              <div className="h-8 w-16 rounded-md bg-brand-accent/20" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function ServicesList() {
  const [active, setActive] = useState(0)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
      <div className="divide-y divide-zinc-200">
        {SERVICES.map((s, i) => (
          <button
            key={s.n}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            className="group flex w-full items-center gap-5 py-6 text-left"
          >
            <span
              className={cn(
                'text-xs font-bold tabular-nums transition-colors',
                active === i ? 'text-brand-ink' : 'text-zinc-300'
              )}
            >
              ({s.n})
            </span>
            <span
              className={cn(
                'text-2xl lg:text-3xl font-black tracking-tight transition-colors',
                active === i
                  ? 'text-brand-ink'
                  : 'text-zinc-300 group-hover:text-zinc-400'
              )}
            >
              {s.title}
            </span>
          </button>
        ))}
      </div>
      <div className="lg:sticky lg:top-24">
        <AnimatePresence mode="wait">
          <ServiceScreenshotCard key={active} service={SERVICES[active]} />
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─────────────────────────  Testimonial + chart promo  ───────────────────────── */

const TESTIMONIALS = [
  {
    text: 'Mióta Schedulioval dolgozunk, felére csökkent a telefonos foglalások száma. Az ügyfelek imádják.',
    name: 'Kovács Anna',
    role: 'Fodrászat tulajdonosa, Budapest',
    initials: 'KA',
    color: '#ecf95a',
  },
  {
    text: 'Az asztaltérkép funkció teljesen megváltoztatta, hogyan kezeljük a csúcsidőszakokat. Többé nem veszítünk vendéget.',
    name: 'Tóth Gábor',
    role: 'Étteremvezető, Debrecen',
    initials: 'TG',
    color: '#4ade80',
  },
  {
    text: 'Egyszerű, gyors és mindig elérhető. A legjobbat tettük, amit tehettünk — kipróbáltuk.',
    name: 'Nagy Éva',
    role: 'Masszőr, Pécs',
    initials: 'NÉ',
    color: '#60a5fa',
  },
]

const AVATARS = ['KA', 'TG', 'NÉ', 'SZ', 'MR']
const AVATAR_COLORS = ['#ecf95a', '#4ade80', '#60a5fa', '#f472b6', '#fb923c']

function TestimonialChartPromo() {
  const [activeT, setActiveT] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActiveT(t => (t + 1) % TESTIMONIALS.length), 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="mx-auto px-4 lg:px-5 pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel: badge + title + CTA */}
        <div className="rounded-[2rem] bg-brand-surface p-8 lg:p-10 flex flex-col justify-between">
          <div>
            <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-5">
              Értékelések
            </span>
            <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-brand-ink leading-tight">
              Akik már kipróbálták, nem mennek vissza.
            </h2>
            <p className="mt-4 text-zinc-500 text-sm leading-relaxed">
              Magyar kis- és középvállalkozások választják, mert egyszerűen működik.
            </p>
          </div>
          <div className="mt-8">
            <LandingButton href="/register" variant="dark" icon>
              Regisztráció
            </LandingButton>
          </div>
        </div>

        {/* Center: zig-zag chart */}
        <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 lg:p-10">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Növekedés a Schedulio után
          </span>
          <p className="mt-2 text-2xl font-black tracking-tight text-brand-ink">
            +4,6% foglalás / hónap
          </p>
          <div className="mt-6">
            <ZigZagChartSVG />
          </div>
          <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
            Átlagos adat, aktív Schedulio felhasználók körében mérve (2025 Jan–Júl)
          </p>
        </div>

        {/* Right: testimonial + avatar stack */}
        <div className="rounded-[2rem] bg-brand-ink p-8 lg:p-10 flex flex-col justify-between">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeT}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-white text-lg font-medium leading-relaxed">
                  „{TESTIMONIALS[activeT].text}"
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black text-brand-ink"
                    style={{ background: TESTIMONIALS[activeT].color }}
                  >
                    {TESTIMONIALS[activeT].initials}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {TESTIMONIALS[activeT].name}
                    </p>
                    <p className="text-white/40 text-xs">
                      {TESTIMONIALS[activeT].role}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-10">
            {/* Avatar stack */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-3">
                {AVATARS.map((initials, i) => (
                  <div
                    key={initials}
                    className="h-9 w-9 rounded-full border-2 border-brand-ink flex items-center justify-center text-xs font-black text-brand-ink"
                    style={{ background: AVATAR_COLORS[i] }}
                  >
                    {initials}
                  </div>
                ))}
                <div className="h-9 w-9 rounded-full border-2 border-brand-ink bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                  +1K
                </div>
              </div>
              <Link
                href="/reviews"
                className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-4"
              >
                Értékelj minket
              </Link>
            </div>

            {/* Dots indicator */}
            <div className="flex gap-1.5 mt-5">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveT(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === activeT ? 'w-6 bg-brand-accent' : 'w-1.5 bg-white/20'
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────  FAQ  ───────────────────────── */

function buildFaqItems(pricing: LandingPricing) {
  return [
    {
      q: 'Mennyibe kerül a Schedulio?',
      a: `Szalon Pro: ${ftFmt(pricing.salon_pro_huf)}/hó. Étterem Pro (asztalfoglalással): ${ftFmt(pricing.restaurant_pro_huf)}/hó. Mindkettő ${pricing.trial_days} napig ingyenes, kártya nélkül. Lemondható bármikor, visszamenőleges számlázás nélkül.`,
    },
    {
      q: 'Kell bankkártyaadatokat megadni a próbaidőhöz?',
      a: `Nem. A ${pricing.trial_days} napos próbaidőhöz csak egy email cím és jelszó szükséges. Kártyaadatokat csak akkor kérünk, ha az ingyenes időszak után is folytatnád.`,
    },
    {
      q: 'Mennyi ideig tart beállítani?',
      a: 'Az első profil — névvel, szolgáltatásokkal és nyitvatartással — kb. 5 perc alatt elkészíthető. Utána máris megosztható a foglalási link.',
    },
    {
      q: 'Hány munkatársat és szolgáltatást adhatok hozzá?',
      a: 'Korlátlan számút. Minden munkatársnak saját elérhetőségi naptárt állíthatsz be, és minden szolgáltatáshoz külön árat és időtartamot rendelhetsz.',
    },
    {
      q: 'Kapnak visszaigazolást az ügyfeleim?',
      a: 'Igen. Minden foglalásnál automatikusan küldünk visszaigazoló emailt az ügyfélnek a foglalás részleteivel.',
    },
    {
      q: 'Éttermeknek és szalonoknak is megfelel?',
      a: 'Igen. A Szalon Pro időpontfoglalásra optimalizált (fodrászat, masszőr, kozmetika, edzőterem). Az Étterem Pro asztalfoglalásos logikával dolgozik: kapacitás, asztaltérkép, csoportfoglalás, előleg.',
    },
  ]
}

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="space-y-2">
      {items.map(({ q, a }, i) => {
        const isOpen = open === i
        return (
          <FadeUp key={i} delay={i * 0.04}>
            <div
              className={cn(
                'rounded-2xl border transition-colors',
                isOpen ? 'border-brand-ink/15 bg-zinc-50' : 'border-zinc-200 bg-white'
              )}
            >
              <button
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="flex items-center gap-4">
                  <span className="text-xs font-bold text-zinc-300 tabular-nums w-6 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-[15px] text-brand-ink">{q}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                    isOpen
                      ? 'bg-brand-accent text-brand-ink'
                      : 'bg-brand-surface text-zinc-500'
                  )}
                >
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pl-16">
                      <p className="text-zinc-500 text-sm leading-relaxed">{a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FadeUp>
        )
      })}
    </div>
  )
}

/* ─────────────────────────  CTA banner (dark + phone mockup)  ───────────────────────── */

function CtaBannerSection({ trial_days }: { trial_days: number }) {
  return (
    <section className="mx-auto px-4 lg:px-5 pb-8">
      <FadeUp>
        <div className="rounded-[2rem] bg-brand-ink overflow-hidden relative">
          {/* Decorative wave */}
          <svg
            className="absolute left-0 bottom-0 opacity-10 pointer-events-none"
            viewBox="0 0 400 220"
            width="400"
            height="220"
          >
            <path
              d="M0,160 Q80,60 160,120 Q240,180 320,80 Q380,20 400,60"
              fill="none"
              stroke="#ecf95a"
              strokeWidth="2"
            />
            <path
              d="M0,190 Q80,90 160,150 Q240,210 320,110 Q380,50 400,90"
              fill="none"
              stroke="#ecf95a"
              strokeWidth="1"
              opacity="0.5"
            />
            <path
              d="M0,130 Q80,30 160,90 Q240,150 320,50 Q380,0 400,30"
              fill="none"
              stroke="#ecf95a"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </svg>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center">
            {/* Left copy */}
            <div className="p-10 lg:p-14 relative z-10">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/60 mb-5">
                Kezdj el ma
              </span>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tighter text-white leading-tight">
                Tartsd kézben
                <br />a vállalkozásod
                <br />minden percét.
              </h2>
              <p className="mt-5 text-white/50 leading-relaxed max-w-sm">
                {trial_days} nap ingyen, bankkártya nélkül. Beállítás 5 perc.
                Lemondás egy kattintás.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <SpinButton href="/register" label="Ingyenes próba" variant="light" />
                <SpinButton href="/davelopment" label="Demó megnézése" variant="dark" />
              </div>

              {/* Checklist */}
              <ul className="mt-8 space-y-2">
                {[
                  'Automatikus visszaigazolás',
                  'Valós idejű naptár',
                  'Munkatárs-kezelés',
                  'Bevétel-statisztikák',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/60">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Phone mockup spilling out */}
            <div className="flex justify-center lg:justify-end lg:pr-0 overflow-hidden relative">
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-[220px] lg:w-[260px] lg:mr-12 lg:-mb-8"
              >
                <PhoneMockupSVG />
              </motion.div>
            </div>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}

/* ─────────────────────────  Pricing  ───────────────────────── */

function PricingSection({ pricing }: { pricing: LandingPricing }) {
  return (
    <section id="arazas" className="mx-auto px-4 lg:px-5 py-20 lg:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-12">
        <FadeUp>
          <h2 className="text-4xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
            Egyszerű,
            <br />
            tiszta árazás.
          </h2>
        </FadeUp>
        <div className="flex items-end justify-between gap-4">
          <p className="text-zinc-500 leading-relaxed lg:pb-2">
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő{' '}
            {pricing.trial_days} napig ingyenes, kártya nélkül.
          </p>
          <div className="shrink-0">
            <LandingButton href="/register" variant="dark" icon>
              Kipróbálom ingyen
            </LandingButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeUp>
          <div className="rounded-3xl bg-brand-surface p-8 lg:p-10 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                <CalendarCheck className="h-5 w-5 text-brand-ink" />
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-500">
                Szalon Pro
              </span>
            </div>
            <p className="mt-6 text-4xl font-black tracking-tight text-brand-ink">
              {ftFmt(pricing.salon_pro_huf)}{' '}
              <span className="text-base font-medium text-zinc-400">/hó</span>
            </p>
            <p className="mt-3 text-zinc-500 flex-1">
              Időpontfoglalás szalonoknak, fodrászoknak, masszőröknek,
              kozmetikusoknak.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-500">
              {[
                'Korlátlan foglalás',
                'Automatikus visszaigazolás',
                'Bevétel statisztikák',
                'Munkatárs-kezelés',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-ink shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <LandingButton
                href="/register"
                variant="dark"
                icon
                className="w-full py-8 text-xl"
              >
                Kipróbálom ingyen
              </LandingButton>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.08}>
          <div className="rounded-3xl bg-brand-accent p-8 lg:p-10 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink">
                <LayoutDashboard className="h-5 w-5 text-brand-accent" />
              </span>
              <span className="rounded-full bg-brand-ink/10 px-3 py-1 text-[11px] font-semibold text-brand-ink">
                Étterem Pro
              </span>
            </div>
            <p className="mt-6 text-4xl font-black tracking-tight text-brand-ink">
              {ftFmt(pricing.restaurant_pro_huf)}{' '}
              <span className="text-base font-medium text-brand-ink/50">/hó</span>
            </p>
            <p className="mt-3 text-brand-ink/70 flex-1">
              Asztalfoglalás éttermeknek — kapacitás, asztaltérkép, csoportok,
              előleg.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-brand-ink/70">
              {[
                'Vizuális asztaltérkép',
                'Csoportfoglalás & előleg',
                'Lista / Időszal / Terem nézet',
                'Minden Szalon Pro funkció',
              ].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-ink shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <LandingButton
                href="/register-restaurant"
                variant="dark"
                icon
                className="w-full py-8 text-xl"
              >
                Kipróbálom ingyen
              </LandingButton>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

/* ─────────────────────────  Page  ───────────────────────── */

export default function HomeClient({ pricing }: { pricing: LandingPricing }) {
  const faqItems = buildFaqItems(pricing)

  return (
    <main className="min-h-screen text-brand-ink font-geist">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-zinc-200/60">
        <div className="mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Schedulio">
            <SchedulioLogo variant="light" className="h-7" />
          </Link>
          <div className="hidden md:flex items-center gap-10 text-sm font-medium text-zinc-500 bg-[#f5f5f5] px-5 py-3 rounded-full">
            <a href="#hogyan" className="hover:text-brand-ink transition-colors">
              Hogyan működik
            </a>
            <a href="#arazas" className="hover:text-brand-ink transition-colors">
              Árazás
            </a>
            <a href="#velemenyek" className="hover:text-brand-ink transition-colors">
              Vélemények
            </a>
            <a href="#gyik" className="hover:text-brand-ink transition-colors">
              GYIK
            </a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="hidden md:inline-flex h-10 items-center px-4 text-sm font-medium text-zinc-500 hover:text-brand-ink transition-colors"
            >
              Bejelentkezés
            </Link>
            <LandingButton href="/register" variant="dark" icon>
              Regisztráció
            </LandingButton>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="mx-auto px-4 lg:px-5 pt-5 pb-12">
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[30px] bg-[#f5f5f5] p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[560px] lg:min-h-[720px]"
          >
            <div>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex h-8 items-center bg-white rounded-full px-5 text-xs font-medium text-brand-ink"
              >
                Próbáld ki {pricing.trial_days} napig ingyen.
              </motion.span>

              <h1 className="mt-5 font-geist font-bold leading-[1.05] tracking-[-0.05em] text-[clamp(2.5rem,6vw,3.5rem)] text-brand-ink overflow-hidden">
                {['Online', 'Időpontfoglaló.'].map((w, i) => (
                  <span key={w} className="block overflow-hidden">
                    <motion.span
                      className="block"
                      initial={{ y: '110%' }}
                      animate={{ y: 0 }}
                      transition={{
                        duration: 0.8,
                        delay: 0.15 + i * 0.09,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {w}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
                className="mt-5 max-w-md text-base leading-6 text-brand-ink"
              >
                Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra
                figyelj. Éttermeknek, fodrászatoknak, kis vállalkozásoknak.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.55 }}
                className="mt-8"
              >
                <SplitRegisterButton href="/register" label="Regisztrálj ingyen" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-12"
            >
              <p className="mb-4 text-base text-brand-ink">Van már fiókod?</p>
              <div className="flex flex-wrap items-center gap-3">
                <SpinButton href="/login" label="Bejelentkezés" variant="dark" />
                <SpinButton
                  href="/davelopment"
                  label="Demó megtekintése"
                  variant="light"
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Right card — yellow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-[30px] bg-brand-accent overflow-hidden min-h-[560px] lg:min-h-[720px]"
          >
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="absolute left-6 top-12 z-20"
            >
              <motion.div
                {...float(8, 6)}
                className="rounded-[20px] bg-white/[0.67] backdrop-blur-[23px] p-5 max-w-xs"
              >
                <p className="text-md leading-7 tracking-[-0.03em] text-brand-ink">
                  Elérhető
                </p>
                <p className="mt-2 font-medium text-3xl leading-[1.1] tracking-[-0.06em] text-brand-ink">
                  Kezeld okosan a vállalkozásod
                </p>
                <p className="mt-2 flex gap-6 font-martian text-sm text-brand-ink whitespace-nowrap">
                  <span className="text-[#10b97f]">
                    {ftFmt(pricing.salon_pro_huf)}-tól
                  </span>
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.35,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute left-[24%] sm:left-[30%] top-32 lg:top-[30%] z-10"
            >
              <motion.div
                {...float(12, 7, 0.5)}
                className="w-[200px] lg:w-[260px]"
              >
                <PhoneMockupSVG />
              </motion.div>
            </motion.div>

            <div className="absolute bottom-0 right-0 z-20 hidden lg:block w-[260px] h-[114px]">
              <svg
                viewBox="0 0 260 114"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
              >
                <path
                  fill="#ffffff"
                  d="M55.7409 53.3418C61.4249 46.0385 70.1614 41.7672 79.4159 41.7672H230C246.569 41.7672 260 28.3358 260 11.7672V0V84C260 100.569 246.569 114 230 114H60.2317H0C5.38405 114 10.4667 111.515 13.7735 107.266L55.7409 53.3418Z"
                />
              </svg>
              <p className="absolute bottom-5 right-6 text-right font-martian text-base leading-6 text-brand-ink">
                Regisztrálj és
                <br />
                próbáld ki ingyen
              </p>
            </div>
          </motion.div>

          <div className="hidden lg:block absolute left-1/2 top-full -mt-[120px] -translate-x-1/2 z-30">
            <ScrollCue />
          </div>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────── */}
      <Marquee />

      {/* ── DEMO + DEVICE MOCKUPS ────────────────────────────── */}
      <section id="hogyan">
        <DemoSection />
      </section>

      {/* ── VISION MANIFESTO ─────────────────────────────────── */}
      <VisionManifesto />

      {/* ── SERVICES ─────────────────────────────────────────── */}
      <section
        id="szolgaltatasok"
        className="mx-auto px-6 lg:px-10 py-20 lg:py-28 border-t border-zinc-100"
      >
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <FadeUp>
              <span className="inline-block rounded-full bg-brand-surface px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-3">
                Szolgáltatások
              </span>
            </FadeUp>
            <FadeUp delay={0.05}>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-tight">
                Minden, amire
                <br />
                szükséged van.
              </h2>
            </FadeUp>
          </div>
          <FadeUp delay={0.1}>
            <LandingButton href="/register" variant="dark" icon>
              Kipróbálom ingyen
            </LandingButton>
          </FadeUp>
        </div>
        <ServicesList />
      </section>

      {/* ── TESTIMONIAL + CHART PROMO ────────────────────────── */}
      <section id="velemenyek">
        <TestimonialChartPromo />
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <PricingSection pricing={pricing} />

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section
        id="gyik"
        className="mx-auto px-6 lg:px-10 py-20 lg:py-28 border-t border-zinc-100"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-12">
          <FadeUp>
            <h2 className="text-4xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
              Gyakran
              <br />
              kérdezik.
            </h2>
          </FadeUp>
          <p className="text-zinc-500 leading-relaxed lg:pb-2">
            Nem találod, amit keresel? Írj nekünk:{' '}
            <a
              href="mailto:hello@schedulio.hu"
              className="text-brand-ink underline underline-offset-4"
            >
              hello@schedulio.hu
            </a>
          </p>
        </div>
        <FaqAccordion items={faqItems} />
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <CtaBannerSection trial_days={pricing.trial_days} />

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-brand-ink text-white overflow-hidden m-2 rounded-xl mt-2">
        <div className="mx-auto px-6 lg:px-10 pt-20 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="max-w-md">
              <SchedulioLogo variant="dark" className="h-12" />
              <p className="mt-4 text-5xl font-bold tracking-tight">
                Online Időpontfoglaló.
              </p>
              <div className="text-white/70">
                <p className="mt-4 tracking-tight">
                  Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra
                  figyelj. Éttermeknek, fodrászatoknak, kis vállalkozásoknak.
                  Próbáld ki {pricing.trial_days} napig ingyen.
                </p>
                <p className="mt-4 tracking-tight">
                  ©2026 Schedulio · hello@schedulio.hu
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-lg font-semibold uppercase tracking-wider mb-3">
                  Gyors linkek
                </p>
                <ul className="space-y-2 text-md text-white/70">
                  <li>
                    <a href="#hogyan" className="hover:text-white transition-colors">
                      Hogyan működik
                    </a>
                  </li>
                  <li>
                    <a href="#velemenyek" className="hover:text-white transition-colors">
                      Vélemények
                    </a>
                  </li>
                  <li>
                    <a href="#arazas" className="hover:text-white transition-colors">
                      Árazás
                    </a>
                  </li>
                  <li>
                    <a href="#gyik" className="hover:text-white transition-colors">
                      GYIK
                    </a>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white transition-colors">
                      Bejelentkezés
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col items-start justify-end gap-5">
                <LandingButton
                  href="/register"
                  variant="yellow"
                  icon
                  className="py-8 text-lg"
                >
                  Ingyenes Regisztráció
                </LandingButton>
                <a
                  href="https://davelopment.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Powered by <br />
                  <span className="font-bold text-white text-lg">[davelopment]®</span>
                </a>
              </div>
            </div>
          </div>
        </div>
        <p className="select-none text-center font-black uppercase tracking-tighter leading-none text-[16vw]">
          Csatlakozz
        </p>
      </footer>
    </main>
  )
}