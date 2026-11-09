'use client'

import { IconCircle } from '@/components/ui-kit'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE } from '@/lib/motion'
import { BrandLogo } from '@/components/BrandLogo'
import { RollButton } from './landing-buttons'
import { MobileMegaAccordion } from './landing-megamenu'

/**
 * Ragadós felső navigáció: logó · középső fehér-pill menü · jobb CTA + Bejelentkezés.
 * Scroll után tömör fehér háttér (az átlátszó/blurolt háttér a szürke oldalon szürkés volt).
 * Mobilon hamburger → full-screen panel, a linkek staggerrel.
 */

// Konverzió-optimalizált sorrend: funkciók megértése → ár → bizalom → kérdések
const LINKS: { id: string; label: string; href?: string }[] = [
  { id: 'hogyan', label: 'Funkciók' },
  { id: 'arazas', label: 'Árak', href: '/arak' },
  { id: 'tippek', label: 'Tippek', href: '/tips' },
  { id: 'kapcsolat', label: 'Kapcsolat', href: '/kapcsolat' },
]

// a davelopment szolgáltatás-lista közös helyen (a menü-panel is innen olvassa); itt csak továbbadjuk
export { SERVICES } from '@/lib/davelopmentServices'
import { SERVICES } from '@/lib/davelopmentServices'

const NAV_OFFSET = 110

