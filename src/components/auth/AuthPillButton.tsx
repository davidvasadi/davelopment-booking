'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { EASE, buttonHover } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Elsődleges CTA pill a desktop auth-képernyőkön (login, register wizard 1. lépés) — a Figma
 * (node 349:1047 / 350:1621) pontos gomb-mintája: szöveg BALRA, kör alakú nyíl-jelvény JOBBRA
 * (justify-between). A hover UGYANAZ a becsúszó nyíl-csere animáció, mint a landing
 * `HeroButton`-nál (lásd `buttonHover`/`EASE` a lib/motion.ts-ből) — explicit user-kérés, hogy
 * a két gomb egyformán viselkedjen. A mobil splash-gombok (authPillBtn/authPillBtnLight)
 * szándékosan érintetlenek — külön komponens, hogy ne törjön a mobil nézet.
 */
export function AuthPillButton({
  type = 'button',
  onClick,
  disabled,
  loading,
  className,
  children,
}: {
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
  children: React.ReactNode
}) {
  const isDisabled = disabled || loading
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      variants={buttonHover}
      initial="rest"
      whileHover={isDisabled ? undefined : 'hover'}
      className={cn(
        'w-full inline-flex items-center justify-between gap-2.5 rounded-dav-pill bg-ink-dark py-2.5 pl-5 pr-2.5 text-white font-medium text-base disabled:opacity-40 touch-manipulation',
        className,
      )}
    >
      <span>{children}</span>
      <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold">
        {loading ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-ink-dark" />
        ) : (
          <>
            <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
              <ArrowRight className="h-[18px] w-[18px] text-ink-dark" />
            </motion.div>
            <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
              <ArrowRight className="h-[18px] w-[18px] text-ink-dark" />
            </motion.div>
          </>
        )}
      </span>
    </motion.button>
  )
}
