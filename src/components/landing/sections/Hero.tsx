'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence, animate, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { EASE, SPRING_QUICK, SPRING_SNAPPY, buttonHover } from '@/lib/motion'
import { type LandingPricing } from '@/components/landing/types'
import { BrandLogo } from '@/components/BrandLogo'
import { MenuToggle, MobileMenu } from '@/components/landing/sections/Nav'

const HERO_LINKS = [
  { id: 'hogyan',     label: 'Hogyan működik' },
  { id: 'arazas',     label: 'Árazás' },
  { id: 'velemenyek', label: 'Vélemények' },
  { id: 'gyik',       label: 'GYIK' },
]
const NAV_OFFSET = 60

// ─── CountUp hook — 0-ról animál a target-re Framer Motion engine-nel ────────
function useCountUp(target: number, duration = 1.05): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return controls.stop
  }, [target, duration])
  return value
}

// ─── Heatmap mock — 1=#3a3934 · 2=#8f8330 · 3=#F1CE45 ───────────────────────
const HC = ['', '#3a3934', '#8f8330', '#F1CE45']
const HEAT = [
  { label: 'Hét', cells: [1, 1, 1, 2, 1, 1, 1, 3, 1, 2, 2, 1, 1] },
  { label: 'Ked', cells: [1, 1, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 1] },
  { label: 'Sze', cells: [1, 1, 2, 1, 1, 1, 3, 1, 2, 3, 2, 1, 1] },
  { label: 'Csü', cells: [1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 3] },
  { label: 'Pén', cells: [1, 1, 1, 2, 1, 3, 1, 1, 2, 3, 2, 1, 1] },
  { label: 'Szo', cells: [1, 1, 1, 2, 1, 3, 1, 1, 2, 3, 3, 3, 2] },
  { label: 'Vas', cells: [1, 1, 1, 2, 1, 1, 3, 1, 1, 2, 3, 2, 3] },
]

// ─── Trend chart ──────────────────────────────────────────────────────────────
const TCUR  = [0, 0.1, 0.5, 1.5, 2.8, 1.2, 5.8, 2.5]
const TPREV = [0, 0,   0.1, 0.4, 1.0, 0.3, 1.8, 0.8]
const TW = 210, TH = 58, TP = 3

// Catmull-Rom → cubic bezier (smooth vonal)
function smoothPath(arr: number[], top: number): string {
  const pts = arr.map((v, i) => ({
    x: TP + (i / (arr.length - 1)) * (TW - TP * 2),
    y: TP + (1 - v / top) * (TH - TP * 2),
  }))
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  const t = 0.28
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) * t
    const cp1y = p1.y + (p2.y - p0.y) * t
    const cp2x = p2.x - (p3.x - p1.x) * t
    const cp2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

// ─── Heti bars — dark oszlopok, gold=Szo ─────────────────────────────────────
const WBARS: Array<{ day: string; h: number; gold: boolean; tip?: string }> = [
  { day: 'Hét', h: 22, gold: false },
  { day: 'Ked', h: 42, gold: false },
  { day: 'Sze', h: 18, gold: false },
  { day: 'Cs',  h: 52, gold: false },
  { day: 'Pén', h: 36, gold: false },
  { day: 'Szo', h: 64, gold: true, tip: '4' },
  { day: 'Vas', h: 28, gold: false },
]

// ─── Shared icon gomb ─────────────────────────────────────────────────────────
function IBtn({ dark }: { dark?: boolean }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: dark ? 'rgba(255,255,255,.12)' : '#f0ece2' }}
    >
      <ArrowRight
        className="h-[11px] w-[11px]"
        style={{ color: dark ? '#fff' : '#1d1c19' }}
        strokeWidth={1.5}
      />
    </div>
  )
}

