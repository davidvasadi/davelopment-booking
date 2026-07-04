'use client'

import { useState } from 'react'
import { Building2, UtensilsCrossed } from 'lucide-react'
import PlaceDetailSheet from '@/components/backstage/PlaceDetailSheet'
import type { PlaceKind } from '@/lib/backstagePlaces'

type PlaceRow = {
  kind: PlaceKind
  id: string
  name: string
  city?: string | null
  is_active?: boolean | null
  createdAt: string
  ownerEmail?: string
}

export default function RecentSalonsClient({ salons }: { salons: PlaceRow[] }) {
  const [selected, setSelected] = useState<{ id: string; kind: PlaceKind } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openDetail(p: PlaceRow) {
    setSelected({ id: p.id, kind: p.kind })
    setSheetOpen(true)
  }

  return (
    <>
      <PlaceDetailSheet place={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
      <div className="flex flex-col gap-[3px] p-2.5">
        {salons.map((s) => {
          const Icon = s.kind === 'restaurant' ? UtensilsCrossed : Building2
          const typeLabel = s.kind === 'restaurant' ? 'Étterem' : 'Szalon'
          const date = new Date(s.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
          return (
            <div
              key={`${s.kind}-${s.id}`}
              onClick={() => openDetail(s)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-[20px] p-[13px] transition-colors hover:bg-[#FCFAF1]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#F0EAD8]">
                  <Icon className="h-4 w-4 text-ink" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-ink">{s.name}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{typeLabel}</span>
                  </p>
                  <p className="truncate text-[11.5px] text-ink-soft">{s.ownerEmail ?? '—'} · {s.city ?? '—'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.is_active ? 'bg-[#E7F2EA] text-[#1D9D63]' : 'bg-[#F0EAD8] text-ink-soft'}`}>
                  {s.is_active ? 'Aktív' : 'Inaktív'}
                </span>
                <span className="hidden text-[11.5px] text-ink-soft sm:inline">{date}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
