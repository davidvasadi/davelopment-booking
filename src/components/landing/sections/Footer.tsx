'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'
import { JoinWord } from '@/components/landing/JoinWord'
import { GoogleRatingBadge } from '@/components/landing/GoogleRatingBadge'
import { EASE, buttonHover } from '@/lib/motion'
import { Grain } from '@/components/landing/Grain'
import { SERVICES } from '@/components/landing/sections/Nav'

/** Footer-link text-roll felirattal + nyíl-elfordulással (a Pricing/RollButton nyelve). */
function FooterLink({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  const Cmp = href.startsWith('#') ? 'a' : Link
  return (
    <motion.div initial="rest" whileHover="hover" animate="rest" className="inline-flex">
      <Cmp href={href} className={`group inline-flex items-center gap-1.5 text-white/70 hover:text-white transition-colors ${compact ? 'text-ui-body' : 'text-lg'}`}>
        {/* text-roll */}
        <span className="overflow-hidden inline-block" style={{ height: compact ? '1.3rem' : '1.75rem' }}>
          <motion.span
            className="flex flex-col"
            style={{ lineHeight: compact ? '1.3rem' : '1.75rem' }}
            variants={{ rest: { y: 0 }, hover: { y: compact ? '-1.3rem' : '-1.5rem' } }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className="block">{label}</span>
            <span className="block" aria-hidden>{label}</span>
          </motion.span>
        </span>
        {/* nyíl elfordul + kicsúszik */}
        <motion.span
          variants={{ rest: { rotate: 0, x: 0, opacity: 0.6 }, hover: { rotate: 45, x: 3, opacity: 1 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="inline-flex"
        >
          <ArrowUpRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </motion.span>
      </Cmp>
    </motion.div>
  )
}

const NAV_LINKS = [
  { href: '/register', label: 'Időpontfoglaló rendszer' },
  { href: '#hogyan', label: 'Hogyan működik' },
  { href: '#velemenyek', label: 'Vélemények' },
  { href: '/arak', label: 'Árak' },
  { href: '#gyik', label: 'GYIK' },
  { href: '/kapcsolat', label: 'Kapcsolat' },
  { href: '/login', label: 'Bejelentkezés' },
]
// A saját iparági SEO-landingekre mutat (lásd `src/lib/industryLandings.ts`) — nem `/register`-re.
// A footer minden oldalon megjelenik, így ez a legerősebb, mindenhonnan induló belső link
// ezekre az oldalakra, ami segíti a keresőmotoros súlyukat.
const INDUSTRY_LINKS = [
  { href: '/etterem-asztalfoglalas', label: 'Éttermeknek' },
  { href: '/fodrasz-idopontfoglalas', label: 'Fodrászoknak' },
  { href: '/kozmetikus-idopontfoglalas', label: 'Kozmetikusoknak' },
  { href: '/mukormos-idopontfoglalas', label: 'Műkörmösöknek' },
  { href: '/masszor-idopontfoglalas', label: 'Masszőröknek' },
  { href: '/csontkovacs-idopontfoglalas', label: 'Csontkovácsoknak' },
  { href: '/fogorvos-idopontfoglalas', label: 'Fogorvosoknak' },
  { href: '/maganrendelo-idopontfoglalas', label: 'Magánrendelőknek' },
  { href: '/barber-idopontfoglalas', label: 'Barbereknek' },
  { href: '/szemelyi-edzo-idopontfoglalas', label: 'Személyi edzőknek' },
  { href: '/pilates-idopontfoglalas', label: 'Pilates stúdióknak' },
  { href: '/joga-idopontfoglalas', label: 'Jóga oktatóknak' },
  { href: '/csapatkezeles-vallalkozasoknak', label: 'Csapatkezeléshez' },
]
const LEGAL_LINKS = [
  { href: '/terms', label: 'Felhasználási feltételek' },
  { href: '/privacy', label: 'Adatkezelési tájékoztató' },
  { href: '/cookies', label: 'Sütikezelés' },
]

/** Sötét lábléc: márka-blokk, gyors linkek, jogi linkek, regisztráció-CTA és a nagy „Csatlakozz" felirat. */
export function Footer({
  trial_days,
  googleRating,
  compact = false,
}: {
  trial_days: number
  /** tömörebb lábléc (új főoldal): kisebb linkek, címek, térközök és „Csatlakozz” felirat */
  compact?: boolean
  /** Cache-elt Google Cégem-pontszám (lásd src/lib/google-rating.ts) — null, ha még nincs cron-adat. */
  googleRating?: { rating: number; userRatingCount: number } | null
}) {
  return (
    <footer
      className="relative text-white overflow-hidden m-2 rounded-xl mt-2"
      style={{
        backgroundImage:
          'radial-gradient(120% 110% at 50% -10%, #333333 0%, #1c1c1c 40%, #0a0a0a 100%)',
      }}
    >
      <Grain opacity={0.18} />
      <div className={`relative mx-auto px-6 lg:px-10 ${compact ? 'pb-6 pt-10 lg:pt-12' : 'pt-16 lg:pt-20 pb-12'}`}>
        <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-[1.8fr_1fr_1fr_1fr] lg:gap-10">
          {/* Márka-blokk + CTA (egy oszlop lg-n, teljes sor sm/mobile-on) */}
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-6">
            <div>
              <BrandLogo variant="dark" className={compact ? 'h-9' : 'h-12'} />
              <p className={`mt-4 font-bold tracking-tight ${compact ? 'text-2xl lg:text-3xl' : 'text-4xl lg:text-5xl'}`}>Online Időpontfoglaló.</p>
              <div className={`text-white/70 ${compact ? 'text-ui-body' : ''}`}>
                <p className="mt-4 tracking-tight">
                  Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra figyelj. Éttermeknek,
                  fodrászatoknak, kis vállalkozásoknak. Próbáld ki {trial_days} napig ingyen.
                </p>
                <p className="mt-4 tracking-tight">
                  ©2026 davelopment booking ·{' '}
                  <a href="mailto:hello@davelopment.hu" className="underline underline-offset-2 hover:text-white transition-colors">
                    hello@davelopment.hu
                  </a>
                </p>
              </div>
            </div>
            {/* CTA */}
            <motion.a
              href="/register"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className={`inline-flex self-start items-center rounded-full bg-white font-onest font-medium text-[#1d1c19] ${compact ? 'gap-2 py-1.5 pl-4 pr-1.5 text-ui-row' : 'gap-2.5 py-2.5 pl-5 pr-2.5 text-base'}`}
            >
              Ingyenes regisztráció
              <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#f1ce45' }}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
              </span>
            </motion.a>
            {/* Biztonságos fizetés — Stripe */}
            <span className="inline-flex items-center gap-2 text-xs text-white/40">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>
                Fizetés a{' '}
                <a
                  href="https://stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white/70 hover:text-white transition-colors underline underline-offset-2"
                >
                  Stripe
                </a>{' '}
                biztonságos rendszerén keresztül
              </span>
            </span>
            {googleRating && (
              <GoogleRatingBadge
                rating={googleRating.rating}
                userRatingCount={googleRating.userRatingCount}
                className="text-xs text-white/40"
              />
            )}
            <a
              href="https://davelopment.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Powered by <br />
              <span className="font-bold text-white text-lg">[davelopment]©</span>
            </a>
          </div>

          {/* Gyors linkek */}
          <div>
            <p className={`font-semibold uppercase tracking-wider mb-3 whitespace-nowrap ${compact ? 'text-ui-meta text-white/50' : 'text-lg'}`}>Gyors linkek</p>
            <ul className="space-y-1.5">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><FooterLink href={l.href} label={l.label} compact={compact} /></li>
              ))}
            </ul>
            <p className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/35">
              davelopment
            </p>
            <ul className="space-y-1.5">
              {SERVICES.map((s) => (
                <li key={s.label}><FooterLink href={s.href} label={s.label} compact={compact} /></li>
              ))}
            </ul>
          </div>

          {/* Iparági linkek */}
          <div>
            <p className={`font-semibold uppercase tracking-wider mb-3 whitespace-nowrap ${compact ? 'text-ui-meta text-white/50' : 'text-lg'}`}>Kinek</p>
            <ul className="space-y-1.5">
              {INDUSTRY_LINKS.map((l) => (
                <li key={l.label}><FooterLink href={l.href} label={l.label} compact={compact} /></li>
              ))}
            </ul>
          </div>

          {/* Jogi linkek */}
          <div>
            <p className={`font-semibold uppercase tracking-wider mb-3 ${compact ? 'text-ui-meta text-white/50' : 'text-lg'}`}>Jogi</p>
            <ul className="space-y-1.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}><FooterLink href={l.href} label={l.label} compact={compact} /></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="relative z-10">
        <JoinWord>Csatlakozz</JoinWord>
      </div>
    </footer>
  )
}
