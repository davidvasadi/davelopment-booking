import type { Transition, Variants } from 'framer-motion'

/**
 * A publikus foglaló-felület framer-motion design-nyelve.
 * Részletek: docs/framer-design-system.md. A mérce a szolgáltatás-akkordeon.
 *
 * Egy helyen a konstansok → a tempó globálisan hangolható innen.
 */

/** Signature easing — easeOutExpo-szerű, lendületes "frame-es" érzet. */
export const EASE = [0.22, 1, 0.36, 1] as const

/** Időtartam-skála (másodperc). */
export const DUR = { fast: 0.3, base: 0.45, slow: 0.6 } as const

/** Gyermek-elemek közti staggered késleltetés (másodperc). */
export const STAGGER = 0.06

/** Bázis fade-up: opacity 0→1, y 12→0. Listák gyermek-elemeihez. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: EASE } },
}

/**
 * Staggered konténer: a gyermekei (fadeUp) egyenként, lentről úsznak be.
 * Használat: a szülőn `variants={staggerContainer}`, gyermeken `variants={fadeUp}`.
 */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER, delayChildren: 0.05 } },
}

/** Akkordeon-szerű height-kibomlás (height + opacity). */
export const expandHeight = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto' as const, opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: {
    height: { duration: DUR.base, ease: EASE },
    opacity: { duration: DUR.fast, ease: 'easeOut' as const },
  },
}

/**
 * Wizard lépés-átmenet (slide + fade). `dir` = +1 előre (befelé jobbról),
 * -1 vissza (befelé balról). Visszafogott tempó (fast), mert sokszor használt.
 */
export const stepSlide = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
}

export const stepSlideTransition: Transition = { duration: DUR.fast, ease: EASE }

/** Index-alapú stagger delay (akkordeon-mintára: 0.08 + i*STAGGER). */
export const staggerDelay = (i: number, base = 0.08) => base + i * STAGGER


// ── Landing spring presetek (forrás: nexbit-animation-spec.md) ─────────────────

/** Belépők, slide-ok — lendületes spring. */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 300, damping: 60, mass: 1 } as const
/** Hover, interaktív elemek — kicsit puhább. */
export const SPRING_SOFT   = { type: 'spring', stiffness: 275, damping: 60, mass: 1 } as const
/** Fejléc scale reveal — gyors, enyhe bounce. */
export const SPRING_QUICK  = { type: 'spring', bounce: 0.2, duration: 0.4 } as const

/**
 * Hover-nyelv a landing pill-gombokhoz: a felirat balra húz, az ikon elfordul+kicsúszik.
 * A szülő `initial="rest" whileHover="hover"`, a gyermekek ezt öröklik.
 */
/** Gomb hover: enyhe scale-le (press érzet). */
export const buttonHover: Variants = {
  rest:  { scale: 1,    transition: { duration: 0.18, ease: 'easeOut' } },
  hover: { scale: 0.97, transition: { duration: 0.1,  ease: 'easeOut' } },
}

/** Nyíl-ikon hover: vízszintes roll (rotateY 360°). */
export const iconHover: Variants = {
  rest:  { rotateY: 0 },
  hover: { rotateY: 360, transition: { duration: 0.42, ease: EASE } },
}

// ── Dashboard / app presetek ────────────────────────────────────────────────

/**
 * Oldalak belépő animációja: fade + enyhe felúszás.
 * Használat: `<motion.div {...pageTransition}>`.
 */
export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE },
}

/**
 * Lista-stagger: konténer + elem pár.
 * Konténeren `variants={listStagger.container}`, elemen `variants={listStagger.item}`.
 */
export const listStagger = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
  } as Variants,
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: EASE } },
  } as Variants,
}

/**
 * Sheet / drawer belépő-spring: alulról felcsúszik, rugós lezárással.
 * Használat: a sheet content `motion.div`-jain.
 */
export const sheetSpring = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 30 },
}

/**
 * ⭐ „STAGGERED SPRING" belépő (ETALON: UserMenu popover) — kiemelve a közös használatra.
 * `popItem`: a panel gyerekei egymás után úsznak be (opacity+y, spring). `popPanelCenter`: középre
 * úszó modal-panel (skálás spring nyitás), a gyerekei staggerrel. Backdrop külön (blur + dim).
 */
export const popItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } },
}

export const popPanelCenter: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 28, mass: 0.9, staggerChildren: 0.05, delayChildren: 0.08 },
  },
  exit: { opacity: 0, scale: 0.97, y: 12, transition: { duration: 0.16, ease: 'easeIn' } },
}

/**
 * Skeleton shimmer keyframe neve — a CSS animációt a globals.css definiálja.
 * Komponensben: `className="animate-shimmer"`.
 */
export const SHIMMER_CLASS = 'animate-shimmer'