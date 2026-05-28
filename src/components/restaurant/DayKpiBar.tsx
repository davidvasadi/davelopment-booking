'use client'

import { StatCard } from '@/components/dashboard/StatCard'
import { useRestaurantUI } from './RestaurantUIContext'

/**
 * A Foglalások oldal napi gyorskártyái. Az értékeket a server komponens számolja
 * és propként adja át; ez a kliens-wrapper csak azért kell, hogy fókusz módban
 * (timeline nézet) elrejtse a sávot — így a timeline teljes szélességet kap.
 */
export function DayKpiBar({
  activeCount,
  completedCount,
  cancelledCount,
  walkInCount,
}: {
  activeCount: number
  completedCount: number
  cancelledCount: number
  walkInCount: number
}) {
  const { focusMode } = useRestaurantUI()
  if (focusMode) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <StatCard sub="Aznap" label="Aktív foglalás" value={String(activeCount)} />
      <StatCard sub="Aznap" label="Befejezett" value={String(completedCount)} />
      <StatCard sub="Aznap" label="Lemondva / nem jött" value={String(cancelledCount)} />
      <StatCard sub="Aznap" label="Beeső (walk-in)" value={String(walkInCount)} />
    </div>
  )
}
