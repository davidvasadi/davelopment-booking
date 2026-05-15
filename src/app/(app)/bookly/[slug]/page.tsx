import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Service, ServiceCategory, StaffMember, Media } from '@/payload/payload-types'
import { MapPin, Phone, Mail, Globe, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import PublicServicesSection from '@/components/PublicServicesSection'

const AVATAR_GRADIENTS = [
  'from-violet-400 to-purple-600',
  'from-blue-400 to-cyan-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-600',
  'from-pink-400 to-fuchsia-600',
  'from-amber-400 to-orange-600',
]
function avatarGradient(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

export default async function SalonPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
    depth: 2,
    limit: 1,
  })

  if (!salonResult.docs.length) notFound()
  const salon = salonResult.docs[0] as Salon

  const [servicesResult, staffResult, categoriesResult] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
    }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
    }),
    payload.find({
      collection: 'service-categories',
      where: { salon: { equals: salon.id } },
      sort: 'sort_order',
      depth: 1,
      limit: 100,
    }),
  ])

  const services = servicesResult.docs as Service[]
  const staff = staffResult.docs as StaffMember[]
  const serviceCategories = categoriesResult.docs as ServiceCategory[]

  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object'
    ? (salon.cover_image as Media).url ?? null
    : null
  const logoUrl = salon.logo && typeof salon.logo === 'object'
    ? (salon.logo as Media).url ?? null
    : null

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      {/* Hero */}
      <div className="relative bg-zinc-950 overflow-hidden">
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <div className="relative max-w-3xl mx-auto px-5 pt-12 pb-10">
          {logoUrl && (
            <img src={logoUrl} alt={salon.name} className="h-12 w-12 rounded-xl object-cover mb-4 ring-1 ring-white/10" />
          )}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Online foglalás</p>
          <h1 className="text-4xl font-black tracking-tight text-white leading-tight">{salon.name}</h1>
          {(salon.address || salon.city) && (
            <p className="flex items-center gap-1.5 text-zinc-400 text-sm mt-3">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {[salon.address, salon.city].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-4">
            {salon.phone && (
              <a href={`tel:${salon.phone}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Phone className="h-3 w-3" />{salon.phone}
              </a>
            )}
            {salon.email && (
              <a href={`mailto:${salon.email}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Mail className="h-3 w-3" />{salon.email}
              </a>
            )}
            {salon.website && (
              <a href={salon.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Globe className="h-3 w-3" />Weboldal
              </a>
            )}
          </div>
          <Link
            href={`/bookly/${slug}/book`}
            className="inline-flex items-center gap-2 mt-6 h-12 px-7 rounded-full bg-white text-zinc-950 font-bold text-sm hover:bg-zinc-100 transition-colors"
          >
            Időpontfoglalás <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-10 space-y-10">

        {/* Services with category tabs */}
        {services.length > 0 && (
          <PublicServicesSection
            services={services}
            serviceCategories={serviceCategories}
            slug={slug}
          />
        )}

        {/* Staff */}
        {staff.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Csapatunk</p>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-5">Munkatársak</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {staff.map(m => {
                const avatarUrl = m.avatar && typeof m.avatar === 'object'
                  ? (m.avatar as Media).url ?? null
                  : null
                return (
                  <Link
                    key={m.id}
                    href={`/bookly/${slug}/book?staffId=${m.id}`}
                    className="relative rounded-3xl aspect-[3/4] group block overflow-hidden"
                  >
                    <div className="absolute inset-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={m.name} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${avatarGradient(m.name)} flex items-center justify-center`}>
                          <span className="text-6xl font-black text-white/20 select-none">
                            {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 border border-white/35 flex items-center justify-center">
                      <ChevronRight className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
                      <p className="text-white font-black text-sm leading-tight">{m.name}</p>
                      {m.bio && <p className="text-white/70 text-xs mt-0.5">{m.bio}</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <div className="bg-zinc-950 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-black text-lg">{salon.name}</p>
            <p className="text-zinc-500 text-sm mt-0.5">Foglalja le a következő időpontját online</p>
          </div>
          <Link
            href={`/bookly/${slug}/book`}
            className="py-3 px-7 rounded-full bg-white text-zinc-950 font-bold text-sm hover:bg-zinc-100 transition-colors whitespace-nowrap"
          >
            Időpontfoglalás
          </Link>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-5 py-3">
        <Link
          href={`/bookly/${slug}/book`}
          className="flex items-center justify-center w-full h-12 rounded-full bg-zinc-950 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
        >
          Időpontfoglalás
        </Link>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  )
}
