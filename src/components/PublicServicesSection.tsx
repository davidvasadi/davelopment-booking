'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, ChevronRight, ChevronLeft } from 'lucide-react'
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

const CARD_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-700',
  'from-emerald-500 to-teal-700',
  'from-orange-500 to-rose-700',
  'from-pink-500 to-fuchsia-700',
  'from-amber-500 to-orange-700',
]
function catGradient(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return CARD_GRADIENTS[h % CARD_GRADIENTS.length]
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

  const [active, setActive] = useState<string | null>(null)
  const hasMultipleCategories = sortedCategories.length > 1

  // Multiple categories and none selected → category card grid
  if (hasMultipleCategories && active === null) {
    return (
      <section>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Kínálatunk</p>
        <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-5">Szolgáltatások</h2>
        <div className="grid grid-cols-2 gap-3">
          {sortedCategories.map(cat => {
            const meta = catMetaMap.get(cat.toLowerCase())
            const imgUrl = meta ? categoryImageUrl(meta) : null
            const count = services.filter(s => (s.category || 'Egyéb') === cat).length

            return (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className="relative flex flex-col items-start p-4 rounded-2xl border border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-sm text-left transition-all duration-200 overflow-hidden group"
              >
                {imgUrl ? (
                  <div className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity">
                    <img src={imgUrl} alt={cat} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${catGradient(cat)} opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`} />
                )}
                <div className="relative">
                  {imgUrl && (
                    <div className="h-10 w-10 rounded-xl overflow-hidden mb-3 ring-1 ring-zinc-200">
                      <img src={imgUrl} alt={cat} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <p className="font-bold text-sm text-zinc-900 leading-tight">{cat}</p>
                  {meta?.duration_label && (
                    <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />{meta.duration_label}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 mt-1">{count} szolgáltatás</p>
                </div>
                <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  // Single category or category selected → service list
  const activeCategory = active ?? sortedCategories[0] ?? null
  const filteredServices = activeCategory
    ? services.filter(s => (s.category || 'Egyéb') === activeCategory)
    : services

  const subMap = filteredServices.reduce((acc, s) => {
    const sub = s.subcategory || ''
    if (!acc[sub]) acc[sub] = []
    acc[sub].push(s)
    return acc
  }, {} as Record<string, Service[]>)
  const subEntries = Object.entries(subMap)

  const meta = activeCategory ? catMetaMap.get(activeCategory.toLowerCase()) : null
  const imgUrl = meta ? categoryImageUrl(meta) : null

  return (
    <section>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Kínálatunk</p>
      <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-5">Szolgáltatások</h2>

      {hasMultipleCategories && (
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-1.5 text-zinc-500 text-sm mb-4 hover:text-zinc-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Összes kategória
        </button>
      )}

      {activeCategory && (imgUrl || meta?.duration_label || meta?.description) && (
        <div className="relative rounded-2xl overflow-hidden mb-4 h-32">
          {imgUrl && (
            <img src={imgUrl} alt={activeCategory} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/20" />
          <div className="relative p-5 h-full flex flex-col justify-center">
            <p className="text-white font-black text-lg leading-tight">{activeCategory}</p>
            {meta?.duration_label && (
              <p className="text-white/60 text-xs mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />{meta.duration_label}
              </p>
            )}
            {meta?.description && (
              <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{meta.description}</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {subEntries.map(([subcategory, items], si) => {
          const isLastGroup = si === subEntries.length - 1
          return (
            <div key={subcategory || '__none'}>
              {subcategory && (
                <div className="px-5 py-2 bg-zinc-50/50 border-b border-zinc-100">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{subcategory}</span>
                </div>
              )}
              {items.map((s, i) => {
                const sImgUrl = serviceImageUrl(s)
                const showBorder = i < items.length - 1 || !isLastGroup
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-4 px-5 py-4 ${showBorder ? 'border-b border-zinc-100' : ''}`}
                  >
                    {sImgUrl && (
                      <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0">
                        <img src={sImgUrl} alt={s.name} className="h-full w-full object-cover object-top" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{s.description}</p>
                      )}
                      <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{s.duration_minutes} perc
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="font-black text-sm text-zinc-900">{formatPrice(s.price, s.currency)}</p>
                      <Link
                        href={`/bookly/${slug}/book?serviceId=${s.id}`}
                        className="py-2.5 px-4 rounded-full bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors whitespace-nowrap"
                      >
                        Foglalás
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <Link
        href={`/bookly/${slug}/book?category=${encodeURIComponent(activeCategory ?? '')}`}
        className="mt-3 flex items-center justify-center gap-2 w-full h-11 rounded-full border border-zinc-200 bg-white text-zinc-700 text-sm font-semibold hover:border-zinc-400 transition-colors"
      >
        Összes {activeCategory && `„${activeCategory}"`} időpont <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  )
}
