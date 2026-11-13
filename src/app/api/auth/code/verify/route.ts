import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { verifyCode } from '@/lib/authCodes'
import { loginEmailWhere } from '@/lib/loginEmail'
import { createAccount, type AccountInput } from '@/lib/createAccount'
import { homeFor, startSession } from '@/lib/authLogin'
import { clientIp, rateLimit } from '@/lib/rateLimit'
import { emailWasKnown, recordReferral, REF_COOKIE } from '@/lib/referrals'

/**
 * POST /api/auth/code/verify — a beírt kód ellenőrzése. Belépésnél bejelentkeztet (7 napra, ezen az eszközön);
 * regisztrációnál létrehozza a fiókot (a kód egyben az e-mail megerősítése) és bejelentkeztet. Hibás kódnál a
 * hátralévő próbálkozások száma; lejárt / kimerült kódnál új kell.
 */
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), code: z.string().trim().regex(/^\d{6}$/) })

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const rl = rateLimit(`code-verify:${clientIp(req.headers)}`, 30, 15 * 60_000)
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited', retryAfter: rl.retryAfter }, { status: 429 })
  const { email, code } = parsed.data

  const r = await verifyCode(email, code)
  if (!r.ok) return NextResponse.json({ error: r.reason, left: r.left ?? 0 }, { status: 400 })
  // a másodlagos cím megerősítő kódja nem belépési kód (azt az /api/auth/secondary-email használja)
  if (r.purpose === 'secondary') return NextResponse.json({ error: 'expired' }, { status: 400 })

  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'users', where: loginEmailWhere(email), limit: 1, overrideAccess: true, depth: 0 })
  let user = found.docs[0] as { id: number | string; email: string; role?: string | null; _verified?: boolean | null } | undefined
  let created: { kind: string; placeId: number | string | null } | null = null

  if (r.purpose === 'register') {
    if (user) return NextResponse.json({ error: 'already_registered' }, { status: 409 })
    try {
      const input = { ...(r.data as unknown as AccountInput), email }
      const wasKnown = await emailWasKnown(payload, email)
      const acc = await createAccount(payload, input, { verified: true })
      user = acc.user
      await recordReferral(payload, { code: input.referralCode || req.cookies.get(REF_COOKIE)?.value, referredUserId: acc.user.id, referredName: input.placeName, wasKnown })
      created = { kind: acc.kind, placeId: acc.placeId }
    } catch (e) {
      console.error('[auth/code/verify] createAccount failed:', e)
      return NextResponse.json({ error: 'create_failed' }, { status: 500 })
    }
  }
  if (!user) return NextResponse.json({ error: 'expired' }, { status: 400 })

  // a kód az e-mail tulajdonlását is igazolja; utolsó belépés (Beállítások › Csapat)
  await payload.update({ collection: 'users', id: user.id, data: { last_login_at: new Date().toISOString(), ...(user._verified ? {} : { _verified: true }) } as never, overrideAccess: true }).catch(() => null)

  const res = NextResponse.json({ ok: true, redirect: homeFor(user.role), ...(created ?? {}) })
  await startSession(req, res, { id: user.id, email: user.email, role: user.role })
  if (created) res.cookies.delete(REF_COOKIE)
  return res
}
