import type { getPayloadClient } from '@/lib/payload'
import { getTemplate as getSalonTemplate, type BusinessType } from '@/lib/businessTemplates'
import { getTemplate as getRestaurantTemplate } from '@/lib/restaurantTemplates'

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>
// `user` opcionálisan átadva → audit-log actor-threading (lásd audit-cleanup-findings memória):
// enélkül a seedelt rekordok "Rendszer"-ként jelennének meg az auditban, holott ez a frissen
// regisztrált tulajdonos saját, regisztrációkor triggerelt akciója.
type AuditUser = Parameters<PayloadClient['create']>[0]['user']

/**
 * Szolgáltatás-katalógus (kategóriák + szolgáltatások) feltöltése egy friss szalonhoz a
 * választott üzlet-típusok alapján. Kiszervezve az `/api/seed-templates` route-ból, hogy a
 * regisztrációs flow (`/api/auth/register`) is SERVER-OLDALON, hitelesített HTTP-kérés (és
 * JWT) nélkül tudja meghívni — a friss user email-megerősítésig úgysem kapna tokent.
 */
export async function seedSalonTemplates(payload: PayloadClient, salonId: number | string, businessTypes: string[], user?: AuditUser) {
  const templates = businessTypes
    .map((t) => getSalonTemplate(t as BusinessType))
    .filter(Boolean) as NonNullable<ReturnType<typeof getSalonTemplate>>[]
  if (!templates.length) return

  const seenCats = new Set<string>()
  const allCategories: { name: string; duration_label?: string; sort_order: number }[] = []
  templates.forEach((t) => {
    t.categories.forEach((cat) => {
      if (!seenCats.has(cat.name)) {
        seenCats.add(cat.name)
        allCategories.push(cat)
      }
    })
  })

  const catIdByName = new Map<string, number | string>()
  for (const cat of allCategories) {
    const created = await payload.create({
      collection: 'service-categories',
      data: { name: cat.name, duration_label: cat.duration_label ?? null, sort_order: cat.sort_order, salon: salonId },
      overrideAccess: true,
      user,
    })
    catIdByName.set(cat.name, created.id)
  }

  const ensureCategory = async (name: string): Promise<number | string> => {
    const existing = catIdByName.get(name)
    if (existing != null) return existing
    const created = await payload.create({
      collection: 'service-categories',
      data: { name, sort_order: 999, salon: salonId },
      overrideAccess: true,
      user,
    })
    catIdByName.set(name, created.id)
    return created.id
  }

  for (const template of templates) {
    for (const svc of template.services) {
      await payload.create({
        collection: 'services',
        data: {
          name: svc.name,
          description: svc.description ?? null,
          category: await ensureCategory(svc.category),
          subcategory: svc.subcategory ? await ensureCategory(svc.subcategory) : null,
          duration_minutes: svc.duration_minutes,
          price: svc.price,
          currency: 'HUF',
          salon: salonId,
          is_active: true,
        },
        overrideAccess: true,
        user,
      })
    }
  }
}

/**
 * Asztaltérkép + nyitvatartás feltöltése egy friss étteremhez a választott sablon alapján.
 * Kiszervezve az `/api/restaurant/seed-template` route-ból (lásd fenti indoklás).
 */
export async function seedRestaurantTemplate(payload: PayloadClient, restaurantId: number | string, templateId: string, user?: AuditUser) {
  const template = getRestaurantTemplate(templateId)
  if (!template) return

  await payload.update({
    collection: 'restaurants',
    id: restaurantId,
    data: {
      turn_duration_minutes: template.turn_duration_minutes,
      slot_step_minutes: template.slot_step_minutes,
      lead_time_hours: template.lead_time_hours,
    },
    overrideAccess: true,
    user,
  })

  await payload.delete({ collection: 'tables', where: { restaurant: { equals: restaurantId } }, overrideAccess: true, user })
  await payload.delete({ collection: 'rooms', where: { restaurant: { equals: restaurantId } }, overrideAccess: true, user })
  await payload.delete({ collection: 'opening-hours', where: { restaurant: { equals: restaurantId } }, overrideAccess: true, user })

  for (const room of template.rooms) {
    const created = await payload.create({
      collection: 'rooms',
      data: { restaurant: restaurantId, name: room.name, sort_order: room.sort_order ?? 0 },
      overrideAccess: true,
      user,
    })
    for (const t of room.tables) {
      await payload.create({
        collection: 'tables',
        data: { restaurant: restaurantId, room: created.id, name: t.name, capacity: t.capacity, sort_order: t.sort_order ?? 0 },
        overrideAccess: true,
        user,
      })
    }
  }

  for (const h of template.opening_hours) {
    await payload.create({
      collection: 'opening-hours',
      data: { restaurant: restaurantId, ...h },
      overrideAccess: true,
      user,
    })
  }
}
