'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SlotOption {
  start: string
  end?: string
}

/**
 * Profi, görgethető időpont-rács — a kiválasztás egy layoutId-s "csúszó" jelölővel
 * animál a gombok közt (spring, a popItem nyelvén), a lista maga fix magasságban
 * görget (nem nyomja szét a sheet-et), az alja a tartalomból maszkolva halványul el.
 * Nagy érintőfelület (py-2.5) mobilra, bővebb oszlopszám asztali (sm+) szélességen.
 */
export function TimeSlotGrid({
  slots,
  value,
  onChange,
  maxHeight = 220,
  highlightStarts,
}: {
  slots: SlotOption[]
  value: string
  onChange: (start: string) => void
  maxHeight?: number
  /** Ha adott (nem null), csak az ebben szereplő időpontok "világítanak" — a kiválasztott
   *  szakemberhez ténylegesen szabad időpontok; a többi tompítva látszik, de kattintható marad. */
  highlightStarts?: Set<string> | null
}) {
  const highlightId = useId()

  return (
    <motion.div
      key={slots.length}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      data-lenis-prevent
      className="no-scrollbar overflow-y-auto pr-1 pb-3"
      style={{
        maxHeight,
        // A tartalom maga halványul el az alján — így bárhol vágódik el egy sor,
        // sosem tűnik "letörtnek", mindig görgethetőnek olvasható.
        maskImage: 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)',
      }}
    >
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {slots.map((sl) => {
          const selected = value === sl.start
          const dimmed = !selected && highlightStarts != null && !highlightStarts.has(sl.start)
          return (
            <button
              key={sl.start}
              type="button"
              onClick={() => onChange(sl.start)}
              className={cn(
                'relative isolate rounded-[10px] border px-2 py-2.5 text-[13px] font-medium tabular-nums transition-colors sm:py-2',
                selected
                  ? 'border-amber-400 text-amber-900'
                  : dimmed
                    ? 'border-zinc-100 text-zinc-300 hover:border-zinc-200'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              )}
            >
              {selected && (
                <motion.span
                  layoutId={highlightId}
                  className="absolute inset-0 -z-10 rounded-[10px] bg-amber-50"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              {sl.start}
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
