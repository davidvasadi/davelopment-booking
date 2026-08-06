'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useInView, LayoutGroup } from 'framer-motion'
import {
  CalendarDays, Bell, CalendarOff, Wallet,
  CalendarClock, Smartphone, MapPin, Users, BarChart3, Clock,
} from 'lucide-react'
import { EASE, SPRING_SNAPPY, SPRING_QUICK, buttonHover } from '@/lib/motion'

// ─── Szalon — valós képek ─────────────────────────────────────────────────────

const SW = '/landing/howitworks/szakemberek'

// Figma 227:2456 — cycling: naptár (portrait) / grafikon / módosítás (mindkettő landscape)
// FLIP layoutId animáció: transform alatt fut, nincs width/top/left közvetlen animáció
const CARD_SRCS = [
  `${SW}/naptar-davelopment-booking.png`,
  `${SW}/grafikon-davelopment-booking.png`,
  `${SW}/naptar-modositas-davelopment-booking.png`,
]

function StackedCards() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % 3), 2800)
    return () => clearInterval(id)
  }, [])

  const spring = { type: 'spring', stiffness: 200, damping: 32 } as const

  return (
    <div
      className="relative rounded-[20px] h-[360px]"
      style={{ background: '#f7f7f7' }}
    >
      {CARD_SRCS.map((src, i) => {
        const role = (3 + i - active) % 3 // 0=center 1=top 2=bottom

        return (
          <motion.div
            key={i}
            layout
            className="absolute bg-white overflow-hidden"
            style={role === 0 ? {
              inset: 0,
              margin: 'auto',
              width: '60%',
              maxWidth: 220,
              height: 'fit-content',
              zIndex: 10,
            } : role === 1 ? {
              top: 24, left: '34%', right: '34%', zIndex: 1,
            } : {
              bottom: 24, left: '34%', right: '34%', zIndex: 2,
            }}
            animate={{
              opacity: role === 0 ? 1 : 0.75,
              borderRadius: role === 0 ? 16 : 14,
              boxShadow: role === 0
                ? '0 8px 30px rgba(0,0,0,.14)'
                : '0 2px 10px rgba(0,0,0,.07)',
            }}
            initial={false}
            transition={spring}
          >
            <img src={src} className="w-full block" alt="" />
          </motion.div>
        )
      })}
    </div>
  )
}

