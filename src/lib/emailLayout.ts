/**
 * Közös email-vázlat (Schedulio arculat).
 *
 * Minden tranzakciós email (salon + restaurant) ezt használja, hogy egységes,
 * arculatos kinézetet adjon. A dizájn szándékosan „dark header / light body /
 * dark footer" — ez minden email-kliensben (Gmail, Outlook, Apple Mail)
 * megbízhatóan renderel, dark-mode media query nélkül.
 *
 * A logók PNG-k (SVG-t a legtöbb kliens nem jelenít meg); a `public/email/`
 * mappában generáltuk őket. Abszolút URL-lel hivatkozunk rájuk.
 */

import { t, type Locale } from './i18n'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const SCHEDULIO_URL = 'https://schedulio.hu'
const DAVELOPMENT_URL = 'https://davelopment.hu'

// Abszolút logó-URL-ek (email-kliensekhez kell a teljes URL).
const SCHEDULIO_WORDMARK = `${APP_URL}/email/schedulio-wordmark.png`
const DAVELOPMENT_WORDMARK = `${APP_URL}/email/davelopment-wordmark.png`

// Arculati színek.
const COLORS = {
  ink: '#09090b', // fejléc / footer háttér
  inkSoft: '#18181b', // kártyák a sötét sávban
  accent: '#0099ff', // Schedulio kék
  surface: '#ffffff', // body háttér
  muted: '#f4f4f5', // halvány kártya-háttér
  border: '#ececef',
  text: '#18181b',
  textSoft: '#52525b',
  textFaint: '#71717a',
  footerText: '#a1a1aa',
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escapes the template, then substitutes {{var}} with already-trusted values. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return escapeHtml(template).replace(/\{\{(\w+)\}\}/g, (_m, key: string) =>
    key in vars ? escapeHtml(vars[key]) : '',
  )
}

/** Plain-text subject substitution (no HTML). */
export function renderSubject(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? '')
}

/** Apple-stílusú, telt detail-ikonok (16×16 viewBox 0 0 24 24). */
export type DetailIcon =
  | 'calendar' | 'clock' | 'people' | 'pin' | 'user' | 'scissors' | 'mail' | 'note' | 'phone'

// Lucide vonalas ikonok (a hivatalos lucide path-ok).
const DETAIL_ICONS: Record<DetailIcon, string> = {
  // lucide: calendar
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  // lucide: clock
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  // lucide: users
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  // lucide: map-pin
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  // lucide: user
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  // lucide: scissors
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  // lucide: mail
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  // lucide: file-text
  note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  // lucide: phone
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
}

