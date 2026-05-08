import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()

  // Allow Payload's own internal requests (API, static assets)
  if (
    pathname.startsWith('/admin/api') ||
    pathname.startsWith('/admin/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get('payload-token')?.value

  if (!token) {
    // Not logged in — let Payload handle its own login page
    return NextResponse.next()
  }

  try {
    // Decode JWT payload (middle segment) — base64url → base64 → JSON
    const payloadB64 = token.split('.')[1]
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64))

    if (decoded?.role !== 'admin') {
      return NextResponse.redirect(new URL('/bookly/dashboard', req.url))
    }
  } catch {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
