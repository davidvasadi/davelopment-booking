'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE } from '@/lib/motion'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'

/**
 * Ragadós felső navigáció (Figma 287:444): logó · középső fehér-pill menü · jobb CTA.
 * Desktopon a menü egy világos pill-sávban ül, az ÉPPEN látott szekció fehér pillben (Figma
 * „active"), scroll-spy-jal — a fehér pill layoutId-vel slideol link-link között.
 *
 * Mobilon (md alatt) a menü egy hamburger→X morph gomb mögé kerül; nyitásra full-screen panel
 * úszik be (portál a body-ra), a linkek staggerrel jönnek lentről. A jobb oldali CTA mindig
 * látszik: a közös text-roll RollButton (inkLight: sötét pill, fehér felirat).
 */

// A menü linkjei — a sorrend a DOM-sorrendet követi, hogy a scroll-spy monoton legyen,
// és a kattintás is a helyes szekcióra ugorjon. „Hogyan működik" → a #hogyan wrapper.
const LINKS = [
  { id: 'hogyan', label: 'Hogyan működik' },
  { id: 'velemenyek', label: 'Vélemények' },
  { id: 'arazas', label: 'Árazás' },
  { id: 'gyik', label: 'GYIK' },
]

const NAV_OFFSET = 72 // a sticky nav magassága — ennyivel a szekció teteje fölé scrollozunk

export function Nav() {
  // Scroll-spy: melyik szekciónál járunk → az kapja a fehér „active" pillt. Egy fix olvasási
  // vonal (a nav alatt) dönt: az utolsó szekció, amelynek a teteje már a vonal fölött van.
  // Ez MONOTON a görgetéssel → a pill simán slideol, nem rángat.
  const [active, setActive] = useState<string>(LINKS[0].id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Kattintás-cél: amíg a smooth-scroll oda nem ér, a spy NEM írja felül az aktívat a köztes
  // szekciókkal (ez okozta a „visszaugrik, majd újra" jelenséget). Nem időre jár le: akkor
  // oldódik, amikor a cél szekció teteje elérte az olvasási vonalat.
  const pendingTarget = useRef<string | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (sections.length === 0) return

    let raf = 0
    const pick = () => {
      raf = 0
      const line = NAV_OFFSET + 8 // az olvasási vonal közvetlenül a sticky nav alatt

      // Kattintás-célra tartunk: tartsuk az aktívat a célon, amíg a görgetés oda nem ér.
      const target = pendingTarget.current
      if (target) {
        const el = document.getElementById(target)
        const top = el ? el.getBoundingClientRect().top : 0
        // Feloldjuk, ha a cél teteje elérte/átlépte a vonalat (±4px tűrés), vagy ha a lap alján
        // vagyunk (rövid utolsó szekció már nem tud feljebb csúszni). Különben tartjuk a célt.
        const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2
        if (!el || top <= line + 4 || atBottom) {
          pendingTarget.current = null
        } else {
          setActive(target)
          return
        }
      }

      let current = sections[0].id
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= line) current = s.id
        else break
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick)
    }
    pick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Nyitott mobil-menü alatt a háttér ne görögjön.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  // Szekcióra ugrás: azonnal beállítjuk az aktívat, a sticky nav alá görgetünk, és zárjuk a spy-t.
  const goTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    setActive(id)
    pendingTarget.current = id // a spy a célon tartja az aktívat, amíg oda nem érünk
    const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const onDesktopClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    goTo(id)
  }

  const onMobileClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    setMenuOpen(false)
    // A panel-záró animáció után görgetünk, hogy a body overflow visszaálljon (különben a
    // scrollTo egy lezárt görgetésű body-n nem hatna).
    setTimeout(() => goTo(id), 200)
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70">
      <div className="mx-auto px-5 py-2.5 flex items-center justify-between gap-4">
        {/* Logó */}
        <Link href="/" aria-label="Schedulio" className="shrink-0">
          <SchedulioLogo variant="light" className="h-[33px]" />
        </Link>

        {/* Desktop menü-pill — világos sáv; az aktív szekció fehér pillben ül (Figma).
            A fehér pill layoutId-vel ÚSZIK (slideol) egyik linkről a másikra — lágy spring. */}
        <div className="hidden md:flex items-center gap-1 rounded-[30px] bg-[#f4f4f4] p-[5px]">
          {LINKS.map(({ id, label }) => {
            const isActive = active === id
            return (
              <motion.a
                key={id}
                href={`#${id}`}
                onClick={(e) => onDesktopClick(e, id)}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="relative flex items-center rounded-[30px] px-5 py-2.5 text-[18px] tracking-[-0.6px] text-black"
              >
                {isActive && (
                  <motion.span
                    aria-hidden
                    layoutId="nav-active-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    className="absolute inset-0 rounded-[30px] bg-white shadow-sm"
                  />
                )}
                <span className="relative">{label}</span>
              </motion.a>
            )
          })}
        </div>

        {/* Jobb: CTA (csak desktop — mobilon a menüben van) + mobil menü-gomb (md alatt) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <RollButton
            href="/register"
            label="Regisztráció"
            variant="inkLight"
            icon
            className="hidden md:inline-flex"
          />
          <MenuToggle open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
        </div>
      </div>

      {/* Mobil full-screen menü — portál a body-ra (a sticky nav blurja miatt, lásd memória) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {menuOpen && <MobileMenu active={active} onPick={onMobileClick} />}
          </AnimatePresence>,
          document.body,
        )}
    </nav>
  )
}

/** Pontrács → X morph gomb (csak md alatt). Zárva 2×2 pont egy CSS gridben (a layout centerel,
    nincs kézi transform-matek, így sosem lóg ki). Nyitásra a pontok kifade-elnek, és KÉT átlós
    vonal úszik be helyettük — tiszta X. A két állapot külön réteg, csak opacity/scale vált. */
function MenuToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const t = { duration: 0.3, ease: EASE }
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}
      aria-expanded={open}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className="md:hidden relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#f4f4f4]"
    >
      {/* mindkét réteg ugyanabban a 24×24 cellában, középre rakva (grid place-items-center) */}
      <span className="grid h-6 w-6 place-items-center">
        {/* ZÁRVA: 2×2 pontrács — fix méretű, középre rakva; nyitáskor kifade-el (rotate NÉLKÜL,
            az csavarta el a rácsot). A nagyobb gap miatt a pontok távolabb ülnek → látványosabb. */}
        <motion.span
          aria-hidden
          className="col-start-1 row-start-1 grid grid-cols-2 grid-rows-2 place-items-center gap-[9px]"
          animate={{ opacity: open ? 0 : 1, scale: open ? 0.5 : 1 }}
          transition={t}
        >
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[5px] w-[5px] rounded-full bg-brand-ink" />
          ))}
        </motion.span>

        {/* NYITVA: két átlós vonal (X) — egymásra rakva a cella közepén, beúszik nyitáskor */}
        <motion.span
          aria-hidden
          className="col-start-1 row-start-1 grid place-items-center"
          animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.5 }}
          transition={t}
        >
          <span className="col-start-1 row-start-1 h-[2.5px] w-[22px] rotate-45 rounded-full bg-brand-ink" />
          <span className="col-start-1 row-start-1 h-[2.5px] w-[22px] -rotate-45 rounded-full bg-brand-ink" />
        </motion.span>
      </span>
    </motion.button>
  )
}

