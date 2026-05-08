'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { ArrowRight, CalendarDays, Zap, LayoutDashboard, CheckCircle, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Scroll-triggered fade up ───────────────────────────────────
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
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ── Scroll-triggered slide in from left / right ────────────────
function SlideIn({
  children,
  from = 'left',
  delay = 0,
  className,
}: {
  children: React.ReactNode
  from?: 'left' | 'right'
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, x: from === 'left' ? -56 : 56 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ── Individual word for text reveal ───────────────────────────
function RevealWord({
  children,
  progress,
  index,
  total,
}: {
  children: string
  progress: ReturnType<typeof useScroll>['scrollYProgress']
  index: number
  total: number
}) {
  const start = index / total
  const end = Math.min((index + 1.5) / total, 1)
  const opacity = useTransform(progress, [start, end], [0.12, 1])
  return (
    <motion.span style={{ opacity }} className="inline-block mr-[0.3em]">
      {children}
    </motion.span>
  )
}

// ── Scroll-driven text reveal ──────────────────────────────────
function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'end 0.3'],
  })
  const words = text.split(' ')
  return (
    <div ref={ref} className={className}>
      {words.map((word, i) => (
        <RevealWord key={i} progress={scrollYProgress} index={i} total={words.length}>
          {word}
        </RevealWord>
      ))}
    </div>
  )
}

// ── Glass card class ───────────────────────────────────────────
const glass = 'bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl'

