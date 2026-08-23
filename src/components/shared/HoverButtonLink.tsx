'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { buttonHover } from '@/lib/motion'

const MotionLink = motion.create(Link)

/**
 * Elsődleges CTA-gombok közös hover-nyelve az Áttekintésen — ugyanaz az enyhe "press" scale,
 * mint a landing Hero gombjain (ld. lib/motion.ts `buttonHover`), hogy a dashboard is ugyanazt
 * az érzést adja vissza.
 */
export function HoverButtonLink({
  href, className, children, ariaLabel,
}: {
  href: string
  className: string
  children: ReactNode
  ariaLabel?: string
}) {
  return (
    <MotionLink
      href={href}
      className={className}
      aria-label={ariaLabel}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      whileTap="hover"
    >
      {children}
    </MotionLink>
  )
}
