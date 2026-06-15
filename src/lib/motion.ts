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


/** Hero landingre */
export const buttonHover = {
  rest: { x: 0 },
  hover: {
    x: -6,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

export const iconHover = {
  rest: { rotate: 0, x: 0 },
  hover: {
    rotate: 45,
    x: 6,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}