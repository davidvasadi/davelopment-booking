'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform, useInView, type MotionValue } from 'framer-motion'
import { ArrowUpRight, ArrowDown, Plus, Minus, CalendarCheck, Bell, BarChart3, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import { LandingButton } from '@/components/landing/LandingButton'

/** Végtelen, finom lebegés (y-oszcilláció) — a Figma lebegő elemeihez. */
function float(amplitude = 10, duration = 6, delay = 0) {
  return {
    animate: { y: [0, -amplitude, 0] },
    transition: { duration, delay, ease: 'easeInOut' as const, repeat: Infinity },
  }
}

/** Hero elsődleges gomb: sárga szöveg-pill + kör ikon, hoverre összefolynak,
 *  a nyíl 90°-ot fordul, a szöveg egyet körbefordul (folyamatos). */
function SplitRegisterButton({ href, label }: { href: string; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="inline-flex items-center"
      animate={{ gap: hover ? 0 : 5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <Link href={href} className="inline-flex h-14 items-center rounded-[30px] bg-brand-accent px-7 text-[22px] font-medium text-brand-ink overflow-hidden">
        <motion.span animate={{ rotate: hover ? 360 : 0 }} transition={{ type: 'tween', duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="inline-block">
          {label}
        </motion.span>
      </Link>
      <Link href={href} aria-label={label} className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-brand-ink">
        <motion.span animate={{ rotate: hover ? 90 : 0 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
          <ArrowUpRight className="h-6 w-6" />
        </motion.span>
      </Link>
    </motion.div>
  )
}

/** Hero másodlagos gomb (egyben): hoverre nyíl 90°-ot fordul + szöveg egyet körbefordul. */
function SpinButton({ href, label, variant }: { href: string; label: string; variant: 'dark' | 'light' }) {
  const [hover, setHover] = useState(false)
  const cls = variant === 'dark' ? 'bg-brand-ink text-brand-bg' : 'bg-brand-bg text-brand-ink'
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn('inline-flex h-14 items-center gap-[22px] rounded-[30px] px-6 text-[22px] font-medium', cls)}
    >
      <motion.span animate={{ rotate: hover ? 360 : 0 }} transition={{ type: 'tween', duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="inline-block">
        {label}
      </motion.span>
      {variant === 'dark' && (
        <motion.span animate={{ rotate: hover ? 90 : 0 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }}>
          <ArrowUpRight className="h-2.5 w-2.5" />
        </motion.span>
      )}
    </Link>
  )
}

/* ─────────────────────────  Animáció-helperek  ───────────────────────── */

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >{children}</motion.div>
  )
}

function RevealWord({ word, progress, index, total }: { word: string; progress: MotionValue<number>; index: number; total: number }) {
  const opacity = useTransform(progress, [index / total, Math.min((index + 1.5) / total, 1)], [0.12, 1])
  return <motion.span style={{ opacity }} className="inline-block mr-[0.28em]">{word}</motion.span>
}

function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.4'] })
  const words = text.split(' ')
  return (
    <div ref={ref} className={className}>
      {words.map((word, i) => (
        <RevealWord key={i} word={word} progress={scrollYProgress} index={i} total={words.length} />
      ))}
    </div>
  )
}

function CountUp({ to, suffix = '', prefix = '', duration = 1500 }: { to: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-40px' })
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
  const fmt = count >= 1000 ? count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : count.toString()
  return <span ref={ref}>{prefix}{fmt}{suffix}</span>
}

/* ─────────────────────────  Telefon-mockup  ───────────────────────── */

function PhoneMockup({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-[240px] mx-auto select-none', className)}>
      <div className="relative w-[240px] h-[480px] rounded-[2.6rem] bg-brand-ink p-[7px] shadow-2xl shadow-black/25">
        <div className="absolute top-[11px] left-1/2 -translate-x-1/2 w-14 h-3.5 bg-black rounded-full z-10" />
        <div className="w-full h-full rounded-[2.1rem] bg-zinc-900 overflow-hidden">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source src="/videos/booking-flow.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  )
}

/** Sötét keretes telefon az analytics-mockuppal (a hero jobb oldalához). */
function PhoneDashboardMockup() {
  const kpis: [string, string][] = [['98', 'Performance Score'], ['42%', 'Organic Traffic'], ['32%', 'Conversion Rate'], ['-18%', 'Bounce Rate']]
  return (
    <div className="relative w-[280px] select-none">
      <div className="relative w-[280px] h-[560px] rounded-[3rem] bg-brand-ink p-[9px] shadow-2xl shadow-black/30">
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        <div className="w-full h-full rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
          {/* fejléc */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <span className="text-zinc-300">‹</span>
            <span className="text-[13px] font-semibold text-brand-ink">Launch &amp; Optimization</span>
            <span className="text-zinc-300">···</span>
          </div>
          {/* brand-kép */}
          <div className="px-4">
            <div className="relative rounded-2xl bg-zinc-900 h-44 flex items-center justify-center overflow-hidden">
              <p className="text-2xl font-black tracking-tight text-white">[davelopment]®</p>
              <p className="absolute bottom-3 text-[10px] text-white/40">davelopment.hu</p>
            </div>
          </div>
          {/* Performance Overview */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-brand-ink">Performance Overview</p>
              <span className="text-[10px] text-zinc-400 rounded-md border border-zinc-200 px-2 py-0.5">This Month ▾</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {kpis.map(([v, l]) => (
                <div key={l} className="rounded-lg bg-brand-surface px-1.5 py-2 text-center">
                  <p className="text-[13px] font-black text-brand-ink leading-none">{v}</p>
                  <p className="mt-1 text-[7px] leading-tight text-zinc-400">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  „Görgess lejjebb" notch (Figma 22:758)  ───────────────────────── */

/**
 * A két hero-kártya közös alján ülő, a háttér színű (brand-bg) „notch" forma:
 * felül kis kupola nyúlik fel a kártyák közé, az alsó sarkok a kártyák felé ívelnek
 * (befelé lekerekített), középen a forgó „GÖRGESS LEJJEBB" körfelirat + lefelé nyíl.
 * Méret a Figma szerint ~288×174.
 */
function ScrollCue() {
  const text = '✳ GÖRGESS LEJJEBB '.repeat(2)
  return (
    <div className="relative w-[260px] h-[150px] select-none pointer-events-none">
      {/* a brand-bg színű forma — felső dudor + alsó, kártyák felé ívelő sarkok */}
      <svg viewBox="0 0 288 174" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path
          fill="#F4F2EE"
          d="
            M0,30
            Q0,30 0,30
            L108,30
            Q124,30 130,16
            Q138,0 144,0
            Q150,0 158,16
            Q164,30 180,30
            L288,30
            L288,174
            Q288,144 258,144
            L30,144
            Q0,144 0,174
            Z
          "
        />
      </svg>
      {/* forgó körfelirat + nyíl, a forma közepén */}
      <div className="absolute left-1/2 top-[58px] -translate-x-1/2 h-24 w-24">
        <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 16, ease: 'linear', repeat: Infinity }}>
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <defs>
              <path id="cue-circle" d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" />
            </defs>
            <text className="fill-brand-ink/70 text-[8px] font-medium uppercase" style={{ letterSpacing: '0.22em' }}>
              <textPath href="#cue-circle" startOffset="0">{text}</textPath>
            </text>
          </svg>
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={{ y: [0, 4, 0] }} transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}>
            <ArrowDown className="h-5 w-5 text-brand-ink" />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  Marquee (szolgáltatás-futószalag)  ───────────────────────── */

const MARQUEE_ITEMS = ['ÉTTEREM', 'CSONTKOVÁCS', 'FODRÁSZAT', 'SZEMÉLYI EDZŐ', 'JÓGA', 'KOZMETIKA', 'MASSZŐR', 'KÖRÖMSZALON']

/** Egy végtelen futósor: alap-animáció megy folyamatosan, ÉS a görgetés
 *  pozíciója extra eltolást ad (scroll-reaktív parallax). */
function MarqueeRow({ reverse = false, duration = 18, scroll }: { reverse?: boolean; duration?: number; scroll: MotionValue<number> }) {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  // A teljes oldal scrollja egy plusz x-eltolást ad (irány a `reverse` szerint).
  const scrollX = useTransform(scroll, [0, 1], reverse ? ['0%', '20%'] : ['0%', '-20%'])
  return (
    <div className="overflow-hidden">
      <motion.div style={{ x: scrollX }}>
        <motion.div
          className="flex whitespace-nowrap"
          animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
          transition={{ duration, ease: 'linear', repeat: Infinity }}
        >
          {row.map((item, i) => (
            <span key={i} className="flex items-center text-brand-ink font-black text-3xl lg:text-5xl tracking-tight uppercase px-5">
              {item}
              <span className="mx-5 text-brand-ink/40">✳</span>
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

/** Három soros, gyors, váltakozó irányú futószalag — scroll-reaktív parallaxszal. */
function Marquee() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return (
    <div ref={ref} className="bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-5 space-y-1">
      <MarqueeRow duration={16} scroll={scrollYProgress} />
      <MarqueeRow reverse duration={20} scroll={scrollYProgress} />
      <MarqueeRow duration={14} scroll={scrollYProgress} />
    </div>
  )
}

/* ─────────────────────────  FAQ  ───────────────────────── */

const faqItems = [
  { q: 'Mennyibe kerül a Schedulio?', a: 'Szalon Pro: 2 900 Ft/hó. Étterem Pro (asztalfoglalással): 9 900 Ft/hó. Mindkettő 14 napig ingyenes, kártya nélkül. Lemondható bármikor, visszamenőleges számlázás nélkül.' },
  { q: 'Kell bankkártyaadatokat megadni a próbaidőhöz?', a: 'Nem. A 14 napos próbaidőhöz csak egy email cím és jelszó szükséges. Kártyaadatokat csak akkor kérünk, ha az ingyenes időszak után is folytatnád.' },
  { q: 'Mennyi ideig tart beállítani?', a: 'Az első profil — névvel, szolgáltatásokkal és nyitvatartással — kb. 5 perc alatt elkészíthető. Utána máris megosztható a foglalási link.' },
  { q: 'Hány munkatársat és szolgáltatást adhatok hozzá?', a: 'Korlátlan számút. Minden munkatársnak saját elérhetőségi naptárt állíthatsz be, és minden szolgáltatáshoz külön árat és időtartamot rendelhetsz.' },
  { q: 'Kapnak visszaigazolást az ügyfeleim?', a: 'Igen. Minden foglalásnál automatikusan küldünk visszaigazoló emailt az ügyfélnek a foglalás részleteivel.' },
]

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="space-y-3">
      {faqItems.map(({ q, a }, i) => {
        const isOpen = open === i
        return (
          <FadeUp key={i} delay={i * 0.04}>
            <div className={cn('rounded-2xl border transition-colors', isOpen ? 'border-brand-ink/15 bg-white' : 'border-zinc-200 bg-white')}>
              <button
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="flex items-center gap-4">
                  <span className="text-xs font-bold text-zinc-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-semibold text-[15px] text-brand-ink">{q}</span>
                </span>
                <span className={cn('shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-colors', isOpen ? 'bg-brand-accent text-brand-ink' : 'bg-brand-surface text-zinc-500')}>
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                    <div className="px-6 pb-5 pl-[3.25rem]">
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

/* ─────────────────────────  Számozott szolgáltatás-lista  ───────────────────────── */

const SERVICES = [
  { n: '001', title: 'Saját foglalási oldal', icon: CalendarCheck, body: 'Egyedi linken osztható, mobilbarát foglalóoldal — az ügyfél pár kattintással foglal.' },
  { n: '002', title: 'Azonnali értesítések', icon: Bell, body: 'Új foglalásról és lemondásról azonnal értesülsz a dashboardon és emailben.' },
  { n: '003', title: 'Bevétel & statisztikák', icon: BarChart3, body: 'Kövesd a kihasználtságot, a bevételt és a trendeket — exportálható CSV-be.' },
  { n: '004', title: 'Teljes dashboard', icon: LayoutDashboard, body: 'Foglalások, szolgáltatások, munkatársak, nyitvatartás — minden egy helyen.' },
]

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
            <span className={cn('text-xs font-bold tabular-nums transition-colors', active === i ? 'text-brand-ink' : 'text-zinc-300')}>({s.n})</span>
            <span className={cn('text-3xl lg:text-4xl font-black tracking-tight transition-colors', active === i ? 'text-brand-ink' : 'text-zinc-300 group-hover:text-zinc-400')}>
              {s.title}
            </span>
          </button>
        ))}
      </div>
      {/* Aktív szolgáltatás kártyája. */}
      <div className="lg:sticky lg:top-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-3xl bg-brand-accent p-8 lg:p-10"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-ink text-brand-accent">
              {(() => { const Icon = SERVICES[active].icon; return <Icon className="h-6 w-6" /> })()}
            </span>
            <h3 className="mt-6 text-2xl font-black tracking-tight text-brand-ink">{SERVICES[active].title}</h3>
            <p className="mt-3 text-brand-ink/70 leading-relaxed">{SERVICES[active].body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─────────────────────────  Oldal  ───────────────────────── */

export default function Home() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-ink font-geist">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50  backdrop-blur-md border-b border-zinc-200/60">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Schedulio"><SchedulioLogo variant="light" className="h-7" /></Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500 bg-white/60 px-4 py-2 rounded-full ">
            <a href="#szolgaltatasok" className="hover:text-brand-ink transition-colors hover:bg-[#f4f2ee]">Szolgáltatások</a>
            <a href="#arazas" className="hover:text-brand-ink transition-colors">Árazás</a>
            <a href="#gyik" className="hover:text-brand-ink transition-colors">GYIK</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-zinc-500 hover:text-brand-ink transition-colors">Bejelentkezés</Link>
            <LandingButton href="/register" variant="dark" icon>Regisztráció</LandingButton>
          </div>
        </div>
      </nav>

      {/* ── HERO ── a Figma frame (22:757) pontos újraépítése ──────────────── */}
      <section className="max-w-[1420px] mx-auto px-4 lg:px-5 pt-5 pb-12">
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* BAL kártya — fehér */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[30px] bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[560px] lg:min-h-[720px]"
          >
            <div>
              {/* badge: keretes pill */}
              <motion.span
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex h-8 items-center rounded-full border border-brand-ink px-5 text-xs font-medium text-brand-ink"
              >
                Próbáld ki 30 napig ingyen.
              </motion.span>

              {/* cím — Geist Bold 57px, tight tracking */}
              <h1 className="mt-5 font-geist font-bold leading-[1.05] tracking-[-0.05em] text-[clamp(2.5rem,6vw,3.5rem)] text-brand-ink max-w-[480px] overflow-hidden">
                {['Online', 'Időpontfoglaló.'].map((w, i) => (
                  <span key={w} className="block overflow-hidden">
                    <motion.span className="block" initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.15 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}>
                      {w}
                    </motion.span>
                  </span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
                className="mt-5 max-w-[475px] text-base leading-6 text-brand-ink"
              >
                Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra figyelj. Éttermeknek, fodrászatoknak, kis vállalkozásoknak.
              </motion.p>

              {/* elsődleges gomb: sárga pill + kör ikon (összefolyik hoverre) */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.55 }} className="mt-8">
                <SplitRegisterButton href="/register" label="Regisztrálj ingyen" />
              </motion.div>
            </div>

            {/* alul: „Van már fiókod?" + két gomb */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 }} className="mt-12">
              <p className="mb-4 text-base text-brand-ink">Van már fiókod?</p>
              <div className="flex flex-wrap items-center gap-3">
                <SpinButton href="/login" label="Bejelentkezés" variant="dark" />
                <SpinButton href="/davelopment" label="Demó megtekintése" variant="light" />
              </div>
            </motion.div>
          </motion.div>

          {/* JOBB kártya — sárga */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-[30px] bg-brand-accent overflow-hidden min-h-[560px] lg:min-h-[720px]"
          >
            {/* glass-kártya: bg-white/67 + blur, Geist Regular */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
              className="absolute left-6 top-12 z-20"
            >
              <motion.div {...float(8, 6)} className="rounded-[20px] bg-white/[0.67] backdrop-blur-[23px] p-5 max-w-xs">
                <p className="text-xl leading-7 tracking-[-0.03em] text-brand-ink">Elérhető</p>
                <p className="mt-2 text-[40px] leading-[1.1] tracking-[-0.06em] text-brand-ink">Próbaidőszak után</p>
                <p className="mt-2 flex gap-6 font-martian text-base text-brand-ink whitespace-nowrap">
                  Havidíj akár <span className="text-[#10b97f]">2900 Ft-tól</span>
                </p>
              </motion.div>
            </motion.div>

            {/* dashboard-telefon, jobb alsó sarokból kilógva */}
            <motion.div
              initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-4 lg:right-10 top-28 lg:top-36 z-10"
            >
              <motion.div {...float(12, 7, 0.5)}>
                <PhoneDashboardMockup />
              </motion.div>
            </motion.div>

            {/* alsó-jobb sarokban: Martian Mono szöveg */}
            <p className="absolute bottom-7 right-7 z-20 hidden lg:block text-right font-martian text-base leading-6 text-brand-ink">
              Regisztrálj és<br />próbáld ki ingyen
            </p>
          </motion.div>

          {/* „Görgess lejjebb" notch — a két kártya közös alján, középen.
              A felső dudor a kártyák közé nyúlik, a notch teste a kártyák alja alá lóg. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.8 }}
            className="hidden lg:block absolute left-1/2 bottom-[-118px] -translate-x-1/2 z-30"
          >
            <ScrollCue />
          </motion.div>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────── */}
      <Marquee />

      {/* ── DEMO ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <FadeUp><span className="inline-block rounded-full bg-brand-surface px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-6">Demo</span></FadeUp>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end">
          <TextReveal text="Lásd működés közben." className="text-4xl lg:text-6xl font-black tracking-tighter leading-[0.95]" />
          <p className="text-zinc-500 leading-relaxed lg:pb-2">Gyakran felmerülő kérdések? Itt vagyunk, hogy segítsünk — a teljes dashboard pár perc alatt beállítható.</p>
        </div>
        <FadeUp className="mt-12">
          <div className="rounded-[2rem] bg-brand-accent p-10 lg:p-16 flex justify-center">
            <PhoneMockup />
          </div>
        </FadeUp>
      </section>

      {/* ── SZOLGÁLTATÁSOK ───────────────────────────────────── */}
      <section id="szolgaltatasok" className="max-w-6xl mx-auto px-6 lg:px-10 py-24 lg:py-32 border-t border-zinc-100">
        <FadeUp><span className="inline-block rounded-full bg-brand-surface px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-10">Szolgáltatások</span></FadeUp>
        <ServicesList />
      </section>

      {/* ── „30 NAPIG INGYEN" promó ──────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-8">
        <FadeUp>
          <div className="rounded-[2rem] bg-brand-accent p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block rounded-full bg-brand-ink/10 px-3 py-1 text-[11px] font-semibold text-brand-ink mb-5">Pricing</span>
              <h2 className="text-3xl lg:text-4xl font-black tracking-tighter text-brand-ink">Most 30 napig ingyen.</h2>
              <p className="mt-3 text-brand-ink/70 max-w-sm">Teljes hozzáférés, kártya nélkül. Bármikor lemondható.</p>
              <div className="mt-6"><LandingButton href="/register" variant="dark" icon>Regisztráció</LandingButton></div>
            </div>
            <div className="flex items-center justify-center gap-3 lg:justify-end">
              <CountUp to={1000} prefix="+" suffix=" felhasználó" />
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── ÁRAZÁS ───────────────────────────────────────────── */}
      <section id="arazas" className="max-w-6xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-12">
          <FadeUp>
            <h2 className="text-4xl lg:text-6xl font-black tracking-tighter leading-[0.95]">Egyszerű,<br />tiszta árazás.</h2>
          </FadeUp>
          <p className="text-zinc-500 leading-relaxed lg:pb-2">Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő 14 napig ingyenes, kártya nélkül.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Szalon — világos kártya */}
          <FadeUp>
            <div className="rounded-3xl bg-brand-surface p-8 lg:p-10 h-full flex flex-col">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white"><CalendarCheck className="h-5 w-5 text-brand-ink" /></span>
              <p className="mt-6 text-4xl font-black tracking-tight text-brand-ink">2 900 Ft <span className="text-base font-medium text-zinc-400">/hó</span></p>
              <p className="mt-3 text-zinc-500 flex-1">Időpontfoglalás szalonoknak, fodrászoknak, masszőröknek, kozmetikusoknak.</p>
              <div className="mt-8"><LandingButton href="/register" variant="dark" icon className="w-full">Kipróbálom ingyen</LandingButton></div>
            </div>
          </FadeUp>
          {/* Étterem — sárga kártya */}
          <FadeUp delay={0.08}>
            <div className="rounded-3xl bg-brand-accent p-8 lg:p-10 h-full flex flex-col">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink"><LayoutDashboard className="h-5 w-5 text-brand-accent" /></span>
              <p className="mt-6 text-4xl font-black tracking-tight text-brand-ink">9 900 Ft <span className="text-base font-medium text-brand-ink/50">/hó</span></p>
              <p className="mt-3 text-brand-ink/70 flex-1">Asztalfoglalás éttermeknek — kapacitás, asztaltérkép, csoportok, előleg.</p>
              <div className="mt-8"><LandingButton href="/register-restaurant" variant="dark" icon className="w-full">Kipróbálom ingyen</LandingButton></div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── GYIK ─────────────────────────────────────────────── */}
      <section id="gyik" className="max-w-6xl mx-auto px-6 lg:px-10 py-24 lg:py-32 border-t border-zinc-100">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-12">
          <FadeUp><h2 className="text-4xl lg:text-6xl font-black tracking-tighter leading-[0.95]">Gyakran<br />kérdezik.</h2></FadeUp>
          <p className="text-zinc-500 leading-relaxed lg:pb-2">Gyakran felmerülő kérdések — itt vagyunk, hogy segítsünk.</p>
        </div>
        <FaqAccordion />
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-brand-ink text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <SchedulioLogo variant="dark" className="h-7" />
              <p className="mt-4 text-2xl font-black tracking-tight">Online Időpontfoglaló.</p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Gyors linkek</p>
                <ul className="space-y-2 text-sm text-white/70">
                  <li><a href="#szolgaltatasok" className="hover:text-white transition-colors">Szolgáltatások</a></li>
                  <li><a href="#arazas" className="hover:text-white transition-colors">Árazás</a></li>
                  <li><a href="#gyik" className="hover:text-white transition-colors">GYIK</a></li>
                  <li><Link href="/login" className="hover:text-white transition-colors">Bejelentkezés</Link></li>
                </ul>
              </div>
              <div className="flex flex-col items-start gap-3">
                <LandingButton href="/register" variant="yellow" icon>Ingyenes Regisztráció</LandingButton>
                <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  Powered by [davelopment]®
                </a>
              </div>
            </div>
          </div>
        </div>
        {/* Nagy „Csatlakozz" felirat alul. */}
        <p className="select-none text-center font-black uppercase tracking-tighter leading-none text-white/[0.06] text-[22vw] lg:text-[20vw] -mb-[3vw]">
          Csatlakozz
        </p>
      </footer>
    </main>
  )
}
