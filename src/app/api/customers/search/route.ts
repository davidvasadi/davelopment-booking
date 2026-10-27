import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'

// city/address/taxNumber: számlázási adatok (utalvány-kiállításnál a vásárló címe), ha ismertek
type Suggestion = { name: string; email: string | null; phone: string | null; city: string | null; address?: string | null; taxNumber?: string | null }

/**
 * GET /api/customers/search?q=… — visszatérő vendég keresése név / e-mail / telefon
 * töredékre az AKTÍV üzletnél (a dashboard új-foglalás űrlapjának automatikus kitöltéséhez).
 * Forrás: a kézzel felvett vendégek (customers) és a korábbi foglalások, e-mail/telefon szerint
 * dedupolva, a legfrissebb adattal. Csak `bookings.manage` joggal.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 })
  const denied = await assertCapability(user.id, active.type, active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const payload = await getPayloadClient()
  const scope = active.type // 'salon' | 'restaurant'
  const bizId: string | number = /^\d+$/.test(active.id) ? Number(active.id) : active.id
  // Telefonnál a gépelt szóközök/kötőjelek nélkül is keresünk („30 362 8377” → „303628377”),
  // a tárolt szám jellemzően tagolás nélküli („+36303628377”).
  const digits = q.replace(/\D/g, '')
  const textOr = (fields: string[]): Where => ({
    or: [
      ...fields.map((f) => ({ [f]: { like: q } })),
      ...(digits.length >= 4 && digits !== q ? [{ customer_phone: { like: digits } }] : []),
    ],
  })

  const [customers, history] = await Promise.all([
    payload.find({
      collection: 'customers',
      where: { and: [{ [scope]: { equals: bizId } }, textOr(['customer_name', 'customer_email', 'customer_phone'])] },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: scope === 'salon' ? 'bookings' : 'reservations',
      where: { and: [{ [scope]: { equals: bizId } }, textOr(['customer_name', 'customer_email', 'customer_phone'])] },
      sort: '-date',
      limit: 60,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const byKey = new Map<string, Suggestion>()
  const add = (s: Suggestion) => {
    if (!s.name.trim()) return
    // elérhetőség nélküli (csak névvel felvett) vendég is felajánlható — a név a kulcsa
    const key = s.email?.toLowerCase() || s.phone || `name:${s.name.trim().toLowerCase()}`
    const prev = byKey.get(key)
    if (!prev) byKey.set(key, s)
    else byKey.set(key, { name: prev.name, email: prev.email ?? s.email, phone: prev.phone ?? s.phone, city: prev.city ?? s.city, address: prev.address ?? s.address ?? null, taxNumber: prev.taxNumber ?? s.taxNumber ?? null })
  }
  // A kézi vendég-rekord (felülírt adatok) elsőbbséget kap, utána a legfrissebb foglalások.
  type C = { customer_name?: string | null; customer_email?: string | null; customer_phone?: string | null; customer_city?: string | null; billing_postal_code?: string | null; billing_city?: string | null; billing_street?: string | null; billing_tax_number?: string | null }
  for (const c of customers.docs as C[]) {
    // számlázási cím (irsz + város / utca), ennek hiányában a vendég városa
    const billCity = [c.billing_postal_code, c.billing_city].filter(Boolean).join(' ').trim()
    add({ name: c.customer_name ?? '', email: c.customer_email || null, phone: c.customer_phone || null, city: billCity || c.customer_city || null, address: c.billing_street || null, taxNumber: c.billing_tax_number || null })
  }
  type H = { customer_name?: string | null; customer_email?: string | null; customer_phone?: string | null; customer_city?: string | null; customer_address?: string | null; customer_tax_number?: string | null }
  for (const b of history.docs as H[]) {
    add({ name: b.customer_name ?? '', email: b.customer_email || null, phone: b.customer_phone || null, city: b.customer_city || null, address: b.customer_address || null, taxNumber: b.customer_tax_number || null })
  }

  return NextResponse.json({ results: Array.from(byKey.values()).slice(0, 8) })
}
