import { NextRequest, NextResponse } from 'next/server'
import { currentSessionId, getCurrentUser } from '@/lib/auth'
import { listSessions, revokeOtherSessions, revokeSession } from '@/lib/authSessions'
import { startSession } from '@/lib/authLogin'

/**
 * Beállítások › Saját profil › Eszközök: hol vagy bejelentkezve (eszköz, utolsó aktivitás, ez-e a mostani), és egy
 * eszköz — vagy az összes többi — kijelentkeztetése.
 *  GET    /api/auth/sessions
 *  DELETE /api/auth/sessions?id=…   |   ?others=1
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sid = await currentSessionId()
  // az eszköz-követés előtti belépés (a tokenben nincs `sid`): most kap munkamenetet (új süti), hogy ez az eszköz is
  // látszódjon és kijelentkeztethető legyen
  const res = NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } })
  if (!sid) await startSession(req, res, { id: user.id, email: user.email, role: user.role })
  const rows = await listSessions(user.id)
  const current = sid ?? rows[0]?.id ?? null
  const body = { sessions: rows.map((r) => ({ id: r.id, device: r.device ?? 'Böngésző', lastSeen: r.last_seen_at, created: r.created_at, current: r.id === current })) }
  return NextResponse.json(body, { headers: res.headers })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (req.nextUrl.searchParams.get('others') === '1') await revokeOtherSessions(user.id, await currentSessionId())
  else if (id) await revokeSession(user.id, id)
  else return NextResponse.json({ error: 'invalid' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
