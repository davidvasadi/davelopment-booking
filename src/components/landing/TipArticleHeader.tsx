'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { EASE } from '@/lib/motion'
import { TipShareRow } from '@/components/landing/TipShareRow'
import { APP_URL } from '@/lib/brand'
import type { Tip } from '@/lib/tips-content'

// Ugyanaz a minta mint a TipsTeaser kártyáin: a TELJES konténer scale-lel jön be,
// utána a kép, majd a szöveg/sor úszik fel (staggerChildren a szülőn).
const outer = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const inner = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
} as const

export function TipArticleHeader({ tip }: { tip: Tip }) {
  // Related-tippek közötti váltásnál a lap teteje maradt lemaradva — biztosra megyünk.
  // A hívó oldal key={tip.slug}-gal kényszerít friss mount-ot minden váltásnál,
  // így ez itt mindig lefut (nem múlik azon, hogy React update-nek vagy mountnak minősíti-e).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <motion.div initial="hidden" animate="show" variants={outer} className="rounded-[20px] bg-white p-4 flex flex-col gap-4">
      <motion.div variants={inner} className="rounded-[30px] p-6 lg:p-8" style={{ background: '#f7f7f7' }}>
        <h1 className="font-semibold text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] tracking-[-0.05em] text-brand-ink mb-4">
          {tip.title}
        </h1>
        <p className="text-[17px] leading-[1.6] text-brand-ink/60">{tip.excerpt}</p>
      </motion.div>

      <motion.div variants={inner} className="relative h-[240px] rounded-[16px] overflow-hidden" style={{ background: '#f7f7f7' }}>
        <img src={tip.image} alt={tip.title} className="absolute inset-0 h-full w-full object-contain object-top" />
        <span
          className="absolute top-4 left-4 inline-flex items-center rounded-full px-3.5 py-1.5 font-onest text-[13px] font-medium"
          style={{ background: '#FFD85F', color: '#1D1C19' }}
        >
          {tip.category}
        </span>
      </motion.div>

      {/* Szerző / megosztás sor */}
      <motion.div variants={inner} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icons/favico_dark.svg" alt="" className="h-10 w-10 rounded-[8px]" />
          <div>
            <p className="text-[14px] font-medium text-brand-ink leading-tight">[davelopment]® Booking</p>
            <p className="text-[13px] text-brand-ink/45 leading-tight">Csapat</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-brand-ink/45">Oszd meg másokkal:</span>
          <TipShareRow title={tip.title} url={`${APP_URL}/tips/${tip.slug}`} />
        </div>
      </motion.div>
    </motion.div>
  )
}
