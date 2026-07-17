import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Where } from 'payload'
import type { Customer } from '@/payload/payload-types'

/**
 * POST /api/customers — a tulaj upsertel egy vendég-rekordot az AKTÍV üzletéhez:
 * tiltás/feloldás (`blocked`) és/vagy kézi felülírás (név/e-mail/telefon/jegyzet).
 * A rekordot a megadott e-mail VAGY telefon alapján keresi meg az üzletnél (dedup),
 * és frissíti, vagy létrehozza. Csak owner/admin, csak a saját (aktív) üzletére.
 */
interface Body {
  // A vendég azonosítása (a levezetett vendég kulcsa) — legalább az egyik kell.
  email?: string | null
  phone?: string | null
  // Beállítandó mezők (opcionális).
  name?: string | null
  newEmail?: string | null
  newPhone?: string | null
  notes?: string | null
  blocked?: boolean
  block_reason?: string | null
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // A jogosultságot az AKTÍV üzlet adja (getActiveBusiness), nem a user.role — így a vegyes
  // fiók (alkalmazott máshol + tulaj itt) is működik. Minden lekérdezés az aktív üzletre szűr.
  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 })

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body) return NextResponse.json({ error: 'Érvénytelen adat' }, { status: 400 })

  const email = body.email?.trim().toLowerCase() || null
  const phone = body.phone?.trim() || null
  if (!email && !phone) {
    return NextResponse.json({ error: 'A vendég azonosításához e-mail vagy telefon kell' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const scope = active.type // 'salon' | 'restaurant'
  // A reláció-oszlopok integer-ek → a string id-t számmá kell alakítani, különben a create elhasal.
  const bizId: string | number = /^\d+$/.test(active.id) ? Number(active.id) : active.id

  // Meglévő rekord az üzletnél e-mail VAGY telefon alapján — a match_index-et is nézve,
  // hogy a régi (átírt) azonosítóval is megtaláljuk (ne jöjjön létre duplikátum).
  const or: Where[] = []
  if (email) {
    or.push({ customer_email: { equals: email } })
    or.push({ match_index: { contains: email } })
  }
  if (phone) {
    or.push({ customer_phone: { equals: phone } })
    or.push({ match_index: { contains: phone } })
  }
  const existing = await payload.find({
    collection: 'customers',
    where: { and: [{ [scope]: { equals: bizId } }, { or }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  // Match-index: a vendég MINDEN azonosítója (régi identitás + új e-mail/telefon), így a
  // telefon-csere után is átlinkelhető a régi foglalás. Normalizált (email lower, phone trim).
  const newEmail = body.newEmail?.trim().toLowerCase() || null
  const newPhone = body.newPhone?.trim() || null
  const existingKeys = (existing.docs[0]?.match_index ?? '').split('\n').filter(Boolean)
  const matchIndex = Array.from(new Set([...existingKeys, email, phone, newEmail, newPhone].filter(Boolean))).join('\n')

  // Csak a ténylegesen megadott mezőket írjuk (a többi marad).
  const data: Partial<Customer> = { match_index: matchIndex }
  if (body.name !== undefined) data.customer_name = body.name?.trim() || null
  if (body.newEmail !== undefined) data.customer_email = newEmail
  if (body.newPhone !== undefined) data.customer_phone = newPhone
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null
  if (body.blocked !== undefined) {
    data.blocked = body.blocked
    data.block_reason = body.blocked ? body.block_reason?.trim() || null : null
    data.blocked_at = body.blocked ? new Date().toISOString() : null
  }

  try {
    if (existing.docs.length > 0) {
      const doc = (await payload.update({
        collection: 'customers',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })) as Customer
      return NextResponse.json({ ok: true, customer: doc })
    }

    // Új rekord — az azonosító mezőket is beállítjuk (ha a felülírás nem adta meg).
    const doc = (await payload.create({
      collection: 'customers',
      data: {
        [scope]: bizId,
        customer_email: data.customer_email ?? email,
        customer_phone: data.customer_phone ?? phone,
        customer_name: data.customer_name ?? body.name?.trim() ?? null,
        notes: data.notes ?? null,
        match_index: matchIndex,
        blocked: data.blocked ?? false,
        block_reason: data.block_reason ?? null,
        blocked_at: data.blocked_at ?? null,
      },
      overrideAccess: true,
    })) as Customer
    return NextResponse.json({ ok: true, customer: doc })
  } catch (e) {
    console.error('[customers] upsert error', e)
    return NextResponse.json({ error: 'Nem sikerült menteni' }, { status: 500 })
  }
}

/**
 * DELETE /api/customers — a vendég VÉGLEGES törlése az aktív üzletnél: az ÖSSZES foglalása
 * (reservations vagy bookings) + a customer-rekord. Visszafordíthatatlan. A vendéget e-mail
 * VAGY telefon alapján azonosítjuk (match_index-et is nézve). Csak owner/admin, saját üzletre.
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // A jogosultságot az aktív üzlet adja (nem a user.role) — vegyes fiók is működik.
  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 })

  const body = (await req.json().catch(() => null)) as { email?: string | null; phone?: string | null } | null
  const email = body?.email?.trim().toLowerCase() || null
  const phone = body?.phone?.trim() || null
  if (!email && !phone) {
    return NextResponse.json({ error: 'A vendég azonosításához e-mail vagy telefon kell' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const scope = active.type // 'salon' | 'restaurant'
  const bizId: string | number = /^\d+$/.test(active.id) ? Number(active.id) : active.id
  const bookingCollection = scope === 'salon' ? 'bookings' : 'reservations'

  // A vendég azonosítói: közvetlen e-mail/telefon + a customer match_index (átírt régi értékek).
  const idents = new Set<string>()
  if (email) idents.add(email)
  if (phone) idents.add(phone)

  const custOr: Where[] = []
  if (email) { custOr.push({ customer_email: { equals: email } }); custOr.push({ match_index: { contains: email } }) }
  if (phone) { custOr.push({ customer_phone: { equals: phone } }); custOr.push({ match_index: { contains: phone } }) }
  const custRes = await payload.find({
    collection: 'customers',
    where: { and: [{ [scope]: { equals: bizId } }, { or: custOr }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  for (const c of custRes.docs as Customer[]) {
    for (const k of (c.match_index ?? '').split('\n')) if (k) idents.add(k.trim().toLowerCase())
    if (c.customer_email) idents.add(c.customer_email.trim().toLowerCase())
    if (c.customer_phone) idents.add(c.customer_phone.trim())
  }

  const emails = Array.from(idents).filter((v) => v.includes('@'))
  const phones = Array.from(idents).filter((v) => !v.includes('@'))
  const bookingOr: Where[] = []
  for (const e of emails) bookingOr.push({ customer_email: { equals: e } })
  for (const p of phones) bookingOr.push({ customer_phone: { equals: p } })

  try {
    let deletedBookings = 0
    if (bookingOr.length > 0) {
      const del = await payload.delete({
        collection: bookingCollection,
        where: { and: [{ [scope]: { equals: bizId } }, { or: bookingOr }] },
        overrideAccess: true,
      })
      deletedBookings = Array.isArray(del.docs) ? del.docs.length : 0
    }
    // Customer-rekord(ok) törlése is.
    for (const c of custRes.docs as Customer[]) {
      await payload.delete({ collection: 'customers', id: c.id, overrideAccess: true })
    }
    return NextResponse.json({ ok: true, deletedBookings })
  } catch (e) {
    console.error('[customers] delete error', e)
    return NextResponse.json({ error: 'Nem sikerült törölni' }, { status: 500 })
  }
}
