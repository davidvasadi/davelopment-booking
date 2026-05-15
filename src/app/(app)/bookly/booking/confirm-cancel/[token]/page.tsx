import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Service, StaffMember } from '@/payload/payload-types'

export default async function ConfirmCancelPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
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
          <h1 className="text-2xl font-black text-white tracking-tight">Érvénytelen link</h1>
          <p className="text-zinc-500 text-sm">Ez a lemondási link nem érvényes vagy már lejárt.</p>
          <Link href="/" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            Vissza a főoldalra
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
          <h1 className="text-2xl font-black text-white tracking-tight">Már lemondva</h1>
          <p className="text-zinc-500 text-sm">Ez a foglalás korábban már lemondásra került.</p>
          <Link href="/" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            Vissza a főoldalra
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
          <h1 className="text-2xl font-black text-white tracking-tight">Nem mondható le</h1>
          <p className="text-zinc-500 text-sm">Egy már lezajlott foglalást nem lehet lemondani.</p>
          <Link href="/" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            Vissza a főoldalra
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
          <h1 className="text-2xl font-black text-white tracking-tight">Foglalás lemondása</h1>
          <p className="text-zinc-500 text-sm">Biztosan le szeretnéd mondani az alábbi foglalást?</p>
        </div>

        <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 space-y-2.5">
          {salon && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Szalon</span>
              <span className="text-white font-medium">{salon.name}</span>
            </div>
          )}
          {service && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Szolgáltatás</span>
              <span className="text-white font-medium">{service.name}</span>
            </div>
          )}
          {staff && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Munkatárs</span>
              <span className="text-white font-medium">{staff.name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Időpont</span>
            <span className="text-white font-medium">{booking.date} {booking.start_time}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href={`/api/bookly/cancel/${token}`}
            className="block w-full h-12 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-sm flex items-center justify-center transition-colors"
          >
            Igen, mondom le
          </Link>
          <Link
            href={salonSlug ? `/bookly/${salonSlug}` : '/'}
            className="block w-full h-12 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold text-sm flex items-center justify-center transition-colors"
          >
            Mégsem
          </Link>
        </div>

      </div>
    </div>
  )
}
