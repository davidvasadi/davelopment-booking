'use client'

import { motion } from 'framer-motion'
import { SPRING_QUICK } from '@/lib/motion'
import { ftFmt, type LandingPricing } from '@/components/landing/types'
import { NotchedPricingCard } from '@/components/dashboard/NotchedPricingCard'
import { HeroButton } from '@/components/landing/HeroButton'

export function Pricing({ pricing }: { pricing: LandingPricing }) {
  const salonFeatures = [
    'Saját foglaló oldal, ami éjjel-nappal hoz neked időpontot',
    'Csapat-jogosultságkezelés — ki mit láthat és módosíthat',
    'Vendég-előleg beszedése foglaláskor (Stripe)',
    'Automata számlázás a saját Számlázz.hu/Billingo fiókodból',
    'Ajándékutalvány-értékesítés a foglaló oldaladon',
    'Hírlevél-marketing küldés a vendégeidnek',
    'Élő analitika + vendég-térkép — lásd, honnan jönnek',
    'Emlékeztetők, várólista, értékelés-kérés — automatikusan',
  ].map((label) => ({ label, included: true }))

  const restaurantFeatures = [
    'Interaktív asztaltérkép, valós idejű kapacitással',
    'Csoportos foglalás és előleg-kezelés egy helyen',
    'Csapat-jogosultságkezelés — ki mit láthat és módosíthat',
    'Automata számlázás a saját Számlázz.hu/Billingo fiókodból',
    'Ajándékutalvány-értékesítés a foglaló oldaladon',
    'Hírlevél-marketing küldés a vendégeidnek.',
    'Élő analitika + vendég-térkép — lásd, honnan jönnek',
    'Automata vendégemlékeztető, hogy ne maradjon üres asztal',
    'Napi forgalom- és vendégjelentés',
  ].map((label) => ({ label, included: true }))

  return (
    <section id="arazas" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-12">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className="flex flex-col gap-6"
      >
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
          Árak
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <h2 className="font-semibold text-[clamp(2.25rem,5.5vw,72px)] leading-[0.94] tracking-[-0.05em] text-brand-ink">
            Egyszerű, tiszta árazás.
          </h2>
          <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-sm lg:pb-1">
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő {pricing.trial_days} napig ingyenes, kártya nélkül.
          </p>
        </div>
      </motion.div>

      {/* Kártyák — a dashboard bemart-sarkú `NotchedPricingCard`-ja, egységes stílus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch max-w-[1200px] mx-auto w-full font-onest">

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px 0px' }}
          transition={{ duration: 0.55, delay: 0 }}
          className="h-full"
        >
          <NotchedPricingCard
            featured={false}
            badgeLabel="Népszerű"
            dotColor="#A8A496"
            title="Szakemberek"
            priceMain={ftFmt(pricing.salon_pro_huf).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub="Fodrász, masszőr, kozmetikus, edzőterem"
            extra={
              <p className="text-[12px] font-medium text-ink-soft2">
                + {ftFmt(pricing.salon_extra_staff_huf)}/hó minden további munkatársért.
              </p>
            }
            feats={salonFeatures}
            cta={<HeroButton href="/register" label="Kipróbálom ingyen" variant="dark" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px 0px' }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="h-full"
        >
          <NotchedPricingCard
            featured
            badgeLabel="Ajánlott"
            dotColor="#F1CE45"
            title="Éttermek"
            priceMain={ftFmt(pricing.restaurant_pro_huf).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub="Asztaltérkép, csoportok, előleg"
            feats={restaurantFeatures}
            cta={<HeroButton href="/register-restaurant" label="Kipróbálom ingyen" variant="white" />}
          />
        </motion.div>

      </div>
    </section>
  )
}
