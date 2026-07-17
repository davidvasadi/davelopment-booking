'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/landing/gsap'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.4'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E"

const TEXT = 'davelopment booking 26©'
// Scroll window-ok a felirathoz — pontosan mint Vision
const TEXT_IN_START  = 0.10
const TEXT_IN_END    = 0.55
const TEXT_OUT_START = 0.55
const TEXT_OUT_END   = 1.00
const CTA_START      = 0.88
const CTA_END        = 1.0

// Pontosan a Vision RollChar logikája — dist alapon, SPREAD/STEP konstansokkal
function DemoChar({
  ch,
  charIndex,
  charCount,
  scrollYProgress,
}: {
  ch: string
  charIndex: number
  charCount: number
  scrollYProgress: MotionValue<number>
}) {
  const frac = charIndex / Math.max(1, charCount - 1)
  const SPREAD = 0.4
  const STEP   = 0.3
  // Vision: delayIn = (1-frac)*SPREAD → utolsó char (frac=1) jön be először
  const delayIn  = (1 - frac) * SPREAD
  const delayOut = frac * SPREAD

  // scrollYProgress 0→1-et dist-té alakítjuk:
  // 0..TEXT_IN_START → dist=1 (messze, lent), TEXT_IN_END..TEXT_OUT_START → dist=0 (bent),
  // TEXT_OUT_END..1 → dist=-1 (messze, fent ki)
  const dist = useTransform(scrollYProgress, (raw) => {
    if (raw <= TEXT_IN_START)  return 1
    if (raw <= TEXT_IN_END)    return 1 - (raw - TEXT_IN_START) / (TEXT_IN_END - TEXT_IN_START)
    if (raw <= TEXT_OUT_START) return 0
    if (raw <= TEXT_OUT_END)   return -((raw - TEXT_OUT_START) / (TEXT_OUT_END - TEXT_OUT_START))
    return -1
  })

  // Pontosan a Vision p számítása
  const p = useTransform(dist, (d) => {
    const ad    = Math.abs(d)
    const delay = d >= 0 ? delayIn : delayOut
    const v     = (delay + STEP - ad) / STEP
    return Math.max(0, Math.min(1, v))
  })

  // Pontosan a Vision y és opacity
  const y = useTransform([p, dist] as const, ([v, d]: number[]) => {
    const sign = d >= 0 ? 1 : -1
    return `${sign * (1 - v) * 110}%`
  })
  const opacity = useTransform(p, [0, 0.5, 1], [0, 0.6, 1])

  return (
    <span className="inline-block overflow-hidden align-bottom" style={{ lineHeight: 1.1 }}>
      <motion.span
        className="inline-block will-change-transform text-[#f4f2ee] font-geist font-medium tracking-[-0.04em] select-none"
        style={{ y, opacity, fontSize: 'clamp(1.8rem,5vw,4.5rem)', display: 'block' }}
      >
        {ch}
      </motion.span>
    </span>
  )
}

function DemoCta({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  const opacity = useTransform(
    scrollYProgress,
    [CTA_START, CTA_END],
    [0, 1],
  )
  const y = useTransform(scrollYProgress, [CTA_START, CTA_END], [16, 0])
  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
      style={{ opacity }}
    >
      <motion.div className="pointer-events-auto" style={{ y }}>
        <RollButton href="/davelopment" label="Megnyitom a demót" variant="accent" size="md" icon />
      </motion.div>
    </motion.div>
  )
}

