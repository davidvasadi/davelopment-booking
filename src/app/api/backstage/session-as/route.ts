import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import crypto from 'crypto'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { getUserBusinesses, businessKey, ACTIVE_BUSINESS_COOKIE } from '@/lib/activeBusiness'
import { createSession } from '@/lib/authSessions'
import { authQuery, sql } from '@/lib/authDb'

const TOKEN_EXPIRATION = 60 * 60 * 2 // 2 hours in seconds

export async function POST(req: NextRequest) {
  // A redirect-bázis a PUBLIKUS URL — az nginx-proxy mögött a req.url http://localhost:3001
  // lenne, így a böngésző localhostra navigálna (ugyanaz a bug, mint a Google-loginnál volt).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url

  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return NextResponse.redirect(new URL('/backstage/login', baseUrl), { status: 303 })
  }

  const formData = await req.formData()
  const userId = formData.get('userId') as string | null
  if (!userId) return NextResponse.redirect(new URL('/backstage', baseUrl), { status: 303 })

  const payload = await getPayloadClient()
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
    depth: 0,
  }).catch(() => null)

  if (!user) return NextResponse.redirect(new URL('/backstage', baseUrl), { status: 303 })

  // A munkamenet az eszköz-nyilvántartásba (auth_sessions) kerül, mint egy rendes belépés — a getCurrentUser a token
  // `sid`-jét ott ellenőrzi; enélkül a backstage-belépés a login oldalra dobott (2026-11-12). Eszköz-azonosító nélkül,
  // így az owner saját bejelentkezéseit nem zárja le; az owner eszközlistájában felismerhetően látszik, 2 órás lejárattal.
  const sid = await createSession(user.id, req.headers.get('user-agent'), req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, null)
  await authQuery(sql`UPDATE auth_sessions SET expires_at = now() + make_interval(secs => ${TOKEN_EXPIRATION}), device = ${'Backstage — admin belépés'} WHERE id = ${sid}`)

  // Payload 3 a nyers PAYLOAD_SECRET SHA-256 hash-éből vett első 32 hex-karakterrel ír alá
  // (ugyanaz a deriváció mint a getCurrentUser jwtVerify-ban — egységes kulcs).
  const derived = crypto.createHash('sha256').update(process.env.PAYLOAD_SECRET ?? '').digest('hex').slice(0, 32)
  const secretKey = new TextEncoder().encode(derived)
  const issuedAt = Math.floor(Date.now() / 1000)

  const token = await new SignJWT({ id: user.id, collection: 'users', email: user.email, sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TOKEN_EXPIRATION)
    .sign(secretKey)

  // Több-üzlet (multi-tenant): a célt az ELSŐ üzlet TÍPUSA dönti el (nem a role), hogy az a
  // dashboard nyíljon, ahol a user-nek tényleg van üzlete. Beállítjuk az aktív üzletet
  // (cookie + last_active_business), így az impersonált munkamenetben a store-switcher
  // azonnal jó, és a többi üzletre is lehet váltani. Admin → /backstage.
  const role = (user as { role?: string }).role
  let dest = '/dashboard'
  let activeKey: string | null = null
  if (role === 'admin') {
    dest = '/backstage'
  } else {
    const businesses = await getUserBusinesses(user.id)
    if (businesses.length > 0) {
      const first = businesses[0]
      activeKey = businessKey(first)
      dest = first.type === 'restaurant' ? '/restaurant' : '/dashboard'
      try {
        await payload.update({ collection: 'users', id: user.id, data: { last_active_business: activeKey }, overrideAccess: true })
      } catch {
        /* nem blokkoló */
      }
    }
  }

  const res = NextResponse.redirect(new URL(dest, baseUrl), { status: 303 })
  const isProduction = process.env.NODE_ENV === 'production'
  res.cookies.set('payload-token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isProduction,
    maxAge: TOKEN_EXPIRATION,
  })
  if (activeKey) {
    res.cookies.set(ACTIVE_BUSINESS_COOKIE, activeKey, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: isProduction,
      maxAge: TOKEN_EXPIRATION,
    })
  }
  return res
}
