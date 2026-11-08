import { escapeHtml } from './emailLayout'
import type { VoucherDesign } from './voucherDesign'
import { voucherAssetSig } from './voucherAssetSig'
import { vtxt } from './voucherText'

/**
 * Az ajándékutalvány a levélben (design: E-mailek › Vendégnek › Ajándékutalvány): a jegy KÉPKÉNT (api/vouchers/card —
 * a típus színe és képe, összeg, címzett, lejárat, QR, kód), kattintható (az utalvány oldala: nagyban, nyomtatás);
 * alatta a kód / összeg / érvényesség / üzenet szövegként is, gomb az utalvány oldalára és egy mondat a beváltásról.
 * A levél az utalvány nyelvén megy (amit kiállításkor / vásárláskor választottak) — mint a jegy.
 */

export type VoucherMailLang = 'hu' | 'en' | 'de' | 'fr' | 'es' | 'it'

const T: Record<VoucherMailLang, {
  subjectBought: (b: string) => string
  subjectGift: (b: string) => string
  titleBought: string
  titleGift: string
  subBought: string
  subGift: (from: string, b: string) => string
  code: string
  amount: string
  valid: string
  validUntil: (d: string) => string
  message: string
  open: string
  tap: string
  how: (where: string) => string
  /** a vásárlónak: az utalvány számlája áfa nélküli, az ÁFA a beváltáskor keletkezik */
  vat: string
}> = {
  hu: {
    subjectBought: (b) => `Ajándékutalvány megvásárolva – ${b}`, subjectGift: (b) => `Ajándékutalványt kaptál – ${b}`,
    titleBought: 'Ajándékutalvány megvásárolva', titleGift: 'Ajándékutalványt kaptál!',
    subBought: 'Köszönjük a vásárlást! Az utalványt alább találod — továbbküldheted, kinyomtathatod, vagy megmutathatod a telefonodon.',
    subGift: (f, b) => `${f} ajándékutalvánnyal lepett meg — ${b}-nél váltható be.`,
    code: 'Kód', amount: 'Összeg', valid: 'Érvényes', validUntil: (d) => `${d}-ig`, message: 'Üzenet',
    open: 'Utalvány megnyitása', tap: 'Koppints a jegyre a teljes méretért és a nyomtatáshoz.',
    how: (w) => `Mutasd fel a QR-kódot ${w}, vagy add meg a kódot online foglaláskor.`,
    vat: 'Az utalványról kapott számla áfa nélküli bizonylat (az ÁFA tv. hatályán kívül) — az ÁFA a beváltáskor, a szolgáltatás számláján keletkezik.',
  },
  en: {
    subjectBought: (b) => `Gift voucher purchased – ${b}`, subjectGift: (b) => `You've received a gift voucher – ${b}`,
    titleBought: 'Gift voucher purchased', titleGift: "You've received a gift voucher!",
    subBought: 'Thank you for your purchase! Your voucher is below — forward it, print it, or show it on your phone.',
    subGift: (f, b) => `${f} has sent you a gift voucher — redeemable at ${b}.`,
    code: 'Code', amount: 'Amount', valid: 'Valid', validUntil: (d) => `until ${d}`, message: 'Message',
    open: 'Open voucher', tap: 'Tap the voucher for full size and printing.',
    how: (w) => `Show the QR code ${w}, or enter the code when booking online.`,
    vat: 'The invoice for the voucher is issued without VAT (outside the scope of VAT) — VAT is charged on redemption, on the invoice for the service.',
  },
  de: {
    subjectBought: (b) => `Geschenkgutschein gekauft – ${b}`, subjectGift: (b) => `Du hast einen Geschenkgutschein erhalten – ${b}`,
    titleBought: 'Geschenkgutschein gekauft', titleGift: 'Du hast einen Geschenkgutschein erhalten!',
    subBought: 'Danke für deinen Einkauf! Deinen Gutschein findest du unten — leite ihn weiter, drucke ihn aus oder zeige ihn auf dem Handy.',
    subGift: (f, b) => `${f} hat dir einen Geschenkgutschein geschenkt — einlösbar bei ${b}.`,
    code: 'Code', amount: 'Betrag', valid: 'Gültig', validUntil: (d) => `bis ${d}`, message: 'Nachricht',
    open: 'Gutschein öffnen', tap: 'Tippe auf den Gutschein für die volle Größe und zum Drucken.',
    how: (w) => `Zeige den QR-Code ${w} vor oder gib den Code bei der Online-Buchung ein.`,
    vat: 'Die Rechnung über den Gutschein wird ohne MwSt. ausgestellt (nicht steuerbar) — die MwSt. fällt bei der Einlösung auf der Rechnung der Leistung an.',
  },
  fr: {
    subjectBought: (b) => `Bon cadeau acheté – ${b}`, subjectGift: (b) => `Tu as reçu un bon cadeau – ${b}`,
    titleBought: 'Bon cadeau acheté', titleGift: 'Tu as reçu un bon cadeau !',
    subBought: 'Merci pour ton achat ! Ton bon est ci-dessous — transfère-le, imprime-le ou montre-le sur ton téléphone.',
    subGift: (f, b) => `${f} t'offre un bon cadeau — utilisable chez ${b}.`,
    code: 'Code', amount: 'Montant', valid: 'Valable', validUntil: (d) => `jusqu'au ${d}`, message: 'Message',
    open: 'Ouvrir le bon', tap: 'Touche le bon pour l’afficher en grand et l’imprimer.',
    how: (w) => `Présente le QR code ${w}, ou saisis le code lors de la réservation en ligne.`,
    vat: 'La facture du bon est émise sans TVA (hors champ de la TVA) — la TVA est due lors de l’utilisation, sur la facture de la prestation.',
  },
  es: {
    subjectBought: (b) => `Tarjeta regalo comprada – ${b}`, subjectGift: (b) => `Has recibido una tarjeta regalo – ${b}`,
    titleBought: 'Tarjeta regalo comprada', titleGift: '¡Has recibido una tarjeta regalo!',
    subBought: '¡Gracias por tu compra! Tu tarjeta está abajo: reenvíala, imprímela o muéstrala en tu móvil.',
    subGift: (f, b) => `${f} te ha regalado una tarjeta regalo, canjeable en ${b}.`,
    code: 'Código', amount: 'Importe', valid: 'Válida', validUntil: (d) => `hasta el ${d}`, message: 'Mensaje',
    open: 'Abrir tarjeta', tap: 'Toca la tarjeta para verla en grande e imprimirla.',
    how: (w) => `Muestra el código QR ${w} o introduce el código al reservar en línea.`,
    vat: 'La factura de la tarjeta se emite sin IVA (no sujeta) — el IVA se aplica al canjearla, en la factura del servicio.',
  },
  it: {
    subjectBought: (b) => `Buono regalo acquistato – ${b}`, subjectGift: (b) => `Hai ricevuto un buono regalo – ${b}`,
    titleBought: 'Buono regalo acquistato', titleGift: 'Hai ricevuto un buono regalo!',
    subBought: 'Grazie per l’acquisto! Trovi il buono qui sotto: inoltralo, stampalo o mostralo sul telefono.',
    subGift: (f, b) => `${f} ti ha regalato un buono, utilizzabile presso ${b}.`,
    code: 'Codice', amount: 'Importo', valid: 'Valido', validUntil: (d) => `fino al ${d}`, message: 'Messaggio',
    open: 'Apri il buono', tap: 'Tocca il buono per vederlo a tutta grandezza e stamparlo.',
    how: (w) => `Mostra il codice QR ${w} o inserisci il codice prenotando online.`,
    vat: 'La fattura del buono è emessa senza IVA (fuori campo IVA) — l’IVA si applica all’utilizzo, sulla fattura del servizio.',
  },
}