// ─── Kártya 1: Foglaltsági jelentés — pulzáló gold dots ──────────────────────
function MiniHeatmapCard() {
  const n1 = useCountUp(4)
  const n2 = useCountUp(74)
  return (
    <div
      className="shrink-0 rounded-[18px] p-3 flex flex-col"
      style={{ width: 216, background: '#1d1c19', boxShadow: '0 14px 30px -14px rgba(40,35,15,.65)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-onest font-medium text-[11.5px] text-white">Foglaltsági jelentés</span>
        <IBtn dark />
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-onest font-light text-[21px] leading-none text-white">{n1}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2.5" strokeLinecap="round">
            <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
          </svg>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-onest font-light text-[21px] leading-none" style={{ color: 'rgba(255,255,255,.42)' }}>{n2}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#e08a3c" strokeWidth="2.5" strokeLinecap="round">
            <line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>
          </svg>
        </div>
      </div>

      {/* Óra tengely */}
      <div className="flex items-center mb-[2px]" style={{ paddingLeft: 16 }}>
        {['10', '13', '16', '19', '22h'].map((t, i) => (
          <span key={i} className="flex-1 text-center text-[6px] font-medium" style={{ color: 'rgba(255,255,255,.30)' }}>{t}</span>
        ))}
      </div>

      {/* Hőtérkép — gold (c===3) gyorsan pulzál, kis scale */}
      <div className="flex flex-col gap-[2.5px]">
        {HEAT.map((row, ri) => (
          <div key={row.label} className="flex items-center gap-[2.5px]">
            <span className="w-[15px] shrink-0 text-right text-[6px] font-medium" style={{ color: 'rgba(255,255,255,.34)' }}>{row.label}</span>
            <div className="flex flex-1 gap-[3px]">
              {row.cells.map((c, ci) =>
                c === 3 ? (
                  <motion.span
                    key={ci}
                    className="aspect-square flex-1 rounded-full"
                    style={{ background: HC[c] }}
                    animate={{ scale: [1, 1.09, 1], opacity: [1, 0.46, 1] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: ((ri * 13 + ci) * 0.11) % 1.5,
                    }}
                  />
                ) : (
                  <span key={ci} className="aspect-square flex-1 rounded-full" style={{ background: HC[c] }} />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between mt-2 pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}
      >
        <span className="font-onest font-medium text-[8px]" style={{ color: '#f1ce45' }}>Csúcs · Hét 16h</span>
        <div className="flex items-center gap-[3px]">
          {(['#3a3934', '#8f8330', '#F1CE45'] as const).map((c, i) => (
            <span key={i} className="h-[5px] w-[5px] rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Kártya 2: Kihasználtság — vastag donut (sw=12), stats alul ──────────────
function MiniDonutCard() {
  const pct = 75
  const pctDisplay = useCountUp(pct)
  const vendeg = useCountUp(4)
  const foglalas = useCountUp(1)
  // cx=cy=45, r=33, sw=12 → outer edge = 33+6 = 39 < 45 ✓
  const r = 33, sw = 12, circ = 2 * Math.PI * r
  return (
    <div
      className="shrink-0 rounded-[18px] p-3 flex flex-col"
      style={{ width: 216, background: 'rgba(255,255,255,.97)', boxShadow: '0 1px 3px rgba(70,60,20,.05), 0 14px 30px -14px rgba(90,75,25,.18)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-onest font-medium text-[11.5px]" style={{ color: '#211f1a' }}>Kihasználtság</span>
        <IBtn />
      </div>

      {/* Donut — középre rendezve */}
      <div className="flex justify-center mb-3">
        <div className="relative" style={{ width: 90, height: 90 }}>
          <svg viewBox="0 0 90 90" className="h-full w-full -rotate-90">
            <circle cx="45" cy="45" r={r} fill="none" stroke="#33322e" strokeWidth={sw} />
            <motion.circle
              cx="45" cy="45" r={r} fill="none"
              stroke="#F1CE45" strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - circ * (pct / 100) }}
              transition={{ duration: 1.2, ease: EASE }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-onest text-[17px] font-light leading-none" style={{ color: '#211f1a' }}>{pctDisplay}%</span>
            <span className="mt-0.5 text-center text-[6.5px] font-medium" style={{ color: '#a8a496' }}>mai telítettség</span>
          </div>
        </div>
      </div>

      {/* Stats — vízszintesen az alján */}
      <div
        className="flex items-center justify-center gap-5 pt-2"
        style={{ borderTop: '1px solid rgba(120,110,70,.12)' }}
      >
        <div className="text-center">
          <div className="font-onest font-light text-[17px] leading-none" style={{ color: '#211f1a' }}>{vendeg}</div>
          <div className="text-[7px] font-medium mt-0.5" style={{ color: '#a8a496' }}>vendég</div>
        </div>
        <div className="h-[16px] w-px" style={{ background: 'rgba(120,110,70,.18)' }} />
        <div className="text-center">
          <div className="font-onest font-light text-[17px] leading-none" style={{ color: '#211f1a' }}>{foglalas}</div>
          <div className="text-[7px] font-medium mt-0.5" style={{ color: '#a8a496' }}>foglalás</div>
        </div>
      </div>
    </div>
  )
}

// ─── Kártya 3: Köv. 7 nap — dark bars + dot egyszerre a barral ───────────────
function MiniWeekCard() {
  const vendeg = useCountUp(4)
  return (
    <div
      className="shrink-0 rounded-[18px] p-3 flex flex-col"
      style={{ width: 216, background: 'rgba(255,255,255,.97)', boxShadow: '0 1px 3px rgba(70,60,20,.05), 0 14px 30px -14px rgba(90,75,25,.18)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-onest font-medium text-[11.5px]" style={{ color: '#211f1a' }}>Köv. 7 nap</span>
        <IBtn />
      </div>

      <div className="flex items-end gap-1.5 mb-1">
        <span className="font-onest font-light text-[21px] leading-none" style={{ color: '#211f1a' }}>{vendeg}</span>
        <div className="pb-0.5 font-onest text-[9px] leading-tight" style={{ color: '#86826f' }}>
          <p>vendég</p>
          <p>köv. 7 nap</p>
        </div>
      </div>

      {/* Bar chart — bars + dots egyszerre, i * 0.08 delay */}
      <div className="relative mt-5" style={{ height: 86 }}>
        {/* Baseline */}
        <div className="absolute inset-x-0" style={{ bottom: 22, borderTop: '1px dashed rgba(168,164,150,.28)' }} />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between">
          {WBARS.map((bar, i) => (
            <div key={bar.day} className="flex flex-1 flex-col items-center gap-1">
              {/* Bar + tooltip */}
              <div className="relative flex flex-col items-center justify-end" style={{ height: 62 }}>
                {bar.gold && bar.tip && (
                  <div
                    className="absolute -top-5 whitespace-nowrap rounded-[5px] px-[5px] py-[2px] font-onest font-semibold text-[8px]"
                    style={{ background: '#f1ce45', color: '#1d1c19' }}
                  >
                    {bar.tip}
                  </div>
                )}
                <motion.div
                  className="w-[7px] rounded-[4px]"
                  style={{
                    height: bar.h,
                    background: bar.gold ? '#f1ce45' : '#1d1c19',
                    transformOrigin: 'bottom',
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                />
              </div>

              {/* Dot — egyszerre a barral (azonos delay) */}
              <motion.div
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: bar.gold ? '#f1ce45' : '#1d1c19' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, delay: i * 0.08, ease: EASE }}
              />

              <span className="font-onest text-[7.5px]" style={{ color: '#a8a496', fontWeight: bar.gold ? 600 : 400 }}>
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Kártya 4: Foglalások — smooth bezier görbe (nem hegyes) ─────────────────
function MiniTrendCard() {
  const total = useCountUp(21)
  const delta = useCountUp(425)
  const top = Math.max(...TCUR, ...TPREV, 1)
  const curPath  = smoothPath(TCUR, top)
  const prevPath = smoothPath(TPREV, top)

  return (
    <div
      className="shrink-0 rounded-[18px] p-3 flex flex-col"
      style={{ width: 216, background: 'rgba(255,255,255,.97)', boxShadow: '0 1px 3px rgba(70,60,20,.05), 0 14px 30px -14px rgba(90,75,25,.18)' }}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-onest font-medium text-[11.5px] shrink-0" style={{ color: '#211f1a' }}>Foglalások</span>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-[3px]">
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#f1ce45]" />
              <span className="font-onest text-[7px]" style={{ color: '#a8a496' }}>Aktuális</span>
            </div>
            <div className="flex items-center gap-[3px]">
              <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: '#1d1c19' }} />
              <span className="font-onest text-[7px]" style={{ color: '#a8a496' }}>Előző</span>
            </div>
          </div>
        </div>
        <IBtn />
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <span className="font-onest font-light text-[21px] leading-none" style={{ color: '#211f1a' }}>{total}</span>
        <span className="font-onest font-semibold text-[9px]" style={{ color: '#1d9d63' }}>+{delta}%</span>
      </div>

      {/* SVG — Catmull-Rom smooth görbék */}
      <div style={{ flex: 1, minHeight: 54 }}>
        <svg viewBox={`0 0 ${TW} ${TH}`} className="h-full w-full" preserveAspectRatio="none">
          {[0.33, 0.67].map((f, i) => (
            <line key={i}
              x1={TP} y1={TP + f * (TH - TP * 2)}
              x2={TW - TP} y2={TP + f * (TH - TP * 2)}
              stroke="#efebdf" strokeWidth="0.7" vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={prevPath} fill="none" stroke="#1d1c19" strokeWidth="1.3"
            strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          />
          <motion.path
            d={curPath} fill="none" stroke="#F1CE45" strokeWidth="2.3"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
        </svg>
      </div>

      <div className="flex justify-between pt-1">
        {['júl. 5.', 'júl. 17.', 'júl. 29.', 'aug. 2.'].map((l, i) => (
          <span key={i} className="font-onest text-[6.5px]" style={{ color: '#a8a496' }}>{l}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Kártya párok ─────────────────────────────────────────────────────────────
type CardFn = () => React.JSX.Element
const PAIRS: [CardFn, CardFn][] = [
  [MiniHeatmapCard, MiniDonutCard],
  [MiniWeekCard,    MiniTrendCard],
]

// ─── HeroNav — hero-ba épített navigáció (nem sticky) ────────────────────────
function HeroNav({ theme = 'dark', pillId = 'hero-nav-pill' }: { theme?: 'dark' | 'light'; pillId?: string }) {
  const [active, setActive]     = useState(HERO_LINKS[0].id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted]   = useState(false)
  const [togglePos, setTogglePos] = useState<{ top: number; right: number } | null>(null)
  const [logoPos, setLogoPos]     = useState<{ top: number; left: number } | null>(null)
  const [animatedOpen, setAnimatedOpen] = useState(false)
  const toggleRef  = useRef<HTMLDivElement>(null)
  const logoRef    = useRef<HTMLDivElement>(null)
  const pendingTarget = useRef<string | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  useEffect(() => {
    const sections = HERO_LINKS.map(l => document.getElementById(l.id)).filter((el): el is HTMLElement => el !== null)
    if (!sections.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (pendingTarget.current) return
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: `-${NAV_OFFSET + 8}px 0px -40% 0px`, threshold: 0 },
    )
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    setActive(id)
    pendingTarget.current = id
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET, behavior: 'smooth' })
    setTimeout(() => { pendingTarget.current = null }, 1200)
  }

  useEffect(() => {
    if (menuOpen) {
      // Portál toggle hamburger-állapotban mountolódik, 2 frame múlva vált X-re → látható animáció
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimatedOpen(true)))
    } else {
      setAnimatedOpen(false)
    }
  }, [menuOpen])

  const handleToggle = () => {
    if (!menuOpen) {
      if (toggleRef.current) {
        const r = toggleRef.current.getBoundingClientRect()
        setTogglePos({ top: r.top, right: window.innerWidth - r.right })
      }
      if (logoRef.current) {
        const r = logoRef.current.getBoundingClientRect()
        setLogoPos({ top: r.top, left: r.left })
      }
    }
    setMenuOpen(o => !o)
  }

  const onDesktopClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => { e.preventDefault(); goTo(id) }
  const onMobileClick  = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setMenuOpen(false)
    setTimeout(() => goTo(id), 200)
  }

  return (
    <>
      <div className="flex w-full items-center justify-between gap-4">
        {/* Logó — ref a pozíció méréséhez */}
        <div ref={logoRef} className="shrink-0">
          <Link href="/" aria-label="davelopment booking">
            <BrandLogo variant={theme === 'dark' ? 'dark' : 'light'} className="h-[26px]" />
          </Link>
        </div>

        {/* Desktop pill menü */}
        <div className="hidden md:flex items-center gap-0 rounded-full p-[3px]"
          style={theme === 'dark'
            ? { background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }
            : { background: '#ffffff' }}>
          {HERO_LINKS.map(({ id, label }) => {
            const isActive = active === id
            return (
              <motion.a key={id} href={`#${id}`} onClick={(e) => onDesktopClick(e, id)}
                variants={buttonHover} initial="rest" whileHover="hover"
                className={`relative flex items-center rounded-full px-[14px] py-[10px] font-onest font-medium text-[15px] leading-6 transition-colors ${isActive ? 'text-white' : 'text-brand-ink'}`}>
                {isActive && (
                  <motion.span aria-hidden layoutId={pillId}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-[#3b3b3b]" />
                )}
                <span className="relative">{label}</span>
              </motion.a>
            )
          })}
        </div>

        {/* CTA + Bejelentkezés (desktop) + mobil toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          {theme === 'light' && (
            <Link
              href="/login"
              className="hidden md:inline-flex text-[13px] font-medium text-brand-ink/45 hover:text-brand-ink/80 transition-colors px-1"
            >
              Bejelentkezés
            </Link>
          )}
          <motion.a
            href="/register"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            className="hidden md:flex items-center rounded-full px-[14px] py-[13px] font-onest font-medium text-[15px] leading-6"
            style={{ background: '#3b3b3b', color: '#ffffff' }}>
            Próbáld ki ingyen
          </motion.a>
          {/* Inline toggle — scrollozik a navval, referenciapontként szolgál */}
          <div ref={toggleRef}>
            <MenuToggle open={menuOpen} onClick={handleToggle} ghost ink={theme === 'light'} />
          </div>
        </div>
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {menuOpen && <MobileMenu active={active} onPick={onMobileClick} />}
        </AnimatePresence>,
        document.body,
      )}

      {/* Portál logó — a MobileMenu (z-80) felett (z-90), pontosan ott ahol az inline logo volt */}
      {mounted && logoPos && createPortal(
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed md:hidden" style={{ top: logoPos.top, left: logoPos.left, zIndex: 90 }}>
              <Link href="/" aria-label="davelopment booking" onClick={handleToggle}>
                <BrandLogo variant="light" className="h-[26px]" />
              </Link>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Portál toggle — a MobileMenu (z-80) felett (z-90), a gomb mért pozíciójában.
          Mountolódik: open=false (hamburger), 2 frame múlva open=true → látható hamburger→X animáció. */}
      {mounted && togglePos && createPortal(
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed md:hidden" style={{ top: togglePos.top, right: togglePos.right, zIndex: 90 }}>
              <MenuToggle open={animatedOpen} onClick={handleToggle} ghost ink={theme === 'light'} />
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export function Hero({ pricing }: { pricing: LandingPricing }) {
  const [pairIdx, setPairIdx] = useState(0)
  const [mounted, setMounted] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const heroInView = useInView(sectionRef, { once: false, amount: 0 })

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const t = setInterval(() => setPairIdx(i => (i + 1) % PAIRS.length), 5200)
    return () => clearInterval(t)
  }, [])

  const [Top, Bottom] = PAIRS[pairIdx]

  return (
    <>
      {/* Fixed nav — portálra renderelve a body-ra, hogy kiszabaduljon a
          `relative z-10` stacking contextből (HomeClient), és ne takarják el
          az alatta lévő szekciók (Marquee, SegmentToggle, modal-ok). */}
      {mounted && createPortal(
        <AnimatePresence>
          {!heroInView && (
            <motion.div
              className="fixed inset-x-0 top-0 z-[60]"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={SPRING_SNAPPY}
              style={{ background: '#F7F7F7' }}
            >
              <div className="px-4 lg:px-5 py-2.5">
                <HeroNav theme="light" pillId="fixed-nav-pill" />
              </div>
            </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )}

    <section ref={sectionRef} className="mx-auto px-4 lg:px-5 pt-3 pb-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING_QUICK}
        className="relative flex flex-col overflow-hidden rounded-[30px] px-5 lg:px-8 h-[calc(100svh-32px)]"
        style={{ background: 'linear-gradient(241deg, #141210 2.7%, #1e1b14 100%)' }}
      >
        {/* Videó */}
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
          autoPlay muted loop playsInline aria-hidden
          poster="/videos/szalon-foglalas-hatter-poster.jpg"
        >
          <source src="/videos/szalon-foglalas-hatter.webm" type="video/webm" />
          <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
        </video>

        {/* Mobil overlay — egyszerű dim, blur nélkül (GPU) */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] lg:hidden"
          style={{ background: 'linear-gradient(to right, rgba(10,8,5,.58) 0%, rgba(10,8,5,.42) 60%, rgba(10,8,5,.18) 100%)' }}
        />
        {/* Desktop overlay — bal oldali mask-blur, jobb oldal érintetlen */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] hidden lg:block"
          style={{
            background: 'linear-gradient(to right, rgba(10,8,5,.46) 0%, rgba(10,8,5,.38) 28%, rgba(10,8,5,.03) 42%, transparent 54%)',
            backdropFilter: 'blur(11px)',
            WebkitBackdropFilter: 'blur(11px)',
            maskImage: 'linear-gradient(to right, black 0%, black 32%, transparent 46%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 32%, transparent 46%)',
          }}
        />

        {/* ══ NAV SOR — betöltéskor slide-in ══ */}
        <motion.div
          className="relative z-10 pt-4 lg:pt-5 pb-0"
          initial={{ y: -44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING_SNAPPY}
        >
          <HeroNav />
        </motion.div>

        {/* ══ TARTALOM SOR — flex-row: bal szöveg + jobb KPI ══ */}
        <div className="relative z-10 flex flex-1 items-start gap-6 lg:gap-10 pt-8 pb-8 lg:pt-12 lg:pb-10">

        {/* ══ BAL OSZLOP ══ */}
        <div className="flex flex-[14_1_0%] flex-col justify-between self-stretch min-w-0 gap-10 lg:gap-0 py-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="self-start rounded-[23px] border px-4 py-2 font-onest text-[clamp(.875rem,1.4vw,1.125rem)] font-normal tracking-[-0.06em] text-white"
            style={{ background: 'rgba(255,255,255,.07)', borderColor: 'rgba(255,255,255,.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            Próbáld ki {pricing.trial_days} napig ingyen.
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.35 }}
            className="flex flex-col gap-5"
          >
            <h1 className="font-onest font-light text-[clamp(2rem,5vw,3.5rem)] leading-[1.14] tracking-[-0.05em] text-[#f5f5f5]">
              Nem csak a vendégeidnek.{' '}
              <br className="hidden lg:block" />
              A csapatodnak is.
            </h1>
            <p className="font-onest text-[clamp(.875rem,1.4vw,1.15rem)] tracking-[-0.04em] leading-relaxed text-[#f5f5f5]/65">
              Foglalj. Vezess csapatot. Számolj bért.
              <br />
              Az egyetlen app amire egy üzletnek szüksége van.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="flex flex-wrap items-center gap-3"
          >
            {/* Elsődleges gomb — fehér */}
            <motion.a
              href="/register"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-5 pr-2.5 font-onest font-medium text-base text-[#3b3b3b]"
            >
              Ingyenes regisztráció
              <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#f1ce45' }}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
              </span>
            </motion.a>

            {/* Másodlagos gomb — sötét */}
            <motion.a
              href="/login"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex items-center gap-2.5 rounded-full py-2.5 pl-5 pr-2.5 font-onest font-medium text-base text-[#f5f5f5]"
              style={{ background: '#2a2720', backdropFilter: 'blur(2px)' }}
            >
              Bejelentkezés
              <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#f1ce45' }}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
              </span>
            </motion.a>
          </motion.div>
        </div>

        {/* ══ JOBB OSZLOP — cserélődő KPI kártyák ══ */}
        <div className="hidden lg:flex flex-[10_1_0%] flex-col self-stretch min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={pairIdx}
              className="flex h-full flex-col justify-between items-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.26, ease: EASE }}
            >
              {/* Felső kártya — jobbra (szélen), nem takarja a videót */}
              <motion.div
                className="self-end"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.18, duration: 0.4 }}
              >
                <Top />
              </motion.div>

              {/* Alsó kártya — balra (belül) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.4 }}
              >
                <Bottom />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
        </div>{/* ══ /TARTALOM SOR ══ */}
      </motion.div>
    </section>
    </>
  )
}
