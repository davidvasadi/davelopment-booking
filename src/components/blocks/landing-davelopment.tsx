import { ArrowUpRight } from 'lucide-react'
import { Reveal } from '@/components/landing/Motion'
import { SERVICES } from '@/lib/davelopmentServices'

/**
 * davelopment (az anyacég) ajánló-blokk a landing-oldalakra — K2 nyelven, a menü „[davelopment]” paneljének elemeiből:
 * balra a davelopment.hu füstös háttere a logóval (az egész kártya link), jobbra a szöveg, a szolgáltatások (külső
 * linkek) és a gomb. A linkek `utm_source=booking` jelölést kapnak, hogy a davelopment.hu-n látsszon, mennyi látogató
 * jön innen. `campaign`: melyik oldalról (pl. „fodrasz-idopontfoglalas”, „funkciok-foglalas”).
 */
const withUtm = (href: string, campaign: string) => {
  if (!href.startsWith('https://davelopment.hu')) return href
  const u = new URL(href)
  u.searchParams.set('utm_source', 'booking')
  u.searchParams.set('utm_medium', 'cta')
  u.searchParams.set('utm_campaign', campaign)
  return u.toString()
}

export function DavelopmentCtaK2({ campaign = 'landing', title = 'Komplexebb weboldalt vagy marketinget szeretnél?', lead = 'Egyedi weboldal, arculat, online hirdetések vagy saját üzleti rendszer — a davelopment csapata megcsinálja, ugyanazok, akik a davelopment bookingot is építették.' }: {
  campaign?: string; title?: string; lead?: string
}) {
  const home = withUtm('https://davelopment.hu', campaign)
  const services = SERVICES.filter((s) => s.href.startsWith('https://davelopment.hu'))
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 font-onest text-ui-text lg:px-5 lg:py-20">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4">
        <Reveal>
          <a href={home} target="_blank" rel="noopener" aria-label="davelopment.hu — webes ügynökség"
            className="group relative flex h-full min-h-[280px] flex-col justify-between overflow-hidden rounded-ui-container bg-ui-cell p-6 lg:min-h-[420px] lg:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/hero/davelopment-fust-hatter-davelopment-booking.webp" alt="" width={1280} height={1280} loading="lazy" decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
            <span className="relative flex h-10 w-10 items-center justify-center self-end rounded-full bg-white text-ui-text shadow-[0_4px_12px_-6px_rgba(0,0,0,.3)] transition-colors group-hover:bg-ui-dark group-hover:text-white"> {/* ui-allow: a menü stúdió-kártyájának nyila */}
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_davelopment_dark.svg" alt="davelopment" width={2034} height={526} className="h-9 w-auto lg:h-11" />
              <span className="mt-2 block text-ui-body text-ui-text/70">Webes ügynökség — Budapest és Debrecen.</span>
            </span>
          </a>
        </Reveal>
        <Reveal delay={0.06} className="flex flex-col justify-center rounded-ui-container bg-[#F7F7F7] px-7 py-9 lg:px-12 lg:py-14">
          <span className="self-start rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 text-[14px] font-medium text-ui-text/80">Webes ügynökség</span> {/* ui-allow: a SectionHead pill-formája */}
          <h2 className="mt-5 text-[clamp(1.8rem,3.2vw,44px)] font-medium leading-[1.08] tracking-[-0.035em]">{title}</h2> {/* ui-allow: szakaszcím */}
          <p className="mt-4 max-w-[560px] text-ui-row leading-[1.55] text-ui-muted">{lead}</p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {services.map((s) => (
              <a key={s.label} href={withUtm(s.href, campaign)} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-ui-meta font-medium text-ui-text/80 transition-colors hover:bg-ui-dark hover:text-white">
                {s.label}<ArrowUpRight className="h-3.5 w-3.5 opacity-50" strokeWidth={2} />
              </a>
            ))}
          </div>
          <a href={home} target="_blank" rel="noopener"
            className="mt-8 inline-flex h-12 items-center gap-2 self-start rounded-full bg-ui-dark px-6 text-ui-row font-medium text-white transition-opacity hover:opacity-90">
            Ismerd meg a davelopmentet <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </Reveal>
      </div>
    </section>
  )
}
