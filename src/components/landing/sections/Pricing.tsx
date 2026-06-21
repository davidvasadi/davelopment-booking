import { WalletMinimal, SquareKanban } from 'lucide-react'
import { FadeUp } from '@/components/landing/Motion'
import { SectionLabel } from '@/components/landing/SectionLabel'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'
import { ftFmt, type LandingPricing } from '@/components/landing/types'

/**
 * Árazás (Figma 287:767): eyebrow + nagy cím | jobb felső leírás, alatta két egyenlő kártya
 * (Starter szürke-gradient sárga gombbal / Pro sárga sötét gombbal). A kártya-gombok a közös
 * text-roll RollButton-ok („Kipróbálom ingyen"). Az árak a dinamikus `pricing`-ből.
 */
export function Pricing({ pricing }: { pricing: LandingPricing }) {
  return (
    <section id="arazas" className="mx-auto px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-[54px]">
      {/* Fejléc: eyebrow + nagy cím (bal) | leírás (jobb felső) — gomb NINCS (Figma) */}
      <div className="flex flex-col gap-[54px]">
        <SectionLabel>(Árazás)</SectionLabel>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <FadeUp>
            <h2 className="font-semibold text-[clamp(2.75rem,7vw,100px)] leading-[0.94] tracking-[-0.05em] text-brand-ink lg:max-w-[627px]">
              Egyszerű tiszta árazás.
            </h2>
          </FadeUp>
          <p className="text-[16px] leading-[1.5] text-brand-ink lg:text-right lg:max-w-[365px] lg:pt-3">
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő {pricing.trial_days} napig
            ingyenes, kártya nélkül.
          </p>
        </div>
      </div>

      {/* Két egyenlő kártya */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[30px] items-stretch">
        {/* Starter — szürke gradient, sárga gomb */}
        <FadeUp>
          <div className="h-full flex flex-col gap-[57px] rounded-[30px] bg-gradient-to-b from-[#f5f5f5] from-[84%] to-white px-[30px] py-[26px]">
            <span className="flex h-14 w-14 items-center justify-center rounded-[15px] bg-[#f4f4f4]">
              <WalletMinimal className="h-[30px] w-[30px] text-brand-ink" strokeWidth={1.75} />
            </span>
            <p className="font-semibold text-[32px] tracking-[-0.96px] text-brand-ink">(Starter)</p>
            <div className="flex flex-col gap-10 lg:gap-[68px]">
              <p className="font-semibold text-[clamp(3rem,7vw,90px)] leading-[0.95] tracking-[-0.06em] text-brand-ink">
                {ftFmt(pricing.salon_pro_huf)}<span className="tracking-normal">/hó</span>
              </p>
              <p className="text-[clamp(1.25rem,2.2vw,32px)] leading-[1.1] tracking-[-0.96px] text-brand-ink">
                Időpontfoglalás szalonoknak, fodrászoknak, masszőröknek, kozmetikusoknak.
              </p>
              <RollButton
                href="/register"
                label="Kipróbálom ingyen"
                variant="accent"
                size="lg"
                icon
                fullWidth
              />
            </div>
          </div>
        </FadeUp>

        {/* Pro — sárga, sötét gomb */}
        <FadeUp delay={0.08}>
          <div className="h-full flex flex-col gap-[57px] rounded-[30px] bg-brand-accent px-[30px] py-[26px]">
            <span className="flex h-14 w-14 items-center justify-center rounded-[15px] bg-[#f4f4f4]">
              <SquareKanban className="h-[30px] w-[30px] text-brand-ink" strokeWidth={1.75} />
            </span>
            <p className="font-semibold text-[32px] tracking-[-0.96px] text-brand-ink">(Pro)</p>
            <div className="flex flex-col gap-10 lg:gap-[68px]">
              <p className="font-semibold text-[clamp(3rem,7vw,90px)] leading-[0.95] tracking-[-0.06em] text-brand-ink">
                {ftFmt(pricing.restaurant_pro_huf)}<span className="tracking-normal">/hó</span>
              </p>
              <p className="text-[clamp(1.25rem,2.2vw,32px)] leading-[1.1] tracking-[-0.96px] text-brand-ink">
                Asztalfoglalás éttermeknek — kapacitás, asztaltérkép, csoportok, előleg.
              </p>
              <RollButton
                href="/register-restaurant"
                label="Kipróbálom ingyen"
                variant="dark"
                size="lg"
                icon
                fullWidth
              />
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