function SalonLayout() {
  const c1 = useCard()
  const c2 = useCard()
  const c3 = useCard()
  const c4 = useCard()
  const c5 = useCard()

  return (
    <div className="flex flex-col gap-4">

      {/* Sor 1: Foglalások — telefon bal, szöveg jobb */}
      <motion.div
        ref={c1.ref} variants={cardV} initial="hidden" animate={c1.animate}
        className="bg-white rounded-[13px] overflow-hidden flex flex-col-reverse lg:flex-row min-h-[360px]"
      >
        <motion.div variants={imgV} className="lg:w-[46%] p-4">
          <div className="relative bg-[#f7f7f7] rounded-[13px] overflow-hidden w-full h-[360px] lg:h-full">
            <img
              src={`${SW}/szakember-foglalasok-davelopment-booking.jpg`}
              alt="Szakember-foglalások"
              className="absolute inset-y-0 left-1/2 -translate-x-1/2 h-full w-auto"
            />
          </div>
        </motion.div>
        <div className="flex-1 flex items-center p-7 lg:p-10">
          <RestoText
            Icon={CalendarDays}
            title="Szakember-naptársávok, ütközés nélkül"
            body="Minden szakembernek saját sáv egy képernyőn — húzd át a foglalást másik időpontra, ütközésnél azonnal jelez a rendszer. Kattints egy szabad sávra, és a foglalás azonnal létrejön."
          />
        </div>
      </motion.div>

      {/* Sor 2: Szabadnap (stacked animáció) + Értesítések */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          ref={c2.ref} variants={cardV} initial="hidden" animate={c2.animate}
          className="bg-white rounded-[13px] p-5 flex flex-col-reverse lg:flex-col gap-6"
        >
          <motion.div variants={imgV}>
            <StackedCards />
          </motion.div>
          <RestoText
            Icon={CalendarOff}
            title="Szabadnap & kivételes nap"
            body="Az alap nyitvatartást egyszer állítod be a szalonnak. Minden szakember a saját naptárában jelöl szabadnapot vagy eltérő beosztást — a foglalási oldal ezt személyre szabottan veszi figyelembe."
          />
        </motion.div>

        <motion.div
          ref={c3.ref} variants={cardV} initial="hidden" animate={c3.animate}
          className="bg-white rounded-[13px] p-5 flex flex-col-reverse lg:flex-col gap-6"
        >
          <motion.div variants={imgV} className="relative bg-[#f7f7f7] rounded-[20px] overflow-hidden h-[360px]">
            <img
              src={`${SW}/eretesitesek-szakemberek-davelopment-booking.jpg`}
              alt="Értesítések"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          </motion.div>
          <RestoText
            Icon={Bell}
            title="Azonnali értesítések"
            body="Új foglalás, lemondás, módosítás — push értesítés azonnal az eszközre és emailben. Te és a csapatod sosem marad le semmiről."
          />
        </motion.div>
      </div>

      {/* Sor 3: PWA — kép bal, szöveg jobb */}
      <motion.div
        ref={c4.ref} variants={cardV} initial="hidden" animate={c4.animate}
        className="bg-white rounded-[13px] overflow-hidden flex flex-col lg:flex-row min-h-[300px]"
      >
        <motion.div variants={imgV} className="lg:w-[46%] p-4 flex items-stretch min-h-[260px]">
          <img
            src={`${HW}/webalkalmazas-ikon-davelopment-booking.jpg`}
            alt="Webalkalmazás"
            className="w-full object-cover rounded-[13px]"
          />
        </motion.div>
        <div className="flex-1 flex items-center p-7 lg:p-10">
          <RestoText
            Icon={Smartphone}
            title="Használd webalkalmazásként"
            body="Mentsd a foglaló oldalt a kezdőképernyőre — telepítés nélkül, úgy viselkedik mint egy applikáció. Push értesítések, offline vázlat mód, azonnali betöltés."
          />
        </div>
      </motion.div>

      {/* Sor 4: Áttekintés — teljes szélességű */}
      <motion.div
        ref={c5.ref} variants={cardV} initial="hidden" animate={c5.animate}
        className="bg-white rounded-[13px] overflow-hidden flex flex-col lg:flex-row min-h-[300px]"
      >
        <div className="flex-1 flex items-center p-7 lg:p-10">
          <RestoText
            Icon={BarChart3}
            title="Mindent egy helyen"
            body="Foglalások, csapatbeosztás, szakember-naptárak, vendégek, bevétel — egy képernyőn. Nem kell váltogatni, nem kell exportálni."
          >
            <div className="flex flex-col gap-2 mt-1">
              {[
                { label: 'Szakember-beosztás & szabadnapok valós időben', icon: Users },
                { label: 'Foglalás-forrás bontás (online / telefon / beeső)', icon: Clock },
                { label: 'Borravaló & bér automatikus összesítés', icon: Wallet },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="h-5 w-5 shrink-0 rounded-[6px] flex items-center justify-center" style={{ background: '#FFD85F' }}>
                    <Icon className="text-brand-ink" style={{ width: 11, height: 11 }} strokeWidth={2} />
                  </span>
                  <span className="font-onest text-[13px] font-medium text-brand-ink/60">{label}</span>
                </div>
              ))}
            </div>
          </RestoText>
        </div>
        <motion.div variants={imgV} className="lg:w-[54%] min-h-[260px] p-4">
          <div className="rounded-[13px] overflow-hidden w-full h-full">
            <img
              src={`${HW}/attekintes-davelopment-booking.jpg`}
              alt="Áttekintés"
              className="w-full h-full object-cover object-center"
              style={{ transform: 'scale(1.14)', transformOrigin: 'center' }}
            />
          </div>
        </motion.div>
      </motion.div>

    </div>
  )
}

// ─── Étterem — valós képek a Figma layout szerint ────────────────────────────

const HW = '/landing/howitworks'

function RestoBadge({ Icon }: { Icon: React.ElementType }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-[14px] shrink-0 self-start"
      style={{ background: '#FFD85F', padding: 12 }}
    >
      <Icon className="text-brand-ink" style={{ width: 22, height: 22 }} strokeWidth={1.75} />
    </span>
  )
}

function RestoText({
  Icon,
  title,
  body,
  children,
}: {
  Icon: React.ElementType
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <RestoBadge Icon={Icon} />
      <div className="flex flex-col gap-3">
        <h3
          className="font-onest font-medium leading-[1.1] text-brand-ink"
          style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', letterSpacing: '-0.06em' }}
        >
          {title}
        </h3>
        <p className="font-onest font-medium text-base leading-relaxed text-brand-ink/60">
          {body}
        </p>
        {children}
      </div>
    </div>
  )
}

// Admin-stílusú loyalty pill sor (Törzs / Visszatérő / Új)
// visualPct = megjelenített szélesség (szöveg befér), pct = valódi adat a feliratban
const LOYALTY = [
  { label: 'Törzs',      pct: 2,  visualPct: 11, bg: '#1D1C19', fg: '#fff',    hatched: false },
  { label: 'Visszatérő', pct: 7,  visualPct: 18, bg: '#FFD85F', fg: '#1D1C19', hatched: false },
  { label: 'Új',         pct: 91, visualPct: 91, bg: '',        fg: '#57564f', hatched: true  },
]

