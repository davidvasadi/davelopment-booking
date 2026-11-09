'use client'

import { ArrowUpRight, Clock, Mail, Phone, Zap } from 'lucide-react'
import { Reveal, RevealText } from '@/components/landing/Motion'
import { ContactForm } from '@/components/landing/ContactForm'
import { GoogleRatingBadge } from '@/components/landing/GoogleRatingBadge'
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_TEL, SUPPORT_HOURS_TEXT, SUPPORT_RESPONSE_TEXT } from '@/lib/brand'

/**
 * Kapcsolat-blokk (főoldal + /kapcsolat): balra címke, nagy cím, rövid szöveg és alul az
 * elérhetőségek; jobbra világos kártyán az űrlap témaválasztóval. Az elérhetőségek a
 * `src/lib/brand.ts`-ből jönnek (ugyanaz, mint a strukturált adatban). A /kapcsolat oldalon a
 * cím H1 (`asPage`), a főoldalon H2.
 */
export function ContactSection({
  googleRating,
  asPage = false,
}: {
  /** Cache-elt Google Cégem-pontszám (lásd src/lib/google-rating.ts) — null, ha még nincs cron-adat. */
  googleRating?: { rating: number; userRatingCount: number } | null
  asPage?: boolean
}) {
  const details = [
    { icon: Phone, label: 'Telefon', value: CONTACT_PHONE, href: `tel:${CONTACT_PHONE_TEL}` },
    { icon: Mail, label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
    { icon: Clock, label: 'Ügyfélszolgálat', value: SUPPORT_HOURS_TEXT },
    { icon: Zap, label: 'Válaszidő', value: SUPPORT_RESPONSE_TEXT },
  ]

  // a címsor-szint igazodik: oldalon H1 → H2, főoldalon H2 → H3
  const FormHeading = asPage ? 'h2' : 'h3'

  return (
    <section id="kapcsolat" className={`mx-auto max-w-7xl scroll-mt-[88px] px-4 lg:px-5 ${asPage ? 'pb-14 pt-8 lg:pb-20 lg:pt-12' : 'py-20 lg:py-28'}`}>
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        {/* Bal: szöveg + elérhetőségek */}
        <div className="flex flex-col justify-between gap-10">
          <div className="flex flex-col gap-5">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">
                <span aria-hidden className="h-2 w-2 rounded-[2px] bg-brand-accent" /> Kapcsolat
              </span>
            </Reveal>
            <RevealText
              as={asPage ? 'h1' : 'h2'}
              text="Beszéljünk a foglalásaidról."
              delay={0.1}
              className="max-w-[14ch] font-semibold text-[clamp(2rem,3.8vw,48px)] leading-[1] tracking-[-0.05em] text-brand-ink"
            />
            <Reveal delay={0.25} className="max-w-md text-[16px] leading-[1.6] text-brand-ink/60">
              Kérdésed van az árakról, a beállításról vagy egy funkcióról? Írj nekünk, vagy hívj ügyfélszolgálati időben — magyarul, személyesen válaszolunk.
            </Reveal>
          </div>

          <Reveal delay={0.3} className="flex flex-col gap-1">
            {details.map(({ icon: Icon, label, value, href }) => {
              const inner = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-brand-ink">
                    <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-brand-ink/45">{label}</span>
                    <span className={`block text-brand-ink ${href ? 'text-[clamp(1.1rem,1.6vw,22px)] font-medium tracking-[-0.02em]' : 'text-[15px]'}`}>{value}</span>
                  </span>
                  {href && <ArrowUpRight aria-hidden className="h-4 w-4 text-brand-ink/30 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink" />}
                </>
              )
              return href ? (
                <a key={label} href={href} className="group -mx-3 flex items-center gap-3.5 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/70">{inner}</a>
              ) : (
                <div key={label} className="flex items-center gap-3.5 py-2.5">{inner}</div>
              )
            })}
            {googleRating && (
              <GoogleRatingBadge rating={googleRating.rating} userRatingCount={googleRating.userRatingCount} className="mt-3 text-brand-ink/60" />
            )}
          </Reveal>
        </div>

        {/* Jobb: űrlap-kártya */}
        <Reveal delay={0.12} className="rounded-[26px] bg-white p-6 sm:p-8 lg:p-10">
          <FormHeading className="text-[clamp(1.5rem,2.4vw,30px)] font-semibold tracking-[-0.04em] text-brand-ink">Írj nekünk</FormHeading>
          <p className="mb-6 mt-2 max-w-lg text-[15px] leading-[1.6] text-brand-ink/55">
            Mondd el röviden, milyen üzleted van és mire keresel megoldást — a válaszban konkrét javaslattal jelentkezünk.
          </p>
          <ContactForm />
        </Reveal>
      </div>
    </section>
  )
}
