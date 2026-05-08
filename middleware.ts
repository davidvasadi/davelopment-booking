import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('payload-token')

  if (!token) {
    const loginUrl = new URL('/bookly/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    // Lightweight JWT expiry check without crypto (Edge runtime)
    const parts = token.value.split('.')
    if (parts.length !== 3) throw new Error('invalid')
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL('/bookly/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  } catch {
    const loginUrl = new URL('/bookly/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/bookly/dashboard/:path*'],
}
