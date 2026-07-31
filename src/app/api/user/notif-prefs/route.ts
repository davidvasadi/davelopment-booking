/**
 * GET  /api/user/notif-prefs — személyes értesítési prefs + szerepkör-szintű engedélyezett kategóriák
 * PATCH /api/user/notif-prefs — saját prefs frissítése (bookings / system / staff / schedule)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
type CategoryKey = 'bookings' | 'system' | 'staff' | 'schedule' | 'digest'
const CATS: CategoryKey[] = ['bookings', 'system', 'staff', 'schedule', 'digest']
const CAP_KEY: Record<CategoryKey, string> = {
  bookings: 'notifications.bookings',
  system:   'notifications.system',
  staff:    'notifications.staff',
  schedule: 'notifications.schedule',
  digest:   'notifications.digest',
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const payload = await getPayloadClient()

  // Felhasználó aktuális preferenciái
  const fullUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  const prefs = (fullUser?.personal_notif_prefs as Record<string, boolean | null> | null | undefined) ?? {}
  const currentPrefs: Record<CategoryKey, boolean> = {
    bookings: prefs.bookings !== false,
    system:   prefs.system   !== false,
    staff:    prefs.staff    !== false,
    schedule: prefs.schedule !== false,
    digest:   prefs.digest   !== false,
  }

  // Engedélyezett kategóriák: tulaj = minden; member = a custom_role.notification_prefs uniója
  const isOwner = user.role === 'salon_owner' || user.role === 'restaurant_owner' || user.role === 'admin'

  // digest: csak tulajdonosnak releváns (összefoglaló az üzlet forgalmáról)
  let allowed: Record<CategoryKey, boolean> = { bookings: true, system: true, staff: true, schedule: true, digest: isOwner }

  if (!isOwner) {
    // Aktív tagságok custom_role.capabilities-ének uniója alapján
    const memberships = await payload.find({
      collection: 'memberships',
      where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
      limit: 50,
      depth: 1,
      overrideAccess: true,
    })

    const union: Record<CategoryKey, boolean> = { bookings: false, system: false, staff: false, schedule: false, digest: false }
    for (const m of memberships.docs) {
      const caps = (m.custom_role as { capabilities?: string[] } | null | undefined)?.capabilities ?? []
      if (caps.length === 0) {
        // Nincs egyedi szerep → alapból minden engedélyezett
        for (const cat of CATS) union[cat] = true
      } else {
        for (const cat of CATS) {
          if (caps.includes(CAP_KEY[cat])) union[cat] = true
        }
      }
    }
    allowed = union
  }

  return NextResponse.json({ prefs: currentPrefs, allowed })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Partial<Record<CategoryKey, boolean>>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 })
  }

  if (Object.keys(body).length === 0) return NextResponse.json({ ok: true })

  try {
    const payload = await getPayloadClient()
    const fullUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
    const existing = (fullUser?.personal_notif_prefs as Record<string, boolean | null> | null | undefined) ?? {}
    const merged: Record<CategoryKey, boolean> = {
      bookings: existing.bookings !== false,
      system:   existing.system   !== false,
      staff:    existing.staff    !== false,
      schedule: existing.schedule !== false,
      digest:   existing.digest   !== false,
    }
    for (const cat of CATS) {
      if (cat in body) merged[cat] = Boolean(body[cat])
    }
    await payload.update({ collection: 'users', id: user.id, data: { personal_notif_prefs: merged } as never, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/user/notif-prefs PATCH]', e)
    return NextResponse.json({ error: 'update-failed' }, { status: 500 })
  }
}
