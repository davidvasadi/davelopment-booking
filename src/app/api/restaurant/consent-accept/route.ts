import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import type { Reservation, Restaurant } from '@/payload/payload-types'
import { sendReservationConsentCopy } from '@/lib/restaurantEmail'

/**
 * Beleegyező nyilatkozat helyszíni elfogadása (tablet check-in) — a személyzet a saját
 * bejelentkezésével nyitja meg a check-in oldalt, a vendég ott fogadja el a nyilatkozatot.
 * Ugyanaz az APP-auth + capability-minta, mint a `reservation-status` route-nál.
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

  let body: { reservationId?: string | number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const { reservationId } = body
  if (!reservationId) return NextResponse.json({ error: 'Hiányzó foglalás-azonosító' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 404 })
  }

  const denied = await assertCapability(user.id, 'restaurant', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  // A foglalás az AKTÍV étteremhez tartozzon (IDOR-védelem).
  const existing = (await payload
    .findByID({ collection: 'reservations', id: reservationId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Reservation | null
  const restId = existing && (typeof existing.restaurant === 'object' ? existing.restaurant.id : existing.restaurant)
  if (!existing || String(restId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  const restaurant = (await payload.findByID({ collection: 'restaurants', id: active.id, depth: 0, overrideAccess: true })) as Restaurant
  const templateText = restaurant.consent_settings?.template_text?.trim() || null
  if (!restaurant.consent_settings?.enabled || !templateText) {
    return NextResponse.json({ error: 'A nyilatkozat nincs bekapcsolva ennél az üzletnél' }, { status: 400 })
  }

  const updated = await payload.update({
    collection: 'reservations',
    id: reservationId,
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
  // a vendég megkapja a saját példányát (best-effort, nem blokkolja a választ)
  void sendReservationConsentCopy(updated as Reservation, restaurant)
  return NextResponse.json({ ok: true, reservation: updated })
}
