import { Check } from 'lucide-react'
import { IconCircle, Pill } from '@/components/ui-kit'

/* A lépés-sáv külön fájlban: a regisztráció (onboarding) és az import (importer) is ezt használja. Az import NEM húzhatja be
 * az onboarding-blokkokat — azok a foglalóoldal-blokkokat (public, booking, money) is behúznák, és a Beállítások
 * fordítása dev módban 5–14 mp-re nőtt tőle (2026-11-05). */

export const REGISTER_STEPS = ['Vállalkozás', 'Fiók', 'Import', 'Kész']

/** Regisztrációs lépés-sáv: az aktuális sötét, a kész lépés pipás. */
export function Steps({ active, labels = REGISTER_STEPS, dark = false, className = 'mb-6' }: { active: number; labels?: string[]; dark?: boolean; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {labels.map((t, i) => (
        <Pill key={t} tone={i === active ? (dark ? 'white' : 'dark') : 'ghost'} size="sm" className={dark && i !== active ? 'text-white/60' : ''}>
          <IconCircle size="xs" tone={i === active ? (dark ? 'dark' : 'onDark') : i < active ? 'yellow' : dark ? 'onDark' : 'cell'}>{i < active ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}</IconCircle>{t}
        </Pill>
      ))}
    </div>
  )
}
