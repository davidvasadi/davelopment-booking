'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Clock, ChevronDown } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { EASE, DUR, expandHeight, staggerDelay } from '@/lib/motion'
import { HoverArrow } from '@/components/ui/HoverArrow'
import type { Service, ServiceCategory, Media } from '@/payload/payload-types'

interface Props {
  services: Service[]
  serviceCategories: ServiceCategory[]
  slug: string
}

function categoryImageUrl(c: ServiceCategory): string | null {
  if (!c.image) return null
  if (typeof c.image === 'object') return (c.image as Media).url ?? null
  return null
}

function serviceImageUrl(s: Service): string | null {
  if (!s.image) return null
  if (typeof s.image === 'object') return (s.image as Media).url ?? null
  return null
}

export default function PublicServicesSection({ services, serviceCategories, slug }: Props) {
  const categoryNames = Array.from(new Set(services.map(s => s.category || 'Egyéb')))
  const catMetaMap = new Map(serviceCategories.map(c => [c.name.toLowerCase(), c]))

  const sortedCategories = [...categoryNames].sort((a, b) => {
    const oa = catMetaMap.get(a.toLowerCase())?.sort_order ?? 999
    const ob = catMetaMap.get(b.toLowerCase())?.sort_order ?? 999
    if (oa !== ob) return oa - ob
    return a.localeCompare(b, 'hu')
  })

  // Egyetlen kategória → alapból nyitva; több kategória → mind csukva induljon.
  const singleCategory = sortedCategories.length === 1
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(singleCategory ? sortedCategories : []),
  )

  const toggle = (cat: string) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
      <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Kínálatunk</p>
      <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-5">Szolgáltatások</h2>

      <div className="space-y-3">
        {sortedCategories.map(cat => {
          const meta = catMetaMap.get(cat.toLowerCase())
          const imgUrl = meta ? categoryImageUrl(meta) : null
          const catServices = services.filter(s => (s.category || 'Egyéb') === cat)
          const isOpen = open.has(cat)

          return (
            <div
              key={cat}
              className="bg-white dark:bg-white/[0.04] rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Kategória-fejléc sor — kis kép oldalt, kibontó nyíl */}
              <button
                onClick={() => toggle(cat)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                {imgUrl && (
                  <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0">
                    <img src={imgUrl} alt={cat} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-900 dark:text-white text-sm leading-tight">{cat}</p>
                  <p className="text-xs text-zinc-400 dark:text-white/40 mt-0.5">{catServices.length} szolgáltatás</p>
                </div>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: DUR.base, ease: EASE }}
                  className="shrink-0"
                >
                  <ChevronDown className="h-5 w-5 text-zinc-400 dark:text-white/40" />
                </motion.span>
              </button>

              {/* Kibontott szolgáltatás-sorok — lassú, látványos height-animáció */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={expandHeight.initial}
                    animate={expandHeight.animate}
                    exit={expandHeight.exit}
                    transition={expandHeight.transition}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      {catServices.map((s, i) => {
                        const sImg = serviceImageUrl(s)
                        return (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: DUR.fast, delay: staggerDelay(i), ease: EASE }}
                            className="group relative bg-zinc-50 dark:bg-white/[0.04] rounded-xl flex items-center gap-3 px-3 py-3 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                          >
                            {/* sm-től: a TELJES sor kattintható (overlay-link). Mobilon kikapcsolva. */}
                            <Link
                              href={`/${slug}/book?serviceId=${s.id}`}
                              aria-label={`${s.name} foglalása`}
                              tabIndex={-1}
                              className="hidden sm:block absolute inset-0 z-0 rounded-xl"
                            />

                            {sImg && (
                              <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0">
                                <img src={sImg} alt={s.name} className="h-full w-full object-cover object-top" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-zinc-900 dark:text-white text-sm leading-tight">{s.name}</p>
                              {s.description && (
                                <p className="text-xs text-zinc-500 dark:text-white/50 mt-0.5 line-clamp-1">{s.description}</p>
                              )}
                              <p className="text-xs text-zinc-400 dark:text-white/40 mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />{s.duration_minutes} perc
                              </p>
                              <p className="font-black text-sm text-zinc-900 dark:text-white mt-1">{formatPrice(s.price, s.currency)}</p>
                            </div>
                            {/* A nyíl MINDIG kattintható (mobilon ez az egyetlen klikk-cél).
                                A HoverArrow a sor `group`-hoverére görög (tiszta CSS) → minden nézetben. */}
                            <Link
                              href={`/${slug}/book?serviceId=${s.id}`}
                              aria-label={`${s.name} foglalása`}
                              className="relative z-10 shrink-0 h-10 w-10 rounded-full bg-zinc-950 dark:bg-white flex items-center justify-center"
                            >
                              <HoverArrow className="h-4 w-4 text-white dark:text-black" />
                            </Link>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}
