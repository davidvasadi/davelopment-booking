import { NextResponse } from 'next/server'

export async function GET() {
  const res = NextResponse.redirect(new URL('/bookly/backstage/login', process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'))
  res.cookies.set('payload-token', '', { maxAge: 0, path: '/' })
  return res
}