export const voucherMailLang = (l?: string | null): VoucherMailLang => (l && l in T ? (l as VoucherMailLang) : 'hu')

/** A levél tárgya az utalvány nyelvén. */
export function voucherMailSubject(lang: string | null | undefined, forRecipient: boolean, bizName: string): string {
  const L = T[voucherMailLang(lang)]
  return forRecipient ? L.subjectGift(bizName) : L.subjectBought(bizName)
}

/** Az utalvány-levél törzse (vásárlónak és címzettnek, szalon és étterem közös): fejléc, a jegy, a fontos adatok,
 *  gomb az utalvány oldalára (ott is megmutatható / nyomtatható), egy mondat a beváltásról, a vásárlónak az ÁFA-mondat. */
export function voucherEmailRows(o: {
  appUrl: string
  forRecipient: boolean
  restaurant?: boolean
  lang?: string | null
  bizName: string
  bizSlug: string
  code: string
  amount: string
  expiresAt?: string | null
  purchaserName: string
  message?: string | null
}, parts: { heroBlock: (h: { icon: 'success'; title: string; subtitle: string }) => string; detailsCard: (rows: string) => string; infoRow: (icon: 'sparkle' | 'note' | 'calendar' | 'mail', label: string, value: string) => string; surface: string }): string {
  const lang = voucherMailLang(o.lang)
  const L = T[lang]
  const where = o.restaurant ? vtxt(lang).rest : vtxt(lang).salon
  const expires = o.expiresAt ? new Intl.DateTimeFormat(lang === 'hu' ? 'hu-HU' : lang, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(o.expiresAt)) : ''
  const subtitle = o.forRecipient ? L.subGift(escapeHtml(o.purchaserName), escapeHtml(o.bizName)) : L.subBought
  const url = `${o.appUrl}/${o.bizSlug}/voucher/${encodeURIComponent(o.code)}`
  // a jegy KÉPKÉNT (api/vouchers/card) — a Gmail sötét módja nem nyúl hozzá; kicsinyítve, hogy minden telefonon
  // elférjen, és kattintható: az utalvány oldalára visz, ahol nagyban megmutatható / kinyomtatható
  const ticket = `<a href="${url}" target="_blank" style="display:block;text-decoration:none"><img src="${o.appUrl}/api/vouchers/card/${encodeURIComponent(o.code)}.png?s=${voucherAssetSig(o.code)}" alt="${escapeHtml(vtxt(lang).gift)} — ${escapeHtml(o.amount)} · ${escapeHtml(o.code)}" width="420" style="display:block;width:100%;max-width:420px;height:auto;margin:0 auto;border:0" /></a>
    <p style="margin:8px 0 0;text-align:center;color:#9A9A9A;font-size:12px">${escapeHtml(L.tap)}</p>`
  return `
    ${parts.heroBlock({ icon: 'success', title: o.forRecipient ? L.titleGift : L.titleBought, subtitle })}
    <tr><td style="background:${parts.surface};padding:22px 28px 0">${ticket}</td></tr>
    ${parts.detailsCard([
      parts.infoRow('sparkle', L.code, escapeHtml(o.code)),
      parts.infoRow('note', L.amount, escapeHtml(o.amount)),
      ...(expires ? [parts.infoRow('calendar', L.valid, escapeHtml(L.validUntil(expires)))] : []),
      ...(o.message ? [parts.infoRow('mail', L.message, escapeHtml(o.message))] : []),
    ].join(''))}
    <tr><td style="background:${parts.surface};padding:22px 28px 0;text-align:center">
      <a href="${url}" style="display:inline-block;background:#FFD85F;color:#3B3B3B;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:999px">${escapeHtml(L.open)}</a>
      <p style="margin:12px 0 0;color:#9A9A9A;font-size:12px;line-height:1.5">${escapeHtml(L.how(where))}</p>
      ${o.forRecipient ? '' : `<p style="margin:10px auto 0;max-width:440px;color:#9A9A9A;font-size:11px;line-height:1.5">${escapeHtml(L.vat)}</p>`}
    </td></tr>`
}
