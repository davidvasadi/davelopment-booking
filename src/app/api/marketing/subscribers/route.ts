import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'
import type { Where } from 'payload'
import type { Customer } from '@/payload/payload-types'

/** Ékezet-független összehasonlításhoz — a sima Postgres `contains` (ILIKE) kis/nagybetűt nem
 *  néz, de ékezetet IGEN (pl. "i" nem talál rá az "í"-re). Az `unaccent` Postgres-kiterjesztés
 *  bevezetése extra migrációt jelentene (lásd a szerver séma-szinkron ismert gondját), ezért
 *  ehelyett Node-oldalon Unicode NFD-bontással szűrünk — ez a magyar ékezetekre (á/é/í/ó/ö/ő/
 *  ú/ü/ű) is helyesen működik, mert azok mind kombináló ékezet-jellé bomlanak szét. */
function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Szerver-oldali lapozott + kereshető feliratkozó-lista a Marketing dashboardhoz. Nem a teljes
 * listát töltjük be egyszerre (az nagy üzleteknél több ezer sor is lehet) — a kliens oldalanként
 * kér, kereséskor pedig ez a route szűr (nem a már letöltött adaton), hogy a lapméret mindig
 * kicsi maradjon. Ha van keresőszó, az ékezet-független szűrés miatt egy nagyobb jelölt-
 * halmazt kérünk le a DB-ből (csak üzlet+consent+ország alapján), és Node-oldalon szűrünk/
 * lapozunk — enélkül a DB `contains` némán kihagyná az "í"-t kereső "i"-re (és fordítva).
 */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind')
  const businessId = searchParams.get('businessId')
  const search = searchParams.get('search')?.trim() ?? ''
  const country = searchParams.get('country')?.trim().toUpperCase() ?? ''
  // `status=unsubscribed` a leiratkozottak listázásához kell (monitorozás) — jogilag NEM
  // töröljük a customer-rekordot leiratkozáskor, csak `marketing_consent: false`-ra állítjuk
  // (lásd `/api/marketing/unsubscribe/[token]`), tehát a rekord megmarad, csak innentől nem
  // kap hírlevelet. Ez a szűrő teszi visszakereshetővé/láthatóvá ezeket a tulajnak.
  const status = searchParams.get('status') === 'unsubscribed' ? 'unsubscribed' : 'subscribed'
  const sortDir = searchParams.get('sort') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  // `idsOnly` az "Mind kijelölése" funkcióhoz kell — a szűrésnek/keresésnek megfelelő ÖSSZES
  // feliratkozó ID-ja, nem csak a kliensen épp betöltött (lapozott) 15-20 sor. Nagyobb, de még
  // ésszerű felső korláttal (5000), hogy egy extrém nagy vendégkör se terhelje túl a route-ot.
  const idsOnly = searchParams.get('idsOnly') === '1'
  const limit = idsOnly ? 5000 : Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

  if ((kind !== 'salon' && kind !== 'restaurant') || !businessId) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const denied = await assertAnyCapability(user.id, kind, businessId, ['marketing.view', 'marketing.manage'])
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const baseWhere: Where = {
    and: [
      { [kind]: { equals: businessId } },
      // "Leiratkozott" = valaha volt `marketing_consent_at` (tehát ténylegesen feliratkozott),
      // de a `marketing_consent` mostanra false — ez zárja ki azokat, akik sose pipálták be
      // (azoknál nincs `marketing_consent_at`), hogy a lista tényleg csak a leiratkozókat mutassa.
      ...(status === 'unsubscribed'
        ? [{ marketing_consent: { equals: false } }, { marketing_consent_at: { exists: true } }]
        : [{ marketing_consent: { equals: true } }]),
      ...(country ? [{ customer_country: { equals: country } }] : []),
    ],
  }

  const sort = sortDir === 'asc' ? 'marketing_consent_at' : '-marketing_consent_at'

  if (!search) {
    const result = await payload.find({
      collection: 'customers',
      where: baseWhere,
      sort,
      page,
      limit,
      depth: 0,
      overrideAccess: true,
      ...(idsOnly ? { select: { id: true } as never } : {}),
    })
    if (idsOnly) return NextResponse.json({ ids: (result.docs as Customer[]).map((c) => String(c.id)) })
    return NextResponse.json({
      docs: (result.docs as Customer[]).map((c) => toRow(c, status)),
      totalDocs: result.totalDocs,
      hasNextPage: result.hasNextPage,
      page: result.page,
    })
  }

  // Van keresőszó: DB-szinten csak üzlet/consent/ország szerint szűrünk, a szöveges egyezést
  // Node-oldalon, ékezet-függetlenül végezzük egy elég nagy jelölt-halmazon (5000 — ugyanaz a
  // korlát, mint az `idsOnly`-nál).
  const candidates = await payload.find({
    collection: 'customers',
    where: baseWhere,
    sort,
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const needle = foldAccents(search)
  const matched = (candidates.docs as Customer[]).filter((c) => {
    const haystack = foldAccents(`${c.customer_name ?? ''} ${c.customer_email ?? ''} ${c.customer_city ?? ''} ${c.customer_country ?? ''}`)
    return haystack.includes(needle)
  })

  if (idsOnly) return NextResponse.json({ ids: matched.map((c) => String(c.id)) })

  const start = (page - 1) * limit
  const pageDocs = matched.slice(start, start + limit)
  return NextResponse.json({
    docs: pageDocs.map((c) => toRow(c, status)),
    totalDocs: matched.length,
    hasNextPage: start + limit < matched.length,
    page,
  })
}

function toRow(c: Customer, status: 'subscribed' | 'unsubscribed') {
  return {
    id: String(c.id),
    name: c.customer_name ?? '',
    email: c.customer_email ?? '',
    city: c.customer_city ?? '',
    country: c.customer_country ?? null,
    consentAt: c.marketing_consent_at ?? c.createdAt,
    status,
  }
}
