import { escapeHtml } from './emailLayout'
import type { VoucherDesign } from './voucherDesign'

/**
 * Az ajándékutalvány a levélben (design: E-mailek › Vendégnek › Ajándékutalvány): a jegy KÉPKÉNT (api/vouchers/card —
 * a típus színe és képe, összeg, címzett, üzenet, lejárat, QR, kód), kattintható (az utalvány oldala: nagyban, nyomtatás);
 * alatta a kód / összeg / érvényesség szövegként is, gomb az utalvány oldalára és egy mondat a beváltásról.
 */

/** Az utalvány-levél törzse (vásárlónak és címzettnek, szalon és étterem közös): fejléc, a jegy, a fontos adatok,
 *  gomb az utalvány oldalára (ott is megmutatható / nyomtatható) és egy mondat a beváltásról. */
export function voucherEmailRows(o: {
  appUrl: string
  forRecipient: boolean
  restaurant?: boolean
  bizName: string
  bizSlug: string
  bizImg?: string | null
  design?: VoucherDesign | null
  photo?: string | null
  code: string
  amount: string
  expiresAt?: string | null
  purchaserName: string
  recipientName?: string | null
  message?: string | null
  qrFallback?: string | null
}, parts: { heroBlock: (h: { icon: 'success'; title: string; subtitle: string }) => string; detailsCard: (rows: string) => string; infoRow: (icon: 'sparkle' | 'note' | 'calendar' | 'mail', label: string, value: string) => string; surface: string }): string {
  const expires = o.expiresAt ? new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(o.expiresAt)) : ''
  const where = o.restaurant ? 'az étteremben' : 'a szalonban'
  const subtitle = o.forRecipient
    ? `${escapeHtml(o.purchaserName)} ajándékutalvánnyal lepett meg — ${escapeHtml(o.bizName)}-nél váltható be.`
    : `Köszönjük a vásárlást! Az utalványt alább találod — továbbküldheted, kinyomtathatod, vagy megmutathatod a telefonodon.`
  const url = `${o.appUrl}/${o.bizSlug}/voucher/${encodeURIComponent(o.code)}`
  // a jegy KÉPKÉNT (api/vouchers/card) — a Gmail sötét módja nem nyúl hozzá; kicsinyítve, hogy minden telefonon
  // elférjen, és kattintható: az utalvány oldalára visz, ahol nagyban megmutatható / kinyomtatható
  const ticket = `<a href="${url}" target="_blank" style="display:block;text-decoration:none"><img src="${o.appUrl}/api/vouchers/card/${encodeURIComponent(o.code)}.png" alt="Ajándékutalvány — ${escapeHtml(o.amount)} · ${escapeHtml(o.code)}" width="420" style="display:block;width:100%;max-width:420px;height:auto;margin:0 auto;border:0" /></a>
    <p style="margin:8px 0 0;text-align:center;color:#9A9A9A;font-size:12px">Koppints a jegyre a teljes méretért és a nyomtatáshoz.</p>`
  return `
    ${parts.heroBlock({ icon: 'success', title: o.forRecipient ? 'Ajándékutalványt kaptál!' : 'Ajándékutalvány megvásárolva', subtitle })}
    <tr><td style="background:${parts.surface};padding:22px 28px 0">${ticket}</td></tr>
    ${parts.detailsCard([
      parts.infoRow('sparkle', 'Kód', escapeHtml(o.code)),
      parts.infoRow('note', 'Összeg', escapeHtml(o.amount)),
      ...(expires ? [parts.infoRow('calendar', 'Érvényes', `${escapeHtml(expires)}-ig`)] : []),
      ...(o.message && !o.design ? [parts.infoRow('mail', 'Üzenet', escapeHtml(o.message))] : []),
    ].join(''))}
    <tr><td style="background:${parts.surface};padding:22px 28px 0;text-align:center">
      <a href="${url}" style="display:inline-block;background:#FFD85F;color:#3B3B3B;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:999px">Utalvány megnyitása</a>
      <p style="margin:12px 0 0;color:#9A9A9A;font-size:12px;line-height:1.5">Mutasd fel a QR-kódot ${where}, vagy add meg a kódot online foglaláskor.</p>
    </td></tr>`
}
