import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { seedSalonTemplates, seedRestaurantTemplate } from '@/lib/seedTemplates'
import { generateVerifyEmailSubject, generateVerifyEmailHTML } from '@/lib/verifyEmailTemplate'

/**
 * POST /api/auth/register — jelszavas regisztráció, SERVER-OLDALON, egyetlen kérésben:
 * user (nem-megerősített) + szalon/étterem létrehozása + hozzájuk kötés + kezdő-sablon
 * feltöltése. NEM jelentkeztet be — a Users collection `verify: true`-ja miatt egy friss,
 * nem-megerősített user amúgy sem tudna érvényes tokent kapni, úgyhogy a régi „create user →
 * login → create salon (auth headerrel)" lánc itt feleslegessé (és hibássá) vált: a login
 * lépés a megerősítésig mindig elbukna. Ehelyett minden lépés `overrideAccess: true`-val,
 * a szerver saját jogán fut, a kliens csak a végeredményt (siker / duplikált email) kapja meg.
 *
 * A cél az volt, hogy valaki NE tudjon egy általa nem birtokolt domainű email-lel (pl.
 * `dave@davelopment.hu`) azonnal éles fiókot kapni — lásd Users.ts `verify` konfiguráció.
 */

type Body = {
  kind: 'salon' | 'restaurant'
  ownerName: string
  placeName: string
  email: string
  password: string
  city?: string
  phone?: string
  businessTypes?: string[]
  templateId?: string
}

const generateSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { kind, ownerName, placeName, city, phone } = body
  const email = (body.email || '').toLowerCase().trim()
  const password = body.password
  if (!kind || !ownerName || !placeName || !email || !password) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const role = kind === 'restaurant' ? 'restaurant_owner' : 'salon_owner'

  // Duplikált email: ha már megerősített fiók, be kell jelentkeznie; ha még nem, a korábbi
  // (esetleg félbehagyott) regisztráció linkjét kell megkeresnie — nem hozunk létre másodikat.
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    const doc = existing.docs[0] as unknown as { _verified?: boolean }
    return NextResponse.json(
      { error: doc._verified ? 'already_registered' : 'unverified_pending' },
      { status: 409 },
    )
  }

  // `disableVerificationEmail: true` — MINDIG. Payload alapból a create() BELSEJÉBEN, szinkron
  // várja meg az email-küldést, és ha az elhasal (rossz cím, Resend rate-limit, hálózati hiba,
  // hiányzó API-kulcs), az EGÉSZ create()-et elviszi magával (ezt élesben ki is próbáltuk: egy
  // Resend-hibaüzenet miatt a user létre sem jött). A fiók-létrehozás kritikus útja nem függhet
  // egy 3rd-party email API pillanatnyi állapotától — ezért mi küldjük a levelet, KÜLÖN,
  // try/catch mögött, a már sikeresen létrehozott user után.
  let user: { id: number | string; _verificationToken?: string | null }
  try {
    user = await payload.create({
      collection: 'users',
      data: { name: ownerName, email, password, role },
      overrideAccess: true,
      disableVerificationEmail: true,
    })
  } catch (e) {
    console.error('[auth/register] user create error:', e)
    return NextResponse.json({ error: 'create_failed' }, { status: 500 })
  }

  const verifyToken = user._verificationToken ?? ''
  try {
    await payload.sendEmail({
      to: email,
      subject: generateVerifyEmailSubject(),
      html: generateVerifyEmailHTML(verifyToken),
    })
  } catch (e) {
    // NEM buktatjuk a regisztrációt — a user + token már létezik, a linket konzolra írjuk,
    // hogy fejlesztéskor (vagy egy átmeneti Resend-hiba esetén support-oldalról) pótolható
    // legyen. Éles, sikeres küldésnél ez az ág nem fut le.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
    console.error('[auth/register] verify email send failed:', e)
    console.log(`[fallback] Email-megerősítő link (${email}): ${appUrl}/verify-email?token=${verifyToken}`)
  }

  const baseSlug = generateSlug(placeName)
  let slug = baseSlug
  let place: { id: number | string } | null = null

  if (kind === 'restaurant') {
    try {
      place = await payload.create({
        collection: 'restaurants',
        data: { name: placeName, slug, owner: user.id, phone, city, is_active: true },
        overrideAccess: true,
        user,
      })
    } catch {
      slug = `${baseSlug}-${Date.now().toString(36)}`
      try {
        place = await payload.create({
          collection: 'restaurants',
          data: { name: placeName, slug, owner: user.id, phone, city, is_active: true },
          overrideAccess: true,
          user,
        })
      } catch (e) {
        console.error('[auth/register] restaurant create error:', e)
      }
    }
  } else {
    try {
      place = await payload.create({
        collection: 'salons',
        data: { name: placeName, slug, owner: user.id, phone, city, is_active: true },
        overrideAccess: true,
        user,
      })
    } catch {
      slug = `${baseSlug}-${Date.now().toString(36)}`
      try {
        place = await payload.create({
          collection: 'salons',
          data: { name: placeName, slug, owner: user.id, phone, city, is_active: true },
          overrideAccess: true,
          user,
        })
      } catch (e) {
        console.error('[auth/register] salon create error:', e)
      }
    }
  }

  // A user már létrejött (a megerősítő email is kiment) — a hely/sablon a dashboardon,
  // bejelentkezés után is pótolható, ezért ezek hibája NEM buktatja a regisztrációt.
  if (place) {
    const activeKey = `${kind}:${place.id}`
    try {
      if (kind === 'restaurant') {
        await payload.update({ collection: 'users', id: user.id, data: { restaurant: place.id, last_active_business: activeKey }, overrideAccess: true, user })
      } else {
        await payload.update({ collection: 'users', id: user.id, data: { salon: place.id, last_active_business: activeKey }, overrideAccess: true, user })
      }
    } catch (e) {
      console.error('[auth/register] user place-link error:', e)
    }

    try {
      if (kind === 'salon' && body.businessTypes?.length) {
        await seedSalonTemplates(payload, place.id, body.businessTypes, user)
      } else if (kind === 'restaurant' && body.templateId) {
        await seedRestaurantTemplate(payload, place.id, body.templateId, user)
      }
    } catch (e) {
      console.error('[auth/register] seed error:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
