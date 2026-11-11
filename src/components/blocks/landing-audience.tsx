'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight, CalendarCheck, MailWarning, Scissors, UtensilsCrossed, Zap } from 'lucide-react'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'
import { COVER_OFFSET, padRange } from '@/lib/scrollOffset'
import { NumberRoll } from '@/components/landing/NumberRoll'
import { inView, rise, SharpStar, stagger } from './landing-concepts'

/**
 * „Kinek” — a két célcsoport (szakemberek: időpontfoglalás, vendéglátók: asztalfoglalás) egymás alatt, egy-egy
 * szerkesztőségi sorban (a második tükrözve). Minden mozgás framer; a görgetéshez kötött rész natív transform.
 */

type SideKey = 'salon' | 'restaurant'
type Side = { key: SideKey; title: string; label: string; icon: typeof Scissors; photo: string; alt: string; links: { slug: string }[]; dark: boolean }

const SALON_LANDINGS = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'salon' && l.slug !== 'csapatkezeles-kisvallalkozasoknak')
const RESTAURANT_LANDINGS = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'restaurant')
const SIDES: Record<SideKey, Side> = {
  salon: { key: 'salon', title: 'Szakembereknek', label: 'Időpontfoglalás', icon: Scissors, photo: '/landing/hero/kinek-szakember-davelopment-booking.webp', alt: 'Világos, letisztult fodrászszalon — időpontfoglalás a davelopment bookinggal', links: SALON_LANDINGS, dark: false },
  restaurant: { key: 'restaurant', title: 'Éttermeknek', label: 'Asztalfoglalás', icon: UtensilsCrossed, photo: '/landing/hero/vendeglatas-davelopment-booking.webp', alt: 'Napfényes bisztró, a pincér megteríti az asztalt — asztalfoglalás a davelopment bookinggal', links: RESTAURANT_LANDINGS, dark: true },
}

// a főoldali PhotoBand kártya-belépője: a csillagok (és a pillek) egyenként beugranak
const pop = { hidden: { opacity: 0, transform: 'scale(0.4) rotate(-12deg)' }, show: { opacity: 1, transform: 'scale(1) rotate(0deg)', transition: { type: 'spring' as const, stiffness: 320, damping: 18 } } }

type Rating = { rating: number } | null | undefined
type Props = { salon: string; restaurant: string; rating?: Rating }

/** Egy sor tartalma. A kártya a fotón egy-egy konverziós, VALÓS funkció (a meg nem nyitott visszaigazolás értesítése:
 *  api/cron/notifications 24 és 12 órával előtte; az ingyenes próba a csomag-beállításból): a nagy szám „odometer”-rel
 *  pörög a `from` értékről a `to`-ra. */
type Row = {
  side: Side; eyebrow: string; title: string; feature: string; circle: { slug: string; label: string }; small: string
  card: { icon: typeof MailWarning; label: string; from: number; to: (trialDays: number) => number; unit: string; sub: string }
}
const ROWS: Row[] = [
  { side: SIDES.restaurant, eyebrow: 'Vendéglátóknak', title: 'Minden társaság a jó asztalhoz.', feature: 'Foglalás zárás után is',
    circle: { slug: 'etterem-asztalfoglalas', label: 'Megnézem' }, small: 'kavezo-asztalfoglalas',
    card: { icon: CalendarCheck, label: 'Próbaidő', from: 0, to: (d) => d, unit: 'nap', sub: 'ingyenes próba, bankkártya nélkül' } },
  { side: SIDES.salon, eyebrow: 'Szakembereknek', title: 'Kevesebb kieső vendég, több bevétel.', feature: 'Online foglalás éjjel-nappal',
    circle: { slug: 'fodrasz-idopontfoglalas', label: 'Megnézem' }, small: 'joga-idopontfoglalas',
    card: { icon: MailWarning, label: 'Értesítés', from: 0, to: () => 24, unit: 'órával előtte', sub: 'szólunk, ha a vendég még nem nyitotta meg a visszaigazolást' } },]
const marquee = (slug: string) => `/landing/marquee/${slug}-davelopment-booking.webp`

/** Egy sor: nagy álló fotó, rajta sötét üveg-kártya (szakmák száma + Google-értékelés); mellette címke, nagy cím, szöveg,
 *  iparági pillek (linkek), alul egy jellemző ikonnal, egy kerek kép „Megnézem” linkkel és egy kis álló kép.
 *  Mozgás: pontosan a főoldali PhotoBand mintája — a fotó parallaxa (natív, a jelölőhöz kötve), a kártya beúszik és a
 *  csillagok felvillannak, ha a fotó a képernyőre ér; a tartalom a főoldali `rise` / `stagger` belépővel jön; a szám a
 *  kártyán „odometer”-rel pörög fel (NumberRoll).
 *  `pin`: a jógás kép ragadós változata — a sor megáll (gépen teljes képernyőn, telefonon amikor az alja a képernyő aljához
 *  ér), a fotó ráközelít, és a következő sor rácsúszik. A ráközelítés célja egy ELŐTTE álló, 200svh magas jelölő. */
