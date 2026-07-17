'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { listStagger } from '@/lib/motion'
import { StatusBadge, formatHuf } from '@/components/backstage/BackstageUi'
import type { SubStatus } from '@/lib/backstageMetrics'

export type RecentAccount = {
  ownerId: string
  email: string
  name: string
  status: SubStatus | null
  mrr: number
  placeCount: number
  salonCount: number
  restaurantCount: number
  createdAt: string
}

/** A fiók üzlet-összetétele rövid szöveggé (pl. „2 szalon · 1 étterem"). */
function composition(a: RecentAccount): string {
  const parts: string[] = []
  if (a.salonCount) parts.push(`${a.salonCount} szalon`)
  if (a.restaurantCount) parts.push(`${a.restaurantCount} étterem`)
  return parts.length ? parts.join(' · ') : 'nincs üzlet'
}

export default function RecentAccountsClient({ accounts }: { accounts: RecentAccount[] }) {
  return (
    <motion.div variants={listStagger.container} initial="hidden" animate="show" className="flex flex-1 flex-col gap-[2px] overflow-y-auto px-2.5 pb-2.5">
      {accounts.map((a) => {
        const date = new Date(a.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
        const initial = (a.name || a.email || '?').trim()[0]?.toUpperCase() ?? '?'
        return (
          <motion.div key={a.ownerId} variants={listStagger.item}>
            <Link
              href={`/backstage/accounts/${a.ownerId}`}
              className="flex items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 transition-colors hover:bg-white"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[13px] font-bold text-white">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{a.email}</p>
                  <p className="truncate text-[11.5px] text-ink-soft">
                    <Users className="mr-1 inline h-3 w-3 align-[-1px]" />{composition(a)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {a.mrr > 0 && <span className="hidden text-[12.5px] font-semibold text-ink sm:inline">{formatHuf(a.mrr)}</span>}
                <StatusBadge status={a.status} />
                <span className="hidden text-[11.5px] text-ink-soft md:inline">{date}</span>
              </div>
            </Link>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
