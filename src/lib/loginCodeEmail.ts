import { BRAND_NAME } from './brand'
import { emailLayout, COLORS, escapeHtml } from './emailLayout'
import { keepButton } from './emailDark'
import { CODE_TTL_MINUTES, type CodePurpose } from './authCodes'

/** A belépési / regisztrációs kód levele (design 3.2): a tárgyban is a kód (értesítésből is beírható), a levélben
 *  nagyban, alatta meddig érvényes és hogy ha nem ő kérte, hagyja figyelmen kívül. */
/** `email`: belépésnél a kód alá egy „Belépés” gomb kerül — a belépőoldalt nyitja kitöltött e-maillel és kóddal, és ott
 *  egy koppintás a belépés. Szándékosan NEM léptet be magától: a levelezők linkellenőrzői előre megnyitják a linkeket,
 *  és egy automatikus belépés elhasználná a kódot. */
export function loginCodeEmail(code: string, purpose: CodePurpose, email?: string): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const loginUrl = purpose === 'login' && email ? `${appUrl}/login?email=${encodeURIComponent(email)}&code=${code}` : null
  const title = purpose === 'register' ? 'Regisztráció megerősítése' : purpose === 'secondary' ? 'Másodlagos e-mail megerősítése' : 'Egyszeri belépési kódod'
  const subject = `${code} — ${purpose === 'register' ? 'regisztrációs' : purpose === 'secondary' ? 'megerősítő' : 'belépési'} kódod`
  const content = `<tr>
    <td style="background:${COLORS.surface};padding:34px 32px 6px">
      <h1 style="margin:0;font-size:22px;font-weight:300;color:${COLORS.text};letter-spacing:-0.3px">${escapeHtml(title)}</h1>
      ${codeBoxes(code)}
      ${loginUrl ? `<div style="margin:16px 0 0">${keepButton({ href: loginUrl, bg: COLORS.ink, label: 'Belépés', font: 'color:#FFFFFF;font-size:14px;font-weight:600', pad: '13px 26px' })}</div>` : ''}
      <p style="margin:18px 0 0;color:${COLORS.textFaint};font-size:13px;line-height:1.6">${CODE_TTL_MINUTES} percig érvényes. Ha nem te kérted, nyugodtan hagyd figyelmen kívül — a fiókodhoz senki nem fér hozzá a kód nélkül.</p>
    </td>
  </tr>
  <tr><td style="background:${COLORS.surface};height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>`
  return { subject, html: emailLayout({ brandName: BRAND_NAME, content }) }
}

/** A kód EGY szövegként, egy szürke dobozban, széthúzott betűközzel: így egy koppintással / hosszan nyomva az egész
 *  kijelölődik és másolható, és a Gmail / iOS Mail felismeri ellenőrző kódként („Kód másolása” gomb az értesítésben,
 *  automatikus kitöltés). E-mailben valódi másolás-gomb nem lehet (nincs JavaScript); a számjegyenkénti cellákat a
 *  levelezők nem ismerték fel, és csak egy számjegyet lehetett kijelölni. */
function codeBoxes(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:22px 0 0"><tr><td align="center" valign="middle" style="background:#EEEEEE;border-radius:16px;padding:16px 8px"><span style="font-size:32px;font-weight:400;letter-spacing:10px;color:${COLORS.text};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;-webkit-user-select:all;user-select:all">${code}</span></td></tr></table>`
}
