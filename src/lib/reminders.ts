import type { Salon, Restaurant } from '@/payload/payload-types'

/** A `reminder_custom_hours` mező maximuma (14 nap) — a settingsFields-ben is ennyi. */
export const MAX_REMINDER_HOURS = 336

type FeatureModules = Salon['feature_modules'] | Restaurant['feature_modules']

/** Megy-e ki egyáltalán e-mailes emlékeztető ennél az üzletnél. */
export function reminderEnabled(biz: Pick<Salon, 'feature_modules'> | Pick<Restaurant, 'feature_modules'>): boolean {
  return !!(biz.feature_modules?.reminders_on && biz.feature_modules?.reminder_ch_email)
}

/** A bekapcsolt emlékeztető-időzítések órában, csökkenő sorrendben (pl. [48, 3]). Mindegyik
 *  kimegy, a saját idejében. */
export function reminderOffsets(fm: FeatureModules): number[] {
  const set = new Set<number>()
  if (fm?.reminder_t_48h) set.add(48)
  if (fm?.reminder_t_24h) set.add(24)
  if (fm?.reminder_t_3h) set.add(3)
  if (fm?.reminder_t_1h) set.add(1)
  const custom = Number(fm?.reminder_custom_hours)
  if (Number.isFinite(custom) && custom > 0) set.add(Math.min(custom, MAX_REMINDER_HOURS))
  return Array.from(set).sort((a, b) => b - a)
}
