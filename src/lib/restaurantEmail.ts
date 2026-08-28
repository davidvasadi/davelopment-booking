import { Resend } from 'resend'
import type { Restaurant, Reservation, Media } from '@/payload/payload-types'
import {
  emailLayout,
  brandHeroBlock,
  heroBlock,
  detailsCard,
  infoRow,
  cancelBlock,
  footerInfoBlock,
  calendarBlock,
  formatBookingDate,
  bottomSpacer,
  renderSubject,
  escapeHtml,
  COLORS,
} from './emailLayout'
import { introBlockFromJson } from './emailBlocks'
import { t, normalizeLocale } from './i18n'
import { logEmail } from './emailLog'
import { formatPrice } from './utils'
import { getPayloadClient } from './payload'
import { isInternalEmailAllowed } from './emailNotifPrefs'

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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/** RFC 5322 "From" fejléc az üzlet nevével megjelenítési névként (idézőjelezve, hogy a névben lévő speciális karakter — vessző, idézőjel — ne törje el a fejlécet). */
function fromHeader(name: string): string {
  return `"${name.replace(/"/g, '\\"')}" <${FROM}>`
}

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
  if (restaurant.email_show_terms === false) return false
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
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(restaurant.name),
      reply_to: restaurant.email || undefined,
      to: reservation.customer_email,
      subject,
      html: confirmationHtml(data, cancelUrl),
      attachments: [{ filename: 'foglalas.ics', content: Buffer.from(generateICS(data)) }],
    })
    await logEmail('booking_confirmation', reservation.customer_email, subject, true, undefined, { resendId: sendResult?.id, reservationId: reservation.id })
  } catch (err) {
    console.error('[RestaurantEmail] Confirmation failed:', err)
    await logEmail('booking_confirmation', reservation.customer_email, subject, false, String(err), { reservationId: reservation.id })
  }
}

export async function sendReservationNotification(data: ReservationEmailData, fallbackTo?: string) {
  const { restaurant } = data
  // Az üzlet kapcsolati e-mailje, vagy ha üres, a megadott tartalék (pl. a tulaj fiók-emailje).
  const to = restaurant.email || fallbackTo
  if (!to) return
  // Az "Új foglalás" belső email SAJÁT, alapból KIKAPCSOLT preferencia mögött van
  // (Users.personal_notif_prefs.bookings_email) — az app/push a fő csatorna, ez csak opt-in.
  const payload = await getPayloadClient()
  if (!(await isInternalEmailAllowed(payload, to, 'bookings_email'))) return
  const resend = getResend()
  if (!resend) return
  const subjectTpl = (restaurant.notify_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : `Új asztalfoglalás: ${data.reservation.customer_name} — ${data.reservation.date} ${data.reservation.start_time}`
  try {
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(restaurant.name),
      to,
      subject,
      html: notificationHtml(data),
    })
    await logEmail('new_booking', to, subject, true, undefined, { resendId: sendResult?.id, reservationId: data.reservation.id })
  } catch (err) {
    console.error('[RestaurantEmail] Notification failed:', err)
    await logEmail('new_booking', to, subject, false, String(err), { reservationId: data.reservation.id })
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
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(restaurant.name),
      reply_to: restaurant.email || undefined,
      to: reservation.customer_email,
      subject,
      html: cancellationHtml(data),
    })
    await logEmail('cancellation', reservation.customer_email, subject, true, undefined, { resendId: sendResult?.id, reservationId: reservation.id })
  } catch (err) {
    console.error('[RestaurantEmail] Cancellation failed:', err)
    await logEmail('cancellation', reservation.customer_email, subject, false, String(err), { reservationId: reservation.id })
  }
}

export async function sendReminderEmail(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend || !reservation.customer_email) return
  const cancelUrl = reservation.cancel_token
    ? `${APP_URL}/${restaurant.slug}/cancel/${reservation.cancel_token}`
    : null
  const subjectTpl = (restaurant.reminder_email_subject ?? '').trim()
  const subject = subjectTpl
    ? renderSubject(subjectTpl, emailVars(data))
    : `Emlékeztető: közeleg a foglalásod – ${restaurant.name}`
  try {
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(restaurant.name),
      reply_to: restaurant.email || undefined,
      to: reservation.customer_email,
      subject,
      html: reminderHtml(data, cancelUrl),
    })
    await logEmail('reminder', reservation.customer_email, subject, true, undefined, { resendId: sendResult?.id, reservationId: reservation.id })
  } catch (err) {
    console.error('[RestaurantEmail] Reminder failed:', err)
    await logEmail('reminder', reservation.customer_email, subject, false, String(err), { reservationId: reservation.id })
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
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(restaurant.name),
      reply_to: restaurant.email || undefined,
      to: reservation.customer_email,
      subject,
      html: feedbackHtml(data),
    })
    await logEmail('feedback', reservation.customer_email, subject, true, undefined, { resendId: sendResult?.id, reservationId: reservation.id })
  } catch (err) {
    console.error('[RestaurantEmail] Feedback request failed:', err)
    await logEmail('feedback', reservation.customer_email, subject, false, String(err), { reservationId: reservation.id })
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
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(data.restaurant.name),
      reply_to: data.restaurant.email || undefined,
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
    await logEmail('waitlist_signup', data.customer_email, subject, true, undefined, { resendId: sendResult?.id })
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
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(data.restaurant.name),
      reply_to: data.restaurant.email || undefined,
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
    await logEmail('waitlist_opening', data.customer_email, subject, true, undefined, { resendId: sendResult?.id })
  } catch (err) {
    console.error('[RestaurantEmail] Waitlist opening failed:', err)
    await logEmail('waitlist_opening', data.customer_email, subject, false, String(err))
  }
}

