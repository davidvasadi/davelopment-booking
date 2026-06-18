import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rateLimit'

/**
 * Útvonal-specifikus rate-limitek (app-szintű üzleti limit).
 * Az nginx előtte külön flood-védelmet ad (limit_req_zone); ez itt a
 * finomabb, végpont-szintű korlát. Egyetlen tartós process → in-memory store.
 */
type Rule = { test: (p: string) => boolean; limit: number; windowMs: number; bucket: string }

const RULES: Rule[] = [
  // Foglalás-írás (szalon + étterem) + a dashboard foglalás-kezelő route-ok: szigorú.
  {
    test: (p) =>
      p.startsWith('/api/bookings') ||
      p.startsWith('/api/restaurant/reservations') ||
      p.startsWith('/api/restaurant/manage-reservation') ||
      p.startsWith('/api/restaurant/move-options'),
    limit: 30,
    windowMs: 60_000,
    bucket: 'write',
  },
  // Auth-felület. A login Google OAuth-on megy (Auth.js v5, /api/auth/*), ami
  // egyetlen bejelentkezés alatt több hívást tesz (csrf, providers, signin,
  // callback) — ezért lazább a limit, hogy a legitim flow (akár NAT mögötti
  // megosztott IP-n) ne fulladjon meg. A /api/users/login a Payload admin
  // jelszavas belépése (brute-force felület).
  {
    test: (p) =>
      p.startsWith('/api/auth') ||
      p === '/api/users/login' ||
      p === '/login' ||
      p.startsWith('/register'),
    limit: 40,
    windowMs: 60_000,
    bucket: 'auth',
  },
  // Olvasás (szabad időpontok, asztalok, keresés): lazább.
  {
    test: (p) =>
      p.startsWith('/api/slots') ||
      p.startsWith('/api/restaurant/slots') ||
      p.startsWith('/api/search'),
    limit: 60,
    windowMs: 60_000,
    bucket: 'read',
  },
]

function applyRateLimit(req: NextRequest, pathname: string): NextResponse | null {
  const rule = RULES.find((r) => r.test(pathname))
  if (!rule) return null

  const ip = clientIp(req.headers)
  const { allowed, retryAfter } = rateLimit(`${rule.bucket}:${ip}`, rule.limit, rule.windowMs)
  if (allowed) return null

  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  })
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pathname header — minden route-on átmegy, layoutok / szerver komponensek olvashatják
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)

  // Rate-limit a védett végpontokra (a Payload admin belső API-ját kihagyjuk).
  if (!pathname.startsWith('/admin/api')) {
    const limited = applyRateLimit(req, pathname)
    if (limited) return limited
  }

  // Skip static / next internal / fájl kéréseknél a role check-et, de a header-t átengedjük
  if (
    pathname.startsWith('/admin/api') ||
    pathname.startsWith('/admin/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Admin route protection — csak admin role mehet be a /admin-ba
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('payload-token')?.value
    if (!token) return NextResponse.next({ request: { headers: requestHeaders } })

    try {
      const payloadB64 = token.split('.')[1]
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = JSON.parse(atob(base64))

      if (decoded?.role !== 'admin') {
        return NextResponse.redirect(new URL('/login', req.url))
      }
    } catch {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  // Az /api is benne van (a rate-limithez), de a Next belső útvonalak és a
  // statikus fájlok kimaradnak.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
