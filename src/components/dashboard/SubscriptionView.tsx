import Link from 'next/link'
import { Lock, Settings, ArrowRight, Coins, Layers, CreditCard } from 'lucide-react'
import { CancelSubscriptionButton } from '@/components/dashboard/CancelSubscriptionButton'
import { StripeCheckoutButton } from '@/components/dashboard/StripeCheckoutButton'
import { BillingPortalButton } from '@/components/dashboard/BillingPortalButton'
import { SwitchCycleButton } from '@/components/dashboard/SwitchCycleButton'
import { PricingCards } from '@/components/dashboard/PricingCards'
import { AccountSwitcher } from '@/components/dashboard/AccountSwitcher'
import type { SwitcherBusiness } from '@/components/dashboard/StoreSwitcher'
import type { AccountBilling } from '@/lib/accountBilling'
import type { Pricing } from '@/lib/pricing'
import { applyCycle } from '@/lib/tier'
import type { Subscription } from '@/payload/payload-types'

/**
 * Fiók-szintű ELŐFIZETÉS nézet — davelopment-design (Crextio Pricing + davelopment booking Csomag).
 * Szerver-render; az egyetlen interaktív sziget a `PricingCards` (csomag-választás + havi/éves
 * ELŐNÉZET). A csomag AZ AKTÍV üzletre vonatkozik; a fizetés egy összevont számla a fiókra.
 * Minden korábbi funkció megmaradt: fiók-státusz, próbaidő, díj-összetétel, lemondás, számlázás.
 */

type Kind = 'salon' | 'restaurant'

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
}
function fmtDateShort(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}
function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}
const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

