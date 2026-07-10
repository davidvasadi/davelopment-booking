import { Resend } from 'resend'
import type { Booking, Salon, Service, StaffMember, Media } from '@/payload/payload-types'
import {
  emailLayout,
  brandHeroBlock,
  heroBlock,
  detailsCard,
  infoRow,
  introBlock,
  cancelBlock,
  footerInfoBlock,
  calendarBlock,
  formatBookingDate,
  bottomSpacer,
  renderSubject,
  COLORS,
} from './emailLayout'
import { t, normalizeLocale } from './i18n'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu'
const FROM_NAME = process.env.RESEND_FROM_NAME ?? 'Schedulio'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export interface BookingEmailData {
  booking: Booking
  salon: Salon
  service: Service
  staff: StaffMember
}

/** Egy Media mező abszolút URL-je (emailhez teljes URL kell). */
function mediaUrl(field: Salon['logo']): string | null {
  const url = field && typeof field === 'object' ? (field as Media).url : null
  if (!url) return null
  return url.startsWith('http') ? url : `${APP_URL}${url}`
}

function emailVars(data: BookingEmailData): Record<string, string> {
  const { booking, service } = data
  return {
    name: booking.customer_name,
    date: booking.date,
    time: `${booking.start_time} – ${booking.end_time}`,
    service: service.name,
  }
}

function hasTerms(salon: Salon): boolean {
  return (salon.terms_sections ?? []).some((s) => s?.title || s?.body)
}

function wrap(salon: Salon, content: string): string {
  return emailLayout({
    brandName: salon.name,
    brandLogoUrl: mediaUrl(salon.logo),
    brandCoverUrl: mediaUrl(salon.cover_image),
    content,
  })
}

// ── ICS generator ────────────────────────────────────────────────────────────

function generateICS({ booking, salon, service, staff }: BookingEmailData): string {
  const uid = `booking-${booking.id}@schedulio`
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const [y, m, d] = booking.date.split('-')
  const [sh, sm] = booking.start_time.split(':')
  const [eh, em] = booking.end_time.split(':')
  const dtStart = `${y}${m}${d}T${sh}${sm}00`
  const dtEnd = `${y}${m}${d}T${eh}${em}00`
  const location = salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : ''
  const description = `Munkatárs: ${staff.name}\\nSzolgáltatás: ${service.name}${salon.phone ? '\\nTelefon: ' + salon.phone : ''}`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedulio//HU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Budapest:${dtStart}`,
    `DTEND;TZID=Europe/Budapest:${dtEnd}`,
    `SUMMARY:${service.name} – ${salon.name}`,
    location ? `LOCATION:${location}` : '',
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

// ── Email senders ─────────────────────────────────────────────────────────────

export async function sendBookingConfirmation(data: BookingEmailData) {
  const { booking, salon } = data
  const resend = getResend()
  if (!resend) return
  const cancelUrl = (booking as any).cancellation_token
    ? `${APP_URL}/booking/confirm-cancel/${(booking as any).cancellation_token}`
    : null
  const locale = normalizeLocale((booking as { locale?: string }).locale)
  const vars = emailVars(data)
  const subjectTpl = (salon.booking_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, vars)
    : t(locale, 'email.confirm.subjectFallback', { place: salon.name })
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject,
      html: confirmationHtml(data, cancelUrl),
      attachments: [
        {
          filename: 'foglalas.ics',
          content: Buffer.from(generateICS(data)),
        },
      ],
    })
  } catch (err) {
    console.error('[Email] Booking confirmation failed:', err)
  }
}

export async function sendNewBookingNotification(data: BookingEmailData) {
  const { salon } = data
  if (!salon.email) return
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: salon.email,
      subject: `Új foglalás: ${data.booking.customer_name} — ${data.booking.date} ${data.booking.start_time}`,
      html: notificationHtml(data),
    })
  } catch (err) {
    console.error('[Email] New booking notification failed:', err)
  }
}

export async function sendCancellationEmail(data: BookingEmailData) {
  const { booking, salon } = data
  const resend = getResend()
  if (!resend) return
  const locale = normalizeLocale((booking as { locale?: string }).locale)
  const subjectTpl = (salon.cancel_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : t(locale, 'email.cancel.subjectFallback', { place: salon.name })
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject,
      html: cancellationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Cancellation email failed:', err)
  }
}

