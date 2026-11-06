import { NextRequest, NextResponse } from 'next/server'
import { countClick, normalizeCode, REF_COOKIE, REF_COOKIE_DAYS } from '@/lib/referrals'

/** Ajánló link (`/r/anna`): a kód sütibe kerül (60 nap — a regisztráció átveszi), a megnyitás számít, és irány a
 *  regisztráció a kóddal. Ismeretlen kódnál is a regisztrációra visz, csak kód nélkül. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const base = process.env.NEXT_PUBLIC_APP_URL || req.url
  const ok = await countClick(raw).catch(() => false)
  const code = normalizeCode(raw)
  const res = NextResponse.redirect(new URL(ok ? `/register?ref=${encodeURIComponent(code)}` : '/register', base))
  if (ok) res.cookies.set(REF_COOKIE, code, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: REF_COOKIE_DAYS * 86400, secure: process.env.NODE_ENV === 'production' })
  return res
}
