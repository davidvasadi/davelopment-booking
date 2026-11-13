'use client'

import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { SERVICES } from '@/lib/davelopmentServices'

/**
 * davelopment ajánló — széltől szélig érő, sötét változat parallax háttérrel (a hegygerinc-fotó besötétítve; görgetésre
 * a háttér lassabban mozog, mint az oldal). Középen a davelopment logó (világos), cím, szöveg, a szolgáltatások és a
 * gomb. A linkek `utm_source=booking` jelölést kapnak (davelopment.hu-n mérhető). A mozgás egy `transform`, így a
 * böngésző natívan (hardveresen) animálja; csökkentett mozgásnál áll.
 */
const withUtm = (href: string, campaign: string) => {
  if (!href.startsWith('https://davelopment.hu')) return href
  const u = new URL(href)
  u.searchParams.set('utm_source', 'booking')
  u.searchParams.set('utm_medium', 'cta')
  u.searchParams.set('utm_campaign', campaign)
  return u.toString()
}

export function DavelopmentCtaParallax({ campaign = 'landing', title = 'Komplexebb weboldalt vagy marketinget szeretnél?', lead = 'Egyedi weboldal, arculat, online hirdetések vagy saját üzleti rendszer — a davelopment csapata megcsinálja, ugyanazok, akik a davelopment bookingot is építették.' }: {
  campaign?: string; title?: string; lead?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['translateY(-12%)', reduce ? 'translateY(-12%)' : 'translateY(12%)'])
  const home = withUtm('https://davelopment.hu', campaign)
  const services = SERVICES.filter((s) => s.href.startsWith('https://davelopment.hu'))
  return (
    <section ref={ref} className="font-onest">
      {/* széltől szélig: se oldalsó margó, se lekerekítés */}
      <div className="relative isolate overflow-hidden bg-[#1A1A1C]">
        {/* a háttér a doboznál magasabb (±12% mozgástér), és besötétítve */}
        <motion.div style={{ transform: y }} className="absolute inset-x-0 -top-[14%] -bottom-[14%] -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/hero/sziklas-hatter-davelopment-booking.webp" alt="" width={2400} height={1350} loading="lazy" decoding="async"
            className="h-full w-full object-cover object-bottom brightness-[0.32]" />
        </motion.div>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-[#1A1A1C]/70 via-transparent to-[#1A1A1C]/40" />

        <div className="mx-auto flex min-h-[560px] max-w-[760px] flex-col items-center justify-center px-6 py-20 text-center lg:min-h-[640px] lg:py-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_davelopment_light.svg" alt="davelopment" width={2034} height={526} className="h-9 w-auto lg:h-11" />
          <span className="mt-6 rounded-[8px] bg-white/10 px-3.5 py-1.5 text-[14px] font-medium text-white/80">Webes ügynökség</span> {/* ui-allow: a SectionHead sötét pill-formája */}
          <h2 className="mt-5 text-[clamp(2rem,4vw,56px)] font-medium leading-[1.06] tracking-[-0.035em] text-white">{title}</h2> {/* ui-allow: szakaszcím */}
          <p className="mt-4 max-w-[560px] text-ui-row leading-[1.55] text-white/60">{lead}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-1.5">
            {services.map((s) => (
              <a key={s.label} href={withUtm(s.href, campaign)} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-ui-meta font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white hover:text-ui-dark">
                {s.label}<ArrowUpRight className="h-3.5 w-3.5 opacity-60" strokeWidth={2} />
              </a>
            ))}
          </div>
          <a href={home} target="_blank" rel="noopener"
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-ui-row font-medium text-ui-dark transition-opacity hover:opacity-90">
            Ismerd meg a davelopmentet <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </div>
      </div>
    </section>
  )
}
