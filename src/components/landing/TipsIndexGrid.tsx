'use client'

import Link from 'next/link'
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
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const cardInner = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
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
        <motion.div key={tip.slug} variants={cardOuter}>
          <Link href={`/tips/${tip.slug}`} className="group flex flex-col rounded-[20px] bg-white p-4 gap-4">
            <motion.div variants={cardInner} className="relative h-[320px] rounded-[16px] p-4 overflow-hidden" style={{ background: '#f7f7f7' }}>
              <img
                src={tip.image}
                alt={tip.title}
                className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.04]"
              />
              <span
                className="relative inline-flex items-center rounded-full px-3 py-1.5 font-onest text-[12px] font-medium"
                style={{ background: '#FFD85F', color: '#1D1C19' }}
              >
                {tip.category}
              </span>
            </motion.div>
            <motion.div variants={cardInner} className="flex flex-col gap-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.02]">
              <p className="font-onest font-medium text-[19px] tracking-[-0.03em] text-brand-ink leading-[1.2] group-hover:underline underline-offset-2">
                {tip.title}
              </p>
              <p className="text-[14px] leading-[1.5] text-brand-ink/55">{tip.excerpt}</p>
            </motion.div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  )
}
