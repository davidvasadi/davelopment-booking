import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { emitBookingChange } from '@/lib/sseEmitter'
import { autofillSalonSchedule } from '@/lib/scheduleAutofill'
import type { StaffMember } from '@/payload/payload-types'
import { bookableDayCount, type BookingWindowSource } from '@/lib/bookingWindow'

/**
 * Egy szalon-munkatárs kezelése: GET (locale-lekérés), PATCH (mentés / lokalizált bio),
 * DELETE. RBAC: `staff.manage` (owner + manager) a munkatárs szalonjában. Az avatar
 * relationship SZÁM-ra coerce-ölve (a kliens string id-t küld).
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

async function loadManageableStaff(id: string, userId: string | number) {
  const payload = await getPayloadClient()
  let staff: StaffMember | undefined
  try {
    staff = (await payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true })) as StaffMember
  } catch {
    return { error: 'A munkatárs nem található', status: 404 as const }
  }
  const salonId = staff.salon ? (typeof staff.salon === 'object' ? staff.salon.id : staff.salon) : null
  if (!salonId) return { error: 'Érvénytelen munkatárs', status: 400 as const }
  const denied = await assertCapability(userId, 'salon', salonId, 'staff.manage')
  if (!denied) return { payload, staff, salonId, isSelfOnly: false }
  // Nincs staff.manage — de a SAJÁT (linkelt) rekordját akkor is szerkesztheti, KORLÁTOZOTTAN
  // (jelenleg csak az alap napi szünet, önkiszolgáló beállítás, ld. `default_break_*`).
  const isSelf = staff.user != null && String(typeof staff.user === 'object' ? staff.user.id : staff.user) === String(userId)
  if (isSelf) return { payload, staff, salonId, isSelfOnly: true }
  return { error: denied.error, status: denied.status }
}

/**
 * A staff felfüggesztés/aktiválás tükrözése a párosított membershipre (Csapat és jogok).
 * A két rekord salon + email párral kapcsolódik (nincs séma-reláció köztük). Így a
 * Munkatársaknál végzett suspend a Csapat-jogok státuszában is látszik. Best-effort:
 * ha nincs párosított membership (nem meghívott tag, csak kézi staff), nincs teendő.
 */
async function syncMembershipStatus(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  salonId: string | number,
  email: string | null | undefined,
  isActive: boolean,
): Promise<void> {
  const mail = (email ?? '').trim().toLowerCase()
  if (!mail) return
  const res = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salonId } }, { email: { equals: mail } }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const status = isActive ? 'active' : 'suspended'
  for (const m of res.docs) {
    // Csak a már elfogadott (active/suspended) tagságot mozgatjuk; egy még függő
    // `invited` meghívót nem függesztünk fel/aktiválunk automatikusan.
    if (m.status === 'invited') continue
    if (m.status === status) continue
    await payload.update({ collection: 'memberships', id: m.id, data: { status }, overrideAccess: true })
  }
}

/**
 * A Munkatársak "Pozíció" mezőjének (role_title) tükrözése a párosított membershipre
 * (`Membership.position`) — a Csapat & jogok EZT a mezőt mutatja, nem a staff.role_title-t,
 * enélkül a Munkatársakon beírt pozíció sosem jelent meg a Csapat & jogok panelen.
 */
