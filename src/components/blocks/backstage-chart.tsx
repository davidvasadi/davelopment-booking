'use client'

import { LiveDarkLine } from './stats'

/** Kimenő e-mailek naponta — a Statisztikák sötét vonal-grafikonja (sárga: az elmúlt 30 nap, halvány: az előző 30).
 *  Külön kliens-fájl, mert a formázó függvény nem mehet át szerverről. */
export function MailDarkLine({ now, prev, ticks, points, className = '' }: { now: number[]; prev?: number[]; ticks: string[]; points: string[]; className?: string }) {
  return <LiveDarkLine title="Naponta" now={now} prev={prev} ticks={ticks} points={points} fmt={(v) => `${Math.round(v).toLocaleString('hu-HU')} levél`} className={className} />
}
