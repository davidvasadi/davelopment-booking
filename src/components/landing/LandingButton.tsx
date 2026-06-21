'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonHover, iconHover } from '@/lib/motion'

const MotionLink = motion.create(Link)

/** Pill-gomb variánsai a landing design-rendszeréből. `yellow` az `accent` aliasza (visszafelé komp.). */
type Variant = 'dark' | 'accent' | 'light' | 'yellow'
type Size = 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  dark: 'bg-brand-ink text-white',
  accent: 'bg-brand-accent text-brand-ink',
  yellow: 'bg-brand-accent text-brand-ink',
  light: 'bg-brand-surface text-brand-ink',
}

const SIZE: Record<Size, { pill: string; icon: string }> = {
  md: { pill: 'h-11 px-6 text-sm gap-2', icon: 'h-11 w-11' },
  lg: { pill: 'h-14 px-8 text-[15px] gap-2.5', icon: 'h-14 w-14' },
}

type Props = {
  variant?: Variant
  size?: Size
  /** Trailing ↗ ikon a szöveg után. */
  icon?: boolean
  className?: string
  children?: React.ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  'aria-label'?: string
}

/**
 * A landing elsődleges pill-gombja. Hover-en a szöveg balra húz, az ikon elfordul+kicsúszik
 * (a közös `motion.ts` `buttonHover`/`iconHover` nyelv). Ha `href` van → `Link`, különben `button`.
 */
export function LandingButton({
  variant = 'dark',
  size = 'md',
  icon = false,
  className,
  children,
  href,
  onClick,
  type = 'button',
  ...rest
}: Props) {
  const s = SIZE[size]
  const base = cn(
    'inline-flex items-center justify-center font-semibold rounded-full shrink-0 overflow-hidden',
    VARIANT[variant],
    s.pill,
    className,
  )

  const content = (
    <>
      <motion.span variants={buttonHover}>{children}</motion.span>
      {icon && (
        <motion.span variants={iconHover} className="inline-flex">
          <ArrowUpRight className="h-[18px] w-[18px]" />
        </motion.span>
      )}
    </>
  )

  const hover = { initial: 'rest', whileHover: 'hover', animate: 'rest' } as const

  if (href) {
    return (
      <MotionLink href={href} className={base} {...hover} {...rest}>
        {content}
      </MotionLink>
    )
  }
  return (
    <motion.button type={type} onClick={onClick} className={base} {...hover} {...rest}>
      {content}
    </motion.button>
  )
}

/**
 * Különálló kör-ikon gomb (`↗`) — a designon a fő pill mellett gyakran önállóan áll
 * (hero, footer, értékelések). Hover-en az ikon elfordul+kicsúszik.
 */
export function LandingIconButton({
  variant = 'accent',
  size = 'md',
  href,
  onClick,
  className,
  'aria-label': ariaLabel = 'Tovább',
}: Pick<Props, 'variant' | 'size' | 'href' | 'onClick' | 'className' | 'aria-label'>) {
  const s = SIZE[size]
  const base = cn(
    'inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden',
    VARIANT[variant],
    s.icon,
    className,
  )
  const hover = { initial: 'rest', whileHover: 'hover', animate: 'rest' } as const
  const inner = (
    <motion.span variants={iconHover} className="inline-flex">
      <ArrowUpRight className="h-[18px] w-[18px]" />
    </motion.span>
  )
  if (href) {
    return (
      <MotionLink href={href} aria-label={ariaLabel} className={base} {...hover}>
        {inner}
      </MotionLink>
    )
  }
  return (
    <motion.button aria-label={ariaLabel} onClick={onClick} className={base} {...hover}>
      {inner}
    </motion.button>
  )
}

/**
 * A hero elsődleges CTA-ja: felirat-pill + különálló kör-ikon, amik hover-kor összezárnak,
 * a felirat 360°-ot pördül, az ikon 45°-ot. Sárga, nagy (22px) — egyedi a heróhoz.
 */
export function SplitRegisterButton({ href, label }: { href: string; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      className="inline-flex items-center"
      style={{ gap: 5 }}
      animate={{ gap: hover ? 0 : 5 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <Link
        href={href}
        className="inline-flex h-14 items-center rounded-[30px] bg-brand-accent px-7 text-[22px] font-medium text-brand-ink overflow-hidden"
      >
        <motion.span
          animate={{ rotate: hover ? 360 : 0 }}
          transition={{ type: 'tween', duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {label}
        </motion.span>
      </Link>
      <Link
        href={href}
        aria-label={label}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-brand-ink"
      >
        <motion.span
          animate={{ rotate: hover ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        >
          <ArrowUpRight className="h-6 w-6" />
        </motion.span>
      </Link>
    </motion.div>
  )
}

/**
 * Nagy (22px) pill CTA a felirat-balhúzós + ikon-pördülős hover-rel — a `dark`/`light`
 * másodlagos akciókhoz (hero „Bejelentkezés", demo, CTA-banner). A kis pillekhez a fenti
 * `LandingButton` való; ez a látványosabb, nagyobb verzió.
 */
export function SpinButton({
  href,
  label,
  variant,
}: {
  href: string
  label: string
  variant: 'dark' | 'light'
}) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'inline-flex h-14 items-center gap-3 rounded-[30px] px-6 text-[22px] font-medium overflow-hidden',
        variant === 'dark' ? 'bg-brand-ink text-brand-bg' : 'bg-white text-brand-ink',
      )}
    >
      <motion.span
        animate={{ x: hover ? -6 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
      >
        {label}
      </motion.span>
      <motion.span
        animate={{ rotate: hover ? 45 : 0, x: hover ? 6 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
      >
        <ArrowUpRight className="h-6 w-6" />
      </motion.span>
    </Link>
  )
}