/** Egy ikonos részlet-sor: ikon + címke + érték (balra igazítva, egységes ritmus). */
export function infoRow(icon: DetailIcon, label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;vertical-align:top;width:34px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${COLORS.textFaint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle">${DETAIL_ICONS[icon]}</svg>
    </td>
    <td style="padding:10px 0;color:${COLORS.textSoft};font-size:13px;vertical-align:top">${label}</td>
    <td style="padding:10px 0;color:${COLORS.text};font-size:13px;font-weight:600;text-align:right;vertical-align:top">${value}</td>
  </tr>`
}

/**
 * A vendég cég brandingje az email tetején:
 * - borítókép + logó → a borítóra ráülő, lekerekített fehér logó-kártya (overlay)
 * - csak borító → borítókép banner
 * - csak logó → logó fehér sávon
 * - egyik sincs → cég neve igényes tipográfiával
 *
 * Az overlay-hatás email-kompatibilisen negatív margóval készül (a logó-kártya
 * felcsúszik a borító aljára). A nem támogató kliensek egyszerűen egymás alá
 * teszik — így is rendben néz ki.
 */
function brandHeader(opts: {
  brandName: string
  brandLogoUrl?: string | null
  brandCoverUrl?: string | null
}): string {
  const { brandName, brandLogoUrl, brandCoverUrl } = opts
  const alt = escapeHtml(brandName)

  const cover = brandCoverUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0">
        <img src="${brandCoverUrl}" alt="${alt}" width="540" style="width:100%;height:170px;object-fit:cover;display:block;border:0" />
      </td></tr>`
    : ''

  // Logó ráülve a borítóra: a logó a saját arányát/méretét tartja (semmi
  // A logó egy „üveges" (glass-szerű) kártyában ül, ráúszva a borítóra. Email-kliensek
  // nem támogatják a backdrop-blurt, ezért féláttetsző világos háttér + lekerekített
  // keret + finom árnyék adja az üveges benyomást (minden kliensben megbízható, inline).
  if (brandCoverUrl && brandLogoUrl) {
    return `${cover}
    <tr><td style="background:${COLORS.surface};padding:0 32px;text-align:center">
      <div style="display:inline-block;margin-top:-32px;padding:10px 18px;background:rgba(255,255,255,0.82);border:1px solid rgba(255,255,255,0.6);border-radius:16px;box-shadow:0 6px 20px rgba(9,9,11,0.18)">
        <img src="${brandLogoUrl}" alt="${alt}" height="48" style="height:48px;max-height:48px;max-width:200px;width:auto;object-fit:contain;display:block;border:0" />
      </div>
    </td></tr>`
  }

  // Csak borító (logó nélkül): a borító önmagában áll.
  if (brandCoverUrl) return cover

  // Borító nélkül: logó halvány, lekerekített kártyában (üveges-szerű, fehér sávon
  // a féláttetsző fehér nem látszana, ezért muted háttér), vagy cégnév szöveg.
  const logoOrName = brandLogoUrl
    ? `<div style="display:inline-block;padding:12px 20px;background:${COLORS.muted};border:1px solid ${COLORS.border};border-radius:16px">
        <img src="${brandLogoUrl}" alt="${alt}" height="48" style="height:48px;max-width:220px;object-fit:contain;display:block;border:0" />
      </div>`
    : `<p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${COLORS.text}">${alt}</p>`
  return `<tr><td style="background:${COLORS.surface};padding:32px 32px 0;text-align:center">${logoOrName}</td></tr>`
}

export interface EmailLayoutOptions {
  /** A vendég cég neve (étterem / szalon). */
  brandName: string
  /** A vendég cég feltöltött logójának abszolút URL-je, ha van. */
  brandLogoUrl?: string | null
  /** A vendég cég borítóképének abszolút URL-je, ha van. */
  brandCoverUrl?: string | null
  /** A fő tartalom (table-row-ok sorozata). */
  content: string
}

/** Teljes, arculatos email-váz. A `content` table-row-okból áll. */
export function emailLayout({ brandName, brandLogoUrl, brandCoverUrl, content }: EmailLayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#e8e8ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e8ec;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(9,9,11,0.12)">

        <!-- Brand header (vendég cég: borítókép + logó / név) -->
        ${brandHeader({ brandName, brandLogoUrl, brandCoverUrl })}

        <!-- Content -->
        ${content}

        <!-- Footer: kattintható Schedulio + davelopment logók egymás mellett -->
        <tr>
          <td style="background:${COLORS.ink};padding:32px;text-align:center">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto">
              <tr>
                <td style="padding:0 16px;vertical-align:middle">
                  <a href="${SCHEDULIO_URL}" style="text-decoration:none;display:block">
                    <img src="${SCHEDULIO_WORDMARK}" alt="Schedulio" height="26" style="height:26px;display:block;border:0" />
                  </a>
                </td>
                <td style="padding:0;vertical-align:middle">
                  <div style="width:1px;height:26px;background:#3f3f46;line-height:26px;font-size:0">&nbsp;</div>
                </td>
                <td style="padding:0 16px;vertical-align:middle">
                  <a href="${DAVELOPMENT_URL}" style="text-decoration:none;display:block">
                    <img src="${DAVELOPMENT_WORDMARK}" alt="davelopment" height="17" style="height:17px;display:block;border:0;opacity:0.85" />
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:18px 0 0;color:#52525b;font-size:11px">© ${new Date().getFullYear()} Schedulio · Minden jog fenntartva</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Apple SF Symbols-stílusú, telt (filled), lekerekített ikonok — színes körben.
 * Email-kompatibilis inline SVG (a React-ikonok itt nem renderelődnek).
 */
type HeroIcon = 'success' | 'cancel' | 'bell'

// Lucide vonalas ikonok (ugyanaz a készlet, mint az admin UI-ban).
const HERO_ICONS: Record<HeroIcon, { color: string; bg: string; path: string }> = {
  // lucide: circle-check
  success: {
    color: '#00a878',
    bg: '#00bb881a',
    path: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  },
  // lucide: circle-x
  cancel: {
    color: '#ef4444',
    bg: '#ef44441a',
    path: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  },
  // lucide: bell
  bell: {
    color: '#0099ff',
    bg: '#0099ff1a',
    path: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  },
}

/** Középre zárt fejléc-blokk: lucide ikon-kör + cím + alcím. */
export function heroBlock(opts: {
  icon: HeroIcon
  title: string
  subtitle: string
}): string {
  const i = HERO_ICONS[opts.icon]
  const svg = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${i.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle">${i.path}</svg>`
  return `<tr>
    <td style="background:${COLORS.surface};padding:28px 32px 0;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px">
        <tr><td style="width:56px;height:56px;border-radius:50%;background:${i.bg};text-align:center;vertical-align:middle">${svg}</td></tr>
      </table>
      <h1 style="margin:0 0 6px;font-size:23px;font-weight:800;color:${COLORS.text};letter-spacing:-0.6px">${opts.title}</h1>
      <p style="margin:0 auto;max-width:340px;color:${COLORS.textSoft};font-size:14px;line-height:1.5">${opts.subtitle}</p>
    </td>
  </tr>`
}

/** Halvány részlet-kártya az ikonos infoRow-okból. */
export function detailsCard(rows: string): string {
  return `<tr>
    <td style="background:${COLORS.surface};padding:24px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.muted};border-radius:14px;padding:8px 22px">
        ${rows}
      </table>
    </td>
  </tr>`
}

/** A felhasználó által megadott bevezető szöveg (escape-elt, {{var}} behelyettesítéssel). */
export function introBlock(intro: string | null | undefined, vars: Record<string, string>): string {
  const text = intro?.trim()
  if (!text) return ''
  const html = renderTemplate(text, vars).replace(/\n/g, '<br>')
  return `<tr>
    <td style="background:${COLORS.surface};padding:24px 32px 0">
      <p style="margin:0;color:${COLORS.text};font-size:14px;line-height:1.65;white-space:pre-line">${html}</p>
    </td>
  </tr>`
}

/** Lemondás-link sor (finom, elkülönítve). A vendég nyelvén. */
export function cancelBlock(cancelUrl: string | null, locale: Locale = 'hu'): string {
  if (!cancelUrl) return ''
  const link = `<a href="${cancelUrl}" style="color:${COLORS.textSoft};text-decoration:underline">${t(locale, 'email.cancelLink.label')}</a>`
  return `<tr>
    <td style="background:${COLORS.surface};padding:16px 32px 0;text-align:left">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">${t(locale, 'email.cancelLink.text', { link })}</p>
    </td>
  </tr>`
}

/**
 * Összevont „info" blokk a body alján: a foglalási feltétel-utalás ÉS a
 * kapcsolat/módosítás egy egységben, balra igazítva, EGYETLEN felső
 * elválasztóval (nincs kettéosztva). Üres részek kimaradnak; ha minden üres,
 * nem renderel.
 */
export function footerInfoBlock(opts: {
  hasTerms: boolean
  bookingUrl?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  /** Ha van, „Útvonaltervezés" gomb. Lehet cím vagy kész Maps-link. */
  directionsAddress?: string | null
  /** A vendég nyelve (a feltétel-utalás + kapcsolat-szövegekhez). */
  locale?: Locale
}): string {
  const { hasTerms, bookingUrl, phone, email, address, directionsAddress, locale = 'hu' } = opts
  const phoneClean = phone?.trim()
  const emailClean = email?.trim()
  const addressClean = address?.trim()
  const dirClean = directionsAddress?.trim()

  // Feltétel-utalás
  let termsPart = ''
  if (hasTerms) {
    const label = t(locale, 'email.footer.termsLink')
    const linkText = bookingUrl
      ? `<a href="${bookingUrl}" style="color:${COLORS.accent};text-decoration:underline;font-weight:600">${label}</a>`
      : `<strong style="color:${COLORS.textSoft}">${label}</strong>`
    termsPart = `<p style="margin:0;color:${COLORS.textSoft};font-size:13px;line-height:1.6">${t(locale, 'email.footer.termsText', { link: linkText })}</p>`
  }

  // Kapcsolat
  const lines: string[] = []
  if (phoneClean) {
    const tel = phoneClean.replace(/[^\d+]/g, '')
    lines.push(`<a href="tel:${tel}" style="color:${COLORS.accent};text-decoration:none;font-weight:600">${escapeHtml(phoneClean)}</a>`)
  }
  if (emailClean) {
    lines.push(`<a href="mailto:${escapeHtml(emailClean)}" style="color:${COLORS.accent};text-decoration:none">${escapeHtml(emailClean)}</a>`)
  }
  if (addressClean) {
    lines.push(`<span style="color:${COLORS.textSoft}">${escapeHtml(addressClean)}</span>`)
  }

  let directionsBtn = ''
  if (dirClean) {
    const mapsUrl = /^https?:\/\//i.test(dirClean)
      ? dirClean
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dirClean)}`
    const pinSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-3px;margin-right:7px"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`
    directionsBtn = `<div style="margin-top:14px">
      <a href="${mapsUrl}" style="display:inline-block;background:${COLORS.ink};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:999px">${pinSvg}${t(locale, 'email.footer.directions')}</a>
    </div>`
  }

  let contactPart = ''
  if (lines.length || directionsBtn) {
    const contactLine = lines.length
      ? `<p style="margin:0;color:${COLORS.textSoft};font-size:13px;line-height:1.8">${lines.join('<span style="color:' + COLORS.textFaint + '">&nbsp;·&nbsp;</span>')}</p>`
      : ''
    contactPart = `<p style="margin:0 0 6px;color:${COLORS.text};font-size:13px;font-weight:600">${t(locale, 'email.footer.contactTitle')}</p>${contactLine}${directionsBtn}`
  }

  if (!termsPart && !contactPart) return ''

  // A két rész egy blokkban, balra igazítva, egyetlen felső elválasztóval.
  const inner = [termsPart, contactPart].filter(Boolean).join('<div style="height:16px;line-height:16px;font-size:0">&nbsp;</div>')

  return `<tr>
    <td style="background:${COLORS.surface};padding:24px 32px 0;text-align:left">
      <div style="border-top:1px solid ${COLORS.border};padding-top:20px">
        ${inner}
      </div>
    </td>
  </tr>`
}

/** Záró térköz a body alján (a footer előtt). */
export function bottomSpacer(): string {
  return `<tr><td style="background:${COLORS.surface};height:32px;line-height:32px;font-size:0">&nbsp;</td></tr>`
}

export { COLORS }