export async function sendReminderEmail(data: BookingEmailData) {
  const { booking, salon } = data
  const resend = getResend()
  if (!resend) return
  const subjectTpl = (salon.reminder_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : `Emlékeztető: közeleg a foglalásod – ${salon.name}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject,
      html: reminderHtml(data),
    })
  } catch (err) {
    console.error('[Email] Reminder email failed:', err)
  }
}

export async function sendFeedbackRequestEmail(data: BookingEmailData) {
  const { booking, salon } = data
  const resend = getResend()
  if (!resend) return
  const subjectTpl = (salon.feedback_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : `Milyen volt nálunk? Értékeld a látogatásod – ${salon.name}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject,
      html: feedbackHtml(data),
    })
  } catch (err) {
    console.error('[Email] Feedback request email failed:', err)
  }
}

// ── Waitlist (várólista) ──────────────────────────────────────────────────────

export interface WaitlistEmailData {
  salon: Salon
  customer_name: string
  customer_email: string
  date: string
  time: string
  /** A várólista-token — a „foglald le” link mutathat a szalon publikus oldalára. */
  bookUrl?: string | null
}

/** Feliratkozás-visszaigazolás: „feliratkoztál a várólistára”. */
export async function sendWaitlistSignupEmail(data: WaitlistEmailData) {
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: data.customer_email,
      subject: `Felkerültél a várólistára – ${data.salon.name}`,
      html: wrap(data.salon, `
        ${heroBlock({
          icon: 'bell',
          title: 'Felkerültél a várólistára',
          subtitle: `Kedves ${data.customer_name}, értesítünk, ha felszabadul egy időpont.`,
        })}
        ${detailsCard([
          infoRow('calendar', 'Dátum', data.date),
          infoRow('clock', 'Kért időpont', data.time),
        ].join(''))}
        ${bottomSpacer()}
      `),
    })
  } catch (err) {
    console.error('[Email] Waitlist signup failed:', err)
  }
}

/** Hely-felszabadulás értesítő: „felszabadult hely — foglald le”. */
export async function sendWaitlistOpeningEmail(data: WaitlistEmailData) {
  const resend = getResend()
  if (!resend) return
  const bookUrl = data.bookUrl ?? `${APP_URL}/${data.salon.slug}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: data.customer_email,
      subject: `Felszabadult egy időpont – ${data.salon.name}`,
      html: wrap(data.salon, `
        ${heroBlock({
          icon: 'bell',
          title: 'Felszabadult egy időpont',
          subtitle: `Kedves ${data.customer_name}, a kért időpontod körül felszabadult egy hely. Foglald le, amíg elérhető!`,
        })}
        ${detailsCard([
          infoRow('calendar', 'Dátum', data.date),
          infoRow('clock', 'Időpont', data.time),
        ].join(''))}
        <tr>
          <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
            <a href="${bookUrl}" style="display:inline-block;background:${COLORS.accent};color:#09090b;font-size:13px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:999px;letter-spacing:-0.1px">Időpont foglalása</a>
          </td>
        </tr>
        ${bottomSpacer()}
      `),
    })
  } catch (err) {
    console.error('[Email] Waitlist opening failed:', err)
  }
}

// ── Csapat-meghívó (team invite) ──────────────────────────────────────────────

export interface TeamInviteEmailData {
  to: string
  businessName: string
  roleLabel: string
  inviterName?: string | null
  acceptUrl: string
}

/**
 * Csapat-meghívó email: egy tulaj meghív egy tagot egy szerep-körrel. A link az
 * accept-oldalra mutat (token). Egyszerű, márka-független layout (nincs Salon/logó).
 */
export async function sendTeamInviteEmail(data: TeamInviteEmailData) {
  const resend = getResend()
  if (!resend) return
  const inviter = data.inviterName ? `${data.inviterName} · ` : ''
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: data.to,
      subject: `Meghívó a csapatba – ${data.businessName}`,
      html: `<!DOCTYPE html>
<html lang="hu"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <tr><td style="background:#09090b;padding:24px 32px">
        <span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:-0.5px">Schedulio</span>
      </td></tr>
      <tr><td style="background:#fff;padding:32px">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Meghívtak a csapatba</h1>
        <p style="margin:0 0 20px;color:#71717a;font-size:14px;line-height:1.6">
          ${inviter}meghívott, hogy csatlakozz a(z) <b style="color:#09090b">${data.businessName}</b> csapatához
          <b style="color:#09090b">${data.roleLabel}</b> szerepkörben.
        </p>
        <a href="${data.acceptUrl}" style="display:inline-block;background:#09090b;color:#fff;padding:14px 32px;border-radius:100px;font-size:14px;font-weight:600;text-decoration:none">Meghívó elfogadása</a>
        <p style="margin:20px 0 0;color:#a1a1aa;font-size:12px">Ha nem számítottál erre a meghívóra, hagyd figyelmen kívül ezt az emailt.</p>
      </td></tr>
      <tr><td style="background:#09090b;padding:20px 32px;text-align:center">
        <p style="margin:0;color:#3f3f46;font-size:11px">© 2026 Schedulio · Minden jog fenntartva</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    })
  } catch (err) {
    console.error('[Email] Team invite failed:', err)
  }
}

