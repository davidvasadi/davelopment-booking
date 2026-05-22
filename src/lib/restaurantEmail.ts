import { Resend } from 'resend'
import type { Restaurant, Reservation, Table } from '@/payload/payload-types'

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

function tableName(reservation: Reservation): string | null {
  const t = reservation.table
  if (t && typeof t === 'object') return (t as Table).name
  return null
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
    ? `${APP_URL}/r/${restaurant.slug}/cancel/${reservation.cancel_token}`
    : null
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject: `Asztalfoglalás visszaigazolva — ${restaurant.name}`,
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
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject: `Asztalfoglalás lemondva — ${restaurant.name}`,
      html: cancellationHtml(data),
    })
  } catch (err) {
    console.error('[RestaurantEmail] Cancellation failed:', err)
  }
}

// ── HTML ───────────────────────────────────────────────────────────────────
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="hu"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <tr><td style="background:#09090b;padding:24px 32px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:-0.5px">Schedulio</span>
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#0099ff;margin-left:4px;vertical-align:middle"></span></td>
          <td align="right"><a href="https://davelopment.hu" style="color:#52525b;font-size:11px;text-decoration:none">by [davelopment]®</a></td>
        </tr></table>
      </td></tr>
      ${content}
      <tr><td style="background:#09090b;padding:20px 32px;text-align:center">
        <p style="margin:0;color:#3f3f46;font-size:11px">© 2026 Schedulio · Minden jog fenntartva</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#71717a;font-size:13px;white-space:nowrap;width:110px">${label}</td>
    <td style="padding:8px 0;color:#09090b;font-size:13px;font-weight:600">${value}</td>
  </tr>`
}

function detailsTable(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  const location = restaurant.address ? `${restaurant.address}${restaurant.city ? ', ' + restaurant.city : ''}` : null
  const tn = tableName(reservation)
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;padding:16px 20px;margin:8px 0 24px">
    ${infoRow('Étterem', restaurant.name)}
    ${infoRow('Dátum', reservation.date)}
    ${infoRow('Időpont', `${reservation.start_time} – ${reservation.end_time}`)}
    ${infoRow('Létszám', `${reservation.pax} fő`)}
    ${tn ? infoRow('Asztal', tn) : ''}
    ${location ? infoRow('Cím', location) : ''}
    ${restaurant.phone ? infoRow('Telefon', restaurant.phone) : ''}
  </table>`
}

function confirmationHtml(data: ReservationEmailData, cancelUrl: string | null): string {
  const { reservation } = data
  return emailWrapper(`
    <tr><td style="background:#fff;padding:32px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:24px">
        <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#00bb8818;text-align:center;line-height:48px;font-size:22px;margin-bottom:12px">✓</div>
        <h1 style="margin:8px 0 4px;font-size:22px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Asztalfoglalás visszaigazolva!</h1>
        <p style="margin:0;color:#71717a;font-size:14px">Kedves <strong>${reservation.customer_name}</strong>, foglalásodat rögzítettük.</p>
      </td></tr></table>
      ${detailsTable(data)}
      ${reservation.notes ? `<p style="color:#71717a;font-size:13px;margin:0 0 24px"><strong>Megjegyzés:</strong> ${reservation.notes}</p>` : ''}
      ${cancelUrl ? `<p style="text-align:center;margin:0 0 24px"><a href="${cancelUrl}" style="color:#71717a;font-size:12px;text-decoration:underline">Foglalás lemondása</a></p>` : ''}
    </td></tr>`)
}

function notificationHtml(data: ReservationEmailData): string {
  const { reservation } = data
  return emailWrapper(`
    <tr><td style="background:#fff;padding:32px">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Új asztalfoglalás 🎉</h1>
      <p style="margin:0 0 16px;color:#71717a;font-size:14px"><strong>${reservation.customer_name}</strong> foglalt asztalt.</p>
      ${detailsTable(data)}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;padding:16px 20px">
        ${infoRow('Email', reservation.customer_email)}
        ${reservation.customer_phone ? infoRow('Telefon', reservation.customer_phone) : ''}
        ${reservation.notes ? infoRow('Megjegyzés', reservation.notes) : ''}
      </table>
    </td></tr>`)
}

function cancellationHtml(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  return emailWrapper(`
    <tr><td style="background:#fff;padding:32px">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:900;color:#09090b;letter-spacing:-0.5px">Foglalás lemondva</h1>
      <p style="margin:0 0 16px;color:#71717a;font-size:14px">Kedves <strong>${reservation.customer_name}</strong>, a(z) <strong>${restaurant.name}</strong> étteremhez tartozó foglalásodat lemondtuk.</p>
      ${detailsTable(data)}
    </td></tr>`)
}
