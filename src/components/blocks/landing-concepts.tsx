'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { COVER_OFFSET, padRange } from '@/lib/scrollOffset'
import { Bell, CalendarDays, Plus, SlidersHorizontal, ArrowRight, BellRing, CalendarCheck, Check, Gift, Lock, Globe, Layers, PhoneOff, Repeat, Search, Users, Wallet } from 'lucide-react'
import { Avatar, Card, IconButton, IconCircle, Kpi, Meta, Pill, SegmentBar, Segmented, StatusPill } from '@/components/ui-kit'
import { BookingPagePreview } from './editor'
import { PendingApproval } from './booking'
import { DayShiftList, MonthHours } from './calendar'
import { RestPartyCard, StatHoursCard, StatNoShowCard, StatUtilCard, StatWeekCard } from './stats'
import { ArrivalsCard } from './guests'
import { VoucherCard, VoucherSalesCard } from './money'
import { DayTimelineShot, FeatureChapters, RevealText } from './landing-showcase'
import { sectionShot } from '@/components/landing/designVisuals'
import { GROUP_PARTS } from './covers'
import { FEATURE_GROUPS, featurePath, groupHref } from '@/lib/landingFeatures'
import { FitCard } from '@/components/landing/FitCard'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
import { notificationVisual } from '@/lib/useNotifications'
import type { Notification } from '@/payload/payload-types'
import { HeroNav } from '@/components/landing/sections/Hero'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { BrandLogo } from '@/components/BrandLogo'
import { Marquee as PhotoMarquee } from './landing-marquee'
import { GrainCanvas, DARK_SURFACE_BG } from '@/components/landing/GrainCanvas'
import { INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'
import { STEPS as HOW_STEPS } from './landing-howitworks'
import { BusinessTypeStep } from './onboarding'
import { MobileStaffList } from './team'
import { ShareChannels } from './overview'
import { TIPS as TIP_ARTICLES } from '@/lib/tips-content'

/*
 * Landing-koncepciók (design 22.20–22.22, terv) — ugyanaz a tartalom három stílusban:
 *  - Ours: a saját designunkra szabva (F7F7F7, fehér kártyák, ui-dark / ui-yellow, Onest light címek);
 *  - Light: világos, fotós, középre zárt, levegős (az appnext.framer.website hangulata);
 *  - Dark: fekete hero sárga kiemeléssel, krém szakaszok, bento (az optivio.framer.website hangulata).
 * Nem másolatok: a felépítés és a hangulat a minta, a tartalom, a képek és a kártyák a mieink. Csak design.
 */

type Rating = { rating: number; userRatingCount: number } | null | undefined
const fmtRating = (r: NonNullable<Rating>) => r.rating.toFixed(1).replace('.', ',')
const TAGS = Object.values(INDUSTRY_SHORT_LABEL).filter((t) => t !== 'Csapatkezelés')
const FACTS = [
  { icon: CalendarCheck, v: '24/7', l: 'online foglalás — akkor is, amikor dolgozol vagy zárva vagy' },
  { icon: Globe, v: '6 nyelv', l: 'a foglalóoldal és a vendég-levelek a vendég nyelvén' },
  { icon: Layers, v: '2 felület', l: 'időpont a szakembereknek, asztal az éttermeknek' },
  { icon: Users, v: '13 iparág', l: 'fodrásztól a fine diningig — saját oldallal' },
]
/** 2. koncepció: kulcsszavas funkció-kártyák (SEO: a keresett kifejezések H3-ban, belső linkkel a funkció-oldalra) */
const grp = (id: string) => { const g = FEATURE_GROUPS.find((x) => x.id === id); return g ? groupHref(g) : featurePath('/funkciok') }
const factsK2 = () => [
  { icon: CalendarCheck, v: 'Online időpontfoglalás', l: 'Saját foglalóoldal, ahol a vendég a nap 24 órájában időpontot foglal — fodrászatnak, szépségszalonnak, rendelőnek, stúdiónak.', href: grp('booking') },
  { icon: Layers, v: 'Online asztalfoglalás', l: 'Éttermeknek asztaltérképpel, létszámmal és alkalmakkal — azonnali visszaigazolással vagy kézi jóváhagyással.', href: '/etterem-asztalfoglalas' },
  { icon: Wallet, v: 'Előleg és no-show védelem', l: 'Előleg bekérése foglaláskor és automatikus emlékeztető — kevesebb elmaradt időpont, jutalék nélkül.', href: grp('money') },
  { icon: Gift, v: 'Számlázás és ajándékutalvány', l: 'Automatikus számla Számlázz.hu-val vagy Billingóval, és online eladható ajándékutalvány.', href: grp('money') },
]
const VALUES = [
  { icon: PhoneOff, t: 'Kevesebb telefon', d: 'A vendég magának foglal, módosít és lemond — te csak jóváhagyod, ha akarod.' },
  { icon: BellRing, t: 'Kevesebb elmaradás', d: 'Emlékeztető levél, előleg nagyobb társaságnál, várólista a felszabaduló helyekre.' },
  { icon: Repeat, t: 'Több visszatérő vendég', d: 'Vendégkártya, hírlevél és Google-értékelés kérés — magától, a foglalásokból.' },
]
const STEPS = [['01', 'Regisztrálsz', 'E-mail címmel, jelszó nélkül.'], ['02', 'Beállítod az oldalad', 'Szolgáltatások, munkatársak, nyitvatartás — élőben látod, mit lát a vendég.'], ['03', 'Megosztod a linket', 'Instagramon, Google-ben, a weboldaladon — és jönnek a foglalások.']] as const
/** a Pénz fül: a beérkezett fizetések sorai (a Számlák minta-adataival) */
const PAYMENTS: [string, string, string, 'ok' | 'neutral' | 'bad', string][] = [
  ['Juhász és Társa Bt.', 'Szolgáltatás · Balayage', '18 900 Ft', 'ok', 'Kiállítva'],
  ['Juhász Hanna', 'Előleg · Balayage + vágás', '10 000 Ft', 'ok', 'Kiállítva'],
  ['Papp Máté', 'Szolgáltatás · Átmenetes vágás', '8 900 Ft', 'neutral', 'Pénztárgépen'],
  ['Kovács Anna', 'Ajándékutalvány', '20 000 Ft', 'ok', 'Kiállítva'],
]
function PaymentRows({ n = 4 }: { n?: number }) {
  return <div className="mt-3 space-y-1.5">{PAYMENTS.slice(0, n).map(([who, what, amt, st, lbl]) => (
    <div key={who} className="flex items-center gap-3 rounded-ui-card bg-white px-4 py-3">
      <span className="min-w-0 flex-1"><span className="block truncate text-ui-body text-ui-text">{who}</span><span className="block truncate text-ui-meta text-ui-muted">{what}</span></span>
      <span className="text-right"><span className="block text-ui-body text-ui-text">{amt}</span><StatusPill status={st} className="mt-1">{lbl}</StatusPill></span>
    </div>
  ))}</div>
}
const TABS = [
  { label: 'Foglalás', t: 'A nap egy pillantással.', w: 'max-w-[380px]', v: <FitCard w={360}><DayTimelineShot className="bg-ui-cell" /></FitCard> },
  { label: 'Csapat', t: 'Műszak, szabadság, bér egy naptárban.', w: 'max-w-[380px]', v: <FitCard w={360}><MonthHours mobile className="bg-ui-cell" /></FitCard> },
  { label: 'Pénz', t: 'Előleg és utalvány, egyenesen a fiókodba.', w: 'max-w-[380px]', v: <FitCard w={360}>
    <Card tone="cell" className="w-[360px]"><VoucherSalesCard /><div className="mt-5 px-1 text-ui-title">Beérkezett fizetések</div><div className="px-1"><PaymentRows n={3} /></div></Card>
  </FitCard> },
]
const PHOTOS = ['/design/boritokep-szalon-ny.webp', '/design/munkatars-viktoria.webp', '/landing/tips/asztalfoglalas-online-etterem-davelopment-booking.jpg', '/landing/tips/elolegkeres-foglalaskor-davelopment-booking.jpg', '/landing/tips/ajandekutalvany-szepsegszalon-davelopment-booking.jpg', '/landing/tips/jogosultsagkezeles-csapat-davelopment-booking.jpg']
const rise = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 24 } } }
const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.25 } } as const
const stagger = (s = 0.08) => ({ show: { transition: { staggerChildren: s } } })

/** Végtelen szalag (iparágak) — a két szélen maszkkal elhalványul. */
function TagRail({ dark = false }: { dark?: boolean }) {
  const row = [...TAGS, ...TAGS]
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"> {/* ui-allow: maszk */}
      <motion.div className="flex w-max gap-2" animate={{ transform: ['translateX(0%)', 'translateX(-50%)'] }} transition={{ duration: 40, ease: 'linear', repeat: Infinity }}>
        {row.map((t, i) => <span key={i} className={`whitespace-nowrap rounded-ui-control px-5 py-3 text-ui-row ${dark ? 'bg-white/10 text-white' : 'bg-white text-ui-text'}`}>{t}</span>)}
      </motion.div>
    </div>
  )
}

