/**
 * GET  /api/user/notif-prefs — személyes értesítési prefs + szerepkör-szintű engedélyezett kategóriák
 * PATCH /api/user/notif-prefs — saját prefs frissítése (bookings / schedule / digest / email_not_opened / bookings_email / schedule_email)
 *
 * A `system`/`staff` kategóriák (korábban itt éltek) töröltek — semmilyen tényleges
 * értesítést nem gate-eltek soha (halott UI volt), a mezők a DB-sémában maradtak
 * (migráció nélkül), csak innen, a felületről tűntek el.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

/** Push/app-kategóriák — alapból BEKAPCSOLVA (`!== false`), az app a fő csatorna. */
type PushCategoryKey = 'bookings' | 'schedule' | 'digest' | 'email_not_opened'
const PUSH_CATS: PushCategoryKey[] = ['bookings', 'schedule', 'digest', 'email_not_opened']

/** Belső EMAIL-kategóriák — alapból KIKAPCSOLVA (`=== true`), csak opt-in a push mellé. */
type EmailCategoryKey = 'bookings_email' | 'schedule_email' | 'pending_popup' | 'payment_bar'
/** (a `pending_popup` / `payment_bar` is opt-in: a „Mi kér figyelmet” — design 6.8.1 — sáv helyett popup, ill. fizetés-sáv) */
const EMAIL_CATS: EmailCategoryKey[] = ['bookings_email', 'schedule_email', 'pending_popup', 'payment_bar']

type CategoryKey = PushCategoryKey | EmailCategoryKey
const CATS: CategoryKey[] = [...PUSH_CATS, ...EMAIL_CATS]

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const payload = await getPayloadClient()

  // Felhasználó aktuális preferenciái
  const fullUser = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
  const prefs = (fullUser?.personal_notif_prefs as Record<string, boolean | null> | null | undefined) ?? {}
  const currentPrefs: Record<CategoryKey, boolean> = {
    bookings: prefs.bookings !== false,
    schedule: prefs.schedule !== false,
    digest:   prefs.digest   !== false,
    email_not_opened: prefs.email_not_opened !== false,
    bookings_email: prefs.bookings_email === true,
    schedule_email: prefs.schedule_email === true,
    pending_popup: prefs.pending_popup === true,
    payment_bar: prefs.payment_bar === true,
  }

  // Engedélyezett kategóriák: tulaj = minden. Tagnál a `bookings` a szerepe
  // `booking_notify_level`-jéből jön (lásd `roles.booking_notify_level`, RolesManager
  // „Foglalás-értesítés" választója) — 'off' = a tag nem is látja/kapcsolhatja ezt a sort,
  // 'own'/'all' = igen. A `schedule` (beosztás-értesítés) sosem volt szerephez kötve — az mindig
  // mindenkinek elérhető, csak a lenti `prefs`-ben SAJÁT maga kapcsolja.
  const isOwner = user.role === 'salon_owner' || user.role === 'restaurant_owner' || user.role === 'admin'

  // email_not_opened: csak tulajdonosnak releváns (a vendégek e-mailjeiről szól). A digestet a
  // tagok is megkapják (szalon: saját „összefoglalód”, étterem: push), ezért nekik is kapcsolható.
  let allowedPush: Record<PushCategoryKey, boolean> = { bookings: true, schedule: true, digest: isOwner, email_not_opened: isOwner }

  if (!isOwner) {
    const memberships = await payload.find({
      collection: 'memberships',
      where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
      limit: 50,
      depth: 1,
      overrideAccess: true,
    })

    // Uniózva: ha a felhasználónak több aktív tagsága is van (több üzletben dolgozik), elég
    // EGY olyan szerep, aminek 'own'/'all' a szintje, hogy a sor egyáltalán megjelenjen nála.
    const bookingsAllowed = memberships.docs.some((m) => {
      const level = (m.custom_role as { booking_notify_level?: string | null } | null | undefined)?.booking_notify_level
      return level === 'own' || level === 'all'
    })
    allowedPush = { bookings: bookingsAllowed, schedule: true, digest: true, email_not_opened: false }
  }

  const allowed: Record<CategoryKey, boolean> = {
    ...allowedPush,
    bookings_email: allowedPush.bookings,
    schedule_email: allowedPush.schedule,
    pending_popup: true,
    payment_bar: true,
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
      schedule: existing.schedule !== false,
      digest:   existing.digest   !== false,
      email_not_opened: existing.email_not_opened !== false,
      bookings_email: existing.bookings_email === true,
      schedule_email: existing.schedule_email === true,
      pending_popup: existing.pending_popup === true,
      payment_bar: existing.payment_bar === true,
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
