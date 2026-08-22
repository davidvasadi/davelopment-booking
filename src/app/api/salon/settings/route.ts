import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { encryptInvoiceKeysInBody } from '@/lib/encryption'

// `stripe_connect_*`: KIZÁRÓLAG szerver-oldali Connect onboarding/webhook írhatja — a route
// `overrideAccess: true`-val ment, ami a mező-szintű admin-only `access.update`-et (lásd
// settingsFields.ts) megkerülné, ha nem itt is ki lenne zárva. Egy owner NE tudja magát
// `stripe_connect_onboarded: true`-ra állítani Stripe-KYC nélkül.
const FORBIDDEN_KEYS = new Set(['id', 'owner', 'tier', 'createdAt', 'updatedAt', 'stripe_connect_account_id', 'stripe_connect_onboarded'])

function stripPayloadInternals(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripPayloadInternals)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => [k, stripPayloadInternals(v)]),
    )
  }
  return obj
}

// A dashboard fordítás-szerkesztőinek (pl. beleegyező nyilatkozat) kell egy `?locale=`-es
// olvasás is, hogy a nyelvváltáskor a MÁR mentett idegen-nyelvi tartalmat töltsék be — ugyanaz
// a minta, mint a services/[id] GET-nél.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') {
    return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 400 })
  }
  if (!can(active.capabilities, 'settings.profile')) {
    return NextResponse.json({ error: 'Nincs jogosultsága' }, { status: 403 })
  }

  const locale = (request.nextUrl.searchParams.get('locale') as 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr') || undefined
  const payload = await getPayloadClient()
  const doc = await payload.findByID({ collection: 'salons', id: active.id, depth: 0, locale, overrideAccess: true })
  return NextResponse.json({ consent_settings: doc.consent_settings })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') {
    return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 400 })
  }

  if (!can(active.capabilities, 'settings.profile')) {
    return NextResponse.json({ error: 'Nincs jogosultsága' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const safeBody = stripPayloadInternals(
    Object.fromEntries(
      Object.entries(body as Record<string, unknown>).filter(([k]) => !FORBIDDEN_KEYS.has(k)),
    ),
  ) as Record<string, unknown>

  // A Számlázz.hu/Billingo kulcsokat a kliens nyersen küldi (böngészőben nem lehet titkosítani)
  // — itt, mentés előtt titkosítjuk, hogy sose kerüljön nyers szöveg a DB-be.
  encryptInvoiceKeysInBody(safeBody)

  const locale = (request.nextUrl.searchParams.get('locale') as 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr') || undefined
  const payload = await getPayloadClient()
  const doUpdate = () => payload.update({
    collection: 'salons',
    id: active.id,
    data: safeBody,
    locale,
    overrideAccess: true,
    user,
  })

  try {
    await doUpdate()
  } catch (err: unknown) {
    // Payload v3/Drizzle locales-join bug: _locale/_parent_id leak into validation on first
    // call for localized collections. Second attempt always succeeds — retry transparently.
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ValidationError') {
      await doUpdate()
    } else {
      throw err
    }
  }

  return NextResponse.json({ ok: true })
}