export function Nav() {
  const [active, setActive] = useState<string>(LINKS[0].id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [togglePos, setTogglePos] = useState<{ top: number; right: number } | null>(null)
  const [logoPos, setLogoPos]     = useState<{ top: number; left: number } | null>(null)
  const [animatedOpen, setAnimatedOpen] = useState(false)
  const toggleRef = useRef<HTMLDivElement>(null)
  const logoRef   = useRef<HTMLDivElement>(null)
  const pendingTarget = useRef<string | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let lastY = window.scrollY
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      const delta = y - lastY
      setScrolled(y > 80)
      if (y < 80) setHidden(false)
      else if (delta > 6) setHidden(true)
      else if (delta < -6) setHidden(false)
      lastY = y
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (sections.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (pendingTarget.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActive(visible[0].target.id)
        }
      },
      {
        rootMargin: `-${NAV_OFFSET + 8}px 0px -40% 0px`,
        threshold: 0,
      },
    )

    sections.forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    setActive(id)
    pendingTarget.current = id
    const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
  }

  // pendingTarget feloldása: ha a cél szekció eléri az olvasási vonalat
  useEffect(() => {
    const target = pendingTarget.current
    if (!target) return
    if (active === target) {
      pendingTarget.current = null
    }
  }, [active])

  useEffect(() => {
    if (menuOpen) {
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

  const onDesktopClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    goTo(id)
  }

  const onMobileClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setMenuOpen(false)
    setTimeout(() => goTo(id), 200)
  }

  return (
    <motion.nav
      className={[
        'sticky top-0 z-[60] transition-[background-color,box-shadow] duration-300',
        scrolled
          ? 'bg-white shadow-ui-float'
          : 'bg-white/70 backdrop-blur-md',
      ].join(' ')}
      animate={{ y: hidden && !menuOpen ? '-100%' : '0%' }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="mx-auto px-5 py-2.5 flex items-center justify-between gap-4">
        {/* Logó */}
        <div ref={logoRef} className="shrink-0">
          <Link href="/" aria-label="davelopment booking">
            <BrandLogo variant="light" className="h-[33px]" />
          </Link>
        </div>

        {/* Desktop menü-pill */}
        <div className="hidden min-[1033px]:flex items-center gap-1 rounded-ui-container bg-ui-cell p-[5px]">
          {LINKS.map(({ id, label, href }) => {
            const isActive = active === id
            return (
              <motion.a
                key={id}
                href={href ?? `#${id}`}
                onClick={href ? undefined : (e) => onDesktopClick(e, id)}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="relative flex items-center rounded-ui-container px-4 py-2 text-ui-row font-medium text-ui-text"
              >
                {isActive && (
                  <motion.span
                    aria-hidden
                    layoutId="nav-active-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    className="absolute inset-0 rounded-ui-container bg-white "
                  />
                )}
                <span className="relative">{label}</span>
              </motion.a>
            )
          })}
        </div>

        {/* Jobb: Bejelentkezés (szekunder) + CTA + hamburger */}
        <div className="flex items-center gap-3 shrink-0">
          {!scrolled && (
            <Link
              href="/login"
              className="hidden min-[1033px]:inline-flex text-ui-body font-medium text-ui-muted hover:text-ui-text transition-colors"
            >
              Bejelentkezés
            </Link>
          )}
          <RollButton
            href="/register"
            label="Próbáld ki ingyen"
            variant="inkLight"
            icon
            className="hidden min-[1033px]:inline-flex"
          />
          <div ref={toggleRef}>
            <MenuToggle open={menuOpen} onClick={handleToggle} ghost ink />
          </div>
        </div>
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {menuOpen && <MobileMenu active={active} onPick={onMobileClick} />}
        </AnimatePresence>,
        document.body,
      )}

      {mounted && logoPos && createPortal(
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed min-[1033px]:hidden" style={{ top: logoPos.top, left: logoPos.left, zIndex: 90 }}>
              <Link href="/" aria-label="davelopment booking" onClick={handleToggle}>
                <BrandLogo variant="light" className="h-[33px]" />
              </Link>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {mounted && togglePos && createPortal(
        <AnimatePresence>
          {menuOpen && (
            <div className="fixed min-[1033px]:hidden" style={{ top: togglePos.top, right: togglePos.right, zIndex: 90 }}>
              <MenuToggle open={animatedOpen} onClick={handleToggle} ghost ink />
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.nav>
  )
}

export function MenuToggle({
  open,
  onClick,
  ghost = false,
  ink = false,
}: {
  open: boolean
  onClick: () => void
  ghost?: boolean
  ink?: boolean  // ghost+ink: sötét vonalak (light háttérre), ghost: fehér+arany (dark héróra)
}) {
  const t = { duration: 0.3, ease: EASE }

  if (ghost) {
    // Hero sötét háttéren: nincs háttérkör, 2 aszimmetrikus vonal → X
    // Zárt: felső fehér (22px) + alsó sárga (ui-yellow, 14px, jobbra igazítva)
    // Nyitott: mindkettő fehér 20px, keresztbe forgatva
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}
        aria-expanded={open}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className="min-[1033px]:hidden relative grid h-12 w-12 shrink-0 place-items-center"
      >
        <span className="relative grid h-[14px] w-[22px] place-items-center">
          <motion.span
            aria-hidden
            className={`absolute block h-[1.5px] rounded-full transition-colors ${open || ink ? 'bg-ui-dark' : 'bg-white/90'}`}
            animate={{
              rotate: open ? 45 : 0,
              y: open ? 0 : -7,
              width: open ? 20 : 22,
            }}
            transition={t}
          />
          <motion.span
            aria-hidden
            className={`absolute block h-[1.5px] rounded-full transition-colors ${open ? 'bg-ui-dark' : 'bg-ui-yellow'}`}
            animate={{
              rotate: open ? -45 : 0,
              y: open ? 0 : 7,
              x: open ? 0 : 4,
              width: open ? 20 : 14,
            }}
            transition={t}
          />
        </span>
      </motion.button>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}
      aria-expanded={open}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className="min-[1033px]:hidden relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white"
    >
      <span className="grid h-6 w-6 place-items-center">
        <motion.span
          aria-hidden
          className="col-start-1 row-start-1 grid grid-cols-2 grid-rows-2 place-items-center gap-[9px]"
          animate={{ opacity: open ? 0 : 1, scale: open ? 0.5 : 1 }}
          transition={t}
        >
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[5px] w-[5px] rounded-full bg-ui-dark" />
          ))}
        </motion.span>

        <motion.span
          aria-hidden
          className="col-start-1 row-start-1 grid place-items-center"
          animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.5 }}
          transition={t}
        >
          <span className="col-start-1 row-start-1 h-[2.5px] w-[22px] rotate-45 rounded-full bg-ui-dark" />
          <span className="col-start-1 row-start-1 h-[2.5px] w-[22px] -rotate-45 rounded-full bg-ui-dark" />
        </motion.span>
      </span>
    </motion.button>
  )
}