function AudienceRow({ row, body, flip, rating, trialDays, pin = false }: { row: Row; body: string; flip: boolean; rating: Rating; trialDays: number; pin?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const tl = useRef<HTMLDivElement>(null)
  const pinTl = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: tl, offset: COVER_OFFSET })
  const parT = useTransform(scrollYProgress, [0, 1], ['translateY(-12%)', 'translateY(12%)'])
  // ragadós változat: a jógás kép ráközelítése (telefonon erősebben), ugyanazokkal az értékekkel
  const { scrollYProgress: pinP } = useScroll({ target: pinTl, offset: COVER_OFFSET })
  const [narrow, setNarrow] = useState(false)
  useEffect(() => { const m = window.matchMedia('(max-width: 639px)'); const f = () => setNarrow(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  const zoomT = useTransform(pinP, ...padRange([0, 0.67], ['scale(1)', narrow ? 'scale(1.45)' : 'scale(1.2)']))
  // hol álljon meg: ha a sor kisebb a képernyőnél, a képernyő függőleges közepén; ha magasabb (telefon), az alja a képernyő aljánál
  const [top, setTop] = useState(0)
  useEffect(() => {
    const el = rowRef.current
    if (!pin || !el) return
    const f = () => { const free = window.innerHeight - el.offsetHeight; setTop(free > 0 ? free / 2 : free) }
    f(); const ro = new ResizeObserver(f); ro.observe(el); window.addEventListener('resize', f)
    return () => { ro.disconnect(); window.removeEventListener('resize', f) }
  }, [pin])
  const live = useInView(ref, { amount: 0.4 })
  // a szám a kártya beúszása UTÁN pörög fel (különben a beúszás alatt lefut és nem látszik); visszagörgetéskor újra
  const [rolled, setRolled] = useState(false)
  useEffect(() => {
    if (!live) { setRolled(false); return }
    const t = setTimeout(() => setRolled(true), 650)
    return () => clearTimeout(t)
  }, [live])
  const card$ = { initial: 'hidden', animate: live ? 'show' : 'hidden', variants: { hidden: { opacity: 0, transform: 'translateY(30px)' }, show: { opacity: 1, transform: 'translateY(0px)', transition: { type: 'spring' as const, stiffness: 160, damping: 20, staggerChildren: 0.1 } } } }
  const { side } = row
  const dark = side.dark // a vendéglátó blokk sötét (a sorrendtől függetlenül)
  return (
    <>
    {/* a ráközelítés jelölője — mindig a DOM-ban (a useScroll célja nem lehet üres), csak a ragadós sornál 200svh magas */}
    <div ref={pinTl} aria-hidden className={`pointer-events-none absolute w-px ${pin ? 'h-[200svh]' : 'h-px'}`} />
    <div ref={rowRef} style={pin ? { top } : undefined} className={`${pin ? 'sticky z-0' : 'relative z-10'} ${dark ? 'bg-ui-dark py-14 text-white lg:py-20' : 'bg-white py-8 lg:py-10'}`}>
    <motion.div {...inView} variants={stagger(0.08)} className="mx-auto grid w-full max-w-6xl items-center gap-6 px-4 lg:grid-cols-2 lg:gap-12 lg:px-5">
      {/* fotó */}
      <motion.div variants={rise} ref={ref} className={`relative aspect-[4/3] overflow-clip rounded-ui-card ${dark ? 'bg-white/5' : 'bg-ui-cell'} lg:aspect-auto lg:h-[480px] ${flip ? 'lg:order-2' : ''}`}>
        <div ref={tl} aria-hidden className="pointer-events-none absolute inset-0" />
        {pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <motion.img key={narrow ? 'n' : 'w'} style={{ transform: zoomT }} src={side.photo} alt={side.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center will-change-transform" />
        ) : (
        <motion.div style={{ transform: parT }} className="absolute -inset-y-[14%] inset-x-0 will-change-transform">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={side.photo} alt={side.alt} loading="lazy" decoding="async" className="h-full w-full object-cover object-center" />
        </motion.div>
        )}
        <div className={`absolute bottom-4 ${flip ? 'right-4' : 'left-4'}`}>
          <motion.div {...card$} className={`w-[230px] rounded-ui-card p-4 text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,.45)] backdrop-blur-2xl lg:w-[250px] ${dark ? 'bg-ui-dark/90' : 'bg-ui-dark/45'}`}> {/* ui-allow: sötét üveg-kártya (a főoldali jógás kép kártyája) */}
            <div className="flex items-center justify-between">
              <span className="text-ui-meta text-white/75">{row.card.label}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-white/15 text-white"><row.card.icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.8} /></span> {/* ui-allow: ikon-csempe */}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5 text-[32px] font-light leading-none tracking-[-0.04em]"><NumberRoll value={rolled ? row.card.to(trialDays) : row.card.from} /><span className="text-ui-row font-normal tracking-normal text-white/80">{row.card.unit}</span></div> {/* ui-allow: nagy szám */}
            <div className="mt-1.5 text-ui-meta text-white/75">{row.card.sub}</div>
            {/* a Google-értékelésünk: az 5 csillag egyenként felvillan, mellette a valós pontszám (csak valós adattal) */}
            <motion.div variants={stagger(0.07)} className="mt-3 flex items-center gap-2 border-t border-dashed border-white/25 pt-2.5">
              <span className="flex gap-0.5 text-ui-yellow">{[0, 1, 2, 3, 4].map((i) => <motion.span key={i} variants={pop}><SharpStar className="h-3.5 w-3.5" /></motion.span>)}</span>
              <span className="whitespace-nowrap text-ui-meta text-white/75">{rating ? `${rating.rating.toFixed(1).replace('.', ',')} · Google-értékelés` : 'Google-értékelés'}</span>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* tartalom */}
      <div className="flex flex-col">
        <motion.span variants={rise} className={`inline-flex items-center self-start rounded-[8px] px-3.5 py-1.5 text-[14px] font-medium ${dark ? 'bg-white/10 text-white/80' : 'bg-ui-yellow/15 text-ui-text/80'}`}>{row.eyebrow}</motion.span> {/* ui-allow: szakasz-címke (a SectionHead pillje) */}
        <motion.h3 variants={rise} className="mt-3 text-[clamp(1.8rem,3vw,42px)] font-medium leading-[1.05] tracking-[-0.035em]">{row.title}</motion.h3> {/* ui-allow: nagy sorcím */}
        <motion.p variants={rise} className={`mt-3 max-w-[520px] text-ui-row leading-[1.55] ${dark ? 'text-white/70' : 'text-ui-text/75'}`}>{body}</motion.p> {/* ui-allow: bevezető */}
        <motion.div variants={stagger(0.03)} className="mt-4 flex max-w-[520px] flex-wrap gap-1">
          {side.links.map((l) => (
            <motion.span key={l.slug} variants={pop}>
              <Link href={`/${l.slug}`} className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-ui-label font-medium transition-colors ${dark ? 'bg-white/10 text-white/85 hover:bg-white hover:text-ui-dark' : 'bg-[#F7F7F7] text-ui-text/80 hover:bg-ui-dark hover:text-white'}`}>
                {INDUSTRY_SHORT_LABEL[l.slug] ?? l.slug}<ArrowUpRight aria-hidden className="h-2.5 w-2.5 opacity-50" strokeWidth={2} />
              </Link>
            </motion.span>
          ))}
        </motion.div>

        <motion.div variants={rise} className={`mt-6 flex items-end justify-between gap-3 ${flip ? 'flex-row-reverse' : ''}`}>
          <div className={`flex w-[100px] flex-col gap-1.5 ${flip ? 'items-end text-right' : ''}`}>
            <Zap aria-hidden className="h-5 w-5 fill-ui-yellow text-ui-yellow" strokeWidth={1.5} />
            <span className={`text-ui-meta font-medium leading-snug ${dark ? 'text-white' : 'text-ui-text'}`}>{row.feature}</span>
          </div>
          {/* a két kép együtt a külső szélen (a tükrözött sorban a bal oldalon) */}
          <div className={`flex items-end gap-3 ${flip ? 'flex-row-reverse' : ''}`}>
          <Link href={`/${row.circle.slug}`} className="group relative block h-[96px] w-[96px] shrink-0 overflow-hidden rounded-full lg:h-[110px] lg:w-[110px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={marquee(row.circle.slug)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
            <span className="absolute inset-0 flex items-center justify-center bg-ui-dark/30 text-ui-meta font-medium text-white transition-colors group-hover:bg-ui-dark/45">{row.circle.label}</span> {/* ui-allow: fotó-sötétítés */}
          </Link>
          <div className="relative h-[136px] w-[96px] shrink-0 overflow-hidden rounded-ui-inner lg:h-[160px] lg:w-[112px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={marquee(row.small)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
    </div>
    </>
  )
}

/** A két célcsoport egymás alatt, egy-egy szerkesztőségi sorban (a második tükrözve). */
export function AudienceRows({ salon, restaurant, rating, trialDays = 14 }: Props & { trialDays?: number }) {
  const body = { salon, restaurant }
  return (
    // az első sor ragadós (megáll, ráközelít), a második fehér háttérrel rácsúszik — mint a főoldali jógás kép
    <div className="relative">
      {ROWS.map((r, i) => <AudienceRow key={r.side.key} row={r} body={body[r.side.key]} flip={i % 2 === 1} rating={rating} trialDays={trialDays} pin={i === 0} />)}
    </div>
  )
}