// ── HTML templates ────────────────────────────────────────────────────────────

function salonAddress(salon: Salon): string | null {
  return salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null
}

function bookingRows(data: BookingEmailData): string {
  const { booking, salon, service, staff } = data
  const locale = normalizeLocale((booking as { locale?: string }).locale)
  const location = salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null
  return [
    infoRow('user', t(locale, 'email.label.name'), booking.customer_name),
    infoRow('mail', t(locale, 'email.label.email'), booking.customer_email),
    infoRow('scissors', t(locale, 'email.label.service'), service.name),
    infoRow('user', t(locale, 'email.label.staff'), staff.name),
    infoRow('calendar', t(locale, 'email.label.date'), formatBookingDate(booking.date, locale)),
    infoRow('clock', t(locale, 'email.label.time'), `${booking.start_time} – ${booking.end_time}`),
    location ? infoRow('pin', t(locale, 'email.label.address'), location) : '',
  ].filter(Boolean).join('')
}

function confirmationHtml(data: BookingEmailData, cancelUrl: string | null): string {
  const { booking, salon } = data
  const locale = normalizeLocale((booking as { locale?: string }).locale)
  const logoUrl = mediaUrl(salon.logo)
  const coverUrl = mediaUrl(salon.cover_image)
  return emailLayout({
    brandName: salon.name,
    brandLogoUrl: logoUrl,
    brandCoverUrl: coverUrl,
    header: brandHeroBlock({
      brandName: salon.name,
      brandLogoUrl: logoUrl,
      brandCoverUrl: coverUrl,
      icon: 'success',
      title: t(locale, 'email.confirm.title'),
      subtitle: t(locale, 'email.greeting', { name: booking.customer_name }),
      formattedDate: formatBookingDate(booking.date, locale),
      time: `${booking.start_time} – ${booking.end_time}`,
    }),
    content: `
      ${introBlock(salon.booking_email_intro ?? '', emailVars(data))}
      ${detailsCard(bookingRows(data))}
      ${calendarBlock({
        title: `${data.service.name} – ${salon.name}`,
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        location: salonAddress(salon),
        description: `${t(locale, 'email.label.staff')}: ${data.staff.name}`,
        locale,
      })}
      ${footerInfoBlock({
        hasTerms: hasTerms(salon),
        bookingUrl: `${APP_URL}/${salon.slug}/terms`,
        phone: salon.email_show_phone ? (salon.email_contact_phone?.trim() || salon.phone) : null,
        email: salon.email_show_email ? salon.email : null,
        address: salon.email_show_address ? salonAddress(salon) : null,
        directionsAddress: salon.email_show_directions ? (salon.email_directions_address?.trim() || salonAddress(salon)) : null,
        locale,
      })}
      ${cancelBlock(cancelUrl, locale)}
      ${bottomSpacer()}
    `,
  })
}

