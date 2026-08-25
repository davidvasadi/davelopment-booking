import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { encryptInvoiceKeysInBody } from '@/lib/encryption'

// Ezeket NEM szabad patch-elni ezen a végponton (owner/tier csak admin módosíthatja).
// `stripe_connect_*`: KIZÁRÓLAG szerver-oldali Connect onboarding/webhook írhatja — lásd a
// salon/settings route azonos megjegyzését.
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
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 400 })
  }
  if (!can(active.capabilities, 'settings.profile')) {
    return NextResponse.json({ error: 'Nincs jogosultsága' }, { status: 403 })
  }

  const locale = (request.nextUrl.searchParams.get('locale') as 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr') || undefined
  // `fallback-locale=null`: a dashboard nyelv-szerkesztőinek (pl. „jó tudni") ÜRESEN kell kapnia
  // a még le nem fordított mezőket, nem a magyar tartalom automatikus visszaesésével.
  const fallbackLocale = request.nextUrl.searchParams.get('fallback-locale') === 'null' ? false : undefined
  const payload = await getPayloadClient()
  const doc = await payload.findByID({ collection: 'restaurants', id: active.id, depth: 0, locale, fallbackLocale, overrideAccess: true })
  // A teljes dokumentumot adjuk vissza (nem csak a consent_settings-et) — a localizált
  // mező-szerkesztő (`useLocalizedFields`) ugyanerről a végpontról tölti be a „jó tudni"/
  // feltételek/email-sablon mezőket is nyelvváltáskor. A meglévő consent-fordítás olvasó
  // (`PaymentsSettingsPanel`) csak a `.consent_settings`-et nézi, ez a bővítés nem érinti.
  return NextResponse.json(doc)
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 400 })
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
    collection: 'restaurants',
    id: active.id,
    data: safeBody,
    locale,
    overrideAccess: true,
    user,
  })

  try {
    await doUpdate()
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ValidationError') {
      await doUpdate()
    } else {
      throw err
    }
  }

  return NextResponse.json({ ok: true })
}
