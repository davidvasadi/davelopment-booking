import { detailsCard, escapeHtml, formatBookingDate, heroBlock, infoRow, COLORS } from './emailLayout'
import { t, type Locale } from './i18n'

/**
 * A beleegyező nyilatkozat másolata a vendégnek (2026-11): minden elfogadás után (online a foglaláskor és a helyszíni
 * check-in-nél is) kimegy — a vendég saját példánya. A szöveg a foglaláson tárolt pillanatfelvétel
 * (`consent_text_snapshot`), tehát pontosan az, amit elfogadott. A szalon (email.ts) és az étterem (restaurantEmail.ts)
 * a saját fejlécével csomagolja.
 */
export function consentCopyContent(opts: {
  locale: Locale
  name: string
  date: string
  time: string
  acceptedAt: string | null | undefined
  via: 'online' | 'onsite' | null | undefined
  title: string | null | undefined
  text: string
}): string {
  const { locale } = opts
  const accepted = opts.acceptedAt
    ? new Date(opts.acceptedAt).toLocaleString(locale === 'hu' ? 'hu-HU' : locale, { timeZone: 'Europe/Budapest', dateStyle: 'long', timeStyle: 'short' })
    : ''
  const rows = [
    infoRow('user', t(locale, 'email.label.name'), escapeHtml(opts.name)),
    infoRow('calendar', t(locale, 'email.label.date'), escapeHtml(formatBookingDate(opts.date, locale))),
    infoRow('clock', t(locale, 'email.label.time'), escapeHtml(opts.time)),
    accepted ? infoRow('note', t(locale, 'email.consent.acceptedAt'), escapeHtml(accepted)) : '',
    opts.via ? infoRow('note', t(locale, 'email.consent.via'), t(locale, opts.via === 'onsite' ? 'email.consent.viaOnsite' : 'email.consent.viaOnline')) : '',
  ].join('')
  const body = escapeHtml(opts.text).replace(/\n/g, '<br>')
  return `
    ${heroBlock({ icon: 'success', title: escapeHtml(opts.title?.trim() || t(locale, 'email.consent.title')), subtitle: t(locale, 'email.consent.body') })}
    ${detailsCard(rows)}
    <tr>
      <td style="background:${COLORS.surface};padding:20px 24px 0">
        <p style="margin:0 0 8px;color:${COLORS.textSoft};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${t(locale, 'email.consent.text')}</p>
        <div style="background:${COLORS.muted};border-radius:18px;padding:16px 18px;color:${COLORS.text};font-size:13px;line-height:1.65">${body}</div>
      </td>
    </tr>`
}