const CHANNELS = [
  { label: 'Online foglalás', pct: 62, color: '#FFD85F' },
  { label: 'Telefonon',       pct: 24, color: '#1D1C19' },
  { label: 'Beeső vendég',    pct: 11, color: '#d6d3cc' },
  { label: 'No-show',         pct: 3,  color: '#eceae4' },
]

function ChannelChips() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })

  return (
    <div ref={ref} className="flex flex-col gap-2 mt-1">
      {LOYALTY.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2.5">
          <motion.div
            className="h-8 rounded-full flex items-center overflow-hidden shrink-0"
            style={{
              background: s.hatched
                ? 'repeating-linear-gradient(115deg,rgba(255,255,255,.55),rgba(255,255,255,.55) 7px,rgba(190,180,140,.22) 7px,rgba(190,180,140,.22) 14px), #f5f2ea'
                : s.bg,
              border: s.hatched ? '1px solid rgba(190,180,140,.35)' : undefined,
            }}
            initial={{ width: 0, opacity: 0 }}
            animate={inView ? { width: `${s.visualPct}%`, opacity: 1 } : { width: 0, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: i * 0.14 + 0.08 }}
          >
            <span
              className="font-onest font-semibold tabular-nums whitespace-nowrap"
              style={{ fontSize: 12, color: s.fg, paddingLeft: 10, paddingRight: 10 }}
            >
              {s.pct}%
            </span>
          </motion.div>
          <span className="font-onest text-[12px] font-medium text-brand-ink/45 shrink-0">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// Kétszintű animáció: kártya scale-el jön be, kép alulról ugrik fel
const cardV = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const imgV = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: EASE } },
} as const

function useCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.12 })
  return { ref, animate: inView ? 'show' : 'hidden' } as const
}

