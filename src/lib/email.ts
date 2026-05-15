import { Resend } from 'resend'
import type { Booking, Salon, Service, StaffMember } from '@/payload/payload-types'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu'
const FROM_NAME = process.env.RESEND_FROM_NAME ?? 'Bookly'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export interface BookingEmailData {
  booking: Booking
  salon: Salon
  service: Service
  staff: StaffMember
}

// ── ICS generator ────────────────────────────────────────────────────────────

function generateICS({ booking, salon, service, staff }: BookingEmailData): string {
  const uid = `booking-${booking.id}@bookly`
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
    'PRODID:-//Bookly//HU',
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
    ? `${APP_URL}/bookly/booking/confirm-cancel/${(booking as any).cancellation_token}`
    : null
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject: `Foglalás visszaigazolva — ${salon.name}`,
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

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#09090b;padding:24px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#ffffff;font-size:18px;font-weight:900;letter-spacing:-0.5px">Bookly</span>
                  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#0099ff;margin-left:4px;vertical-align:middle"></span>
                </td>
                <td align="right"><a href="https://davelopment.hu" style="color:#52525b;font-size:11px;text-decoration:none">by [davelopment]®</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content -->
        ${content}
        <!-- Footer -->
        <tr>
          <td style="background:#09090b;padding:20px 32px;text-align:center">
            <p style="margin:0;color:#3f3f46;font-size:11px">© 2026 Bookly · Minden jog fenntartva</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#71717a;font-size:13px;white-space:nowrap;width:110px">${label}</td>
    <td style="padding:8px 0;color:#09090b;font-size:13px;font-weight:600">${value}</td>
  </tr>`
}

function confirmationHtml(data: BookingEmailData, cancelUrl: string | null): string {
  const { booking, salon, service, staff } = data
  const location = salon.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : null

  return emailWrapper(`
    <tr>
      <td style="background:#ffffff;padding:32px 32px 0">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding-bottom:24px">
              <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#00bb8818;text-align:center;line-height:48px;font-size:22px;margin-bottom:12px">✓</div>
              <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Foglalás visszaigazolva!</h1>
              <p style="margin:0;color:#71717a;font-size:14px">Kedves <strong>${booking.customer_name}</strong>, foglalásod sikeresen rögzítettük.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:0 32px">
        <div style="background:#f4f4f5;border-radius:12px;padding:16px 20px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${infoRow('Szalon', salon.name)}
            ${infoRow('Szolgáltatás', service.name)}
            ${infoRow('Munkatárs', staff.name)}
            ${infoRow('Dátum', booking.date)}
            ${infoRow('Időpont', `${booking.start_time} – ${booking.end_time}`)}
            ${location ? infoRow('Cím', location) : ''}
          </table>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:24px 32px;text-align:center">
        <p style="margin:0 0 6px;color:#a1a1aa;font-size:12px">A csatolt <strong>foglalas.ics</strong> fájllal egyből hozzáadhatod a naptáradhoz.</p>
      </td>
    </tr>
    ${cancelUrl ? `
    <tr>
      <td style="background:#ffffff;padding:0 32px 28px;text-align:center">
        <div style="border-top:1px solid #f4f4f5;padding-top:20px">
          <p style="margin:0 0 8px;color:#a1a1aa;font-size:12px">Le szeretnéd mondani?</p>
          <a href="${cancelUrl}" style="color:#71717a;font-size:12px;text-decoration:underline">Foglalás lemondása</a>
        </div>
      </td>
    </tr>` : ''}
  `)
}

function notificationHtml(data: BookingEmailData): string {
  const { booking, service, staff } = data

  return emailWrapper(`
    <tr>
      <td style="background:#ffffff;padding:32px 32px 0">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding-bottom:24px">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#0099ff18;margin-bottom:12px">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0099ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><line x1="8" x2="8" y1="14" y2="14"/><line x1="12" x2="12" y1="14" y2="14"/><line x1="16" x2="16" y1="14" y2="14"/><line x1="8" x2="8" y1="18" y2="18"/><line x1="12" x2="12" y1="18" y2="18"/><line x1="16" x2="16" y1="18" y2="18"/></svg>
              </div>
              <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Új foglalás érkezett!</h1>
              <p style="margin:0;color:#71717a;font-size:14px"><strong>${booking.customer_name}</strong> foglalt időpontot.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:0 32px 32px">
        <div style="background:#f4f4f5;border-radius:12px;padding:16px 20px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${infoRow('Ügyfél', booking.customer_name)}
            ${infoRow('Telefon', booking.customer_phone)}
            ${infoRow('Email', booking.customer_email)}
            ${infoRow('Szolgáltatás', service.name)}
            ${infoRow('Munkatárs', staff.name)}
            ${infoRow('Dátum', booking.date)}
            ${infoRow('Időpont', `${booking.start_time} – ${booking.end_time}`)}
            ${booking.notes ? infoRow('Megjegyzés', booking.notes) : ''}
          </table>
        </div>
      </td>
    </tr>
  `)
}

function cancellationHtml(data: BookingEmailData): string {
  const { booking, salon, service } = data

  return emailWrapper(`
    <tr>
      <td style="background:#ffffff;padding:32px 32px 0">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding-bottom:24px">
              <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#ef444418;text-align:center;line-height:48px;font-size:22px;margin-bottom:12px">✕</div>
              <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Foglalás lemondva</h1>
              <p style="margin:0;color:#71717a;font-size:14px">Kedves <strong>${booking.customer_name}</strong>, foglalásod sikeresen lemondásra került.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:0 32px 32px">
        <div style="background:#f4f4f5;border-radius:12px;padding:16px 20px">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${infoRow('Szalon', salon.name)}
            ${infoRow('Szolgáltatás', service.name)}
            ${infoRow('Dátum', booking.date)}
            ${infoRow('Időpont', `${booking.start_time} – ${booking.end_time}`)}
          </table>
        </div>
        <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;text-align:center">Ha ez tévedés volt, kérjük foglalj újra a szalon oldalán.</p>
      </td>
    </tr>
  `)
}
