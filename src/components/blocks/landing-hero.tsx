'use client'

import { useState, useEffect, useLayoutEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { useScrollHide } from '@/components/landing/useScrollHide'
import { ArrowRight } from 'lucide-react'
import { EASE, SPRING_QUICK, SPRING_SNAPPY, buttonHover } from '@/lib/motion'
import { type LandingPricing } from '@/components/landing/types'
import { BrandLogo } from '@/components/BrandLogo'
import { Button, IconCircle, Pill } from '@/components/ui-kit'
import { FitCard } from '@/components/landing/FitCard'
import { MenuToggle, MobileMenu } from './landing-nav'
import { MegaPanel, MegaTrigger, useMegaMenu } from './landing-megamenu'

// A „Funkciók” és „Kinek” lenyíló (NavMegaMenu) előtt álló sima horgony-linkek.
// `href` = külön aloldalra visz (nem a főoldali szekcióra görget)
const HERO_LINKS: { id: string; label: string; href?: string }[] = [
  { id: 'arazas',     label: 'Árak', href: '/arak' },
  { id: 'tippek',     label: 'Tippek', href: '/tippek-es-cikkek' },
  { id: 'kapcsolat',  label: 'Kapcsolat', href: '/kapcsolat' },
]
const NAV_OFFSET = 60

// ─── HeroNav — hero-ba épített navigáció (nem sticky) ────────────────────────
export function HeroNav({ theme = 'dark', pillId = 'hero-nav-pill', variant = 'pill' }: {
  theme?: 'dark' | 'light'; pillId?: string
  /** `plain`: sötét, videó nélküli hero-kon — doboz nélküli, fehér szöveges linkek + fehér CTA (Optivio-minta) */
  variant?: 'pill' | 'plain'
}) {
  const plain = variant === 'plain'
  const onDark = theme === 'dark'
  const [active, setActive]     = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted]   = useState(false)
  const [togglePos, setTogglePos] = useState<{ top: number; right: number } | null>(null)
  const [logoPos, setLogoPos]     = useState<{ top: number; left: number } | null>(null)
  const [animatedOpen, setAnimatedOpen] = useState(false)
  const toggleRef     = useRef<HTMLDivElement>(null)
  const logoRef       = useRef<HTMLDivElement>(null)
  const pendingTarget = useRef<string | null>(null)
  // Funkciók / Kinek lenyíló — a panel a menüsor alja alá kerül (mérve nyitáskor)
  const mega = useMegaMenu()
  const rowRef = useRef<HTMLDivElement>(null)
  const [megaTop, setMegaTop] = useState(0)
  const pillRef = useRef<HTMLDivElement>(null)
  // a panel helyét a kirajzolás ELŐTT mérjük (layout effect) — különben az első képkockán rossz
  // helyen jelenne meg és a helyére ugrana
  useLayoutEffect(() => {
    if (mega.open && rowRef.current) setMegaTop(rowRef.current.getBoundingClientRect().bottom)
  }, [mega.open])
  useEffect(() => {
    if (!mega.open) return
    const onScroll = () => mega.setOpen(null)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mega.open])

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
    const visible = new Set<string>()
    const obs = new IntersectionObserver(
      (entries) => {
        if (pendingTarget.current) return
        entries.forEach(e => {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        })
        if (visible.size === 0) {
          setActive('')
        } else {
          const top = [...visible]
            .map(id => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top ?? Infinity }))
            .sort((a, b) => a.top - b.top)[0]
          setActive(top.id)
        }
      },
      { rootMargin: `-${NAV_OFFSET + 8}px 0px -40% 0px`, threshold: 0 },
    )
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    // aloldalon (pl. /funkciok/...) nincs ilyen szekció → a főoldal megfelelő részére
    if (!el) { window.location.href = `/#${id}`; return }
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
      <div ref={rowRef} className="flex w-full items-center justify-between gap-4">
        {/* Logó — ref a pozíció méréséhez */}
        <div ref={logoRef} className="shrink-0">
          <Link href="/" aria-label="davelopment booking">
            <BrandLogo variant={theme === 'dark' ? 'dark' : 'light'} className="h-[26px]" />
          </Link>
        </div>

        {/* Desktop pill menü + Szolgáltatások gomb */}
        <div ref={pillRef} data-mega-root className={`hidden min-[1033px]:flex items-center gap-0 rounded-full p-[3px] ${plain ? 'ml-auto mr-2' : theme === 'dark' ? 'bg-white/80 backdrop-blur-md' : 'bg-white'}`}>
          {([['features', 'Funkciók'], ['audience', 'Kinek']] as const).map(([id, label]) => (
            <MegaTrigger
              key={id}
              id={id}
              label={label}
              mega={mega}
              layoutId={pillId}
              activeCls={plain ? (onDark ? 'bg-white/10' : 'bg-black/[0.06]') : 'bg-ui-dark'}
              activeTextCls={plain && !onDark ? 'text-ui-text' : 'text-white'}
              inactiveTextCls={plain ? (onDark ? 'text-white/75 hover:text-white' : 'text-ui-muted hover:text-ui-text') : 'text-ui-text'}
              className="px-3 py-2 font-onest font-medium text-ui-body leading-5"
            />
          ))}
          {HERO_LINKS.map(({ id, label, href }) => {
            const isActive = active === id && !mega.open
            return (
              <motion.a key={id} href={href ?? `#${id}`} onClick={href ? undefined : (e) => onDesktopClick(e, id)}
                variants={buttonHover} initial="rest" whileHover="hover"
                className={`relative flex items-center px-3 py-2 font-onest font-medium text-ui-body leading-5 transition-colors ${plain ? (onDark ? (isActive ? 'text-white' : 'text-white/75 hover:text-white') : (isActive ? 'text-ui-text' : 'text-ui-muted hover:text-ui-text')) : isActive ? 'text-white' : 'text-ui-text'}`}>
                {isActive && (
                  <motion.span aria-hidden layoutId={pillId}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    className={`absolute inset-0 rounded-full ${plain ? (onDark ? 'bg-white/10' : 'bg-black/[0.06]') : 'bg-ui-dark'}`} />
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
              className="hidden min-[1033px]:inline-flex text-ui-body font-medium text-ui-muted hover:text-ui-text transition-colors px-1"
            >
              Bejelentkezés
            </Link>
          )}
          {plain ? (
            // Optivio-minta: fehér kapszula, sárga kör a nyíllal (a landing gombnyelve, kicsiben)
            <motion.a
              href="/register"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className={`hidden min-[1033px]:inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 font-onest text-ui-body font-medium ${onDark ? 'bg-white text-ui-text' : 'bg-ui-dark text-white'}`}
            >
              Próbáld ki ingyen
              <IconCircle tone="yellow" size="sm" className="relative overflow-hidden">
                <motion.span className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 30 } }} transition={{ duration: 0.28, ease: EASE }}><ArrowRight className="h-4 w-4 text-ui-text" /></motion.span>
                <motion.span className="absolute flex" variants={{ rest: { x: -30 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}><ArrowRight className="h-4 w-4 text-ui-text" /></motion.span>
              </IconCircle>
            </motion.a>
          ) : (
            <Button variant="dark" href="/register" className="hidden min-[1033px]:inline-flex">Próbáld ki ingyen</Button>
          )}
          {/* Inline toggle — scrollozik a navval, referenciapontként szolgál */}
          <div ref={toggleRef}>
            <MenuToggle open={menuOpen} onClick={handleToggle} ghost ink={theme === 'light'} />
          </div>
        </div>
      </div>

      <MegaPanel mega={mega} top={megaTop} anchorRef={pillRef} />

      {mounted && createPortal(
        <AnimatePresence>
          {menuOpen && <MobileMenu active={active} onPick={onMobileClick} onClose={() => setMenuOpen(false)} />}
        </AnimatePresence>,
        document.body,
      )}

      {/* Portál logó — a MobileMenu (z-80) felett (z-90), pontosan ott ahol az inline logo volt */}
      {mounted && logoPos && createPortal(
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed min-[1033px]:hidden" style={{ top: logoPos.top, left: logoPos.left, zIndex: 90 }}>
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
            <div className="fixed min-[1033px]:hidden" style={{ top: togglePos.top, right: togglePos.right, zIndex: 90 }}>
              <MenuToggle open={animatedOpen} onClick={handleToggle} ghost ink={theme === 'light'} />
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

    </>
  )
}

// ─── Aloldal-fejléc ───────────────────────────────────────────────────────────
/** Ugyanaz a menüsor (világos téma) az aloldalakra (pl. /funkciok) — ragadós; lefelé görgetéskor
 *  elbújik, felfelé előjön (a lap tetején mindig látszik). */
export function SiteNav() {
  const y = useScrollHide({ revealAbove: 80 })
  return (
    <motion.div
      className="sticky top-0 z-[60] bg-ui-cell/90 px-4 py-2.5 backdrop-blur-md lg:px-5"
      style={{ y }}
    >
      <HeroNav theme="light" pillId="site-nav-pill" variant="plain" />
    </motion.div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
export function Hero({
  pricing,
  title,
  subtitle,
  miniPairs,
  embedded = false,
}: {
  /** a /design mintában: nincs a body-ra portálozott rögzített menü, és a hero nem viewport-magas */
  embedded?: boolean
  pricing: LandingPricing
  /** A videó melletti mini-kártyák párjai a design-kártyákból (src/components/blocks) — megadva a régiek helyett. */
  miniPairs?: [React.ReactNode, React.ReactNode][]
  /** Iparági landingeknél felülírja a homepage-alapértelmezett címet/alcímet (pl. fodrász-specifikus üzenet). */
  title?: React.ReactNode
  subtitle?: React.ReactNode
}) {
  const [pairIdx, setPairIdx] = useState(0)
  const [mounted, setMounted] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const heroInView = useInView(sectionRef, { once: false, amount: 0 })
  // a fix menü a hero után a görgetést követve bújik el / jön elő (lefelé ki, felfelé vissza)
  const navY = useScrollHide({ startHidden: true })

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const t = setInterval(() => setPairIdx(i => (i + 1) % (miniPairs?.length || 1)), 5200)
    return () => clearInterval(t)
  }, [miniPairs?.length])

  const kit = miniPairs?.[pairIdx % miniPairs.length]

  return (
    <>
      {/* Fixed nav — portálra renderelve a body-ra, hogy kiszabaduljon a
          `relative z-10` stacking contextből (HomeClient), és ne takarják el
          az alatta lévő szekciók (Marquee, SegmentToggle, modal-ok). */}
      {mounted && !embedded && createPortal(
        <AnimatePresence>
          {!heroInView && (
            <motion.div
              className="fixed inset-x-0 top-0 z-[60] bg-ui-cell"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ y: navY }}
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
        className={`relative flex flex-col overflow-hidden rounded-ui-container px-5 lg:px-8 ${embedded ? 'h-[720px]' : 'h-[calc(100svh-32px)]'}`}
        // a videó mögött majdnem fekete, meleg háttér — a ui-dark (középszürke) szürke fátyolt húzott a félig átlátszó videóra
        style={{ background: 'linear-gradient(241deg, #141210 2.7%, #1e1b14 100%)' }} // ui-allow: a videó háttere (képkezelés, nem felületi szín)
      >
        {/* Videó — a webm ugyan kisebb, de alacsonyabb frissítésű/szaggatott, a felhasználó
            visszajelzése alapján NE azt használjuk — az mp4 a jó minőségű (60fps) verzió, marad
            az egyetlen forrás. `preload="metadata"` — csak a poster/metaadat töltődik azonnal,
            maga a videó csak akkor, amikor a böngésző ténylegesen lejátszásra készül. */}
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
          autoPlay muted loop playsInline aria-hidden preload="metadata"
          poster="/videos/szalon-foglalas-hatter-poster.jpg"
        >
          <source src="/videos/szalon-foglalas-hatter.mp4" type="video/mp4" />
        </video>

        {/* Mobil overlay — egyszerű dim, blur nélkül (GPU) */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] lg:hidden"
          style={{ background: 'linear-gradient(to right, rgba(10,8,5,.58) 0%, rgba(10,8,5,.42) 60%, rgba(10,8,5,.18) 100%)' }} // ui-allow: a videó sötétítése
        />
        {/* Desktop overlay — bal oldali mask-blur, jobb oldal érintetlen */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] hidden backdrop-blur-[11px] [mask-image:linear-gradient(to_right,black_0%,black_32%,transparent_46%)] lg:block"
          style={{ background: 'linear-gradient(to right, rgba(10,8,5,.46) 0%, rgba(10,8,5,.38) 28%, rgba(10,8,5,.03) 42%, transparent 54%)' }} // ui-allow: a videó sötétítése (bal oldal, a szöveg alatt)
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
            className="self-start"
          >
            <Pill tone="onDark" size="lg" className="backdrop-blur-xl">Próbáld ki {pricing.trial_days} napig ingyen.</Pill>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.35 }}
            className="flex flex-col gap-5"
          >
            <h1 className="font-onest font-light text-ui-num lg:text-ui-page text-white">
              {title ?? (
                <>
                  Nem csak a vendégeidnek.{' '}
                  <br className="hidden lg:block" />
                  A csapatodnak is.
                </>
              )}
            </h1>
            <p className="font-onest text-ui-body lg:text-ui-title leading-relaxed text-white/65">
              {subtitle ?? (
                <>
                  Foglalj. Vezess csapatot. Számolj bért.
                  <br />
                  Az egyetlen app amire egy üzletnek szüksége van.
                </>
              )}
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
              className="inline-flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-5 pr-2.5 font-onest font-medium text-ui-row text-ui-text"
            >
              Ingyenes regisztráció
              <IconCircle tone="yellow" size="md" className="relative overflow-hidden">
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px] text-ui-dark" />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px] text-ui-dark" />
                </motion.div>
              </IconCircle>
            </motion.a>

            {/* Másodlagos gomb — sötét */}
            <motion.a
              href="/login"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex items-center gap-2.5 rounded-full bg-white/10 py-2.5 pl-5 pr-2.5 font-onest font-medium text-ui-row text-white backdrop-blur-sm"
            >
              Bejelentkezés
              <IconCircle tone="yellow" size="md" className="relative overflow-hidden">
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px] text-ui-dark" />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px] text-ui-dark" />
                </motion.div>
              </IconCircle>
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
                {kit && <FitCard w={360} className="w-[230px]">{kit[0]}</FitCard>}
              </motion.div>

              {/* Alsó kártya — balra (belül) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.4 }}
              >
                {kit && <FitCard w={360} className="w-[230px]">{kit[1]}</FitCard>}
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