// ─────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">

      {/* ── 1. HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col px-6 lg:px-14 overflow-hidden">
        {/* dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, black 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, black 100%)',
          }}
        />
        {/* grain texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.028]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />
        {/* white glow a cím mögött */}
        <div
          className="pointer-events-none absolute top-[10%] left-0 w-[70vw] h-[70vh] max-w-[800px]"
          style={{
            background: 'radial-gradient(ellipse at 25% 45%, rgba(255,255,255,0.055) 0%, transparent 65%)',
          }}
        />
        {/* bottom fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />

        {/* nav */}
        <nav className="flex items-center justify-between pt-8 max-w-5xl mx-auto w-full">
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-white font-black text-xl tracking-tight"
          >
            Bookly
          </motion.span>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link
              href="/bookly/login"
              className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
            >
              Bejelentkezés
            </Link>
          </motion.div>
        </nav>

        {/* hero copy */}
        <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full pt-12 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="self-start inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-300 mb-8"
          >
            7 nap ingyenes próba — utána 2 900 Ft/hó
          </motion.div>

          <div>
            {['ONLINE', 'IDŐPONT', 'FOGLALÓ.'].map((word, i) => (
              <div key={word} className="overflow-hidden">
                <motion.p
                  className="text-white font-black text-[3rem] sm:text-[5rem] lg:text-[7.5rem] uppercase leading-[0.88] tracking-tighter"
                  initial={{ y: '110%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.75, delay: 0.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word}
                </motion.p>
              </div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.72 }}
            className="text-zinc-400 text-base lg:text-lg max-w-sm mt-8 mb-10 leading-relaxed"
          >
            Fodrászoknak, kozmetikusoknak, masszőröknek. Egy link — és máris foglalnak.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.88 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link href="/bookly/register">
              <button className="h-14 px-8 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors w-full sm:w-auto">
                Próbáld ki ingyen <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/bookly/davelopment">
              <button className="h-14 px-8 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10 text-white font-medium text-base flex items-center justify-center gap-2 hover:bg-white/10 transition-all w-full sm:w-auto">
                Demo megnézése
              </button>
            </Link>
          </motion.div>

          {/* glass preview */}
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn(glass, 'mt-16 p-5 max-w-xs')}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold shrink-0">
                D
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">Davelopment Szalon</p>
                <p className="text-[11px] text-zinc-500">bookly.hu/davelopment</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { time: '10:00', label: 'Hajvágás · Kovács Éva' },
                { time: '11:30', label: 'Festés · Nagy Petra' },
                { time: '14:00', label: 'Manikűr · Tóth Anna' },
              ].map(({ time, label }) => (
                <div key={time} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">{time}</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-xs text-zinc-300 truncate">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. STATS ────────────────────────────────────────── */}
      <section className="border-y border-zinc-800/60 px-6 py-12 lg:py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 lg:divide-x lg:divide-zinc-800">
          {[
            { value: '500+', label: 'aktív szalon' },
            { value: '10 000+', label: 'foglalás havonta' },
            { value: '< 5 perc', label: 'beállítási idő' },
            { value: '98%', label: 'elégedett ügyfél' },
          ].map(({ value, label }, i) => (
            <FadeUp key={label} delay={i * 0.08}>
              <div className="lg:px-8 text-center lg:text-left">
                <p className="text-white font-black text-3xl lg:text-4xl tracking-tighter">{value}</p>
                <p className="text-zinc-500 text-sm mt-1">{label}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── 3. FEATURES ─────────────────────────────────────── */}
      <section className="px-6 py-20 lg:py-32 max-w-5xl mx-auto">
        <FadeUp>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Amit kapsz</p>
          <h2 className="text-white font-black text-3xl lg:text-5xl uppercase tracking-tighter mb-14 max-w-lg leading-[0.9]">
            MINDEN AMIRE<br />SZÜKSÉGED VAN.
          </h2>
        </FadeUp>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            {
              icon: CalendarDays,
              title: 'Saját foglalási oldal',
              desc: 'Személyre szabott URL — Instagram bio-ba, névjegyre, Google-re. Ügyfeleid percek alatt foglalnak.',
              from: 'left' as const,
              delay: 0,
            },
            {
              icon: Zap,
              title: 'Azonnali értesítések',
              desc: 'Minden új foglalásnál emailt kapsz, az ügyfél visszaigazolást. Automatikusan, extra munka nélkül.',
              from: 'left' as const,
              delay: 0.1,
            },
            {
              icon: LayoutDashboard,
              title: 'Teljes dashboard',
              desc: 'Foglalások, munkatársak, nyitvatartás, bevétel — minden egy helyen, mobilon is.',
              from: 'right' as const,
              delay: 0.2,
            },
          ].map(({ icon: Icon, title, desc, from, delay }) => (
            <SlideIn key={title} from={from} delay={delay} className="h-full">
              <div className={cn(glass, 'p-6 h-full flex flex-col')}>
                <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center mb-5 shrink-0">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            </SlideIn>
          ))}
        </div>
      </section>

      {/* ── 4. TEXT REVEAL ──────────────────────────────────── */}
      <section className="border-t border-zinc-800/60 px-6 py-16 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <TextReveal
            text="AZ EGYSZERŰ IDŐPONTFOGLALÁS AMIRE RÉGÓTA VÁRTÁL."
            className="text-white font-black text-3xl sm:text-4xl lg:text-6xl uppercase leading-tight tracking-tighter"
          />
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ─────────────────────────────────── */}
      <section className="border-t border-zinc-800/60 px-6 py-20 lg:py-32">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Hogyan működik</p>
            <h2 className="text-white font-black text-3xl lg:text-5xl uppercase tracking-tighter mb-14 leading-[0.9]">
              3 LÉPÉS,<br />ENNYI AZ EGÉSZ.
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                n: '01',
                title: 'Regisztrálsz',
                desc: 'Létrehozod a szalonod profilját: név, szolgáltatások, munkatársak, nyitvatartás. 5 perc alatt kész.',
              },
              {
                n: '02',
                title: 'Megosztod a linket',
                desc: 'Saját URL-ed bemásolod az Instagram bio-ba, névjegykártyára, vagy Google Maps-re.',
              },
              {
                n: '03',
                title: 'Ügyfeleid foglalnak',
                desc: 'Ők 0-24-ben választanak időpontot. Te értesítést kapsz, ők visszaigazolást. Automatikusan.',
              },
            ].map(({ n, title, desc }, i) => (
              <SlideIn key={n} from={i % 2 === 0 ? 'left' : 'right'} delay={i * 0.1}>
                <div className={cn(glass, 'p-7 h-full flex flex-col')}>
                  <p className="text-white/15 font-black text-6xl tracking-tighter mb-6 leading-none">{n}</p>
                  <h3 className="text-white font-bold text-xl mb-2">{title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </SlideIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING ──────────────────────────────────────── */}
      <section className="border-t border-zinc-800/60 px-6 py-20 lg:py-32">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-14">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Árazás</p>
            <h2 className="text-white font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9]">
              EGYSZERŰ,<br />TISZTA ÁRAZÁS.
            </h2>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className={cn(glass, 'max-w-md mx-auto p-8 lg:p-10')}>
              <p className="text-zinc-500 text-sm font-medium mb-2">Havi díj</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-white font-black text-5xl tracking-tighter">2 900</span>
                <span className="text-zinc-400 text-xl mb-1">Ft / hó</span>
              </div>
              <p className="text-emerald-400 text-sm font-semibold mb-8">
                7 napig ingyenes · kártya nem szükséges
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Korlátlan foglalás',
                  'Saját foglalási oldal (URL)',
                  'Email értesítések',
                  'Munkatárs kezelés',
                  'Bevétel és statisztikák',
                  'Mobilbarát dashboard',
                  'Lemondható bármikor',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/bookly/register" className="block">
                <button className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors">
                  Kipróbálom ingyen <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── 7. TESTIMONIALS ─────────────────────────────────── */}
      <section className="border-t border-zinc-800/60 px-6 py-20 lg:py-32">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Visszajelzések</p>
            <h2 className="text-white font-black text-3xl lg:text-5xl uppercase tracking-tighter mb-14 leading-[0.9]">
              MIT MONDANAK<br />A SZALONOK.
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              {
                quote:
                  'Mióta bevezettük, feleannyi telefonhívást kapok. Az ügyfelek maguk foglalnak, én csak megerősítem.',
                name: 'Kovács Veronika',
                role: 'Hajstúdió tulajdonos, Budapest',
                from: 'left' as const,
                delay: 0,
              },
              {
                quote:
                  'Egyszerűbb mint gondoltam. 10 perc alatt be volt állítva és már másnap foglaltak rajta.',
                name: 'Nagy Eszter',
                role: 'Kozmetikus, Győr',
                from: 'left' as const,
                delay: 0.1,
              },
              {
                quote:
                  'A statisztikák megmutatják melyik nap a legerősebb. Teljesen átalakítottam a nyitvatartásomat.',
                name: 'Horváth Péter',
                role: 'Barbershop, Pécs',
                from: 'right' as const,
                delay: 0.2,
              },
            ].map(({ quote, name, role, from, delay }) => (
              <SlideIn key={name} from={from} delay={delay} className="h-full">
                <div className={cn(glass, 'p-6 h-full flex flex-col')}>
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-zinc-400 text-zinc-400" />
                    ))}
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed flex-1 mb-5">"{quote}"</p>
                  <div>
                    <p className="text-white font-semibold text-sm">{name}</p>
                    <p className="text-zinc-500 text-xs">{role}</p>
                  </div>
                </div>
              </SlideIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ────────────────────────────────────── */}
      <section className="border-t border-zinc-800/60 px-6 py-24 lg:py-36">
        <div className="max-w-5xl mx-auto text-center">
          <FadeUp>
            <h2 className="text-white font-black text-5xl lg:text-8xl uppercase tracking-tighter leading-[0.88] mb-8">
              KEZDD EL MA.<br />7 NAPIG<br />INGYEN.
            </h2>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="text-zinc-500 text-sm mb-8">
              Próbáld ki kártya nélkül. Utána csak 2 900 Ft/hó. Lemondható bármikor.
            </p>
            <Link href="/bookly/register">
              <button className="h-14 px-10 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-base inline-flex items-center gap-2 transition-colors">
                Regisztráció <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ── 9. FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 px-6 py-8 lg:px-14">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white font-black text-lg tracking-tight">Bookly</span>
          <p className="text-zinc-600 text-xs">© 2026 Bookly · hello@bookly.hu</p>
          <Link href="/bookly/login" className="text-zinc-500 hover:text-white text-sm transition-colors">
            Bejelentkezés
          </Link>
        </div>
      </footer>
    </main>
  )
}
