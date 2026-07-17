'use client'

import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A landing dekoratív SVG-mockupjai (dashboard, telefon, tablet, growth-chart) + a hero
 * scroll-cue. Tisztán prezentációs markup, adat-mentes. A `motion` csak a ScrollCue
 * forgó/pulzáló dekorációjához kell — ezért a fájl kliens-komponens.
 */

/* ───────────────  Dashboard (böngésző-keretes asztali nézet)  ─────────────── */
export function DashboardSVG() {
  return (
    <svg viewBox="0 0 480 520" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
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
        booking.davelopment.hu/dashboard
      </text>

      {/* Sidebar */}
      <rect x="0" y="36" width="110" height="484" fill="#141414" />
      <text x="14" y="62" fill="#ecf95a" fontSize="11" fontWeight="700" fontFamily="sans-serif">
        booking
      </text>
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
          {active && <rect x="4" y={y - 12} width="102" height="20" rx="6" fill="#ecf95a22" />}
          <text x="14" y={y} fill={active ? '#ecf95a' : '#666'} fontSize="9" fontFamily="sans-serif">
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
        davelopment booking®
      </text>

      {/* Main content area */}
      <rect x="110" y="36" width="370" height="484" fill="#191314" />
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
      <polyline
        points="136,220 155,208 174,215 193,195 212,200 231,182 250,188 269,170 288,175 307,155 326,162"
        fill="none"
        stroke="#ecf95a"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon
        points="136,220 155,208 174,215 193,195 212,200 231,182 250,188 269,170 288,175 307,155 326,162 326,230 136,230"
        fill="#ecf95a"
        fillOpacity="0.08"
      />
      {[
        [136, 220],
        [193, 195],
        [250, 188],
        [307, 155],
        [326, 162],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#ecf95a" />
      ))}
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
        <rect key={i} x={x} y={368 - h} width="12" height={h} rx="3" fill={i === 8 ? '#ecf95a' : '#ecf95a44'} />
      ))}
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

/* ───────────────  Telefon-mockup (Figma App screen, 287:487)  ───────────────
   A teljes telefon-render (keret + képernyő együtt) a Figmából, átlátszó háttérrel:
   public/hero-phone.png. A Hero-ban alulra tapasztva, a kártya overflow-hidden-je
   vágja le az alját. A méretet a hívó wrapper width-je adja. */
export function PhoneMockupSVG({ className }: { className?: string }) {
  return (
    <div className={cn('relative select-none', className)}>
      <img
        src="/hero-phone.png"
        alt="davelopment booking mobil app képernyő"
        className="block w-full drop-shadow-2xl"
        draggable={false}
      />
    </div>
  )
}

/* ───────────────  Tablet-mockup (vizuális asztalfoglalás-rács)  ─────────────── */
export function TabletMockupSVG() {
  const colors: Record<string, string> = {
    S1: '#ecf95a',
    S2: '#4ade80',
    M2: '#60a5fa',
    M3: '#f472b6',
    M4: '#fb923c',
    T1: '#a78bfa',
    T2: '#34d399',
    T3: '#f87171',
    T4: '#fbbf24',
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
        <text key={h} x={LEFT + i * COL_W + COL_W / 2} y={TOP - 8} textAnchor="middle" fill="#555" fontSize="8" fontFamily="sans-serif">
          {h}
        </text>
      ))}
      {/* Grid lines */}
      {hours.map((_, i) => (
        <line key={i} x1={LEFT + i * COL_W} y1={TOP} x2={LEFT + i * COL_W} y2={TOP + tables.length * ROW_H} stroke="#2a2a2a" strokeWidth="0.5" />
      ))}
      {/* Table rows */}
      {tables.map((table, ti) => {
        const y = TOP + ti * ROW_H
        return (
          <g key={table}>
            <rect x={LEFT} y={y} width={hours.length * COL_W} height={ROW_H} fill={ti % 2 === 0 ? '#1e1a1b' : '#191314'} />
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

/* ───────────────  Növekedés-chart (callout-okkal)  ─────────────── */
export function ZigZagChartSVG() {
  return (
    <svg viewBox="0 0 320 200" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="20" y1={y} x2="300" y2={y} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}
      <line x1="20" y1="100" x2="300" y2="100" stroke="#d1d5db" strokeWidth="1" />
      <polyline
        points="30,130 75,90 115,110 155,70 200,85 245,115 285,75"
        fill="none"
        stroke="#191314"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon points="30,130 75,90 115,110 155,70 200,85 245,115 285,75 285,160 30,160" fill="#191314" fillOpacity="0.06" />
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
      {['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl'].map((label, i) => (
        <text key={label} x={30 + i * 42} y="175" textAnchor="middle" fill="#9ca3af" fontSize="7" fontFamily="sans-serif">
          {label}
        </text>
      ))}
    </svg>
  )
}

/* ───────────────  Hero scroll-cue (forgó körfelirat + pulzáló nyíl)  ─────────────── */
export function ScrollCue() {
  const text = '✳ GÖRGESS LEJJEBB '.repeat(2)
  return (
    <div className="relative w-[216px] h-[128px] select-none pointer-events-none">
      <svg viewBox="0 0 288 171.119" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMin meet">
        <path
          fill="#ffffff"
          d="M43.5757 74.4283C43.5757 57.8597 57.0071 44.4283 73.5757 44.4283H106.005C118.338 44.4283 128.396 34.5451 128.611 22.2142L128.823 10.1092C128.921 4.49766 133.498 0 139.111 0C144.635 0 149.173 4.36189 149.392 9.88151L149.881 22.2142C150.373 34.6226 160.575 44.4283 172.993 44.4283H208.414C224.982 44.4283 238.414 57.8598 238.414 74.4283V141.116C238.414 158.769 253.581 172.606 271.16 170.99L288 169.442H0L10.4548 170.536C28.1613 172.388 43.5757 158.502 43.5757 140.698V74.4283Z"
        />
      </svg>
      <div className="absolute left-1/2 top-[40px] -translate-x-1/2 h-[72px] w-[72px]">
        <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 16, ease: 'linear', repeat: Infinity }}>
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              <path id="cue-circle" d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" />
            </defs>
            <text className="fill-brand-ink/70 text-[9px] font-medium uppercase" style={{ letterSpacing: '0.18em' }}>
              <textPath href="#cue-circle" startOffset="0">
                {text}
              </textPath>
            </text>
          </svg>
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}>
            <ArrowDown className="h-6 w-6 text-brand-ink" />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
