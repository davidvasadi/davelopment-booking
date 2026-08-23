import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { REG_SETUP_COOKIE, verifyRegistrationSetupToken } from '@/lib/registrationSetupToken'
import { generateVerifyEmailSubject, generateVerifyEmailHTML } from '@/lib/verifyEmailTemplate'

/**
 * POST /api/auth/finish-registration — a wizard UTOLSÓ lépése hívja (a "Kész vagyok"
 * képernyőn), a `/api/auth/register`-ben szándékosan KÉSLELTETETT megerősítő email tényleges
 * kiküldése. A `reg-setup-token` cookie-t (lásd `registrationSetupToken.ts`) használja — ez
 * bizonyítja, hogy a hívó tényleg a saját maga most létrehozott, MÉG nem megerősített fiókjáról
 * van szó, anélkül hogy általános bejelentkezést adna neki.
 */
export async function POST(_req: NextRequest) {
  const tokenValue = (await cookies()).get(REG_SETUP_COOKIE)?.value
  const setup = tokenValue ? await verifyRegistrationSetupToken(tokenValue) : null
  if (!setup) return NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 })

  const payload = await getPayloadClient()

  const user = (await payload
    .findByID({
      collection: 'users',
      id: setup.userId,
      overrideAccess: true,
      showHiddenFields: true,
    })
    .catch(() => null)) as unknown as { email?: string; _verificationToken?: string | null; _verified?: boolean } | null

  if (!user?.email) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  if (!user._verified) {
    const verifyToken = user._verificationToken ?? ''
    try {
      await payload.sendEmail({
        to: user.email,
        subject: generateVerifyEmailSubject(),
        html: generateVerifyEmailHTML(verifyToken),
      })
    } catch (e) {
      // NEM buktatjuk a wizardet — a fiók + token már létezik, a linket konzolra írjuk,
      // hogy egy átmeneti Resend-hiba esetén support-oldalról pótolható legyen.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
      console.error('[finish-registration] verify email send failed:', e)
      console.log(`[fallback] Email-megerősítő link (${user.email}): ${appUrl}/verify-email?token=${verifyToken}`)
    }
  }

  const res = NextResponse.json({ ok: true, email: user.email })
  // Egyszer-használatos — a wizardnek innentől nincs több dolga, a dashboard-hoz a valódi
  // bejelentkezés (email-megerősítés utáni login) kell.
  res.cookies.delete(REG_SETUP_COOKIE)
  return res
}
