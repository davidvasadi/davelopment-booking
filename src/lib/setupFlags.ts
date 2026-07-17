import { getPayloadClient } from './payload'

/**
 * Onboarding-állapot egy üzletre: be van-e állítva a nyitvatartás és a katalógus
 * (asztal/szolgáltatás). Enélkül a vendégek nem tudnak online foglalni. Olcsó count-lekérdezések
 * (limit 1, depth 0) — a főoldali „Fejezd be a beállítást" nudge-hoz. A tips-oldali checklist
 * ugyanezt a két jelet nézi (SetupFlags), így konzisztens.
 */
export type SetupFlags = { openingHours: boolean; catalog: boolean }

export async function getSetupFlags(kind: 'salon' | 'restaurant', id: string | number): Promise<SetupFlags> {
  const payload = await getPayloadClient()

  if (kind === 'restaurant') {
    const [hours, tables] = await Promise.all([
      payload.find({
        collection: 'opening-hours',
        where: { and: [{ restaurant: { equals: id } }, { is_open: { equals: true } }] },
        limit: 1, depth: 0, overrideAccess: true,
      }),
      payload.find({
        collection: 'tables',
        where: { and: [{ restaurant: { equals: id } }, { is_active: { equals: true } }] },
        limit: 1, depth: 0, overrideAccess: true,
      }),
    ])
    return { openingHours: hours.totalDocs > 0, catalog: tables.totalDocs > 0 }
  }

  const [avail, services] = await Promise.all([
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: id } }, { staff: { exists: false } }, { exception_date: { exists: false } }] },
      limit: 1, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: 'services',
      where: { salon: { equals: id } },
      limit: 1, depth: 0, overrideAccess: true,
    }),
  ])
  return { openingHours: avail.totalDocs > 0, catalog: services.totalDocs > 0 }
}
