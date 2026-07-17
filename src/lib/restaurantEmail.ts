import { Resend } from 'resend'
import type { Restaurant, Reservation, Media } from '@/payload/payload-types'
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
import { logEmail } from './emailLog'

let _resend: Resend | null = null
let _warnedNoKey = false
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    // Ne némán: jelezzük (egyszer), hogy a tranzakciós emailek NEM mennek ki — különben a
    // tulaj sose tudja meg, hogy a vendégek nem kapnak visszaigazolást.
    if (!_warnedNoKey) {
      console.warn('[RestaurantEmail] RESEND_API_KEY nincs beállítva — a tranzakciós emailek NEM mennek ki.')
      _warnedNoKey = true
    }
    return null
  }
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu'
const FROM_NAME = process.env.RESEND_FROM_NAME ?? 'davelopment booking'
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
  const uid = `reservation-${reservation.id}@davelopment`
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const [y, m, d] = reservation.date.split('-')
  const [sh, sm] = reservation.start_time.split(':')
  const [eh, em] = reservation.end_time.split(':')
  const location = restaurant.address ? `${restaurant.address}${restaurant.city ? ', ' + restaurant.city : ''}` : ''
  const description = `${reservation.pax} fő${restaurant.phone ? '\\nTelefon: ' + restaurant.phone : ''}`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//davelopment booking//HU',
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
    await logEmail('booking_confirmation', reservation.customer_email, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Confirmation failed:', err)
    await logEmail('booking_confirmation', reservation.customer_email, subject, false, String(err))
  }
}

export async function sendReservationNotification(data: ReservationEmailData, fallbackTo?: string) {
  const { restaurant } = data
  // Az üzlet kapcsolati e-mailje, vagy ha üres, a megadott tartalék (pl. a tulaj fiók-emailje).
  const to = restaurant.email || fallbackTo
  if (!to) return
  const resend = getResend()
  if (!resend) return
  const subject = `Új asztalfoglalás: ${data.reservation.customer_name} — ${data.reservation.date} ${data.reservation.start_time}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to,
      subject,
      html: notificationHtml(data),
    })
    await logEmail('new_booking', to, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Notification failed:', err)
    await logEmail('new_booking', to, subject, false, String(err))
  }
}

export async function sendReservationCancellation(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend) return
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  const subjectTpl = (restaurant.cancel_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : t(locale, 'email.cancel.subjectFallback', { place: restaurant.name })
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject,
      html: cancellationHtml(data),
    })
    await logEmail('cancellation', reservation.customer_email, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Cancellation failed:', err)
    await logEmail('cancellation', reservation.customer_email, subject, false, String(err))
  }
}

export async function sendReminderEmail(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend || !reservation.customer_email) return
  const subjectTpl = (restaurant.reminder_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : `Emlékeztető: közeleg a foglalásod – ${restaurant.name}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject,
      html: reminderHtml(data),
    })
    await logEmail('reminder', reservation.customer_email, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Reminder failed:', err)
    await logEmail('reminder', reservation.customer_email, subject, false, String(err))
  }
}

export async function sendFeedbackRequestEmail(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend || !reservation.customer_email) return
  const subjectTpl = (restaurant.feedback_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : `Milyen volt nálunk? Értékeld a látogatásod – ${restaurant.name}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: reservation.customer_email,
      subject,
      html: feedbackHtml(data),
    })
    await logEmail('feedback', reservation.customer_email, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Feedback request failed:', err)
    await logEmail('feedback', reservation.customer_email, subject, false, String(err))
  }
}

// ── Waitlist (várólista) ──────────────────────────────────────────────────────

export interface WaitlistEmailData {
  restaurant: Restaurant
  customer_name: string
  customer_email: string
  date: string
  time: string
  pax?: number | null
  /** A „foglald le” link — alapból az étterem publikus oldala. */
  bookUrl?: string | null
}

/** Feliratkozás-visszaigazolás: „feliratkoztál a várólistára”. */
export async function sendWaitlistSignupEmail(data: WaitlistEmailData) {
  const resend = getResend()
  if (!resend) return
  const subject = `Felkerültél a várólistára – ${data.restaurant.name}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: data.customer_email,
      subject,
      html: wrap(data.restaurant, `
        ${heroBlock({
          icon: 'bell',
          title: 'Felkerültél a várólistára',
          subtitle: `Kedves ${data.customer_name}, értesítünk, ha felszabadul egy asztal.`,
        })}
        ${detailsCard([
          infoRow('calendar', 'Dátum', data.date),
          infoRow('clock', 'Kért időpont', data.time),
          data.pax ? infoRow('people', 'Fő', `${data.pax} fő`) : '',
        ].filter(Boolean).join(''))}
        ${bottomSpacer()}
      `),
    })
    await logEmail('waitlist_signup', data.customer_email, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Waitlist signup failed:', err)
    await logEmail('waitlist_signup', data.customer_email, subject, false, String(err))
  }
}

