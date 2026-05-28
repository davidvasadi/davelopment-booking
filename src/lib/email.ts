import { Resend } from 'resend'
import type { Booking, Salon, Service, StaffMember, Media } from '@/payload/payload-types'
import {
  emailLayout,
  heroBlock,
  detailsCard,
  infoRow,
  introBlock,
  cancelBlock,
  footerInfoBlock,
  bottomSpacer,
  renderSubject,
  COLORS,
} from './emailLayout'

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
  const vars = emailVars(data)
  const subjectTpl = salon.booking_email_subject?.trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, vars)
    : `Foglalás visszaigazolva — ${salon.name}`
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
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject: `Foglalás lemondva — ${salon.name}`,
      html: cancellationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Cancellation email failed:', err)
  }
}

// ── HTML templates ────────────────────────────────────────────────────────────

function salonAddress(salon: Salon): string | null {
  return salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null
}

function bookingRows(data: BookingEmailData): string {
  const { booking, salon, service, staff } = data
  const location = salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null
  return [
    infoRow('user', 'Név', booking.customer_name),
    infoRow('mail', 'Email', booking.customer_email),
    infoRow('scissors', 'Szolgáltatás', service.name),
    infoRow('user', 'Munkatárs', staff.name),
    infoRow('calendar', 'Dátum', booking.date),
    infoRow('clock', 'Időpont', `${booking.start_time} – ${booking.end_time}`),
    location ? infoRow('pin', 'Cím', location) : '',
  ].filter(Boolean).join('')
}

function confirmationHtml(data: BookingEmailData, cancelUrl: string | null): string {
  const { booking, salon } = data
  return wrap(salon, `
    ${heroBlock({
      icon: 'success',
      title: 'Foglalás visszaigazolva',
      subtitle: `Kedves ${booking.customer_name}, foglalásod sikeresen rögzítettük.`,
    })}
    ${introBlock(salon.booking_email_intro, emailVars(data))}
    ${detailsCard(bookingRows(data))}
    <tr><td style="background:${COLORS.surface};padding:16px 32px 0;text-align:center">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">A csatolt <strong style="color:${COLORS.textSoft}">foglalas.ics</strong> fájllal egyből hozzáadhatod a naptáradhoz.</p>
    </td></tr>
    ${footerInfoBlock({
      hasTerms: hasTerms(salon),
      bookingUrl: `${APP_URL}/${salon.slug}/feltetelek`,
      phone: salon.email_show_phone ? (salon.email_contact_phone?.trim() || salon.phone) : null,
      email: salon.email_show_email ? salon.email : null,
      address: salon.email_show_address ? salonAddress(salon) : null,
      directionsAddress: salon.email_show_directions ? (salon.email_directions_address?.trim() || salonAddress(salon)) : null,
    })}
    ${cancelBlock(cancelUrl)}
    ${bottomSpacer()}
  `)
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

function cancellationHtml(data: BookingEmailData): string {
  const { booking, salon, service } = data
  const location = salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null
  const rows = [
    infoRow('scissors', 'Szolgáltatás', service.name),
    infoRow('calendar', 'Dátum', booking.date),
    infoRow('clock', 'Időpont', `${booking.start_time} – ${booking.end_time}`),
    location ? infoRow('pin', 'Cím', location) : '',
  ].filter(Boolean).join('')
  return wrap(salon, `
    ${heroBlock({
      icon: 'cancel',
      title: 'Foglalás lemondva',
      subtitle: `Kedves ${booking.customer_name}, foglalásod sikeresen lemondásra került.`,
    })}
    ${detailsCard(rows)}
    <tr><td style="background:${COLORS.surface};padding:16px 32px 0;text-align:center">
      <p style="margin:0;color:${COLORS.textFaint};font-size:12px">Ha ez tévedés volt, kérjük foglalj újra a szalon oldalán.</p>
    </td></tr>
    ${bottomSpacer()}
  `)
}
