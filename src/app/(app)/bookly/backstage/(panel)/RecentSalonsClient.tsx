'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import SalonDetailSheet from '@/components/backstage/SalonDetailSheet'

type SalonRow = {
  id: string
  name: string
  city?: string | null
  is_active?: boolean | null
  createdAt: string
  ownerEmail?: string
}

export default function RecentSalonsClient({ salons }: { salons: SalonRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openDetail(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <>
      <SalonDetailSheet salonId={selectedId} open={sheetOpen} onOpenChange={setSheetOpen} />
      <div>
        {salons.map((s, i) => {
          const date = new Date(s.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
          return (
            <div
              key={s.id}
              onClick={() => openDetail(s.id)}
              className={`flex items-center justify-between px-6 py-3.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors ${i < salons.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                </div>
                <div>
                  <p className="text-zinc-900 dark:text-white text-sm font-medium">{s.name}</p>
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
