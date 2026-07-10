'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Clock, ChevronDown, Sparkles } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { EASE, DUR, expandHeight, staggerDelay } from '@/lib/motion'
import { HoverArrow } from '@/components/ui/HoverArrow'
import type { Service, ServiceCategory, Media } from '@/payload/payload-types'
import { makeT, type Locale } from '@/lib/i18n'

interface Props {
  services: Service[]
  serviceCategories: ServiceCategory[]
  slug: string
  locale?: Locale
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

// A kategória relationship kétféleképp jöhet (ID vagy a betöltött rekord). Egységes string ID.
function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'object') return String((v as { id: string | number }).id)
  return String(v)
}

export default function PublicServicesSection({ services, serviceCategories, slug, locale = 'hu' }: Props) {
  const tt = makeT(locale)
  // A kategóriák relationship-ID szerint csoportosulnak; a megjelenített nevet a betöltött
  // kategória-rekord adja (a foglaló oldal locale-jával töltve), fallback a service-en lévő objektum.
  const catMetaMap = new Map(serviceCategories.map(c => [String(c.id), c]))
  const catNameById = (id: string): string => catMetaMap.get(id)?.name ?? 'Egyéb'

  const categoryIds = Array.from(new Set(services.map(s => relId(s.category) ?? '__none__')))

  const sortedCategories = [...categoryIds].sort((a, b) => {
    const oa = catMetaMap.get(a)?.sort_order ?? 999
    const ob = catMetaMap.get(b)?.sort_order ?? 999
    if (oa !== ob) return oa - ob
    return catNameById(a).localeCompare(catNameById(b), 'hu')
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
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gold/15">
          <Sparkles className="h-5 w-5 text-ink" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{tt('public.servicesEyebrow')}</p>
          <h2 className="text-[24px] font-light leading-tight tracking-[-0.01em] text-ink">{tt('public.services')}</h2>
        </div>
      </div>

      <div className="space-y-3">
        {sortedCategories.map(cat => {
          const meta = catMetaMap.get(cat)
          const imgUrl = meta ? categoryImageUrl(meta) : null
          const catLabel = catNameById(cat)
          const catServices = services.filter(s => (relId(s.category) ?? '__none__') === cat)
          const isOpen = open.has(cat)

          return (
            <div
              key={cat}
              className="overflow-hidden rounded-[18px] border border-line bg-paper/35"
            >
              {/* Kategória-fejléc sor — kis kép oldalt, kibontó nyíl */}
              <button
                onClick={() => toggle(cat)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper/40"
              >
                {imgUrl && (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[14px]">
                    <img src={imgUrl} alt={catLabel} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-tight text-ink">{catLabel}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">{tt('public.serviceCount', { n: catServices.length })}</p>
                </div>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: DUR.base, ease: EASE }}
                  className="shrink-0"
                >
                  <ChevronDown className="h-5 w-5 text-ink-soft" />
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
                            className="group relative flex items-center gap-3 rounded-[14px] bg-white px-3 py-3 shadow-[0_1px_2px_rgba(80,70,30,0.04)] transition-colors hover:bg-white/70"
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
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-semibold leading-tight text-ink">{s.name}</p>
                              {s.description && (
                                <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft">{s.description}</p>
                              )}
                              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
                                <Clock className="h-3 w-3 shrink-0" />{s.duration_minutes} {tt('booking.minutes')}
                              </p>
                              <p className="mt-1 text-[14px] font-semibold text-ink">{formatPrice(s.price, s.currency)}</p>
                            </div>
                            {/* A nyíl MINDIG kattintható (mobilon ez az egyetlen klikk-cél).
                                A HoverArrow a sor `group`-hoverére görög (tiszta CSS) → minden nézetben. */}
                            <Link
                              href={`/${slug}/book?serviceId=${s.id}`}
                              aria-label={`${s.name} foglalása`}
                              className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-dark"
                            >
                              <HoverArrow className="h-4 w-4 text-white" />
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
