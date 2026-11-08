import { getPayloadClient } from '@/lib/payload'
import type { Media, Salon, Service, StaffMember } from '@/payload/payload-types'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'
import { formatBookingDate } from '@/lib/emailLayout'
import { Button } from '@/components/ui-kit'
import { GuestResult, GuestShell } from '@/components/blocks/guest-pages'
import { brandImage, type BrandPlace } from '@/lib/brandImage'

/**
 * Szalon: a lemondás megerősítése (a visszaigazoló / emlékeztető levél „Foglalás lemondása” linkje) — design 21.12.
 * A lemondás űrlappal (POST) megy, nem linkkel: a link-előtöltés (prefetch) különben már a megjelenéskor lemondaná.
 */
export default async function ConfirmCancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const locale = await getLocale()
  const payload = await getPayloadClient()
  const result = await payload.find({ collection: 'bookings', where: { cancellation_token: { equals: token } }, depth: 2, limit: 1, overrideAccess: true })
  const booking = result.docs[0]

  const salon = booking && typeof booking.salon === 'object' ? (booking.salon as Salon) : null
  const biz = salon ? { name: salon.name, logo: brandImage(salon as BrandPlace, 'email') } : null // logó / ikon (design 24.2)
  const home = salon?.slug ? `/${salon.slug}` : '/'

  if (!booking) {
    return <GuestShell biz={null}><GuestResult tone="bad" title={t(locale, 'public.cancel.invalidTitle')} text={t(locale, 'public.cancel.invalidBody')} /></GuestShell>
  }
  if (booking.status === 'cancelled') {
    return <GuestShell biz={biz}><GuestResult tone="cell" title={t(locale, 'public.cancel.already')} text={t(locale, 'public.cancel.alreadyBody')}><Button variant="cell" href={home}>{t(locale, 'public.cancel.backToPlace')}</Button></GuestResult></GuestShell>
  }
  if (booking.status === 'completed') {
    return <GuestShell biz={biz}><GuestResult tone="cell" title={t(locale, 'public.cancel.cannot')} text={t(locale, 'public.cancel.cannotBody')}><Button variant="cell" href={home}>{t(locale, 'public.cancel.backToPlace')}</Button></GuestResult></GuestShell>
  }

  const service = typeof booking.service === 'object' ? (booking.service as Service) : null
  const staff = typeof booking.staff === 'object' ? (booking.staff as StaffMember) : null
  const rows: [string, string][] = [
    ...(service ? [[t(locale, 'email.label.service'), service.name] as [string, string]] : []),
    ...(staff ? [[t(locale, 'email.label.staff'), staff.name] as [string, string]] : []),
    [t(locale, 'public.cancel.when'), `${formatBookingDate(String(booking.date).slice(0, 10), locale)} ${booking.start_time}`],
  ]
  return (
    <GuestShell biz={biz}>
      <GuestResult tone="warn" title={t(locale, 'public.cancel.title')} text={t(locale, 'public.cancel.confirmDetail')} rows={rows}>
        <form action={`/api/cancel/${encodeURIComponent(token)}`} method="post" className="contents">
          <Button type="submit" variant="danger" className="w-full">{t(locale, 'public.cancel.yes')}</Button>
        </form>
        <Button variant="cell" href={home}>{t(locale, 'public.cancel.no')}</Button>
      </GuestResult>
    </GuestShell>
  )
}