async function syncMembershipPosition(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  salonId: string | number,
  email: string | null | undefined,
  position: string,
): Promise<void> {
  const mail = (email ?? '').trim().toLowerCase()
  if (!mail) return
  const res = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salonId } }, { email: { equals: mail } }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  for (const m of res.docs) {
    if (m.position === position) continue
    await payload.update({ collection: 'memberships', id: m.id, data: { position }, overrideAccess: true })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadManageableStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const locale = request.nextUrl.searchParams.get('locale') || undefined
  const doc = await loaded.payload.findByID({
    collection: 'staff',
    id,
    depth: 0,
    overrideAccess: true,
    ...(locale ? { locale: locale as never } : {}),
  })
  return NextResponse.json(doc)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const loaded = await loadManageableStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const locale = request.nextUrl.searchParams.get('locale') || undefined
  const data: Record<string, unknown> = loaded.isSelfOnly
    ? {
        ...('default_breaks' in body ? { default_breaks: Array.isArray(body.default_breaks) ? body.default_breaks : [] } : {}),
      }
    : {
        ...body,
        ...(body.salon != null ? { salon: num(body.salon) } : {}),
        ...(body.avatar != null ? { avatar: num(body.avatar) } : {}),
      }

  try {
    const doc = await loaded.payload.update({
      collection: 'staff',
      id,
      data: data as never,
      overrideAccess: true,
      user,
      ...(locale ? { locale: locale as never } : {}),
    })

    // Ha a felfüggesztés-állapot (is_active) változott, tükrözzük a párosított membershipre,
    // hogy a Csapat és jogok is a helyes státuszt mutassa. Best-effort — nem blokkolja a mentést.
    if (typeof body.is_active === 'boolean' && loaded.staff?.email) {
      try {
        await syncMembershipStatus(loaded.payload, loaded.salonId, loaded.staff.email, body.is_active)
      } catch (e) {
        console.error('[api/staff PATCH] membership-státusz szinkron sikertelen', e)
      }
    }
    // Pozíció-szinkron: a Csapat & jogok a membership.position-t mutatja, nem a staff.role_title-t.
    if (typeof body.role_title === 'string' && body.role_title.trim()) {
      try {
        const email = typeof (doc as { email?: string | null }).email === 'string' ? (doc as { email?: string | null }).email : loaded.staff?.email
        await syncMembershipPosition(loaded.payload, loaded.salonId, email, body.role_title.trim())
      } catch (e) {
        console.error('[api/staff PATCH] membership-pozíció szinkron sikertelen', e)
      }
    }
    // Ha az alap napi szünet változott, vagy a munkatárs most lett aktív (pl. importált, átnézett
    // munkatárs), azonnal ráírjuk a Naptárra (nem várunk az éjszakai cronig) — ugyanaz a mintázat,
    // mint a szalon-beállítás/elérhetőség-kivétel mentésénél.
    if ('default_breaks' in body || (body.is_active === true && loaded.staff?.is_active === false)) {
      try {
        const salon = await loaded.payload.findByID({ collection: 'salons', id: loaded.salonId, depth: 0, overrideAccess: true })
        if (salon) await autofillSalonSchedule(loaded.payload, String(loaded.salonId), bookableDayCount(salon as BookingWindowSource))
      } catch (e) {
        console.error('[api/staff PATCH] szünet schedule-autofill szinkron hiba', e)
      }
    }

    emitBookingChange({ kind: 'salon', businessId: String(loaded.salonId), op: 'update' })
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[api/staff PATCH] update failed', e)
    return NextResponse.json({ error: 'A munkatárs mentése sikertelen' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadManageableStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const email = (loaded.staff?.email ?? '').trim().toLowerCase()
  // Salon ID-t mindig számra coerce-öljük a membership query előtt (Payload Postgres int-ként tárolja)
  const salonNum = /^\d+$/.test(String(loaded.salonId)) ? Number(loaded.salonId) : loaded.salonId

  // Csak JÖVŐBELI, még aktív foglalás tiltja a törlést — a puszta `pending`/`confirmed` státusz
  // nem elég, mert egy régi foglalás sosem lett automatikusan lezárva (`autoCompleteBookings`
  // csak akkor zár, ha a lejárat óta senki nem nyúlt hozzá) még simán ezekben a státuszokban
  // ragadhat, pedig a dátuma már rég elmúlt. A `bookings.staff` (nem kötelező mező) NULL-ra
  // állítja a Payload a törléskor egy lezárt/lemondott/MÚLTBELI foglaláson, a rekord megmarad.
  const todayStr = new Date().toISOString().slice(0, 10)
  const bookingCheck = await loaded.payload.find({
    collection: 'bookings',
    where: { and: [
      { staff: { equals: id } },
      { status: { in: ['pending', 'confirmed'] } },
      { date: { greater_than_equal: todayStr } },
    ] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (bookingCheck.totalDocs > 0) {
    return NextResponse.json(
      { error: 'Ennek a munkatársnak jövőbeli foglalásai vannak, ezért nem törölhető. Függeszd fel helyette (Aktív kikapcsolása).' },
      { status: 409 },
    )
  }

  try {
    await loaded.payload.delete({ collection: 'staff', id, overrideAccess: true, user })
  } catch (e) {
    console.error('[api/staff DELETE] delete failed', e)
    return NextResponse.json({ error: 'A munkatárs törlése sikertelen' }, { status: 500 })
  }

  // SZINKRON: a párosított membership (Csapat és jogok) is törlődik.
  if (email) {
    const res = await loaded.payload.find({
      collection: 'memberships',
      where: { and: [{ salon: { equals: salonNum } }, { email: { equals: email } }] },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    await Promise.all(
      res.docs.map((m) =>
        loaded.payload.delete({ collection: 'memberships', id: m.id, overrideAccess: true, user }),
      ),
    )
  }

  emitBookingChange({ kind: 'salon', businessId: String(loaded.salonId), op: 'delete' })
  return NextResponse.json({ ok: true })
}
