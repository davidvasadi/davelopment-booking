import { eventIconByKey, eventColorByKey } from '@/components/settings/eventTypeIcons'

/**
 * Alkalom (szülinap, évforduló…) jelvénye: kis tömör kör az alkalom színével, fehér ikonnal.
 * Szándékosan csak ikon — a név a fontosabb; a teljes felirat a tooltipben látszik. A keret
 * (alapból fehér) választja el bármilyen kártya-háttértől (zöld/sárga/sötét).
 */
export function OccasionBadge({
  occasion,
  icon,
  size = 16,
  ring = 'rgba(255,255,255,.9)',
}: {
  occasion: string
  icon?: string | null
  size?: number
  ring?: string
}) {
  const Icon = eventIconByKey(icon)
  return (
    <span
      title={occasion}
      aria-label={occasion}
      className="flex shrink-0 items-center justify-center rounded-full text-white"
      style={{ width: size, height: size, background: eventColorByKey(icon), boxShadow: `0 0 0 1.5px ${ring}` }}
    >
      <Icon style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={2.4} />
    </span>
  )
}
