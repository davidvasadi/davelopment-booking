import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { seedSalonTemplates } from '@/lib/seedTemplates'

export async function POST(req: NextRequest) {
  try {
    // FONTOS: getCurrentUser + 401 JSON (NEM requireAuth) — az `requireAuth` egy
    // redirect('/login')-t dob, ami API-route-ban NEXT_REDIRECT kivétel → a lenti
    // catch 500-at adna vissza. A jogosultságot amúgy is a salon-ownership check
    // adja lentebb (a role-check felesleges volt, és frissen regisztrált usernél
    // — amikor a role PATCH még nem futott le — hibásan buktatta a seedet).
    const user = await getCurrentUser({ allowHeaderAuth: true })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { salonId, businessTypes } = await req.json()

    if (!salonId || !Array.isArray(businessTypes) || businessTypes.length === 0) {
      return NextResponse.json({ error: 'Missing salonId or businessTypes' }, { status: 400 })
    }

    const payload = await getPayloadClient()

    // A jogosultságot MAGA a where-feltétel adja (owner: user.id) — az ownership itt dől el.
    // overrideAccess: true kell, különben a frissen regisztrált user hiányos access-contextje
    // miatt a collection access-rétege 0 találatot adhat vissza (a salon létezik!), és a seed
    // némán 403-mal elbukna.
    const ownerId = typeof user.id === 'string' && /^\d+$/.test(user.id) ? Number(user.id) : user.id
    const salonResult = await payload.find({
      collection: 'salons',
      where: { and: [{ id: { equals: salonId } }, { owner: { equals: ownerId } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (!salonResult.docs.length) {
      return NextResponse.json({ error: 'Salon not found' }, { status: 403 })
    }

    await seedSalonTemplates(payload, salonId, businessTypes, user)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('seed-templates error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
