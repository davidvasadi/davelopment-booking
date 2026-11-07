import { BRAND_NAME } from './brand'
import { emailLayout, COLORS, escapeHtml } from './emailLayout'
import { CODE_TTL_MINUTES, type CodePurpose } from './authCodes'

/** A belépési / regisztrációs kód levele (design 3.2): a tárgyban is a kód (értesítésből is beírható), a levélben
 *  nagyban, alatta meddig érvényes és hogy ha nem ő kérte, hagyja figyelmen kívül. */
export function loginCodeEmail(code: string, purpose: CodePurpose): { subject: string; html: string } {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  const title = purpose === 'register' ? 'Regisztráció megerősítése' : 'Egyszeri belépési kódod'
  const subject = `${spaced} — ${purpose === 'register' ? 'regisztrációs' : 'belépési'} kódod`
  const content = `<tr>
    <td style="background:${COLORS.surface};padding:34px 32px 6px">
      <h1 style="margin:0;font-size:22px;font-weight:300;color:${COLORS.text};letter-spacing:-0.3px">${escapeHtml(title)}</h1>
      ${codeBoxes(code)}
      <p style="margin:18px 0 0;color:${COLORS.textFaint};font-size:13px;line-height:1.6">${CODE_TTL_MINUTES} percig érvényes. Ha nem te kérted, nyugodtan hagyd figyelmen kívül — a fiókodhoz senki nem fér hozzá a kód nélkül.</p>
    </td>
  </tr>
  <tr><td style="background:${COLORS.surface};height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>`
  return { subject, html: emailLayout({ brandName: BRAND_NAME, content }) }
}

/** A kód ugyanúgy, mint a beíró mező (CodeInput): számjegyenként egy szürke négyzet. Táblázatban, hogy minden
 *  levelezőben (Outlook is) egy sorban maradjon; az egész egy koppintással kijelölhető. */
function codeBoxes(code: string): string {
  const cells = code.split('').map((d, i) =>
    `${i ? '<td style="width:6px;font-size:0;line-height:0">&nbsp;</td>' : ''}<td align="center" valign="middle" style="background:#EEEEEE;border-radius:14px;height:56px;font-size:26px;font-weight:300;color:${COLORS.text}">${d}</td>`,
  ).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:22px 0 0;table-layout:fixed;-webkit-user-select:all;user-select:all"><tr>${cells}</tr></table>`
}