export function MobileMenu({
  active,
  onPick,
  onClose,
}: {
  active: string
  onPick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void
  onClose?: () => void
}) {
  const ctaDelay = 0.08 + LINKS.length * 0.06

  return (
    // z-[80] — magasabb mint bármely stacking context a lapon, az X gomb garantáltan kattintható
    // data-lenis-prevent: a Lenis (desktop smooth scroll) ne nyelje el a menü saját görgetését
    // (keskeny desktop ablakban / mobil-nézetben); overscroll-contain: ne görgesse alatta a lapot
    <motion.div
      data-lenis-prevent
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto overscroll-contain bg-white min-[1033px]:hidden"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {/* Fejléc-magasság megtartása — logo + toggle portálra kerül (fixed, felette). Sticky, hogy görgetéskor a tartalom ne csússzon alá. */}
      <div className="sticky top-0 z-10 h-12 shrink-0 bg-white" />

      {/* Nav linkek */}
      <motion.div
        className="flex flex-col gap-0 px-5 my-auto"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.06 } } }}
      >
        {/* Funkciók / Kinek — harmonika; a sima horgony-linkek alatta */}
        <MobileMegaAccordion onPick={() => onClose?.()} />
        {LINKS.filter((l) => l.id !== 'hogyan').map(({ id, label, href }) => {
          const isActive = active === id
          return (
            <motion.a
              key={id}
              href={href ?? `#${id}`}
              onClick={href ? () => onClose?.() : (e) => onPick(e, id)}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.35, ease: EASE }}
              whileTap={{ scale: 0.98 }}
              className={[
                'flex items-center justify-between rounded-ui-inner px-4 py-1.5',
                'text-ui-sub lg:text-ui-page font-medium text-ui-text',
              ].join(' ')}
            >
              <span>{label}</span>
              {isActive && <span className="h-2.5 w-2.5 rounded-full bg-ui-yellow shrink-0" />}
            </motion.a>
          )
        })}
      </motion.div>

      {/* davelopment szolgáltatások */}
      <motion.div
        className="px-5 pb-4 flex flex-col gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE, delay: ctaDelay - 0.04 }}
      >
        <p className="text-ui-meta font-medium text-ui-muted px-1">
          <span className="text-ui-text">[davelopment]©</span> Szolgáltatások
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {SERVICES.filter((s) => s.label !== 'Időpontfoglaló rendszer').map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-ui-inner border border-ui-dark/10 px-3.5 py-2.5 text-ui-row font-medium text-ui-muted hover:text-ui-text transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </motion.div>

      {/* CTA + bejelentkezés */}
      <motion.div
        className="px-5 pb-10 pt-0 flex flex-col gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE, delay: ctaDelay }}
      >
        <a
          href="/register"
          className="flex w-full items-center justify-between rounded-full bg-ui-dark py-3.5 pl-6 pr-3 font-onest font-medium text-ui-row text-white"
        >
          <span>Próbáld ki ingyen</span>
          <IconCircle tone="yellow" size="md">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </IconCircle>
        </a>
        <Link
          href="/login"
          className="self-center text-ui-body font-medium text-ui-muted hover:text-ui-muted transition-colors py-1"
        >
          Már van fiókom → Bejelentkezés
        </Link>
      </motion.div>
    </motion.div>
  )
}
