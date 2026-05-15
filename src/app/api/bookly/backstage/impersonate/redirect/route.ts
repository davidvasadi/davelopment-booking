import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) {
    return NextResponse.redirect(new URL('/bookly/backstage/login', req.url))
  }

  const res = NextResponse.redirect(new URL('/bookly/dashboard', req.url))
  res.cookies.set('payload-token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
  })
  return res
}
