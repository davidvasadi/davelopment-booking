'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button, IconButton, Panel, SheetHandle } from '@/components/ui-kit'
import type { TourStep } from './tour'

/* A bevezető kártyája (animált lépésváltás → kliens). A lépések és az előnézetek: ./tour (szerveren is fut). */

export type TourActions = { onOpen?: () => void; onPrev?: () => void; onNext?: () => void; onSkip?: () => void; onClose?: () => void }

/** Egy lépés kártyája: előnézet, „3 / 12”, cím, szöveg, „Megnézem” (ha van hova), pöttyök (az aktuális sárga, széles),
 *  Vissza / Tovább (az utolsón „Kezdjük”) és Kihagyás; jobb felül bezárás. Mobilon alulról nyíló lap fogantyúval
 *  (X nélkül), `sheet`: csak a lap tartalma, keret nélkül (a design telefon-képeihez). `dir`: a lapozás iránya —
 *  élesben a lépés tartalma oldalra csúszik, mobilon húzással is lapozható. */
export function TourCard({ index, total, title, body, to, preview, sheet = false, dir = 0, onOpen, onPrev, onNext, onSkip, onClose }: Omit<TourStep, 'to'> & TourActions & { to?: string; index: number; total: number; sheet?: boolean; dir?: number }) {
  const last = index === total - 1
  const content = (
    <>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          initial={{ opacity: 0, x: dir >= 0 ? 48 : -48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir >= 0 ? -48 : 48 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.9 }}
          drag={onNext ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, i) => { if (i.offset.x < -60 && !last) onNext?.(); else if (i.offset.x > 60 && index > 0) onPrev?.() }}
        >
          {preview}
          <div className="mt-5 text-center">
            <div className="text-ui-label text-ui-muted">{index + 1} / {total}</div>
            <div className="mt-2 text-ui-num font-light leading-tight text-ui-text">{title}</div>
            <p className="mx-auto mt-3 max-w-[360px] text-ui-body leading-relaxed text-ui-muted">{body}</p>
            {to !== undefined && <Button variant="glass" size="sm" className="mt-4" icon={ArrowRight} onClick={onOpen}>Megnézem</Button>}
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-ui-yellow' : 'w-1.5 bg-ui-dark/20'}`} />)}
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        {index > 0 ? <Button variant="ghost" icon={ArrowLeft} onClick={onPrev}>Vissza</Button> : <Button variant="ghost" onClick={onSkip}>Kihagyás</Button>}
        <Button variant={last ? 'yellow' : 'dark'} onClick={onNext}>{last ? 'Kezdjük' : 'Tovább'}{!last && <ArrowRight className="h-4 w-4" />}</Button>
      </div>
    </>
  )
  if (sheet) return content
  return (
    <Panel pad="lg" size="sm" className="relative mx-auto max-h-[92dvh] overflow-y-auto overflow-x-hidden max-sm:rounded-b-none max-sm:px-5 max-sm:pt-2.5">
      <SheetHandle className="pb-3 sm:hidden" />
      <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onClose} className="absolute right-4 top-4 z-10 max-sm:hidden" />
      {content}
    </Panel>
  )
}