export function SubscriptionView({
  kind,
  sub,
  billing,
  pricing,
  activeBusinessId,
  businesses = [],
  activeKey = null,
  startedAt,
  settingsBase,
}: {
  kind: Kind
  sub: Subscription | null
  billing: AccountBilling
  pricing: Pricing
  /** Az aktív üzlet id-je (amire a csomag-választás vonatkozik). */
  activeBusinessId?: string | null
  /** A fiók összes üzlete az üzletváltó dropdownhoz. */
  businesses?: SwitcherBusiness[]
  /** Az aktív üzlet kulcsa (`type:id`) a switcherben. */
  activeKey?: string | null
  startedAt?: string | null
  /** pl. "/dashboard" vagy "/restaurant" — a settings/lock linkekhez. */
  settingsBase: string
}) {
  const isTrial = sub?.status === 'trialing'
  const isActivePro = sub?.status === 'active'
  const isLocked = sub?.status === 'past_due' || sub?.status === 'canceled'
  const cancelScheduled = sub?.cancel_at_period_end === true
  const days = isTrial ? daysLeft(sub?.trial_ends_at) : null

  const feeHuf = sub?.amount_huf ?? billing.totalMonthlyHuf
  const priceLabel = feeHuf > 0 ? ft(feeHuf) : 'Ingyenes'
  const periodEnd = isTrial ? sub?.trial_ends_at : sub?.current_period_end
  const cycle = billing.cycle

  // Jutalék-összehasonlítás (becslés): egy forgalomarányos rendszer a fiók méretével nő. Üzletenként
  // ~250 foglalás/hó × 200 Ft jutalék → mindig több, mint a fix díj. A megtakarítás a kettő különbsége.
  const estBookings = Math.max(1, billing.count) * 250
  const commissionEstimate = estBookings * 200
  const commissionSavings = Math.max(0, commissionEstimate - feeHuf)

  const noun = kind === 'restaurant' ? 'Étterem' : 'Szalon'
  const proName = `${noun} Pro`

  // Az AKTÍV üzlet a billing-tételek közül (tier + munkatárs-szám a csomag-választóhoz).
  const activeItem = activeBusinessId
    ? billing.items.find((i) => i.type === kind && i.id === activeBusinessId) ?? null
    : null
  const activeBusiness = activeItem
    ? { type: kind, id: activeItem.id, tier: activeItem.tier, staffCount: activeItem.staffCount }
    : null

  return (
    <div className="space-y-6 p-5 lg:p-0">

      {/* ── HERO ── */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">Számlázás</p>
        <h1 className="text-3xl font-light tracking-[-0.02em] text-ink lg:text-[42px]">Előfizetés</h1>
        <p className="mt-1.5 text-[13px] font-medium text-ink-soft">
          Fiók-szintű · több üzletnél a díjak összeadódnak · áfa nélkül
        </p>
      </div>

      {/* ── PORTFÓLIÓ BANNER — Fiókod accordion (jobb-széli gomb → teljes panel) + havidíj a fejlécben ── */}
      <AccountSwitcher
        count={billing.count}
        breakdown={sub?.breakdown || billing.items.map((i) => i.name).join(' · ') || proName}
        businesses={businesses}
        activeKey={activeKey}
        right={
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${
              cancelScheduled ? 'bg-amber-400'
              : isActivePro ? 'bg-emerald-400'
              : isTrial ? 'bg-blue-400'
              : isLocked ? 'bg-red-400' : 'bg-zinc-300'
            }`} />
            <div className="text-right">
              <div className="text-xs text-ink-soft">{cancelScheduled ? 'Hozzáférés vége' : isTrial ? 'Hátralévő próba' : 'Havidíj'}</div>
              <div className="text-[22px] font-light tracking-[-0.02em] text-ink">
                {isTrial && days !== null
                  ? <>{days === 0 ? 'Ma' : `${days} nap`}</>
                  : cancelScheduled
                    ? fmtDateShort(periodEnd)
                    : <>{feeHuf > 0 ? feeHuf.toLocaleString('hu-HU') : 'Ingyenes'} {feeHuf > 0 && <span className="text-[13px] font-medium text-ink-soft">Ft/hó</span>}</>}
              </div>
            </div>
          </div>
        }
      />

      {/* ── LOCK NOTICE (past_due / canceled) ── */}
      {isLocked && (
        <div className="rounded-[26px] border border-red-200 bg-red-50 p-5 lg:p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 font-bold text-red-700">
                {sub?.status === 'past_due' ? 'Lejárt a próbaidőszakod' : 'Az előfizetésed megszűnt'}
              </p>
              <p className="text-sm text-red-700/80">
                A dashboard funkciók le vannak tiltva amíg nincs aktív előfizetés. A vendégek továbbra is tudnak foglalni a nyilvános oldaladon.
              </p>
            </div>
          </div>
          <Link
            href={`${settingsBase}/settings?tab=billing`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-dav-pill bg-ink-dark px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
          >
            <Settings className="h-4 w-4" />
            Tovább a beállításokhoz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* ── ÁLLAPOT-SOR — CSAK érdemi állapotnál (próba / lemondás / hiba). A plain „Aktív" sor kivéve. ── */}
      {!(isActivePro && !cancelScheduled) && (
        <div className="flex items-center gap-3 rounded-[26px] dav-card-glass px-5 py-4">
          <span className={`h-2 w-2 shrink-0 rounded-full ${
            cancelScheduled ? 'bg-amber-400'
            : isTrial ? 'bg-blue-400'
            : isLocked ? 'bg-red-400' : 'bg-zinc-300'
          }`} />
          <p className="flex-1 text-sm text-ink-soft">
            {isTrial && <>Próbaidőszakban vagy. <b className="font-semibold text-ink">{days ?? 0} nap</b> múlva lejár — utána a választott csomag lép életbe.</>}
            {isActivePro && cancelScheduled && <>Az előfizetésed <b className="font-semibold text-amber-600">{fmtDate(periodEnd)}-én megszűnik</b>. Eddig minden Pro funkció elérhető.</>}
            {sub?.status === 'past_due' && <><b className="font-semibold text-red-600">Fizetési hiba</b> — frissítsd a számlázási adataidat.</>}
            {sub?.status === 'canceled' && <>Az előfizetésed <b className="font-semibold text-red-600">megszűnt</b>.</>}
            {sub?.status === 'paused' && <>Az előfizetésed <b className="font-semibold text-amber-600">szünetel</b>.</>}
            {!sub && <>Nincs aktív előfizetés a fiókodon.</>}
          </p>
        </div>
      )}

      {/* ── CSOMAG-VÁLASZTÓ (az aktív üzletre; havi/éves ELŐNÉZET a kártyákon) ── */}
      <PricingCards
        kind={kind}
        pricing={pricing}
        annualDiscountPct={billing.annualDiscountPct}
        currentCycle={cycle}
        activeBusiness={activeBusiness}
        isTrial={isTrial}
        needsCheckout={!isTrial && !isActivePro}
      />

      {/* ── JUTALÉK-KALKULÁTOR + ÜZLET-BONTÁS (megjelenítés) ── */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[26px] dav-card-glass p-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gold">
              <Coins className="h-[17px] w-[17px] text-ink-dark" strokeWidth={1.7} />
            </div>
            <div className="text-[18px] font-medium text-ink">Fix díj, nulla jutalék</div>
          </div>
          <p className="mt-3 max-w-[520px] text-sm leading-relaxed text-ink-soft">
            A nemzetközi rendszerek foglalásonként jutalékot kérnek — minél jobban megy, annál többet fizetsz.
            A davelopment booking <b className="font-semibold text-ink">fix havidíjas</b>: ugyanannyi 20 vagy 200 foglalásnál.
          </p>
          <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row">
            <div className="min-w-0 flex-1 rounded-[18px] p-4" style={{ background: '#F4ECD8' }}>
              <div className="text-xs font-medium" style={{ color: '#9A8B52' }}>Jutalékos rendszer (becslés)</div>
              <div className="mt-1 text-[26px] font-light tracking-[-0.02em] text-ink">~{ft(commissionEstimate)}</div>
              <div className="mt-0.5 text-xs text-ink-soft">~{estBookings.toLocaleString('hu-HU')} foglalás × 200 Ft / hó</div>
            </div>
            <div className="min-w-0 flex-1 rounded-[18px] bg-ink-dark p-4">
              <div className="text-xs font-medium text-white/55">A fiókod (fix)</div>
              <div className="mt-1 text-[26px] font-light tracking-[-0.02em] text-gold">{priceLabel}</div>
              <div className="mt-0.5 text-xs text-white/50">akárhány foglalás · havonta</div>
            </div>
          </div>
          {commissionSavings > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-[16px] border border-dashed border-line-strong px-4 py-3">
              <span className="text-[13px] text-ink-soft">Megtakarítás a fix díjjal</span>
              <span className="text-[15px] font-semibold text-ink">~{ft(commissionSavings)} / hó</span>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-[26px] dav-card-glass p-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gold">
              <Layers className="h-[17px] w-[17px] text-ink-dark" strokeWidth={1.7} />
            </div>
            <div className="text-[18px] font-medium text-ink">Üzleteid és csomagjuk</div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            A díjak egy összevont számlán adódnak össze. A csomagot üzletenként a fenti választóval állítod (válts át az üzletre).
          </p>
          <div className="mt-3 flex-1">
            {billing.items.length === 0 ? (
              <p className="py-3 text-sm text-ink-soft">Nincs üzlet a fiókban.</p>
            ) : (
              billing.items.map((it, i, arr) => (
                <div
                  key={`${it.type}:${it.id}`}
                  className={`flex items-center justify-between gap-3 py-3 ${i < arr.length - 1 ? 'border-b border-dashed border-line-strong' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{it.name}</span>
                      <span className={`shrink-0 rounded-dav-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        it.tier === 'egyedi' ? 'bg-gold text-ink-dark' : 'bg-ink-dark text-gold'
                      }`}>
                        {it.tier === 'egyedi' ? 'Egyedi' : 'Pro'}
                      </span>
                    </div>
                    <div className="text-xs text-ink-soft">
                      {it.type === 'salon' && <>{it.staffCount} munkatárs · </>}
                      {ft(applyCycle(it.feeHuf, cycle, billing.annualDiscountPct))} / hó
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[15px] font-semibold text-ink">Összesen / hó</span>
            <span className="text-2xl font-light tracking-[-0.02em] text-ink">{ft(billing.totalMonthlyHuf)}</span>
          </div>
          {cycle === 'annual' && billing.items.length > 0 && billing.listMonthlyHuf > billing.totalMonthlyHuf && (
            <p className="mt-2 text-xs text-ink-soft2">
              Éves számlázással <b className="font-semibold text-ink">−{billing.annualDiscountPct}%</b> · lista {ft(billing.listMonthlyHuf)}/hó
            </p>
          )}
          {isTrial && (
            <p className="mt-3 text-xs text-ink-soft2">
              Próbaidőszak alatt még nincs levonás — a fenti összeg a próba után lép életbe.
            </p>
          )}
        </div>
      </div>

      {/* ── FIZETÉS / SZÁMLÁZÁS ── */}
      <div className="overflow-hidden rounded-[26px] dav-card-glass">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gold">
              <CreditCard className="h-[17px] w-[17px] text-ink-dark" strokeWidth={1.7} />
            </div>
            <h2 className="text-[18px] font-medium text-ink">Fizetés</h2>
          </div>
          {isActivePro && <BillingPortalButton variant="link" label="Számlák · kártya" />}
        </div>
        <div className="p-5 lg:p-6">
          {isActivePro ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-[16px] px-5 py-4" style={{ background: '#FBF9F2' }}>
                <div>
                  <div className="text-xs text-ink-soft">{cancelScheduled ? 'Hozzáférés vége' : 'Következő terhelés'}</div>
                  <div className="mt-0.5 text-sm font-semibold text-ink">{fmtDate(periodEnd)}</div>
                </div>
                <div className="text-[26px] font-light tracking-[-0.02em] text-ink">
                  {feeHuf > 0 ? feeHuf.toLocaleString('hu-HU') : '0'} <span className="text-[13px] font-medium text-ink-soft">Ft{cycle === 'annual' ? '/hó (éves)' : ''}</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {cancelScheduled
                  ? 'Az előfizetés a következő számlázási dátumkor lejár. Nem kerül több levonásra.'
                  : cycle === 'annual'
                    ? 'Éves számlázás. Bármikor lemondhatod.'
                    : 'Automatikusan megújul havonta. Bármikor lemondhatod.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <CancelSubscriptionButton cancelScheduled={cancelScheduled} periodEndLabel={fmtDate(periodEnd)} />
                <BillingPortalButton label="Bankkártya cseréje" />
                {!cancelScheduled && <SwitchCycleButton currentCycle={cycle} />}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-[16px] px-5 py-4" style={{ background: '#FBF9F2' }}>
                <div>
                  <div className="text-xs text-ink-soft">A próbaidő után a fiók díja</div>
                  <div className="mt-0.5 text-sm font-semibold text-ink">Bankkártyás fizetés · bármikor lemondható</div>
                </div>
                <div className="text-[26px] font-light tracking-[-0.02em] text-ink">
                  {feeHuf > 0 ? feeHuf.toLocaleString('hu-HU') : '0'} <span className="text-[13px] font-medium text-ink-soft">Ft{cycle === 'annual' ? '/hó (éves)' : '/hó'}</span>
                </div>
              </div>
              <StripeCheckoutButton cycle={cycle} />
              <p className="text-xs leading-relaxed text-ink-soft">
                A fizetés a Stripe biztonságos oldalán történik. Számla a sikeres terhelés után.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Indulás dátuma */}
      <p className="px-1 text-xs text-ink-soft2">
        Fiók indulása: {fmtDate(startedAt)} · {billing.count} üzlet a fiókban
      </p>
    </div>
  )
}