/** Full-screen mobil-menü: világos panel úszik be felülről, a linkek staggerrel jönnek lentről. */
function MobileMenu({
  active,
  onPick,
}: {
  active: string
  onPick: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col bg-white/95 backdrop-blur-2xl md:hidden"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {/* A nav (logó + CTA + hamburger→X gomb) a panel FÖLÖTT marad (nav z-50 > panel z-40),
          így a záró X pontosan ugyanott van, mint a nyitó hamburger. A panel csak a tartalmat
          adja, a nav magasságát szabadon hagyva felül. */}

      {/* Linkek — staggered (egymás után, lentről felcsúszva) */}
      <motion.div
        className="flex flex-1 flex-col justify-center gap-2 px-6 pt-[64px]"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } } }}
      >
        {LINKS.map(({ id, label }) => {
          const isActive = active === id
          return (
            <motion.a
              key={id}
              href={`#${id}`}
              onClick={(e) => onPick(e, id)}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: EASE }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-between rounded-[20px] px-4 py-4 text-[clamp(2rem,9vw,3rem)] font-semibold tracking-[-0.04em] text-brand-ink"
            >
              <span>{label}</span>
              {isActive && <span className="h-2.5 w-2.5 rounded-full bg-brand-accent" />}
            </motion.a>
          )
        })}
      </motion.div>

      {/* Alsó CTA — teljes szélességű regisztráció */}
      <motion.div
        className="px-6 pb-10 pt-2"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.12 + LINKS.length * 0.07 }}
      >
        <RollButton href="/register" label="Ingyenes regisztráció" variant="inkLight" size="lg" icon fullWidth />
      </motion.div>
    </motion.div>
  )
}
