import { BRAND_NAME } from './brand'
import { emailLayout, COLORS, escapeHtml } from './emailLayout'
import { CODE_TTL_MINUTES, type CodePurpose } from './authCodes'

/** A belépési / regisztrációs kód levele (design 3.2): a tárgyban is a kód (értesítésből is beírható), a levélben
 *  nagyban, alatta meddig érvényes és hogy ha nem ő kérte, hagyja figyelmen kívül. */
export function loginCodeEmail(code: string, purpose: CodePurpose): { subject: string; html: string } {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  const title = purpose === 'register' ? 'Regisztráció megerősítése' : `Belépés a ${BRAND_NAME}-ba`
  const subject = `${spaced} — ${purpose === 'register' ? 'regisztrációs' : 'belépési'} kódod`
  const content = `<tr>
    <td style="background:${COLORS.surface};padding:34px 32px 6px">
      <h1 style="margin:0;font-size:22px;font-weight:300;color:${COLORS.text};letter-spacing:-0.3px">${escapeHtml(title)}</h1>
      <div style="margin:22px 0 0;background:#EEEEEE;border-radius:16px;padding:20px 0;text-align:center;font-size:34px;font-weight:300;letter-spacing:8px;color:${COLORS.text}">${spaced}</div>
      <p style="margin:18px 0 0;color:${COLORS.textFaint};font-size:13px;line-height:1.6">${CODE_TTL_MINUTES} percig érvényes. Ha nem te kérted, nyugodtan hagyd figyelmen kívül — a fiókodhoz senki nem fér hozzá a kód nélkül.</p>
    </td>
  </tr>
  <tr><td style="background:${COLORS.surface};height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>`
  return { subject, html: emailLayout({ brandName: BRAND_NAME, content }) }
}
