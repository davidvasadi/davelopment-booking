'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronRight, User, Users } from 'lucide-react'
import { EASE, DUR, STAGGER } from '@/lib/motion'
import type { StaffMember, Media } from '@/payload/payload-types'
import { makeT, type Locale } from '@/lib/i18n'

interface Props {
  staff: StaffMember[]
  slug: string
  locale?: Locale
}

function avatarUrlOf(m: StaffMember): string | null {
  return m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media).url ?? null : null
}

export default function PublicStaffSection({ staff, slug, locale = 'hu' }: Props) {
  const tt = makeT(locale)
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gold/15">
          <Users className="h-5 w-5 text-ink" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{tt('public.staffEyebrow')}</p>
          <h2 className="text-[24px] font-light leading-tight tracking-[-0.01em] text-ink">{tt('public.staff')}</h2>
        </div>
      </div>

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
                className="group relative block aspect-[5/6] overflow-hidden rounded-[22px]"
              >
                <div className="absolute inset-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={m.name}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-500 flex items-center justify-center">
                      <span className="h-16 w-16 rounded-full bg-zinc-600/40 flex items-center justify-center">
                        <User className="h-8 w-8 text-white/80" />
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
