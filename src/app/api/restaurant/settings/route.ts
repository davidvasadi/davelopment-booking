import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { encryptInvoiceKeysInBody } from '@/lib/encryption'

// Ezeket NEM szabad patch-elni ezen a végponton (owner/tier csak admin módosíthatja).
// `stripe_connect_*`: KIZÁRÓLAG szerver-oldali Connect onboarding/webhook írhatja — lásd a
// salon/settings route azonos megjegyzését.
const FORBIDDEN_KEYS = new Set(['id', 'owner', 'tier', 'createdAt', 'updatedAt', 'stripe_connect_account_id', 'stripe_connect_onboarded',
  // Google-értékelés gyorsítótár: csak a szerver-oldali frissítés írhatja (különben hamisítható).
  'google_place_name', 'google_maps_url', 'google_rating', 'google_rating_count', 'google_reviews', 'google_reviews_updated_at'])

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

/** Legalább egy kitöltött (cím VAGY szöveg) foglalási-feltétel szakasz van-e. */
function hasFilledTerms(sections: unknown): boolean {
  if (!Array.isArray(sections)) return false
  return sections.some((s) => {
    if (!s || typeof s !== 'object') return false
    const title = (s as { title?: unknown }).title
    const body = (s as { body?: unknown }).body
    return (typeof title === 'string' && title.trim() !== '') || (typeof body === 'string' && body.trim() !== '')
  })
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

  const payload = await getPayloadClient()

  // Vendég-előleg csak akkor kapcsolható be, ha az üzlet legalább egy foglalási-feltétel
  // szakaszt kitöltött — az előleg-kérésért és annak visszatérítési szabályaiért az ÜZLET
  // vállal felelősséget, ezt a saját feltételeinek kell rögzítenie, nem a platform ad hozzá
  // alapértelmezett szöveget. Szerver-oldali kapu, hogy a kliens-oldali form ne legyen
  // megkerülhető.
  const depositSettings = safeBody.deposit_settings as { enabled?: boolean } | undefined
  const voucherSettings = safeBody.voucher_settings as { enabled?: boolean } | undefined
  const wantsDeposit = depositSettings?.enabled === true
  const wantsVoucher = voucherSettings?.enabled === true
  let currentDoc: Record<string, unknown> | null = null
  const loadCurrentDoc = async () => {
    if (!currentDoc) currentDoc = await payload.findByID({ collection: 'restaurants', id: active.id, depth: 0, overrideAccess: true }) as unknown as Record<string, unknown>
    return currentDoc
  }

  if (wantsDeposit) {
    const termsSections = Array.isArray(safeBody.terms_sections) ? safeBody.terms_sections : (await loadCurrentDoc()).terms_sections
    if (!hasFilledTerms(termsSections)) {
      return NextResponse.json(
        { error: 'Az előleg bekapcsolása előtt töltsd ki a foglalási feltételeket (Dokumentumok & jogi fül) — ez rögzíti, hogy az előleg-kérésért és annak visszatérítési szabályaiért az üzlet vállal felelősséget.' },
        { status: 400 },
      )
    }
  }

  // Előleg és ajándékutalvány is ugyanazon a Stripe Connect fiókon keresztül fut — ha az
  // üzlet nincs KYC-vel onboardolva, a vendég fizetése a checkoutnál törne el láthatatlanul.
  if (wantsDeposit || wantsVoucher) {
    const onboarded = (await loadCurrentDoc()).stripe_connect_onboarded === true
    if (!onboarded) {
      return NextResponse.json(
        { error: 'Az előleg/ajándékutalvány bekapcsolása előtt kösd össze a fiókodat a Stripe-pal (Fizetések fül) — enélkül a vendég fizetése nem tudna lemenni.' },
        { status: 400 },
      )
    }
  }

  const locale = (request.nextUrl.searchParams.get('locale') as 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr') || undefined
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
      // Második próbálkozás (a fenti Payload-bug miatt). Ha ez is validációs hiba, az VALÓDI —
      // a mezőt és az okot visszaadjuk, hogy a felület ki tudja írni (korábban 500 + „Mentés
      // sikertelen" lett belőle, és nem derült ki, mi a baj).
      try {
        await doUpdate()
      } catch (retryErr: unknown) {
        const res = validationErrorResponse(retryErr)
        if (res) return res
        throw retryErr
      }
    } else {
      throw err
    }
  }

  return NextResponse.json({ ok: true })
}

/** Payload ValidationError → 400 a hibás mezők listájával (`path: üzenet`). */
function validationErrorResponse(err: unknown): NextResponse | null {
  if (!err || typeof err !== 'object' || (err as { name?: string }).name !== 'ValidationError') return null
  const errors = (err as { data?: { errors?: { path?: string; message?: string }[] } }).data?.errors ?? []
  const detail = errors.map((e) => [e.path, e.message].filter(Boolean).join(': ')).filter(Boolean).join('; ')
  return NextResponse.json({ error: detail ? `Hibás mező: ${detail}` : 'Érvénytelen adat' }, { status: 400 })
}
