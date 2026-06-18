import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { getTemplate, type BusinessType } from '@/lib/businessTemplates'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth('salon_owner')
    const { salonId, businessTypes } = await req.json()

    if (!salonId || !Array.isArray(businessTypes) || businessTypes.length === 0) {
      return NextResponse.json({ error: 'Missing salonId or businessTypes' }, { status: 400 })
    }

    const templates = businessTypes
      .map((t: string) => getTemplate(t as BusinessType))
      .filter(Boolean) as ReturnType<typeof getTemplate>[]

    if (!templates.length) {
      return NextResponse.json({ error: 'No valid templates found' }, { status: 400 })
    }

    const payload = await getPayloadClient()

    const salonResult = await payload.find({
      collection: 'salons',
      where: { and: [{ id: { equals: salonId } }, { owner: { equals: user.id } }] },
      limit: 1,
    })
    if (!salonResult.docs.length) {
      return NextResponse.json({ error: 'Salon not found' }, { status: 403 })
    }

    // Merge categories from all selected templates (deduplicate by name)
    const seenCats = new Set<string>()
    const allCategories: { name: string; duration_label?: string; sort_order: number }[] = []
    templates.forEach(t => {
      t!.categories.forEach(cat => {
        if (!seenCats.has(cat.name)) {
          seenCats.add(cat.name)
          allCategories.push(cat)
        }
      })
    })

    // A kategória mostantól relationship → előbb létrehozzuk a kategória-rekordokat, és név→ID
    // térképet építünk. A service-ek category/subcategory mezője ezután az ID-t kapja.
    const catIdByName = new Map<string, number | string>()
    for (const cat of allCategories) {
      const created = await payload.create({
        collection: 'service-categories',
        data: {
          name: cat.name,
          duration_label: cat.duration_label ?? null,
          sort_order: cat.sort_order,
          salon: salonId,
        },
      })
      catIdByName.set(cat.name, created.id)
    }

    // Egy név → kategória-ID; ha a sablon olyan (al)kategória-nevet hivatkozik, ami még nincs
    // rekordként (pl. alkategória), igény szerint létrehozzuk.
    const ensureCategory = async (name: string): Promise<number | string> => {
      const existing = catIdByName.get(name)
      if (existing != null) return existing
      const created = await payload.create({
        collection: 'service-categories',
        data: { name, sort_order: 999, salon: salonId },
      })
      catIdByName.set(name, created.id)
      return created.id
    }

    // Create services from all templates
    for (const template of templates) {
      for (const svc of template!.services) {
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
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('seed-templates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
