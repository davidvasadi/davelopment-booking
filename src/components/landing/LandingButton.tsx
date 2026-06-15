import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MotionLink = motion.create(Link)

type Variant = 'dark' | 'yellow' | 'light'
type Size = 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  dark: 'bg-brand-ink text-white',
  yellow: 'bg-brand-accent text-brand-ink',
  light: 'bg-brand-surface text-brand-ink',
}

const SIZE: Record<Size, { pill: string; icon: string }> = {
  md: { pill: 'h-10 px-5 text-sm gap-2', icon: 'h-10 w-10' },
  lg: { pill: 'h-12 px-7 text-[15px] gap-2.5', icon: 'h-12 w-12' },
}

type Props = {
  variant?: Variant
  size?: Size
  icon?: boolean
  iconOnly?: boolean
  className?: string
  children?: React.ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
}

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
}: Props) {
  const s = SIZE[size]

  const base = cn(
    'inline-flex items-center justify-center font-semibold rounded-full shrink-0',
    VARIANT[variant],
    iconOnly ? cn(s.icon, 'rounded-full') : s.pill,
    className,
  )

  const hoverMotion = {
    whileHover: 'hover',
    initial: 'rest',
    animate: 'rest',
  }

  const textVariants = {
    rest: { x: 0 },
    hover: { x: -4 },
  }

  const iconVariants = {
    rest: { x: 0, rotate: 0 },
    hover: { x: 4, rotate: 45 },
  }

  const content = iconOnly ? (
    <motion.span variants={iconVariants}>
      <ArrowUpRight className="h-[18px] w-[18px]" />
    </motion.span>
  ) : (
    <>
      <motion.span variants={textVariants}>{children}</motion.span>
      {icon && (
        <motion.span variants={iconVariants}>
          <ArrowUpRight className="h-[18px] w-[18px]" />
        </motion.span>
      )}
    </>
  )

  if (href) {
    return (
      <MotionLink
        href={href}
        className={cn(base, 'overflow-hidden')}
        {...hoverMotion}
        {...rest}
      >
        {content}
      </MotionLink>
    )
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      className={cn(base, 'overflow-hidden')}
      {...hoverMotion}
    >
      {content}
    </motion.button>
  )
}