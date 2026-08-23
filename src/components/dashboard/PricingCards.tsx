'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { Pricing } from '@/lib/pricing'
import { businessMonthlyFee, applyCycle, monthlyEmailCapForTier, type Tier } from '@/lib/tier'
import { buttonHover, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { NotchedPricingCard } from './NotchedPricingCard'

/**
 * Csomag-kártyák a Csomag/Előfizetés oldalon — HÁROM kártya az AKTÍV üzletre, a
 * `NotchedPricingCard` (bemart-sarkú, Figma "Pricing") közös stílusában:
 *  - „Starter" = belépő szint, kisebb havi hírlevél-küldési kerettel.
 *  - „Pro" = a normál, önkiszolgáló csomag (MINDEN funkció, kiemelve). Havi/éves ciklus-váltó a
 *    kártyán belül (ELŐNÉZET), éves ciklusnál ÁTHÚZOTT havi ár → kedvezményes ár. A tényleges
 *    átállás a gombbal (`/api/subscription/select`).
 *  - „Egyedi" = testreszabott (kapcsolatfelvétel).
 * A hírlevél-küldés MINDHÁROM csomaghoz BEÉPÍTVE jár — csak a havi email-keret (a `sub`) tér el.
 */

type Kind = 'salon' | 'restaurant'
type Cycle = 'monthly' | 'annual'

// Az éves-ciklus VÁLASZTÓ (nem maga a funkció) egyelőre elrejtve — élesítés előtt még nincs
// letesztelve valódi Stripe-fizetéssel. A kód/logika szándékosan megmarad (applyCycle, a
// backend cycle-kezelés stb.) — csak a felhasználó nem tudja kiválasztani a UI-ból, amíg ezt
// vissza nem kapcsoljuk. `previewCycle` így gyakorlatilag mindig 'monthly' marad.
const ANNUAL_BILLING_UI_ENABLED = false

const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

/** Pill-alakú CTA, körös nyíllal — ugyanaz a minta, mint a hírlevél-csomagváltó gombja.
 *  `variant="gold"`: arany test, sötét kör (elsődleges akció). `variant="dark"`: sötét test,
 *  arany kör (másodlagos, pl. kapcsolatfelvétel-link). `href` esetén linkként renderel. */
function PillCta({
  label, icon, href, onClick, disabled, loading, variant,
}: {
  label: string
  /** Az ikon a jobb szélen lévő körben hoverre becsúszó nyíl helyett/mellett — alapból nyíl. */
  icon?: React.ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant: 'gold' | 'dark'
}) {
  const Comp = href ? motion.a : motion.button
  const circleIcon = icon ?? <ArrowRight className={cn('h-3.5 w-3.5', variant === 'gold' ? 'text-white' : 'text-ink-dark')} />
  return (
    <Comp
      {...(href ? { href } : { type: 'button' })}
      onClick={onClick}
      disabled={disabled}
      variants={buttonHover}
      initial="rest"
      whileHover={disabled ? undefined : 'hover'}
      className={cn(
        'flex h-11 w-full items-center rounded-full text-[13.5px] font-medium transition-opacity hover:opacity-90 disabled:opacity-90',
        disabled
          // Letiltva: kontúros "ghost" gomb, nincs kitöltés — a variant fill zavarna a
          // szaggatott kerettel, ezért ilyenkor NEM kapja meg a bg-gold/bg-ink-dark osztályt.
          ? cn('justify-center border border-dashed', variant === 'gold' ? 'border-white/25 text-white' : 'border-ink/15 text-ink-soft')
          : cn('justify-between pl-5 pr-1.5', variant === 'gold' ? 'bg-gold text-ink-dark' : 'bg-ink-dark text-white'),
      )}
    >
      {label}
      {!disabled && (
        <span className={cn('relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full', variant === 'gold' ? 'bg-ink-dark' : 'bg-gold')}>
          {loading ? (
            <Loader2 className={cn('h-3.5 w-3.5 animate-spin', variant === 'gold' ? 'text-white' : 'text-ink-dark')} />
          ) : (
            <>
              <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 32 } }} transition={{ duration: 0.28, ease: EASE }}>
                {circleIcon}
              </motion.div>
              <motion.div className="absolute flex" variants={{ rest: { x: -32 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                {circleIcon}
              </motion.div>
            </>
          )}
        </span>
      )}
    </Comp>
  )
}

export function PricingCards({
  kind,
  pricing,
  annualDiscountPct,
  currentCycle,
  activeBusiness,
  isTrial,
  needsCheckout = false,
  onCycleChange,
}: {
  kind: Kind
  pricing: Pricing
  annualDiscountPct: number
  currentCycle: Cycle
  /** Az AKTÍV üzlet (amire a csomag vonatkozik). Null → csak megjelenítés. */
  activeBusiness: { type: Kind; id: string; tier: Tier; staffCount: number } | null
  isTrial: boolean
  /** Lejárt/megszűnt előfizetésnél true → a Pro CTA csak elmenti a ciklust (checkout külön). */
  needsCheckout?: boolean
  /** Ha a szülő követni akarja a kiválasztott ciklust (pl. checkout gombhoz). */
  onCycleChange?: (cycle: Cycle) => void
}) {
  const router = useRouter()
  const [previewCycle, setPreviewCycle] = useState<Cycle>(currentCycle)
  const [pending, setPending] = useState(false)

  const noun = kind === 'restaurant' ? 'Étterem' : 'Szalon'
  const isSalon = kind === 'salon'
  const staffCount = activeBusiness?.staffCount ?? 0
  const isAnnual = previewCycle === 'annual'

  // Ár: a nyers (havi ciklusú) díj = étterem fix / szalon alapdíj + per-fő. Éves = −kedvezmény.
  const starterRaw = businessMonthlyFee(pricing, kind, staffCount, 'starter')
  const monthlyRaw = businessMonthlyFee(pricing, kind, staffCount, 'pro')
  const effStarter = applyCycle(starterRaw, previewCycle, annualDiscountPct)
  const effMonthly = applyCycle(monthlyRaw, previewCycle, annualDiscountPct)
  const yearlyTotal = effMonthly * 12
  const extraPerStaff = applyCycle(pricing.salon_extra_staff_huf, previewCycle, annualDiscountPct)
  const starterCap = monthlyEmailCapForTier(pricing, 'starter')
  const proCap = monthlyEmailCapForTier(pricing, 'pro')

  const billingNote = isAnnual
    ? `évi ${ft(yearlyTotal)}${isSalon ? ` · ${staffCount} naptár` : ''}`
    : isSalon
      ? `${staffCount} naptár · +${ft(extraPerStaff)}/további fő`
      : 'fix havidíj'
  const starterNote = `${starterCap.toLocaleString('hu-HU')} email/hó${isSalon ? ` · ${staffCount} naptár` : ''}`

  // A Starter funkcionálisan MEGEGYEZIK a Próval — az egyetlen valós különbség a havi
  // hírlevél-email-keret, ezért a feat-lista is ugyanaz, csak az utolsó sor kerete tér el.
  const baseFeats = [
    { label: 'Saját foglaló oldal, ami éjjel-nappal hoz neked időpontot', included: true },
    { label: 'Automata email-visszaigazolás naptárfájllal (.ics)', included: true },
    { label: isSalon ? 'Korlátlan munkatárs, csak a ténylegesen aktívakért fizetsz' : 'Korlátlan terem & asztal', included: true },
    { label: 'Élő analitika + vendég-térkép — lásd, honnan jönnek', included: true },
    { label: 'Többnyelvű foglaló + offline is működik (PWA)', included: true },
    { label: 'Emlékeztetők, várólista, értékelés-kérés — automatikusan', included: true },
  ]
  const starterFeats = [...baseFeats, { label: `Hírlevél-küldés — ${starterCap.toLocaleString('hu-HU')} email/hó`, included: true }]
  const proFeats = [...baseFeats, { label: `Hírlevél-küldés — ${proCap.toLocaleString('hu-HU')} email/hó`, included: true }]
  // Egyedi: díjcsomag megegyezés alapján, ezért nincs kiírt keret-szám — a hírlevél-küldés
  // korlátlanként kommunikálva (a valós plafont a `pricing-settings` global magasra állítja).
  const customFeats = [
    { label: 'Minden a Próból', included: true },
    { label: 'Több telephely egy fiókban', included: true },
    { label: 'Egyedi fejlesztés az igényeidre', included: true },
    { label: 'Testreszabott foglaló + arculat', included: true },
    { label: 'Dedikált kapcsolattartó', included: true },
    { label: 'Prioritásos támogatás & SLA', included: true },
    { label: 'Korlátlan hírlevél-küldés', included: true },
    { label: 'API-hozzáférés egyedi integrációkhoz', included: true },
    { label: 'Egyedi riportok és exportálás', included: true },
    { label: 'Rugalmas, egyedi fizetési feltételek', included: true },
  ]

  async function selectTier(tier: 'starter' | 'pro') {
    if (!activeBusiness || pending) return
    setPending(true)
    try {
      const res = await fetch('/api/subscription/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeBusiness.type, id: activeBusiness.id, tier, cycle: previewCycle }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; cancelReversed?: boolean }
      if (!res.ok) throw new Error(data.error || 'hiba')
      if (data.cancelReversed) {
        toast.success('Az előfizetés visszaállt — a lemondás törölve')
      } else {
        toast.success(`Mentve · ${isAnnual ? 'éves' : 'havi'} számlázás`)
      }
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült menteni.')
    } finally {
      setPending(false)
    }
  }

  const sameCycle = previewCycle === currentCycle
  const currentTier = activeBusiness?.tier ?? 'pro'
  const onStarter = currentTier === 'starter' && sameCycle
  const onPro = currentTier !== 'starter' && currentTier !== 'egyedi' && sameCycle
  const starterCtaLabel = needsCheckout
    ? (onStarter ? 'Kiválasztva' : `Kiválasztom — ${isAnnual ? 'éves' : 'havi'}`)
    : onStarter
      ? (isTrial ? 'Jelenlegi (próba)' : 'Jelenlegi csomag')
      : `Váltás ${isAnnual ? 'éves' : 'havi'} számlázásra`
  const proCtaLabel = needsCheckout
    ? (onPro ? 'Kiválasztva' : `Kiválasztom — ${isAnnual ? 'éves' : 'havi'}`)
    : onPro
      ? (isTrial ? 'Jelenlegi (próba)' : 'Jelenlegi csomag')
      : `Váltás ${isAnnual ? 'éves' : 'havi'} számlázásra`
  const starterBadgeLabel = onStarter ? (isTrial ? 'Próba' : 'Aktív') : 'Belépő'
  const proBadgeLabel = onPro ? (isTrial ? 'Próba' : 'Aktív') : 'Népszerű'
  const onEgyedi = currentTier === 'egyedi'
  const egyediBadgeLabel = onEgyedi ? 'Aktív' : 'Egyedi'

  const cycleToggle = (
    <div className="inline-flex gap-1 rounded-dav-pill bg-white/10 p-1">
      {(['annual', 'monthly'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => { setPreviewCycle(c); onCycleChange?.(c) }}
          className={`rounded-[15px] px-3.5 py-1.5 text-[12.5px] transition-colors ${
            previewCycle === c ? 'bg-white font-semibold text-ink-dark' : 'font-medium text-white/60 hover:text-white'
          }`}
        >
          {c === 'annual' ? <>Éves <span className={previewCycle === 'annual' ? 'text-[#8a6d12]' : 'text-gold'}>−{annualDiscountPct}%</span></> : 'Havi'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-medium text-ink">Csomag</h2>
        <p className="text-[13px] text-ink-soft">
          {activeBusiness
            ? `A(z) aktív ${noun.toLowerCase()}ra vonatkozik · másik üzlethez válts át fent`
            : 'Az aktív üzletre vonatkozik'}
        </p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-3">
        <NotchedPricingCard
          featured={false}
          badgeLabel={starterBadgeLabel}
          dotColor="#A8A496"
          title="Starter"
          priceMain={effStarter.toLocaleString('hu-HU')}
          priceUnit="Ft / hó"
          sub={starterNote}
          feats={starterFeats}
          cta={
            <PillCta
              label={starterCtaLabel}
              onClick={onStarter ? undefined : () => selectTier('starter')}
              disabled={onStarter || pending}
              loading={pending}
              variant="dark"
            />
          }
        />

        <NotchedPricingCard
          featured
          badgeLabel={proBadgeLabel}
          dotColor="#F1CE45"
          title="Pro"
          priceStrike={isAnnual ? monthlyRaw.toLocaleString('hu-HU') : undefined}
          priceMain={effMonthly.toLocaleString('hu-HU')}
          priceUnit="Ft / hó"
          sub={billingNote}
          extra={ANNUAL_BILLING_UI_ENABLED ? cycleToggle : undefined}
          feats={proFeats}
          cta={
            <PillCta
              label={proCtaLabel}
              onClick={onPro ? undefined : () => selectTier('pro')}
              disabled={onPro || pending}
              loading={pending}
              variant="gold"
            />
          }
        />

        <NotchedPricingCard
          featured={false}
          badgeLabel={egyediBadgeLabel}
          dotColor="#1D1C19"
          title="Egyedi"
          priceMain="Egyedi"
          priceUnit="ajánlat"
          sub="a megrendelővel egyeztetve"
          feats={customFeats}
          cta={
            <PillCta
              label={onEgyedi ? 'Jelenlegi csomag' : 'Kapcsolatfelvétel'}
              href={onEgyedi ? undefined : `mailto:hello@davelopment.hu?subject=Egyedi%20${encodeURIComponent(noun.toLowerCase())}%20csomag`}
              disabled={onEgyedi}
              variant="dark"
            />
          }
        />
      </div>
    </div>
  )
}
