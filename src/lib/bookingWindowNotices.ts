import 'server-only'
import type { BasePayload } from 'payload'
import type { Media, Restaurant, Salon, User } from '@/payload/payload-types'
import { WINDOW_NOTICE_DAYS, addDays, budapestToday, daysBetween, effectiveWindowEnd, huDate, periodEndFrom, windowLength } from './bookingWindow'
import { sendBookingWindowEmail } from './email'
import { sendPushToUsers } from './webPush'
import { brandImage, type BrandPlace } from './brandImage'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

type Kind = 'salon' | 'restaurant'
type Place = Salon | Restaurant

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const relId = (v: unknown): string | null =>
  v == null ? null : typeof v === 'object' ? String((v as { id: string | number }).id) : String(v)

function logoUrl(place: Place): string | null {
  // logó / ikon — a tulaj választása a levelekre (design 24.2, lib/brandImage)
  const url = brandImage(place as BrandPlace, 'email')
  if (!url) return null
  return url.startsWith('http') ? url : `${APP_URL}${url}`
}

async function notifyOwner(
  payload: BasePayload,
  kind: Kind,
  place: Place,
  msg: { title: string; body: string; email?: { subject: string; subtitle: string; paragraphs: string[] } },
) {
  const settingsUrl = `${kind === 'salon' ? '/dashboard' : '/restaurant'}/settings?tab=site`
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { [kind]: Number(place.id), audience: 'owner', type: 'booking_window', title: msg.title, body: msg.body, read: false },
  })
  const ownerId = relId(place.owner)
  if (!ownerId) return
  try {
    await sendPushToUsers(payload, [ownerId], { title: msg.title, body: msg.body, url: settingsUrl, tag: `booking-window-${kind}-${place.id}` })
  } catch (err) {
    payload.logger.error(`[bookingWindow] push hiba (${kind} ${place.id}): ${String(err)}`)
  }
  if (!msg.email) return
  const owner = (await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null
  const to = owner?.email || place.email
  if (!to) return
  await sendBookingWindowEmail({
    businessName: place.name,
    slug: place.slug,
    logoUrl: logoUrl(place),
    to,
    subject: msg.email.subject,
    title: msg.title,
    subtitle: msg.email.subtitle,
    paragraphs: msg.email.paragraphs,
    ctaLabel: 'Foglalóoldal megnyitása',
    ctaUrl: `${APP_URL}${settingsUrl}`,
  })
}

/**
 * Egy időszakos megnyitású üzlet napi teendői (idempotens — a percenkénti cron is hívhatja):
 *  1. nincs még időszak-vége → mától indul egy időszak;
 *  2. lejárt és megújul → elmenti az új időszak-végét, és szól a tulajnak;
 *  3. a vége ≤ 7 napon belül → egyszer „hamarosan lejár” értesítés (app + push + e-mail).
 */
export async function processPlaceBookingWindow(payload: BasePayload, kind: Kind, place: Place, today: string = budapestToday()) {
  if (!place.booking_window_periodic) return { renewed: false, noticed: false }
  const patch: Record<string, string> = {}
  let end = place.booking_window_end
  let renewed = false
  let noticed = false

  if (!isIsoDate(end)) {
    end = periodEndFrom(place, today)
    patch.booking_window_end = end
  } else if (end < today && place.booking_window_auto_renew !== false) {
    const newEnd = effectiveWindowEnd(place, today) as string
    const from = addDays(newEnd, -(windowLength(place) - 1))
    patch.booking_window_end = newEnd
    renewed = true
    await notifyOwner(payload, kind, place, {
      title: 'Megnyílt az új foglalási időszak',
      body: `${huDate(from)} – ${huDate(newEnd)} között lehet foglalni.`,
    })
    end = newEnd
  }

  const left = daysBetween(today, end)
  if (left >= 0 && left <= WINDOW_NOTICE_DAYS && place.booking_window_notice_for !== end) {
    const renew = place.booking_window_auto_renew !== false
    const nextEnd = addDays(end, windowLength(place))
    const when = left === 0 ? 'ma' : left === 1 ? 'holnap' : `${left} nap múlva`
    const body = renew
      ? `A foglalási időszak ${when} lejár (${huDate(end)}). Automatikusan megújul (új időszak: ${huDate(addDays(end, 1))} – ${huDate(nextEnd)}).`
      : `A foglalási időszak ${when} lejár (${huDate(end)}). Utána a vendégek nem tudnak új időpontot foglalni, amíg nem indítasz új időszakot.`
    await notifyOwner(payload, kind, place, {
      title: 'Hamarosan lejár a foglalási időszak',
      body,
      email: {
        subject: `Hamarosan lejár a foglalási időszak – ${place.name}`,
        subtitle: `${place.name} · utolsó foglalható nap: ${huDate(end)}`,
        paragraphs: renew
          ? [body, 'Nincs teendőd. Ha mégsem szeretnéd megújítani, a Foglalóoldal → Időpont lépésnél kikapcsolhatod az automatikus megújítást.']
          : [body, 'Új időszakot a Foglalóoldal → Időpont lépésnél indíthatsz, vagy bekapcsolhatod az automatikus megújítást.'],
      },
    })
    patch.booking_window_notice_for = end
    noticed = true
  }

  if (Object.keys(patch).length > 0) {
    await payload.update({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: place.id, data: patch, overrideAccess: true, depth: 0 })
  }
  return { renewed, noticed }
}

/** Minden időszakos megnyitású szalon és étterem (a notifications cron hívja). */
export async function processBookingWindows(payload: BasePayload) {
  const summary = { checked: 0, renewed: 0, noticed: 0, errors: 0 }
  const today = budapestToday()
  for (const kind of ['salon', 'restaurant'] as const) {
    const res = await payload.find({
      collection: kind === 'salon' ? 'salons' : 'restaurants',
      where: { booking_window_periodic: { equals: true } },
      depth: 1,
      limit: 1000,
      overrideAccess: true,
    })
    for (const place of res.docs as Place[]) {
      summary.checked++
      try {
        const r = await processPlaceBookingWindow(payload, kind, place, today)
        if (r.renewed) summary.renewed++
        if (r.noticed) summary.noticed++
      } catch (err) {
        summary.errors++
        payload.logger.error(`[bookingWindow] ${kind} ${place.id} hiba: ${String(err)}`)
      }
    }
  }
  return summary
}
