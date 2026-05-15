'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, ArrowUpRight, ChevronLeft } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { Service, ServiceCategory, Media } from '@/payload/payload-types'

interface Props {
  services: Service[]
  serviceCategories: ServiceCategory[]
  slug: string
}

function categoryImageUrl(c: ServiceCategory): string | null {
  if (!c.image) return null
  if (typeof c.image === 'object') return (c.image as Media).url ?? null
  return null
}

function serviceImageUrl(s: Service): string | null {
  if (!s.image) return null
  if (typeof s.image === 'object') return (s.image as Media).url ?? null
  return null
}

const FALLBACK_GRADIENTS = [
  'from-violet-600 to-purple-800',
  'from-blue-600 to-cyan-700',
  'from-emerald-600 to-teal-800',
  'from-orange-600 to-rose-700',
  'from-pink-600 to-fuchsia-800',
  'from-amber-600 to-orange-700',
]
function catGradient(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length]
}

export default function PublicServicesSection({ services, serviceCategories, slug }: Props) {
  const categoryNames = Array.from(new Set(services.map(s => s.category || 'Egyéb')))
  const catMetaMap = new Map(serviceCategories.map(c => [c.name.toLowerCase(), c]))

  const sortedCategories = [...categoryNames].sort((a, b) => {
    const oa = catMetaMap.get(a.toLowerCase())?.sort_order ?? 999
    const ob = catMetaMap.get(b.toLowerCase())?.sort_order ?? 999
    if (oa !== ob) return oa - ob
    return a.localeCompare(b, 'hu')
  })

  const hasMultipleCategories = sortedCategories.length > 1
  const [active, setActive] = useState<string | null>(hasMultipleCategories ? null : (sortedCategories[0] ?? null))

  // ── Category grid ──────────────────────────────────────────────────────────
  if (active === null) {
    return (
      <section>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Kínálatunk</p>
        <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-5">Válasszon kategóriát</h2>

        <div className="grid grid-cols-2 gap-3">
          {sortedCategories.map(cat => {
            const meta = catMetaMap.get(cat.toLowerCase())
            const imgUrl = meta ? categoryImageUrl(meta) : null
            const count = services.filter(s => (s.category || 'Egyéb') === cat).length

            return (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className="relative rounded-3xl aspect-[3/4] text-left group focus:outline-none overflow-hidden"
              >
                <div className="absolute inset-0">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={cat}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${catGradient(cat)}`} />
                  )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 border border-white/35 flex items-center justify-center">
                  <ArrowUpRight className="h-3.5 w-3.5 text-white" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
                  <p className="font-black text-white text-sm leading-tight">{cat}</p>
                  <p className="text-white/70 text-xs mt-0.5">{count} szolgáltatás</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  // ── Service list ───────────────────────────────────────────────────────────
  const filteredServices = services.filter(s => (s.category || 'Egyéb') === active)

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        {hasMultipleCategories && (
          <button
            onClick={() => setActive(null)}
            className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-shadow shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-zinc-700" />
          </button>
        )}
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Kínálatunk</p>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 leading-tight">{active}</h2>
        </div>
      </div>

      <div className="space-y-3">
        {filteredServices.map(s => {
          const imgUrl = serviceImageUrl(s)
          return (
            <div key={s.id} className="bg-white rounded-2xl overflow-hidden flex items-center gap-3 px-4 py-3.5 shadow-sm">
              {/* Image — left, small square */}
              {imgUrl && (
                <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0">
                  <img src={imgUrl} alt={s.name} className="h-full w-full object-cover object-top" />
                </div>
              )}

              {/* Info — middle */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 text-sm leading-tight">{s.name}</p>
                {s.description && (
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{s.description}</p>
                )}
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />{s.duration_minutes} perc
                </p>
                <p className="font-black text-sm text-zinc-900 mt-1">{formatPrice(s.price, s.currency)}</p>
              </div>

              {/* Book button — right edge */}
              <Link
                href={`/bookly/${slug}/book?serviceId=${s.id}`}
                className="shrink-0 h-10 w-10 rounded-full bg-zinc-950 flex items-center justify-center hover:bg-zinc-800 transition-colors"
              >
                <ArrowUpRight className="h-4 w-4 text-white" />
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