// ── Ajándékutalvány ────────────────────────────────────────────────────────────

export interface VoucherEmailData {
  restaurant: Restaurant
  code: string
  amountHuf: number
  qrCodeDataUrl: string
  purchaserName: string
  purchaserEmail: string
  recipientName?: string | null
  recipientEmail?: string | null
  message?: string | null
}

function voucherHtml(data: VoucherEmailData, forRecipient: boolean): string {
  const subtitle = forRecipient
    ? `${data.purchaserName} ajándékutalvánnyal lepett meg — ${data.restaurant.name}-nél váltható be.`
    : `Köszönjük a vásárlást — az utalvány kódját alább, illetve a mellékelt QR-kóddal is átadhatod.`
  return wrap(data.restaurant, `
    ${heroBlock({
      icon: 'success',
      title: forRecipient ? 'Ajándékutalványt kaptál!' : 'Ajándékutalvány megvásárolva',
      subtitle,
    })}
    ${detailsCard([
      infoRow('sparkle', 'Kód', data.code),
      infoRow('note', 'Összeg', formatPrice(data.amountHuf, 'HUF')),
      ...(data.message ? [infoRow('mail', 'Üzenet', escapeHtml(data.message))] : []),
    ].join(''))}
    <tr>
      <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
        <img src="${data.qrCodeDataUrl}" width="180" height="180" alt="QR-kód a beváltáshoz" style="display:inline-block;border-radius:12px" />
      </td>
    </tr>
    ${bottomSpacer()}
  `)
}

/** Vásárlás-visszaigazolás a vásárlónak (mindig kimegy). */
export async function sendVoucherPurchaseEmail(data: VoucherEmailData) {
  const resend = getResend()
  if (!resend) return
  const subject = `Ajándékutalvány megvásárolva – ${data.restaurant.name}`
  try {
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(data.restaurant.name),
      reply_to: data.restaurant.email || undefined,
      to: data.purchaserEmail,
      subject,
      html: voucherHtml(data, false),
    })
    await logEmail('voucher_purchase', data.purchaserEmail, subject, true, undefined, { resendId: sendResult?.id })
  } catch (err) {
    console.error('[RestaurantEmail] Voucher purchase failed:', err)
    await logEmail('voucher_purchase', data.purchaserEmail, subject, false, String(err))
  }
}

/** Maga az ajándék a megajándékozottnak — csak akkor hívjuk, ha `recipient_email` van megadva. */
export async function sendVoucherGiftEmail(data: VoucherEmailData) {
  const resend = getResend()
  if (!resend || !data.recipientEmail) return
  const subject = `Ajándékutalványt kaptál – ${data.restaurant.name}`
  try {
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(data.restaurant.name),
      reply_to: data.restaurant.email || undefined,
      to: data.recipientEmail,
      subject,
      html: voucherHtml(data, true),
    })
    await logEmail('voucher_purchase', data.recipientEmail, subject, true, undefined, { resendId: sendResult?.id })
  } catch (err) {
    console.error('[RestaurantEmail] Voucher gift failed:', err)
    await logEmail('voucher_purchase', data.recipientEmail, subject, false, String(err))
  }
}

/** A dashboardból (személyzet) kiállított fizetési link elküldése a vásárlónak emailben — a
 *  vendég a linkről fizet, a kód/QR csak sikeres fizetés után, KÜLÖN emailben megy (lásd fent). */
