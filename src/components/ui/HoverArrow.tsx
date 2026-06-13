'use client'

import { ArrowUpRight } from 'lucide-react'

/**
 * Görgős nyíl-hover (icon-roll) — a "text roll" effekt ikonos megfelelője.
 * Két nyíl egy overflow-hidden ablakban: a szülő `group` HOVERÉRE a látható
 * kicsúszik jobbra-fel, a másik becsúszik balról-le a helyére.
 *
 * Tiszta CSS (Tailwind group-hover) → nem függ a framer variant-öröklési
 * lánctól, ezért bármilyen szülőben megbízhatóan működik. A szülőn legyen
 * `group` (vagy `sm:group` ha csak nagyobb nézeten kell a hover).
 */
export function HoverArrow({ className = '' }: { className?: string }) {
  return (
    <span className={`relative overflow-hidden inline-flex items-center justify-center ${className}`}>
      {/* Látható nyíl — group-hoverre jobbra-fel kilép */}
      <ArrowUpRight className="h-full w-full transition-transform duration-300 ease-out group-hover:translate-x-[130%] group-hover:-translate-y-[130%]" />
      {/* Belépő nyíl — alapból balról-le rejtve, group-hoverre a helyére csúszik */}
      <ArrowUpRight className="absolute inset-0 h-full w-full -translate-x-[130%] translate-y-[130%] transition-transform duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0" />
    </span>
  )
}
