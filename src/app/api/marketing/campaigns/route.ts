import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'

/**
 * Kampány törlése — piszkozat VAGY már kiküldött is (a `/api/marketing/drafts` DELETE-je csak
 * piszkozatot enged, ez itt bármelyik állapotot). Owner-hitelesített, ugyanazt a mintát követi.
 * Az `email-log` sorokat NEM töröljük/nem null-ozzuk — azok önálló audit-napló, a `campaign`
 * reláció árván maradhat (ugyanaz a konvenció, mint más audit-naplóknál ebben a projektben).
 */
export async function DELETE(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: { kind?: 'salon' | 'restaurant'; businessId?: string | number; campaignId?: string | number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const { kind, campaignId } = body
  const rawBusinessId = body.businessId
  const businessId = typeof rawBusinessId === 'string' && /^\d+$/.test(rawBusinessId) ? Number(rawBusinessId) : rawBusinessId
  if (!kind || !businessId || !campaignId) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const denied = await assertCapability(user.id, kind, businessId, 'marketing.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  try {
    const existing = await payload.findByID({ collection: 'marketing-campaigns', id: campaignId, depth: 0, overrideAccess: true }).catch(() => null)
    const existingBusinessId = kind === 'salon' ? existing?.salon : existing?.restaurant
    const existingBusinessIdNum = typeof existingBusinessId === 'object' && existingBusinessId ? existingBusinessId.id : existingBusinessId
    if (!existing || existingBusinessIdNum !== businessId) {
      return NextResponse.json({ error: 'A kampány nem található' }, { status: 404 })
    }
    await payload.delete({ collection: 'marketing-campaigns', id: campaignId, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/marketing/campaigns DELETE]', e)
    return NextResponse.json({ error: 'Kampány törlése sikertelen' }, { status: 500 })
  }
}