export async function sendVoucherPaymentLinkEmail(data: { restaurant: Restaurant; purchaserName: string; purchaserEmail: string; amountHuf: number; typeName?: string | null; url: string }) {
  const resend = getResend()
  if (!resend) return
  const subject = `Fizetési link – ajándékutalvány – ${data.restaurant.name}`
  const html = wrap(data.restaurant, `
    ${heroBlock({
      icon: 'success',
      title: 'Ajándékutalvány fizetése',
      subtitle: `${data.restaurant.name} elküldte a fizetési linket${data.typeName ? ` (${escapeHtml(data.typeName)})` : ''} — ${formatPrice(data.amountHuf, 'HUF')}.`,
    })}
    <tr>
      <td style="background:${COLORS.surface};padding:22px 28px 0;text-align:center">
        <a href="${data.url}" style="display:inline-block;background:${COLORS.accent};color:#3B3B3B;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;letter-spacing:-0.1px">Fizetés</a>
      </td>
    </tr>
    ${bottomSpacer()}
  `)
  try {
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(data.restaurant.name),
      reply_to: data.restaurant.email || undefined,
      to: data.purchaserEmail,
      subject,
      html,
    })
    await logEmail('voucher_purchase', data.purchaserEmail, subject, true, undefined, { resendId: sendResult?.id })
  } catch (err) {
    console.error('[RestaurantEmail] Voucher payment link failed:', err)
    await logEmail('voucher_purchase', data.purchaserEmail, subject, false, String(err))
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
      ${introBlockFromJson(restaurant.booking_email_intro, emailVars(data))}
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
        icsUrl: reservation.cancel_token
          ? `${APP_URL}/api/ics/reservation/${reservation.cancel_token}`
          : null,
        directionsAddress: restaurant.email_show_directions ? (restaurant.email_directions_address?.trim() || contactAddress(restaurant)) : null,
      })}
      ${footerInfoBlock({
        hasTerms: hasTerms(restaurant),
        bookingUrl: `${APP_URL}/${restaurant.slug}/terms`,
        phone: restaurant.email_show_phone ? (restaurant.email_contact_phone?.trim() || restaurant.phone) : null,
        email: restaurant.email_show_email ? restaurant.email : null,
        address: restaurant.email_show_address ? contactAddress(restaurant) : null,
        directionsAddress: null,
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
    ${introBlockFromJson(restaurant.notify_email_intro, emailVars(data))}
    ${detailsCard(detailRows(data))}
    ${detailsCard(contactRows)}
    ${bottomSpacer()}
  `)
}

function reminderHtml(data: ReservationEmailData, cancelUrl: string | null): string {
  const { reservation, restaurant } = data
  const locale = normalizeLocale((reservation as { locale?: string }).locale)
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'bell',
      title: 'Közeleg a foglalásod',
      subtitle: `Kedves ${reservation.customer_name}, csak hogy emlékeztessünk: hamarosan várunk!`,
    })}
    ${introBlockFromJson(restaurant.reminder_email_intro, emailVars(data))}
    ${detailsCard(detailRows(data))}
    ${calendarBlock({
      title: `${t(locale, 'rbooking.header')} – ${restaurant.name}`,
      date: reservation.date,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      location: contactAddress(restaurant),
      description: `${reservation.pax} ${t(locale, 'email.label.guests').toLowerCase()}`,
      locale,
      icsUrl: reservation.cancel_token
        ? `${APP_URL}/api/ics/reservation/${reservation.cancel_token}`
        : null,
      directionsAddress: restaurant.email_show_directions ? (restaurant.email_directions_address?.trim() || contactAddress(restaurant)) : null,
    })}
    ${cancelBlock(cancelUrl, locale)}
    ${bottomSpacer()}
  `)
}

function feedbackHtml(data: ReservationEmailData): string {
  const { reservation, restaurant } = data
  const cancelToken = (reservation as { cancel_token?: string }).cancel_token
  const reviewUrl = `${APP_URL}/review/${cancelToken}`
  const reviewCta = 'Értékelés'
  return wrap(restaurant, `
    ${heroBlock({
      icon: 'bell',
      title: 'Milyen volt nálunk?',
      subtitle: `Kedves ${reservation.customer_name}, reméljük jól érezted magad. Mondd el a véleményed!`,
    })}
    ${introBlockFromJson(restaurant.feedback_email_intro, emailVars(data))}
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
    ${introBlockFromJson(restaurant.cancel_email_intro, emailVars(data))}
    ${detailsCard(detailRows(data))}
    ${bottomSpacer()}
  `)
}

function modificationHtml(data: ReservationEmailData): string {
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
      icon: 'bell',
      title: 'Foglalásod módosítva',
      subtitle: `Kedves ${reservation.customer_name}, az alábbi foglalás adatai megváltoztak.`,
      formattedDate: formatBookingDate(reservation.date, locale),
      time: `${reservation.start_time} – ${reservation.end_time}`,
    }),
    content: `
      ${detailsCard(detailRows(data))}
      ${footerInfoBlock({
        hasTerms: hasTerms(restaurant),
        bookingUrl: `${APP_URL}/${restaurant.slug}/terms`,
        phone: restaurant.email_show_phone ? (restaurant.email_contact_phone?.trim() || restaurant.phone) : null,
        email: restaurant.email_show_email ? restaurant.email : null,
        address: restaurant.email_show_address ? contactAddress(restaurant) : null,
        directionsAddress: null,
        locale,
      })}
      ${bottomSpacer()}
    `,
  })
}

export async function sendReservationModification(data: ReservationEmailData) {
  const { reservation, restaurant } = data
  const resend = getResend()
  if (!resend) return
  const subject = `Foglalásod módosítva – ${restaurant.name}`
  try {
    const { data: sendResult } = await resend.emails.send({
      from: fromHeader(restaurant.name),
      reply_to: restaurant.email || undefined,
      to: reservation.customer_email,
      subject,
      html: modificationHtml(data),
    })
    await logEmail('modification', reservation.customer_email, subject, true, undefined, { resendId: sendResult?.id, reservationId: reservation.id })
  } catch (err) {
    console.error('[RestaurantEmail] Modification email failed:', err)
    await logEmail('modification', reservation.customer_email, subject, false, String(err), { reservationId: reservation.id })
  }
}
