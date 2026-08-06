'use client'

import { motion } from 'framer-motion'
import { EASE } from '@/lib/motion'

const ITEMS = [
  {
    title: 'Hogyan telepíthető?',
    body: 'iPhone-on: Safari → Megosztás → „Főképernyőre". Androidon: Chrome → hárompontos menü → „Telepítés". Egy perc az egész — nincs App Store, nincs Google Play.',
  },
]

export function PwaSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28">
      {/* Fejléc */}
      <div className="mb-16 lg:mb-20">
        <h2 className="font-onest font-light text-[clamp(2.5rem,6vw,3rem)] leading-[1.15] tracking-[-0.05em] text-brand-ink">
          Nem alkalmazás. Mégis az.
        </h2>
        <p className="mt-6 font-onest text-[clamp(1rem,2vw,1.25rem)] leading-[1.5] tracking-[-0.05em] text-brand-ink/60 max-w-3xl">
          Telepíthető iPhone-ra és Androidra — App Store és Google Play nélkül. Úgy néz ki és úgy működik mint egy valódi app: push értesítéseket küld, offline is megmutatja a napi naplót, ikonként ül a kezdőképernyőn.
        </p>
      </div>

      {/* Feature sorok */}
      <div className="flex flex-col divide-y divide-brand-ink/10">
        {ITEMS.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            className="py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-16"
          >
            <h3 className="font-onest font-light text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.06em] text-brand-ink">
              {item.title}
            </h3>
            <p className="font-onest font-medium text-base leading-relaxed text-brand-ink/60">
              {item.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
