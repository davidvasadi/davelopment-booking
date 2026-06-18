import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Restaurant } from '@/payload/payload-types'
import { TermsContent, buildTermsItems, type CompanyInfo } from '@/components/booking/TermsContent'
import { getLocale } from '@/lib/i18n/server'
import { t, resolveAvailableLocales } from '@/lib/i18n'

export const metadata = { title: 'Foglalási feltételek' }

/** Egy salon vagy restaurant rekordból a feltételek + cégadatok kinyerése. */
function extract(biz: Salon | Restaurant): { name: string; sections: { title?: string | null; body?: string | null }[]; company: CompanyInfo } {
  return {
    name: biz.name,
    sections: biz.terms_sections ?? [],
    company: {
      name: biz.name,
      legal_name: biz.legal_name,
      tax_number: biz.tax_number,
      company_reg_number: biz.company_reg_number,
      registered_seat: biz.registered_seat,
      email: biz.email,
      phone: biz.phone,
    },
  }
}

export default async function TermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const requested = await getLocale()
  const payload = await getPayloadClient()

  // Salon először, ha nincs aktív, étterem. Előbb HU-n töltünk a supported_locales megismeréséhez.
  const salonRes = await payload.find({
    collection: 'salons',
    where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
    limit: 1,
    locale: 'hu',
    fallbackLocale: 'hu',
  })
  let collection: 'salons' | 'restaurants' = 'salons'
  let biz: Salon | Restaurant | undefined = salonRes.docs[0] as Salon | undefined
  if (!biz) {
    const restRes = await payload.find({
      collection: 'restaurants',
      where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
      limit: 1,
      locale: 'hu',
      fallbackLocale: 'hu',
    })
    collection = 'restaurants'
    biz = restRes.docs[0] as Restaurant | undefined
  }
  if (!biz) notFound()

  // A kért nyelvet a tulaj engedélyezett nyelveihez szűkítjük; ha nem HU, a feltételeket azon töltjük.
  const available = resolveAvailableLocales(biz.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  if (locale !== 'hu') {
    biz = (await payload.findByID({ collection, id: biz.id, locale, fallbackLocale: 'hu' })) as Salon | Restaurant
  }

  const { name, sections, company } = extract(biz)
  const items = buildTermsItems(sections, company, locale)
  if (items.length === 0) notFound()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-white/50 dark:hover:text-white transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          {t(locale, 'public.back')}
        </Link>

        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 py-5 border-b border-zinc-100 dark:border-white/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/40">{name}</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-900 dark:text-white">{t(locale, 'public.terms.title')}</h1>
          </div>
          <div className="px-6 sm:px-8 py-6">
            <TermsContent items={items} />
          </div>
        </div>
      </div>
    </div>
  )
}
