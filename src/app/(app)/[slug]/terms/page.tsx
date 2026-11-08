import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui-kit'
import { GuestShell } from '@/components/blocks/guest-pages'
import { getPayloadClient } from '@/lib/payload'
import type { Media, Salon, Restaurant } from '@/payload/payload-types'
import { TermsContent, buildTermsItems, type CompanyInfo } from '@/components/booking/TermsContent'
import { getLocale } from '@/lib/i18n/server'
import { t, resolveAvailableLocales } from '@/lib/i18n'
import { brandImage, type BrandPlace } from '@/lib/brandImage'

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

  const logo = brandImage(biz as BrandPlace, 'email') // logó / ikon — a vendég-oldalak a levelekét követik (design 24.2)
  return (
    <GuestShell wide biz={{ name, logo }}>
      <div className="text-ui-sub font-light text-ui-text">{t(locale, 'public.terms.title')}</div>
      <div className="mt-5"><TermsContent light items={items} /></div>
      <Button variant="cell" href={`/${slug}`} icon={ArrowLeft} className="mt-6">{t(locale, 'public.back')}</Button>
    </GuestShell>
  )
}
