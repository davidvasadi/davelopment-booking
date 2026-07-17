'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'
import { JoinWord } from '@/components/landing/JoinWord'
import { EASE } from '@/lib/motion'

/** Footer-link text-roll felirattal + nyíl-elfordulással (a Pricing/RollButton nyelve). */
function FooterLink({ href, label }: { href: string; label: string }) {
  const Cmp = href.startsWith('#') ? 'a' : Link
  return (
    <motion.div initial="rest" whileHover="hover" animate="rest" className="inline-flex">
      <Cmp href={href} className="group inline-flex items-center gap-1.5 text-lg text-white/70 hover:text-white transition-colors">
        {/* text-roll */}
        <span className="overflow-hidden inline-block" style={{ height: '1.75rem' }}>
          <motion.span
            className="flex flex-col"
            style={{ lineHeight: '1.75rem' }}
            variants={{ rest: { y: 0 }, hover: { y: '-1.5rem' } }}
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
          <ArrowUpRight className="h-4 w-4" />
        </motion.span>
      </Cmp>
    </motion.div>
  )
}

const NAV_LINKS = [
  { href: '#hogyan', label: 'Hogyan működik' },
  { href: '#velemenyek', label: 'Vélemények' },
  { href: '#arazas', label: 'Árazás' },
  { href: '#gyik', label: 'GYIK' },
  { href: '/login', label: 'Bejelentkezés' },
]
const INDUSTRY_LINKS = [
  { href: '/register-restaurant', label: 'Éttermeknek' },
  { href: '/register', label: 'Fodrászatoknak' },
  { href: '/register', label: 'Szépségszalonoknak' },
  { href: '/register', label: 'Körömszalonoknak' },
  { href: '/register', label: 'Masszázs & Spa' },
  { href: '/register', label: 'Orvosoknak' },
  { href: '/register', label: 'Fogászatoknak' },
  { href: '/register', label: 'Edzőknek' },
]
const LEGAL_LINKS = [
  { href: '/terms', label: 'Felhasználási feltételek' },
  { href: '/privacy', label: 'Adatkezelési tájékoztató' },
  { href: '/cookies', label: 'Sütikezelés' },
]

/** Sötét lábléc: márka-blokk, gyors linkek, jogi linkek, regisztráció-CTA és a nagy „Csatlakozz" felirat. */
export function Footer({ trial_days }: { trial_days: number }) {
  return (
    <footer
      className="relative text-white overflow-hidden m-2 rounded-xl mt-2"
      style={{
        backgroundImage:
          'radial-gradient(120% 110% at 50% -10%, #333333 0%, #1c1c1c 40%, #0a0a0a 100%)',
      }}
    >
      {/* grain textúra — static PNG data URI, nem SVG filter (nincs repaint) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'url(/noise.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: '180px 180px',
        }}
      />
      <div className="relative mx-auto px-6 lg:px-10 pt-16 lg:pt-20 pb-12">
        <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-[1.8fr_1fr_1fr_1fr] lg:gap-10">
          {/* Márka-blokk + CTA (egy oszlop lg-n, teljes sor sm/mobile-on) */}
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-6">
            <div>
              <BrandLogo variant="dark" className="h-12" />
              <p className="mt-4 text-4xl lg:text-5xl font-bold tracking-tight">Online Időpontfoglaló.</p>
              <div className="text-white/70">
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
            <RollButton href="/register" label="Ingyenes Regisztráció" variant="accent" size="md" icon className="w-full sm:w-auto" />
            {/* Biztonságos fizetés — Stripe */}
            <span className="inline-flex items-center gap-2 text-xs text-white/40">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Fizetés a <span className="font-semibold text-white/70">Stripe</span> biztonságos rendszerén keresztül</span>
            </span>
            <a
              href="https://davelopment.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Powered by <br />
              <span className="font-bold text-white text-lg">[davelopment]®</span>
            </a>
          </div>

          {/* Gyors linkek */}
          <div>
            <p className="text-lg font-semibold uppercase tracking-wider mb-3 whitespace-nowrap">Gyors linkek</p>
            <ul className="space-y-1.5">
              {NAV_LINKS.map((l) => (
                <li key={l.href}><FooterLink href={l.href} label={l.label} /></li>
              ))}
            </ul>
          </div>

          {/* Iparági linkek */}
          <div>
            <p className="text-lg font-semibold uppercase tracking-wider mb-3 whitespace-nowrap">Kinek</p>
            <ul className="space-y-1.5">
              {INDUSTRY_LINKS.map((l) => (
                <li key={l.label}><FooterLink href={l.href} label={l.label} /></li>
              ))}
            </ul>
          </div>

          {/* Jogi linkek */}
          <div>
            <p className="text-lg font-semibold uppercase tracking-wider mb-3">Jogi</p>
            <ul className="space-y-1.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}><FooterLink href={l.href} label={l.label} /></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <JoinWord>Csatlakozz</JoinWord>
    </footer>
  )
}
