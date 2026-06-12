import { NextResponse } from 'next/server'

export async function GET() {
  // A publikus URL-re irányítunk (a többi route konvenciója: NEXT_PUBLIC_APP_URL). A korábbi
  // NEXT_PUBLIC_SERVER_URL + localhost:3000 fallback rossz volt az nginx-proxy mögött.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const res = NextResponse.redirect(new URL('/backstage/login', baseUrl))
  res.cookies.set('payload-token', '', { maxAge: 0, path: '/' })
  return res
}
