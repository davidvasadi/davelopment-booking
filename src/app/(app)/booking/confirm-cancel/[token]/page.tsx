import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Service, StaffMember } from '@/payload/payload-types'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'

export default async function ConfirmCancelPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const locale = await getLocale()
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'bookings',
    where: { cancellation_token: { equals: token } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const booking = result.docs[0]

  if (!booking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="text-2xl text-red-400">✕</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'public.cancel.invalidTitle')}</h1>
          <p className="text-zinc-500 text-sm">{t(locale, 'public.cancel.invalidBody')}</p>
          <Link href="/" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            {t(locale, 'public.cancel.backHome')}
          </Link>
        </div>
      </div>
    )
  }

  if (booking.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-2xl text-zinc-400">✓</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'public.cancel.already')}</h1>
          <p className="text-zinc-500 text-sm">{t(locale, 'public.cancel.alreadyBody')}</p>
          <Link href="/" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            {t(locale, 'public.cancel.backHome')}
          </Link>
        </div>
      </div>
    )
  }

  if (booking.status === 'completed') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-2xl text-zinc-400">✕</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'public.cancel.cannot')}</h1>
          <p className="text-zinc-500 text-sm">{t(locale, 'public.cancel.cannotBody')}</p>
          <Link href="/" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            {t(locale, 'public.cancel.backHome')}
          </Link>
        </div>
      </div>
    )
  }

  const salon = typeof booking.salon === 'object' ? booking.salon as Salon : null
  const service = typeof booking.service === 'object' ? booking.service as Service : null
  const staff = typeof booking.staff === 'object' ? booking.staff as StaffMember : null
  const salonSlug = salon?.slug ?? ''

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'public.cancel.title')}</h1>
          <p className="text-zinc-500 text-sm">{t(locale, 'public.cancel.confirmDetail')}</p>
        </div>

        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 space-y-2.5">
          {salon && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">{t(locale, 'public.cancel.salon')}</span>
              <span className="text-white font-medium">{salon.name}</span>
            </div>
          )}
          {service && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">{t(locale, 'email.label.service')}</span>
              <span className="text-white font-medium">{service.name}</span>
            </div>
          )}
          {staff && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">{t(locale, 'email.label.staff')}</span>
              <span className="text-white font-medium">{staff.name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">{t(locale, 'public.cancel.when')}</span>
            <span className="text-white font-medium">{booking.date} {booking.start_time}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href={`/api/cancel/${token}`}
            className="block w-full h-12 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-sm flex items-center justify-center transition-colors"
          >
            {t(locale, 'public.cancel.yes')}
          </Link>
          <Link
            href={salonSlug ? `/${salonSlug}` : '/'}
            className="block w-full h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold text-sm flex items-center justify-center transition-colors"
          >
            {t(locale, 'public.cancel.no')}
          </Link>
        </div>

      </div>
    </div>
  )
}
