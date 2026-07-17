import { cn } from '@/lib/utils'

/** A névből monogramot képez (max 2 betű): „The Magic" → „TM", „Dave" → „D". */
function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Profilkép-avatar: ha van `src` (pl. Google-kép vagy beállított URL), azt mutatja;
 * egyébként a névből képzett monogramot semleges háttéren. A méret a `size`-szal állítható.
 */
export function UserAvatar({
  name,
  src,
  size = 36,
  className,
}: {
  name?: string | null
  src?: string | null
  size?: number
  className?: string
}) {
  const dim = { width: size, height: size }
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? 'Profil'}
        style={dim}
        className={cn('rounded-full object-cover object-top bg-zinc-100 dark:bg-white/[0.06]', className)}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span
      style={dim}
      className={cn(
        // Crextio: halvány, semleges monogram-csempe (nem tömör fekete kör) — a világos
        // felületbe simul, sötét betűvel. A finom keret adja a formát, nem a kontraszt.
        'flex items-center justify-center rounded-full bg-[#F1EEE6] text-ink border border-line font-semibold select-none dark:bg-white/[0.08] dark:text-white dark:border-white/10',
        className,
      )}
    >
      <span style={{ fontSize: size * 0.38 }}>{initials(name)}</span>
    </span>
  )
}
