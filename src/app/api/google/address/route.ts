import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { googlePlacesEnabled, googleAddressMaintenanceStatus, autocompleteAddress, getAddressDetails, GoogleApiCapReachedError } from '@/lib/googleReviews'

const MAINTENANCE_MESSAGE = 'Ez a funkció jelenleg karbantartás alatt áll (elérte a havi biztonsági keretét) — a hónap fordulásával automatikusan visszatér.'

/**
 * Postai cím-autocomplete a Számlázási adatok formhoz (Beállítások → Számlázás).
 *   GET  ?autocomplete=1&q=…&session=…  → élő, gépelés-közbeni cím-találatok.
 *   POST { placeId, sessionToken }      → irányítószám/város/utca kibontása a kiválasztott címből.
 * Lásd src/app/api/google/place/route.ts — ugyanaz a minta, csak cím-keresésre szűkítve.
 */
async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { active } = await getActiveBusiness(user)
  if (!active) return { error: NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 }) }
  const denied = await assertCapability(user.id, active.type, active.id, 'billing.manage')
  if (denied) return { error: NextResponse.json({ error: denied.error }, { status: denied.status }) }
  if (!googlePlacesEnabled()) return { error: NextResponse.json({ error: 'A cím-kitöltés nincs bekapcsolva a platformon.' }, { status: 503 }) }
  return { active }
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('maintenance') === '1') {
    const g = await guard().catch(() => null)
    if (!g || 'error' in g) return NextResponse.json({ search: false, details: false })
    return NextResponse.json(await googleAddressMaintenanceStatus())
  }
  const g = await guard()
  if ('error' in g) return g.error
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const session = (req.nextUrl.searchParams.get('session') ?? '').trim()
  if (q.length < 3 || !session) return NextResponse.json({ suggestions: [] })
  try {
    return NextResponse.json({ suggestions: await autocompleteAddress(q, session) })
  } catch (err) {
    if (err instanceof GoogleApiCapReachedError) return NextResponse.json({ error: MAINTENANCE_MESSAGE, maintenance: true }, { status: 503 })
    console.error('[google/address] autocomplete', err)
    return NextResponse.json({ error: 'A cím-keresés nem sikerült.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ('error' in g) return g.error
  const body = (await req.json().catch(() => null)) as { placeId?: string; sessionToken?: string } | null
  const placeId = typeof body?.placeId === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(body.placeId) ? body.placeId : null
  const sessionToken = typeof body?.sessionToken === 'string' && body.sessionToken.length > 0 && body.sessionToken.length < 200 ? body.sessionToken : ''
  if (!placeId || !sessionToken) return NextResponse.json({ error: 'Érvénytelen kérés' }, { status: 400 })
  try {
    return NextResponse.json({ address: await getAddressDetails(placeId, sessionToken) })
  } catch (err) {
    if (err instanceof GoogleApiCapReachedError) return NextResponse.json({ error: MAINTENANCE_MESSAGE, maintenance: true }, { status: 503 })
    console.error('[google/address] details', err)
    return NextResponse.json({ error: 'A cím betöltése nem sikerült.' }, { status: 502 })
  }
}
