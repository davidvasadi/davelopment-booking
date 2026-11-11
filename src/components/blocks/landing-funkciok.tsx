'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { EASE } from '@/lib/motion'
import { ArrowUpRight, Check } from 'lucide-react'
import { buttonHover } from '@/lib/motion'
import { FEATURE_PHONES, TAB_WORD } from './landing-featurephones'
import { heroShots } from '@/components/landing/designVisuals'
import { FitCard } from '@/components/landing/FitCard'
import { FEATURE_GROUPS, featureHref, groupHref, type FeatureGroup } from '@/lib/landingFeatures'
import { GroupPhone, PhoneFrameK2, SCREEN } from './landing-phone'
import { BrandLogo } from '@/components/BrandLogo'
import { HandBubbles, SectionHead, StepsK2 } from './landing-concepts'
import { Payroll } from './calendar'
import { stepVisuals } from './landing-stepvisuals'

/**
 * /funkciok — a hat csoport a főoldal új (2. koncepció) stílusában: krém kártya, fehér képmező a csoport telefonos
 * nézetével a rendszerből (alja levágva), alatta a név (H3, link), mottó és a funkciók fehér pillekben (belső linkek).
 * Bento: a Foglalás és a Csapat széles, a sor végén a sötét „Árak” kártya.
 */
const WIDE = new Set(['booking', 'team'])
const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.15 } } as const
// `custom` = késleltetés (egy sorban a kártyák egymás után jönnek)
// egy transform (nem y): így a framer natívan (WAAPI) animálja
const rise: Variants = { hidden: { opacity: 0, transform: 'translateY(24px)' }, show: (d: number = 0) => ({ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.6, ease: EASE, delay: d } }) }

// a telefon a kártya beúszása után alulról csúszik fel a képmezőbe (a főoldali kártyák „élő” belépője)
const phoneIn: Variants = { hidden: { y: 90, opacity: 0 }, show: (d: number = 0) => ({ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 140, damping: 20, delay: d + 0.18 } }) }

