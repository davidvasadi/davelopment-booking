'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronRight, User } from 'lucide-react'
import { EASE, DUR, STAGGER } from '@/lib/motion'
import type { StaffMember, Media } from '@/payload/payload-types'

interface Props {
  staff: StaffMember[]
  slug: string
}

function avatarUrlOf(m: StaffMember): string | null {
  return m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
}

export default function PublicStaffSection({ staff, slug }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
      <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Csapatunk</p>
      <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-5">Munkatársak</h2>

      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={{ show: { transition: { staggerChildren: STAGGER, delayChildren: 0.05 } } }}
      >
        {staff.map(m => {
          const avatarUrl = avatarUrlOf(m)
          return (
            <motion.div
              key={m.id}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
              }}
            >
              <Link
                href={`/${slug}/book?staffId=${m.id}`}
                className="relative rounded-3xl aspect-[3/4] group block overflow-hidden"
              >
                <div className="absolute inset-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={m.name}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-400 dark:bg-zinc-800 flex items-center justify-center">
                      <span className="h-16 w-16 rounded-full bg-zinc-500/40 dark:bg-white/[0.08] flex items-center justify-center">
                        <User className="h-8 w-8 text-white/80 dark:text-white/30" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Halvány sötétítés a kép aljára, hogy a glass-sáv kontrasztja meglegyen */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 border border-white/35 backdrop-blur-sm flex items-center justify-center transition-colors group-hover:bg-white/30">
                  <ChevronRight className="h-3.5 w-3.5 text-white" />
                </div>

                {/* Apple-stílusú üveg-sáv: erős blur + saturate (a kép átdereng telítetten),
                    halvány világos tint, felső highlight-perem (ring) a "üveglap-szél" érzethez. */}
                <div className="absolute bottom-2 left-2 right-2 rounded-2xl bg-white/10 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_8px_24px_-8px_rgba(0,0,0,0.5)] px-3 py-2.5">
                  <p className="text-white font-black text-sm leading-tight drop-shadow-sm">{m.name}</p>
                  {m.bio && <p className="text-white/85 text-xs mt-0.5 line-clamp-1 drop-shadow-sm">{m.bio}</p>}
                </div>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
    </motion.section>
  )
}
