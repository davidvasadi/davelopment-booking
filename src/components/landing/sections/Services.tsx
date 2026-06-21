'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarCheck, Bell, BarChart3, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeUp } from '@/components/landing/Motion'
import { LandingButton } from '@/components/landing/LandingButton'

/** A négy fő szolgáltatás — hover-re/kattintásra a jobb oldali „screenshot" vált. */
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

function ServiceScreenshotCard({ service }: { service: (typeof SERVICES)[number] }) {
  const Icon = service.icon
  return (
    <motion.div
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
        <h3 className="mt-5 text-xl font-black tracking-tight text-white">{service.title}</h3>
        <p className="mt-3 text-zinc-400 leading-relaxed text-sm">{service.body}</p>
        <p className="mt-6 text-xs text-zinc-600 font-medium uppercase tracking-wider">
          {service.screenshotLabel}
        </p>
        {/* Mini fake screenshot */}
        <div className="mt-3 rounded-xl bg-[#111] p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className={cn('h-8 rounded-md bg-[#1e1e1e]', i === 1 ? 'w-24' : 'w-16')} />
              <div className="h-8 rounded-md flex-1 bg-[#1e1e1e]" />
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
                active === i ? 'text-brand-ink' : 'text-zinc-300',
              )}
            >
              ({s.n})
            </span>
            <span
              className={cn(
                'text-2xl lg:text-3xl font-black tracking-tight transition-colors',
                active === i ? 'text-brand-ink' : 'text-zinc-300 group-hover:text-zinc-400',
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

export function Services() {
  return (
    <section id="szolgaltatasok" className="mx-auto px-6 lg:px-10 py-20 lg:py-28 border-t border-zinc-100">
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
  )
}
