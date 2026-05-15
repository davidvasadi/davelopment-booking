'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform, useInView, type MotionValue } from 'framer-motion'
import { ArrowRight, TrendingUp, Users, Calendar, CheckCircle, Star, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function SlideIn({ children, from = 'left', delay = 0, className }: { children: React.ReactNode; from?: 'left' | 'right'; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, x: from === 'left' ? -40 : 40 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >{children}</motion.div>
  )
}

function RevealWord({ word, progress, index, total }: { word: string; progress: MotionValue<number>; index: number; total: number }) {
  const opacity = useTransform(progress, [index / total, Math.min((index + 1.5) / total, 1)], [0.1, 1])
  return <motion.span style={{ opacity }} className="inline-block mr-[0.28em]">{word}</motion.span>
}

function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.3'] })
  const words = text.split(' ')
  return (
    <div ref={ref} className={className}>
      {words.map((word, i) => (
        <RevealWord key={i} word={word} progress={scrollYProgress} index={i} total={words.length} />
      ))}
    </div>
  )
}

function PhoneMockup() {
  return (
    <div className="relative w-[260px] mx-auto select-none">
      <div className="absolute -inset-6 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.12) 0%, transparent 70%)', filter: 'blur(24px)' }} />
      <div className="relative w-[260px] h-[520px] rounded-[2.8rem] bg-zinc-700 p-[8px] shadow-2xl shadow-black/20 border border-zinc-600">
        <div className="absolute top-[12px] left-1/2 -translate-x-1/2 w-16 h-4 bg-zinc-900 rounded-full z-10" />
        <div className="w-full h-full rounded-[2.3rem] bg-zinc-900 overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/videos/booking-flow.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  )
}

function DashboardFrame() {
  const bookings = [
    { time: '09:00', name: 'Kovács Éva', service: 'Hajvágás', color: '#0099ff' },
    { time: '10:30', name: 'Nagy Petra', service: 'Balayage', color: '#00bb88' },
    { time: '12:00', name: 'Tóth Bence', service: 'Borotválás', color: '#a855f7' },
    { time: '14:00', name: 'Varga Lili', service: 'Manikűr', color: '#f59e0b' },
  ]
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-100 bg-zinc-50">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="flex-1 flex justify-center">
          <div className="bg-zinc-100 rounded px-3 py-0.5 text-[10px] text-zinc-400 font-mono">bookly.hu/dashboard</div>
        </div>
      </div>
      <div className="flex min-h-0">
        <div className="w-40 border-r border-zinc-100 px-2 py-3 hidden sm:flex flex-col gap-0.5 shrink-0">
          <div className="px-2 py-1 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Bookly</div>
          {[
            { label: 'Áttekintés', active: true },
            { label: 'Foglalások', active: false },
            { label: 'Szolgáltatások', active: false },
            { label: 'Munkatársak', active: false },
            { label: 'Beállítások', active: false },
          ].map(({ label, active }) => (
            <div key={label} className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
              active ? 'bg-zinc-900 text-white' : 'text-zinc-400')}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 min-w-0 bg-zinc-50">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-700 text-xs font-semibold">Mai foglalások</p>
            <span className="text-[10px] text-zinc-400">2026. máj. 8.</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: Calendar, label: 'Foglalás', value: '8', color: '#0099ff' },
              { icon: TrendingUp, label: 'Bevétel', value: '64k', color: '#00bb88' },
              { icon: Users, label: 'Ügyfél', value: '12', color: '#a855f7' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white border border-zinc-200 rounded-xl p-2.5">
                <Icon className="h-3 w-3 mb-1.5" style={{ color }} />
                <p className="text-zinc-900 font-black text-lg leading-none">{value}</p>
                <p className="text-zinc-400 text-[9px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {bookings.map(({ time, name, service, color }) => (
              <div key={time} className="bg-white border border-zinc-100 rounded-xl flex items-center gap-2.5 px-3 py-2">
                <span className="text-[9px] font-mono text-zinc-400 w-8 shrink-0">{time}</span>
                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[11px] font-semibold text-zinc-700 truncate">{name}</span>
                <span className="text-[10px] text-zinc-400 ml-auto shrink-0 hidden sm:block">{service}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 1: Form card — 3 input fields fill in, progress bar, save button with checkmark
function StepGraphic1() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 4400)
    return () => clearInterval(id)
  }, [])
  const fields = [
    { delay: 0.4, width: '65%' },
    { delay: 1.1, width: '48%' },
    { delay: 1.8, width: '72%' },
  ]
  return (
    <AnimatePresence mode="wait">
      <motion.div key={tick}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl border border-zinc-200 shadow-sm w-[250px] overflow-hidden"
      >
        {/* progress bar */}
        <div className="h-[3px] bg-zinc-100">
          <motion.div
            className="h-full bg-zinc-900 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 4.0, ease: 'linear' }}
          />
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Szalon beállítás</p>
          {fields.map(({ delay, width }, i) => (
            <div key={i}>
              <div className="h-1.5 w-10 bg-zinc-100 rounded-full mb-1.5" />
              <div className="h-9 bg-zinc-50 border border-zinc-100 rounded-lg flex items-center px-3 overflow-hidden gap-1">
                <motion.div
                  className="h-2 rounded-full bg-zinc-200"
                  initial={{ width: 0 }}
                  animate={{ width }}
                  transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.div
                  className="h-[14px] w-px bg-zinc-400 shrink-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ delay, duration: 0.75, times: [0, 0.1, 0.7, 1] }}
                />
              </div>
            </div>
          ))}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.8, duration: 0.3 }}
            className="h-9 rounded-xl bg-zinc-900 flex items-center justify-center gap-2"
          >
            <span className="text-white text-xs font-semibold">Mentés</span>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 3.5, type: 'spring', stiffness: 500, damping: 22 }}
              className="h-4 w-4 rounded-full bg-zinc-600 flex items-center justify-center"
            >
              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Step 2: URL pill → 3 icon destinations appear below
