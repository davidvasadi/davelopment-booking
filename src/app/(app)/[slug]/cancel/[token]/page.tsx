import { getPayloadClient } from '@/lib/payload'
import type { Media, Reservation, Restaurant } from '@/payload/payload-types'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'
import { formatBookingDate } from '@/lib/emailLayout'
import { Button } from '@/components/ui-kit'
import { GuestResult, GuestShell } from '@/components/blocks/guest-pages'
import { GuestCancelActions } from '@/components/booking/GuestCancelActions'
import { brandImage, type BrandPlace } from '@/lib/brandImage'

/** Étterem: a foglalás lemondása a levél linkjéről (design 21.12) — az étterem logójával, a foglalás adataival. */
export default async function RestaurantCancelPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  const locale = await getLocale()
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'reservations', where: { cancel_token: { equals: token } }, depth: 1, limit: 1, overrideAccess: true })
  const r = res.docs[0] as Reservation | undefined
  const rest = r && typeof r.restaurant === 'object' ? (r.restaurant as Restaurant) : null
  const biz = rest ? { name: rest.name, logo: brandImage(rest as BrandPlace, 'email') } : null // logó / ikon (design 24.2)
  const home = `/${rest?.slug ?? slug}`

  if (!r) return <GuestShell biz={null}><GuestResult tone="bad" title={t(locale, 'public.cancel.invalidTitle')} text={t(locale, 'public.cancel.invalidBody')} /></GuestShell>
  if (r.status === 'cancelled') return <GuestShell biz={biz}><GuestResult tone="cell" title={t(locale, 'public.cancel.already')} text={t(locale, 'public.cancel.alreadyBody')}><Button variant="cell" href={home}>{t(locale, 'public.cancel.backToPlace')}</Button></GuestResult></GuestShell>

  const rows: [string, string][] = [
    [t(locale, 'public.cancel.when'), `${formatBookingDate(String(r.date).slice(0, 10), locale)} ${r.start_time}`],
    [t(locale, 'email.label.guests'), String(r.pax)],
  ]
  return (
    <GuestShell biz={biz}>
      <GuestCancelActions token={token} rows={rows} home={home} l={{
        title: t(locale, 'public.cancel.title'), confirm: t(locale, 'public.cancel.confirmDetail'), yes: t(locale, 'public.cancel.yes'), no: t(locale, 'public.cancel.no'),
        doneTitle: t(locale, 'public.cancel.doneTitle'), done: t(locale, 'public.cancel.done'), failed: t(locale, 'public.cancel.failed'), back: t(locale, 'public.cancel.backToPlace'),
      }} />
    </GuestShell>
  )
}
