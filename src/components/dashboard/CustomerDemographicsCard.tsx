'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { DemographicSlice } from '@/lib/customerDemographics'

/* Ugyanaz a davelopment/Crextio chart-paletta, mint az AnalyticsOverview-ban. */
const SLICE_COLORS = ['#F1CE45', '#1D1C19', '#C0564A', '#8A8378', '#4A4944']

function DonutTip({ active, payload }: { active?: boolean; payload?: { name?: string; value?: number }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-[10px] bg-ink-dark px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
      {p.name}: {p.value}
    </div>
  )
}

/** Kis kör-diagram + legenda — bármilyen `label/value` bontáshoz (nem/csoport stb.). */
function MiniDonutCard({ title, data, emptyHint }: { title: string; data: DemographicSlice[]; emptyHint: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="rounded-[26px] dav-card-glass p-5 lg:p-6 flex flex-col h-full">
      <div className="text-[19px] font-medium text-ink mb-3">{title}</div>
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-[13px] text-ink-soft">{emptyHint}</div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          <div className="relative h-[140px] w-[140px] shrink-0">
            <ResponsiveContainer width="100%" height="100%" debounce={50} initialDimension={{ width: 140, height: 140 }}>
              <PieChart>
                <Pie
                  data={data} dataKey="value" nameKey="label"
                  cx="50%" cy="50%" innerRadius={42} outerRadius={62}
                  startAngle={90} endAngle={-270} cornerRadius={6} stroke="none"
                  isAnimationActive animationDuration={700}
                >
                  {data.map((_, i) => <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[22px] font-light tracking-[-0.02em] leading-none text-ink">{total}</div>
              <div className="text-[10px] font-medium text-ink-soft">vendég</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.map((d, i) => (
              <span key={d.label} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                {d.label} <span className="text-ink-soft2">· {d.value} ({Math.round((d.value / total) * 100)}%)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Vendég-demográfia (nem + csoport/címke) — a `Customers` tábla ÜZLET-SZINTŰ pillanatfelvétele,
 * NEM dátum-tartományhoz kötött (ellentétben a bevétel/foglalás KPI-kkal), ezért külön, saját
 * szekció, nem a `metrics`/`chartCards` idősor-alapú rendszerébe erőltetve.
 */
export function CustomerDemographicsCard({ gender, groups }: { gender: DemographicSlice[]; groups: DemographicSlice[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MiniDonutCard
        title="Nemek szerinti megoszlás"
        data={gender}
        emptyHint="Még nincs vendégnél megadva a neme — az Egyedi kérdéseknél kérhető be, vagy importból tölthető."
      />
      <MiniDonutCard
        title="Csoport / címke szerinti bontás"
        data={groups}
        emptyHint="Még nincs vendég csoportba/címkézve — a Vendégek oldalon vagy importból adható meg."
      />
    </div>
  )
}
