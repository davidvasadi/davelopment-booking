'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { TipCardImage } from './TipCardImage'
import { motion } from 'framer-motion'
import { EASE } from '@/lib/motion'
import type { Tip } from '@/lib/tips-content'

// Ugyanaz a minta mint a TipsTeaser kártyáin: a TELJES kártya scale-lel jön be,
// utána a kép, majd a szöveg úszik fel (staggerChildren a szülőn).
const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
} as const

const cardOuter = {
  hidden: { opacity: 0, transform: 'scale(0.94)' },
  show: {
    opacity: 1,
    transform: 'scale(1)',
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const cardInner = {
  hidden: { opacity: 0, transform: 'translateY(24px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.5, ease: EASE } },
} as const

export function TipsIndexGrid({ tips }: { tips: Tip[] }) {
  return (
    <motion.div
      variants={grid}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {tips.map((tip) => (
        <motion.div key={tip.slug} variants={cardOuter} className="h-full">
          {/* ugyanaz a kártya, mint a főoldali tippeké (TipsK2): fehér, 190 px-es képmező a telefon tetejével, alatta
              kategória-pill, cím és kétsoros leírás */}
          <Link href={`/tippek-es-cikkek/${tip.slug}`} className="group flex h-full flex-col rounded-ui-container bg-[#F7F7F7] p-3">
            <div className="relative h-[190px] overflow-hidden rounded-ui-card bg-white">
              <TipCardImage src={tip.image} alt={tip.title} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
            </div>
            <div className="flex flex-1 flex-col px-3 pb-3 pt-4 font-onest">
              <span className="self-start rounded-[8px] bg-[#FFF9E7] px-2.5 py-1 text-ui-meta font-medium text-ui-text/80">{tip.category}</span> {/* ui-allow: a koncepció pill-formája */}
              <h3 className="mt-3 text-ui-row font-medium text-ui-text group-hover:underline group-hover:underline-offset-4">{tip.title}</h3>
              <p className="mt-1.5 line-clamp-2 text-ui-body text-ui-muted">{tip.excerpt}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  )
}
