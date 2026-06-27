import { Resend } from 'resend'
import type { Restaurant, Reservation, Media } from '@/payload/payload-types'
import {
  emailLayout,
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

export interface ReservationEmailData {
  reservation: Reservation
  restaurant: Restaurant
}

/** Egy Media mező abszolút URL-je (emailhez teljes URL kell). */
function mediaUrl(field: Restaurant['logo']): string | null {
  const url = field && typeof field === 'object' ? (field as Media).url : null
  if (!url) return null
  return url.startsWith('http') ? url : `${APP_URL}${url}`
}

function emailVars(data: ReservationEmailData): Record<string, string> {
  const { reservation } = data
  return {
    name: reservation.customer_name,
    date: reservation.date,
    time: `${reservation.start_time} – ${reservation.end_time}`,
    pax: String(reservation.pax),
  }
}

function hasTerms(restaurant: Restaurant): boolean {
  return (restaurant.terms_sections ?? []).some((s) => s?.title || s?.body)
}

function wrap(restaurant: Restaurant, content: string): string {
  return emailLayout({
    brandName: restaurant.name,
    brandLogoUrl: mediaUrl(restaurant.logo),
    brandCoverUrl: mediaUrl(restaurant.cover_image),
    content,
  })
}

// ── ICS ────────────────────────────────────────────────────────────────────
function generateICS({ reservation, restaurant }: ReservationEmailData): string {
  const uid = `reservation-${reservation.id}@schedulio`
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const [y, m, d] = reservation.date.split('-')
  const [sh, sm] = reservation.start_time.split(':')
  const [eh, em] = reservation.end_time.split(':')
  const location = restaurant.address ? `${restaurant.address}${restaurant.city ? ', ' + restaurant.city : ''}` : ''
  const description = `${reservation.pax} fő${restaurant.phone ? '\\nTelefon: ' + restaurant.phone : ''}`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Schedulio//HU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Budapest:${y}${m}${d}T${sh}${sm}00`,
    `DTEND;TZID=Europe/Budapest:${y}${m}${d}T${eh}${em}00`,
    `SUMMARY:Asztalfoglalás – ${restaurant.name}`,
    location ? `LOCATION:${location}` : '',
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

// ── Senders ──────────────────────────────────────────────────────────────────
export async function sendReservationConfirmation(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend) return
  const cancelUrl = reservation.cancel_token
    ? `${APP_URL}/${restaurant.slug}/cancel/${reservation.cancel_token}`
    : null
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  const vars = emailVars(data)
  const subjectTpl = (restaurant.booking_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, vars)
    : t(locale, 'email.confirm.subjectFallback', { place: restaurant.name })
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject,
      html: confirmationHtml(data, cancelUrl),
      attachments: [{ filename: 'foglalas.ics', content: Buffer.from(generateICS(data)) }],
    })
  } catch (err) {
    console.error('[RestaurantEmail] Confirmation failed:', err)
  }
}

export async function sendReservationNotification(data: ReservationEmailData) {
  const { restaurant } = data
  if (!restaurant.email) return
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: restaurant.email,
      subject: `Új asztalfoglalás: ${data.reservation.customer_name} — ${data.reservation.date} ${data.reservation.start_time}`,
      html: notificationHtml(data),
    })
  } catch (err) {
    console.error('[RestaurantEmail] Notification failed:', err)
  }
}

export async function sendReservationCancellation(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend) return
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject: t(locale, 'email.cancel.subjectFallback', { place: restaurant.name }),
      html: cancellationHtml(data),
    })
  } catch (err) {
    console.error('[RestaurantEmail] Cancellation failed:', err)
  }
}

// ── HTML ───────────────────────────────────────────────────────────────────
function detailRows(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  const location = restaurant.address ? `${restaurant.address}${restaurant.city ? ', ' + restaurant.city : ''}` : null
  return [
    infoRow('user', t(locale, 'email.label.name'), reservation.customer_name),
    infoRow('mail', t(locale, 'email.label.email'), reservation.customer_email),
    infoRow('calendar', t(locale, 'email.label.date'), formatBookingDate(reservation.date, locale)),
    infoRow('clock', t(locale, 'email.label.time'), `${reservation.start_time} – ${reservation.end_time}`),
    infoRow('people', t(locale, 'email.label.guests'), `${reservation.pax} fő`),
    location ? infoRow('pin', t(locale, 'email.label.address'), location) : '',
  ].filter(Boolean).join('')
}

function confirmationHtml(data: ReservationEmailData, cancelUrl: string | null): string {
  const { reservation, restaurant } = data
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'success',
      title: t(locale, 'email.confirm.title'),
      subtitle: t(locale, 'email.greeting', { name: reservation.customer_name }),
    })}
    ${introBlock(restaurant.booking_email_intro ?? '', emailVars(data))}
    ${detailsCard(detailRows(data))}
    ${reservation.notes ? `<tr><td style="background:${COLORS.surface};padding:16px 32px 0">
      <p style="margin:0;color:${COLORS.textSoft};font-size:13px"><strong>${t(locale, 'email.label.notes')}:</strong> ${reservation.notes}</p>
    </td></tr>` : ''}
    ${calendarBlock({
      title: `${t(locale, 'rbooking.header')} – ${restaurant.name}`,
      date: reservation.date,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      location: contactAddress(restaurant),
      description: `${reservation.pax} ${t(locale, 'email.label.guests').toLowerCase()}`,
      locale,
    })}
    ${footerInfoBlock({
      hasTerms: hasTerms(restaurant),
      bookingUrl: `${APP_URL}/${restaurant.slug}/terms`,
      phone: restaurant.email_show_phone ? (restaurant.email_contact_phone?.trim() || restaurant.phone) : null,
      email: restaurant.email_show_email ? restaurant.email : null,
      address: restaurant.email_show_address ? contactAddress(restaurant) : null,
      directionsAddress: restaurant.email_show_directions ? (restaurant.email_directions_address?.trim() || contactAddress(restaurant)) : null,
      locale,
    })}
    ${cancelBlock(cancelUrl, locale)}
    ${bottomSpacer()}
  `)
}

function contactAddress(restaurant: Restaurant): string | null {
  return restaurant.address ? `${restaurant.address}${restaurant.city ? ', ' + restaurant.city : ''}` : null
}

function notificationHtml(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  const contactRows = [
    infoRow('mail', 'Email', reservation.customer_email),
    reservation.customer_phone ? infoRow('phone', 'Telefon', reservation.customer_phone) : '',
    reservation.notes ? infoRow('note', 'Megjegyzés', reservation.notes) : '',
  ].filter(Boolean).join('')
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'bell',
      title: 'Új asztalfoglalás',
      subtitle: `${reservation.customer_name} asztalt foglalt.`,
    })}
    ${detailsCard(detailRows(data))}
    ${detailsCard(contactRows)}
    ${bottomSpacer()}
  `)
}

function cancellationHtml(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'cancel',
      title: t(locale, 'email.cancel.title'),
      subtitle: t(locale, 'email.cancel.body'),
    })}
    ${detailsCard(detailRows(data))}
    ${bottomSpacer()}
  `)
}