function notificationHtml(data: BookingEmailData): string {
  const { booking, salon, service, staff } = data
  const rows = [
    infoRow('user', 'Ügyfél', booking.customer_name),
    booking.customer_phone ? infoRow('phone', 'Telefon', booking.customer_phone) : '',
    infoRow('mail', 'Email', booking.customer_email),
    infoRow('scissors', 'Szolgáltatás', service.name),
    infoRow('user', 'Munkatárs', staff.name),
    infoRow('calendar', 'Dátum', booking.date),
    infoRow('clock', 'Időpont', `${booking.start_time} – ${booking.end_time}`),
    booking.notes ? infoRow('note', 'Megjegyzés', booking.notes) : '',
  ].filter(Boolean).join('')
  return wrap(salon, `
    ${heroBlock({
      icon: 'bell',
      title: 'Új foglalás érkezett',
      subtitle: `${booking.customer_name} foglalt időpontot.`,
    })}
    ${detailsCard(rows)}
    ${bottomSpacer()}
  `)
}

function reminderHtml(data: BookingEmailData): string {
  const { booking, salon } = data
  const locale = normalizeLocale((booking as { locale?: string }).locale)
  return wrap(salon, `
    ${heroBlock({
      icon: 'bell',
      title: 'Közeleg a foglalásod',
      subtitle: `Kedves ${booking.customer_name}, csak hogy emlékeztessünk: hamarosan találkozunk!`,
    })}
    ${introBlock(salon.reminder_email_intro ?? '', emailVars(data))}
    ${detailsCard(bookingRows(data))}
    ${calendarBlock({
      title: `${data.service.name} – ${salon.name}`,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      location: salonAddress(salon),
      description: `${t(locale, 'email.label.staff')}: ${data.staff.name}`,
      locale,
    })}
    ${bottomSpacer()}
  `)
}

function feedbackHtml(data: BookingEmailData): string {
  const { booking, salon, service } = data
  // Ha a szalon megadott Google értékelés-linket, oda visz (nyilvános review); különben a belső /review.
  const googleUrl = (salon.feature_modules?.google_review_url ?? '').trim()
  const reviewUrl = googleUrl || ((booking as { cancellation_token?: string }).cancellation_token
    ? `${APP_URL}/review/${(booking as { cancellation_token?: string }).cancellation_token}`
    : `${APP_URL}/${salon.slug}`)
  const reviewCta = googleUrl ? 'Értékelj minket a Google-on' : 'Értékelem a látogatásom'
  const rows = [
    infoRow('scissors', 'Szolgáltatás', service.name),
    infoRow('calendar', 'Dátum', booking.date),
  ].join('')
  return wrap(salon, `
    ${heroBlock({
      icon: 'bell',
      title: 'Milyen volt nálunk?',
      subtitle: `Kedves ${booking.customer_name}, reméljük elégedett voltál a látogatásoddal. Mondd el a véleményed!`,
    })}
    ${introBlock(salon.feedback_email_intro ?? '', emailVars(data))}
    ${detailsCard(rows)}
    <tr>
      <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
        <a href="${reviewUrl}" style="display:inline-block;background:${COLORS.accent};color:#09090b;font-size:13px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:999px;letter-spacing:-0.1px">${reviewCta}</a>
      </td>
    </tr>
    ${bottomSpacer()}
  `)
}

function cancellationHtml(data: BookingEmailData): string {
  const { booking, salon, service } = data
  const locale = normalizeLocale((booking as { locale?: string }).locale)
  const location = salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null
  const rows = [
    infoRow('scissors', t(locale, 'email.label.service'), service.name),
    infoRow('calendar', t(locale, 'email.label.date'), booking.date),
    infoRow('clock', t(locale, 'email.label.time'), `${booking.start_time} – ${booking.end_time}`),
    location ? infoRow('pin', t(locale, 'email.label.address'), location) : '',
  ].filter(Boolean).join('')
  return wrap(salon, `
    ${heroBlock({
      icon: 'cancel',
      title: t(locale, 'email.cancel.title'),
      subtitle: t(locale, 'email.cancel.body'),
    })}
    ${introBlock(salon.cancel_email_intro ?? '', emailVars(data))}
    ${detailsCard(rows)}
    <tr><td style="background:${COLORS.surface};padding:16px 32px 0;text-align:center">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">${t(locale, 'email.cancel.hint')}</p>
    </td></tr>
    ${bottomSpacer()}
  `)
}
