'use client'

import dynamic from 'next/dynamic'
import type { CountryBucket } from '@/lib/guests'

// A Leaflet a window-t használja → SSR-ben törik. Next 16-ban az ssr:false csak
// Client Componentben engedélyezett, ezért ez a kliens wrapper tölti be dinamikusan.
const GuestMap = dynamic(() => import('./GuestMap'), {
  ssr: false,
  // A töltő-háttér a Leaflet csempe-terület színe (#EDEDE9), hogy ne villanjon a krém.
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#EDEDE9] text-[13px] text-ink-soft/70">
      <span className="animate-pulse">Térkép betöltése…</span>
    </div>
  ),
})

export default function GuestMapClient({ buckets, focusIso }: { buckets: CountryBucket[]; focusIso?: string | null }) {
  return <GuestMap buckets={buckets} focusIso={focusIso} />
}
