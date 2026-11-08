import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { IconCircle, MarqueeText, Pill } from '@/components/ui-kit'

/** Alkalom (szülinap, évforduló, céges…) jelvénye a design szerint: fehér kör az alkalom ikonjával — idővonal, lista,
 *  terem, mobil. Csak ikon (a név a fontosabb); a teljes felirat a tooltipben. */
export function OccasionBadge({ occasion, icon, label = false }: { occasion: string; icon?: string | null; /** a neve is kiírva (desktop lista Alkalom oszlopa) */ label?: boolean }) {
  if (label) return <Pill tone="white" size="sm" icon={eventIconByKey(icon)} className="max-w-full"><MarqueeText>{occasion}</MarqueeText></Pill>
  return <span title={occasion} aria-label={occasion} className="shrink-0"><IconCircle tone="white" size="xs" icon={eventIconByKey(icon)} /></span>
}
