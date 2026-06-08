import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MotionLink = motion.create(Link)

type Variant = 'dark' | 'yellow' | 'light'
type Size = 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  dark: 'bg-brand-ink text-white hover:opacity-90',
  yellow: 'bg-brand-accent text-brand-ink hover:brightness-95',
  light: 'bg-brand-surface text-brand-ink hover:bg-zinc-200 dark:hover:bg-zinc-200',
}

const SIZE: Record<Size, { pill: string; icon: string }> = {
  md: { pill: 'h-10 px-5 text-sm gap-2', icon: 'h-10 w-10' },
  lg: { pill: 'h-12 px-7 text-[15px] gap-2.5', icon: 'h-12 w-12' },
}

type CommonProps = {
  variant?: Variant
  size?: Size
  /** Megjelenjen-e a ↗ (ArrowUpRight) ikon. */
  icon?: boolean
  /** Csak ikon (kör alakú gomb), szöveg nélkül. */
  iconOnly?: boolean
  className?: string
  children?: React.ReactNode
}

/**
 * A landing egységes pill-gombja a design-referencia szerint: 3 variáns
 * (dark / yellow / light) × szöveg / ikon (↗) / csak-ikon kör. Renderelhető
 * linkként (`href`) vagy gombként (`onClick`).
 */
export function LandingButton({
  variant = 'dark',
  size = 'md',
  icon = false,
  iconOnly = false,
  className,
  children,
  href,
  onClick,
  type = 'button',
  ...rest
}: CommonProps & {
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  const s = SIZE[size]
  const classes = cn(
    'inline-flex items-center justify-center font-semibold rounded-full transition-all active:scale-[0.98] shrink-0',
    VARIANT[variant],
    iconOnly ? cn(s.icon, 'rounded-full') : s.pill,
    className,
  )

  // A „group" osztály + a gomb whileHover/whileTap: a teljes gomb skálázódik,
  // és a ↗ ikon CSS-sel kifelé csúszik (jobbra-fel) hoverre — tiszta, nincs variant-keveredés.
  const iconCls = 'h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
  const content = iconOnly ? (
    <ArrowUpRight className={iconCls} />
  ) : (
    <>
      {children}
      {icon && <ArrowUpRight className={iconCls} />}
    </>
  )
  const motionProps = { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, transition: { type: 'spring' as const, stiffness: 400, damping: 25 } }

  if (href) {
    return (
      <MotionLink href={href} className={cn('group', classes)} aria-label={iconOnly ? 'Tovább' : undefined} {...motionProps} {...rest}>
        {content}
      </MotionLink>
    )
  }
  return (
    <motion.button type={type} onClick={onClick} className={cn('group', classes)} aria-label={iconOnly ? 'Tovább' : undefined} {...motionProps}>
      {content}
    </motion.button>
  )
}
