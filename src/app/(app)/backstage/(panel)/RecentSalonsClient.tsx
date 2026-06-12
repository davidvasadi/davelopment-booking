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
      <div>
        {salons.map((s, i) => {
          const Icon = s.kind === 'restaurant' ? UtensilsCrossed : Building2
          const typeLabel = s.kind === 'restaurant' ? 'Étterem' : 'Szalon'
          const date = new Date(s.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
          return (
            <div
              key={`${s.kind}-${s.id}`}
              onClick={() => openDetail(s)}
              className={`flex items-center justify-between px-6 py-3.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors ${i < salons.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                </div>
                <div>
                  <p className="flex items-center gap-1.5">
                    <span className="text-zinc-900 dark:text-white text-sm font-medium">{s.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{typeLabel}</span>
                  </p>
                  <p className="text-zinc-500 text-xs">{s.ownerEmail ?? '—'} · {s.city ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-500/10 text-zinc-500'}`}>
                  {s.is_active ? 'Aktív' : 'Inaktív'}
                </span>
                <span className="text-zinc-400 dark:text-zinc-600 text-xs">{date}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