function GroupCard({ g, delay = 0 }: { g: FeatureGroup; delay?: number }) {
  const Icon = g.icon
  return (
    <motion.div {...inView} variants={rise} custom={delay} className={`group flex flex-col rounded-ui-container bg-ui-yellow/15 p-3 ${WIDE.has(g.id) ? 'lg:col-span-2' : ''}`}>
      <Link href={groupHref(g)} tabIndex={-1} aria-hidden className="relative block h-[230px] overflow-hidden rounded-ui-card bg-white">
        <motion.div variants={phoneIn} custom={delay} className="absolute inset-x-0 top-6 flex justify-center">
          <GroupPhone id={g.id} className="w-[200px] transition-transform duration-500 group-hover:-translate-y-1" />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
      </Link>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2.5 text-ui-title font-medium">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-ui-dark text-white"> {/* ui-allow: ikon-csempe, mint a menüben */}
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <Link href={groupHref(g)} className="hover:underline hover:underline-offset-4">{g.label}</Link>
          </h3>
          <Link href={groupHref(g)} aria-label={`${g.label} — részletek`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ui-text transition-colors group-hover:bg-ui-dark group-hover:text-white">
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
        <p className="mt-2 text-ui-body text-ui-muted">{g.tagline}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {g.items.map((f) => (
            <Link key={f.slug} href={featureHref(f)} className="rounded-full bg-white px-3 py-1.5 text-ui-meta font-medium text-ui-text/80 transition-colors hover:bg-ui-dark hover:text-white">
              {f.title}
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function FeatureGroupsK2({ trialDays }: { trialDays: number }) {
  return (
    <section id="csoportok" className="mx-auto max-w-6xl scroll-mt-[88px] px-4 py-20 font-onest text-ui-text lg:py-24">
      <SectionHead pill="Hat csoport" title="Válaszd ki, mire van szükséged." lead="Kattints egy csoportra a részletekért, vagy egy funkcióra, hogy egyből oda ugorj." />
      <div className="mt-12 grid gap-3 lg:grid-cols-3">
        {FEATURE_GROUPS.map((g, i) => <GroupCard key={g.id} g={g} delay={[0, 0.08, 0, 0.08, 0.16, 0][i] ?? 0} />)}
        {/* záró kártya: minden csomagban benne van → Árak */}
        <motion.div {...inView} variants={rise}>
          <Link href="/arak" className="group flex h-full min-h-[260px] flex-col justify-between rounded-ui-container bg-ui-dark p-7 text-white">
            {/* fent: balra az app-ikon és a logó (kicsiben), jobbra a nyíl */}
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <img src="/icons/icon-192.png" alt="" width={28} height={28} className="h-7 w-7 rounded-[8px]" /> {/* ui-allow: app-ikon */}
                <BrandLogo variant="dark" className="h-[22px]" alt="davelopment booking" />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white group-hover:text-ui-text">
                <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </span>
            </span>
            <span>
              <span className="block text-[clamp(1.4rem,2vw,26px)] font-medium leading-[1.15] tracking-[-0.03em]">Hasonlítsd össze a csomagokat.</span> {/* ui-allow: kártya-cím */}
              <span className="mt-2 block text-ui-body text-white/60">{trialDays} napig ingyen, bankkártya nélkül. Árak és kalkulátor</span>
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

/**
 * Funkció-oldal „Miért fontos” — a főoldal „Kevesebb adminisztráció” blokkjának mintájára (egységes stílus, egyedi
 * tartalom): középre zárt fej (pill + cím + a bevezető bekezdések), alatta két magas oszlop: balra szürke tartóban fehér,
 * lenyitható sorok (a csoport funkciói: cím → leírás + ugrás a szakaszra), jobbra krém kártya a csoport mottójával és a
 * telefonos nézettel a rendszerből (alja levágva).
 */
export function FeatureIntroK2({ groupId, title, paragraphs, tagline, items }: {
  groupId: string; title: string; paragraphs: string[]; tagline: string
  items: { slug: string; title: string; desc: string }[]
}) {
  const [open, setOpen] = useState(0)
  const [first, ...rest] = paragraphs
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 font-onest text-ui-text lg:py-24">
      {/* fejléc két oszlopban: balra a pill és a cím, jobbra a szöveg (mobilon egymás alatt) */}
      <div className="grid gap-6 lg:grid-cols-[5fr_7fr] lg:gap-12">
        <motion.div {...inView} variants={rise}>
          <span className="inline-flex items-center rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 text-[14px] font-medium text-ui-text/80">Miért fontos</span> {/* ui-allow: a SectionHead pill-formája */}
          <h2 className="mt-5 text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.08] tracking-[-0.035em]">{title}</h2> {/* ui-allow: szakaszcím */}
        </motion.div>
        {/* jobbra: a fő mondat nagyban és sötéten (ez a válasz a címre), alatta a többi bekezdés átfutható kiemelésként */}
        <motion.div {...inView} variants={rise} custom={0.08} className="lg:pt-14">
          {first && <p className="text-[clamp(1.15rem,1.7vw,24px)] font-medium leading-[1.45] tracking-[-0.02em] text-ui-text">{first}</p>} {/* ui-allow: bevezető (a főoldali bemutatkozó bekezdés mintájára) */}
          {rest.length > 0 && (
            <ul className="mt-8 grid gap-5 border-t border-dashed border-ui-divider pt-6 sm:grid-cols-2">
              {rest.map((p) => (
                <li key={p} className="flex gap-3 text-ui-row text-ui-muted">
                  <span aria-hidden className="mt-[0.55em] h-2 w-2 shrink-0 rounded-full bg-ui-yellow" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
      <div className="mt-12 grid gap-3 lg:grid-cols-2">
        <motion.div {...inView} variants={rise} className="flex flex-col justify-center rounded-ui-container bg-ui-cell p-6 lg:min-h-[480px]">
          <ol className="space-y-1.5">
            {items.map((f, i) => (
              <li key={f.slug}>
                <button type="button" onClick={() => setOpen(i)} aria-expanded={open === i} className="block w-full rounded-ui-card bg-white px-5 py-3.5 text-left">
                  <span className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-3 text-ui-row">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-yellow text-ui-meta font-medium text-ui-dark">{i + 1}</span>
                      {f.title}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ui-control bg-ui-cell text-ui-title leading-none">{open === i ? '−' : '+'}</span>
                  </span>
                  <motion.span initial={false} animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }} className="block overflow-hidden">
                    <span className="block pl-9 pt-2 text-ui-meta text-ui-muted">
                      {f.desc} <a href={`#${f.slug}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-medium text-ui-text underline-offset-4 hover:underline">Részletek ↓</a>
                    </span>
                  </motion.span>
                </button>
              </li>
            ))}
          </ol>
        </motion.div>
        <motion.div {...inView} variants={rise} custom={0.08} className="relative min-h-[480px] overflow-hidden rounded-ui-container bg-ui-yellow/15">
          <p className="relative z-10 m-6 inline-block max-w-[80%] rounded-ui-card bg-white px-4 py-3 text-ui-row">{tagline}</p>
          <motion.div variants={phoneIn} className="absolute inset-x-0 top-28 flex justify-center">
            <GroupPhone id={groupId} className="w-[300px]" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

/**
 * Funkció-oldal funkciói — a főoldal „Minden fontos, egy érintésre” (TabStage) mintájára: sötét pill-fülsor a csoport
 * funkcióival, alatta az aktív funkció egy mondata, majd a kártyája (balra a rendszer képe, jobbra a magyarázat, példa,
 * pontok, gomb). A tartalom változatlan és mind a HTML-ben van (a nem aktív fülek rejtve — SEO); a #slug horgonyok
 * megmaradnak: a menü/link ugyanarra a fülre nyit és odagörget.
 */
// a fülek felirata mindig egy kulcsszó (TAB_WORD; ha nincs, a cím első „, ” vagy „ és ” előtti része) — a teljes cím a
// tartalomban (H2) marad
const tabLabel = (t: string) => t.split(/,\s| és /)[0]
/** a fül-sor alapból kinyíló funkciója csoportonként (ha nincs benne, az első) */
const DEFAULT_TAB = new Set(['bemutatkozo-weboldal'])

export function FeatureTabsK2({ label, tagline, items }: {
  label: string; tagline: string
  items: { slug: string; title: string; desc: string; pain: string; points: string[]; body?: string; example?: string; cta?: string }[]
}) {
  // alapból a csoport kiemelt funkciója nyílik (Foglalás: a weboldal), különben az első
  const [tab, setTab] = useState(() => Math.max(0, items.findIndex((f) => DEFAULT_TAB.has(f.slug))))
  const ref = useRef<HTMLElement>(null)
  // #slug a címben → az a fül nyílik, és a szakaszhoz görget (a menü funkció-linkjei ide mutatnak)
  useEffect(() => {
    const go = () => {
      const i = items.findIndex((f) => `#${f.slug}` === window.location.hash)
      if (i < 0) return
      setTab(i)
      requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
    go()
    window.addEventListener('hashchange', go)
    return () => window.removeEventListener('hashchange', go)
  }, [items])
  // a fülsor (mobilon oldalra görgethető) mindig az aktív fülnél álljon: betöltéskor ugrással, váltáskor finoman, középre.
  // Csak a sort görgetjük vízszintesen (scrollTo), az oldalt nem (scrollIntoView az oldalt is mozgatná)
  const barRef = useRef<HTMLDivElement>(null)
  const firstBar = useRef(true)
  useEffect(() => {
    const bar = barRef.current, btn = bar?.children[tab] as HTMLElement | undefined
    if (!bar || !btn) return
    bar.scrollTo({ left: btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2, behavior: firstBar.current ? 'auto' : 'smooth' })
    firstBar.current = false
  }, [tab])
  // telefonon lapozás: a fül-tartalmon jobbra/balra húzva a szomszédos fülre vált (a fülsoron nem — az saját maga görög;
  // függőleges görgetésnél sem: csak ha a vízszintes mozgás határozottan nagyobb)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const go = (i: number) => { setTab(i); history.replaceState(null, '', `#${items[i].slug}`) }
  const onTouchStart = (e: React.TouchEvent) => {
    if (barRef.current?.contains(e.target as Node)) { touch.current = null; return }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current; touch.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0 && tab < items.length - 1) go(tab + 1)
    if (dx > 0 && tab > 0) go(tab - 1)
  }
  return (
    <section ref={ref} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} id="funkciok-lista" className="mx-auto max-w-6xl scroll-mt-[88px] px-4 py-20 font-onest text-ui-text lg:py-24">
      <SectionHead pill="Funkciók" title={`${label}.`} lead={tagline} />
      <div className="mt-10 flex justify-center">
        {/* pontosan a főoldali fülsor méretei (TabStage, sötét); ha nem fér ki, oldalra görgethető */}
        <div ref={barRef} role="tablist" aria-label={`${label} funkciók`} className="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ui-dark px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((f, i) => (
            <button key={f.slug} type="button" role="tab" aria-selected={i === tab} aria-controls={f.slug} onClick={() => go(i)}
              className={`ui-press shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-ui-title outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40 ${i === tab ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/80'}`}>
              {TAB_WORD[f.slug] ?? tabLabel(f.title)}
            </button>
          ))}
        </div>
      </div>
      {items.map((f, i) => {
        return (
          <div key={f.slug} id={f.slug} role="tabpanel" hidden={i !== tab} className="scroll-mt-[88px]">
            {/* (a rövid `desc` itt nem jelenik meg — a menü/llms.txt használja; a panelben a leírás, a példa és a pontok mondják el) */}
            {/* középen a mock (mint a főoldali fül-blokk kártyája), balra és jobbra a tartalom — fülváltáskor mind cserélődik */}
            <div className="mt-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
              <motion.div key={`l${tab}`} initial={{ opacity: 0, transform: 'translateX(-20px)' }} animate={{ opacity: 1, transform: 'translateX(0px)' }} transition={{ duration: 0.45, ease: EASE, delay: 0.08 }} className="order-2 lg:order-1">
                <h2 className="text-[clamp(1.5rem,2.2vw,30px)] font-medium leading-[1.15] tracking-[-0.03em]">{f.title}</h2> {/* ui-allow: funkció-cím */}
                <p className="mt-3 text-ui-row italic text-ui-muted">„{f.pain}”</p>
                {f.body && <p className="mt-5 text-ui-row leading-[1.6] text-ui-text/80">{f.body}</p>}
              </motion.div>
              <motion.div key={`c${tab}`} initial={{ opacity: 0, transform: 'translateY(30px) scale(0.96)' }} animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                className="order-1 flex justify-center lg:order-2">
                {/* a funkció teljes mobil nézete a telefonban — háttér-kártya nélkül */}
                <div className="pointer-events-none select-none" aria-hidden>
                  <div className="w-[300px]">{FEATURE_PHONES[f.slug]}</div>
                </div>
              </motion.div>
              <motion.div key={`r${tab}`} initial={{ opacity: 0, transform: 'translateX(20px)' }} animate={{ opacity: 1, transform: 'translateX(0px)' }} transition={{ duration: 0.45, ease: EASE, delay: 0.12 }} className="order-3">
                {/* a „Példa" doboz kikerült (Dave: csak ismételte a leírást) — a szöveg az adatokban megmaradt */}
                <ul className="space-y-3">
                  {f.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-3 text-ui-row leading-snug text-ui-text">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ui-yellow text-ui-dark"><Check className="h-3 w-3" strokeWidth={3} /></span>
                      {pt}
                    </li>
                  ))}
                </ul>
                {/* ugyanaz a gomb, mint a desktop menüben (sima sötét kapszula, nyíl nélkül) */}
                <motion.a href="/register" variants={buttonHover} initial="rest" whileHover="hover"
                  className="mt-6 inline-flex h-12 items-center rounded-full bg-ui-dark px-6 font-onest text-ui-row font-medium text-white transition-opacity hover:opacity-90">
                  {f.cta ?? 'Kipróbálom ingyen'}
                </motion.a>
              </motion.div>
            </div>
          </div>
        )
      })}
    </section>
  )
}

/**
 * Funkció-oldal: a hero alatti kép — a főoldal kezes telefonja (a „Minden a zsebedben” fotója), körülötte a csoport
 * saját két lebegő widgetjével (ugyanazok, mint eddig a döntött ablak mellett — designVisuals `heroShots`). Görgetésre a
 * widgetek a telefonból úsznak ki a helyükre, a kéz alja fehérbe (itt: az oldal hátterébe) olvad.
 */
/** a csoport kezes képe (kéz a telefonnal, a csoport valódi képernyőjével): public/landing/hero/<név>-feature-davelopment-booking.webp */
const HAND_IMG: Record<string, string> = { booking: 'foglalasok', calendar: 'naptar', guests: 'vendegek', money: 'penz', marketing: 'marketing', team: 'csapat' }

/** a jobb oldali widget helye csoportonként, ahol eltér az alaptól (Foglalás: a fekete „Mai teendők” mobilon távolabb a telefontól) */
/** a bal oldali widget helye csoportonként, ahol eltér (mobilon a látható sáv a kép ~20–80%-a) */
const LEFT_POS: Record<string, string> = {
  guests: 'left-[21.5%] top-[30%] w-[30%] sm:left-[14%] sm:w-[26%] lg:left-[10%]', // mobilon nagyobb
  marketing: 'left-[24%] top-[30%] w-[21%] sm:left-[14%] sm:w-[26%] lg:left-[10%]', // mobilon kisebb (a helye marad)
  team: 'left-[21.5%] top-[30%] w-[26%] sm:left-[14%] lg:left-[10%] lg:top-[16%]', // mobilon picit kintebb, gépen fentebb
}
const RIGHT_POS: Record<string, string> = {
  booking: 'left-[57%] top-[52%] w-[22%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', // csak mobilon kijjebb és lejjebb
  calendar: 'left-[57%] top-[52%] w-[22%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', // ugyanígy
  money: 'left-[57%] top-[52%] w-[22%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', // ugyanígy
  marketing: 'left-[57%] top-[28%] w-[22%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', // mobilon jóval fentebb és kintebb
  team: 'left-[60.5%] top-[46%] w-[18%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', // mobilon kisebb és jóval kintebb
  guests: 'left-[53%] top-[56%] w-[26%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', // mobilon nagyobb, kintebb, lejjebb
}
export function FeatureHandK2({ groupId, alt, title, lead }: { groupId: string; alt: string; title: string; lead: string }) {
  // a főoldali kezes blokk (HandBubbles) — ugyanaz a natív görgetés, bounce és cím-animáció; a csoport kezes képével és a
  // két saját widgetjével. A buborékok a telefonra lógnak (mobilon is a képernyőn belül maradnak: a kép 180% széles,
  // −22%-kal eltolva, így a látható sáv kb. a 22–77%)
  const shots = heroShots(groupId)
  return (
    <HandBubbles late title={title} lead={lead} alt={alt} img={`/landing/hero/${HAND_IMG[groupId] ?? HAND_IMG.booking}-feature-davelopment-booking.webp`}
      bubbles={shots ? [
        // sm-től (tablet, gép) az eredeti hely és méret; mobilon beljebb, a telefonra lógva (ott a kép 22–77%-a látszik)
        // Csapat: a jogosultság-kártya helyett a bérösszesítő
        { pos: LEFT_POS[groupId] ?? 'left-[24%] top-[30%] w-[26%] sm:left-[14%] lg:left-[10%]', w: groupId === 'team' ? 420 : 480,
          el: groupId === 'team' ? <Payroll className="bg-white shadow-ui-float" /> : shots.left, bare: true },
        { pos: RIGHT_POS[groupId] ?? 'left-[50%] top-[46%] w-[22%] sm:left-[60%] sm:top-[22%] sm:w-[20%] lg:left-[64%]', w: 340, el: shots.right, bare: true },
      ] : []} />
  )
}

/* ── „Így indulsz el” — a főoldal 3 lépéses blokkja (StepsK2), a csoport saját lépéseivel; a képmezőben a főoldali
   „Mindennapok” kártya-kompozíciói (értesítés-kártyák a telefon-sziluett előtt / üveges sorok fotón) — landing-stepvisuals ── */
export function FeatureStepsK2({ groupId, steps }: { groupId: string; steps: [string, string][] }) {
  return (
    <StepsK2 id="lepesek" head={{ pill: 'Hogyan működik', title: 'Így indulsz el.', lead: 'Pár perc beállítás, utána magától működik.' }}
      steps={steps.map(([title, body]) => ({ title, body }))} fills={stepVisuals(groupId)} />
  )
}

