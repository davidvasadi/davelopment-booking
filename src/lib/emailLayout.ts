/**
 * Közös email-vázlat (davelopment booking arculat) — v3 (Crextio).
 *
 * Dizájnfilozófia: meleg krém külső háttér, fehér floating kártya lágy sarokkal,
 * belül ink-sötét brand-sáv (logó) + fehér hero (státusz-ikon + arany dátum-pill),
 * majd tiszta fehér body, végül ink-sötét footer a wordmarkokkal.
 * Minden tranzakciós email (salon + restaurant) ezt használja.
 *
 * Email-kliens kompat.: csak inline style, table-layout, rgba() bg → Gmail, Apple Mail,
 * Outlook 2016+, mobile. backdrop-filter-t NEM használunk (Outlook-ban nem megy), a
 * glass-hatást rgba() + border adja.
 */

import { t, type Locale } from './i18n'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const DAVELOPMENT_URL = 'https://davelopment.hu'

const BOOKING_LOCKUP = `${APP_URL}/email/davelopment-booking-wordmark.png`

// Crextio/davelopment email-paletta: meleg krém háttér, fehér kártyák, ink-sötét sáv, arany accent.
const COLORS = {
  // Üveges fehér kártya — a háttér-gradiens (+ arany glow) átdereng rajta.
  // bgcolor-fallback (Outlook) minden blokknál külön: #FFFFFF.
  surface:      'rgba(255,255,255,0.58)',
  muted:        'rgba(255,255,255,0.34)',   // beágyazott üveg-panel (detail-doboz)
  border:       'rgba(59,59,59,0.12)',      // semleges hajszál-vonal (üvegen is látszik)
  text:         '#3B3B3B',                  // márka sötét
  textSoft:     '#6E6E6E',                  // semleges szürke
  textFaint:    '#9A9A9A',
  // Accentek — a te színeid
  accent:       '#FFD85F',                  // márka arany
  ink:          '#3B3B3B',                  // sötét sáv (brand-hero, footer)
  footerText:   '#BDBDBD',                  // világos szöveg a sötét footeren
  // Arany chip (dátum-pill)
  glassBg:      'rgba(255,216,95,0.24)',
  glassBorder:  'rgba(255,216,95,0.55)',
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
  | 'calendar' | 'clock' | 'people' | 'pin' | 'user' | 'scissors' | 'mail' | 'note' | 'phone' | 'sparkle'

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
  sparkle:  '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
}

