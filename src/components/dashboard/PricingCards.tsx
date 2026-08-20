'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowRight, Loader2, MessagesSquare } from 'lucide-react'
import type { Pricing } from '@/lib/pricing'
import { businessMonthlyFee, applyCycle } from '@/lib/tier'
import { buttonHover, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { NotchedPricingCard } from './NotchedPricingCard'

/**
 * Csomag-kártyák a Csomag/Előfizetés oldalon — KÉT kártya az AKTÍV üzletre, a
 * `NotchedPricingCard` (bemart-sarkú, Figma "Pricing") közös stílusában, mint a hírlevél-
 * csomagválasztó a Beállításokban:
 *  - „Pro" = a normál, önkiszolgáló csomag (MINDEN funkció). Havi/éves ciklus-váltó a kártyán
 *    belül (ELŐNÉZET), éves ciklusnál ÁTHÚZOTT havi ár → kedvezményes ár. A tényleges átállás
 *    a gombbal (`/api/subscription/select`).
 *  - „Egyedi" = testreszabott (kapcsolatfelvétel).
 */

type Kind = 'salon' | 'restaurant'
type Cycle = 'monthly' | 'annual'

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
  activeBusiness: { type: Kind; id: string; tier: 'pro' | 'egyedi'; staffCount: number } | null
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
  const monthlyRaw = businessMonthlyFee(pricing, kind, staffCount)
  const effMonthly = applyCycle(monthlyRaw, previewCycle, annualDiscountPct)
  const yearlyTotal = effMonthly * 12
  const extraPerStaff = applyCycle(pricing.salon_extra_staff_huf, previewCycle, annualDiscountPct)

  const billingNote = isAnnual
    ? `évi ${ft(yearlyTotal)}${isSalon ? ` · ${staffCount} naptár` : ''}`
    : isSalon
      ? `${staffCount} naptár · +${ft(extraPerStaff)}/további fő`
      : 'fix havidíj'

  const proFeats = [
    { label: 'Saját foglaló oldal, ami éjjel-nappal hoz neked időpontot', included: true },
    { label: 'Automata email-visszaigazolás naptárfájllal (.ics)', included: true },
    { label: isSalon ? 'Korlátlan munkatárs, csak a ténylegesen aktívakért fizetsz' : 'Korlátlan terem & asztal', included: true },
    { label: 'Élő analitika + vendég-térkép — lásd, honnan jönnek', included: true },
    { label: 'Többnyelvű foglaló + offline is működik (PWA)', included: true },
    { label: 'Emlékeztetők, várólista, értékelés-kérés — automatikusan', included: true },
  ]
  const customFeats = [
    { label: 'Minden a Próból', included: true },
    { label: 'Több telephely egy fiókban', included: true },
    { label: 'Egyedi fejlesztés az igényeidre', included: true },
    { label: 'Testreszabott foglaló + arculat', included: true },
    { label: 'Dedikált kapcsolattartó', included: true },
    { label: 'Prioritásos támogatás & SLA', included: true },
  ]

  async function selectPro() {
    if (!activeBusiness || pending) return
    setPending(true)
    try {
      const res = await fetch('/api/subscription/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeBusiness.type, id: activeBusiness.id, tier: 'pro', cycle: previewCycle }),
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
  const proCtaLabel = needsCheckout
    ? (sameCycle ? 'Kiválasztva' : `Kiválasztom — ${isAnnual ? 'éves' : 'havi'}`)
    : sameCycle
      ? (isTrial ? 'Jelenlegi (próba)' : 'Jelenlegi csomag')
      : `Váltás ${isAnnual ? 'éves' : 'havi'} számlázásra`
  const badgeLabel = activeBusiness?.tier === 'egyedi' ? 'Egyedi' : isTrial ? 'Próba' : 'Aktív'

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

      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        <NotchedPricingCard
          featured
          badgeLabel={badgeLabel}
          dotColor="#F1CE45"
          title={`${noun} Pro`}
          priceStrike={isAnnual ? monthlyRaw.toLocaleString('hu-HU') : undefined}
          priceMain={effMonthly.toLocaleString('hu-HU')}
          priceUnit="Ft / hó"
          sub={billingNote}
          extra={cycleToggle}
          feats={proFeats}
          cta={
            <PillCta
              label={proCtaLabel}
              onClick={sameCycle ? undefined : selectPro}
              disabled={sameCycle || pending}
              loading={pending}
              variant="gold"
            />
          }
        />

        <NotchedPricingCard
          featured={false}
          badgeLabel="Egyedi"
          dotColor="#A8A496"
          title={`${noun} Egyedi`}
          priceMain="Egyedi"
          priceUnit="ajánlat"
          sub="a megrendelővel egyeztetve"
          feats={customFeats}
          cta={
            <PillCta
              label="Kapcsolatfelvétel"
              href={`mailto:hello@davelopment.hu?subject=Egyedi%20${encodeURIComponent(noun.toLowerCase())}%20csomag`}
              icon={<MessagesSquare className="h-3.5 w-3.5 text-ink-dark" strokeWidth={1.8} />}
              variant="dark"
            />
          }
        />
      </div>
    </div>
  )
}