function StepGraphic2() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 4400)
    return () => clearInterval(id)
  }, [])
  return (
    <AnimatePresence mode="wait">
      <motion.div key={tick}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-0"
      >
        {/* URL pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-zinc-200 rounded-full px-5 py-2.5 shadow-sm flex items-center gap-2 z-10"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 shrink-0" />
          <span className="text-zinc-700 text-[11px] font-mono">bookly.hu/bellavita</span>
          {/* copy icon */}
          <motion.svg
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 0, 0.4] }}
            transition={{ delay: 0.5, duration: 0.35, times: [0, 0.5, 1] }}
            className="h-3.5 w-3.5 text-zinc-400 shrink-0"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </motion.svg>
        </motion.div>

        {/* vertical stem */}
        <motion.div
          className="w-px bg-zinc-200"
          initial={{ height: 0 }}
          animate={{ height: 24 }}
          transition={{ delay: 0.55, duration: 0.25 }}
        />

        {/* 3 icon cards in a row */}
        <div className="flex gap-3">
          {[
            {
              delay: 0.7,
              icon: (
                // Camera / Instagram
                <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              delay: 1.0,
              icon: (
                // Map pin / Google Maps
                <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              delay: 1.3,
              icon: (
                // ID card / business card
                <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              ),
            },
          ].map(({ delay, icon }, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-0"
            >
              {/* branch line */}
              <motion.div
                className="w-px bg-zinc-200"
                initial={{ height: 0 }}
                animate={{ height: 16 }}
                transition={{ delay: delay - 0.12, duration: 0.2 }}
              />
              <div className="h-14 w-14 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center shadow-sm">
                {icon}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Step 3: Week calendar — slots fill dark one by one
function StepGraphic3() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 4400)
    return () => clearInterval(id)
  }, [])
  const days = ['H', 'K', 'Sz', 'Cs', 'P']
  // which [col][row] slots are booked
  const booked = [
    [true, false, true, false],
    [true, true, false, false],
    [false, true, true, false],
    [true, false, false, true],
    [false, true, false, true],
  ]
  // flatten into ordered sequence
  const seq: { col: number; row: number; delay: number }[] = []
  let d = 0.3
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      if (booked[col][row]) { seq.push({ col, row, delay: d }); d += 0.2 }
    }
  }
  return (
    <AnimatePresence mode="wait">
      <motion.div key={tick}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl border border-zinc-200 shadow-sm w-[250px] overflow-hidden"
      >
        <div className="px-4 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Ezen a héten</p>
          <motion.span
            className="text-[10px] font-semibold text-zinc-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: d }}
          >{seq.length} foglalás</motion.span>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-5 gap-1 mb-1.5">
            {days.map(day => (
              <div key={day} className="text-center text-[9px] font-semibold text-zinc-300 uppercase tracking-widest py-0.5">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {days.map((_, col) =>
              [0, 1, 2, 3].map(row => {
                const entry = seq.find(s => s.col === col && s.row === row)
                return (
                  <motion.div
                    key={`${col}-${row}`}
                    className="h-9 rounded-lg bg-zinc-100"
                    initial={entry ? { scale: 0.7, opacity: 0 } : {}}
                    animate={entry ? { scale: 1, opacity: 1, backgroundColor: 'rgb(24 24 27)' } : { backgroundColor: 'rgb(244 244 245)' }}
                    transition={entry ? { delay: entry.delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] } : {}}
                  />
                )
              })
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

const stepsData = [
  { n: '01', title: 'Regisztrálsz', desc: 'Létrehozod a szalonod profilját: név, szolgáltatások, munkatársak, nyitvatartás. 5 perc alatt kész.', Graphic: StepGraphic1 },
  { n: '02', title: 'Megosztod a linket', desc: 'Saját URL-ed bemásolod az Instagram bio-ba, névjegykártyára, vagy Google Maps-re.', Graphic: StepGraphic2 },
  { n: '03', title: 'Ügyfeleid foglalnak', desc: 'Ők 0-24-ben választanak időpontot. Te értesítést kapsz, ők visszaigazolást. Automatikusan.', Graphic: StepGraphic3 },
]

function StepsSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const N = stepsData.length

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current
      if (!el) return
      const scrollable = el.offsetHeight - window.innerHeight
      setProgress(Math.max(0, Math.min(1, -el.getBoundingClientRect().top / scrollable)))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // cubic ease-out: fast entry, smooth deceleration
  const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)

  const seg = 1 / N
  const dotIndex = Math.min(Math.floor(progress / seg + 0.3), N - 1)

  return (
    <div ref={containerRef} style={{ height: `${(N + 1) * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-[#F2F2F0]">
        <div className="absolute inset-3 lg:inset-6">
          {stepsData.map(({ n, title, desc, Graphic }, i) => {
            const dir = i % 2 === 0 ? -1 : 1

            // card 0 is pre-entered (entryStart < 0 so it's already visible at progress=0)
            const entryStart = i === 0 ? -0.5 : i * seg
            const entryE = ease((progress - entryStart) / (seg * 0.5))

            // x: slides in from left (dir=-1) or right (dir=+1) tied to scroll
            const x = dir * 1100 * (1 - entryE)

            // push-back: each subsequent card that enters pushes this one back
            let pushScale = 1
            let pushY = 0
            let pushedE = 0
            for (let j = i + 1; j < N; j++) {
              const jE = ease((progress - j * seg) / (seg * 0.5))
              pushScale -= jE * 0.04
              pushY -= jE * 18
              pushedE += jE
            }
            pushScale = Math.max(pushScale, 0.84)
            const cardOpacity = Math.max(1 - Math.max(pushedE - 1, 0) * 0.4, 0.25)

            return (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-3xl bg-white border border-zinc-200 overflow-hidden"
                style={{ zIndex: i + 1, x, y: pushY, scale: pushScale, opacity: entryE * cardOpacity }}
              >
                <div className="h-full flex flex-col lg:flex-row">
                  {/* Text — fades + floats up with scroll */}
                  <div
                    className="lg:w-[45%] flex flex-col justify-center px-8 py-10 lg:px-14 shrink-0 relative"
                    style={{ opacity: entryE, transform: `translateY(${(1 - entryE) * 28}px)` }}
                  >
                    <div className="absolute top-0 bottom-0 right-0 w-px bg-zinc-100 hidden lg:block" />
                    <span className="text-zinc-300 text-[10px] font-mono uppercase tracking-[0.2em] mb-6">{n} / {String(N).padStart(2, '0')}</span>
                    <h3 className="text-zinc-900 font-black text-3xl lg:text-4xl xl:text-[2.8rem] tracking-tight leading-[1.05] mb-5">{title}</h3>
                    <p className="text-zinc-500 text-sm lg:text-base leading-relaxed max-w-xs">{desc}</p>
                  </div>
                  {/* Graphic — fades + floats up with scroll */}
                  <div
                    className="flex-1 bg-zinc-50 relative flex items-center justify-center p-6 lg:p-12 overflow-hidden"
                    style={{ opacity: entryE }}
                  >
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(0,153,255,0.04) 0%, transparent 70%)' }} />
                    <div
                      className="relative select-none z-10 w-full flex items-center justify-center"
                      style={{ transform: `translateY(${(1 - entryE) * -28}px)` }}
                    >
                      <Graphic />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <div className="absolute right-5 lg:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
          {stepsData.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full bg-zinc-900"
              animate={{
                height: i === dotIndex ? 24 : 6,
                width: 3,
                opacity: i === dotIndex ? 0.5 : i < dotIndex ? 0.15 : 0.07,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BookingGraphic() {
  return (
    <div className="w-full max-w-xs">
      <div className="bg-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="h-20 bg-zinc-700 relative">
          <div className="absolute bottom-0 left-5 translate-y-1/2 h-10 w-10 rounded-xl bg-zinc-600 border-2 border-zinc-800 flex items-center justify-center">
            <span className="text-white/60 font-black text-sm">B</span>
          </div>
        </div>
        <div className="pt-8 px-5 pb-5">
          <p className="text-white font-bold text-sm mb-0.5">Bellavita Szalon</p>
          <p className="text-white/30 text-xs mb-4">bookly.hu/bellavita</p>
          <div className="space-y-2">
            {[{ n: 'Hajvágás', m: '45p · 6 000 Ft' }, { n: 'Balayage', m: '120p · 18 000 Ft' }, { n: 'Manikűr', m: '60p · 8 000 Ft' }].map(s => (
              <div key={s.n} className="flex items-center justify-between bg-zinc-700 rounded-xl px-3 py-2.5">
                <span className="text-white/80 text-xs font-medium">{s.n}</span>
                <span className="text-white/30 text-xs">{s.m}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 h-8 bg-white/[0.08] rounded-full flex items-center justify-center">
            <span className="text-white/40 text-xs">Időpontot foglalok →</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificationGraphic() {
  return (
    <div className="w-full max-w-xs space-y-2.5">
      {[
        { title: 'Új foglalás érkezett', body: 'Kovács Éva — Hajvágás, 14:30', time: 'most', op: 1 },
        { title: 'Visszaigazolás elküldve', body: 'Az ügyfél megkapta az emailt', time: '2 perce', op: 0.65 },
        { title: 'Emlékeztető holnapra', body: 'Nagy Petra, 10:00 — Balayage', time: '1 órája', op: 0.35 },
      ].map(n => (
        <div key={n.title} style={{ opacity: n.op }}
          className="bg-zinc-800 rounded-2xl px-4 py-3 flex items-start gap-3">
          <div className="h-2 w-2 rounded-full bg-white/60 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-white text-xs font-semibold">{n.title}</p>
              <span className="text-white/25 text-[10px] shrink-0 ml-2">{n.time}</span>
            </div>
            <p className="text-white/40 text-xs">{n.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatsGraphic() {
  const bars = [38, 55, 42, 68, 50, 80, 62, 90, 74, 58, 85, 72]
  return (
    <div className="w-full max-w-xs">
      <div className="bg-zinc-800 rounded-2xl p-5">
        <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Havi bevétel</p>
        <p className="text-white font-black text-3xl tracking-tight mb-0.5">148 600 <span className="text-lg text-white/30 font-normal">Ft</span></p>
        <p className="text-white/30 text-xs mb-5">↑ 18% az előző hónaphoz képest</p>
        <div className="flex items-end gap-1 h-16">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: `rgba(255,255,255,${0.06 + (h / 100) * 0.18})` }} />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-white/20 text-[9px]">máj.</span>
          <span className="text-white/20 text-[9px]">most</span>
        </div>
      </div>
    </div>
  )
}

function StaffGraphic() {
  const staff = [
    { name: 'Petra N.', subs: 'Fodrász', days: [1,1,1,1,1,0,0] },
    { name: 'Zsuzsa K.', subs: 'Kozmetikus', days: [0,1,1,1,1,1,0] },
    { name: 'Réka V.', subs: 'Manikűrös', days: [1,1,0,1,1,0,0] },
  ]
  const dayLabels = ['H','K','Sz','Cs','P','Szo','V']
  return (
    <div className="w-full max-w-xs space-y-2">
      {staff.map(s => (
        <div key={s.name} className="bg-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
            <span className="text-white/50 text-xs font-bold">{s.name.split(' ').map(w => w[0]).join('')}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{s.name}</p>
            <p className="text-white/30 text-[10px]">{s.subs}</p>
          </div>
          <div className="flex gap-0.5">
            {s.days.map((on, i) => (
              <div key={i} className={cn('h-5 w-5 rounded flex items-center justify-center text-[8px] font-bold',
                on ? 'bg-white/15 text-white/60' : 'bg-transparent text-white/15'
              )}>{dayLabels[i]}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const featuresData = [
  { n: '01', title: 'Saját foglalási oldal', desc: 'Személyre szabott URL — Instagram, névjegy, Google. Ügyfeleid 0–24-ben foglalnak.', Graphic: BookingGraphic },
  { n: '02', title: 'Azonnali értesítések', desc: 'Minden foglalásnál automatikus email — neked és az ügyfélnek.', Graphic: NotificationGraphic },
  { n: '03', title: 'Bevétel & statisztikák', desc: 'Napi, heti, havi áttekintés. Trend és csapat bontás.', Graphic: StatsGraphic },
  { n: '04', title: 'Teljes dashboard', desc: 'Munkatársak, nyitvatartás, foglalások — egy helyen, mobilon is.', Graphic: DashboardFrame },
  { n: '05', title: 'Munkatárs kezelés', desc: 'Több kolléga, saját naptár és elérhetőség. Minden automatikus.', Graphic: StaffGraphic },
]

function FeaturesSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const N = featuresData.length

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      const scrolledIn = -top
      const scrollable = el.offsetHeight - window.innerHeight
      if (scrolledIn <= 0) { setActiveIndex(0); return }
      if (scrolledIn >= scrollable) { setActiveIndex(N - 1); return }
      setActiveIndex(Math.min(Math.floor((scrolledIn / scrollable) * N), N - 1))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [N])

  return (
    <div ref={containerRef} style={{ height: `${(N + 1) * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-zinc-950">
        <div className="absolute inset-3 lg:inset-6">
          {featuresData.map(({ n, title, desc, Graphic }, i) => {
            const dist = activeIndex - i
            const isVisible = i <= activeIndex
            return (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-3xl bg-zinc-900 overflow-hidden border border-white/[0.05]"
                style={{ zIndex: i + 1 }}
                animate={{
                  y: isVisible ? -(dist * 18) : 1100,
                  scale: isVisible ? Math.max(1 - dist * 0.04, 0.84) : 1,
                  opacity: isVisible ? Math.max(1 - Math.max(dist - 1, 0) * 0.35, 0.3) : 1,
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 32 }}
              >
                <div className="h-full flex flex-col lg:flex-row">
                  <div className="lg:w-[42%] flex flex-col justify-center px-8 py-10 lg:px-14 shrink-0 relative">
                    <div className="absolute top-0 bottom-0 right-0 w-px bg-white/[0.06] hidden lg:block" />
                    <span className="text-white/15 text-[10px] font-mono uppercase tracking-[0.2em] mb-6">{n} / {String(N).padStart(2, '0')}</span>
                    <h3 className="text-white font-black text-3xl lg:text-4xl xl:text-[2.8rem] tracking-tight leading-[1.05] mb-5">{title}</h3>
                    <p className="text-white/50 text-sm lg:text-base leading-relaxed max-w-xs">{desc}</p>
                  </div>
                  <div className="flex-1 bg-zinc-950/80 relative flex items-center justify-center p-6 lg:p-12 overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(0,153,255,0.05) 0%, transparent 70%)' }} />
                    <div className="relative z-10">
                      <Graphic />
                    </div>
                  </div>
                </div>
                {i === 0 && activeIndex === 0 && (
                  <motion.div
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 0.6 }}
                  >
                    <span className="text-white/20 text-[10px] uppercase tracking-[0.2em] font-semibold">Görgess</span>
                    <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}>
                      <svg className="h-4 w-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Side progress dots */}
        <div className="absolute right-5 lg:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
          {featuresData.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full bg-white"
              animate={{
                height: i === activeIndex ? 24 : 6,
                width: 3,
                opacity: i === activeIndex ? 0.7 : i < activeIndex ? 0.2 : 0.08,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CountUp({ to, suffix = '', prefix = '', duration = 1500 }: {
  to: number; suffix?: string; prefix?: string; duration?: number
}) {
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
  const fmt = count >= 1000
    ? count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    : count.toString()
  return <span ref={ref}>{prefix}{fmt}{suffix}</span>
}

const faqItems = [
  { q: 'Mennyibe kerül a Bookly?', a: '7 napig teljesen ingyenes, kártya nélkül. Utána 2 900 Ft/hó. Lemondható bármikor, visszamenőleges számlázás nélkül.' },
  { q: 'Kell bankkártyaadatokat megadni a próbaidőhöz?', a: 'Nem. A 7 napos próbaidőhöz csak egy email cím és jelszó szükséges. Kártyaadatokat csak akkor kérünk, ha az ingyenes időszak után is folytatnád.' },
  { q: 'Mennyi ideig tart beállítani?', a: 'Az első szalon profil — névvel, szolgáltatásokkal és nyitvatartással — kb. 5 perc alatt elkészíthető. Utána máris megosztható a foglalási link.' },
  { q: 'Hány munkatársat és szolgáltatást adhatok hozzá?', a: 'Korlátlan számút. Minden munkatársnak saját elérhetőség naptárt állíthatsz be, és minden szolgáltatáshoz külön árat és időtartamot rendelhetsz.' },
  { q: 'Kapnak visszaigazolást az ügyfeleim?', a: 'Igen. Minden foglalásnál automatikusan küldünk visszaigazoló emailt az ügyfélnek a foglalás részleteivel.' },
  { q: 'Mobilon is működik?', a: 'Igen. Mind a szalontulajdonos dashboard, mind az ügyfelek foglalóoldala teljesen mobilbarát — külön alkalmazás nem szükséges.' },
  { q: 'Mi van az adataimmal, ha lemondok?', a: 'Az összes adatod megmarad egészen a lemondás hatályba lépéséig. Kérésre exportálhatod, vagy töröljük a fiókot.' },
]

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      {faqItems.map(({ q, a }, i) => (
        <FadeUp key={i} delay={i * 0.04}>
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="font-semibold text-sm text-zinc-800">{q}</span>
              <motion.div
                animate={{ rotate: open === i ? 45 : 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 text-zinc-400" />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-5 border-t border-zinc-100">
                    <p className="text-zinc-500 text-sm leading-relaxed pt-4">{a}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeUp>
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F2F2F0] text-zinc-900">

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="relative z-50 bg-[#F2F2F0] border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-16 h-16 flex items-center justify-between">
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
            className="relative inline-block w-fit font-black text-xl tracking-tight text-zinc-900 leading-none">
            Bookly
            <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="absolute -bottom-3 right-0 translate-x-1/2 text-[9px] text-zinc-400 font-normal leading-none whitespace-nowrap hover:text-zinc-600 transition-colors">by [davelopment]®</a>
          </motion.span>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-4">
            <Link href="/bookly/login" className="text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors hidden sm:block">
              Bejelentkezés
            </Link>
            <Link href="/bookly/register"
              className="h-9 px-5 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors">
              Kipróbálom <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 pt-20 lg:pt-28 pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-zinc-500 border border-zinc-300 bg-white mb-8"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#00bb88]" />
              7 nap ingyenes · 2 900 Ft/hó
            </motion.div>

            <div>
              {['ONLINE', 'IDŐPONT', 'FOGLALÓ.'].map((word, i) => (
                <motion.p key={word}
                  className="font-black text-[3rem] sm:text-[4.5rem] lg:text-[5.5rem] uppercase leading-[0.92] tracking-tighter text-zinc-900"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word}
                </motion.p>
              ))}
            </div>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="text-zinc-500 text-base max-w-sm mt-7 mb-9 leading-relaxed">
              Fodrászoknak, kozmetikusoknak, masszőröknek. Egy link — és máris foglalnak.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.68 }}
              className="flex flex-col sm:flex-row gap-3">
              <Link href="/bookly/register">
                <button className="h-12 px-7 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors w-full sm:w-auto">
                  Próbáld ki ingyen <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link href="/bookly/davelopment">
                <button className="h-12 px-7 rounded-full bg-white border border-zinc-200 hover:border-zinc-400 text-zinc-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors w-full sm:w-auto">
                  Demo megtekintése
                </button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center lg:justify-end relative"
          >
            <div className="absolute -inset-20 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,153,255,0.1) 0%, transparent 70%)' }} />
            <PhoneMockup />
          </motion.div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────── */}
      <section className="border-y border-zinc-200 bg-white px-6 lg:px-16 py-10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 lg:divide-x lg:divide-zinc-100">
          {[
            { value: '500+', label: 'aktív szalon' },
            { value: '10 000+', label: 'foglalás havonta' },
            { value: '< 5 perc', label: 'beállítási idő' },
            { value: '98%', label: 'elégedett ügyfél' },
          ].map(({ value, label }, i) => (
            <FadeUp key={label} delay={i * 0.07}>
              <div className="lg:px-8 text-center lg:text-left">
                <p className="text-zinc-900 font-black text-3xl tracking-tighter">{value}</p>
                <p className="text-zinc-400 text-sm mt-1">{label}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── VIDEO SHOWCASE ──────────────────────────────────────── */}
      <section className="border-t border-zinc-200 bg-zinc-900 px-6 lg:px-16 py-20 lg:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-10">
            <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">Demo</p>
            <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-white">
              LÁSD MŰKÖDÉS<br />KÖZBEN.
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="relative rounded-2xl overflow-hidden aspect-video border border-white/[0.08]">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                <source src="/videos/product-demo.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent 65%, rgba(0,0,0,0.55) 100%)' }} />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <div>
                  <p className="text-white font-bold text-base">Bookly Dashboard</p>
                  <p className="text-white/50 text-sm">Foglalások, bevétel, munkatársak — egy helyen</p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <div className="bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 lg:px-16 pt-24 lg:pt-32 pb-10">
          <FadeUp>
            <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">Funkciók</p>
            <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-white">
              MINDEN AMIRE<br />SZÜKSÉGED VAN.
            </h2>
          </FadeUp>
        </div>
        <FeaturesSection />
      </div>

      {/* ── TEXT REVEAL ─────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 bg-white px-6 lg:px-16 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <TextReveal
            text="AZ EGYSZERŰ IDŐPONTFOGLALÁS AMIRE RÉGÓTA VÁRTÁL."
            className="font-black text-3xl sm:text-4xl lg:text-6xl uppercase leading-tight tracking-tighter text-zinc-900"
          />
        </div>
      </section>

      {/* ── DASHBOARD SHOWCASE ──────────────────────────────────── */}
      <section className="border-t border-zinc-200 px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <FadeUp>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Dashboard</p>
              <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] mb-6 text-zinc-900">
                MINDEN EGY<br />HELYEN.
              </h2>
              <p className="text-zinc-500 text-base leading-relaxed mb-8 max-w-sm">
                Valós idejű foglalások, bevétel áttekintés, munkatárs kezelés — mobilon és desktopon.
              </p>
              <Link href="/bookly/register">
                <button className="h-11 px-7 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors">
                  Kipróbálom ingyen <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Link>
            </FadeUp>
            <SlideIn from="right">
              <DashboardFrame />
            </SlideIn>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <div className="bg-[#F2F2F0] border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-16 pt-24 lg:pt-32 pb-10">
          <FadeUp>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Hogyan működik</p>
            <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-zinc-900">
              3 LÉPÉS,<br />ENNYI AZ EGÉSZ.
            </h2>
          </FadeUp>
        </div>
        <StepsSection />
      </div>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-12">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Árazás</p>
            <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-zinc-900">
              EGYSZERŰ,<br />TISZTA ÁRAZÁS.
            </h2>
          </FadeUp>
          <FadeUp delay={0.15}>
            <div className="border border-zinc-200 rounded-2xl overflow-hidden max-w-3xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="bg-zinc-900 p-8 lg:p-10 flex flex-col justify-between">
                  <div>
                    <p className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-5">Havi díj</p>
                    <p className="text-white font-black text-6xl lg:text-7xl tracking-tighter leading-none mb-1">2 900</p>
                    <p className="text-white/40 text-base mb-2">Ft / hó</p>
                    <p className="text-[#00bb88] text-sm font-semibold mb-10">7 napig ingyenes · kártya nem szükséges</p>
                  </div>
                  <Link href="/bookly/register" className="block">
                    <button className="w-full h-12 rounded-full bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                      Kipróbálom ingyen <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
                <div className="bg-white p-8 lg:p-10">
                  <p className="text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-5">Tartalmaz</p>
                  <ul className="space-y-3.5">
                    {['Korlátlan foglalás', 'Saját foglalási oldal (URL)', 'Email értesítések', 'Munkatárs kezelés', 'Bevétel és statisztikák', 'Mobilbarát dashboard', 'Lemondható bármikor'].map(item => (
                      <li key={item} className="flex items-center gap-3 text-sm text-zinc-600">
                        <CheckCircle className="h-4 w-4 text-[#00bb88] shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 bg-white px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="mb-12">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Visszajelzések</p>
            <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-zinc-900">
              MIT MONDANAK<br />A SZALONOK.
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {[
              { quote: 'Mióta bevezettük, feleannyi telefonhívást kapok. Az ügyfelek maguk foglalnak, én csak megerősítem.', name: 'Kovács Veronika', role: 'Hajstúdió, Budapest', from: 'left' as const },
              { quote: 'Egyszerűbb mint gondoltam. 10 perc alatt be volt állítva és már másnap foglaltak rajta.', name: 'Nagy Eszter', role: 'Kozmetikus, Győr', from: 'left' as const },
              { quote: 'A statisztikák megmutatják melyik nap a legerősebb. Teljesen átalakítottam a nyitvatartásomat.', name: 'Horváth Péter', role: 'Barbershop, Pécs', from: 'right' as const },
            ].map(({ quote, name, role, from }, i) => (
              <SlideIn key={name} from={from} delay={i * 0.1} className="h-full">
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 h-full flex flex-col relative overflow-hidden">
                  <div className="absolute top-2 right-4 text-zinc-100 font-black text-8xl leading-none select-none pointer-events-none">"</div>
                  <div className="flex gap-0.5 mb-4 relative">
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-zinc-600 text-sm leading-relaxed flex-1 mb-5 relative">{quote}</p>
                  <div className="relative">
                    <p className="text-zinc-800 font-semibold text-sm">{name}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">{role}</p>
                  </div>
                </div>
              </SlideIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 bg-[#F2F2F0] px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-3xl mx-auto">
          <FadeUp className="mb-12">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Kérdések</p>
            <h2 className="font-black text-3xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-zinc-900">
              GYAKRAN<br />KÉRDEZIK.
            </h2>
          </FadeUp>
          <FaqAccordion />
        </div>
      </section>

      {/* ── CTA + FOOTER ────────────────────────────────────────── */}
      <div className="bg-zinc-900 relative px-6 lg:px-16">
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 100% 55% at 50% 55%, rgba(0,153,255,0.11) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto text-center relative py-28 lg:py-40">
          <FadeUp>
            <h2 className="font-black text-5xl lg:text-8xl uppercase tracking-tighter leading-[0.88] mb-8 text-white">
              KEZDD EL MA.<br />7 NAPIG<br />INGYEN.
            </h2>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p className="text-white/40 text-sm mb-8">Próbáld ki kártya nélkül. Utána csak 2 900 Ft/hó. Lemondható bármikor.</p>
            <Link href="/bookly/register">
              <button className="h-12 px-8 rounded-full bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-base inline-flex items-center gap-2 transition-colors">
                Regisztráció <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </FadeUp>
        </div>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.06] py-8 relative">
          <span className="relative inline-block w-fit font-black text-lg tracking-tight text-white leading-none">
            Bookly
            <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="absolute -bottom-3 right-0 translate-x-1/2 text-[9px] text-white/30 font-normal leading-none whitespace-nowrap hover:text-white/60 transition-colors">by [davelopment]®</a>
          </span>
          <p className="text-white/30 text-xs">© 2026 Bookly · hello@bookly.hu</p>
          <Link href="/bookly/login" className="text-white/30 hover:text-white text-sm transition-colors">Bejelentkezés</Link>
        </div>
      </div>

    </main>
  )
}
