'use client'

import { SilkGradient } from '@/components/landing/SilkGradient'

/** A CTA „festett” háttere: meleg narancs–sárga selymes foltok (WebGL SilkGradient, CSS-tartalékkal), alul világosszürkébe
 *  fut. A szülő `relative isolate overflow-hidden` legyen. Egy helyen — a CtaGlow és a belépés 3. alternatívája
 *  (/design 3.8) is ez. */
export function PaintedBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* alapszínek: foltok */}
      <div
        className="absolute inset-[-10%] blur-[40px]"
        style={{
          background: [
            'radial-gradient(40% 55% at 52% 8%, #F2A04B 0%, transparent 70%)',
            'radial-gradient(35% 50% at 82% 20%, #F6B566 0%, transparent 70%)',
            'radial-gradient(30% 45% at 95% 55%, #FBE27A 0%, transparent 70%)',
            'radial-gradient(35% 45% at 25% 35%, #F7C79A 0%, transparent 70%)',
            'radial-gradient(30% 40% at 60% 62%, #F8D3C6 0%, transparent 70%)',
            'radial-gradient(22% 60% at 12% 18%, #FFFFFF 0%, transparent 70%)',
            'linear-gradient(180deg, #F7D3A6 0%, #F8E6CF 55%, #F2F2F2 100%)',
          ].join(','),
        }}
      />
      {/* a valódi, selymes háttér (WebGL); a fenti foltok csak tartalék */}
      <SilkGradient className="absolute inset-0 h-full w-full" />
      {/* alul világosszürkébe fut */}
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-b from-transparent via-[#F2F2F2]/70 to-[#F2F2F2]" />
    </div>
  )
}
