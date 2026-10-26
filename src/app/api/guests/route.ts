import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { loadGuests, listGuests, parseGuestsQuery } from '@/lib/guestsData'

/**
 * GET /api/guests — a Vendégek oldal szerveroldali lapozása (az AKTÍV üzlet, szalon vagy étterem):
 *   ?page&q&period&month&day&status&tier&sort → 20 könnyű lista-sor + összes darabszám
 *   ?key=<vendég-kulcs>                       → egy vendég teljes profilja (kattintásra)
 * Olvasás → GET (párhuzamos, gyorsítótárazható), `guests.view` vagy `guests.manage` joggal.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 404 })
  // ugyanaz, mint az oldalnál: megtekintés VAGY kezelés joga elég
  const denied = (await assertCapability(user.id, active.type, active.id, 'guests.view'))
    && (await assertCapability(user.id, active.type, active.id, 'guests.manage'))
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const bizId: string | number = /^\d+$/.test(active.id) ? Number(active.id) : active.id
  const ctx = await loadGuests(active.type, bizId)

  const key = req.nextUrl.searchParams.get('key')
  if (key) {
    const g = ctx.guests.find((x) => x.key === key)
    if (!g) return NextResponse.json({ error: 'A vendég nem található' }, { status: 404 })
    return NextResponse.json({ profile: ctx.toVM(g) })
  }

  return NextResponse.json(listGuests(ctx, parseGuestsQuery(req.nextUrl.searchParams)))
}
