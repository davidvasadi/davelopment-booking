import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { seedSalonTemplates, seedRestaurantTemplate } from '@/lib/seedTemplates'
import { issueRegistrationSetupToken, REG_SETUP_COOKIE, REG_SETUP_TTL_SECONDS } from '@/lib/registrationSetupToken'

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
  /** A landing árazás-kártyáján kiválasztott csomag (?tier= a /register-en). Alap: 'pro'
   *  (a `businessTierField` schema-defaultja is ez, tehát meg nem adva ugyanoda esne vissza). */
  tier?: 'starter' | 'pro'
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
  const tier: 'starter' | 'pro' | undefined = body.tier === 'starter' ? 'starter' : undefined

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
  let user: { id: number | string }
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

  // A megerősítő email KÉSZAKARVA nem itt megy ki — a wizard a fiók-létrehozás UTÁN még
  // végigvisz a hátralévő lépésen (adatimport), és csak a legvégén (`/api/auth/finish-
  // registration`) küldjük ki, hogy a user egy kattintással pontosan azután landoljon a
  // postafiókjában, hogy tényleg végzett a beállítással — ne kelljen egy már elavult
  // fülre visszaváltania. Lásd azt a route-ot a `_verificationToken`-nel kapcsolatos
  // megjegyzésért (Payload `hidden: true` mezője, `showHiddenFields` kell hozzá).

  const baseSlug = generateSlug(placeName)
  let slug = baseSlug
  let place: { id: number | string } | null = null

  if (kind === 'restaurant') {
    try {
      place = await payload.create({
        collection: 'restaurants',
        data: { name: placeName, slug, owner: user.id, phone, city, is_active: true, ...(tier ? { tier } : {}) },
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
        data: { name: placeName, slug, owner: user.id, phone, city, is_active: true, ...(tier ? { tier } : {}) },
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

  const res = NextResponse.json({ ok: true, kind, businessId: place?.id ?? null })

  // Szűkre szabott, 30 perces "regisztráció-folytatás" cookie — KIZÁRÓLAG a wizard hátralévő
  // lépéséhez (adatimport, `/api/import-csv`) ad hozzáférést EHHEZ az egy üzlethez, NEM egy
  // általános bejelentkezés. Amíg a user nem kattint a megerősítő linkre, a dashboard/minden
  // más útvonal továbbra is a valódi, `payload-token` alapú bejelentkezést követeli. Lásd
  // `src/lib/registrationSetupToken.ts` a fenti biztonsági indoklásért.
  if (place) {
    const setupToken = await issueRegistrationSetupToken(user.id, kind, place.id)
    res.cookies.set(REG_SETUP_COOKIE, setupToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REG_SETUP_TTL_SECONDS,
    })
  }

  return res
}