/** Hely-felszabadulás értesítő: „felszabadult hely — foglald le”. */
export async function sendWaitlistOpeningEmail(data: WaitlistEmailData) {
  const resend = getResend()
  if (!resend) return
  const bookUrl = data.bookUrl ?? `${APP_URL}/${data.restaurant.slug}`
  const subject = `Felszabadult egy asztal – ${data.restaurant.name}`
  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: data.customer_email,
      subject,
      html: wrap(data.restaurant, `
        ${heroBlock({
          icon: 'bell',
          title: 'Felszabadult egy asztal',
          subtitle: `Kedves ${data.customer_name}, a kért időpontod körül felszabadult egy asztal. Foglald le, amíg elérhető!`,
        })}
        ${detailsCard([
          infoRow('calendar', 'Dátum', data.date),
          infoRow('clock', 'Időpont', data.time),
          data.pax ? infoRow('people', 'Fő', `${data.pax} fő`) : '',
        ].filter(Boolean).join(''))}
        <tr>
          <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
            <a href="${bookUrl}" style="display:inline-block;background:${COLORS.accent};color:#3B3B3B;font-size:13px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:999px;letter-spacing:-0.1px">Asztalfoglalás</a>
          </td>
        </tr>
        ${bottomSpacer()}
      `),
    })
    await logEmail('waitlist_opening', data.customer_email, subject, true)
  } catch (err) {
    console.error('[RestaurantEmail] Waitlist opening failed:', err)
    await logEmail('waitlist_opening', data.customer_email, subject, false, String(err))
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
    reservation.occasion ? infoRow('sparkle', t(locale, 'email.label.occasion'), reservation.occasion) : '',
    location ? infoRow('pin', t(locale, 'email.label.address'), location) : '',
  ].filter(Boolean).join('')
}

function confirmationHtml(data: ReservationEmailData, cancelUrl: string | null): string {
  const { reservation, restaurant } = data
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  const logoUrl = mediaUrl(restaurant.logo)
  const coverUrl = mediaUrl(restaurant.cover_image)
  return emailLayout({
    brandName: restaurant.name,
    brandLogoUrl: logoUrl,
    brandCoverUrl: coverUrl,
    header: brandHeroBlock({
      brandName: restaurant.name,
      brandLogoUrl: logoUrl,
      brandCoverUrl: coverUrl,
      icon: 'success',
      title: t(locale, 'email.confirm.title'),
      subtitle: t(locale, 'email.greeting', { name: reservation.customer_name }),
      formattedDate: formatBookingDate(reservation.date, locale),
      time: `${reservation.start_time} – ${reservation.end_time}`,
    }),
    content: `
      ${introBlock(restaurant.booking_email_intro ?? '', emailVars(data))}
      ${detailsCard(detailRows(data))}
      ${reservation.notes ? `<tr><td style="background:${COLORS.surface};padding:16px 28px 0">
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
    `,
  })
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

function reminderHtml(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'bell',
      title: 'Közeleg a foglalásod',
      subtitle: `Kedves ${reservation.customer_name}, csak hogy emlékeztessünk: hamarosan várunk!`,
    })}
    ${introBlock(restaurant.reminder_email_intro ?? '', emailVars(data))}
    ${detailsCard(detailRows(data))}
    ${calendarBlock({
      title: `${t(locale, 'rbooking.header')} – ${restaurant.name}`,
      date: reservation.date,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      location: contactAddress(restaurant),
      description: `${reservation.pax} ${t(locale, 'email.label.guests').toLowerCase()}`,
      locale,
    })}
    ${bottomSpacer()}
  `)
}

function feedbackHtml(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  // Ha az étterem megadott Google értékelés-linket, oda visz (nyilvános review); különben a belső /review.
  const googleUrl = (restaurant.feature_modules?.google_review_url ?? '').trim()
  const reviewUrl = googleUrl || (reservation.cancel_token
    ? `${APP_URL}/review/${reservation.cancel_token}`
    : `${APP_URL}/${restaurant.slug}`)
  const reviewCta = googleUrl ? 'Értékelj minket a Google-on' : 'Értékelem a látogatásom'
  const rows = [
    infoRow('calendar', 'Dátum', reservation.date),
    infoRow('people', 'Fő', `${reservation.pax} fő`),
  ].join('')
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'bell',
      title: 'Milyen volt nálunk?',
      subtitle: `Kedves ${reservation.customer_name}, reméljük jól érezted magad. Mondd el a véleményed!`,
    })}
    ${introBlock(restaurant.feedback_email_intro ?? '', emailVars(data))}
    ${detailsCard(rows)}
    <tr>
      <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
        <a href="${reviewUrl}" style="display:inline-block;background:${COLORS.accent};color:#3B3B3B;font-size:13px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:999px;letter-spacing:-0.1px">${reviewCta}</a>
      </td>
    </tr>
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
    ${introBlock(restaurant.cancel_email_intro ?? '', emailVars(data))}
    ${detailsCard(detailRows(data))}
    ${bottomSpacer()}
  `)
}
