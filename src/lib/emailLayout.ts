/**
 * Közös email-vázlat (Schedulio arculat) — v2.
 *
 * Dizájnfilozófia: sötét külső háttér (glassmorphism-kontextus), fehér floating kártya,
 * belül dark hero szekció (logó + státusz + dátum üveg pillben), majd clean white body.
 * Minden tranzakciós email (salon + restaurant) ezt használja.
 *
 * Email-kliens kompat.: csak inline style, table-layout, rgba() bg → Gmail, Apple Mail,
 * Outlook 2016+, mobile. backdrop-filter-t NEM használunk (Outlook-ban nem megy), a
 * glass-hatást rgba() + border adja.
 */

import { t, type Locale } from './i18n'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SCHEDULIO_URL = 'https://schedulio.hu'
const DAVELOPMENT_URL = 'https://davelopment.hu'

const SCHEDULIO_WORDMARK = `${APP_URL}/email/schedulio-wordmark.png`
const DAVELOPMENT_WORDMARK = `${APP_URL}/email/davelopment-wordmark.png`

const COLORS = {
  // Card body
  surface:      '#ffffff',
  muted:        '#f8f8fc',
  border:       '#e9e9eb',
  text:         '#18181b',
  textSoft:     '#52525b',
  textFaint:    '#8b8b8f',
  // Accents
  accent:       '#ecf95a',   // Schedulio yellow
  ink:          '#09090b',   // header/footer strip
  footerText:   '#71717a',
  // Glass date pill (on white bg)
  glassBg:      'rgba(14,107,255,0.05)',
  glassBorder:  'rgba(14,107,255,0.15)',
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return escapeHtml(template).replace(/\{\{(\w+)\}\}/g, (_m, key: string) =>
    key in vars ? escapeHtml(vars[key]) : '',
  )
}

export function renderSubject(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? '')
}

// ── Ikon-készletek ──────────────────────────────────────────────────────────────

export type DetailIcon =
  | 'calendar' | 'clock' | 'people' | 'pin' | 'user' | 'scissors' | 'mail' | 'note' | 'phone'

const DETAIL_ICONS: Record<DetailIcon, string> = {
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  clock:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  people:   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  pin:      '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  user:     '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  mail:     '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  note:     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  phone:    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
}