type HeroIcon = 'success' | 'cancel' | 'bell'
const HERO_ICONS: Record<HeroIcon, { color: string; bg: string; path: string }> = {
  success: {
    color: '#3B3B3B',
    bg:    'rgba(255,216,95,0.32)',
    path:  '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  },
  cancel: {
    color: '#3B3B3B',
    bg:    'rgba(59,59,59,0.09)',
    path:  '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  },
  bell: {
    color: '#3B3B3B',
    bg:    'rgba(255,216,95,0.32)',
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.muted};border:1px solid ${COLORS.border};border-radius:18px;overflow:hidden;border-collapse:separate">
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

// A brand-fejléc teteje: ha van borító, a logó a KÉPEN ül (a kép látszik mögötte).
// Böngészőben `background:#FFFFFF 0%` + `backdrop-filter: blur+saturate(0.4)` = színtelen üveg;
// az email-appok a backdrop-filtert kihagyják → ott a sáv áttetsző, a kép élesen jön át.
function brandTopRow(
  brandCoverUrl: string | null | undefined,
  brandLogoUrl: string | null | undefined,
  alt: string,
): string {
  if (brandCoverUrl) {
    const logoLight = brandLogoUrl
      ? `<img src="${brandLogoUrl}" alt="${alt}" height="26" style="height:26px;max-width:170px;object-fit:contain;border:0;display:inline-block" />`
      : `<span style="font-size:15px;font-weight:700;letter-spacing:-0.2px;color:#ffffff;text-shadow:0 1px 5px rgba(0,0,0,.55)">${alt}</span>`
    return `<tr><td style="padding:0;position:relative;font-size:0;line-height:0">
      <img src="${brandCoverUrl}" alt="" width="560" style="width:100%;height:190px;object-fit:cover;display:block;border:0" />
      <div style="position:absolute;left:0;right:0;bottom:0;height:96px;background:rgba(255,255,255,0);-webkit-backdrop-filter:blur(10px) saturate(0.6);backdrop-filter:blur(10px) saturate(0.6);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 52px);mask-image:linear-gradient(to bottom,transparent 0,#000 52px)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;padding:14px 32px;text-align:center;line-height:normal">${logoLight}</div>
    </td></tr>`
  }
  // Borító nélkül: nincs sáv/szín — a logó/név sötéten, közvetlenül az üveges kártyán.
  const logoDark = brandLogoUrl
    ? `<img src="${brandLogoUrl}" alt="${alt}" height="26" style="height:26px;max-width:170px;object-fit:contain;border:0;display:inline-block" />`
    : `<span style="font-size:15px;font-weight:700;letter-spacing:-0.2px;color:#3B3B3B">${alt}</span>`
  return `<tr><td style="padding:22px 32px 2px;text-align:center;background:${COLORS.surface}">${logoDark}</td></tr>`
}

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

  // 1–2. Borító + logó egyben (a logó a KÉPEN ül, a kép látszik mögötte).
  const brandTop = brandTopRow(brandCoverUrl, brandLogoUrl, alt)

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
          <td style="width:56px;height:56px;border-radius:18px;background:${def.bg};text-align:center;vertical-align:middle">
            ${iconSvg}
          </td>
        </tr>
      </table>
      <h1 style="margin:0 0 7px;font-size:27px;font-weight:300;color:${COLORS.text};letter-spacing:-0.6px;line-height:1.1">${escapeHtml(title)}</h1>
      <p style="margin:0 auto;max-width:320px;color:${COLORS.textFaint};font-size:14px;line-height:1.55">${escapeHtml(subtitle)}</p>
      ${datePill}
    </td>
  </tr>`

  return `${brandTop}${heroSection}`
}

// ── brandHeader: notify/cancel emailekhez (ugyanolyan thin dark strip stílus) ──

function brandHeader(opts: {
  brandName: string
  brandLogoUrl?: string | null
  brandCoverUrl?: string | null
}): string {
  const { brandName, brandLogoUrl, brandCoverUrl } = opts
  return brandTopRow(brandCoverUrl, brandLogoUrl, escapeHtml(brandName))
}

export function heroBlock(opts: { icon: HeroIcon; title: string; subtitle: string }): string {
  const def = HERO_ICONS[opts.icon]
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${def.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${def.path}</svg>`
  return `<tr>
    <td style="background:${COLORS.surface};padding:28px 32px 0;text-align:center">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px">
        <tr><td style="width:56px;height:56px;border-radius:18px;background:${def.bg};text-align:center;vertical-align:middle">${svg}</td></tr>
      </table>
      <h1 style="margin:0 0 7px;font-size:27px;font-weight:300;color:${COLORS.text};letter-spacing:-0.6px;line-height:1.1">${opts.title}</h1>
      <p style="margin:0 auto;max-width:340px;color:${COLORS.textFaint};font-size:14px;line-height:1.55">${opts.subtitle}</p>
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

  const calSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B3B3B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px;margin-right:7px"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`

  return `<tr>
    <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
      <a href="${gcUrl}" style="display:inline-block;background:${COLORS.accent};color:#3B3B3B;font-size:13px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px;letter-spacing:-0.1px">${calSvg}${escapeHtml(t(locale, 'email.addToCalendar'))}</a>
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
<body style="margin:0;padding:0;background:#EFEFEF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#EFEFEF" style="background:#EFEFEF;background-image:radial-gradient(130% 90% at 96% -6%, rgba(255,216,95,0.52) 0%, rgba(255,216,95,0) 50%),linear-gradient(160deg,#FBFBFB 0%,#EDEDED 55%,#E0E0E0 100%);min-height:100vh;padding:44px 16px">
    <tr><td align="center" style="padding:0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,0.6);box-shadow:0 30px 60px -30px rgba(40,40,40,0.30),0 2px 8px rgba(40,40,40,0.06)">

        ${headerHtml}

        ${content}

        <!-- davelopment Booking footer -->
        <tr>
          <td style="background:${COLORS.ink};padding:28px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05)">
            <a href="${DAVELOPMENT_URL}" style="text-decoration:none;display:inline-block">
              <img src="${BOOKING_LOCKUP}" alt="davelopment Booking" width="120" height="44" style="width:120px;height:44px;display:block;border:0" />
            </a>
            <p style="margin:16px 0 0;color:${COLORS.footerText};font-size:11px">© ${new Date().getFullYear()} davelopment booking · Minden jog fenntartva</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export { COLORS }
