import { BRAND_NAME } from '@/lib/brand'
import { emailLayout, COLORS } from '@/lib/emailLayout'

/**
 * Email-megerősítő levél tartalma — megosztva a Payload `verify` collection-configja
 * (Users.ts, amikor Payload MAGA küldi, pl. jövőbeli más create-hívásoknál) ÉS a
 * `/api/auth/register` route között, ami `disableVerificationEmail: true`-val hozza létre
 * a usert, és MAGA küldi a levelet, hogy egy Resend-hiba (rossz cím, rate-limit, hálózat)
 * NE vigye el magával a teljes regisztrációt — lásd a route indoklását.
 */
export function generateVerifyEmailSubject() {
  return `Erősítsd meg az email-címed — ${BRAND_NAME}`
}

export function generateVerifyEmailHTML(token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const verifyUrl = `${appUrl}/verify-email?token=${token}`

  const checkSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${COLORS.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9 22 2Z"/></svg>`
  const hero = `<tr>
    <td style="background:${COLORS.surface};padding:34px 32px 4px;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px">
        <tr><td style="width:56px;height:56px;border-radius:18px;background:rgba(255,216,95,0.32);text-align:center;vertical-align:middle">${checkSvg}</td></tr>
      </table>
      <h1 style="margin:0 0 7px;font-size:27px;font-weight:300;color:${COLORS.text};letter-spacing:-0.6px;line-height:1.1">Erősítsd meg az email-címed</h1>
      <p style="margin:0 auto;max-width:340px;color:${COLORS.textFaint};font-size:14px;line-height:1.55">Már csak egy kattintás, és aktiválódik a fiókod.</p>
    </td>
  </tr>`

  const cta = `<tr>
    <td style="background:${COLORS.surface};padding:24px 32px 4px;text-align:center">
      <a href="${verifyUrl}" style="display:inline-block;background:${COLORS.accent};color:#3B3B3B;font-size:14px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:999px;letter-spacing:-0.1px">Email megerősítése</a>
    </td>
  </tr>
  <tr>
    <td style="background:${COLORS.surface};padding:16px 32px 0;text-align:center">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">Ha nem te regisztráltál, nyugodtan hagyd figyelmen kívül ezt az emailt.</p>
    </td>
  </tr>
  <tr><td style="background:${COLORS.surface};height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>`

  return emailLayout({
    brandName: BRAND_NAME,
    header: hero,
    content: cta,
  })
}