type HeroIcon = 'success' | 'cancel' | 'bell'
const HERO_ICONS: Record<HeroIcon, { color: string; bg: string; path: string }> = {
  success: {
    color: '#22c55e',
    bg:    'rgba(34,197,94,0.18)',
    path:  '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  },
  cancel: {
    color: '#ef4444',
    bg:    'rgba(239,68,68,0.18)',
    path:  '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  },
  bell: {
    color: '#ecf95a',
    bg:    'rgba(236,249,90,0.15)',
    path:  '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  },
}

// ── Dátum-formázás ──────────────────────────────────────────────────────────────

const LOCALE_TAG: Record<string, string> = {
  hu: 'hu-HU', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
}

export function formatBookingDate(isoDate: string, locale: Locale): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(LOCALE_TAG[locale] ?? 'hu-HU', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
}

// ── Egy ikonos részlet-sor ──────────────────────────────────────────────────────

export function infoRow(icon: DetailIcon, label: string, value: string): string {
  const svg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${COLORS.textFaint}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle">${DETAIL_ICONS[icon]}</svg>`
  const borderCell = `border-bottom:1px solid ${COLORS.border}`
  return `<tr>
    <td style="${borderCell};padding:13px 0 13px 20px;vertical-align:middle;width:28px">${svg}</td>
    <td style="${borderCell};padding:13px 10px;color:${COLORS.textSoft};font-size:13px;vertical-align:middle">${label}</td>
    <td style="${borderCell};padding:13px 20px 13px 0;color:${COLORS.text};font-size:13px;font-weight:600;text-align:right;vertical-align:middle;white-space:nowrap">${value}</td>
  </tr>`
}

// ── Detail kártya (borderes, fehér) ────────────────────────────────────────────

export function detailsCard(rows: string): string {
  return `<tr>
    <td style="background:${COLORS.surface};padding:24px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;border-collapse:collapse">
        ${rows}
      </table>
    </td>
  </tr>`
}

// ── Visszaigazoló email hero:
//    1. cover image (ha van) teljes szélességben
//    2. vékony fekete brand-sáv (logó vagy brand név)
//    3. fehér hero terület: státusz-ikon + cím + köszöntés + glass dátum-pill
//    G-Shock-stílus: fehér kártya, dark sávok fent/lent.

export function brandHeroBlock(opts: {
  brandName: string
  brandLogoUrl?: string | null
  brandCoverUrl?: string | null
  icon: HeroIcon
  title: string
  subtitle: string
  formattedDate?: string | null
  time?: string | null
}): string {
  const { brandName, brandLogoUrl, brandCoverUrl, icon, title, subtitle, formattedDate, time } = opts
  const def = HERO_ICONS[icon]
  const iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${def.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${def.path}</svg>`
  const alt = escapeHtml(brandName)

  // 1. Cover image (optional)
  const coverRow = brandCoverUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0">
        <img src="${brandCoverUrl}" alt="" width="560" style="width:100%;max-height:200px;object-fit:cover;display:block;border:0" />
      </td></tr>`
    : ''

  // 2. Vékony fekete brand-sáv
  const logoInk = brandLogoUrl
    ? `<img src="${brandLogoUrl}" alt="${alt}" height="26" style="height:26px;max-width:160px;object-fit:contain;border:0;display:inline-block" />`
    : `<span style="font-size:14px;font-weight:700;color:#ffffff;letter-spacing:-0.2px">${alt}</span>`
  const brandStrip = `<tr>
    <td style="background:${COLORS.ink};padding:14px 32px;text-align:center">
      ${logoInk}
    </td>
  </tr>`

  // 3. Glass dátum-pill (fehér háttéren, kékes glass-hatással)
  const datePill = (formattedDate && time && icon !== 'cancel')
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:22px auto 0">
        <tr>
          <td style="padding:11px 22px;background:${COLORS.glassBg};border:1px solid ${COLORS.glassBorder};border-radius:999px;text-align:center">
            <span style="color:${COLORS.textSoft};font-size:12px;white-space:nowrap">${escapeHtml(formattedDate)}</span>
            <span style="color:${COLORS.border};margin:0 8px">·</span>
            <span style="color:${COLORS.text};font-size:13px;font-weight:700;letter-spacing:-0.2px;white-space:nowrap">${escapeHtml(time)}</span>
          </td>
        </tr>
      </table>`
    : ''

  // 4. Fehér hero szekció
  const heroSection = `<tr>
    <td style="background:${COLORS.surface};padding:32px 32px 28px;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px">
        <tr>
          <td style="width:52px;height:52px;border-radius:50%;background:${def.bg};text-align:center;vertical-align:middle">
            ${iconSvg}
          </td>
        </tr>
      </table>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:${COLORS.text};letter-spacing:-0.5px">${escapeHtml(title)}</h1>
      <p style="margin:0 auto;max-width:300px;color:${COLORS.textSoft};font-size:14px;line-height:1.5">${escapeHtml(subtitle)}</p>
      ${datePill}
    </td>
  </tr>`

  return `${coverRow}${brandStrip}${heroSection}`
}

// ── brandHeader: notify/cancel emailekhez (ugyanolyan thin dark strip stílus) ──

function brandHeader(opts: {
  brandName: string
  brandLogoUrl?: string | null
  brandCoverUrl?: string | null
}): string {
  const { brandName, brandLogoUrl, brandCoverUrl } = opts
  const alt = escapeHtml(brandName)

  const coverRow = brandCoverUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0">
        <img src="${brandCoverUrl}" alt="${alt}" width="560" style="width:100%;max-height:200px;object-fit:cover;display:block;border:0" />
      </td></tr>`
    : ''

  const logoInk = brandLogoUrl
    ? `<img src="${brandLogoUrl}" alt="${alt}" height="26" style="height:26px;max-width:160px;object-fit:contain;border:0;display:inline-block" />`
    : `<span style="font-size:14px;font-weight:700;color:#ffffff;letter-spacing:-0.2px">${alt}</span>`

  return `${coverRow}<tr><td style="background:${COLORS.ink};padding:14px 32px;text-align:center">${logoInk}</td></tr>`
}

export function heroBlock(opts: { icon: HeroIcon; title: string; subtitle: string }): string {
  const def = HERO_ICONS[opts.icon]
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${def.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${def.path}</svg>`
  return `<tr>
    <td style="background:${COLORS.surface};padding:28px 32px 0;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px">
        <tr><td style="width:54px;height:54px;border-radius:50%;background:${def.bg};text-align:center;vertical-align:middle">${svg}</td></tr>
      </table>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:${COLORS.text};letter-spacing:-0.5px">${opts.title}</h1>
      <p style="margin:0 auto;max-width:340px;color:${COLORS.textSoft};font-size:14px;line-height:1.5">${opts.subtitle}</p>
    </td>
  </tr>`
}

// ── Bevezető szöveg ─────────────────────────────────────────────────────────────

export function introBlock(intro: string | null | undefined, vars: Record<string, string>): string {
  const text = intro?.trim()
  if (!text) return ''
  const html = renderTemplate(text, vars).replace(/\n/g, '<br>')
  return `<tr>
    <td style="background:${COLORS.surface};padding:22px 28px 0">
      <p style="margin:0;color:${COLORS.text};font-size:14px;line-height:1.65">${html}</p>
    </td>
  </tr>`
}

// ── Naptárba mentés gomb ────────────────────────────────────────────────────────

export function calendarBlock(opts: {
  title: string
  date: string
  startTime: string
  endTime: string
  location?: string | null
  description?: string | null
  locale?: Locale
}): string {
  const { title, date, startTime, endTime, location, description, locale = 'hu' } = opts
  const [y, m, d] = date.split('-')
  const [sh, sm] = startTime.split(':')
  const [eh, em] = endTime.split(':')
  const dtStart = `${y}${m}${d}T${sh}${sm}00`
  const dtEnd   = `${y}${m}${d}T${eh}${em}00`
  const gcUrl =
    'https://calendar.google.com/calendar/render' +
    '?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${dtStart}/${dtEnd}` +
    '&ctz=Europe/Budapest' +
    (location    ? `&location=${encodeURIComponent(location)}`    : '') +
    (description ? `&details=${encodeURIComponent(description)}`  : '')

  const calSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px;margin-right:7px"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`

  return `<tr>
    <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
      <a href="${gcUrl}" style="display:inline-block;background:${COLORS.accent};color:#09090b;font-size:13px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:999px;letter-spacing:-0.1px">${calSvg}${escapeHtml(t(locale, 'email.addToCalendar'))}</a>
      <p style="margin:10px 0 0;color:${COLORS.textFaint};font-size:11px">${escapeHtml(t(locale, 'email.ics.hint'))}</p>
    </td>
  </tr>`
}

// ── Lemondás-link ───────────────────────────────────────────────────────────────

export function cancelBlock(cancelUrl: string | null, locale: Locale = 'hu'): string {
  if (!cancelUrl) return ''
  const link = `<a href="${cancelUrl}" style="color:${COLORS.textSoft};text-decoration:underline">${t(locale, 'email.cancelLink.label')}</a>`
  return `<tr>
    <td style="background:${COLORS.surface};padding:14px 28px 0;text-align:center">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">${t(locale, 'email.cancelLink.text', { link })}</p>
    </td>
  </tr>`
}

// ── Footer info blokk (feltételek + kapcsolat) ──────────────────────────────────

export function footerInfoBlock(opts: {
  hasTerms: boolean
  bookingUrl?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  directionsAddress?: string | null
  locale?: Locale
}): string {
  const { hasTerms, bookingUrl, phone, email, address, directionsAddress, locale = 'hu' } = opts
  const phoneClean = phone?.trim()
  const emailClean = email?.trim()
  const addressClean = address?.trim()
  const dirClean = directionsAddress?.trim()

  let termsPart = ''
  if (hasTerms) {
    const label = t(locale, 'email.footer.termsLink')
    const linkText = bookingUrl
      ? `<a href="${bookingUrl}" style="color:${COLORS.text};text-decoration:underline;font-weight:600">${label}</a>`
      : `<strong style="color:${COLORS.textSoft}">${label}</strong>`
    termsPart = `<p style="margin:0;color:${COLORS.textSoft};font-size:13px;line-height:1.6">${t(locale, 'email.footer.termsText', { link: linkText })}</p>`
  }

  const lines: string[] = []
  if (phoneClean) {
    const tel = phoneClean.replace(/[^\d+]/g, '')
    lines.push(`<a href="tel:${tel}" style="color:${COLORS.text};text-decoration:none;font-weight:600">${escapeHtml(phoneClean)}</a>`)
  }
  if (emailClean) {
    lines.push(`<a href="mailto:${escapeHtml(emailClean)}" style="color:${COLORS.text};text-decoration:none">${escapeHtml(emailClean)}</a>`)
  }
  if (addressClean) {
    lines.push(`<span style="color:${COLORS.textSoft}">${escapeHtml(addressClean)}</span>`)
  }

  let directionsBtn = ''
  if (dirClean) {
    const mapsUrl = /^https?:\/\//i.test(dirClean)
      ? dirClean
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dirClean)}`
    const pinSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${COLORS.text}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px;margin-right:6px"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`
    directionsBtn = `<div style="margin-top:12px">
      <a href="${mapsUrl}" style="display:inline-block;background:${COLORS.muted};color:${COLORS.text};font-size:12px;font-weight:600;text-decoration:none;padding:9px 18px;border-radius:999px;border:1px solid ${COLORS.border}">${pinSvg}${t(locale, 'email.footer.directions')}</a>
    </div>`
  }

  let contactPart = ''
  if (lines.length || directionsBtn) {
    const contactLine = lines.length
      ? `<p style="margin:0;color:${COLORS.textSoft};font-size:13px;line-height:1.8">${lines.join(`<span style="color:${COLORS.border}">&nbsp;·&nbsp;</span>`)}</p>`
      : ''
    contactPart = `<p style="margin:0 0 5px;color:${COLORS.text};font-size:13px;font-weight:600">${t(locale, 'email.footer.contactTitle')}</p>${contactLine}${directionsBtn}`
  }

  if (!termsPart && !contactPart) return ''
  const inner = [termsPart, contactPart].filter(Boolean).join('<div style="height:14px;line-height:14px;font-size:0">&nbsp;</div>')

  return `<tr>
    <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:left">
      <div style="border-top:1px solid ${COLORS.border};padding-top:18px">
        ${inner}
      </div>
    </td>
  </tr>`
}

// ── Záró térköz ─────────────────────────────────────────────────────────────────

export function bottomSpacer(): string {
  return `<tr><td style="background:${COLORS.surface};height:28px;line-height:28px;font-size:0">&nbsp;</td></tr>`
}

// ── Teljes email-váz ────────────────────────────────────────────────────────────

export interface EmailLayoutOptions {
  brandName: string
  brandLogoUrl?: string | null
  brandCoverUrl?: string | null
  /** Ha megadva, LEVÁLTJA a belső brandHeader() hívást (pl. brandHeroBlock esetén). */
  header?: string
  content: string
}

export function emailLayout({ brandName, brandLogoUrl, brandCoverUrl, header, content }: EmailLayoutOptions): string {
  const headerHtml = header ?? brandHeader({ brandName, brandLogoUrl, brandCoverUrl })
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#e8eaed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e8eaed" style="background:#e8eaed;min-height:100vh;padding:36px 16px">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.14),0 1px 4px rgba(0,0,0,0.08)">

        ${headerHtml}

        ${content}

        <!-- Schedulio + davelopment footer -->
        <tr>
          <td style="background:#09090b;padding:24px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05)">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto">
              <tr>
                <td style="padding:0 14px;vertical-align:middle">
                  <a href="${SCHEDULIO_URL}" style="text-decoration:none;display:block">
                    <img src="${SCHEDULIO_WORDMARK}" alt="Schedulio" height="22" style="height:22px;display:block;border:0" />
                  </a>
                </td>
                <td style="padding:0;vertical-align:middle">
                  <div style="width:1px;height:22px;background:#27272a;line-height:22px;font-size:0">&nbsp;</div>
                </td>
                <td style="padding:0 14px;vertical-align:middle">
                  <a href="${DAVELOPMENT_URL}" style="text-decoration:none;display:block">
                    <img src="${DAVELOPMENT_WORDMARK}" alt="davelopment" height="14" style="height:14px;display:block;border:0;opacity:0.6" />
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;color:#3f3f46;font-size:11px">© ${new Date().getFullYear()} Schedulio · Minden jog fenntartva</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export { COLORS }
