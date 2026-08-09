'use client'

import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { buttonHover } from '@/lib/motion'

/**
 * Sima (nem-Link) gombok közös hover-nyelve — ugyanaz az enyhe "press" scale, mint a
 * HoverButtonLink/HoverScaleCard mögött (ld. lib/motion.ts `buttonHover`), hogy a toolbar
 * gombok és a foglalási kártyák is ugyanazt az érzést adják, mint az Áttekintés/Statisztikák.
 */
export function HoverButton({
  onClick, className, style, children, disabled, title, ariaLabel, type = 'button',
}: {
  onClick?: () => void
  className: string
  style?: CSSProperties
  children: ReactNode
  disabled?: boolean
  title?: string
  ariaLabel?: string
  type?: 'button' | 'submit'
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
      style={style}
      variants={buttonHover}
      initial="rest"
      whileHover={disabled ? undefined : 'hover'}
      whileTap={disabled ? undefined : 'hover'}
    >
      {children}
    </motion.button>
  )
}
