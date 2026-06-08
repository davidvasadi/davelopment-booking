/**
 * Auth.js (next-auth v5) konfiguráció — Google OAuth + Payload-integráció.
 *
 * Folyamat:
 * 1. A felhasználó Google-lel belép → Auth.js kezeli a PKCE/CSRF flow-t.
 * 2. A `signIn` callbackben megkeressük (vagy létrehozzuk) a Payload userét email alapján.
 * 3. Saját kézzel kiállítunk egy Payload-kompatibilis JWT-t (jose, HS256, PAYLOAD_SECRET),
 *    és a `payload-token` cookie-ba tesszük → a meglévő Payload auth és RBAC tovább működik.
 * 4. Auth.js maga csak az OAuth-flow közvetítője; nem hagyatkozunk a saját session-jére.
 *
 * Biztonság:
 * - OAuth PKCE + state (Auth.js v5 alapból).
 * - HttpOnly, SameSite=Lax, prod-on Secure cookie.
 * - AUTH_SECRET (Auth.js) + PAYLOAD_SECRET (a Payload JWT-hez) — mindkettő env-ben.
 * - Új OAuth-user random 32-byte jelszót kap (nem használja, csak a séma kötelezi).
 */

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import crypto from 'crypto'
import { SignJWT } from 'jose'
import { getPayloadClient } from '@/lib/payload'

const PAYLOAD_COOKIE = 'payload-token'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 nap

/**
 * Payload-kompatibilis JWT-t állít ki. A JWT mezői:
 * - id, collection, email — kötelező alapadatok
 * - role — a Users séma `saveToJWT: true`-ra van állítva, így ennek is benne kell lennie
 *   (különben a Payload `JWTAuthentication` strategy nem ismeri be).
 * A PAYLOAD_SECRET-tel aláírva (HS256), ugyanaz a kulcs amit a Payload natív login is használ.
 */
async function issuePayloadToken(userId: number | string, email: string, role?: string): Promise<string> {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET hiányzik a környezetből')
  const key = new TextEncoder().encode(secret)
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ id: userId, email, collection: 'users', role: role ?? 'salon_owner' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(key)
}

/**
 * Sikeres OAuth után: user keresés/létrehozás. A payload-token cookie-t NEM itt
 * állítjuk be (Auth.js v5 `signIn` callback-ből a cookies().set nem kerül a response-ba),
 * hanem a `jwt` callbackben tároljuk az Auth.js session JWT-ben, és az `/api/auth/finalize`
 * route handler hajtja be a böngészőbe (cookie). Visszaad: a Payload user id-t és email-t.
 */
async function findOrCreatePayloadUser(
  email: string,
  name: string | null | undefined,
  image?: string | null,
): Promise<{ id: number | string; email: string } | null> {
  if (!email) return null
  const emailLc = email.toLowerCase()
  const payload = await getPayloadClient()

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: emailLc } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const doc = existing.docs[0]
    // A Google-profilképet csak akkor mentjük, ha a usernek még nincs avatarja —
    // így nem írjuk felül azt, amit ő maga állított be a Beállításokban.
    if (image && !(doc as { avatar_url?: string | null }).avatar_url) {
      await payload.update({
        collection: 'users',
        id: doc.id,
        data: { avatar_url: image },
        overrideAccess: true,
      }).catch(() => null)
    }
    return { id: doc.id, email: emailLc }
  }
  // Új user: random jelszót adunk (a user nem fogja használni). A role a séma defaultja
  // (salon_owner) — az onboarding-folyamatban tudja váltani.
  const password = crypto.randomBytes(32).toString('base64url')
  const created = await payload.create({
    collection: 'users',
    data: {
      email: emailLc,
      name: name || emailLc.split('@')[0],
      password,
      ...(image ? { avatar_url: image } : {}),
    },
    overrideAccess: true,
  })
  return { id: created.id, email: emailLc }
}

/** Export: a finalize route innen veszi a Payload-token kiállítást. */
export { issuePayloadToken, PAYLOAD_COOKIE, TOKEN_TTL_SECONDS }

