import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pathname header — minden route-on átmegy, layoutok / szerver komponensek olvashatják
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)

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
        return NextResponse.redirect(new URL('/bookly/login', req.url))
      }
    } catch {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}