/** Pill-fülek + a hozzá tartozó kártya középen. */
function TabStage({ dark = false }: { dark?: boolean }) {
  const [tab, setTab] = useState(0)
  return (
    <div className="flex flex-col items-center">
      <div className={`inline-flex items-center gap-1 rounded-full px-4 py-4 ${dark ? 'bg-ui-dark' : 'bg-white'}`}>
        {TABS.map((x, i) => (
          <button key={x.label} type="button" onClick={() => setTab(i)} className={`ui-press rounded-full px-5 py-2 text-ui-title outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${i === tab ? (dark ? 'bg-white/15 text-white' : 'bg-ui-dark text-white') : dark ? 'text-white/55 hover:text-white/80' : 'text-ui-muted'}`}>{x.label}</button>
        ))}
      </div>
      <motion.p key={`p${tab}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 text-ui-row text-ui-muted">{TABS[tab].t}</motion.p>
      <motion.div key={tab} initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }} className={`mt-8 w-full text-left ${TABS[tab].w}`}>{TABS[tab].v}</motion.div>
    </div>
  )
}

/** Koncepció 2 szakaszfeje: (opcionális) pill-címke, alatta a középre zárt cím, alatta (opcionális) bevezető. */
export function SectionHead({ pill, title, lead, dark = false, className = '' }: { pill?: string; title: string; lead?: string; dark?: boolean; className?: string }) {
  return (
    <motion.div {...inView} variants={stagger(0.08)} className={`mx-auto max-w-[760px] px-4 text-center ${className}`}>
      {pill && <motion.div variants={rise}><span className={`inline-flex items-center rounded-[8px] px-3.5 py-1.5 text-[14px] font-medium ${dark ? 'bg-white/10 text-white/80' : 'bg-ui-yellow/15 text-ui-text/80'}`}>{pill}</span></motion.div>} {/* ui-allow: a CtaGlow „Kezdd el ma” pillje (8 / 14 px) */}
      <motion.h2 variants={rise} className={`${pill ? 'mt-5' : ''} text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.08] tracking-[-0.035em]`}>{title}</motion.h2> {/* ui-allow: szakaszcím */}
      {lead && <motion.p variants={rise} className={`mx-auto mt-4 max-w-[560px] text-ui-row ${dark ? 'text-white/60' : 'text-ui-muted'}`}>{lead}</motion.p>}
    </motion.div>
  )
}

/** Óriás, halvány felirat a lap alján (lábléc-zárás). */
function GiantWord({ text = 'Foglalás, egyszerűen.', dark = false }: { text?: string; dark?: boolean }) {
  // eredeti betűarányokkal (nem nyújtva), a kijelzőnél kicsit szélesebbre méretezve: a két vége és az alja levágódik
  return (
    <div aria-hidden className={`select-none overflow-hidden ${dark ? 'text-white/10' : 'text-ui-dark/[0.07]'}`}>
      <div className="-mb-[5vw] -translate-x-[3vw] whitespace-nowrap text-center text-[23vw] font-extrabold leading-[0.9] tracking-[-0.06em]">{text}</div> {/* ui-allow: óriás lábléc-felirat */}
    </div>
  )
}

/** Hegyes csúcsú csillag (a lucide Star kerekített sarkú — értékelésnél élesebb, „Google-szerű” csillag kell). */
function SharpStar({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden className={className}><path fill="currentColor" d="M12 1.5l3.09 6.97 7.41.68-5.6 4.98 1.65 7.37L12 17.77l-6.55 3.73 1.65-7.37-5.6-4.98 7.41-.68z" /></svg>
}

/* ═════════════════════════════ 1. A MI DESIGNUNK ═════════════════════════════ */

const H2 = 'text-[clamp(2rem,4vw,56px)] font-light leading-[1.02] tracking-[-0.04em]' // ui-allow: landing szakaszcím
const EYEBROW = 'inline-flex items-center gap-2 rounded-[8px] bg-white px-3 py-1.5 text-[14px] font-medium text-ui-text' // ui-allow: landing szakasz-címke (8 / 14 px)

export function ConceptOurs({ rating, trialDays = 14, tail }: { rating?: Rating; trialDays?: number; /** vélemények, árak, GYIK (a design oldal adja a valós adatokkal) */ tail?: React.ReactNode }) {
  return (
    <div className="bg-ui-cell font-onest text-ui-text">
      {/* hero: világos, nagy vékony cím, értékelés, gomb — alatta ráúszik a szerkesztő, két lebegő kártyával */}
      <section className="px-4 pb-6 pt-20 text-center">
        <motion.div initial="hidden" animate="show" variants={stagger()}>
          <motion.div variants={rise} className="flex justify-center"><Pill tone="white" className="gap-2">{rating ? <><SharpStar className="h-3.5 w-3.5 text-ui-yellow" />{fmtRating(rating)} · {rating.userRatingCount} Google-értékelés</> : 'Szakembereknek és szolgáltató vállalkozásoknak'}</Pill></motion.div>
          <motion.h1 variants={rise} className="mx-auto mt-6 max-w-[1000px] text-[clamp(2.75rem,7vw,104px)] font-light leading-[0.95] tracking-[-0.05em]">Foglalás. Csapat.<br /><span className="text-ui-muted">Vendégek. Egy helyen.</span></motion.h1> {/* ui-allow: hero H1 */}
          <motion.p variants={rise} className="mx-auto mt-6 max-w-[560px] text-ui-row text-ui-muted">Online foglalás, beosztás, előleg és hírlevél — szalonnak és étteremnek is, a te arculatoddal.</motion.p>
          <motion.div variants={rise} className="mt-8 flex justify-center"><HeroButton href="/register" label={`Próbáld ki ${trialDays} napig ingyen`} /></motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ type: 'spring', stiffness: 110, damping: 20 }} className="relative mx-auto mt-14 max-w-[1100px] text-left">
          <BookingPagePreview />
          <motion.div className="absolute -left-[5%] bottom-[10%] hidden w-[24%] -rotate-3 lg:block" initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.3 }}><FitCard w={360}><DayTimelineShot /></FitCard></motion.div>
          <motion.div className="absolute -right-[5%] top-[16%] hidden w-[30%] rotate-2 lg:block" initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.45 }}><FitCard w={380}><PendingApproval className="w-full shadow-ui-float" /></FitCard></motion.div>
        </motion.div>
      </section>
      <section className="py-10"><TagRail /></section>
      {/* kigyulladó bekezdés */}
      <section className="mx-auto max-w-[1000px] px-4 py-20"><RevealText covers={false} text="Foglalás, naptár, vendégek, pénz, marketing és csapat — egy helyen, egy appban, a te arculatoddal. Te dolgozol, a rendszer pedig közben felveszi a foglalásokat." className={`${H2}`} /></section>
      {/* számok + előnyök bento */}
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-5">
        <span className={EYEBROW}>Számokban</span>
        <h2 className={`mt-5 max-w-[720px] ${H2}`}>Egy rendszer, ami helyetted is dolgozik.</h2>
        <motion.div {...inView} variants={stagger()} className="mt-10 grid gap-[5px] sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(({ icon, v, l }) => <motion.div key={v} variants={rise}><Card tone="white" className="h-full"><IconCircle icon={icon} tone="cell" size="md" /><div className="mt-10 text-ui-page font-light leading-none">{v}</div><p className="mt-3 text-ui-body text-ui-muted">{l}</p></Card></motion.div>)}
        </motion.div>
        <motion.div {...inView} variants={stagger(0.1)} className="mt-[5px] grid gap-[5px] lg:grid-cols-3">
          {VALUES.map(({ icon, t, d }, i) => <motion.div key={t} variants={rise}><Card tone={i === 1 ? 'dark' : 'white'} className="h-full"><IconCircle icon={icon} tone={i === 1 ? 'yellow' : 'cell'} size="lg" /><div className={`mt-10 text-ui-sub font-light ${i === 1 ? 'text-white' : ''}`}>{t}</div><p className={`mt-2 text-ui-body ${i === 1 ? 'text-white/60' : 'text-ui-muted'}`}>{d}</p></Card></motion.div>)}
        </motion.div>
      </section>
      <section className="mx-auto max-w-7xl px-4 lg:px-5"><FeatureChapters /></section>
      {/* fülek: a három fő terület mobil nézete */}
      <section className="px-4 py-20 text-center"><span className={EYEBROW}>Zsebben is</span><h2 className={`mx-auto mt-5 max-w-[720px] ${H2}`}>Telefonon ugyanúgy.</h2><div className="mt-10"><TabStage /></div></section>
      {/* 3 lépés */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-5">
        <span className={EYEBROW}>Hogyan indulsz</span>
        <h2 className={`mt-5 max-w-[640px] ${H2}`}>Ma beállítod, holnap foglalnak.</h2>
        <motion.div {...inView} variants={stagger(0.12)} className="mt-10 grid gap-[5px] lg:grid-cols-3">
          {STEPS.map(([n, t, d]) => <motion.div key={n} variants={rise}><Card tone="white" className="h-full"><div className="text-ui-page font-light leading-none text-ui-muted">{n}</div><div className="mt-10 text-ui-sub font-light">{t}</div><p className="mt-2 text-ui-body text-ui-muted">{d}</p></Card></motion.div>)}
        </motion.div>
      </section>
      {tail}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-5">
        <div className="relative overflow-hidden rounded-ui-container px-6 py-24 text-center text-white" style={{ background: DARK_SURFACE_BG }}>
          <GrainCanvas strength="light" opacity={0.8} zIndex={0} />
          <div className="relative">
            <h2 className="mx-auto max-w-[820px] text-[clamp(2.25rem,5vw,72px)] font-light leading-none tracking-[-0.045em]">Foglalások, <span className="text-ui-yellow">káosz nélkül.</span></h2> {/* ui-allow: záró CTA cím */}
            <p className="mx-auto mt-5 max-w-[480px] text-ui-row text-white/60">{trialDays} nap ingyen. Beállítod ma, holnap már foglalnak.</p>
            <div className="mt-8 flex justify-center"><HeroButton href="/register" label="Kezdjük el" light /></div>
          </div>
        </div>
      </section>
      <GiantWord />
    </div>
  )
}

/* ═════════════════════════════ 2. VILÁGOS, FOTÓS (appnext hangulat) ═════════════════════════════ */

export function ConceptLight({ rating, trialDays = 14, tail, footer }: { rating?: Rating; trialDays?: number; tail?: React.ReactNode; /** a lábléc (alapból a koncepció saját világos lábléce; a főoldalon egyelőre a régi) */ footer?: React.ReactNode }) {
  const chips = [['Új foglalás', 'Kiss Réka · ma 14:30'], ['Emlékeztető kiküldve', '12 vendégnek · holnapra'], ['Előleg beérkezett', '10 000 Ft · Juhász Hanna']]
  return (
    <div className="bg-white font-onest text-ui-text">
      {/* a hero ragadós, a bemutatkozó rész lekerekített lapként ráhúzódik (Dave választása, 2026-11-10) */}
      <ConceptLightHero trialDays={trialDays} />
      {/* a hero lemarad (parallax), ez a fehér réteg egyenes éllel rácsúszik */}
      <div className="relative z-10 bg-white">
      {/* bemutatkozó bekezdés: elöl a logó, görgetésre szavanként „kigyullad” (az appnext mintájára, keskenyebb hasábban) */}
      <section className="mx-auto max-w-[720px] px-4 pb-6 pt-28">
        <RevealText covers={false}
          lead={<a href="/register" aria-label="davelopment booking — regisztráció" className="relative -top-[0.12em] mr-1 inline-block align-middle transition-opacity hover:opacity-70"><BrandLogo variant="light" className="h-[1.55em] w-auto" alt="davelopment booking" /></a>}
          textClass="text-[clamp(1.4rem,2.3vw,32px)] font-medium leading-[1.42] tracking-[-0.025em] text-ui-text" /* ui-allow: bemutatkozó bekezdés */
          text="online időpontfoglaló és asztalfoglaló rendszer szakembereknek és vendéglátóknak. A vendég a nap 24 órájában foglal a saját foglalóoldaladon, automatikus visszaigazolást és emlékeztetőt kap, előleget fizet, a számla pedig magától elkészül. A csapat beosztása, a vendégek és a bevétel egy helyen — jutalék nélkül." />
      </section>
      {/* az iparág-képes szalag (ugyanaz, mint a főoldalon): rámutatva felemelkedik, kiíródik az iparág */}
      <PhotoMarquee laurel={['Szakembereknek', 'és vendéglátóknak']} />
      </div>
      <HandBubbles />
      <DailyOps rating={rating} />
      {/* a fülek (Foglalás / Csapat / Pénz) a mobil nézettel — fehér háttéren */}
      <section className="bg-white px-4 py-24 text-center"><SectionHead pill="App" title="Minden fontos, egy érintésre." className="mb-12" /><TabStage dark /></section>
      <IndustryStack />
      {/* számok ikon-kártyákkal */}
      <section className="bg-ui-cell px-4 py-24">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {factsK2().map(({ icon, v, l, href }) => <a key={v} href={href} className="group rounded-ui-card bg-white p-6 transition-transform hover:-translate-y-1"><IconCircle icon={icon} tone="cell" size="md" /><h3 className="mt-16 text-ui-title font-medium">{v}</h3><p className="mt-2 text-ui-meta text-ui-muted">{l}</p></a>)}
        </div>
      </section>
      <PhotoBand pin rating={rating} card="center" src="/landing/hero/pilates-studio-online-foglalas-davelopment-booking.webp" alt="Napfényes pilates- és jógastúdió — órák online foglalása a davelopment bookinggal"
        title="Az órák maguktól megtelnek" text="A vendégek online foglalnak helyet az órákra, emlékeztetőt kapnak — te csak megtartod az órát." cta="Nézd meg, hogyan" ctaHref="/pilates-idopontfoglalas"
        widgets={[
          { pos: 'right-[6%] top-[10%] w-[min(190px,14vw)]', w: 280, el: <StatUtilCard className="bg-white" /> },
          { pos: 'left-[5%] bottom-[9%] w-[min(260px,19vw)]', w: 380, el: <StatHoursCard animate /> },
        ]} />
      {/* flow-root: a lábléc alsó margója ne „csússzon ki” a rétegből (különben alatta kilátszana a ragadós pilates-kép) */}
      <div className="relative z-10 flow-root bg-white">
      {tail}
      {/* záró: a mostani színezett (festett hátterű) CTA — minden oldalon a saját szövegével */}
      <CtaGlow trial_days={trialDays} button="dark" label="Kezdd el ma" title="Foglalások, káosz nélkül." bg="/landing/cta/cta-hatter-davelopment-booking.webp" lead={`${trialDays} napig ingyen próbálhatod — ma beállítod, holnap már foglalnak.`} />
      {footer ?? <ConceptLightFooter trialDays={trialDays} />}
      </div>
    </div>
  )
}

/* ═════════════════════════════ 3. SÖTÉT + KRÉM (optivio hangulat) ═════════════════════════════ */

const CREAM = 'bg-[#F6F4EA]' // ui-allow: krém szakasz-háttér (a koncepció saját színe)
const CHIP = 'inline-flex rounded-[6px] bg-ui-yellow/30 px-2.5 py-1 text-ui-label text-ui-text' // ui-allow: halványsárga címke-chip

export function ConceptDark({ rating, trialDays = 14, tail }: { rating?: Rating; trialDays?: number; tail?: React.ReactNode }) {
  return (
    <div className="bg-white p-2 font-onest text-ui-text">
      {/* hero: fekete, szemcsés, sárga kiemelt szó, mező sárga kerek gombbal */}
      <section className="relative overflow-hidden rounded-ui-container px-4 pb-28 pt-24 text-center text-white" style={{ background: DARK_SURFACE_BG }}>
        <GrainCanvas strength="medium" opacity={0.9} zIndex={0} />
        <div className="relative">
          <div className="text-ui-meta text-white/60">Szakembereknek és szolgáltató vállalkozásoknak</div>
          {/* csak valós Google-adattal (kitalált értékelés nincs) */}
          {rating && <div className="mt-1 flex items-center justify-center gap-1 text-ui-yellow">{[0, 1, 2, 3, 4].map((i) => <SharpStar key={i} className="h-3.5 w-3.5" />)}<span className="ml-1 text-ui-meta text-white">{fmtRating(rating)} · {rating.userRatingCount} Google-értékelés</span></div>}
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-[860px] text-[clamp(2.5rem,5.5vw,76px)] font-light leading-[1.02] tracking-[-0.045em]">Töltsd meg a <span className="text-ui-yellow">naptárad</span> — magától.</motion.h1> {/* ui-allow: hero H1 */}
          <p className="mx-auto mt-5 max-w-[520px] text-ui-row text-white/60">Online foglalás, emlékeztető és előleg: a vendég akkor is foglal, amikor te dolgozol.</p>
          <div className="mx-auto mt-8 flex max-w-[460px] items-center gap-2 rounded-full bg-white/10 p-1.5 pl-5 backdrop-blur">
            <Search className="h-4 w-4 text-white/50" /><span className="flex-1 text-left text-ui-body text-white/50">Mi a szakmád? (pl. fodrász)</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ui-yellow text-ui-dark"><ArrowRight className="h-4 w-4" /></span>
          </div>
          <p className="mt-4 text-ui-label text-white/50">{trialDays} nap ingyen próbálhatod.</p>
        </div>
      </section>
      <div className="relative -mt-14 px-4"><div className="mx-auto max-w-6xl rounded-ui-container bg-ui-dark py-4"><TagRail dark /></div></div>
      {/* bento: számok sötét kör-ikonokkal, középen fotó */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <span className={CHIP}>Számokban</span>
        <h2 className="mt-4 max-w-[560px] text-[clamp(2rem,3.4vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">Egy rendszer, ami helyetted is dolgozik.</h2> {/* ui-allow */}
        <motion.div {...inView} variants={stagger()} className="mt-10 grid gap-3 lg:grid-cols-3">
          {FACTS.slice(0, 2).map(({ icon, v, l }) => <motion.div key={v} variants={rise} className={`rounded-ui-card ${CREAM} p-6`}><IconCircle icon={icon} tone="dark" size="lg" /><div className="mt-12 text-ui-num font-light leading-none">{v}</div><p className="mt-2 text-ui-body text-ui-muted">{l}</p></motion.div>)}
          <motion.div variants={rise} className="row-span-2 overflow-hidden rounded-ui-card"><img src={PHOTOS[1]} alt="" className="h-full min-h-[300px] w-full object-cover" /></motion.div> {/* eslint-disable-line @next/next/no-img-element */}
          {FACTS.slice(2).map(({ icon, v, l }) => <motion.div key={v} variants={rise} className={`rounded-ui-card ${CREAM} p-6`}><IconCircle icon={icon} tone="dark" size="lg" /><div className="mt-12 text-ui-num font-light leading-none">{v}</div><p className="mt-2 text-ui-body text-ui-muted">{l}</p></motion.div>)}
        </motion.div>
      </section>
      {/* krém szakasz: funkció-bento — a hat csoport kártyája, mindegyikben a csoport fő kit-kártyája (két széles, négy keskeny) */}
      <section className={`rounded-ui-container ${CREAM} px-4 py-20`}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div><span className={CHIP}>Funkciók</span><h2 className="mt-4 max-w-[640px] text-[clamp(2rem,3.4vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">Minden, ami a foglaláshoz kell, egy rendszerben.</h2></div> {/* ui-allow */}
            <HeroButton href={featurePath('/funkciok')} label="Összes funkció" />
          </div>
          <motion.div {...inView} variants={stagger(0.08)} className="mt-10 grid gap-3 lg:grid-cols-3">
            {FEATURE_GROUPS.filter((g) => GROUP_PARTS[g.id]).map((g, i) => {
              const wide = i === 0 || i === 3 || i === 4
              const Icon = g.icon
              return (
                <motion.a key={g.id} href={groupHref(g)} variants={rise} className={`group flex flex-col overflow-hidden rounded-ui-container bg-white ${wide ? 'lg:col-span-2' : ''}`}>
                  <div className="p-7">
                    <span className="inline-flex items-center gap-2 text-ui-meta text-ui-muted"><IconCircle icon={Icon} tone="dark" size="sm" />{g.label}</span>
                    <h3 className="mt-4 max-w-[460px] text-ui-sub font-light leading-[1.15] text-ui-text">{g.cta?.title ?? g.h1}</h3>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-ui-body text-ui-text opacity-60 transition-opacity group-hover:opacity-100">Részletek<ArrowRight className="h-4 w-4" /></span>
                  </div>
                  {/* a csoport fő kártyája alul, a kártya aljáról kilógva (levágva), hoverre kicsit feljebb jön */}
                  <div className={`relative mt-auto overflow-hidden ${wide ? 'h-[300px]' : 'h-[260px]'}`}>
                    <div className={`absolute left-7 top-0 transition-transform duration-500 group-hover:-translate-y-3 ${wide ? 'w-[78%]' : 'w-[120%]'}`}><FitCard w={GROUP_PARTS[g.id].mainW ?? 520}>{GROUP_PARTS[g.id].main}</FitCard></div>
                  </div>
                </motion.a>
              )
            })}
          </motion.div>
        </div>
      </section>
      {/* 3 lépés: sorszám sötét körben, cím, szöveg — a második helyén fotó */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <span className={CHIP}>Indulás</span>
        <h2 className="mt-4 text-[clamp(2rem,3.4vw,44px)] font-light tracking-[-0.03em]">3 lépésben foglalható vagy.</h2> {/* ui-allow */}
        <motion.div {...inView} variants={stagger(0.1)} className="mt-10 grid gap-3 text-left lg:grid-cols-4">
          {[STEPS[0], null, STEPS[1], STEPS[2]].map((st, i) => st
            ? <motion.div key={st[0]} variants={rise} className={`flex min-h-[300px] flex-col justify-between rounded-ui-card ${CREAM} p-6`}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-ui-dark text-ui-body text-ui-yellow">{st[0]}</span><div><div className="text-ui-title text-ui-text">{st[1]}</div><p className="mt-2 text-ui-body text-ui-muted">{st[2]}</p></div></motion.div>
            : <motion.div key={i} variants={rise} className="overflow-hidden rounded-ui-card"><img src={PHOTOS[4]} alt="" className="h-full min-h-[300px] w-full object-cover" /></motion.div>)} {/* eslint-disable-line @next/next/no-img-element */}
        </motion.div>
      </section>
      {/* előnyök: fotó + pipás lista + gomb */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-24 lg:grid-cols-2">
        <img src={PHOTOS[2]} alt="" className="h-[420px] w-full rounded-ui-card object-cover" /> {/* eslint-disable-line @next/next/no-img-element */}
        <div>
          <h2 className="text-[clamp(2rem,3.4vw,44px)] font-light leading-[1.08] tracking-[-0.03em]">Legyen a foglalás a növekedés motorja, ne a telefon.</h2> {/* ui-allow */}
          <div className="mt-6"><HeroButton href={featurePath('/funkciok')} label="Nézd meg a funkciókat" /></div>
          <div className="mt-8 space-y-2.5">{VALUES.map(({ icon: I, t, d }) => <div key={t} className="flex items-start gap-3 text-ui-body text-ui-muted"><I className="mt-0.5 h-4 w-4 shrink-0 text-ui-text" /><span><span className="text-ui-text">{t}.</span> {d}</span></div>)}</div>
        </div>
      </section>
      <div className={`rounded-ui-container ${CREAM} py-6`}>{tail}</div>
      {/* záró: meleg sárga átmenet */}
      <section className="mt-2 rounded-ui-container px-4 py-28 text-center" style={{ background: 'radial-gradient(70% 90% at 50% 0%, #F7D96B 0%, #F6E6A6 35%, #F6F4EA 75%)' }}> {/* ui-allow: meleg sárga átmenet */}
        <span className={CHIP}>Kezdjük</span>
        <h2 className="mx-auto mt-4 max-w-[640px] text-[clamp(2.25rem,4.5vw,64px)] font-light leading-none tracking-[-0.045em]">Ne veszíts több foglalást a telefonnál.</h2> {/* ui-allow */}
        <p className="mx-auto mt-4 max-w-[440px] text-ui-row text-ui-muted">{trialDays} nap ingyen — ma beállítod, holnap foglalnak.</p>
        <div className="mt-8 flex justify-center"><HeroButton href="/register" label="Ingyenes kezdés" /></div>
      </section>
      <div className="mt-2 overflow-hidden rounded-ui-container bg-ui-dark pt-16"><GiantWord dark /></div>
    </div>
  )
}


/* ═════════════════════════════ 3/b. FUNKCIÓ-ALOLDAL (sötét + krém + sárga) ═════════════════════════════ */

/** Egy funkció-csoport aloldala (/funkciok/<slug>) a 3. koncepció stílusában — a tartalom a landingFeatures-ből, ugyanaz,
 *  ami élőben (H1, lead, funkciók, bevezető, kinek, lépések, eddig vs. most, GYIK, kapcsolódók). */
export function ConceptDarkFeature({ slug = 'foglalas', trialDays = 14 }: { slug?: string; trialDays?: number }) {
  const g = FEATURE_GROUPS.find((x) => x.slug === slug) ?? FEATURE_GROUPS[0]
  const x = g.extra
  const Icon = g.icon
  const H2 = 'text-[clamp(2rem,3.4vw,44px)] font-light leading-[1.08] tracking-[-0.03em]' // ui-allow: szakaszcím
  return (
    <div className="bg-white p-2 font-onest text-ui-text">
      {/* hero: sötét, szemcsés — címke, H1, lead, két gomb */}
      <section className="relative overflow-hidden rounded-ui-container px-4 pb-28 pt-20 text-center text-white" style={{ background: DARK_SURFACE_BG }}>
        <GrainCanvas strength="medium" opacity={0.9} zIndex={0} />
        <div className="relative">
          <div className="flex items-center justify-center gap-1.5 text-ui-meta text-white/60"><span>Funkciók</span><span>/</span><span className="text-white">{g.label}</span></div>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-ui-body"><Icon className="h-4 w-4 text-ui-yellow" />{g.label}</span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-[900px] text-[clamp(2.5rem,5vw,72px)] font-light leading-[1.02] tracking-[-0.045em]">{g.h1}</motion.h1> {/* ui-allow: hero H1 */}
          <p className="mx-auto mt-5 max-w-[560px] text-ui-row text-white/60">{g.lead}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2"><HeroButton href="/register" label={`Próbáld ki ${trialDays} napig ingyen`} light /></div>
        </div>
      </section>
      {/* a csoport funkciói futó szalagon (ugrás a szakaszokra) */}
      <div className="relative -mt-12 px-4"><div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2 rounded-ui-container bg-ui-dark p-4">{g.items.map((f) => { const I = f.icon; return <span key={f.slug} className="flex items-center gap-2 rounded-ui-control bg-white/10 px-4 py-2.5 text-ui-body text-white"><I className="h-4 w-4 text-ui-yellow" />{f.title}</span> })}</div></div>
      {/* bevezető: miért fontos */}
      {x && (
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-24 lg:grid-cols-[1fr_1.2fr]">
          <div><span className={CHIP}>Miért fontos</span><h2 className={`mt-4 ${H2}`}>{x.intro.title}</h2></div>
          <div className="space-y-4 text-ui-row leading-[1.6] text-ui-muted">{x.intro.paragraphs.map((p) => <p key={p}>{p}</p>)}</div>
        </section>
      )}
      {/* funkciók: krém szakaszban, mindegyik saját kártyán — szöveg + a funkció kit-kártyája; váltakozó oldalon */}
      <section className={`rounded-ui-container ${CREAM} px-4 py-20`}>
        <div className="mx-auto max-w-6xl">
          <span className={CHIP}>Funkciók</span>
          <h2 className={`mt-4 max-w-[640px] ${H2}`}>{g.tagline}</h2>
          <div className="mt-10 space-y-3">
            {g.items.map((f, i) => {
              const I = f.icon
              const shot = sectionShot(f.slug)
              return (
                <motion.div key={f.slug} {...inView} variants={rise} className={`grid items-center gap-8 overflow-hidden rounded-ui-container bg-white p-8 lg:grid-cols-2 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                  <div>
                    <span className="inline-flex items-center gap-2 text-ui-meta text-ui-muted"><IconCircle icon={I} tone="dark" size="sm" />{f.title}</span>
                    <h3 className="mt-4 text-ui-sub font-light leading-[1.15] text-ui-text">{f.desc}</h3>
                    <p className="mt-3 text-ui-body text-ui-muted">{f.pain}</p>
                    <div className="mt-5 space-y-2">{f.points.map((pt) => <div key={pt} className="flex items-start gap-2.5 text-ui-body text-ui-text"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ui-yellow"><Check className="h-3 w-3" /></span>{pt}</div>)}</div>
                    {f.example && <p className={`mt-5 rounded-ui-inner ${CREAM} p-4 text-ui-meta text-ui-muted`}>Példa: {f.example}</p>}
                  </div>
                  <div className={`flex min-h-[280px] items-center justify-center rounded-ui-card ${CREAM} p-6`}>{shot && <div className="w-full max-w-[460px]"><FitCard w={460}>{shot}</FitCard></div>}</div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>
      {x && <>
        {/* kinek: két szemszög */}
        <section className="mx-auto max-w-6xl px-4 py-24">
          <span className={CHIP}>Kinek szól</span>
          <h2 className={`mt-4 ${H2}`}>Szakembernek és étteremnek is.</h2>
          <div className="mt-10 grid gap-3 lg:grid-cols-2">
            <div className="rounded-ui-container bg-ui-dark p-8 text-white"><Pill tone="yellow" size="sm">Szakembereknek</Pill><p className="mt-6 text-ui-row leading-[1.6] text-white/75">{x.audience.salon}</p></div>
            <div className={`rounded-ui-container ${CREAM} p-8`}><Pill tone="dark" size="sm">Éttermeknek</Pill><p className="mt-6 text-ui-row leading-[1.6] text-ui-muted">{x.audience.restaurant}</p></div>
          </div>
        </section>
        {/* hogyan indul: lépések */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <span className={CHIP}>Hogyan indul</span>
          <motion.div {...inView} variants={stagger(0.1)} className="mt-6 grid gap-3 lg:grid-cols-3">
            {x.steps.map(([t, d], i) => <motion.div key={t} variants={rise} className={`flex min-h-[240px] flex-col justify-between rounded-ui-card ${CREAM} p-6`}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-ui-dark text-ui-body text-ui-yellow">0{i + 1}</span><div><div className="text-ui-title text-ui-text">{t}</div><p className="mt-2 text-ui-body text-ui-muted">{d}</p></div></motion.div>)}
          </motion.div>
        </section>
        {/* eddig vs. most */}
        <section className={`rounded-ui-container ${CREAM} px-4 py-20`}>
          <div className="mx-auto max-w-5xl">
            <span className={CHIP}>Eddig vs. most</span>
            <h2 className={`mt-4 ${H2}`}>Mi változik a {g.label.toLowerCase()} körül?</h2>
            <div className="mt-10 overflow-hidden rounded-ui-container bg-white">
              <div className="grid grid-cols-2 border-b border-ui-divider px-8 py-4 text-ui-meta text-ui-muted"><span>Eddig</span><span className="text-ui-text">A davelopment bookinggal</span></div>
              {x.compare.map(([a, b]) => <div key={a} className="grid grid-cols-2 gap-6 border-b border-dashed border-ui-divider px-8 py-5 text-ui-body last:border-0"><span className="text-ui-muted line-through decoration-ui-muted/40">{a}</span><span className="flex items-start gap-2 text-ui-text"><Check className="mt-0.5 h-4 w-4 shrink-0 text-ui-dark" />{b}</span></div>)}
            </div>
          </div>
        </section>
        {/* GYIK + CTA-kártya */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-24 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <span className={CHIP}>GYIK</span>
            <h2 className={`mt-4 ${H2}`}>Gyakran kérdezik.</h2>
            {g.faqCta && <div className="mt-8 rounded-ui-container bg-ui-dark p-7 text-white"><div className="text-ui-sub font-light">{g.faqCta.title}</div><p className="mt-3 text-ui-body text-white/60">{g.faqCta.body}</p><div className="mt-6"><HeroButton href="/register" label="Kipróbálom" light /></div></div>}
          </div>
          <div className="space-y-2">
            {x.faq.map((f, i) => (
              <div key={f.q} className={`rounded-ui-card p-6 ${i === 0 ? CREAM : 'bg-white ring-1 ring-ui-divider'}`}>
                <div className="flex items-start justify-between gap-4"><span className="text-ui-row text-ui-text">{f.q}</span><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ui-yellow text-ui-dark">{i === 0 ? '−' : '+'}</span></div>
                {i === 0 && <p className="mt-3 text-ui-body leading-[1.6] text-ui-muted">{f.a}</p>}
              </div>
            ))}
          </div>
        </section>
        {/* kapcsolódók: tippek és iparági oldalak (belső linkek) */}
        {x.related.length > 0 && <section className="mx-auto max-w-6xl px-4 pb-16"><div className="text-ui-meta text-ui-muted">Kapcsolódó</div><div className="mt-3 flex flex-wrap gap-2">{x.related.map((r) => <a key={r.href} href={r.href} className="rounded-full bg-ui-dark px-4 py-2 text-ui-body text-white">{r.label}</a>)}</div></section>}
      </>}
      {/* záró: meleg sárga átmenet, a csoport saját CTA-jával */}
      <section className="rounded-ui-container px-4 py-28 text-center" style={{ background: 'radial-gradient(70% 90% at 50% 0%, #F7D96B 0%, #F6E6A6 35%, #F6F4EA 75%)' }}> {/* ui-allow: meleg sárga átmenet */}
        <span className={CHIP}>{g.cta?.label ?? g.label}</span>
        <h2 className="mx-auto mt-4 max-w-[680px] text-[clamp(2.25rem,4.5vw,64px)] font-light leading-none tracking-[-0.045em]">{g.cta?.title ?? g.h1}</h2> {/* ui-allow */}
        <p className="mx-auto mt-4 max-w-[480px] text-ui-row text-ui-muted">{g.cta?.lead ?? g.lead}</p>
        <div className="mt-8 flex justify-center"><HeroButton href="/register" label="Ingyenes kezdés" /></div>
      </section>
      <div className="mt-2 overflow-hidden rounded-ui-container bg-ui-dark pt-16"><GiantWord dark /></div>
    </div>
  )
}

/** A hero értesítés-szalagja: a telefon mögül egymás után bukkannak fel a rendszer „élő” értesítései — mindegyik egy
 *  erős üzleti eredmény (foglalás, emlékeztető, előleg, utalvány, értékelés, várólista, számla, hírlevél). Kettő látszik
 *  egyszerre: a friss elöl, az előző mögötte halványabban; 2,8 mp-enként jön a következő. */
// pontosan az app értesítései (useNotifications → notificationVisual): ugyanaz a típus, ikon és szín, mint az
// értesítés-panelen — csak a minta-szöveg a mienk
const NOTIF_ROWS: { type: Notification['type']; meta?: Record<string, unknown>; t: string; d: string }[] = [
  { type: 'new_booking', t: 'Új foglalás', d: 'Kiss Réka · női hajvágás · ma 14:30' },
  { type: 'digest_morning', t: 'Reggeli összefoglaló', d: 'ma 14 foglalás · 164 e Ft várható bevétel' },
  { type: 'voucher_purchase', t: 'Ajándékutalvány vásárlás', d: '20 000 Ft · Lili részére' },
  { type: 'modification', t: 'Foglalás módosítva', d: 'Tóth Bence · 15:00 → 16:30' },
  { type: 'new_signup', t: 'Új vendég', d: 'Kovács Anna regisztrált a foglalóoldalon' },
  { type: 'schedule_change', meta: { event: 'created' }, t: 'Új műszak', d: 'Szabina · péntek 9–17' },
  { type: 'new_subscriber', t: 'Új hírlevél-feliratkozó', d: 'Gál Zsófia' },
  { type: 'digest_evening', t: 'Esti összefoglaló', d: 'holnap 12 foglalás · 2 jóváhagyásra vár' },
]
const NOTIFS = NOTIF_ROWS.map((r) => { const v = notificationVisual(r.type, r.meta); return { icon: v.Icon, t: r.t, d: r.d, c: `${v.bg} ${v.color}` } })
function NotifTicker() {
  // folyamatosan, magától forog (mint a fotó-szalag, csak függőlegesen): a lista kétszer egymás után, felfelé úszik;
  // alul a telefon és a homályos sáv mögül bukkannak elő, felül elhalványulnak
  const list = [...NOTIFS, ...NOTIFS]
  return (
    <div className="absolute inset-x-[2%] -top-[124px] z-0 h-[150px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_35%,#000)]" aria-hidden> {/* ui-allow: maszk */}
      <motion.div className="flex flex-col gap-2" animate={{ transform: ['translateY(0%)', 'translateY(-50%)'] }} transition={{ duration: NOTIFS.length * 3.2, ease: 'linear', repeat: Infinity }}>
        {list.map((n, k) => {
          const I = n.icon
          return (
            <div key={k} className="flex items-center gap-3 rounded-ui-inner bg-white px-4 py-3 text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,.25)]">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.c}`}><I className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block truncate text-ui-body text-ui-text">{n.t}</span><span className="block truncate text-ui-label text-ui-muted">{n.d}</span></span>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}

/* ═════════════════════════════ 2/a. HERO (a 2. koncepció — terv) ═════════════════════════════ */

/** A 2. koncepció hero-ja: a sziklás fekete-fehér háttér (felül világos ég, alul a hegygerinc), benne az aloldalak menüje,
 *  középen a háromrészes cím, egy sötét gomb, és a hegyek elől kiemelkedő telefon (Foglalások · nap-idővonal) két
 *  becsúszó értesítés-chippel. */
/** Visszagörgetéskor előjövő menü: lefelé görgetve rejtve, felfelé görgetve (a hero alatt) lecsúszik a képernyő tetejére —
 *  ugyanaz a középre összehúzott menü, fehér, finoman elmosott sávon. A hero tetején a saját (álló) menü látszik. */
function NavOnScrollUp() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const on = () => {
      const y = window.scrollY
      if (y < 400) setShow(false)
      else if (y < last - 4) setShow(true)
      else if (y > last + 4) setShow(false)
      last = y
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <div aria-hidden={!show} className={`fixed inset-x-0 top-0 z-[60] border-b border-ui-divider bg-white/85 px-4 py-2 backdrop-blur-xl transition-transform duration-300 ease-out lg:px-5 ${show ? 'translate-y-0' : 'pointer-events-none -translate-y-full'}`}>
      <div className="mx-auto max-w-[1040px]"><HeroNav theme="light" pillId="k2-nav-sticky" variant="plain" login={false} /></div>
    </div>
  )
}

// Görgetés-animáció hardveresen (framer natív ScrollTimeline/ViewTimeline): csak akkor kapcsol be, ha (1) az offset
// egy beépített minta (exit = 'start start'→'end start', cover = 'start end'→'end start'), (2) egyben `transform`/`opacity`
// értéket kap (nem külön y/scale), és (3) a target ref már megvan, amikor a mozgó elem csatlakozik — ezért a target egy
// ELŐTTE álló, a szakaszt kitöltő testvér-elem (a ref-ek gyerek→szülő sorrendben kötődnek, a szakasz ref-je még üres lenne);
// (4) a szakaszon overflow-CLIP legyen, ne overflow-hidden: a hidden görgető dobozzá teszi, és a natív idővonal azt
// figyelné (ami sosem görög) — a telefon nem mozdulna.
export function ConceptLightHero({ trialDays = 14 }: { trialDays?: number }) {
  // Hero-parallax (Framer-minta): a hero fél sebességgel görög (lefelé tolódik a hero-magasság feléig), így az utána
  // jövő fehér tartalom (relative z-10 bg-white) egyenes éllel rácsúszik. A telefon közben a képernyőn ugyanúgy
  // emelkedik, mint régen: a saját -42%-a mellett a hero lemaradását (min(50svh, 460px)) is visszaveszi.
  // A target a hero dobozával azonos, NEM mozgó réteg a hero előtt (a mozgó hero-n nem mérünk).
  const tl = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: tl, offset: ['start start', 'end start'] })
  const heroT = useTransform(scrollYProgress, [0, 1], ['translateY(0%)', 'translateY(50%)'])
  const phoneT = useTransform(scrollYProgress, [0, 1], ['translateY(calc(0% - min(0svh, 0px)))', 'translateY(calc(-42% - min(50svh, 460px)))'])
  // a menü, a cím és a gomb is visszaveszi a lemaradást (normál sebességgel görög) — csak a háttér (ég, hegyek) marad le,
  // így a telefon és a szöveg egymáshoz képest úgy mozog, mint parallax nélkül (nem csúszik rá a telefon a címre)
  const textT = useTransform(scrollYProgress, [0, 1], ['translateY(calc(0px - min(0svh, 0px)))', 'translateY(calc(0px - min(50svh, 460px)))'])
  return (
    <div className="relative">
    <div ref={tl} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[min(100svh,920px)] min-h-[560px]" />
    {/* a mozgó (transform-os) hero-n kívül: transform-os ősben a fixed nem a képernyőhöz igazodna */}
    <NavOnScrollUp />
    <motion.section style={{ transform: heroT }} className="relative z-0 isolate flex h-[min(100svh,920px)] min-h-[560px] flex-col overflow-clip bg-white font-onest text-ui-text will-change-transform">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/landing/hero/sziklas-hatter-davelopment-booking.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-bottom" />
      {/* a menü, ugyanaz, mint az aloldalakon */}
      {/* a menü középre összehúzva (nem a két szélen szétszórva) */}
      <motion.div style={{ transform: textT }} className="relative z-20 will-change-transform">
      <div className="px-4 py-2.5 lg:px-5"><div className="mx-auto max-w-[1040px]"><HeroNav theme="light" pillId="concept2-hero-nav" variant="plain" login={false} /></div></div>
      <div className="mx-auto mt-[clamp(0.5rem,4vh,4rem)] max-w-[900px] px-4 text-center">
        {/* belépő: CSS (ui-hero-rise), nem framer — így a JS betöltése előtt is megjelenik (gyors első kép, LCP) */}
        <h1 className="ui-hero-rise text-[clamp(2rem,min(5.4vw,7.6vh),76px)] font-medium leading-[1.02] tracking-[-0.045em]">Kezeld a naptárad.<br />Foglaljanak azonnal.<br /><span className="text-ui-muted">Építsd az üzleted.</span></h1> {/* ui-allow: hero H1 */}
        <div className="ui-hero-rise mt-[clamp(1rem,3.5vh,2rem)] flex justify-center" style={{ animationDelay: '.15s', ['--rise' as string]: '12px' }}>
          <HeroButton href="/register" label={`Próbáld ki ${trialDays} napig ingyen`} />
        </div>
      </div>
      </motion.div>
      {/* a telefon a hegyek elől emelkedik ki; fölötte, mögüle becsúszik két értesítés */}
      {/* a telefon a gomb ALATT, sima elrendezésben (nem az aljához rögzítve) — így semmilyen ablakmagasságnál nem csúszik a gombra; az alja kilóg, a szekció levágja */}
      <div className="relative z-10 flex min-h-0 flex-1 justify-center pt-[140px]">
        <div className="relative h-fit w-[min(320px,70vw)]">
          {/* az értesítés-szalag a helyén marad (nem parallax), csak a telefon jön fel */}
          <NotifTicker />
          <motion.div style={{ transform: phoneT }} className="relative will-change-transform">
          {/* homályos sáv csak a telefon tetején, az értesítések alján: innen bukkannak elő (a chipek fölött, a telefon alatt) */}
          <div className="pointer-events-none absolute -inset-x-[14%] top-0 z-[5] h-[50px] rounded-[50%] bg-white/60 blur-xl" />
          <img fetchPriority="high" style={{ animationDelay: '.25s', ['--rise' as string]: '80px' }}
            src="/landing/hero/foglalasok-idovonal-davelopment-booking.webp" alt="davelopment booking — a Foglalások nap-idővonala telefonon" className="ui-hero-rise relative z-10 w-full drop-shadow-[0_30px_60px_rgba(0,0,0,.35)]" /> {/* ui-allow: telefon-árnyék */}
        </motion.div></div>
      </div>
    </motion.section>
    </div>
  )
}

/* ═════════════════════════════ 2/b. KÉZ + BUBORÉKOK (a pillo „how it works” mintájára) ═════════════════════════════ */

/** Fehér háttéren a telefont tartó kéz (a Foglalások nap-idővonala), és görgetésre a telefonból három üveges „buborék”
 *  bomlik ki a kit kártyáival (létszám, utalvány-eladás, jóváhagyásra váró foglalás). A kéz alja fehérbe olvad. */
export function HandBubbles() {
  const ref = useRef<HTMLElement>(null)
  const tl = useRef<HTMLDivElement>(null)
  // 'cover' (COVER_OFFSET, natív): a régi 'start end → center center' a 0–0,5 szakasz, ezért a tartományok feleződtek
  const { scrollYProgress } = useScroll({ target: tl, offset: COVER_OFFSET })
  // a buborékok a telefon közepéből indulnak (kicsik, átlátszók), és egymás után a helyükre úsznak — egy transform +
  // opacity, hogy hardveresen fusson
  const bubble = (from: number, to: number, dx: string, dy: string) => ({
    opacity: useTransform(scrollYProgress, ...padRange([from, to], [0, 1])),
    transform: useTransform(scrollYProgress, ...padRange([from, to], [`translate(${dx}, ${dy}) scale(0.35)`, 'translate(0%, 0%) scale(1)'])),
  })
  const b1 = bubble(0.175, 0.325, '90%', '60%')
  const b2 = bubble(0.25, 0.4, '-90%', '20%')
  const b3 = bubble(0.31, 0.475, '-80%', '-60%')
  // a kártyák tartalma akkor animál be (görbe kirajzolódik, oszlopok felnőnek, sorok beúsznak), amikor a szakasz
  // a képernyőre ér — és újra, ha visszagörgetsz. React-renderelés NÉLKÜL: a szakasz data-anim attribútumát közvetlenül
  // a DOM-on váltjuk, a CSS (globals.css, [data-anim="off"]) addig kikapcsolja az animációkat, a visszakapcsolás
  // újraindítja őket. (A korábbi state/key-es megoldás görgetés közben újrarenderelt/újramountolt — az akasztott.)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { el.dataset.anim = e.isIntersecting ? 'on' : 'off' }, { threshold: 0.45 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // a cím (pillo-minta): a telefon mögül indul, és görgetésre gyorsabban jön fel, mint az oldal — közben halványból besötétedik
  // mobilon nincs „telefon mögül felbukkanó” cím (ott a kép kicsi, a cím rácsúszna) — csak desktopon (lg)
  const [desk, setDesk] = useState(false)
  useEffect(() => { const m = window.matchMedia('(min-width: 1024px)'); const f = () => setDesk(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  const titleOpacity = useTransform(scrollYProgress, ...padRange([0.25, 0.425], desk ? [0, 1] : [1, 1]))
  // y (40vh → 12vh, 0,1–0,425) és scale (0,9 → 1, 0,1–0,375) EGY transformban, hogy hardveresen fusson; a 0,375-ös
  // pont a y köztes értéke (16,3vh). A `desk` váltásakor a motion.div újracsatol (key), mert a natív animáció a
  // csatoláskor rögzül.
  const titleT = useTransform(scrollYProgress, ...padRange([0.1, 0.375, 0.425], desk
    ? ['translateY(40vh) scale(0.9)', 'translateY(16.3vh) scale(1)', 'translateY(12vh) scale(1)']
    : ['translateY(0vh) scale(1)', 'translateY(0vh) scale(1)', 'translateY(0vh) scale(1)']))
  const glass = 'rounded-ui-card shadow-[0_24px_60px_-24px_rgba(0,0,0,.35)] [&>*]:rounded-ui-card' // ui-allow: lebegő widget árnyéka
  return (
    <section ref={ref} data-anim="off" className="relative overflow-clip bg-white px-4 pb-10 pt-24 font-onest">
      <div ref={tl} aria-hidden className="pointer-events-none absolute inset-0" />
      <motion.div key={desk ? 'd' : 'm'} style={{ opacity: titleOpacity, transform: titleT }} className="relative z-0 mx-auto max-w-[640px] text-center">
        <h2 className="text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.05] tracking-[-0.035em] text-ui-text">Minden a zsebedben.</h2> {/* ui-allow: szakaszcím */}
        <p className="mt-4 text-ui-row text-ui-muted">Foglalás, bevétel és jóváhagyás egy appban — ott, ahol épp vagy.</p>
      </motion.div>
      <div className="relative z-10 mt-6 aspect-[2840/1894] w-[180%] max-w-none -translate-x-[22%] sm:w-[130%] sm:-translate-x-[11.5%] lg:mx-auto lg:w-auto lg:max-w-[1100px] lg:translate-x-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/hero/foglalasok-feature-davelopment-booking.webp" alt="davelopment booking a telefonon — a Foglalások nap-idővonala" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
        {/* a kéz alja fehérbe olvad, hogy ne látszódjon a levágás */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-white via-white/75 to-transparent" />
        {/* a három buborék (a telefonból bomlanak ki) */}
        <motion.div style={b1} className="absolute left-[22.5%] top-[28%] w-[22%] sm:left-[25%] sm:w-[17%] lg:left-[22%]"><div className={glass}><FitCard w={380}><RestPartyCard animate className="bg-white" /></FitCard></div></motion.div>
        <motion.div style={b2} className="absolute left-[53%] top-[25%] w-[25%] sm:left-[60%] sm:w-[19%] lg:left-[63%]"><div className={glass}><FitCard w={420}><VoucherSalesCard animate /></FitCard></div></motion.div>
        <motion.div style={b3} className="absolute left-[55.5%] top-[66%] w-[21%] sm:left-[61%] sm:w-[16%] lg:left-[63%]"><div className={glass}><FitCard w={380}><div className="ui-rise-kids"><PendingApproval className="w-full" /></div></FitCard></div></motion.div>
      </div>
    </section>
  )
}

/** Teljes szélességű fotó parallaxszal (a kép lassabban mozog, mint az oldal), rajta egy üveges kártya Google-csillagokkal
 *  és CTA-gombbal. `card="side"`: világos üveg a jobb oldali szabad falon (a New York-i stúdióhoz); `card="center"`: az
 *  appnext-féle sötét üveg középen, avatar-sorral (a pilates-képhez). Csak valós adat — kitalált vélemény nincs. */
function PhotoBand({ rating, src, alt, card, title, text, cta = 'Próbáld ki ingyen', ctaHref = '/register', align = 'object-center', widgets = [], pin = false }: {
  rating?: Rating; src: string; alt: string; card: 'side' | 'center'; title: string; text: string; cta?: string; ctaHref?: string; align?: string
  /** a fotón lebegő kit-kártyák: pozíció-osztály (absolute left/top + szélesség), a kártya természetes szélessége, maga a kártya */
  widgets?: { pos: string; w: number; el: React.ReactNode }[]
  /** appnext-féle ragadós sáv: felül megáll, a következő szakasz rácsúszik (a hívó a következő tartalmat relative z-10 + háttérrel adja) */
  pin?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const tl = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: tl, offset: COVER_OFFSET })
  const parT = useTransform(scrollYProgress, [0, 1], ['translateY(-12%)', 'translateY(12%)'])
  // a widgetek tartalma (oszlopok, gyűrű, sorok) akkor animál be, amikor a sáv a képre ér — és újra, ha visszagörgetsz
  const live = useInView(ref, { amount: 0.4 })
  // a kártya tartalma lépcsőzetesen éled meg: avatarok egyenként beugranak, a csillagok egymás után felvillannak,
  // aztán a cím, a szöveg és a gomb beúszik — a sáv minden belépésekor újra
  const pop = { hidden: { opacity: 0, scale: 0.4, rotate: -12 }, show: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 18 } } }
  const card$ = { initial: 'hidden', animate: live ? 'show' : 'hidden', variants: { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 160, damping: 20, staggerChildren: 0.1 } } } }
  const stars = (
    <motion.div variants={rise} className="flex items-center gap-2">
      <motion.span variants={stagger(0.07)} className="flex gap-0.5 text-ui-yellow">{[0, 1, 2, 3, 4].map((i) => <motion.span key={i} variants={pop}><SharpStar className="h-4 w-4" /></motion.span>)}</motion.span>
      {rating && <span className={`text-ui-meta ${card === 'center' ? 'text-white/75' : 'text-ui-muted'}`}>{fmtRating(rating)} · {rating.userRatingCount} Google-értékelés</span>}
    </motion.div>
  )
  return (
    <section ref={ref} data-anim={live ? 'on' : 'off'} className={pin ? 'sticky top-0 z-0 h-svh overflow-clip' : 'relative h-[clamp(560px,52vw,820px)] overflow-clip'}>
      {/* ragadós változat: felülről normálisan beúszik, a képernyő tetején megáll, és a következő szakasz csúszik rá */}
      <div ref={tl} aria-hidden className="pointer-events-none absolute inset-0" />
      <div className="contents">
      {pin ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${align}`} />
      ) : (
      <motion.div style={{ transform: parT }} className="absolute -inset-y-[14%] inset-x-0 will-change-transform">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-cover ${align}`} />
      </motion.div>
      )}
      {card === 'side' ? (
        <div className="absolute inset-y-0 right-4 flex items-center sm:right-[7%]">
        <motion.div {...card$}
          className="w-[300px] max-w-[calc(100vw-2rem)] rounded-ui-card bg-white/55 p-5 text-ui-text shadow-[0_24px_60px_-30px_rgba(0,0,0,.35)] backdrop-blur-xl"> {/* ui-allow: világos üveg-kártya */}
          {stars}
          <motion.div variants={rise} className="mt-3 text-ui-title font-medium">{title}</motion.div>
          <motion.p variants={rise} className="mt-2 text-ui-body text-ui-muted">{text}</motion.p>
          <motion.div variants={rise} className="mt-4"><HeroButton href={ctaHref} label={cta} /></motion.div>
        </motion.div>
        </div>
      ) : (
        <div className="absolute inset-x-0 top-[22%] flex justify-center px-4 lg:top-[26%]">
        <motion.div {...card$}
          className="flex w-[min(300px,100%)] flex-col rounded-ui-card bg-ui-dark/45 p-5 text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,.45)] backdrop-blur-2xl"> {/* ui-allow: sötét üveg-kártya */}
          <motion.div variants={stagger(0.09)} className="flex -space-x-2">{['viktoria', 'csaba', 'szabina'].map((a, i) => <motion.img variants={pop} key={a} src={`/landing/funkciok/csapat/avatar/${a}.webp`} alt="" className={`h-8 w-8 rounded-ui-control border-2 border-white object-cover ${i % 2 ? '-rotate-3' : 'rotate-3'}`} />)}<motion.span variants={pop} className="ml-1 h-5 w-5 self-center rounded-[6px] bg-white/25" /></motion.div> {/* eslint-disable-line @next/next/no-img-element */}
          <div className="mt-3">{stars}</div>
          <motion.div variants={rise} className="mt-2 text-ui-title font-medium">{title}</motion.div>
          <motion.p variants={rise} className="mt-2 text-ui-body text-white/85">{text}</motion.p>
          <motion.div variants={rise} className="mt-4"><HeroButton href={ctaHref} label={cta} light /></motion.div>
        </motion.div>
        </div>
      )}
      {/* lebegő widgetek: egymás után úsznak be, amikor a sáv a képre ér */}
      {widgets.map((g, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 40, scale: 0.92 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.4 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.15 + i * 0.15 }}
          className={`absolute hidden lg:block ${g.pos}`}>
          <div className="rounded-ui-card shadow-[0_24px_60px_-24px_rgba(0,0,0,.45)] [&>*]:rounded-ui-card"><FitCard w={g.w}><div className="ui-rise-kids">{g.el}</div></FitCard></div> {/* ui-allow: lebegő widget árnyéka */}
        </motion.div>
      ))}
      </div>
    </section>
  )
}

/* ═════════════════════════════ 2/d. IPARÁGAK KÁRTYA-PAKLIBAN (appnext „Built for studios” mintájára) ═════════════════════════════ */

const STACK: { slug: string; name: string; rot: number }[] = [
  { slug: 'fodrasz-idopontfoglalas', name: 'Fodrászoknak', rot: -3 },
  { slug: 'etterem-asztalfoglalas', name: 'Éttermeknek', rot: 4 },
  { slug: 'pilates-idopontfoglalas', name: 'Pilates stúdióknak', rot: -5 },
]
/** Ragadós szakasz: középen óriás, halvány cím, és görgetésre alulról egymás után beúsznak az iparágak fotói, kicsit
 *  elfordulva egymásra rakódnak (mint egy pakli). Minden kártya az iparági oldalára linkel. */
export function IndustryStack() {
  // 'start start → end end' = natív 'contain' sáv; a target a szakaszt kitöltő, a kártyák ELŐTT álló réteg
  const tl = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: tl, offset: ['start start', 'end end'] })
  // a cím görgetésre lefelé csúszik, és a kártyák mögé kerül
  const titleT = useTransform(scrollYProgress, [0, 1], ['translateY(0vh)', 'translateY(9vh)'])
  return (
    <section className="relative bg-white font-onest" style={{ height: `${STACK.length * 55 + 100}vh` }}>
      <div ref={tl} aria-hidden className="pointer-events-none absolute inset-0" />
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden">
        <motion.h2 style={{ transform: titleT }} className="absolute top-[22%] z-0 w-full px-4 text-center text-[clamp(2.5rem,6.5vw,104px)] font-medium leading-none tracking-[-0.05em] text-ui-dark/15">Minden szakmának</motion.h2> {/* ui-allow: óriás halvány cím */}
        <div className="relative z-10 mt-[12vh] aspect-square w-[min(300px,64vw)]">
          {STACK.map((it, i) => <StackCard key={it.slug} it={it} i={i} n={STACK.length} progress={scrollYProgress} />)}
        </div>
      </div>
    </section>
  )
}
function StackCard({ it, i, n, progress }: { it: (typeof STACK)[number]; i: number; n: number; progress: MotionValue<number> }) {
  // az első kártya már a helyén van; a többi a saját szeletében, közvetlenül a görgetést követve (késleltetés nélkül)
  // alulról beúszik és lerakódik a pakli tetejére
  // (egy transform-ban, hogy natívan fusson; az első kártya végig a helyén, annak nincs görgetés-animációja)
  const seg = 1 / n, start = Math.max(0, (i - 1) * seg), end = Math.max(seg, i * seg)
  const moving = useTransform(progress, ...padRange([start, end], [`translateY(105vh) rotate(${it.rot * 1.6}deg) scale(1.04)`, `translateY(0vh) rotate(${it.rot}deg) scale(1)`]))
  const transform = i === 0 ? `rotate(${it.rot}deg)` : moving
  return (
    <motion.a href={`/${it.slug}`} style={{ transform, zIndex: i + 1 }} className="group absolute inset-0 block will-change-transform overflow-hidden rounded-ui-inner shadow-[0_24px_60px_-28px_rgba(0,0,0,.4)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/landing/marquee/${it.slug}-davelopment-booking.webp`} alt={`${it.name.replace(/nak$|nek$/, '')} — online foglalás a davelopment bookinggal`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      <span className="absolute bottom-4 left-4 rounded-full bg-white/85 px-4 py-2 text-ui-body text-ui-text backdrop-blur">{it.name}</span>
    </motion.a>
  )
}

/* ═════════════════════════════ 2/e. FEKETE BLOKK (appnext „Everything your studio needs”) ═════════════════════════════ */

/** Fekete szakasz: középen fehér cím; balra nagy fotó-kártya, rajta világos üveges tény-kártya; jobbra 2×2 sötét csempe
 *  ikonnal és a funkció-csoport nevével — mindegyik a csoport oldalára linkel (belső link, SEO). */
export function DarkFeatureBlock() {
  const tiles = ['booking', 'calendar', 'money', 'marketing'].map((id) => FEATURE_GROUPS.find((g) => g.id === id)!).filter(Boolean)
  // a fotó minimális parallaxa: lassabban mozog, mint a kártyája
  // (target: a kártyát kitöltő, a fotó ELŐTT álló réteg; a kártyán overflow-clip — ld. a ConceptLightHero feletti megjegyzést)
  const photoRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: photoP } = useScroll({ target: photoRef, offset: COVER_OFFSET })
  const photoT = useTransform(photoP, [0, 1], ['translateY(-6%)', 'translateY(6%)'])
  return (
    <section id="funkciok" className="bg-ui-dark px-4 py-24 font-onest text-white">
      <SectionHead dark pill="Funkciók" title="Minden, ami a vállalkozásodnak kell, egy helyen." />
      <motion.div {...inView} variants={stagger(0.08)} className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-[1.15fr_1fr]">
        <motion.div variants={rise} className="relative min-h-[420px] overflow-clip rounded-ui-container">
          <div ref={photoRef} aria-hidden className="pointer-events-none absolute inset-0" />
          <motion.div style={{ transform: photoT }} className="absolute inset-x-0 -inset-y-[8%] will-change-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/hero/esti-online-foglalas-davelopment-booking.webp" alt="Este, otthon foglal a vendég a telefonján — online időpontfoglalás a davelopment bookinggal" loading="lazy" className="h-full w-full object-cover" />
          </motion.div>
          <div className="absolute bottom-3 left-3 w-[min(320px,calc(100%-1.5rem))] rounded-ui-card bg-white/25 p-6 backdrop-blur-xl"> {/* ui-allow: üveg-kártya */}
            <div className="text-[clamp(3rem,5vw,64px)] font-light leading-none">24/7</div> {/* ui-allow: nagy szám */}
            <div className="mt-2 text-ui-row text-white/85">online foglalás — akkor is, amikor zárva vagy</div>
          </div>
        </motion.div>
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((g) => {
            const I = g.icon
            return (
              <motion.a key={g.id} href={groupHref(g)} variants={rise} className="group flex min-h-[200px] flex-col justify-between rounded-ui-container bg-white/[0.06] p-6 transition-colors hover:bg-white/[0.1]"> {/* ui-allow: sötét csempe */}
                <I className="h-7 w-7 text-white/45 transition-colors group-hover:text-white" strokeWidth={1.5} />
                <span className="text-ui-row font-medium leading-snug">{g.label}<span className="mt-1 block text-ui-meta font-normal text-white/50">{g.tagline}</span></span>
              </motion.a>
            )
          })}
        </div>
      </motion.div>
    </section>
  )
}

/* ═════════════════════════════ 2/f. MINDENNAPI MUNKA (appnext „Built to simplify daily operations”) ═════════════════════════════ */

const OPS: [string, string][] = [
  ['Időt spórolsz', 'A visszaigazolás, az emlékeztető és a számla magától megy ki — neked nem kell utánamenni.'],
  ['Rend a csapatban', 'Beosztás, szabadság és ledolgozott órák egy naptárban, mindenki a saját telefonján.'],
  ['Több visszatérő vendég', 'Vendégkártya, hírlevél és Google-értékelés kérés — a foglalásokból magától épül.'],
]
/** Két sor: felül balra cím + lenyíló pontok, jobbra a kéz a telefonnal halvány sárga háttéren; alatta két kártya —
 *  balra egymásra csúszó értesítések, jobbra fotón a beosztott munkatársak listája. A fotók helye tartalék, amíg nincs
 *  végleges kép (Dave cseréli). */
export function DailyOps({ rating }: { rating?: Rating } = {}) {
  const [open, setOpen] = useState(0)
  // a munkatárs-kártyák léptetése (2,4 mp-enként egyet feljebb)
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick((v) => v + 1), 2400); return () => clearInterval(t) }, [])
  const staff: [string, string, string, string][] = [['viktoria', 'Viktória', 'Stylist', '9–17'], ['csaba', 'Csaba', 'Barber', '10–18'], ['szabina', 'Szabina', 'Recepció', '9–13'], ['dave', 'Dávid', 'Tulajdonos', '12–20']]
  return (
    <>
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-24 font-onest text-ui-text">
      <SectionHead pill="Mindennapok" title="A mindennapi munka, egyszerűsítve." lead="Foglalás, csapat és fizetés egy összekötött rendszerben — az ismétlődő munkát a davelopment booking végzi el." />
      {/* két nagy képes kártya: értesítések + beosztott csapat */}
      <div className="mt-12 grid gap-3 lg:h-[440px] lg:grid-cols-2">
        {/* értesítések egy telefon-sziluett előtt */}
        <div className="flex min-h-0 flex-col rounded-ui-container bg-white p-3 ring-1 ring-ui-divider">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-ui-card bg-ui-cell">
            <div className="absolute bottom-0 left-1/2 h-[82%] w-[46%] -translate-x-1/2 rounded-t-[44px] border-[10px] border-b-0 border-white bg-white/50" /> {/* ui-allow: telefon-sziluett */}
            <motion.div {...inView} variants={stagger(0.15)} className="relative w-[78%] origin-center scale-[.85] space-y-2">
              <motion.div variants={rise} className="flex items-center gap-4 rounded-ui-card bg-white p-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,.3)]">
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-ui-title">Új foglalás<span className="h-2 w-2 rounded-full bg-ui-ok-dot" /></span><span className="mt-1 block text-ui-body text-ui-muted">Kiss Réka balayage-t foglalt</span><span className="mt-2 block text-ui-meta text-ui-muted">12 perce</span></span>
                <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-ui-inner"><img src="/landing/funkciok/csapat/avatar/viktoria.webp" alt="" className="h-full w-full object-cover" /><span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-md bg-white"><Check className="h-3.5 w-3.5" /></span></span> {/* eslint-disable-line @next/next/no-img-element */}
              </motion.div>
              <motion.div variants={rise} className="mx-4 flex items-center gap-4 rounded-ui-card bg-white/70 p-3 opacity-70">
                <span className="min-w-0 flex-1"><span className="block text-ui-body">Előleg beérkezett</span><span className="block text-ui-meta text-ui-muted">10 000 Ft · Juhász Hanna</span></span>
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-ui-control"><img src="/landing/funkciok/csapat/avatar/szabina.webp" alt="" className="h-full w-full object-cover" /></span> {/* eslint-disable-line @next/next/no-img-element */}
              </motion.div>
            </motion.div>
          </div>
          <p className="box-content min-h-[2.8em] px-3 pb-2 pt-3 text-ui-row">Minden foglalásról és fizetésről azonnal tudsz — ott, ahol épp vagy.</p> {/* ui-allow: 2 sornyi hely, hogy a két kép egyforma magas legyen */}
        </div>
        {/* fotón a beosztott munkatársak */}
        <div className="flex min-h-0 flex-col rounded-ui-container bg-white p-3 ring-1 ring-ui-divider">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-ui-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/hero/csapat-beosztas-szalon-davelopment-booking.webp" alt="Két fodrász készül a nyitásra — a beosztást a davelopment booking intézi" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-bottom" />
            {/* a beosztott munkatársak lépésenként feljebb lépnek: a második helyen lévő kiemelt (nagyobb, tömör fehér),
                a többi kisebb, áttetsző üveg; felül kiúszik, alul beúszik (a referencia „Assigned” kártyáinak mintájára) */}
            <div className="absolute left-1/2 top-4 h-full w-[62%] -translate-x-1/2">
              {[-1, 0, 1, 2, 3, 4].map((slot) => {
                const id = tick + slot
                const [a, n, r, h] = staff[((id % staff.length) + staff.length) % staff.length]
                const on = slot === 1
                const Y: Record<number, number> = { [-1]: -62, 0: 0, 1: 66, 2: 134, 3: 196, 4: 258 }
                return (
                  <motion.div key={id} initial={false} animate={{ y: Y[slot], scale: on ? 1.08 : 0.94, opacity: slot < 0 || slot > 3 ? 0 : 1 }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                    className={`absolute inset-x-0 top-0 flex items-center gap-3 rounded-ui-inner p-2 transition-colors duration-500 ${on ? 'z-10 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]' : 'bg-white/70 backdrop-blur-md'}`}>
                    <img src={`/landing/funkciok/csapat/avatar/${a}.webp`} alt="" className="h-11 w-11 rounded-ui-control object-cover" /> {/* eslint-disable-line @next/next/no-img-element */}
                    <span className="min-w-0 flex-1"><span className="block text-ui-row">{n}</span><span className="block text-ui-meta text-ui-muted">{r}</span></span>
                    <span className="pr-1 text-right"><span className="block text-ui-meta text-ui-ok">Beosztva</span><span className="block text-ui-label text-ui-muted">ma {h}</span></span>
                  </motion.div>
                )
              })}
            </div>
          </div>
          <p className="box-content min-h-[2.8em] px-3 pb-2 pt-3 text-ui-row">A csapat beosztása kézi egyeztetés nélkül — mindenki látja a saját műszakját.</p> {/* ui-allow: 2 sornyi hely */}
        </div>
      </div>
      {/* alattuk a nagy kép: a New York-i szalon a widgetekkel */}
      <div className="mt-3 overflow-hidden rounded-ui-container">
        <PhotoBand rating={rating} card="side" align="object-left" src="/landing/hero/new-york-studio-online-foglalas-davelopment-booking.webp" alt="Letisztult, világos szalon New Yorkban — online foglalás a davelopment bookinggal"
          title="Minden nap foglalnak rajta" text="Online foglalás, emlékeztető és előleg — a szalon közben dolgozik."
          widgets={[
            { pos: 'left-[5%] top-[8%] w-[min(240px,17vw)]', w: 340, el: <ArrivalsCard className="max-h-[380px]" /> },
            { pos: 'right-[7%] top-[6%] w-[min(190px,14vw)]', w: 300, el: <StatWeekCard className="bg-white" /> },
          ]} />
      </div>
      {/* két gomb */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {/* mobilon csak a funkciók gomb (a regisztráció a fejlécben és a szakaszok végén is ott van) */}
        <span className="hidden sm:inline-flex"><HeroButton href="/register" label="Próbáld ki ingyen" /></span>
        <a href={featurePath('/funkciok')} className="ui-press inline-flex h-11 items-center rounded-full bg-ui-cell px-5 text-ui-row text-ui-text transition-colors hover:bg-ui-divider">Nézd meg a funkciókat</a>
      </div>
    </section>
    {/* külön: a magas kártyás két oszlop (lenyitható előnyök + a telefont tartó kéz), cím pill nélkül */}
    <section className="mx-auto max-w-6xl px-4 pb-24 pt-16 font-onest text-ui-text">
      <SectionHead title="Kevesebb adminisztráció, több vendég." />
      {/* két oszlop: lenyitható előnyök + a telefont tartó kéz */}
      <div className="mt-12 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col justify-center rounded-ui-container bg-ui-cell p-6 lg:min-h-[440px]">
          <div className="space-y-1.5">
            {OPS.map(([t, d], i) => (
              <button key={t} type="button" onClick={() => setOpen(i)} className="block w-full rounded-ui-card bg-white px-5 py-3.5 text-left">
                <span className="flex items-center justify-between gap-4"><span className="text-ui-row">{t}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ui-control bg-ui-cell text-ui-title leading-none">{open === i ? '−' : '+'}</span></span>
                <motion.span initial={false} animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }} className="block overflow-hidden"><span className="block pt-2 text-ui-meta text-ui-muted">{d}</span></motion.span>
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-[440px] overflow-hidden rounded-ui-container bg-ui-yellow/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/hero/foglalasok-feature-davelopment-booking.webp" alt="A davelopment booking a telefonon — a Foglalások nap-idővonala" loading="lazy" className="absolute -bottom-6 left-1/2 h-[112%] max-w-none -translate-x-1/2 object-contain" />
        </div>
      </div>
    </section>
    </>
  )
}

/* ═════════════════════════════ 2/f. 3 LÉPÉS + TIPPEK (a 2. koncepció saját, tömör változatai) ═════════════════════════════ */

import { AppTopK2, BRAND_BADGE, FILTER, PAGE_TITLE, PhoneFrameK2, SCREEN } from './landing-phone'
export { AppTopK2, BRAND_BADGE, FILTER, PAGE_TITLE, PhoneFrameK2, SCREEN }

const STEP_SCREENS: React.ReactNode[] = [
  <BusinessTypeStep key="a" />,
  SCREEN.megosztas,
  SCREEN.munkatarsak,
]

/** „Kezdd el 3 egyszerű lépésben” — a régi „Hogyan működik” viselkedése: a három kártya egymás mellett, rámutatva a kártya
 *  kinyílik (szélesebb lesz), és a jobb felében megjelenik a lépés képernyője a rendszerből, iPhone-keretben. Mobilon egymás
 *  alatt, mindegyik a saját telefonjával. A #hogyan horgonyt megtartja. */
export function StepsK2({ id = 'hogyan', head = { pill: 'Hogyan működik', title: 'Kezdd el 3 egyszerű lépésben.', lead: '5 perc, és éles a foglalóoldalad — nem kell hozzá informatikus.' }, steps = HOW_STEPS, phones }: {
  id?: string
  head?: { pill: string; title: string; lead?: string }
  /** a lépések (cím + mondat) — alapból a főoldaliak */
  steps?: { title: string; body: string }[]
  /** a lépések kész telefonjai (keretestül) — alapból a főoldali képernyők a PhoneFrameK2-ben */
  phones?: React.ReactNode[]
} = {}) {
  const [active, setActive] = useState(0)
  const phone = (i: number, cls: string) => phones ? <div className={cls}>{phones[i]}</div> : <PhoneFrameK2 className={cls}>{STEP_SCREENS[i]}</PhoneFrameK2>
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-24 font-onest text-ui-text">
      <SectionHead pill={head.pill} title={head.title} lead={head.lead} />
      <ol className="mt-12 flex flex-col gap-3 lg:h-[260px] lg:flex-row">
        {steps.map((st, i) => {
          const on = active === i
          return (
            <li key={st.title} onMouseEnter={() => setActive(i)}
              className={`relative flex min-h-[260px] cursor-pointer flex-col overflow-hidden rounded-ui-container bg-ui-yellow/15 transition-[flex-grow] duration-500 ease-out lg:min-h-0 ${on ? 'lg:flex-[2_1_0%]' : 'lg:flex-[1_1_0%]'}`}>
              {/* a telefon: mobilon mindig, desktopon csak a kinyílt kártya jobb felében */}
              <div className={`pointer-events-none absolute right-3 top-3 z-10 transition-opacity duration-300 max-lg:hidden ${on ? 'opacity-100 delay-200' : 'opacity-0'}`}><img src="/icons/icon-192.png" alt="" aria-hidden className="h-7 w-7 rounded-[8px] shadow-[0_6px_16px_-8px_rgba(0,0,0,.4)]" /></div> {/* eslint-disable-line @next/next/no-img-element */}
              <div className={`pointer-events-none absolute bottom-0 right-8 top-0 w-[190px] transition-opacity duration-300 max-lg:hidden ${on ? 'opacity-100 delay-200' : 'opacity-0'}`}>
                {phone(i, 'absolute inset-x-0 top-7')}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#FFF9E7] to-transparent" /> {/* ui-allow: a krém kártyaszínbe olvadás */}
              </div>
              <div className="relative h-[240px] overflow-hidden lg:hidden">
                {BRAND_BADGE}
                {phone(i, 'absolute left-1/2 top-6 w-[190px] -translate-x-1/2')}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#FFF9E7] to-transparent" /> {/* ui-allow: a krém kártyaszínbe olvadás */}
              </div>
              {/* szöveg: felül a sorszám, alul a cím és a mondat (a kinyílt kártyán a bal felében) */}
              <div className="relative z-10 flex flex-1 flex-col justify-between p-6 lg:w-[min(260px,100%)]">
                <span className="flex items-center gap-1.5" aria-label={`${i + 1}. lépés`}>{[0, 1, 2].map((j) => <span key={j} className={`h-2.5 w-2.5 rounded-full ${j <= i ? 'bg-ui-yellow' : 'bg-white'}`} />)}</span>
                <div className="mt-6">
                  <h3 className="text-ui-title font-medium">{st.title}</h3>
                  <p className="mt-2 text-ui-body text-ui-muted">{st.body}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** „Tippek az online foglaláshoz” — a három legfrissebb cikk rácsban (nem karusszel): kép, kategória-pill, cím,
 *  kivonat; alatta „Összes tipp” gomb. Belső linkek a /tips cikkekre (SEO). */
export function TipsK2() {
  // három kiemelt cikk, mindegyikhez a rendszer odaillő mobilnézete a telefonkeretben (nem képernyőkép)
  const PICKS: [string, React.ReactNode][] = [
    ['no-show-csokkentese', SCREEN.statisztika],
    ['mikor-eri-meg-online-foglalo', SCREEN.foglalasok],
    ['csapat-beosztas-hatekonyan', SCREEN.naptar],
  ]
  const latest = PICKS.map(([slug, screen]) => ({ t: TIP_ARTICLES.find((x) => x.slug === slug), screen })).filter((x): x is { t: (typeof TIP_ARTICLES)[number]; screen: React.ReactNode } => !!x.t)
  return (
    <section id="tippek" className="mx-auto max-w-6xl px-4 py-24 font-onest text-ui-text">
      <SectionHead pill="Tippek" title="Tippek az online foglaláshoz." lead="Gyakorlati cikkek no-show-ról, előlegről, beosztásról és arról, hogyan válassz foglalási rendszert." />
      {/* mobilon vízszintesen lapozható sáv (snap), md-től 3 oszlopos rács */}
      <motion.div {...inView} variants={stagger(0.1)} className="-mx-4 mt-12 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
        {latest.map(({ t, screen }) => (
          <motion.a key={t.slug} variants={rise} href={`/tips/${t.slug}`} className="group flex w-[88%] shrink-0 snap-start flex-col rounded-ui-container bg-ui-yellow/15 p-3 md:w-auto">
            <div className="relative h-[190px] overflow-hidden rounded-ui-card bg-white">
              {BRAND_BADGE}
              <PhoneFrameK2 className="absolute left-1/2 top-5 w-[190px] -translate-x-1/2 transition-transform duration-500 group-hover:-translate-y-1">{screen}</PhoneFrameK2>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
            </div>
            <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
              <span className="self-start rounded-[8px] bg-white px-2.5 py-1 text-ui-meta font-medium text-ui-text/80">{t.category}</span> {/* ui-allow: a koncepció pill-formája */}
              <h3 className="mt-3 text-ui-row font-medium group-hover:underline group-hover:underline-offset-4">{t.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-ui-body text-ui-muted">{t.excerpt}</p>
            </div>
          </motion.a>
        ))}
      </motion.div>
      <div className="mt-10 flex justify-center"><HeroButton href="/tips" label="Összes tipp" /></div>
    </section>
  )
}

/* ═════════════════════════════ 2/g. LÁBLÉC (a 2. koncepció — világos, appnext mintára) ═════════════════════════════ */

// SEO: az összes iparági landing belső linkje (ugyanaz a kör, mint a régi láblécben + a vendéglátós oldalak)
const FOOT_INDUSTRY: [string, string][] = [['/fodrasz-idopontfoglalas', 'Fodrászoknak'], ['/barber-idopontfoglalas', 'Barbereknek'], ['/kozmetikus-idopontfoglalas', 'Kozmetikusoknak'], ['/mukormos-idopontfoglalas', 'Műkörmösöknek'], ['/masszor-idopontfoglalas', 'Masszőröknek'], ['/csontkovacs-idopontfoglalas', 'Csontkovácsoknak'], ['/fogorvos-idopontfoglalas', 'Fogorvosoknak'], ['/maganrendelo-idopontfoglalas', 'Magánrendelőknek'], ['/szemelyi-edzo-idopontfoglalas', 'Személyi edzőknek'], ['/pilates-idopontfoglalas', 'Pilates stúdióknak'], ['/joga-idopontfoglalas', 'Jóga oktatóknak']]
const FOOT_GASTRO: [string, string][] = [['/etterem-asztalfoglalas', 'Éttermeknek'], ['/kavezo-asztalfoglalas', 'Kávézóknak'], ['/pizzeria-asztalfoglalas', 'Pizzériáknak'], ['/fine-dining-asztalfoglalas', 'Fine dining éttermeknek'], ['/csapatkezeles-kisvallalkozasoknak', 'Csapatkezelés vállalkozásoknak']]
const FOOT_COMPANY: [string, string][] = [['/#hogyan', 'Hogyan működik'], ['/arak', 'Árak'], ['/#gyik', 'GYIK'], ['/tips', 'Tippek'], ['/kapcsolat', 'Kapcsolat'], ['/login', 'Bejelentkezés'], ['/register', 'Regisztráció']]
const FOOT_LEGAL: [string, string][] = [['/terms', 'Felhasználási feltételek'], ['/privacy', 'Adatkezelési tájékoztató'], ['/cookies', 'Sütikezelés']]

/** Világos lábléc: balra a logó, egy mondat, e-mail és a gomb; jobbra a link-oszlopok (funkciók, kinek, cég, jogi —
 *  ugyanazok a belső linkek, mint a mostani láblécben, SEO miatt); alul a jogi sor a davelopment.hu linkkel, legalul az
 *  óriás, halvány felirat. */
export function ConceptLightFooter({ trialDays = 14 }: { trialDays?: number }) {
  const col = (title: string, links: [string, string][]) => (
    <div>
      <div className="text-ui-meta text-ui-muted">{title}</div>
      <ul className="mt-4 space-y-2.5">{links.map(([h, l]) => <li key={h}><a href={h} className="text-ui-body text-ui-text transition-colors hover:text-ui-muted">{l}</a></li>)}</ul>
    </div>
  )
  return (
    <footer className="bg-white font-onest text-ui-text">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-12 pt-20 lg:grid-cols-[1fr_2.4fr]">
        <div>
          <BrandLogo variant="light" className="h-8 w-auto" alt="davelopment booking" />
          <p className="mt-5 max-w-[320px] text-ui-body text-ui-muted">Online foglalási rendszer szakembereknek és vendéglátóknak — foglalás, csapat, vendégek és fizetés egy helyen.</p>
          <a href="mailto:hello@davelopment.hu" className="mt-4 inline-block text-ui-body text-ui-text underline underline-offset-4">hello@davelopment.hu</a>
          <div className="mt-6"><HeroButton href="/register" label={`Próbáld ki ${trialDays} napig ingyen`} /></div>
          {/* biztonságos fizetés — Stripe */}
          <p className="mt-5 flex items-center gap-2 text-ui-meta text-ui-muted">
            <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span>Fizetés a <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="font-medium text-ui-text underline underline-offset-2">Stripe</a> biztonságos rendszerén keresztül</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
          {col('Funkciók', FEATURE_GROUPS.map((g) => [groupHref(g), g.label] as [string, string]))}
          {col('Szakembereknek', FOOT_INDUSTRY)}
          {col('Vendéglátóknak', FOOT_GASTRO)}
          {col('Cég', FOOT_COMPANY)}
          {col('Jogi', FOOT_LEGAL)}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-ui-divider px-4 py-5 text-ui-meta text-ui-muted">
        <span>© {new Date().getFullYear()} [davelopment]© Booking</span>
        <a href="https://davelopment.hu" className="transition-colors hover:text-ui-text">Készítette: [davelopment]</a>
      </div>
      <GiantWord text="Csatlakozz" />
    </footer>
  )
}