export const { handlers, signIn, signOut, auth } = NextAuth({
  // trustHost: a reverse-proxy (nginx) mögött a kérés-host (schedulio.hu) megbízható.
  // Nélküle az Auth.js v5 "UntrustedHost" hibát dob prod-ban, és az auth-flow elhasal
  // → a felhasználó visszakerül a loginra. (Lokálisan is biztonságos: egyetlen ismert host.)
  trustHost: true,
  // Auth.js JWT session — ide tesszük a Payload user id-t és emailt, a finalize route
  // ebből generál payload-token cookie-t (a signIn callback-ből a cookies().set()
  // nem kerül a 302 response-ba — ezért megy a finalize közbeiktatása).
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // `prompt=select_account` → a Google MINDIG megmutatja a fiók-választót
      // (alapból `prompt=none` lenne, ami automatikusan az utoljára használt fiókba lépne be).
      authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
    }),
  ],
  callbacks: {
    /** Sikeres OAuth után megtaláljuk/létrehozzuk a Payload usert + a JWT-be tesszük az id-t. */
    async signIn({ user }) {
      if (!user.email) return false
      try {
        const pUser = await findOrCreatePayloadUser(user.email, user.name, user.image)
        if (!pUser) return false
        // A JWT callback olvassa ezt és teszi az Auth.js sessionjébe (lásd lent).
        ;(user as { payloadId?: string | number; payloadEmail?: string }).payloadId = pUser.id
        ;(user as { payloadId?: string | number; payloadEmail?: string }).payloadEmail = pUser.email
        return true
      } catch (e) {
        console.error('[auth] Payload signIn hiba:', e)
        return false
      }
    },
    /** A Payload userId-t (és emailt) eltároljuk az Auth.js JWT-ben, hogy a finalize route is lássa. */
    async jwt({ token, user }) {
      if (user) {
        const u = user as { payloadId?: string | number; payloadEmail?: string }
        if (u.payloadId) token.payloadId = u.payloadId
        if (u.payloadEmail) token.payloadEmail = u.payloadEmail
      }
      return token
    },
    /** A session callback átteszi a JWT-mezőket az auth() által visszaadott session-be. */
    async session({ session, token }) {
      ;(session as unknown as { payloadId?: string | number; payloadEmail?: string }).payloadId =
        (token as { payloadId?: string | number }).payloadId
      ;(session as unknown as { payloadId?: string | number; payloadEmail?: string }).payloadEmail =
        (token as { payloadEmail?: string }).payloadEmail
      return session
    },
    /**
     * Redirect callback: a Google-callback után MINDIG a /api/auth/finalize-ra megyünk.
     * Az átadjuk a hívó által kért végcélt `next` query-param-ben, hogy a finalize route
     * a cookie beállítása UTÁN oda irányítson (pl. /api/auth/complete-registration regisztrációból,
     * vagy alap esetben a role szerinti dashboard — ezt a finalize maga dönti el).
     */
    async redirect({ url, baseUrl }) {
      const FINALIZE = '/api/auth/finalize'
      try {
        const target = new URL(url, baseUrl)
        if (target.origin !== baseUrl) return `${baseUrl}${FINALIZE}`
        // Ha a Google-callback már a finalize-ra hív minket (vagy a callbackUrl is az),
        // ne pakoljuk vissza next-ként → végtelen loop lenne.
        if (target.pathname === FINALIZE) return `${baseUrl}${FINALIZE}`
        // Egyébként ha NEM a default "/" — átadjuk a végcélt next-ként a finalize-nak.
        if (target.pathname !== '/' && target.pathname !== '') {
          const u = new URL(FINALIZE, baseUrl)
          u.searchParams.set('next', target.pathname + target.search)
          return u.toString()
        }
      } catch {
        // fallback alább
      }
      // Default: a finalize maga eldönti a role alapján hova megy.
      return `${baseUrl}${FINALIZE}`
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
