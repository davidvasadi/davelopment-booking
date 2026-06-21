import { cn } from '@/lib/utils'

/**
 * A landing design-rendszerének apró, tartalom-mentes építőkövei.
 * Szándékosan szerver-komponensek (nincs interaktivitás) → nem visznek JS-t a kliensre.
 * Máshol (dashboard/backstage szekció-fejlécek) is újrahasználhatók.
 */

/**
 * Zárójeles, ritkított nagybetűs szekció-címke — pl. „(Árazás)", „(FAQ)".
 * `tone`: a sötét szekciókban `light`, világoson `dark`.
 */
export function SectionLabel({
  children,
  tone = 'dark',
  className,
}: {
  children: React.ReactNode
  tone?: 'dark' | 'light'
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-xs font-semibold uppercase tracking-wider',
        tone === 'light' ? 'text-white/40' : 'text-zinc-400',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Pirulányi háttér-jelvény (badge) — pl. a hero „Próbáld ki 30 napig ingyen.".
 * `tone`: `surface` világos pillt ad sötét háttéren, `ink` sötétet világoson, `accent` sárgát.
 */
export function Pill({
  children,
  tone = 'surface',
  className,
}: {
  children: React.ReactNode
  tone?: 'surface' | 'ink' | 'accent'
  className?: string
}) {
  const TONE = {
    surface: 'bg-white text-brand-ink',
    ink: 'bg-brand-ink text-white',
    accent: 'bg-brand-accent text-brand-ink',
  } as const
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-full px-5 text-xs font-medium',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
