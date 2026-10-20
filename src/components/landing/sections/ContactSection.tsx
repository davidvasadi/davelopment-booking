'use client'

import { motion } from 'framer-motion'
import { Clock, Mail, Zap, HelpCircle } from 'lucide-react'
import { FadeUp } from '@/components/landing/Motion'
import { ContactForm } from '@/components/landing/ContactForm'
import { AuthVideoBg } from '@/components/auth/AuthVideoBg'
import { GoogleRatingBadge } from '@/components/landing/GoogleRatingBadge'
import { EASE } from '@/lib/motion'
import { CONTACT_EMAIL } from '@/lib/brand'

// Stagger a szülőn triggerel, a gyerekek egymás után úsznak fel — ugyanaz a minta, mint a
// TipsTeaser fejlécénél/kártyáinál.
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
} as const

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
} as const

const INFO_CARDS = [
  {
    icon: Clock,
    title: 'Ügyfélszolgálat',
    body: 'Hétfőtől péntekig, 10:00–15:00 · +36 30 362 8377',
    href: 'tel:+36303628377',
  },
  {
    icon: Mail,
    title: 'Email',
    body: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: Zap,
    title: 'Válaszidő',
    body: 'Munkaidőben jellemzően néhány órán belül válaszolunk.',
  },
  {
    icon: HelpCircle,
    title: 'Gyors válaszok',
    body: 'Nézd meg a GYIK-et — sok kérdésre már ott is megtalálod a választ.',
    href: '#gyik',
  },
]

export function ContactSection({
  googleRating,
}: {
  /** Cache-elt Google Cégem-pontszám (lásd src/lib/google-rating.ts) — null, ha még nincs cron-adat. */
  googleRating?: { rating: number; userRatingCount: number } | null
}) {
  return (
    <section id="kapcsolat" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28">
      <FadeUp>
        <div className="relative rounded-[30px] overflow-hidden min-h-[880px] lg:min-h-[680px]">
          <AuthVideoBg />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="relative flex h-full flex-col lg:flex-row"
          >
            {/* Bal — form, teljesen átlátszó a videón (pontosan a register-wizard mobil mintája) */}
            <div className="flex w-full flex-col justify-center px-6 py-14 lg:w-[44%] lg:px-12 lg:py-16">
              <motion.span variants={item} className="inline-flex self-start items-center rounded-full bg-white/10 px-4 py-2 font-onest text-[13px] tracking-[-0.02em] text-white/70 backdrop-blur-[10px] mb-5">
                Kapcsolat
              </motion.span>
              <motion.h2 variants={item} className="font-semibold text-white text-[clamp(2rem,3.5vw,2.75rem)] leading-[1.05] tracking-[-0.04em] mb-5">
                Kérdésed van?
              </motion.h2>
              {googleRating && (
                <motion.div variants={item} className="mb-7">
                  <GoogleRatingBadge
                    rating={googleRating.rating}
                    userRatingCount={googleRating.userRatingCount}
                    className="text-brand-accent"
                  />
                </motion.div>
              )}
              <motion.div variants={item}>
                <ContactForm />
              </motion.div>
            </div>

            {/* Jobb — nagy cím + 4 nagyobb infókártya 2x2 */}
            <div className="flex w-full flex-col justify-center gap-12 px-6 py-14 lg:w-[56%] lg:px-14 lg:py-16">
              <div>
                <motion.h3 variants={item} className="font-semibold text-white text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.98] tracking-[-0.04em]">
                  Beszéljünk.
                </motion.h3>
                <motion.p variants={item} className="mt-5 text-white/60 text-[16px] leading-[1.6] max-w-sm">
                  Írj nekünk kérdés, probléma vagy visszajelzés esetén — ide kerül minden, amit a formon keresztül küldesz.
                </motion.p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {INFO_CARDS.map(({ icon: Icon, title, body, href }) => {
                  const Cmp = motion[href ? 'a' : 'div']
                  return (
                    <Cmp key={title} variants={item} {...(href ? { href } : {})} className="flex items-start gap-4">
                      <Icon className="h-6 w-6 shrink-0 text-white" strokeWidth={1.6} />
                      <div>
                        <p className="text-[15px] font-semibold text-white">{title}</p>
                        <p className="mt-1 text-[13.5px] text-white/55 leading-[1.5]">{body}</p>
                      </div>
                    </Cmp>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </FadeUp>
    </section>
  )
}
