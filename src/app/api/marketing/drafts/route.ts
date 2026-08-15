import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'

/**
 * Hírlevél-piszkozat mentése/frissítése — a `marketing-campaigns` collectionba ír, `status:
 * 'draft'`-tal, a `blocks_json` mezőben a teljes blokk-tömbbel (hogy visszatöltéskor a
 * szerkesztő pontosan onnan folytatódjon). Owner-hitelesített, a `send`/`unsubscribe-bulk`
 * route-ok mintáját követve. Ha `draftId` meg van adva, azt a MEGLÉVŐ piszkozatot frissíti
 * (nem hoz létre duplikátumot minden mentésnél) — új rekord csak első mentéskor jön létre.
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: {
    kind?: 'salon' | 'restaurant'
    businessId?: string | number
    subject?: string
    blocks?: unknown
    customerIds?: string[]
    draftId?: string | number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const { kind, subject, blocks, customerIds, draftId } = body
  const rawBusinessId = body.businessId
  const businessId = typeof rawBusinessId === 'string' && /^\d+$/.test(rawBusinessId) ? Number(rawBusinessId) : rawBusinessId
  if (!kind || !businessId || !subject?.trim()) {
    return NextResponse.json({ error: 'Tárgy megadása kötelező' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const owns = kind === 'salon' ? await ownsThisSalon(payload, user, businessId) : await ownsThisRestaurant(payload, user, businessId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  const data = {
    ...(kind === 'salon' ? { salon: businessId } : { restaurant: businessId }),
    subject: subject.trim(),
    status: 'draft' as const,
    blocks_json: blocks ?? [],
    target_customer_ids: customerIds && customerIds.length > 0 ? customerIds : null,
  }

  try {
    if (draftId) {
      // Csak SAJÁT, MÉG piszkozat-állapotú rekordot enged frissíteni — más üzlet vagy már
      // kiküldött kampány rekordját nem lehet "piszkozatként" felülírni.
      const existing = await payload.findByID({ collection: 'marketing-campaigns', id: draftId, depth: 0, overrideAccess: true }).catch(() => null)
      const existingBusinessId = kind === 'salon' ? existing?.salon : existing?.restaurant
      const existingBusinessIdNum = typeof existingBusinessId === 'object' && existingBusinessId ? existingBusinessId.id : existingBusinessId
      if (!existing || existing.status !== 'draft' || existingBusinessIdNum !== businessId) {
        return NextResponse.json({ error: 'A piszkozat nem található' }, { status: 404 })
      }
      const updated = await payload.update({ collection: 'marketing-campaigns', id: draftId, data, overrideAccess: true })
      return NextResponse.json({ ok: true, id: updated.id })
    }
    const created = await payload.create({ collection: 'marketing-campaigns', data, overrideAccess: true })
    return NextResponse.json({ ok: true, id: created.id })
  } catch (e) {
    console.error('[api/marketing/drafts POST]', e)
    return NextResponse.json({ error: 'Piszkozat mentése sikertelen' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: { kind?: 'salon' | 'restaurant'; businessId?: string | number; draftId?: string | number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const { kind, draftId } = body
  const rawBusinessId = body.businessId
  const businessId = typeof rawBusinessId === 'string' && /^\d+$/.test(rawBusinessId) ? Number(rawBusinessId) : rawBusinessId
  if (!kind || !businessId || !draftId) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const owns = kind === 'salon' ? await ownsThisSalon(payload, user, businessId) : await ownsThisRestaurant(payload, user, businessId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const existing = await payload.findByID({ collection: 'marketing-campaigns', id: draftId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!existing || existing.status !== 'draft') {
      return NextResponse.json({ error: 'A piszkozat nem található' }, { status: 404 })
    }
    await payload.delete({ collection: 'marketing-campaigns', id: draftId, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/marketing/drafts DELETE]', e)
    return NextResponse.json({ error: 'Piszkozat törlése sikertelen' }, { status: 500 })
  }
}
