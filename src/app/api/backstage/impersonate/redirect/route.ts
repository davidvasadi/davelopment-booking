import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // A publikus URL-re irányítunk (nginx-proxy mögött a req.url localhost lenne).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url
  const token = req.nextUrl.searchParams.get('t')
  if (!token) {
    return NextResponse.redirect(new URL('/backstage/login', baseUrl))
  }

  // A cél a hívó által megadott szerep szerint (restaurant_owner → /restaurant), alapból /dashboard.
  const role = req.nextUrl.searchParams.get('role')
  const dest = role === 'restaurant_owner' ? '/restaurant' : '/dashboard'
  const res = NextResponse.redirect(new URL(dest, baseUrl))
  res.cookies.set('payload-token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
  })
  return res
}
