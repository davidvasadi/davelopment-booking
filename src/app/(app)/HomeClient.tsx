import type { LandingPricing } from '@/components/landing/types'
import { Nav } from '@/components/landing/sections/Nav'
import { Hero } from '@/components/landing/sections/Hero'
import { Marquee } from '@/components/landing/sections/Marquee'
import { Demo } from '@/components/landing/sections/Demo'
import { Vision } from '@/components/landing/sections/Vision'
import { Services } from '@/components/landing/sections/Services'
import { Testimonials } from '@/components/landing/sections/Testimonials'
import { Pricing } from '@/components/landing/sections/Pricing'
import { Faq } from '@/components/landing/sections/Faq'
import { Pulse } from '@/components/landing/sections/Pulse'
import { CtaBanner } from '@/components/landing/sections/CtaBanner'
import { Footer } from '@/components/landing/sections/Footer'

export type { LandingPricing }

/**
 * A marketing landing vékony kompozíciója. Minden szekció self-contained, propból kap
 * (dinamikus árazás), a saját kliens-határát maga kezeli — ez a fájl szerver-komponens marad,
 * így a statikus szekciók (Nav, Pricing, Footer) nem visznek fölös JS-t a kliensre.
 */
export default function HomeClient({ pricing }: { pricing: LandingPricing }) {
  return (
    <main className="min-h-screen bg-white text-brand-ink font-geist">
      <Nav />
      <Hero pricing={pricing} />
      <Marquee />
      <section id="hogyan">
        <Demo />
      </section>
      <Vision />
      <Services />
      <Testimonials />
      <Pricing pricing={pricing} />
      <Faq pricing={pricing} />
      <Pulse />
      <CtaBanner trial_days={pricing.trial_days} />
      <Footer trial_days={pricing.trial_days} />
    </main>
  )
}
