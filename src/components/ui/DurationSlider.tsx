'use client'

import { motion } from 'framer-motion'

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} perc`
  if (m === 0) return `${h} óra`
  return `${h} óra ${m} perc`
}

/**
 * Egyedi ülésidő-csúszka (pl. 30–120 perc, 15 perces lépésben) a fix gyorsválasztó-gombok
 * helyett — a kiválasztott érték egy úszó buborékban jelenik meg a fogantyú fölött,
 * springgel követi az ujjat/kurzort (popItem nyelv: stiffness 500, damping 30).
 */
export function DurationSlider({
  value,
  onChange,
  min = 30,
  max = 120,
  step = 15,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const pct = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100

  return (
    <div className="space-y-1">
      <div className="relative h-7 px-3">
        <motion.div
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink-dark px-2.5 py-1 text-[11px] font-bold tabular-nums text-white shadow-md"
          animate={{ left: `calc(${pct}% * 0.94 + 3%)` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {formatDuration(value)}
        </motion.div>
      </div>
      <div className="relative flex h-9 items-center px-3">
        <div className="pointer-events-none absolute inset-x-3 h-1.5 rounded-full bg-zinc-100" />
        <motion.div
          className="pointer-events-none absolute left-3 h-1.5 rounded-full bg-amber-400"
          animate={{ width: `calc(${pct}% * 0.94)` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative z-10 h-9 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-amber-400 [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,.25)]
            [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-amber-400 [&::-moz-range-thumb]:bg-white"
        />
      </div>
      <div className="flex justify-between px-3 text-[11px] text-zinc-400 tabular-nums">
        <span>{formatDuration(min)}</span>
        <span>{formatDuration(max)}</span>
      </div>
    </div>
  )
}
