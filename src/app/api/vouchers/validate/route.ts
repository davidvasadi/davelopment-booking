import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

/**
 * Publikus, csak-olvasás kód-ellenőrzés a foglaló-varázsló beváltás-mezőjéhez (élő validáció
 * gépelés közben) — csak `{valid, amount_huf}`-ot ad vissza, SOSE vásárló-PII-t (név/email).
 * A tényleges beváltás (a voucher `redeemed`-re állítása) a `/api/bookings`/
 * `/api/restaurant/reservations` route-okban történik, a foglalás sikeres létrehozása UTÁN.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')?.trim().toUpperCase()
  const salonId = searchParams.get('salonId')
  const restaurantId = searchParams.get('restaurantId')

  if (!code || (!salonId && !restaurantId)) {
    return NextResponse.json({ valid: false, reason: 'Hiányzó paraméterek' }, { status: 400 })
  }

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'gift-vouchers',
      where: {
        and: [
          { code: { equals: code } },
          salonId ? { salon: { equals: salonId } } : { restaurant: { equals: restaurantId! } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const voucher = result.docs[0]
    if (!voucher) return NextResponse.json({ valid: false, reason: 'Nem található ilyen kód ennél az üzletnél.' })
    if (voucher.status !== 'active') return NextResponse.json({ valid: false, reason: 'Ez az utalvány már fel lett használva vagy lejárt.' })
    if (new Date(voucher.expires_at) < new Date()) return NextResponse.json({ valid: false, reason: 'Ez az utalvány lejárt.' })

    return NextResponse.json({ valid: true, amount_huf: voucher.amount_huf })
  } catch (err) {
    console.error('[vouchers/validate]', err)
    return NextResponse.json({ valid: false, reason: 'Szerver hiba' }, { status: 500 })
  }
}
