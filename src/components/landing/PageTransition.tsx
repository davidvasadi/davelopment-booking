'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BrandLogo } from '@/components/BrandLogo'
import { DARK_SURFACE_BG, GrainCanvas } from '@/components/landing/GrainCanvas'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'
import { FEATURE_GROUPS } from '@/lib/landingFeatures'

/**
 * Oldalváltás a landing-oldalak között (Framer-sablonos „függöny”): belső linkre kattintva 5
 * lépcsőzött sötét oszlop csúszik fel alulról, középen a logó és a céloldal neve; amint az új oldal
 * betöltött, az oszlopok tovább felfelé kiúsznak (egy folyamatos áramlás) és kitárják. Csak a marketing-oldalak KÖZÖTT fut (főoldal, funkciók, árak,
 * kapcsolat, tippek, iparági landingek) — a dashboardot, a backstage-et és az üzletek
 * foglalóoldalait nem érinti. Kihagyja: horgonyokat, új lapot, módosító billentyűket,
 * a vissza/előre gombot; csökkentett mozgásnál ki van kapcsolva.
 */
const INDUSTRY = new Set(Object.keys(INDUSTRY_LANDINGS))
const EASE_CURTAIN = [0.76, 0, 0.24, 1] as const
const COLS = 5
const STAGGER = 0.05

function isMarketing(path: string): boolean {
  if (path === '/') return true
  const first = path.split('/')[1] ?? ''
  return ['funkciok', 'arak', 'kapcsolat', 'tips'].includes(first) || INDUSTRY.has(first)
}

type Phase = 'idle' | 'cover' | 'reveal'

export function PageTransition() {
  const router = useRouter()
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const target = useRef<string | null>(null)
  const safety = useRef<number | undefined>(undefined)

  // kattintás-elfogás (capture fázisban, hogy a Next Link előtt döntsünk)
  useEffect(() => {
    if (reduce) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return // ugyanaz az oldal (pl. /#horgony)
      if (!isMarketing(window.location.pathname) || !isMarketing(url.pathname)) return
      e.preventDefault()
      e.stopPropagation()
      target.current = url.pathname + url.search + url.hash
      setPhase('cover')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [reduce])

  // ha megérkeztünk az új oldalra, jöhet a kitárulás
  useEffect(() => {
    if (phase === 'cover' && target.current && pathname === new URL(target.current, window.location.origin).pathname) {
      window.clearTimeout(safety.current)
      // egy képkocka, hogy az új oldal kirajzolódjon a függöny mögött
      requestAnimationFrame(() => setPhase('reveal'))
    }
  }, [pathname, phase])

  const onCovered = () => {
    if (phase !== 'cover' || !target.current) return
    router.push(target.current)
    // biztonsági háló: ha a navigáció elakad, ne maradjon letakarva az oldal
    safety.current = window.setTimeout(() => setPhase('reveal'), 4000)
  }

  const label = target.current ? pageLabel(new URL(target.current, 'http://x').pathname) : ''
  const covering = phase === 'cover'

  return (
    <AnimatePresence>
      {phase !== 'idle' && (
        <div key="curtain" aria-hidden className="pointer-events-auto fixed inset-0 z-[200] overflow-hidden">
          {/* 5 lépcsőzött oszlop: befelé alulról fel, kifelé tovább felfelé — egy folyamatos áramlás.
              A gradiens a teljes képernyőre van méretezve és oszloponként eltolva → egybefüggő. */}
          {Array.from({ length: COLS }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 isolate h-full overflow-hidden"
              style={{
                left: `${(i * 100) / COLS}%`,
                width: `calc(${100 / COLS}% + 1px)`,
                background: DARK_SURFACE_BG,
                backgroundSize: '100vw 100vh',
                backgroundPosition: `-${(i * 100) / COLS}vw 0`,
              }}
              initial={{ y: '100%' }}
              animate={{ y: covering ? '0%' : '-100%' }}
              transition={{ duration: covering ? 0.55 : 0.65, delay: i * STAGGER, ease: EASE_CURTAIN }}
              onAnimationComplete={i === COLS - 1 ? () => {
                if (phase === 'cover') onCovered()
                else if (phase === 'reveal') { setPhase('idle'); target.current = null }
              } : undefined}
            >
              {/* ugyanaz a grain-textúra, mint a sötét felületeken (árazás, hero-k) */}
              <GrainCanvas strength="light" opacity={0.8} zIndex={-1} />
            </motion.div>
          ))}

          {/* középen: logó + a céloldal neve, maszk mögül */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={covering ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.35, delay: covering ? 0.3 : 0, ease: 'easeOut' }}
            >
              <BrandLogo variant="dark" className="h-[26px]" />
            </motion.div>
            <span className="block overflow-hidden pb-2">
              <motion.span
                className="block font-onest text-[clamp(2.5rem,7vw,96px)] font-medium leading-none tracking-[-0.05em] text-white"
                initial={{ y: '110%' }}
                animate={{ y: covering ? '0%' : '-110%' }}
                transition={{ duration: 0.55, delay: covering ? 0.32 : 0, ease: EASE_CURTAIN }}
              >
                {label}
              </motion.span>
            </span>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** A céloldal megjelenített neve a függönyön. */
function pageLabel(path: string): string {
  if (path === '/') return 'Főoldal'
  const [, first = '', second] = path.split('/')
  if (first === 'funkciok') return second ? (FEATURE_GROUPS.find((g) => g.slug === second)?.label ?? 'Funkciók') : 'Funkciók'
  if (first === 'arak') return 'Árak'
  if (first === 'kapcsolat') return 'Kapcsolat'
  if (first === 'tips') return 'Tippek'
  return INDUSTRY_SHORT_LABEL[first] ?? ''
}
