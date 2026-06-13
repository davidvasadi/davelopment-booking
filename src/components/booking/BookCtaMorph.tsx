'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { EASE } from '@/lib/motion'

const MotionLink = motion.create(Link)

/**
 * Hero "Időpontfoglalás" CTA — külön szöveg-pill + külön nyíl-buborék.
 * Hoverre a buborék a gombhoz csúszik (transform, nem layout → vajsima) és
 * eggyé olvad: a szembenéző sarkak kiegyenesednek, a nyíl elfordul.
 *
 * Minden property KÖZÖS tween-transition-t kap (fix időtartam + easing), így
 * determinisztikusan, PONTOSAN egyszerre ér célba — nincs a spring-re jellemző
 * "ki-be lengés", amitől a morph szembetűnő/ugró lett.
 */
const GAP = 8 // px — a két elem közti rés alaphelyzetben

export function BookCtaMorph({ href, label = 'Időpontfoglalás', className = '' }: { href: string; label?: string; className?: string }) {
  const t = { duration: 0.4, ease: EASE }

  return (
    <MotionLink
      href={href}
      initial="rest"
      whileHover="hover"
      whileTap="hover"
      animate="rest"
      className={`inline-flex items-center ${className}`}
      aria-label={label}
    >
      {/* Szöveg-pill — a jobb sarka hoverre kiegyenesedik; a felirat text-roll-lal görög */}
      <motion.span
        variants={{
          rest: { borderTopRightRadius: 9999, borderBottomRightRadius: 9999 },
          hover: { borderTopRightRadius: 14, borderBottomRightRadius: 14 },
        }}
        transition={t}
        className="relative z-10 h-12 inline-flex items-center rounded-full bg-white text-zinc-950 font-bold text-sm px-7"
      >
        {/* Text-roll: két egymás alatti felirat egy ablakban, hoverre felgördül */}
        <span className="overflow-hidden inline-block" style={{ height: '1.25rem' }}>
          <motion.span
            className="flex flex-col"
            style={{ lineHeight: '1.25rem' }}
            variants={{ rest: { y: 0 }, hover: { y: '-1.25rem' } }}
            transition={t}
          >
            <span className="block">{label}</span>
            <span className="block" aria-hidden>{label}</span>
          </motion.span>
        </span>
      </motion.span>

      {/* Nyíl-buborék — fix 48×48 kör. Hoverre x-ben a gombhoz csúszik (transform),
          a bal sarka kiegyenesedik, a nyíl 45°-ot fordul. */}
      <motion.span
        style={{ marginLeft: GAP, width: 48, height: 48, flex: '0 0 48px' }}
        variants={{
          rest: { x: 0, borderTopLeftRadius: 9999, borderBottomLeftRadius: 9999, borderTopRightRadius: 9999, borderBottomRightRadius: 9999 },
          hover: { x: -GAP, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, borderTopRightRadius: 9999, borderBottomRightRadius: 9999 },
        }}
        transition={t}
        className="inline-flex items-center justify-center bg-white text-zinc-950"
      >
        <motion.span
          variants={{ rest: { rotate: 0 }, hover: { rotate: 45 } }}
          transition={t}
          className="inline-flex"
        >
          <ArrowUpRight className="h-4 w-4" />
        </motion.span>
      </motion.span>
    </MotionLink>
  )
}
