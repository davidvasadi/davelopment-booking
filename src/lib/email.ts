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

interface BookingEmailData {
  booking: Booking
  salon: Salon
  service: Service
  staff: StaffMember
}

export async function sendBookingConfirmation(data: BookingEmailData) {
  const { booking, salon, service, staff } = data
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: booking.customer_email,
      subject: `Foglalás visszaigazolva — ${salon.name}`,
      html: bookingConfirmationHtml(data),
    })
  } catch (err) {
    console.error('[Email] Booking confirmation failed:', err)
  }
}

export async function sendNewBookingNotification(data: BookingEmailData) {
  const { booking, salon, service } = data
  if (!salon.email) return
  const resend = getResend()
  if (!resend) return
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: salon.email,
      subject: `Új foglalás: ${booking.customer_name} — ${booking.date} ${booking.start_time}`,
      html: newBookingNotificationHtml(data),
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

function bookingConfirmationHtml({ booking, salon, service, staff }: BookingEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1d4ed8">Foglalás visszaigazolva!</h2>
      <p>Kedves <strong>${booking.customer_name}</strong>!</p>
      <p>Foglalásod sikeresen rögzítettük.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#6b7280">Szalon</td><td><strong>${salon.name}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Szolgáltatás</td><td><strong>${service.name}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Munkatárs</td><td><strong>${staff.name}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Dátum</td><td><strong>${booking.date}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Időpont</td><td><strong>${booking.start_time} – ${booking.end_time}</strong></td></tr>
        ${salon.address ? `<tr><td style="padding:8px 0;color:#6b7280">Cím</td><td>${salon.address}, ${salon.city ?? ''}</td></tr>` : ''}
      </table>
      <p style="color:#6b7280;font-size:14px">Ha le szeretnéd mondani a foglalást, kérjük vedd fel a kapcsolatot a szalonnal.</p>
    </div>
  `
}

function newBookingNotificationHtml({ booking, service, staff }: BookingEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1d4ed8">Új foglalás érkezett!</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#6b7280">Ügyfél</td><td><strong>${booking.customer_name}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Telefon</td><td>${booking.customer_phone}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Email</td><td>${booking.customer_email}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Szolgáltatás</td><td><strong>${service.name}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Munkatárs</td><td>${staff.name}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Dátum</td><td><strong>${booking.date}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Időpont</td><td><strong>${booking.start_time} – ${booking.end_time}</strong></td></tr>
        ${booking.notes ? `<tr><td style="padding:8px 0;color:#6b7280">Megjegyzés</td><td>${booking.notes}</td></tr>` : ''}
      </table>
    </div>
  `
}

function cancellationHtml({ booking, salon, service }: BookingEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626">Foglalás lemondva</h2>
      <p>Kedves <strong>${booking.customer_name}</strong>!</p>
      <p>Az alábbi foglalásod lemondásra került:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 0;color:#6b7280">Szalon</td><td>${salon.name}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Szolgáltatás</td><td>${service.name}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Dátum</td><td>${booking.date} ${booking.start_time}</td></tr>
      </table>
    </div>
  `
}
