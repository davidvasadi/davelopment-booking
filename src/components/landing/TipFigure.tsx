'use client'

import { motion } from 'framer-motion'
import { StepVisual } from '@/components/blocks/landing-stepvisuals'
import { inView, rise } from '@/components/blocks/landing-concepts'
import type { TipFigure as Fig } from '@/lib/tips-content'

/**
 * A kézikönyv-/cikkoldal képe egy szakasz alján, #F7F7F7 mezőben (mint a funkció-oldalak kártyáinál):
 *  - `shot`: a rendszer valódi képernyője telefonkeretben — a telefon felső része látszik, az alja fehérbe olvad;
 *  - `visual`: a funkció-oldalak kártya-kompozíciója (értesítés-kártyák / üveges sorok), ugyanabban a méretben.
 * Beúszik, amikor a képernyőre ér (a főoldali `rise`).
 */
export function TipFigure({ figure }: { figure: Fig }) {
  return (
    <motion.figure {...inView} variants={rise} className="flex flex-col gap-2.5">
      {figure.kind === 'shot' ? (
        <div className="relative flex h-[380px] justify-center overflow-hidden rounded-ui-card bg-[#F7F7F7] pt-8 sm:h-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={figure.src} alt={figure.alt} loading="lazy" decoding="async" className="h-auto w-[240px] self-start sm:w-[270px]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F7F7F7] to-transparent" /> {/* ui-allow: a mező színébe olvad */}
        </div>
      ) : (
        <div className="relative mx-auto h-[260px] w-full max-w-[460px] overflow-hidden rounded-ui-card">
          <StepVisual group={figure.group} index={figure.index} />
        </div>
      )}
      {figure.caption && <figcaption className="text-center text-ui-meta text-ui-muted">{figure.caption}</figcaption>}
    </motion.figure>
  )
}
