import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import type { Booking, Salon } from '@/payload/payload-types'

/**
 * Beleegyező nyilatkozat helyszíni elfogadása (tablet check-in) — a személyzet a saját
 * bejelentkezésével nyitja meg a check-in oldalt, a vendég ott fogadja el a nyilatkozatot.
 * Ugyanaz az APP-auth + capability-minta, mint a `booking-status` route-nál.
 */
function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { bookingId?: string | number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const { bookingId } = body
  if (!bookingId) return NextResponse.json({ error: 'Hiányzó foglalás-azonosító' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') {
    return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })
  }

  const denied = await assertCapability(user.id, 'salon', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  // A foglalás az AKTÍV szalonhoz tartozzon (IDOR-védelem).
  const existing = (await payload
    .findByID({ collection: 'bookings', id: bookingId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const salonId = existing && (typeof existing.salon === 'object' ? existing.salon.id : existing.salon)
  if (!existing || String(salonId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  const salon = (await payload.findByID({ collection: 'salons', id: active.id, depth: 0, overrideAccess: true })) as Salon
  const templateText = salon.consent_settings?.template_text?.trim() || null
  if (!salon.consent_settings?.enabled || !templateText) {
    return NextResponse.json({ error: 'A nyilatkozat nincs bekapcsolva ennél az üzletnél' }, { status: 400 })
  }

  const updated = await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: {
      consent_accepted: true,
      consent_accepted_at: new Date().toISOString(),
      consent_accepted_via: 'onsite',
      consent_text_snapshot: templateText,
      consent_accepted_ip: getIp(req),
    },
    overrideAccess: true,
    user,
  })
  return NextResponse.json({ ok: true, booking: updated })
}
