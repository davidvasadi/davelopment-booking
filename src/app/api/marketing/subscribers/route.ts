import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'
import type { Where } from 'payload'
import type { Customer } from '@/payload/payload-types'
import { subscriberRows, type SubscriberVM } from '@/lib/marketingView'

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
  // rendezés oszlop szerint (az oszlopcímre kattintva): alapból a feliratkozás ideje; a többi a Node-oldalon, a teljes
  // szűrt halmazon (a foglalás-szám, a látogatás és a levél-adatok a `subscriberRows`-ból)
  const orderBy = (['name', 'country', 'bookings', 'last', 'opened', 'lastOpen'] as const).find((v) => v === searchParams.get('order')) ?? null
  // szűrés az oszlopokra: mióta feliratkozott (`since` = napok száma), hány foglalása van (`bookings`: none / some / regular)
  const sinceDays = Math.max(0, Number(searchParams.get('since')) || 0)
  const bookingsF = (['none', 'some', 'regular'] as const).find((v) => v === searchParams.get('bookings')) ?? null
  // marketing-szűrők: utolsó látogatás (`visit`: recent = 30 napon belül járt, lapsed = 90+ napja nem), levél-aktivitás
  // (`engage`: opens = megnyitja a leveleket, never = kapott, de egyet sem nyitott meg)
  const visitF = (['recent', 'lapsed'] as const).find((v) => v === searchParams.get('visit')) ?? null
  const engageF = (['opens', 'never'] as const).find((v) => v === searchParams.get('engage')) ?? null
  // „Foglalta már”: szalonnál a szolgáltatás (`service` = azonosító), étteremnél az alkalom (`service` = a neve)
  const serviceF = searchParams.get('service')?.trim() || null
  const nodeF = !!(bookingsF || visitF || engageF || serviceF)
  const nodeSort = !!orderBy
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
      ...(sinceDays ? [{ marketing_consent_at: { greater_than_equal: new Date(Date.now() - sinceDays * 86_400_000).toISOString() } }] : []),
    ],
  }

  const sort = sortDir === 'asc' ? 'marketing_consent_at' : '-marketing_consent_at'

  if (!search && !nodeF && !nodeSort) {
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
    // a sorokhoz a foglalás-szám és az utolsó megnyitott levél (design 13.2)
    const extra = new Map((await subscriberRows(kind as 'salon' | 'restaurant', businessId, result.docs as Customer[])).map((r) => [r.id, r]))
    return NextResponse.json({
      docs: (result.docs as Customer[]).map((c) => ({ ...toRow(c, status), ...stats(extra.get(String(c.id))) })),
      totalDocs: result.totalDocs,
      hasNextPage: result.hasNextPage,
      page: result.page,
    })
  }

  // Van keresőszó vagy foglalás-szűrő: DB-szinten csak üzlet/consent/ország/dátum szerint szűrünk, a szöveges egyezést
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
  let matched = (candidates.docs as Customer[]).filter((c) => {
    if (!needle) return true
    const haystack = foldAccents(`${c.customer_name ?? ''} ${c.customer_email ?? ''} ${c.customer_city ?? ''} ${c.customer_country ?? ''}`)
    return haystack.includes(needle)
  })
  // foglalás-szám szerinti szűrés (a törzsvendég-határ 4, mint a Vendégek oldalon és a szegmenseknél)
  if (nodeF) {
    const info = new Map((await subscriberRows(kind as 'salon' | 'restaurant', businessId, matched)).map((r) => [r.id, r]))
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
    const bookedService = serviceF ? new Set(((await payload.find({
      collection: kind === 'salon' ? 'bookings' : 'reservations',
      where: { and: [{ [kind]: { equals: businessId } }, kind === 'salon' ? { service: { equals: serviceF } } : { occasion: { equals: serviceF } }, { status: { not_in: ['cancelled', 'no_show'] } }] },
      limit: 20000, depth: 0, overrideAccess: true, select: { customer_email: true } as never,
    })).docs as { customer_email?: string | null }[]).map((b) => (b.customer_email ?? '').toLowerCase())) : null
    matched = matched.filter((c) => {
      const r = info.get(String(c.id)); const n = r?.bookings ?? 0
      if (bookingsF && !(bookingsF === 'none' ? n === 0 : bookingsF === 'some' ? n >= 1 && n <= 3 : n >= 4)) return false
      if (visitF === 'recent' && !(r?.lastVisit && r.lastVisit >= day(30))) return false
      if (visitF === 'lapsed' && !(r?.lastVisit && r.lastVisit < day(90))) return false
      if (engageF === 'opens' && !(r && r.opened > 0)) return false
      if (engageF === 'never' && !(r && r.received > 0 && r.opened === 0)) return false
      if (bookedService && !bookedService.has((c.customer_email ?? '').toLowerCase())) return false
      return true
    })
  }

  if (orderBy && !idsOnly) {
    const info = new Map((await subscriberRows(kind as 'salon' | 'restaurant', businessId, matched)).map((r) => [r.id, r]))
    const m = sortDir === 'asc' ? 1 : -1
    const col = new Intl.Collator('hu', { sensitivity: 'base' })
    const val = (c: Customer): string | number | null => {
      const r = info.get(String(c.id))
      if (orderBy === 'name') return c.customer_name ?? null
      if (orderBy === 'country') return c.customer_country ?? null
      if (orderBy === 'bookings') return r?.bookings ?? 0
      if (orderBy === 'last') return r?.lastVisit ?? null
      if (orderBy === 'opened') return r?.opened ?? 0
      return r?.lastOpen?.at ?? null
    }
    matched = [...matched].sort((a, b) => {
      const x = val(a), y = val(b)
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : col.compare(String(x), String(y))) * m
    })
  }

  if (idsOnly) return NextResponse.json({ ids: matched.map((c) => String(c.id)) })

  const start = (page - 1) * limit
  const pageDocs = matched.slice(start, start + limit)
  const extra = new Map((await subscriberRows(kind as 'salon' | 'restaurant', businessId, pageDocs)).map((r) => [r.id, r]))
  return NextResponse.json({
    docs: pageDocs.map((c) => ({ ...toRow(c, status), ...stats(extra.get(String(c.id))) })),
    totalDocs: matched.length,
    hasNextPage: start + limit < matched.length,
    page,
  })
}

/** a sor marketing-adatai: foglalás-szám, utolsó látogatás, kapott / megnyitott levelek, utolsó megnyitott levél */
function stats(r?: SubscriberVM) {
  return { bookings: r?.bookings ?? 0, lastVisit: r?.lastVisit ?? null, received: r?.received ?? 0, opened: r?.opened ?? 0, lastOpen: r?.lastOpen ?? null }
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