function RestaurantLayout() {
  const c1a = useCard()
  const c1b = useCard()
  const c2  = useCard()
  const c3  = useCard()
  const c4  = useCard()

  return (
    <div className="flex flex-col gap-4">

      {/* Sor 1: 2 telefon — értesítések + napi idővonal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          ref={c1a.ref} variants={cardV} initial="hidden" animate={c1a.animate}
          className="bg-white rounded-[13px] p-5 flex flex-col-reverse lg:flex-col gap-6 h-full"
        >
          <motion.div variants={imgV} className="relative bg-[#f7f7f7] rounded-[20px] overflow-hidden h-[360px]">
            <img
              src={`${HW}/ertesitesek-davelopment-booking.jpg`}
              alt="Értesítések"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          </motion.div>
          <RestoText
            Icon={Bell}
            title="Azonnali értesítések"
            body="Új foglalás, lemondás, módosítás — push értesítés azonnal az eszközre és emailben. Te és a csapatod sosem marad le semmiről."
          />
        </motion.div>

        <motion.div
          ref={c1b.ref} variants={cardV} initial="hidden" animate={c1b.animate}
          className="bg-white rounded-[13px] p-5 flex flex-col-reverse lg:flex-col gap-6 h-full"
        >
          <motion.div variants={imgV} className="relative bg-[#f7f7f7] rounded-[20px] overflow-hidden h-[360px]">
            <img
              src={`${HW}/foglalasok-davelopment-booking.jpg`}
              alt="Napi idővonal"
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{ transform: 'rotate(-6deg) scale(1.06)', transformOrigin: 'center' }}
            />
          </motion.div>
          <RestoText
            Icon={CalendarClock}
            title="Napi idővonal, termenként és asztalonként"
            body="Az aznapi foglalások időrendben, termenként és asztalonként csoportosítva. Húzd át másik asztalra, ütközésnél azonnal jelez."
          />
        </motion.div>
      </div>

      {/* Sor 2: PWA szöveg bal + kép jobb */}
      <motion.div
        ref={c2.ref} variants={cardV} initial="hidden" animate={c2.animate}
        className="bg-white rounded-[13px] overflow-hidden flex flex-col lg:flex-row min-h-[300px]"
      >
        <div className="flex-1 flex items-center p-7 lg:p-10">
          <RestoText
            Icon={Smartphone}
            title="Használd webalkalmazásként"
            body="Mentsd a foglaló oldalt a kezdőképernyőre — telepítés nélkül, úgy viselkedik mint egy applikáció. Push értesítések, offline vázlat mód, azonnali betöltés."
          />
        </div>
        <motion.div variants={imgV} className="lg:w-[46%] p-4 flex items-stretch min-h-[260px]">
          <img
            src={`${HW}/webalkalmazas-ikon-davelopment-booking.jpg`}
            alt="Webalkalmazás"
            className="w-full object-cover rounded-[13px]"
          />
        </motion.div>
      </motion.div>

      {/* Sor 3: Vendégek telefon bal + Foglalási arány jobb */}
      <motion.div
        ref={c3.ref} variants={cardV} initial="hidden" animate={c3.animate}
        className="bg-white rounded-[13px] overflow-hidden flex flex-col-reverse lg:flex-row min-h-[360px]"
      >
        <motion.div variants={imgV} className="lg:w-[46%] p-4">
          <div className="relative bg-[#f7f7f7] rounded-[13px] overflow-hidden w-full h-[360px] lg:h-full">
            <img
              src={`${HW}/vendegek-davelopment-booking.jpg`}
              alt="Vendégek"
              className="absolute inset-y-0 left-1/2 -translate-x-1/2 h-full w-auto"
            />
          </div>
        </motion.div>
        <div className="flex-1 flex items-center p-7 lg:p-10">
          <RestoText
            Icon={MapPin}
            title="Vendégek & foglalási arány"
            body="Honnan jönnek a vendégeid? Interaktív térkép mutatja városok szerint — törzs, belföldi, külföldi bontásban."
          >
            <ChannelChips />
          </RestoText>
        </div>
      </motion.div>

      {/* Sor 4: Áttekintés — teljes szélességű */}
      <motion.div
        ref={c4.ref} variants={cardV} initial="hidden" animate={c4.animate}
        className="bg-white rounded-[13px] overflow-hidden flex flex-col lg:flex-row min-h-[300px]"
      >
        <div className="flex-1 flex items-center p-7 lg:p-10">
          <RestoText
            Icon={BarChart3}
            title="Mindent egy helyen"
            body="Foglalások, csapatbeosztás, borravaló, vendégek, bevétel — egy képernyőn. Nem kell váltogatni, nem kell exportálni."
          >
            <div className="flex flex-col gap-2 mt-1">
              {[
                { label: 'Foglalás-forrás bontás (online / telefon / beeső)', icon: Users },
                { label: 'Csapatbeosztás & műszakok valós időben', icon: Clock },
                { label: 'Borravaló & bér automatikus összesítés', icon: Wallet },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="h-5 w-5 shrink-0 rounded-[6px] flex items-center justify-center" style={{ background: '#FFD85F' }}>
                    <Icon className="text-brand-ink" style={{ width: 11, height: 11 }} strokeWidth={2} />
                  </span>
                  <span className="font-onest text-[13px] font-medium text-brand-ink/60">{label}</span>
                </div>
              ))}
            </div>
          </RestoText>
        </div>
        <motion.div variants={imgV} className="lg:w-[54%] min-h-[260px] p-4">
          <div className="rounded-[13px] overflow-hidden w-full h-full">
            <img
              src={`${HW}/attekintes-davelopment-booking.jpg`}
              alt="Áttekintés"
              className="w-full h-full object-cover object-center"
              style={{ transform: 'scale(1.14)', transformOrigin: 'center' }}
            />
          </div>
        </motion.div>
      </motion.div>

    </div>
  )
}

// ─── Fő szekció ───────────────────────────────────────────────────────────────

export function SegmentToggle() {
  const [active, setActive] = useState<'salon' | 'restaurant'>('salon')

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={SPRING_QUICK}
        className="flex flex-col items-center gap-4 mb-12 text-center"
      >
        <h2 className="font-onest font-medium text-[clamp(2rem,5.5vw,3rem)] leading-[1.15] tracking-[-0.05em] text-brand-ink">
          Látod mi történik az üzletedben.
        </h2>
        <p className="font-onest text-[clamp(1rem,2vw,1.25rem)] tracking-[-0.05em] text-brand-ink/50">
          Tedd hatékonyabbá az üzleted
        </p>

        <div className="flex items-center gap-1 bg-white rounded-full p-2.5 mt-6">
          {(['salon', 'restaurant'] as const).map((seg) => {
            const label = seg === 'salon' ? 'Szakembereknek' : 'Éttermeknek'
            const isActive = active === seg
            return (
              <motion.button
                key={seg}
                onClick={() => setActive(seg)}
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                className="relative px-6 py-4 rounded-full text-[clamp(1rem,2vw,1.25rem)] font-onest font-light tracking-[-0.04em] transition-colors duration-200"
                style={{ color: isActive ? '#ffffff' : '#3B3B3B' }}
              >
                {isActive && (
                  <motion.span
                    layoutId="seg-pill"
                    className="absolute inset-0 rounded-full bg-brand-ink"
                    transition={SPRING_SNAPPY}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          {active === 'salon' ? <SalonLayout /> : <RestaurantLayout />}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
