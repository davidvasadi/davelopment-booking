'use client'

import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/landing/gsap'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const lerp  = (a: number, b: number, t: number) => a + (b - a) * t
const eio   = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function Demo() {
  return (
    <>
      <DemoGrid mobile={false} />
      <DemoGrid mobile={true} />
    </>
  )
}

function DemoGrid({ mobile }: { mobile: boolean }) {
  const root       = useRef<HTMLDivElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)
  const heroCell   = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const markRef    = useRef<HTMLDivElement>(null)
  const ctaRef     = useRef<HTMLDivElement>(null)

  const maxOverlay  = mobile ? 0.45 : 0.55
  const scrollMult  = mobile ? 1.6  : 2.8
  const markFontMax = mobile ? '3.5rem' : '7.5rem'

  useGSAP(() => {
    const rootEl     = root.current
    const gridEl     = gridRef.current
    const heroCellEl = heroCell.current
    const overlayEl  = overlayRef.current
    const markEl     = markRef.current
    const ctaEl      = ctaRef.current
    if (!rootEl || !gridEl || !heroCellEl || !overlayEl || !markEl || !ctaEl) return

    let cover    = 3
    let endScale = 1.0

    const calc = () => {
      const W = gridEl.clientWidth, H = gridEl.clientHeight
      const w = heroCellEl.offsetWidth, h = heroCellEl.offsetHeight
      // cover: hero teljes képernyőre nagyítva
      cover = Math.max(W / w, H / h)
      if (mobile) {
        // endScale: hero még mindig H*0.88 magas → szomszédok éppen kukucskálnak be
        endScale = (H * 0.88) / h
      }
    }

    if (prefersReducedMotion()) {
      calc()
      gsap.set(gridEl,    { scale: endScale })
      gsap.set(overlayEl, { opacity: 0 })
      gsap.set(ctaEl,     { opacity: 1, y: 0 })
      return
    }

    gsap.set(ctaEl, { opacity: 0, y: 0 })

    const onUpdate = (self: { progress: number }) => {
      const p  = self.progress
      const pe = eio(p)

      gsap.set(gridEl,    { scale: lerp(cover, endScale, pe) })
      gsap.set(overlayEl, { opacity: maxOverlay * (1 - pe) })

      const inT  = clamp((p - 0.06) / 0.18)
      const outT = clamp((p - 0.62) / 0.22)
      gsap.set(markEl, { opacity: 1, filter: `blur(${outT * (mobile ? 8 : 10)}px)` })

      markEl.querySelectorAll<HTMLElement>('[data-roll-char]').forEach((ch) => {
        const i     = Number(ch.dataset.index ?? 0)
        const total = Number(ch.dataset.total ?? 9)
        const frac  = i / Math.max(1, total - 1)
        const inDelay  = frac * 0.20
        const rawInT   = clamp((inT - inDelay) / (1 - inDelay))
        const eIn      = rawInT < 0.5 ? 4*rawInT**3 : 1 - Math.pow(-2*rawInT+2,3)/2
        const outDelay = (1 - frac) * 0.16
        const rawOutT  = clamp((outT - outDelay) / (1 - outDelay))
        const eOut     = rawOutT < 0.5 ? 4*rawOutT**3 : 1 - Math.pow(-2*rawOutT+2,3)/2
        gsap.set(ch, { y: `${(1 - eIn) * 110 - eOut * 110}%` })
      })

      const cT = clamp((p - 0.84) / 0.13)
      gsap.set(ctaEl, { opacity: cT, y: mobile ? 0 : 20 * (1 - cT) })
    }

    calc()
    onUpdate({ progress: 0 })

    const st = gsap.to({}, {
      scrollTrigger: {
        trigger: rootEl,
        start: 'top top',
        end: () => mobile
          ? `+=${window.innerHeight * scrollMult}`
          : `+=${window.innerWidth  * scrollMult}`,
        pin: true,
        scrub: 1.2,
        invalidateOnRefresh: true,
        onUpdate,
        onRefresh: () => { calc(); onUpdate({ progress: 0 }) },
      },
    })

    return () => { st.scrollTrigger?.kill(); st.kill() }
  }, { scope: root })

  const r   = mobile ? '14px' : '14px'
  const gap = mobile ? '6px'  : '6px'
  const pad = mobile ? '6px'  : '6px'
  const tile = `relative overflow-hidden`

  return (
    <section
      ref={root}
      className={`relative overflow-hidden h-screen ${mobile ? 'lg:hidden' : 'hidden lg:block'}`}
      style={{ background: '#0a0a0a' }}
    >
      {mobile ? (
        /* ── MOBIL: flex wrapper középre, aspect-ratio négyzetek, rács auto magasság ── */
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <div
            ref={gridRef}
            className="will-change-transform w-full"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridAutoRows: 'auto',
              gap,
              padding: pad,
              transformOrigin: 'center center',
            }}
          >
            {/* Sor 1: 2× 1:1 négyzet */}
            <div className={tile} style={{ aspectRatio: '1/1', borderRadius: r }}>
              <img src="/demo-dashboard.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className={tile} style={{ aspectRatio: '1/1', borderRadius: r }}>
              <img src="/demo-phone.png" alt="" className="w-full h-full object-cover" />
            </div>

            {/* Sor 2: HERO — span 2, négyzet (100vw × 100vw) */}
            <div
              ref={heroCell}
              className={tile}
              style={{ gridColumn: 'span 2', aspectRatio: '1/1', borderRadius: r, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
            >
              <img src="/demo/schedulio-laptop.webp" alt="Schedulio dashboard" className="w-full h-full object-cover" />
            </div>

            {/* Sor 3: 2× 1:1 négyzet */}
            <div className={tile} style={{ aspectRatio: '1/1', borderRadius: r }}>
              <img src="/demo/schedulio-mobile.avif" alt="" className="w-full h-full object-cover" />
            </div>
            <div className={tile} style={{ aspectRatio: '1/1', borderRadius: r }}>
              <img src="/demo/schedulio-tablet.webp" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      ) : (
        /* ── DESKTOP: eredeti 3×3 téglalapok ── */
        <div
          ref={gridRef}
          className="absolute inset-0 grid will-change-transform"
          style={{
            gridTemplateColumns: 'repeat(3,1fr)',
            gridTemplateRows: 'repeat(3,1fr)',
            gap,
            padding: pad,
            transformOrigin: 'center center',
          }}
        >
          <div className={tile} style={{ gridColumn:'1/2', gridRow:'1/2', borderRadius: r }}>
            <img src="/demo-dashboard.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className={tile} style={{ gridColumn:'2/4', gridRow:'1/2', borderRadius: r }}>
            <img src="/demo-phone.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className={tile} style={{ gridColumn:'1/2', gridRow:'2/3', borderRadius: r }}>
            <img src="/demo/schedulio-mobile.avif" alt="" className="w-full h-full object-cover" />
          </div>

          <div
            ref={heroCell}
            className={tile}
            style={{ gridColumn:'2/3', gridRow:'2/3', borderRadius: r, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
          >
            <img src="/demo/schedulio-laptop.webp" alt="Schedulio dashboard" className="w-full h-full object-cover" />
          </div>

          <div className={tile} style={{ gridColumn:'3/4', gridRow:'2/3', borderRadius: r }}>
            <img src="/demo/schedulio-tablet.webp" alt="" className="w-full h-full object-cover" />
          </div>
          <div className={tile} style={{ gridColumn:'1/2', gridRow:'3/4', borderRadius: r }}>
            <img src="/demo-tablet.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className={tile} style={{ gridColumn:'2/3', gridRow:'3/4', borderRadius: r }}>
            <img src="/app_screen.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div
            className={`${tile} flex flex-col items-start justify-end`}
            style={{
              gridColumn:'3/4', gridRow:'3/4', borderRadius: r,
              padding: '20px',
              background: 'linear-gradient(135deg,#1c1c1c,#0a0a0a)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <span className="text-xs text-white/30 tracking-widest uppercase mb-1">Demo</span>
            <p className="font-semibold text-white leading-tight tracking-[-0.03em] text-[1rem]">
              Bankkártya<br />nem kell.
            </p>
          </div>
        </div>
      )}

      {/* OVERLAY */}
      <div
        ref={overlayRef}
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ background: '#0a0a0a', opacity: maxOverlay }}
      />

      {/* WORDMARK */}
      <div
        ref={markRef}
        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
      >
        <h2
          className="font-semibold text-white tracking-[-0.04em] leading-none"
          style={{
            fontSize: mobile ? `clamp(2.4rem,11vw,${markFontMax})` : `clamp(4rem,9vw,${markFontMax})`,
            textShadow: '0 4px 40px rgba(0,0,0,0.7)',
          }}
        >
          {'Schedulio'.split('').map((ch, i, arr) => (
            <span key={i} className="inline-block overflow-hidden align-bottom" style={{ lineHeight: 1.15 }}>
              <span
                data-roll-char
                data-index={i}
                data-total={arr.length}
                className="inline-block will-change-transform"
                style={{ transform: 'translateY(110%)' }}
              >
                {ch}
              </span>
            </span>
          ))}
        </h2>
      </div>

      {/* CTA — középen, hero cella felett */}
      <div
        ref={ctaRef}
        className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
        style={{ opacity: 0 }}
      >
        <div className="pointer-events-auto">
          <RollButton href="/davelopment" label="Megnyitom a demót" variant="accent" size="md" icon />
        </div>
      </div>
    </section>
  )
}
