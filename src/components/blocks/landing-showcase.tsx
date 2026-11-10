'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { COVER_OFFSET, padRange } from '@/lib/scrollOffset'
import { Card, Pill } from '@/components/ui-kit'
import { CoverStage } from '@/components/landing/CoverStage'
import { GROUP_COVERS, GROUP_PARTS } from './covers'
import { FEATURE_GROUPS, groupHref } from '@/lib/landingFeatures'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
import { EASE } from '@/lib/motion'
import { FitCard } from '@/components/landing/FitCard'
import { sectionShot } from '@/components/landing/designVisuals'
import { MobileDayStrip, MobileDayTimeline, type DayRow } from './overview'

/**
 * Funkció-színpad (design: Landing › Funkció-színpad) — a főoldal hat csoport-szakasza helyett egy „scrollytelling”:
 * balra a hat csoport listája, jobbra egy rögzített színpad. Görgetésre a következő csoport kiemelődik (alatta a
 * rövid szöveg és a funkció-pillek), a színpadon a jelenet (a csoport borítója: fő kártya + lebegő második, design 2.14)
 * átúszik a következőre. Mobilon (lg alatt) egyszerű egymásutánban: cím, szöveg, jelenet.
 */
export function FeatureShowcase({ className = '' }: { className?: string }) {
  const groups = FEATURE_GROUPS.filter((g) => GROUP_COVERS[g.id])
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [idx, setIdx] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setIdx(Math.min(groups.length - 1, Math.max(0, Math.floor(v * groups.length)))))
  const g = groups[idx]

  return (
    <div className={className}>
      {/* desktop: rögzített színpad, csoportonként egy képernyőnyi görgetés */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${groups.length * 85}vh` }}>
        <div className="sticky top-0 flex h-screen items-center gap-12">
          <div className="w-[34%] shrink-0 space-y-2">
            {groups.map((x, i) => {
              const on = i === idx
              const Icon = x.icon
              return (
                <div key={x.id} className={`transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-35'}`}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-ui-text" strokeWidth={1.6} />
                    <span className={`font-light leading-tight text-ui-text transition-all duration-300 ${on ? 'text-ui-page' : 'text-ui-sub'}`}>{x.label}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
                        <p className="mt-2 max-w-[380px] text-ui-body text-ui-muted">{x.tagline}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5 pb-3">{x.items.slice(0, 5).map((f) => <Pill key={f.slug} tone="white" size="sm">{f.title}</Pill>)}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="relative aspect-[1600/948] overflow-hidden rounded-ui-container bg-ui-page">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={g.id} className="absolute inset-0"
                  initial={{ opacity: 0, y: 60, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -60, scale: 0.97 }}
                  transition={{ duration: 0.55, ease: EASE }}>
                  <CoverStage>{GROUP_COVERS[g.id]}</CoverStage>
                </motion.div>
              </AnimatePresence>
            </div>
            {/* hol tartunk: a csoportok pöttyei */}
            <div className="mt-4 flex justify-center gap-1.5">{groups.map((x, i) => <span key={x.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-ui-dark' : 'w-1.5 bg-ui-grey'}`} />)}</div>
          </div>
        </div>
      </div>

      {/* mobil: egymás alatt */}
      <div className="space-y-10 lg:hidden">
        {groups.map((x) => (
          <div key={x.id}>
            <div className="text-ui-sub font-light text-ui-text">{x.label}</div>
            <p className="mt-1 text-ui-body text-ui-muted">{x.tagline}</p>
            <div className="relative mt-4 aspect-[1600/948] overflow-hidden rounded-ui-card bg-ui-page"><CoverStage>{GROUP_COVERS[x.id]}</CoverStage></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Kigyulladó szöveg (design: Landing › Kigyulladó szöveg) — Apple-stílusú átvezető: egy nagy mondat szavai görgetésre
 * egyenként „kigyulladnak” halványszürkéből a szövegszínre; alatta a hat csoport jelenete sorban beúszik.
 */
function RevealWord({ word, i, n, progress, a, b }: { word: string; i: number; n: number; progress: MotionValue<number>; /** a szöveg sávja a cover-progresszen belül */ a: number; b: number }) {
  const start = a + (i / n) * (b - a), end = a + ((i + 1) / n) * (b - a)
  const opacity = useTransform(progress, ...padRange([start, end], [0.18, 1]))
  // rendes szóköz a szavak között (az inline-block margója nem jelent meg)
  return <><motion.span style={{ opacity }} className="inline-block">{word}</motion.span>{' '}</>
}
export function RevealText({ text = 'Foglalás, naptár, vendégek, pénz, marketing és csapat — egy helyen, egy appban, a te arculatoddal.', className = '', covers = true, lead, textClass }: { text?: string; className?: string; /** false: csak a szöveg, a 6 borító-rács nélkül */ covers?: boolean
  /** a szöveg elé, sorban (pl. a logó) */ lead?: React.ReactNode
  /** a szöveg betűméret / súly / sorköz osztályai (alapból a nagy, vékony landing-szöveg) */ textClass?: string }) {
  // natív (hardveres) görgetés: a framer csak a beépített sávokat gyorsítja, ezért 'cover'-t figyelünk (COVER_OFFSET), és
  // a régi sávot ('start 0.85' → 'end 0.35') a szöveg és a képernyő magasságából számoljuk át: cover-progressz =
  // (vh − top) / (vh + H) → a = 0,15·vh / (vh+H), b = (0,65·vh + H) / (vh+H). Átméretezéskor újraszámol (a szavak újracsatolnak).
  const ref = useRef<HTMLDivElement>(null)
  const tl = useRef<HTMLSpanElement>(null)
  const { scrollYProgress } = useScroll({ target: tl, offset: COVER_OFFSET })
  const [ab, setAb] = useState<{ a: number; b: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const vh = window.innerHeight, H = el.offsetHeight
      const nxt = { a: (0.15 * vh) / (vh + H), b: (0.65 * vh + H) / (vh + H) }
      setAb((cur) => (cur && Math.abs(cur.a - nxt.a) < 0.005 && Math.abs(cur.b - nxt.b) < 0.005 ? cur : nxt))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [])
  const words = text.split(' ')
  const groups = FEATURE_GROUPS.filter((g) => GROUP_COVERS[g.id])
  return (
    <div className={className}>
      <div ref={ref} className={`relative ${textClass ?? 'max-w-[980px] text-ui-num font-light leading-tight text-ui-text lg:text-ui-page'}`}>
        <span ref={tl} aria-hidden className="pointer-events-none absolute inset-0" />
        {lead}{lead && ' '}{ab
          ? words.map((w, i) => <RevealWord key={`${i}-${ab.a.toFixed(3)}-${ab.b.toFixed(3)}`} word={w} i={i} n={words.length} progress={scrollYProgress} a={ab.a} b={ab.b} />)
          // mérés előtt (szerveren / első képkocka): halvány szavak, ugyanúgy, mint a sáv elején
          : words.map((w, i) => <span key={i}><span className="inline-block opacity-[0.18]">{w}</span>{' '}</span>)}
      </div>
      {covers && <div className="mt-10 grid gap-[5px] md:grid-cols-2 lg:grid-cols-3">
        {groups.map((x, i) => (
          <motion.div key={x.id} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: EASE, delay: (i % 3) * 0.08 }}>
            <div className="relative aspect-[1600/948] overflow-hidden rounded-ui-card bg-ui-page"><CoverStage>{GROUP_COVERS[x.id]}</CoverStage></div>
            <div className="mt-2 px-1 text-ui-body text-ui-text">{x.label}</div>
          </motion.div>
        ))}
      </div>}
    </div>
  )
}

/**
 * Funkció-fejezetek (design: Landing › Funkció-fejezetek) — a theplacestudio „sticky-scroll” mintájára, pörgősen
 * (nincs megállítás): csoportonként egy kétoszlopos sor. Balra a csoport nagy címe, alatta a leírás és a funkció-pillek;
 * jobbra a csoport két kártyája (a borító fő és lebegő kártyája külön), amik odaérve rugósan „kipattannak” a tartalom
 * felől, egymás után. Görgetés közben a két oldal ellentétes irányba csúszik (parallax), és a sor be- / kiúszik.
 * Mobilon egymás alatt, parallax nélkül.
 */
/** A csoport két kártyája a 800×474-es jelenetben, a hely szélességére kicsinyítve — levágás NÉLKÜL (a lebegő kártya
 *  kilóghat a jelenetből; a borító-változat, a CoverStage, levágja). */
/** A csoport két kártyája EGYMÁS MELLETT, a saját (természetes) méretükben elrendezve; ha nem férnek el a hely
 *  szélességében, a kettő együtt kicsinyül (soha nem nagyít, nem vág le). A magasság a magasabb kártyáé. */
function ChapterStage({ id, extra }: { id: string; /** a kis kép: minden fejezetben ugyanott — a fő kártya bal alsó sarkán, kicsit ráülve */ extra?: React.ReactNode }) {
  const p = GROUP_PARTS[id]
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLDivElement>(null)
  const [sz, setSz] = useState({ k: 0.8, w: 800, h: 474, bw: 800, mh: 400 })
  useLayoutEffect(() => {
    const el = box.current, inn = inner.current
    if (!el || !inn) return
    const measure = () => {
      const w = inn.scrollWidth, h = inn.offsetHeight
      setSz({ k: Math.min(1, el.clientWidth / Math.max(1, w)), w, h, bw: el.clientWidth, mh: main.current?.offsetHeight ?? h })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el); ro.observe(inn); if (main.current) ro.observe(main.current)
    return () => ro.disconnect()
  }, [])
  const spring = { type: 'spring' as const, stiffness: 240, damping: 16, mass: 0.9 }
  return (
    <div ref={box} className="pointer-events-none relative select-none" style={{ height: sz.h * sz.k }} aria-hidden>
      {/* a kis kép a fő kártya bal szélénél kicsit kijjebb, a teteje a fő kártya aljánál 40 px-szel feljebb */}
      {extra && <div className="absolute z-20 w-[30%]" style={{ left: sz.bw - sz.w * sz.k - sz.bw * 0.08, top: sz.mh * sz.k - 40 }}>{extra}</div>}
      <div ref={inner} className="absolute right-0 top-0 flex w-max origin-top-right items-start" style={{ transform: `scale(${sz.k})` }}>
        <motion.div ref={main} className="shrink-0" style={{ width: p.mainW ?? 520 }}
          variants={{ hidden: { opacity: 0, x: -90, scale: 0.9 }, show: { opacity: 1, x: 0, scale: 1, transition: spring } }}>{p.main}</motion.div>
        <motion.div className="relative z-10 -ml-24 mt-12 shrink-0 [&>*]:shadow-ui-float" style={{ width: p.floatW ?? 330 }}
          variants={{ hidden: { opacity: 0, x: -140, y: 40, scale: 0.8, rotate: -4 }, show: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, transition: { ...spring, delay: 0.18 } } }}>{p.float}</motion.div>
      </div>
    </div>
  )
}

/** fejezetenként legfeljebb 3 kártya: a két nagy + 1 kis kép (Dave, 2026-11-08); ezek nem kerülnek a szórt kis képek közé (pl. a magas mobilos szerkesztő — Dave, 2026-11-08) */
const SCATTER_SKIP = new Set(['bemutatkozo-weboldal', 'beosztas', 'szabadsag', 'vendegkartya', 'feketelista', 'eloleg', 'emlekeztetok', 'gyors-felvetel', 'jovahagyas', 'offline-mod'])
/** a szórt kis képek között egyszerűbb változat (Dave, 2026-11-08) */
const SCATTER_SHOT: Record<string, () => React.ReactNode> = { 'elo-asztalallapot': () => <DayTimelineShot /> }

/** A nap idővonala (design 6.11, 1. telefon tartalma, keret nélkül) — a kis szórt képek közé. */
const DAY_ROWS: DayRow[] = [
  { t: '09:00', st: 'past', ev: { n: 'Gál Zsófia', s: '09:30–10:30 · Hajvágás', tone: 'dark', dot: 'bg-ui-yellow' }, badge: 2 },
  { t: '10:00' },
  { t: '11:00', ev: { n: 'Kiss Réka', s: '11:00–12:00 · Géllakk', tone: 'light', dot: 'bg-ui-dark' } },
  { t: '12:00', st: 'now', ev: { n: 'Juhász Hanna', s: '12:00–13:00 · Balayage', tone: 'light', dot: 'bg-ui-yellow', avatars: ['/landing/funkciok/csapat/avatar/viktoria.webp', '/landing/funkciok/csapat/avatar/csaba.webp'] } },
  { t: '13:00' },
]
export function DayTimelineShot({ className = '' }: { className?: string }) {
  return <Card className={`w-[360px] ${className}`}><MobileDayStrip /><MobileDayTimeline rows={DAY_ROWS} more={false} /></Card>
}
function Chapter({ g, first = false }: { g: (typeof FEATURE_GROUPS)[number]; first?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // a theplacestudio sticky-scroll értékei: a cím annyit csúszik lefelé, amennyit az oldal felfelé — szinte helyben áll
  // és ott cserélődik; a kártyák közben felfelé futnak. A cím a sor közepén eltűnik, a kártyák a második felében.
  // a sor közepén (0,5) a két oldal egy vonalban — onnan csúsznak ellentétes irányba
  // pontosan a theplacestudio StickyScroll értékei: a szöveg lefelé csúszik (+250, így „ott marad”) és 0,7-nél eltűnik,
  // a kártyák felfelé futnak (−200) és látszanak végig (csak az első fejezetben jönnek be halványulva) — így a következő
  // fejezet „felhúzza” az előzőt, nem futószalagként jönnek egymás után
  // ugyanakkora utat tesznek meg, mint ott, csak a sor közepére (0,5) igazítva — így a jobb oldal nem ül magasabban
  const yText = useTransform(scrollYProgress, [0, 1], [-125, 125])
  const yStage = useTransform(scrollYProgress, [0, 1], [100, -100])
  const textOpacity = useTransform(scrollYProgress, [0, 0.05, 0.5, 0.7, 1], [0, 1, 1, 0, 0])
  const firstOpacity = useTransform(scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0, 0, 1, 1, 0])
  const stageOpacity = first ? firstOpacity : 1
  const Icon = g.icon
  return (
    <motion.div ref={ref} id={`funkcio-${g.slug}`} initial="hidden" whileInView="show" viewport={{ once: false, amount: 0.35 }}
      className="relative my-40 flex items-center justify-between gap-10">
      {/* a design funkció-szakaszának mintája (landing-featuregroup): felirat, nagy vékony cím, bekezdés, funkció-lista */}
      <motion.div style={{ y: yText, opacity: textOpacity }} className="w-[34%] max-w-[440px] shrink-0">
        <span className="inline-flex items-center gap-2 rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-ui-text"><Icon className="h-4 w-4" strokeWidth={1.8} />{g.label}</span> {/* ui-allow: a landing szakasz-címkéje (élesben így: 8 px, 14 px — landing/sections) */}
        <h2 className="mt-5 text-ui-sub font-light text-ui-text lg:text-ui-page">{g.cta?.title ?? g.h1}</h2>
        <p className="mt-3 max-w-[380px] text-ui-row text-ui-muted">{g.cta?.lead ?? g.lead}</p>
        <div className="mt-5 flex max-w-[380px] flex-col gap-1">
          {g.items.slice(0, 6).map((f) => {
            const FIcon = f.icon
            return (
              <span key={f.slug} className="flex items-center gap-3 px-1 py-1.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ui-control bg-white text-ui-text"><FIcon aria-hidden className="h-4 w-4" strokeWidth={1.9} /></span>
                <span className="text-ui-row text-ui-text">{f.title}</span>
              </span>
            )
          })}
        </div>
        {/* a csoport aloldala (belső link — a régi szekciók „… részletesen” gombja) */}
        <div className="mt-6"><HeroButton href={groupHref(g)} label={`${g.label} részletesen`} /></div>
      </motion.div>
      {/* a képek a jobb szélre kerülnek, a két oszlop közti hely automatikus */}
      <motion.div style={{ y: yStage, opacity: stageOpacity }} className="relative w-[60%] min-w-0">
        {/* a csoport egy további funkció-képe kisebben, a fő kártyára ráülve (minden fejezetben ugyanott); a két nagy után kipattan */}
        <ChapterStage id={g.id} extra={g.items.filter((f) => !SCATTER_SKIP.has(f.slug)).map((f) => SCATTER_SHOT[f.slug]?.() ?? sectionShot(f.slug)).find(Boolean) && (
          <motion.div variants={{ hidden: { opacity: 0, y: 50, scale: 0.7, rotate: 0 }, show: { opacity: 1, y: 0, scale: 1, rotate: -3, transition: { type: 'spring', stiffness: 260, damping: 14, delay: 0.35 } } }}>
            <FitCard w={460}>{g.items.filter((f) => !SCATTER_SKIP.has(f.slug)).map((f) => SCATTER_SHOT[f.slug]?.() ?? sectionShot(f.slug)).find(Boolean)}</FitCard>
          </motion.div>
        )} />
      </motion.div>
    </motion.div>
  )
}
export function FeatureChapters({ className = '' }: { className?: string }) {
  const groups = FEATURE_GROUPS.filter((g) => GROUP_PARTS[g.id])
  return (
    <div className={className}>
      <div className="hidden lg:block">{groups.map((g, i) => <Chapter key={g.id} g={g} first={i === 0} />)}</div>
      <div className="space-y-12 lg:hidden">
        {groups.map((g) => (
          <motion.div key={g.id} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
            <div className="text-ui-sub font-light text-ui-text">{g.label}</div>
            <p className="mt-1 text-ui-body text-ui-muted">{g.tagline}</p>
            <div className="mt-4 overflow-hidden rounded-ui-card bg-ui-page"><ChapterStage id={g.id} /></div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
