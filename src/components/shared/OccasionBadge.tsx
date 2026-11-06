import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { IconCircle } from '@/components/ui-kit'

/** Alkalom (szülinap, évforduló, céges…) jelvénye a design szerint: fehér kör az alkalom ikonjával — idővonal, lista,
 *  terem, mobil. Csak ikon (a név a fontosabb); a teljes felirat a tooltipben. */
export function OccasionBadge({ occasion, icon }: { occasion: string; icon?: string | null }) {
  return <span title={occasion} aria-label={occasion} className="shrink-0"><IconCircle tone="white" size="xs" icon={eventIconByKey(icon)} /></span>
}
