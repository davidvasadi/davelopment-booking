import type { Payload } from 'payload'

const STALE_AFTER_DAYS = 7

/**
 * A "korábbi" (lejárt) teendők ne halmozódjanak a végtelenségig: a referencia-dátumuk
 * (due_date, ennek hiányában createdAt — ugyanaz a logika, mint az OverviewTasksPanel
 * bucketOf-ja) után 7 nappal automatikusan törlődnek. Best-effort, nem dobja tovább a hibát —
 * ez egy háttér-karbantartás, nem szabad emiatt elszállnia az oldalbetöltésnek.
 */
export async function deleteStaleTasks(payload: Payload, type: 'restaurant' | 'salon', id: string | number): Promise<void> {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS)
  const cutoffIso = cutoff.toISOString()

  await Promise.all([
    payload.delete({
      collection: 'tasks',
      where: { and: [{ [type]: { equals: id } }, { due_date: { less_than: cutoffIso } }] },
      overrideAccess: true,
    }).catch(() => {}),
    payload.delete({
      collection: 'tasks',
      where: { and: [{ [type]: { equals: id } }, { due_date: { exists: false } }, { createdAt: { less_than: cutoffIso } }] },
      overrideAccess: true,
    }).catch(() => {}),
  ])
}
