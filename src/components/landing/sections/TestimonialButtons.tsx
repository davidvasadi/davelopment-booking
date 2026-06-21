'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE } from '@/lib/motion'

const MotionLink = motion.create(Link)

/**
 * Az Értékelések-szekció két CTA-gombja, a publikus foglaló design-nyelvén
 * (text-roll felirat + összeolvadó nyíl-buborék — lásd BookCtaButton/BookCtaMorph).
 * Egyelőre szekció-helyi; ha bevált, általánosítjuk a LandingButton-be.
 *
 * Közös: 18px felirat, h-14 pill, light (fehér) / accent (sárga) paletta.
 */

type Palette = 'accent' | 'light' | 'dark' | 'inkLight'
const PALETTE: Record<Palette, string> = {
  accent: 'bg-brand-accent text-brand-ink',
  light: 'bg-white text-brand-ink',
  dark: 'bg-brand-ink text-brand-accent', // sötét pill, sárga felirat (sárga háttéren, pl. Pricing Pro)
  inkLight: 'bg-brand-ink text-white', // sötét pill, fehér felirat (világos háttéren, pl. Nav)
}

/** Text-roll felirat: két egymás alatti felirat egy ablakban, hoverre felgördül.
    A roll-magasság = a sor-magasság (lineHeight), hogy pont egy sornyit görögjön. */
function RollLabel({ label, lineHeight = '1.5rem' }: { label: string; lineHeight?: string }) {
  return (
    <span className="overflow-hidden inline-block" style={{ height: lineHeight }}>
      <motion.span
        className="flex flex-col"
        style={{ lineHeight }}
        variants={{ rest: { y: 0 }, hover: { y: `-${lineHeight}` } }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <span className="block">{label}</span>
        <span className="block" aria-hidden>
          {label}
        </span>
      </motion.span>
    </span>
  )
}

/** Méret-preset: a kis (md) pillhez és a nagy (lg) árazás-kártya gombhoz. */
type Size = 'md' | 'lg'
const SIZE: Record<Size, { pill: string; line: string; icon: string }> = {
  md: { pill: 'h-14 px-8 text-[18px] gap-2.5', line: '1.5rem', icon: 'h-5 w-5' },
  lg: { pill: 'h-20 px-8 text-[clamp(1.25rem,2.6vw,2rem)] gap-3', line: '2rem', icon: 'h-7 w-7' },
}

/**
 * Pill text-roll-lal + opcionális trailing ↗. A landing CTA-k közös gombja
 * (Értékelések „Ingyenes regisztráció", Árazás „Kipróbálom ingyen").
 */
export function RollButton({
  href,
  label,
  variant = 'accent',
  size = 'md',
  icon = false,
  fullWidth = false,
  className,
}: {
  href: string
  label: string
  variant?: Palette
  size?: Size
  icon?: boolean
  fullWidth?: boolean
  className?: string
}) {
  const s = SIZE[size]
  return (
    <MotionLink
      href={href}
      initial="rest"
      whileHover="hover"
      animate="rest"
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold overflow-hidden',
        s.pill,
        fullWidth && 'w-full',
        PALETTE[variant],
        className,
      )}
    >
      <RollLabel label={label} lineHeight={s.line} />
      {icon && (
        <motion.span
          variants={{ rest: { rotate: 0, x: 0 }, hover: { rotate: 45, x: 4 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="inline-flex"
        >
          <ArrowUpRight className={s.icon} />
        </motion.span>
      )}
    </MotionLink>
  )
}

/**
 * Szöveg-pill + különálló nyíl-buborék, ami hoverre a gombhoz csúszik és eggyé olvad
 * (a szembenéző sarkak kiegyenesednek, a nyíl elfordul) — a felirat közben text-roll-lal görög.
 * A BookCtaMorph landing-megfelelője (h-14, 18px, paletta-választható).
 */
const GAP = 8 // px — a pill és a buborék közti rés alaphelyzetben

export function MorphButton({
  href,
  label,
  variant = 'light',
  className,
}: {
  href: string
  label: string
  variant?: Palette
  className?: string
}) {
  const t = { duration: 0.4, ease: EASE }
  return (
    <MotionLink
      href={href}
      initial="rest"
      whileHover="hover"
      whileTap="hover"
      animate="rest"
      aria-label={label}
      className={cn('inline-flex items-center', className)}
    >
      {/* Szöveg-pill — a jobb sarka hoverre kiegyenesedik; felirat text-roll-lal */}
      <motion.span
        variants={{
          rest: { borderTopRightRadius: 9999, borderBottomRightRadius: 9999 },
          hover: { borderTopRightRadius: 16, borderBottomRightRadius: 16 },
        }}
        transition={t}
        className={cn(
          'relative z-10 h-14 inline-flex items-center rounded-full px-8 text-[18px] font-semibold',
          PALETTE[variant],
        )}
      >
        <RollLabel label={label} />
      </motion.span>

      {/* Nyíl-buborék — fix 56×56 kör; hoverre a gombhoz csúszik, bal sarka kiegyenesedik, nyíl 45° */}
      <motion.span
        style={{ marginLeft: GAP, width: 56, height: 56, flex: '0 0 56px' }}
        variants={{
          rest: {
            x: 0,
            borderTopLeftRadius: 9999,
            borderBottomLeftRadius: 9999,
            borderTopRightRadius: 9999,
            borderBottomRightRadius: 9999,
          },
          hover: {
            x: -GAP,
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
            borderTopRightRadius: 9999,
            borderBottomRightRadius: 9999,
          },
        }}
        transition={t}
        className={cn('inline-flex items-center justify-center', PALETTE[variant])}
      >
        <motion.span variants={{ rest: { rotate: 0 }, hover: { rotate: 45 } }} transition={t} className="inline-flex">
          <ArrowUpRight className="h-5 w-5" />
        </motion.span>
      </motion.span>
    </MotionLink>
  )
}
