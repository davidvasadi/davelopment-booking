'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Lágy, végtelen lebegés — minden mockuphoz / lebegő kártyához. */
export const float = (range = 10, duration = 5, delay = 0) => ({
  animate: { y: [0, -range, 0] },
  transition: { duration, ease: 'easeInOut' as const, repeat: Infinity, delay },
})

/** Videós telefon-mockup (a foglalási folyamat videója). */
export function PhoneVideoMockup({ className, src = '/videos/booking-flow.mp4' }: { className?: string; src?: string }) {
  return (
    <div className={cn('relative w-[248px] mx-auto select-none', className)}>
      <div className="relative w-[248px] h-[504px] rounded-[3rem] bg-brand-ink p-[8px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)]">
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        <div className="w-full h-full rounded-[2.5rem] bg-zinc-900 overflow-hidden">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source src={src} type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  )
}

/** Sötét keretes telefon az analytics-mockuppal (a hero jobb oldalához). */
export function PhoneDashboardMockup({ className }: { className?: string }) {
  const kpis: [string, string][] = [
    ['98', 'Performance Score'],
    ['42%', 'Organic Traffic'],
    ['32%', 'Conversion Rate'],
    ['-18%', 'Bounce Rate'],
  ]
  return (
    <div className={cn('relative w-[280px] select-none', className)}>
      <div className="relative w-[280px] h-[560px] rounded-[3rem] bg-brand-ink p-[9px] shadow-[0_50px_90px_-25px_rgba(0,0,0,0.55)]">
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" />
        <div className="w-full h-full rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
          {/* fejléc */}
          <div className="flex items-center justify-between px-5 pt-6 pb-3">
            <span className="text-zinc-300 text-lg leading-none">‹</span>
            <span className="text-[13px] font-semibold text-brand-ink">Launch &amp; Optimization</span>
            <span className="text-zinc-300 text-lg leading-none">···</span>
          </div>
          {/* brand-kép */}
          <div className="px-4">
            <div className="relative rounded-2xl bg-zinc-900 h-44 flex items-center justify-center overflow-hidden">
              <div className="pointer-events-none absolute -inset-8 bg-[radial-gradient(circle_at_30%_20%,rgba(236,249,90,0.18),transparent_60%)]" />
              <p className="relative text-2xl font-black tracking-tighter text-white">[davelopment]®</p>
              <p className="absolute bottom-3 text-[10px] text-white/40">davelopment.hu</p>
            </div>
          </div>
          {/* Performance Overview */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-bold text-brand-ink">Performance Overview</p>
              <span className="text-[10px] text-zinc-400 rounded-md border border-zinc-200 px-2 py-0.5">This Month ▾</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {kpis.map(([v, l]) => (
                <div key={l} className="rounded-lg bg-brand-surface px-1.5 py-2.5 text-center">
                  <p className="text-[14px] font-black text-brand-ink leading-none">{v}</p>
                  <p className="mt-1.5 text-[7px] leading-tight text-zinc-400">{l}</p>
                </div>
              ))}
            </div>
            {/* mini bar-chart a kitöltéshez */}
            <div className="mt-4 rounded-2xl bg-brand-surface p-3">
              <div className="flex items-end justify-between gap-1 h-16">
                {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-brand-ink/15"
                    style={{ height: `${h}%`, backgroundColor: i === 5 ? '#191314' : undefined }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