export function Demo() {
  const root            = useRef<HTMLDivElement>(null)
  const desktopGridRef  = useRef<HTMLDivElement>(null)
  const mobileGridRef   = useRef<HTMLDivElement>(null)
  const desktopHeroRef  = useRef<HTMLDivElement>(null)
  const mobileHeroRef   = useRef<HTMLDivElement>(null)
  const overlayRef      = useRef<HTMLDivElement>(null)
  const grainRef        = useRef<HTMLDivElement>(null)
  const waveTopRef      = useRef<SVGPathElement>(null)
  const waveBotRef      = useRef<SVGPathElement>(null)

  const scrollYProgress = useMotionValue(0)

  useGSAP(
    () => {
      const rootEl    = root.current
      const overlayEl = overlayRef.current
      const grainEl   = grainRef.current
      if (!rootEl || !overlayEl || !grainEl) return

      const waveTopEl = waveTopRef.current
      const waveBotEl = waveBotRef.current

      // Top wave: scrub — ahogy a section belép, a görbe egyenesedik
      // Q parancs mindkét state-ben → GSAP csak a számokat interpolálja
      if (waveTopEl) {
        gsap.fromTo(waveTopEl,
          { attr: { d: 'M0,0 L1440,0 L1440,80 Q720,160 0,80 Z' } },
          {
            attr: { d: 'M0,0 L1440,0 L1440,80 Q720,80 0,80 Z' },
            ease: 'none',
            scrollTrigger: {
              trigger: rootEl,
              start: 'top bottom',
              end: 'top 40%',
              scrub: true,
            },
          }
        )
      }

      // Bottom wave: proxy.p alapján frissül az onUpdate-ben (0→görbe, 1→egyenes)
      if (waveBotEl) {
        gsap.set(waveBotEl, { attr: { d: 'M0,0 Q720,0 1440,0 L1440,80 L0,80 Z' } })
      }

      if (prefersReducedMotion()) {
        const gridEl = desktopGridRef.current!
        gsap.set(gridEl, { scale: 1 })
        gsap.set(overlayEl, { opacity: 0 })
        gsap.set(grainEl, { opacity: 0.15 })
        return
      }

      const mm = gsap.matchMedia()

      mm.add('(min-width: 1024px)', () => {
        const gridEl     = desktopGridRef.current
        const heroCellEl = desktopHeroRef.current
        if (!gridEl || !heroCellEl) return

        const maxOverlay = 0.38
        const maxGrain   = 0.55
        gsap.set(overlayEl, { opacity: maxOverlay })
        gsap.set(grainEl,   { opacity: maxGrain })

        let cover = 3
        const endScale = 1.0

        const calc = () => {
          const W = rootEl.clientWidth
          const H = rootEl.clientHeight
          const w = heroCellEl.offsetWidth
          const h = heroCellEl.offsetHeight
          if (!w || !h) return
          cover = Math.max(W / w, H / h)
        }

        const proxy = { p: 0 }
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: rootEl,
            start: 'top top',
            end: () => `+=${window.innerWidth * 2.8}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            onRefresh: () => { calc(); gsap.set(gridEl, { scale: cover }) },
          },
        })
        tl.to(proxy, {
          p: 1,
          ease: 'none',
          onUpdate() {
            const pe = eio(proxy.p)
            gsap.set(gridEl,    { scale: lerp(cover, endScale, pe) })
            gsap.set(overlayEl, { opacity: maxOverlay * (1 - pe) })
            gsap.set(grainEl,   { opacity: lerp(maxGrain, 0.15, pe) })
            scrollYProgress.set(proxy.p)
            if (waveBotEl) {
              const qY = Math.round(lerp(0, -80, Math.min(proxy.p * 1.6, 1)))
              gsap.set(waveBotEl, { attr: { d: `M0,0 Q720,${qY} 1440,0 L1440,80 L0,80 Z` } })
            }
          },
        })

        calc()
        gsap.set(gridEl, { scale: cover })
        return () => { tl.scrollTrigger?.kill(); tl.kill() }
      })

      mm.add('(max-width: 1023px)', () => {
        const gridEl     = mobileGridRef.current
        const heroCellEl = mobileHeroRef.current
        if (!gridEl || !heroCellEl) return

        const maxOverlay = 0.32
        const maxGrain   = 0.5
        gsap.set(overlayEl, { opacity: maxOverlay })
        gsap.set(grainEl,   { opacity: maxGrain })

        let cover    = 3
        let endScale = 1.0

        const calc = () => {
          const W = rootEl.clientWidth
          const H = rootEl.clientHeight
          const w = heroCellEl.offsetWidth
          const h = heroCellEl.offsetHeight
          if (!w || !h) return
          cover    = Math.max(W / w, H / h)
          endScale = (H * 0.94) / W
        }

        const proxy = { p: 0 }
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: rootEl,
            start: 'top top',
            end: () => `+=${window.innerHeight * 1.6}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            onRefresh: () => { calc(); gsap.set(gridEl, { scale: cover }) },
          },
        })
        tl.to(proxy, {
          p: 1,
          ease: 'none',
          onUpdate() {
            const pe = eio(proxy.p)
            gsap.set(gridEl,    { scale: lerp(cover, endScale, pe) })
            gsap.set(overlayEl, { opacity: maxOverlay * (1 - pe) })
            gsap.set(grainEl,   { opacity: lerp(maxGrain, 0.15, pe) })
            scrollYProgress.set(proxy.p)
            if (waveBotEl) {
              const qY = Math.round(lerp(0, -80, Math.min(proxy.p * 1.6, 1)))
              gsap.set(waveBotEl, { attr: { d: `M0,0 Q720,${qY} 1440,0 L1440,80 L0,80 Z` } })
            }
          },
        })

        calc()
        gsap.set(gridEl, { scale: cover })
        return () => { tl.scrollTrigger?.kill(); tl.kill() }
      })

      return () => mm.revert()
    },
    { scope: root },
  )

  const r    = '14px'
  const gap  = '6px'
  const pad  = '6px'
  const tile = 'relative overflow-hidden'

  // Nem-szóköz karakterek száma a stagger kiszámításához
  const chars = TEXT.split('').filter(c => c !== ' ')
  const charCount = chars.length
  let charIdx = 0

  return (
    <div className="relative">
      {/* FELSŐ HULLÁM */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none" style={{ height: 80, overflow: 'visible' }}>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" width="100%" height="80" style={{ display: 'block', overflow: 'visible' }}>
          <path ref={waveTopRef} fill="white" d="M0,0 L1440,0 L1440,80 L0,80 Z" />
        </svg>
      </div>

    <section
      ref={root}
      className="relative overflow-hidden h-screen"
      style={{ background: '#0a0a0a' }}
    >
      {/* ── DESKTOP RÁCS — 6 oszlop, 2-3-2 elosztás ── */}
      <div
        ref={desktopGridRef}
        className="absolute inset-0 hidden lg:grid will-change-transform"
        style={{
          gridTemplateColumns: 'repeat(6,1fr)',
          gridTemplateRows: 'repeat(3,1fr)',
          gap, padding: pad,
          transformOrigin: 'center center',
        }}
      >
        {/* Sor 1 — 2 kép, egyenlő szélesség */}
        <div className={tile} style={{ gridColumn:'1/4', gridRow:'1/2', borderRadius:r }}>
          <img src="/demo-dashboard.png" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div className={tile} style={{ gridColumn:'4/7', gridRow:'1/2', borderRadius:r }}>
          <img src="/demo-phone.png" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>

        {/* Sor 2 — 3 kép, hero középen */}
        <div className={tile} style={{ gridColumn:'1/3', gridRow:'2/3', borderRadius:r }}>
          <img src="/demo/schedulio-mobile.avif" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div ref={desktopHeroRef} className={tile} style={{ gridColumn:'3/5', gridRow:'2/3', borderRadius:r, boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }}>
          <img src="/demo/schedulio-laptop.webp" alt="davelopment booking dashboard" className="w-full h-full object-cover" />
        </div>
        <div className={tile} style={{ gridColumn:'5/7', gridRow:'2/3', borderRadius:r }}>
          <img src="/demo/schedulio-tablet.webp" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>

        {/* Sor 3 — 2 kép, egyenlő szélesség */}
        <div className={tile} style={{ gridColumn:'1/4', gridRow:'3/4', borderRadius:r }}>
          <img src="/app_screen.png" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div className={`${tile} flex flex-col items-start justify-end`} style={{ gridColumn:'4/7', gridRow:'3/4', borderRadius:r, padding:'20px', background:'linear-gradient(135deg,#1c1c1c,#0a0a0a)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xs text-white/30 tracking-widest uppercase mb-1">Demo</span>
          <p className="font-semibold text-white leading-tight tracking-[-0.03em] text-[1rem]">Bankkártya<br />nem kell.</p>
        </div>
      </div>

      {/* ── MOBIL RÁCS — 6 oszlop, 2-3-2 elosztás ── */}
      <div className="lg:hidden" style={{ position:'absolute', top:'50%', left:0, width:'100%', marginTop:'-67vw', overflow:'visible' }}>
        <div
          ref={mobileGridRef}
          className="will-change-transform"
          style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gridTemplateRows:'50vw 33.333vw 50vw', gap, padding:pad, transformOrigin:'center center', width:'100vw' }}
        >
          {/* Sor 1 — 2 kép */}
          <div className={tile} style={{ gridColumn:'1/4', borderRadius:r }}><img src="/demo-dashboard.png" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /></div>
          <div className={tile} style={{ gridColumn:'4/7', borderRadius:r }}><img src="/demo-phone.png" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /></div>

          {/* Sor 2 — 3 kép, hero középen */}
          <div className={tile} style={{ gridColumn:'1/3', borderRadius:r }}><img src="/demo/schedulio-mobile.avif" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /></div>
          <div ref={mobileHeroRef} className={tile} style={{ gridColumn:'3/5', borderRadius:r, boxShadow:'0 12px 40px rgba(0,0,0,0.6)' }}>
            <img src="/demo/schedulio-laptop.webp" alt="davelopment booking dashboard" className="w-full h-full object-cover" />
          </div>
          <div className={tile} style={{ gridColumn:'5/7', borderRadius:r }}><img src="/demo/schedulio-tablet.webp" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /></div>

          {/* Sor 3 — 2 kép */}
          <div className={tile} style={{ gridColumn:'1/4', borderRadius:r }}><img src="/app_screen.png" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /></div>
          <div className={`${tile} flex flex-col items-start justify-end`} style={{ gridColumn:'4/7', borderRadius:r, padding:'8px', background:'linear-gradient(135deg,#1c1c1c,#0a0a0a)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[9px] text-white/30 tracking-widest uppercase mb-0.5">Demo</span>
            <p className="font-semibold text-white leading-tight tracking-[-0.03em] text-[0.6rem]">Bankkártya<br />nem kell.</p>
          </div>
        </div>
      </div>

      {/* OVERLAY */}
      <div ref={overlayRef} className="absolute inset-0 z-10 pointer-events-none" style={{ background:'#0a0a0a', opacity:0.38 }} />

      {/* GRAIN */}
      <div ref={grainRef} className="absolute inset-0 z-10 pointer-events-none" style={{ backgroundImage:`url("${GRAIN}")`, backgroundSize:'150px 150px', backgroundRepeat:'repeat', mixBlendMode:'overlay', opacity:0.4 }} />

      {/* FELIRAT — Framer Motion, közvetlenül a scroll progress-hez kötve mint a Vision */}
      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
        <div className="flex items-baseline">
          {TEXT.split('').map((ch, i) =>
            ch === ' ' ? (
              <span key={i} className="inline-block" style={{ width: '0.28em' }} />
            ) : (
              <DemoChar
                key={i}
                ch={ch}
                charIndex={charIdx++}
                charCount={charCount}
                scrollYProgress={scrollYProgress}
              />
            )
          )}
        </div>
      </div>

      {/* CTA */}
      <DemoCta scrollYProgress={scrollYProgress} />

      {/* ALSÓ HULLÁM — sectionon BELÜL, overflow-hidden nem vágja le mert a görbe felfelé (sectionba) ível */}
      <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-none" style={{ height: 80, overflow: 'visible' }}>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" width="100%" height="80" style={{ display: 'block', overflow: 'visible' }}>
          <path ref={waveBotRef} fill="white" d="M0,0 L1440,0 L1440,80 L0,80 Z" />
        </svg>
      </div>
    </section>
    </div>
  )
}
